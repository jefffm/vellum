import { createHash, randomUUID } from "node:crypto";
import { arrangeFaithfulPluckedString } from "../../lib/baroque-guitar-arranger.js";
import { InstrumentModel } from "../../lib/instrument-model.js";
import { analyzeMusicologicalScore } from "../../lib/musicological-analysis.js";
import { arrangeContinuo } from "../../lib/continuo-arranger.js";
import { arrangeImitativeIntabulation } from "../../lib/imitative-arranger.js";
import { buildCompleteTransformationReport } from "../../lib/transformation-report.js";
import type {
  ArrangementCandidate,
  ArrangementScore,
  ArrangementSearch,
  AnalysisRecord,
  NormalizedScore,
} from "../../lib/music-domain.js";
import type { PreservationPolicy } from "../../lib/preservation-policy.js";
import { ApiRouteError } from "./create-route.js";
import { loadProfile } from "../profiles.js";
import { WorkspaceStore } from "./workspace-store.js";
import { OwnerStore } from "./owner-store.js";

type ArrangementServiceOptions = {
  store: WorkspaceStore;
  now?: () => Date;
  createId?: () => string;
  loadInstrument?: (instrumentId: string) => InstrumentModel;
  ownerStore?: OwnerStore;
};

export type CreateFaithfulArrangementInput = {
  normalizedScoreId: string;
  targetConfigurationId: string;
  preservationPolicy?: PreservationPolicy;
  arrangementFamilyId?: string;
  branchId?: string;
  parentArrangementScoreId?: string;
  version?: number;
  editorialCommitmentIds?: string[];
  familyCommitmentIds?: string[];
  policyExceptionIds?: string[];
  regenerationFrom?: { arrangementScoreId: string; changedSourceEventIds: string[] };
};

export type CreateFaithfulArrangementResult = {
  analysisRecordId: string;
  analysis: AnalysisRecord;
  arrangementSearch: ArrangementSearch;
  candidates: ArrangementCandidate[];
  arrangementScore: ArrangementScore;
};

export class ArrangementService {
  private readonly store: WorkspaceStore;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly loadInstrument: (instrumentId: string) => InstrumentModel;
  private readonly ownerStore?: OwnerStore;

  constructor(options: ArrangementServiceOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.ownerStore = options.ownerStore;
    this.loadInstrument =
      options.loadInstrument ??
      ((instrumentId) => InstrumentModel.fromProfile(loadProfile(instrumentId)));
  }

  createFaithfulReduction(
    workspaceId: string,
    input: CreateFaithfulArrangementInput
  ): CreateFaithfulArrangementResult {
    let workspace = this.store.get(workspaceId);
    let targetConfiguration = workspace.brief.targetConfigurations.find(
      (target) => target.id === input.targetConfigurationId
    );
    if (!targetConfiguration) {
      throw new ApiRouteError(
        `Target Configuration not found in workspace: ${input.targetConfigurationId}`,
        404
      );
    }
    if (this.ownerStore) {
      const resolved = this.ownerStore.applyDefaults(targetConfiguration);
      targetConfiguration = resolved.target;
      if (resolved.applications.length) {
        workspace = this.store.updateBrief(workspaceId, {
          ...workspace.brief,
          targetConfigurations: workspace.brief.targetConfigurations.map((target) =>
            target.id === targetConfiguration!.id ? targetConfiguration! : target
          ),
          personalDefaultApplications: [
            ...(workspace.brief.personalDefaultApplications ?? []).filter(
              (item) => item.targetConfigurationId !== targetConfiguration!.id
            ),
            ...resolved.applications,
          ],
        });
      }
    }
    const score = this.store.getNormalizedScore(workspaceId, input.normalizedScoreId);
    const transcription = this.store.getScoreTranscription(workspaceId, score.scoreTranscriptionId);
    if (transcription.status === "needs_review") {
      const critical = transcription.uncertainties.filter(
        (uncertainty) => uncertainty.critical && !uncertainty.resolved
      );
      throw new ApiRouteError(
        `Score-Anchored Review is required before arrangement. Unresolved critical uncertainties: ${critical
          .map((uncertainty) => uncertainty.id)
          .join(", ")}`,
        409
      );
    }
    const timestamp = this.now().toISOString();
    const analysis =
      workspace.analysisRecordIds
        .map((id) => this.store.getAnalysisRecord(workspaceId, id))
        .filter((record) => record.normalizedScoreId === score.id)
        .sort((left, right) => right.version - left.version)[0] ??
      analyzeMusicologicalScore(score, {
        id: `analysis.${this.createId()}`,
        createdAt: timestamp,
      });
    if (!workspace.analysisRecordIds.includes(analysis.id)) {
      this.store.saveAnalysisRecord(workspaceId, analysis);
    }
    const criticalAnalysisAmbiguities = (analysis.ambiguities ?? []).filter(
      (ambiguity) => ambiguity.critical && !ambiguity.resolution
    );
    if (criticalAnalysisAmbiguities.length) {
      throw new ApiRouteError(
        `Musicological Analysis review is required before arrangement: ${criticalAnalysisAmbiguities
          .map((ambiguity) => ambiguity.id)
          .join(", ")}`,
        409
      );
    }
    const familyId =
      input.arrangementFamilyId ?? stableFamilyId(score.id, analysis.id, workspace.brief);
    const currentWorkspace = this.store.get(workspaceId);
    if (!currentWorkspace.arrangementFamilyIds.includes(familyId)) {
      this.store.saveArrangementFamily(workspaceId, {
        id: familyId,
        normalizedScoreId: score.id,
        analysisRecordId: analysis.id,
        brief: workspace.brief,
        arrangementScoreIds: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    } else if (input.arrangementFamilyId) {
      const family = this.store.getArrangementFamily(workspaceId, familyId);
      this.store.saveArrangementFamily(workspaceId, {
        ...family,
        normalizedScoreId: score.id,
        analysisRecordId: analysis.id,
        updatedAt: timestamp,
      });
    }
    const arrangementId = `arrangement.${this.createId()}`;
    const searchId = `search.${arrangementId.slice("arrangement.".length)}`;
    const rankingWeights = {
      historicalProfile: 0.15,
      idiom: 0.2,
      playability: 0.25,
      voiceLeading: 0.2,
      notationClarity: 0.1,
      softPreferences: 0.1,
    };
    let arrangementSearch = this.store.saveArrangementSearch(workspaceId, {
      id: searchId,
      normalizedScoreId: score.id,
      analysisRecordId: analysis.id,
      arrangementFamilyId: familyId,
      branchId: input.branchId,
      targetConfiguration,
      preservationPolicy: input.preservationPolicy ?? "faithful_reduction",
      status: "running",
      candidateIds: [],
      rankingWeights,
      createdAt: timestamp,
    });
    let generated;
    try {
      if (targetConfiguration.realizationProfileId) {
        const targetInstrument =
          targetConfiguration.instrumentId === "piano"
            ? undefined
            : this.loadInstrument(targetConfiguration.instrumentId);
        generated = arrangeContinuo(score, analysis, {
          arrangementId,
          createdAt: timestamp,
          targetConfiguration,
          targetInstrument,
          preservationPolicy: input.preservationPolicy,
        });
      } else if (analysis.texture === "imitative-polyphony") {
        const instrument = this.loadInstrument(targetConfiguration.instrumentId);
        generated = arrangeImitativeIntabulation(score, analysis, instrument, {
          arrangementId,
          createdAt: timestamp,
          targetConfiguration,
          preservationPolicy: input.preservationPolicy,
        });
      } else {
        const instrument = this.loadInstrument(targetConfiguration.instrumentId);
        if (
          targetConfiguration.tuningId &&
          targetConfiguration.instrumentId === "baroque-lute-13"
        ) {
          instrument.setDiapasonScheme(targetConfiguration.tuningId);
        }
        generated = arrangeFaithfulPluckedString(score, analysis, instrument, {
          arrangementId,
          createdAt: timestamp,
          targetConfiguration,
          preservationPolicy: input.preservationPolicy,
        });
      }
    } catch (error) {
      this.store.saveArrangementSearch(workspaceId, {
        ...arrangementSearch,
        status: "failed",
        completedAt: timestamp,
      });
      throw error;
    }
    const selectedStrategy = generated.candidates.find(
      (candidate) => candidate.id === generated.selected.selectedCandidateId
    )?.strategy;
    const candidates = persistableCandidates(
      generated.candidates,
      searchId,
      timestamp,
      rankingWeights
    ).map((candidate) => this.store.saveArrangementCandidate(workspaceId, candidate));
    const selectedCandidate = candidates.find((candidate) => candidate.status === "selected")!;
    if (selectedCandidate.rank !== 1) {
      throw new Error(
        `Arrangement ranking disagrees with the arranger selection for ${selectedStrategy ?? "unknown strategy"}: ${candidates.map((candidate) => `${candidate.strategy}=${candidate.evaluation?.weightedTotal}`).join(", ")}`
      );
    }
    const arrangementScore: ArrangementScore = {
      ...generated.selected,
      version: input.version ?? 1,
      arrangementSearchId: searchId,
      arrangementFamilyId: familyId,
      branchId: input.branchId,
      parentArrangementScoreId: input.parentArrangementScoreId,
      editorialCommitmentIds: input.editorialCommitmentIds ?? [],
      familyCommitmentIds: input.familyCommitmentIds ?? [],
      policyExceptionIds: input.policyExceptionIds ?? [],
      selectedCandidateId: selectedCandidate.id,
    };
    if (input.regenerationFrom) {
      arrangementScore.regeneration = {
        kind: "conservative",
        staleArrangementScoreId: input.regenerationFrom.arrangementScoreId,
        changedSourceEventIds: input.regenerationFrom.changedSourceEventIds,
        regeneratedArrangementEventIds: arrangementScore.events
          .filter((event) =>
            event.sourceEventIds.some((id) =>
              input.regenerationFrom!.changedSourceEventIds.includes(id)
            )
          )
          .map((event) => event.id),
        retainedArrangementEventIds: arrangementScore.events
          .filter(
            (event) =>
              !event.sourceEventIds.some((id) =>
                input.regenerationFrom!.changedSourceEventIds.includes(id)
              )
          )
          .map((event) => event.id),
      };
    }
    this.store.saveArrangementScore(workspaceId, arrangementScore);
    arrangementSearch = this.store.saveArrangementSearch(workspaceId, {
      ...arrangementSearch,
      status: "completed",
      candidateIds: candidates.map((candidate) => candidate.id),
      selectedCandidateId: selectedCandidate.id,
      selectedArrangementScoreId: arrangementScore.id,
      completedAt: timestamp,
    });
    return {
      analysisRecordId: analysis.id,
      analysis,
      arrangementSearch,
      candidates,
      arrangementScore,
    };
  }

  branchFromCandidate(
    workspaceId: string,
    candidateId: string
  ): {
    branchId: string;
    arrangementScore: ArrangementScore;
  } {
    const candidate = this.store.getArrangementCandidate(workspaceId, candidateId);
    const search = this.store.getArrangementSearch(workspaceId, candidate.arrangementSearchId!);
    if (search.status !== "completed" || !search.selectedArrangementScoreId) {
      throw new ApiRouteError("Arrangement Candidate cannot branch from an incomplete search", 409);
    }
    if (candidate.status === "rejected") {
      throw new ApiRouteError("A rejected Arrangement Candidate cannot start a branch", 409);
    }
    const selected = this.store.getArrangementScore(workspaceId, search.selectedArrangementScoreId);
    const score = this.store.getNormalizedScore(workspaceId, search.normalizedScoreId);
    const analysis = this.store.getAnalysisRecord(workspaceId, search.analysisRecordId);
    const branchId = `branch.${this.createId()}`;
    const arrangementId = `arrangement.${this.createId()}`;
    const timestamp = this.now().toISOString();
    this.store.saveArrangementBranch(workspaceId, {
      id: branchId,
      label: `Branch from ${candidate.strategy}`,
      rootInputVersions: [
        {
          recordType: "normalized_score",
          recordId: search.normalizedScoreId,
          version: score.version,
        },
        {
          recordType: "analysis_record",
          recordId: search.analysisRecordId,
          version: analysis.version,
        },
      ],
      createdFromCandidateId: candidate.id,
      createdAt: timestamp,
    });
    const arrangementScore: ArrangementScore = {
      ...selected,
      id: arrangementId,
      version: 1,
      branchId,
      selectedCandidateId: candidate.id,
      events: candidate.events,
      preservationAudit: candidate.audit,
      transformationReport: candidateTransformationReport(
        score,
        analysis,
        candidate,
        selected.transpositionPlan.semitones
      ),
      createdAt: timestamp,
    };
    this.store.saveArrangementScore(workspaceId, arrangementScore);
    return { branchId, arrangementScore };
  }
}

type RankingWeights = ArrangementSearch["rankingWeights"];

function persistableCandidates(
  generated: ArrangementCandidate[],
  searchId: string,
  createdAt: string,
  weights: RankingWeights
): ArrangementCandidate[] {
  const evaluated = generated.map((candidate) => {
    const positionCount = candidate.events.reduce((sum, event) => sum + event.positions.length, 0);
    const openRatio = positionCount === 0 ? 0 : candidate.metrics.openStringCount / positionCount;
    const scores = {
      historicalProfile:
        candidate.strategy === "complete-realization" ||
        candidate.strategy === "separate-bass-realization"
          ? 1
          : candidate.strategy === "lean-realization" || candidate.strategy === "continuo-reduction"
            ? 0.8
            : 0.9,
      idiom: clamp(
        0.55 +
          openRatio * 0.3 +
          candidate.metrics.sourcePitchClassCoverage * 0.15 +
          (candidate.strategy === "economical-fingering" ? 0.02 : 0)
      ),
      playability: clamp(1 - candidate.metrics.averageFret / 12),
      voiceLeading: candidate.metrics.sourcePitchClassCoverage,
      notationClarity: clamp(1 - candidate.metrics.averageFret / 16),
      softPreferences: clamp(
        0.55 +
          openRatio * 0.25 +
          (candidate.strategy === "economical-fingering" ? 0.2 : 0) +
          (candidate.strategy === "voice-continuity" ? 0.1 : 0)
      ),
    };
    const weightedTotal = scoreTotal(scores, weights);
    const hardFailure = candidate.audit.status === "fail";
    return {
      ...candidate,
      id: stableCandidateId(searchId, candidate.strategy),
      arrangementSearchId: searchId,
      derivationChoices: [
        {
          dimension: "arrangement_strategy",
          value: candidate.strategy,
          rationale: `The search explored ${candidate.strategy} as a musically consequential alternative.`,
        },
      ],
      evaluation: {
        hardConstraintResults: [
          {
            category: "preservation" as const,
            status: hardFailure ? ("fail" as const) : ("pass" as const),
            evidenceIds: candidate.audit.targetIds,
            rationale: hardFailure
              ? "One or more Preservation Targets failed."
              : "All applicable Preservation Targets passed.",
          },
          {
            category: "instrument" as const,
            status: "pass" as const,
            evidenceIds: candidate.events.map((event) => event.id),
            rationale:
              "Every emitted event has positions generated and validated against the target instrument model.",
          },
        ],
        scores,
        weightedTotal,
        rationale: `Weighted ranking combines historical profile, idiom, playability, voice leading, notation clarity, and soft preferences for ${candidate.strategy}.`,
      },
      rejectionReason: hardFailure
        ? (candidate.audit.findings.find((finding) => finding.severity === "hard")?.message ??
          "A hard search constraint failed.")
        : undefined,
      createdAt,
    } satisfies ArrangementCandidate;
  });
  const survivors = evaluated
    .filter((candidate) => candidate.status !== "rejected")
    .sort((left, right) => right.evaluation!.weightedTotal - left.evaluation!.weightedTotal);
  survivors.forEach((candidate, index) => (candidate.rank = index + 1));
  return evaluated;
}

function scoreTotal(
  scores: NonNullable<ArrangementCandidate["evaluation"]>["scores"],
  weights: RankingWeights
): number {
  return clamp(
    scores.historicalProfile * weights.historicalProfile +
      scores.idiom * weights.idiom +
      scores.playability * weights.playability +
      scores.voiceLeading * weights.voiceLeading +
      scores.notationClarity * weights.notationClarity +
      scores.softPreferences * weights.softPreferences
  );
}

function stableCandidateId(searchId: string, strategy: string): string {
  return `candidate.${createHash("sha256").update(`${searchId}:${strategy}`).digest("hex").slice(0, 24)}`;
}

function stableFamilyId(scoreId: string, analysisId: string, brief: object): string {
  return `family.${createHash("sha256")
    .update(JSON.stringify({ scoreId, analysisId, brief }))
    .digest("hex")
    .slice(0, 24)}`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function candidateTransformationReport(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  candidate: ArrangementCandidate,
  semitones: number
): ArrangementScore["transformationReport"] {
  return buildCompleteTransformationReport(score, analysis, candidate.events, semitones);
}
