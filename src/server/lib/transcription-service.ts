import { randomUUID } from "node:crypto";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { analyzeMusicologicalScore } from "../../lib/musicological-analysis.js";
import type {
  AnalysisRecord,
  NormalizedScore,
  ScoreEvent,
  ScoreTranscription,
  TranscriptionUncertainty,
  TranscriptionCorrection,
} from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";
import { LineageService } from "./lineage-service.js";
import { WorkspaceStore } from "./workspace-store.js";
import { SourceTruthService } from "./source-truth-service.js";

type TranscriptionServiceOptions = {
  store: WorkspaceStore;
  now?: () => Date;
  createId?: () => string;
};

export type TranscriptionCorrectionResult = {
  scoreTranscription: ScoreTranscription;
  normalizedScore: NormalizedScore;
  analysisRecord: AnalysisRecord;
  sourceTruthAssessmentIds: string[];
  staleDerivationIds: string[];
};

export type ScoreAnchoredReviewItem = {
  uncertainty: TranscriptionUncertainty;
  events: ScoreEvent[];
  sourceImageUrl?: string;
};

export type ScoreAnchoredReview = {
  transcriptionId: string;
  version: number;
  status: ScoreTranscription["status"];
  sourceArtifactId: string;
  sourceFilename: string;
  sourceContentUrl: string;
  acceptanceBatches: NonNullable<ScoreTranscription["acceptanceBatches"]>;
  items: ScoreAnchoredReviewItem[];
};

export class TranscriptionService {
  private readonly store: WorkspaceStore;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: TranscriptionServiceOptions) {
    assertAuthorityPathRuntime("authority.validator.source-interpretation", "production");
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  review(workspaceId: string, transcriptionId: string): ScoreAnchoredReview {
    assertAuthorityPathRuntime("authority.validator.source-interpretation", "production");
    const transcription = this.store.getScoreTranscription(workspaceId, transcriptionId);
    const source = this.store.getSourceArtifact(workspaceId, transcription.sourceArtifactId);
    if (!transcription.omrRunId) {
      throw new ApiRouteError(
        `Score-Anchored optical review is unavailable for ${transcription.ingestion?.sourceFormat ?? "this parsed source"}`,
        409
      );
    }
    const omrRun = this.store.getOmrRun(workspaceId, transcription.omrRunId);
    const reopenedIds = this.analysisReopenedUncertaintyIds(workspaceId, transcription.id);
    const items = transcription.uncertainties
      .filter(
        (uncertainty) =>
          uncertainty.critical && (!uncertainty.resolved || reopenedIds.has(uncertainty.id))
      )
      .map((uncertainty) => {
        const page = uncertainty.region?.page;
        const imagePath =
          page && uncertainty.region?.coordinateSpace === "omr_raster"
            ? omrRun.nativeArtifactPaths.find((candidate) =>
                candidate.endsWith(`/audiveris-page-${page}.png`)
              )
            : undefined;
        return {
          uncertainty: reopenedIds.has(uncertainty.id)
            ? {
                ...uncertainty,
                resolved: false,
                message: `${uncertainty.message} Analysis introduced a new material consequence requiring review.`,
              }
            : uncertainty,
          sourceImageUrl: imagePath
            ? `/api/workspaces/${workspaceId}/omr-runs/${omrRun.id}/artifacts/${encodeURIComponent(`audiveris-page-${page}.png`)}`
            : undefined,
          events: uncertainty.eventIds.map((eventId) => {
            const event = transcription.events.find((candidate) => candidate.id === eventId);
            if (!event) {
              throw new ApiRouteError(
                `Transcription uncertainty ${uncertainty.id} references missing event ${eventId}`,
                500
              );
            }
            return event;
          }),
        };
      });

    return {
      transcriptionId: transcription.id,
      version: transcription.version,
      status: transcription.status,
      sourceArtifactId: source.id,
      sourceFilename: source.filename,
      sourceContentUrl: `/api/workspaces/${workspaceId}/sources/${source.id}/content`,
      acceptanceBatches: transcription.acceptanceBatches ?? [],
      items,
    };
  }

  correct(
    workspaceId: string,
    transcriptionId: string,
    correction: TranscriptionCorrection
  ): TranscriptionCorrectionResult {
    assertAuthorityPathRuntime("authority.validator.source-interpretation", "production");
    if (correction.eventEdits.length === 0) {
      throw new ApiRouteError(
        "A transcription correction must confirm or edit at least one recognized event",
        400
      );
    }
    if (correction.correctionId) {
      const existing = this.findCompletedCorrection(workspaceId, correction.correctionId);
      if (existing) return existing;
    }
    const current = this.store.getScoreTranscription(workspaceId, transcriptionId);
    const uncertainty = current.uncertainties.find(
      (candidate) => candidate.id === correction.uncertaintyId
    );
    if (!uncertainty) {
      throw new ApiRouteError(
        `Transcription uncertainty not found: ${correction.uncertaintyId}`,
        404
      );
    }
    const analysisReopened = this.analysisReopenedUncertaintyIds(workspaceId, current.id).has(
      uncertainty.id
    );
    if (uncertainty.resolved && !analysisReopened) {
      throw new ApiRouteError(
        `Transcription uncertainty is already resolved: ${uncertainty.id}`,
        409
      );
    }

    const edits = new Map(correction.eventEdits.map((edit) => [edit.eventId, edit]));
    if (edits.size !== correction.eventEdits.length) {
      throw new ApiRouteError("A transcription correction cannot edit the same event twice", 400);
    }
    for (const eventId of edits.keys()) {
      if (!uncertainty.eventIds.includes(eventId)) {
        throw new ApiRouteError(
          `Event ${eventId} is outside transcription uncertainty ${uncertainty.id}`,
          400
        );
      }
      if (!current.events.some((event) => event.id === eventId)) {
        throw new ApiRouteError(`Transcription event not found: ${eventId}`, 404);
      }
    }

    for (const edit of edits.values()) {
      if ((edit.partName || edit.partRole) && !edit.partId) {
        throw new ApiRouteError("A voice name or role requires partId", 400);
      }
      if (edit.partId && !current.parts.some((part) => part.id === edit.partId) && !edit.partName) {
        throw new ApiRouteError(`A new voice requires partName: ${edit.partId}`, 400);
      }
    }

    const events = current.events.map((event) => applyEventEdit(event, edits.get(event.id)));
    const parts = [...current.parts];
    for (const edit of edits.values()) {
      if (!edit.partId || parts.some((part) => part.id === edit.partId)) continue;
      parts.push({ id: edit.partId, name: edit.partName!, role: edit.partRole ?? "other" });
    }
    const uncertainties = current.uncertainties.map((candidate) =>
      candidate.id === uncertainty.id ? { ...candidate, resolved: true } : candidate
    );
    const timestamp = this.now().toISOString();
    const next: ScoreTranscription = {
      ...current,
      id: `transcription.${this.createId()}`,
      parentId: current.id,
      version: current.version + 1,
      status: uncertainties.some((candidate) => candidate.critical && !candidate.resolved)
        ? "needs_review"
        : "reviewed",
      parts,
      events,
      uncertainties,
      corrections: [
        ...(current.corrections ?? []),
        {
          ...(correction.correctionId ? { correctionId: correction.correctionId } : {}),
          uncertaintyId: correction.uncertaintyId,
          eventIds: correction.eventEdits.map((edit) => edit.eventId),
          rationale: correction.rationale,
          createdAt: timestamp,
        },
      ],
      createdAt: timestamp,
    };
    this.store.saveScoreTranscription(workspaceId, next);

    const normalized: NormalizedScore = {
      id: `score.${this.createId()}`,
      scoreTranscriptionId: next.id,
      version: next.version,
      title: next.title,
      key: next.key,
      timeSignature: next.timeSignature,
      parts: next.parts,
      measures: next.measures,
      events: next.events,
      performedForm: next.performedForm,
      notationIssues: next.notationIssues,
      createdAt: timestamp,
    };
    this.store.saveNormalizedScore(workspaceId, normalized);
    const priorScore = this.store
      .get(workspaceId)
      .normalizedScoreIds.map((id) => this.store.getNormalizedScore(workspaceId, id))
      .find((score) => score.scoreTranscriptionId === current.id);
    let analysisRecord = analyzeMusicologicalScore(normalized, {
      id: `analysis.${this.createId()}`,
      createdAt: timestamp,
    });
    const validIds = new Set([
      ...normalized.parts.map((part) => part.id),
      ...normalized.measures.map((measure) => measure.id),
      ...normalized.events.map((event) => event.id),
    ]);
    const priorAnalysis = priorScore
      ? this.store
          .get(workspaceId)
          .analysisRecordIds.map((id) => this.store.getAnalysisRecord(workspaceId, id))
          .filter((record) => record.normalizedScoreId === priorScore.id)
          .sort((left, right) => right.version - left.version)[0]
      : undefined;
    const carriedCorrections = (priorAnalysis?.claims ?? []).filter(
      (claim) =>
        claim.basis === "user_correction" &&
        claim.subjectIds.every((id) => validIds.has(id)) &&
        (claim.scope?.measureIds ?? []).every((id) => validIds.has(id)) &&
        (claim.scope?.eventIds ?? []).every((id) => validIds.has(id))
    );
    if (carriedCorrections.length) {
      const correctedKinds = new Set(carriedCorrections.map((claim) => claim.kind));
      analysisRecord = {
        ...analysisRecord,
        claims: [
          ...analysisRecord.claims.filter((claim) => !correctedKinds.has(claim.kind)),
          ...carriedCorrections,
        ],
      };
    }
    this.store.saveAnalysisRecord(workspaceId, analysisRecord);
    const allAssessments = this.store
      .get(workspaceId)
      .sourceTruthAssessmentIds.map((id) => this.store.getSourceTruthAssessment(workspaceId, id));
    const supersededIds = new Set(
      allAssessments.flatMap((assessment) => assessment.supersedesAssessmentId ?? [])
    );
    const priorAssessments = allAssessments.filter(
      (assessment) =>
        assessment.scoreTranscriptionId === current.id && !supersededIds.has(assessment.id)
    );
    const truthService = new SourceTruthService({
      store: this.store,
      now: this.now,
      createId: this.createId,
    });
    const nextAssessments = priorAssessments.map((priorAssessment) =>
      truthService.assess(workspaceId, {
        sourceArtifactId: next.sourceArtifactId,
        scoreTranscriptionId: next.id,
        normalizedScoreId: normalized.id,
        analysisRecordId: analysisRecord.id,
        scope: priorAssessment.scope,
        preservationPolicy: priorAssessment.preservationPolicy,
        ...(priorAssessment.performanceBriefId
          ? { performanceBriefId: priorAssessment.performanceBriefId }
          : {}),
        targetConfigurationIds: priorAssessment.targetConfigurationIds,
        priorAssessmentId: priorAssessment.id,
      })
    );
    const lineage = new LineageService({
      store: this.store,
      now: this.now,
      createId: this.createId,
    });
    const changedEventIds = correction.eventEdits.map((edit) => edit.eventId);
    const staleDerivations = nextAssessments.flatMap((assessment, index) =>
      lineage.markSourceTruthDependentsStale(
        workspaceId,
        priorAssessments[index]!.id,
        assessment.id,
        `Transcription correction ${correction.uncertaintyId} superseded Source Truth Assessment ${priorAssessments[index]!.id}`,
        changedEventIds
      )
    );
    if (priorScore && priorAssessments.length === 0) {
      staleDerivations.push(
        ...lineage.markArrangementsStale(
          workspaceId,
          priorScore.id,
          normalized.id,
          `Transcription correction ${correction.uncertaintyId} produced a new normalized score`,
          changedEventIds
        )
      );
    }
    return {
      scoreTranscription: next,
      normalizedScore: normalized,
      analysisRecord,
      sourceTruthAssessmentIds: nextAssessments.map((assessment) => assessment.id),
      staleDerivationIds: staleDerivations.map((record) => record.id),
    };
  }

  private findCompletedCorrection(
    workspaceId: string,
    correctionId: string
  ): TranscriptionCorrectionResult | undefined {
    const workspace = this.store.get(workspaceId);
    const scoreTranscription = workspace.scoreTranscriptionIds
      .map((id) => this.store.getScoreTranscription(workspaceId, id))
      .find((candidate) =>
        candidate.corrections?.some((record) => record.correctionId === correctionId)
      );
    if (!scoreTranscription) return undefined;
    const normalizedScore = workspace.normalizedScoreIds
      .map((id) => this.store.getNormalizedScore(workspaceId, id))
      .find((candidate) => candidate.scoreTranscriptionId === scoreTranscription.id);
    const analysisRecord = normalizedScore
      ? workspace.analysisRecordIds
          .map((id) => this.store.getAnalysisRecord(workspaceId, id))
          .filter((candidate) => candidate.normalizedScoreId === normalizedScore.id)
          .sort((left, right) => right.version - left.version)[0]
      : undefined;
    if (!normalizedScore || !analysisRecord) {
      throw new ApiRouteError(
        `Completed correction ${correctionId} has incomplete persisted descendants`,
        500
      );
    }
    return {
      scoreTranscription,
      normalizedScore,
      analysisRecord,
      sourceTruthAssessmentIds: workspace.sourceTruthAssessmentIds.filter((id) => {
        const assessment = this.store.getSourceTruthAssessment(workspaceId, id);
        return assessment.scoreTranscriptionId === scoreTranscription.id;
      }),
      staleDerivationIds: [],
    };
  }

  private analysisReopenedUncertaintyIds(
    workspaceId: string,
    transcriptionId: string
  ): Set<string> {
    const assessments = this.store
      .get(workspaceId)
      .sourceTruthAssessmentIds.map((id) => this.store.getSourceTruthAssessment(workspaceId, id))
      .filter((assessment) => assessment.scoreTranscriptionId === transcriptionId);
    const supersededIds = new Set(
      assessments.flatMap((assessment) => assessment.supersedesAssessmentId ?? [])
    );
    return new Set(
      assessments
        .filter((assessment) => !supersededIds.has(assessment.id))
        .flatMap((assessment) => assessment.consequences)
        .filter(
          (consequence) =>
            consequence.discoveredBy === "analysis" &&
            consequence.unresolved &&
            consequence.material &&
            consequence.critical
        )
        .map((consequence) => consequence.uncertaintyId)
    );
  }
}

function applyEventEdit(
  event: ScoreEvent,
  edit: TranscriptionCorrection["eventEdits"][number] | undefined
): ScoreEvent {
  if (!edit) return event;
  const reassigned = edit.partId ? { ...event, partId: edit.partId, confidence: 1 } : event;
  if (edit.pitch !== undefined) {
    if (reassigned.type !== "note") {
      throw new ApiRouteError(`Cannot assign pitch to rest event: ${event.id}`, 400);
    }
    return { ...reassigned, pitch: edit.pitch, confidence: 1 };
  }
  return reassigned;
}
