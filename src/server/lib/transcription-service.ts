import { randomUUID } from "node:crypto";
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

type TranscriptionServiceOptions = {
  store: WorkspaceStore;
  now?: () => Date;
  createId?: () => string;
};

export type TranscriptionCorrectionResult = {
  scoreTranscription: ScoreTranscription;
  normalizedScore: NormalizedScore;
  analysisRecord: AnalysisRecord;
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
  items: ScoreAnchoredReviewItem[];
};

export class TranscriptionService {
  private readonly store: WorkspaceStore;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: TranscriptionServiceOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  review(workspaceId: string, transcriptionId: string): ScoreAnchoredReview {
    const transcription = this.store.getScoreTranscription(workspaceId, transcriptionId);
    const source = this.store.getSourceArtifact(workspaceId, transcription.sourceArtifactId);
    if (!transcription.omrRunId) {
      throw new ApiRouteError(
        `Score-Anchored optical review is unavailable for ${transcription.ingestion?.sourceFormat ?? "this parsed source"}`,
        409
      );
    }
    const omrRun = this.store.getOmrRun(workspaceId, transcription.omrRunId);
    const items = transcription.uncertainties
      .filter((uncertainty) => uncertainty.critical && !uncertainty.resolved)
      .map((uncertainty) => {
        const page = uncertainty.region?.page;
        const imagePath =
          page && uncertainty.region?.coordinateSpace === "omr_raster"
            ? omrRun.nativeArtifactPaths.find((candidate) =>
                candidate.endsWith(`/audiveris-page-${page}.png`)
              )
            : undefined;
        return {
          uncertainty,
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
      items,
    };
  }

  correct(
    workspaceId: string,
    transcriptionId: string,
    correction: TranscriptionCorrection
  ): TranscriptionCorrectionResult {
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
    if (uncertainty.resolved) {
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
      version: 1,
      title: next.title,
      key: next.key,
      timeSignature: next.timeSignature,
      parts: next.parts,
      measures: next.measures,
      events: next.events,
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
    const staleDerivations = priorScore
      ? new LineageService({
          store: this.store,
          now: this.now,
          createId: this.createId,
        }).markArrangementsStale(
          workspaceId,
          priorScore.id,
          normalized.id,
          `Transcription correction ${correction.uncertaintyId} produced a new normalized score`,
          correction.eventEdits.map((edit) => edit.eventId)
        )
      : [];
    return {
      scoreTranscription: next,
      normalizedScore: normalized,
      analysisRecord,
      staleDerivationIds: staleDerivations.map((record) => record.id),
    };
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
