import { createHash, randomUUID } from "node:crypto";
import {
  arrangeFaithfulPluckedString,
  auditFaithfulPrincipalVoice,
  PhraseSearchExhaustedError,
} from "../../lib/baroque-guitar-arranger.js";
import { InstrumentModel } from "../../lib/instrument-model.js";
import { analyzeMusicologicalScore } from "../../lib/musicological-analysis.js";
import { arrangeContinuo, auditContinuo } from "../../lib/continuo-arranger.js";
import { arrangeCreativeParaphrase } from "../../lib/creative-arranger.js";
import { arrangeImitativeIntabulation, auditImitative } from "../../lib/imitative-arranger.js";
import { applyPreservationPolicy } from "../../lib/preservation-policy.js";
import { buildAudioPreview } from "../../lib/audio-preview.js";
import { buildCompleteTransformationReport } from "../../lib/transformation-report.js";
import {
  buildNarrowPlanningRecords,
  type NarrowPlanningRecords,
} from "../../lib/narrow-intelligence.js";
import { specializeArrangementPlan } from "../../lib/specialist-planning.js";
import type {
  ArrangementCandidate,
  ArrangementEvent,
  ArrangementPlan,
  ArrangementScore,
  ArrangementSearch,
  AnalysisRecord,
  NormalizedScore,
  PerformanceBriefInput,
  PolicyException,
  PassageDependencyContext,
  PassageSearchRecord,
  PreservationAudit,
  TargetConfiguration,
} from "../../lib/music-domain.js";
import type {
  ConstraintSpecification,
  SearchAttemptConfiguration,
  SearchExecutionIdentity,
} from "../../lib/constraint-search.js";
import {
  createBaroqueGuitarInstance,
  createBaroqueLuteInstance,
  createClassicalGuitarInstance,
  assertInstrumentInstanceIdentity,
  type BaroqueGuitarStringing,
  type BaroqueLuteBassTuning,
  type InstrumentInstanceConfiguration,
} from "../../lib/instrument-instance.js";
import {
  DEFAULT_CANDIDATE_METRICS,
  DEFAULT_LEXICOGRAPHIC_PRIORITIES,
  selectLexicographically,
  type CandidateMeasurement,
} from "../../lib/candidate-comparison.js";
import type { PreservationPolicy } from "../../lib/preservation-policy.js";
import { ApiRouteError } from "./create-route.js";
import { loadProfile } from "../profiles.js";
import { WorkspaceStore } from "./workspace-store.js";
import { OwnerStore } from "./owner-store.js";
import { SourceTruthService } from "./source-truth-service.js";
import {
  assertRhythmicSourceSupported,
  UnsupportedRhythmicNotationError,
} from "../../lib/rhythmic-semantics.js";

type ArrangementServiceOptions = {
  store: WorkspaceStore;
  now?: () => Date;
  createId?: () => string;
  loadInstrument?: (
    instrumentId: string,
    instance?: InstrumentInstanceConfiguration
  ) => InstrumentModel;
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
  performanceBrief?: PerformanceBriefInput;
  arrangementPlanId?: string;
  regenerationFrom?: { arrangementScoreId: string; changedSourceEventIds: string[] };
};

export type CreateFaithfulArrangementResult = {
  analysisRecordId: string;
  analysis: AnalysisRecord;
  arrangementSearch: ArrangementSearch;
  candidates: ArrangementCandidate[];
  arrangementScore: ArrangementScore;
  sourceTruthAssessment: NarrowPlanningRecords["sourceTruthAssessment"];
  performanceBrief: NarrowPlanningRecords["performanceBrief"];
  arrangementPlan: NarrowPlanningRecords["arrangementPlan"];
};

export type PassageCandidate = {
  id: string;
  passageSearchId: string;
  sourceCandidateId: string;
  strategy: string;
  status: "survived" | "selected" | "rejected";
  rank?: number;
  replacementEvents: ArrangementEvent[];
  changedArrangementEventIds: string[];
  evaluation?: ArrangementCandidate["evaluation"];
  audit: PreservationAudit;
  rejectionReason?: string;
  lineage: {
    arrangementScoreId: string;
    arrangementScoreVersion: number;
    arrangementPlanId: string;
    arrangementSearchId: string;
    sourceCandidateId: string;
    requestedEventIds: string[];
    expandedEventIds: string[];
    planDecisionIds: string[];
    evidenceIds: string[];
  };
};

export type PassageSearch = PassageSearchRecord;

export class ArrangementService {
  private readonly store: WorkspaceStore;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly loadInstrument: (
    instrumentId: string,
    instance?: InstrumentInstanceConfiguration
  ) => InstrumentModel;
  private readonly ownerStore?: OwnerStore;

  constructor(options: ArrangementServiceOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.ownerStore = options.ownerStore;
    this.loadInstrument =
      options.loadInstrument ??
      ((instrumentId, instance) =>
        InstrumentModel.fromProfile(loadProfile(instrumentId), instance));
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
    if (targetConfiguration.instrumentId === "baroque-guitar-5") {
      const stringing = targetConfiguration.stringing ?? "french";
      if (!isBaroqueGuitarStringing(stringing)) {
        throw new ApiRouteError(`Unsupported baroque-guitar stringing: ${stringing}`, 400);
      }
      const exactInstance = createBaroqueGuitarInstance(stringing);
      if (
        targetConfiguration.instrumentInstance &&
        targetConfiguration.instrumentInstance.contentDigest !== exactInstance.contentDigest
      ) {
        throw new ApiRouteError(
          "Target stringing and exact Instrument Instance configuration do not match",
          409
        );
      }
      if (targetConfiguration.instrumentInstance) {
        try {
          assertInstrumentInstanceIdentity(targetConfiguration.instrumentInstance);
        } catch (error) {
          throw new ApiRouteError((error as Error).message, 409);
        }
      }
      if (!targetConfiguration.instrumentInstance) {
        targetConfiguration = {
          ...targetConfiguration,
          stringing,
          instrumentInstance: exactInstance,
        };
        workspace = this.store.updateBrief(workspaceId, {
          ...workspace.brief,
          targetConfigurations: workspace.brief.targetConfigurations.map((target) =>
            target.id === targetConfiguration!.id ? targetConfiguration! : target
          ),
        });
      }
    }
    if (targetConfiguration.instrumentId === "baroque-lute-13") {
      const bassTuning = targetConfiguration.tuningId ?? "d_minor";
      if (!isBaroqueLuteBassTuning(bassTuning)) {
        throw new ApiRouteError(`Unsupported baroque-lute bass tuning: ${bassTuning}`, 400);
      }
      const exactInstance = createBaroqueLuteInstance(bassTuning);
      if (
        targetConfiguration.instrumentInstance &&
        targetConfiguration.instrumentInstance.contentDigest !== exactInstance.contentDigest
      ) {
        throw new ApiRouteError(
          "Target bass tuning and exact Instrument Instance configuration do not match",
          409
        );
      }
      if (targetConfiguration.instrumentInstance) {
        try {
          assertInstrumentInstanceIdentity(targetConfiguration.instrumentInstance);
        } catch (error) {
          throw new ApiRouteError((error as Error).message, 409);
        }
      } else {
        targetConfiguration = {
          ...targetConfiguration,
          tuningId: bassTuning,
          instrumentInstance: exactInstance,
        };
        workspace = this.store.updateBrief(workspaceId, {
          ...workspace.brief,
          targetConfigurations: workspace.brief.targetConfigurations.map((target) =>
            target.id === targetConfiguration!.id ? targetConfiguration! : target
          ),
        });
      }
    }
    if (targetConfiguration.instrumentId === "classical-guitar-6") {
      const tuning = targetConfiguration.tuningId ?? "standard";
      if (tuning !== "standard") {
        throw new ApiRouteError(`Unsupported classical-guitar tuning: ${tuning}`, 400);
      }
      const exactInstance = createClassicalGuitarInstance();
      if (
        targetConfiguration.instrumentInstance &&
        targetConfiguration.instrumentInstance.contentDigest !== exactInstance.contentDigest
      ) {
        throw new ApiRouteError(
          "Target tuning and exact Instrument Instance configuration do not match",
          409
        );
      }
      if (targetConfiguration.instrumentInstance) {
        try {
          assertInstrumentInstanceIdentity(targetConfiguration.instrumentInstance);
        } catch (error) {
          throw new ApiRouteError((error as Error).message, 409);
        }
      } else {
        targetConfiguration = {
          ...targetConfiguration,
          tuningId: tuning,
          instrumentInstance: exactInstance,
        };
        workspace = this.store.updateBrief(workspaceId, {
          ...workspace.brief,
          targetConfigurations: workspace.brief.targetConfigurations.map((target) =>
            target.id === targetConfiguration!.id ? targetConfiguration! : target
          ),
        });
      }
    }
    const score = this.store.getNormalizedScore(workspaceId, input.normalizedScoreId);
    try {
      assertRhythmicSourceSupported(score);
    } catch (error) {
      if (error instanceof UnsupportedRhythmicNotationError) {
        throw new ApiRouteError(error.message, 422, "unprocessable_content");
      }
      throw error;
    }
    const transcription = this.store.getScoreTranscription(workspaceId, score.scoreTranscriptionId);
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
        409,
        "analysis_review_required",
        {
          workspaceId,
          analysisRecordId: analysis.id,
          ambiguityIds: criticalAnalysisAmbiguities.map((ambiguity) => ambiguity.id),
        }
      );
    }
    const preservationPolicy = input.preservationPolicy ?? "faithful_reduction";
    const currentPlanningWorkspace = this.store.get(workspaceId);
    const existingPlan = input.arrangementPlanId
      ? this.store.getArrangementPlan(workspaceId, input.arrangementPlanId)
      : currentPlanningWorkspace.arrangementPlanIds
          .map((id) => this.store.getArrangementPlan(workspaceId, id))
          .find(
            (plan) =>
              plan.normalizedScoreId === score.id &&
              plan.normalizedScoreVersion === score.version &&
              plan.analysisRecordId === analysis.id &&
              plan.analysisRecordVersion === analysis.version &&
              plan.targetConfigurationId === targetConfiguration.id &&
              plan.preservationPolicy === preservationPolicy &&
              performanceBriefMatches(
                this.store.getPerformanceBrief(workspaceId, plan.performanceBriefId),
                input.performanceBrief,
                targetConfiguration
              )
          );
    if (
      input.arrangementPlanId &&
      existingPlan &&
      (existingPlan.normalizedScoreId !== score.id ||
        existingPlan.normalizedScoreVersion !== score.version ||
        existingPlan.analysisRecordId !== analysis.id ||
        existingPlan.analysisRecordVersion !== analysis.version ||
        existingPlan.targetConfigurationId !== targetConfiguration.id ||
        existingPlan.preservationPolicy !== preservationPolicy ||
        !performanceBriefMatches(
          this.store.getPerformanceBrief(workspaceId, existingPlan.performanceBriefId),
          input.performanceBrief,
          targetConfiguration
        ))
    ) {
      throw new ApiRouteError(
        "Requested Arrangement Plan is incompatible with this realization",
        409
      );
    }
    if (input.arrangementPlanId && existingPlan?.status !== "ready") {
      throw new ApiRouteError("Requested Arrangement Plan is not confirmed and ready", 409);
    }
    let planning: NarrowPlanningRecords;
    if (existingPlan) {
      planning = {
        arrangementPlan: existingPlan,
        sourceTruthAssessment: this.store.getSourceTruthAssessment(
          workspaceId,
          existingPlan.sourceTruthAssessmentId
        ),
        performanceBrief: this.store.getPerformanceBrief(
          workspaceId,
          existingPlan.performanceBriefId
        ),
      };
    } else {
      let narrowIdIndex = 0;
      const performanceRequestDigest = createHash("sha256")
        .update(JSON.stringify(input.performanceBrief ?? { status: "guided_default" }))
        .digest("hex");
      const source = this.store.getSourceArtifact(workspaceId, transcription.sourceArtifactId);
      planning = buildNarrowPlanningRecords({
        createId: () =>
          createHash("sha256")
            .update(
              `${workspaceId}:${score.id}:${analysis.id}:${targetConfiguration.id}:${preservationPolicy}:${performanceRequestDigest}:${narrowIdIndex++}`
            )
            .digest("hex")
            .slice(0, 24),
        createdAt: score.createdAt,
        workspaceRevision: currentPlanningWorkspace.revision,
        arrangementBriefDigest: createHash("sha256")
          .update(JSON.stringify(currentPlanningWorkspace.brief))
          .digest("hex"),
        arrangementBrief: currentPlanningWorkspace.brief,
        source,
        transcription,
        normalizedScoreId: score.id,
        normalizedScoreVersion: score.version,
        analysis,
        target: targetConfiguration,
        preservationPolicy,
        performanceBrief: input.performanceBrief,
      });
      const performanceBrief = this.store
        .get(workspaceId)
        .performanceBriefIds.includes(planning.performanceBrief.id)
        ? this.store.getPerformanceBrief(workspaceId, planning.performanceBrief.id)
        : this.store.savePerformanceBrief(workspaceId, planning.performanceBrief);
      planning = { ...planning, performanceBrief };
      const sourceTruthAssessment = new SourceTruthService({
        store: this.store,
        now: () => new Date(score.createdAt),
        createId: () =>
          createHash("sha256")
            .update(
              `${workspaceId}:${score.id}:${analysis.id}:${targetConfiguration.id}:${preservationPolicy}:${planning.performanceBrief.id}:source-truth:${narrowIdIndex++}`
            )
            .digest("hex")
            .slice(0, 24),
      }).assess(workspaceId, {
        sourceArtifactId: source.id,
        scoreTranscriptionId: transcription.id,
        normalizedScoreId: score.id,
        analysisRecordId: analysis.id,
        scope: { kind: "whole_score", partIds: [], measureIds: [], eventIds: [] },
        preservationPolicy,
        performanceBriefId: planning.performanceBrief.id,
        targetConfigurationIds: [targetConfiguration.id],
      });
      planning = {
        ...planning,
        sourceTruthAssessment,
        arrangementPlan: {
          ...planning.arrangementPlan,
          sourceTruthAssessmentId: sourceTruthAssessment.id,
        },
      };
      planning = {
        ...planning,
        arrangementPlan: specializeArrangementPlan({
          base: planning.arrangementPlan,
          analysis,
          target: targetConfiguration,
          preservationPolicy,
        }),
      };
      if (
        !["authoritative_for_purpose", "authoritative_with_disclosed_uncertainty"].includes(
          planning.sourceTruthAssessment.outcome
        ) ||
        !planning.sourceTruthAssessment.stability.stable
      ) {
        if (planning.sourceTruthAssessment.outcome === "review_required") {
          throw new ApiRouteError(
            `Score-Anchored Review is required before arrangement. Unresolved critical uncertainties: ${planning.sourceTruthAssessment.blockingUncertaintyIds.join(", ")}`,
            409,
            "score_review_required",
            {
              workspaceId,
              scoreTranscriptionId: transcription.id,
              uncertaintyIds: planning.sourceTruthAssessment.blockingUncertaintyIds,
              sourceTruthAssessmentId: planning.sourceTruthAssessment.id,
            }
          );
        }
        throw new ApiRouteError("Source Truth does not authorize arrangement planning", 409);
      }
      this.store.saveArrangementPlan(workspaceId, planning.arrangementPlan);
    }
    const familyId = input.arrangementFamilyId ?? stableFamilyId(score.id, analysis.id);
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
    const searchProtocol = buildSearchProtocol({
      analysis,
      plan: planning.arrangementPlan,
      targetConfiguration,
      performanceBriefId: planning.performanceBrief.id,
      preservationPolicy,
    });
    let arrangementSearch = this.store.saveArrangementSearch(workspaceId, {
      id: searchId,
      normalizedScoreId: score.id,
      analysisRecordId: analysis.id,
      performanceBriefId: planning.performanceBrief.id,
      arrangementFamilyId: familyId,
      branchId: input.branchId,
      targetConfiguration,
      preservationPolicy,
      status: "running",
      candidateIds: [],
      ...searchProtocol,
      rankingWeights,
      comparisonPolicy: {
        method: "policy_lexicographic",
        metricDefinitions: DEFAULT_CANDIDATE_METRICS,
        priorityMetricIds: [...DEFAULT_LEXICOGRAPHIC_PRIORITIES],
        automaticTieBreak: "none",
      },
      createdAt: timestamp,
    });
    let generated;
    try {
      if (planning.arrangementPlan.kind === "creative_arrangement") {
        const instrument = this.loadInstrument(
          targetConfiguration.instrumentId,
          targetConfiguration.instrumentInstance
        );
        generated = arrangeCreativeParaphrase(score, analysis, instrument, {
          arrangementId,
          createdAt: timestamp,
          targetConfiguration,
          preservationPolicy,
          allowedStrategies:
            planning.arrangementPlan.specialistIntent.kind === "creative_arrangement"
              ? planning.arrangementPlan.specialistIntent.candidateStrategies
              : [],
        });
      } else if (targetConfiguration.realizationProfileId) {
        const targetInstrument =
          targetConfiguration.instrumentId === "piano"
            ? undefined
            : this.loadInstrument(
                targetConfiguration.instrumentId,
                targetConfiguration.instrumentInstance
              );
        generated = arrangeContinuo(score, analysis, {
          arrangementId,
          createdAt: timestamp,
          targetConfiguration,
          targetInstrument,
          preservationPolicy: input.preservationPolicy,
          allowedStrategies:
            planning.arrangementPlan.specialistIntent.kind === "continuo_realization"
              ? planning.arrangementPlan.specialistIntent.candidateStrategies
              : undefined,
        });
      } else if (analysis.texture === "imitative-polyphony") {
        const instrument = this.loadInstrument(
          targetConfiguration.instrumentId,
          targetConfiguration.instrumentInstance
        );
        generated = arrangeImitativeIntabulation(score, analysis, instrument, {
          arrangementId,
          createdAt: timestamp,
          targetConfiguration,
          preservationPolicy: input.preservationPolicy,
          allowedStrategies:
            planning.arrangementPlan.specialistIntent.kind === "imitative_intabulation"
              ? planning.arrangementPlan.specialistIntent.candidateStrategies
              : undefined,
        });
      } else {
        const instrument = this.loadInstrument(
          targetConfiguration.instrumentId,
          targetConfiguration.instrumentInstance
        );
        if (
          targetConfiguration.tuningId &&
          targetConfiguration.instrumentId === "baroque-lute-13" &&
          !targetConfiguration.instrumentInstance
        ) {
          instrument.setDiapasonScheme(targetConfiguration.tuningId);
        }
        generated = arrangeFaithfulPluckedString(score, analysis, instrument, {
          arrangementId,
          createdAt: timestamp,
          targetConfiguration,
          preservationPolicy: input.preservationPolicy,
          arrangementPlan: planning.arrangementPlan,
          performanceBrief: planning.performanceBrief,
          phraseSearch: {
            frontierWidth: searchProtocol.attemptConfiguration.width,
            maximumExpandedStates: searchProtocol.attemptConfiguration.maximumExpandedStates,
          },
        });
      }
    } catch (error) {
      const exhaustedSearch = this.store.saveArrangementSearch(workspaceId, {
        ...arrangementSearch,
        status: "failed",
        outcome: {
          kind: "search_exhausted",
          executionIdentity: arrangementSearch.executionIdentity,
          diagnosticEvidenceIds: [planning.arrangementPlan.id],
          reason:
            error instanceof Error
              ? `The current adapter could not realize the Plan: ${error.message}`
              : "The current adapter could not realize the Plan within its modeled search",
        },
        completedAt: timestamp,
      });
      if (error instanceof ApiRouteError) throw error;
      if (error instanceof PhraseSearchExhaustedError) {
        throw new ApiRouteError(error.message, 409, "search_exhausted", {
          arrangementSearch: exhaustedSearch,
          expandedStates: error.expandedStates,
          maximumExpandedStates: error.maximumExpandedStates,
        });
      }
      const specialistDecisions = planning.arrangementPlan.decisions.filter((decision) =>
        ["creative_design", "continuo_realization", "imitative_voice_distribution"].includes(
          decision.dimension
        )
      );
      const conflictingDecisions = specialistDecisions.length
        ? specialistDecisions
        : planning.arrangementPlan.decisions;
      const conflict = this.store.savePlanConflict(workspaceId, {
        id: `plan-conflict.${this.createId()}`,
        arrangementPlanId: planning.arrangementPlan.id,
        targetConfigurationId: targetConfiguration.id,
        scope: conflictingDecisions[0]!.scope,
        conflictingDecisionIds: conflictingDecisions.map((decision) => decision.id),
        reasonCode: "target_realization_infeasible",
        consequence: error instanceof Error ? error.message : "Target realization is infeasible",
        evidenceIds: [
          planning.arrangementPlan.id,
          ...new Set(conflictingDecisions.flatMap((decision) => decision.evidenceIds)),
        ],
        resolutionOptions: [
          "revise_target_local_extension",
          "revise_shared_plan",
          "change_policy",
          "request_policy_exception",
          "block",
        ],
        status: "unresolved",
        createdAt: timestamp,
      });
      throw new ApiRouteError(conflict.consequence, 409, "plan_conflict", {
        planConflict: conflict,
      });
    }
    const candidates = persistableCandidates(
      generated.candidates,
      searchId,
      timestamp,
      rankingWeights,
      generated.candidates.find(
        (candidate) => candidate.id === generated.selected.selectedCandidateId
      )?.strategy
    ).map((candidate) => this.store.saveArrangementCandidate(workspaceId, candidate));
    const selectedCandidate = candidates.find((candidate) => candidate.status === "selected")!;
    const selectedGeneratedCandidate = generated.candidates.find(
      (candidate) => candidate.strategy === selectedCandidate.strategy
    )!;
    const arrangementScore: ArrangementScore = {
      ...generated.selected,
      version: input.version ?? 1,
      arrangementSearchId: searchId,
      arrangementFamilyId: familyId,
      branchId: input.branchId,
      parentArrangementScoreId: input.parentArrangementScoreId,
      arrangementPlanId: planning.arrangementPlan.id,
      realizedPlanDecisionIds: planning.arrangementPlan.decisions.map((decision) => decision.id),
      editorialCommitmentIds: input.editorialCommitmentIds ?? [],
      familyCommitmentIds: input.familyCommitmentIds ?? [],
      policyExceptionIds: input.policyExceptionIds ?? [],
      selectedCandidateId: selectedCandidate.id,
      events: selectedGeneratedCandidate.events,
      transformationReport: candidateTransformationReport(
        score,
        analysis,
        selectedGeneratedCandidate,
        generated.selected.transpositionPlan.semitones
      ),
      preservationAudit: selectedGeneratedCandidate.audit,
    };
    if (arrangementScore.policyExceptionIds?.length) {
      const exceptions = arrangementScore.policyExceptionIds.map((id) =>
        this.store.getPolicyException(workspaceId, id)
      );
      const exceptionAudit = auditPolicyExceptions(arrangementScore, analysis, exceptions);
      arrangementScore.preservationAudit = exceptionAudit.audit;
      const { drift } = exceptionAudit;
      if (drift && arrangementScore.preservationPolicy === "faithful_reduction") {
        this.store.saveArrangementSearch(workspaceId, {
          ...arrangementSearch,
          status: "failed",
          candidateIds: candidates.map((candidate) => candidate.id),
          outcome: {
            kind: "search_exhausted",
            executionIdentity: arrangementSearch.executionIdentity,
            diagnosticEvidenceIds: [planning.arrangementPlan.id],
            reason:
              "Generated candidates violate the selected Preservation Policy; no impossibility claim is made",
          },
          completedAt: timestamp,
        });
        throw new ApiRouteError(
          "Policy Drift materially compromises the selected Preservation Policy. Revise the arrangement or explicitly select a less restrictive policy.",
          409
        );
      }
    }
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
      outcome: {
        kind: "candidate_found",
        executionIdentity: arrangementSearch.executionIdentity,
        diagnosticEvidenceIds: [arrangementScore.id],
        candidateIds: candidates.map((candidate) => candidate.id),
        selectedCandidateId: selectedCandidate.id,
      },
      completedAt: timestamp,
    });
    return {
      analysisRecordId: analysis.id,
      analysis,
      arrangementSearch,
      candidates,
      arrangementScore,
      sourceTruthAssessment: planning.sourceTruthAssessment,
      performanceBrief: planning.performanceBrief,
      arrangementPlan: planning.arrangementPlan,
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

  passageCandidates(
    workspaceId: string,
    arrangementScoreId: string,
    arrangementEventIds: string[]
  ): {
    arrangementScoreId: string;
    selectedEventIds: string[];
    expandedEventIds: string[];
    passageSearch: PassageSearch;
    candidates: PassageCandidate[];
  } {
    const arrangement = this.store.getArrangementScore(workspaceId, arrangementScoreId);
    const requested = selectedPassage(arrangement, arrangementEventIds);
    const search = this.store.getArrangementSearch(workspaceId, arrangement.arrangementSearchId!);
    const source = this.store.getNormalizedScore(workspaceId, search.normalizedScoreId);
    const analysis = this.store.getAnalysisRecord(workspaceId, arrangement.analysisRecordId);
    const plan = this.store.getArrangementPlan(workspaceId, arrangement.arrangementPlanId!);
    const dependencyContext = passageDependencyContext(
      this.store,
      workspaceId,
      arrangement,
      source,
      analysis,
      requested
    );
    const expanded = dependencyContext.expandedEventIds.map(
      (id) => arrangement.events.find((event) => event.id === id)!
    );
    const identityWithoutDigest = {
      arrangementScoreId: arrangement.id,
      arrangementScoreVersion: arrangement.version ?? 1,
      arrangementPlanId: plan.id,
      arrangementSearchId: search.id,
      analysisRecordId: analysis.id,
      targetConfigurationId: arrangement.targetConfiguration.id,
      dependencyContext,
      sourceCandidateIds: [...search.candidateIds].sort(),
    };
    const digest = digestJson(identityWithoutDigest);
    const passageSearchId = `passage-search.${digest.slice(0, 24)}`;
    const passageSearch: PassageSearch = this.store
      .get(workspaceId)
      .passageSearchIds.includes(passageSearchId)
      ? this.store.getPassageSearch(workspaceId, passageSearchId)
      : this.store.savePassageSearch(workspaceId, {
          id: passageSearchId,
          digest,
          ...identityWithoutDigest,
          createdAt: this.now().toISOString(),
        });
    const candidates = search.candidateIds
      .map((id) => this.store.getArrangementCandidate(workspaceId, id))
      .map((candidate) =>
        this.projectPassageCandidate(
          workspaceId,
          arrangement,
          requested,
          expanded,
          candidate,
          passageSearch,
          plan
        )
      )
      .sort(
        (left, right) =>
          (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER)
      );
    return {
      arrangementScoreId,
      selectedEventIds: requested.map((event) => event.id),
      expandedEventIds: expanded.map((event) => event.id),
      passageSearch,
      candidates,
    };
  }

  previewPassageCandidate(
    workspaceId: string,
    arrangementScoreId: string,
    arrangementEventIds: string[],
    candidateId: string,
    passageSearchId: string
  ) {
    const passage = this.passageCandidates(workspaceId, arrangementScoreId, arrangementEventIds);
    assertPassageSearchIdentity(passage.passageSearch, passageSearchId);
    const projection = passage.candidates.find(
      (candidate) => candidate.sourceCandidateId === candidateId
    );
    if (!projection) throw new ApiRouteError(`Passage candidate not found: ${candidateId}`, 404);
    if (projection.status === "rejected") {
      throw new ApiRouteError(
        `Rejected passage candidates cannot be auditioned: ${projection.rejectionReason}`,
        409
      );
    }
    const arrangement = this.store.getArrangementScore(workspaceId, arrangementScoreId);
    const search = this.store.getArrangementSearch(workspaceId, arrangement.arrangementSearchId!);
    const source = this.store.getNormalizedScore(workspaceId, search.normalizedScoreId);
    return buildAudioPreview(
      { ...arrangement, events: overlayPassage(arrangement.events, projection.replacementEvents) },
      source
    );
  }

  adoptPassageCandidate(
    workspaceId: string,
    arrangementScoreId: string,
    arrangementEventIds: string[],
    candidateId: string,
    passageSearchId: string
  ) {
    const arrangement = this.store.getArrangementScore(workspaceId, arrangementScoreId);
    const passage = this.passageCandidates(workspaceId, arrangementScoreId, arrangementEventIds);
    assertPassageSearchIdentity(passage.passageSearch, passageSearchId);
    const projection = passage.candidates.find(
      (candidate) => candidate.sourceCandidateId === candidateId
    );
    if (!projection) throw new ApiRouteError(`Passage candidate not found: ${candidateId}`, 404);
    const candidate = this.store.getArrangementCandidate(workspaceId, candidateId);
    if (projection.status === "rejected") {
      throw new ApiRouteError(
        `Rejected passage candidates cannot be adopted: ${projection.rejectionReason}`,
        409
      );
    }
    if (projection.changedArrangementEventIds.length === 0) {
      throw new ApiRouteError("The passage candidate makes no change to the selected passage", 409);
    }
    const search = this.store.getArrangementSearch(workspaceId, arrangement.arrangementSearchId!);
    const source = this.store.getNormalizedScore(workspaceId, search.normalizedScoreId);
    const analysis = this.store.getAnalysisRecord(workspaceId, arrangement.analysisRecordId);
    const timestamp = this.now().toISOString();
    const branchId = `branch.${this.createId()}`;
    const events = overlayPassage(arrangement.events, projection.replacementEvents);
    this.store.saveArrangementBranch(workspaceId, {
      id: branchId,
      label: `Passage alternative · ${candidate.strategy}`,
      rootInputVersions: [
        {
          recordType: "arrangement_score",
          recordId: arrangement.id,
          version: arrangement.version ?? 1,
        },
        { recordType: "arrangement_candidate", recordId: candidate.id, version: 1 },
        { recordType: "passage_search", recordId: passage.passageSearch.id, version: 1 },
      ],
      createdFromCandidateId: candidate.id,
      createdAt: timestamp,
    });
    const adopted = this.store.saveArrangementScore(workspaceId, {
      ...arrangement,
      id: `arrangement.${this.createId()}`,
      version: (arrangement.version ?? 1) + 1,
      parentArrangementScoreId: arrangement.id,
      branchId,
      selectedCandidateId: candidate.id,
      events,
      transformationReport: buildCompleteTransformationReport(
        source,
        analysis,
        events,
        arrangement.transpositionPlan.semitones
      ),
      preservationAudit: projection.audit,
      createdAt: timestamp,
    });
    return {
      arrangementScore: adopted,
      branchId,
      sourceCandidateId: candidate.id,
      changedArrangementEventIds: projection.changedArrangementEventIds,
      passageSearch: passage.passageSearch,
    };
  }

  private projectPassageCandidate(
    workspaceId: string,
    arrangement: ArrangementScore,
    requested: ArrangementEvent[],
    expanded: ArrangementEvent[],
    candidate: ArrangementCandidate,
    passageSearch: PassageSearch,
    plan: ArrangementPlan
  ): PassageCandidate {
    const selectedSources = new Set(expanded.flatMap((event) => event.sourceEventIds));
    const replacements = expanded.map((current) => {
      const principalSource = current.principalVoiceSourceEventId;
      const alternate = candidate.events.find(
        (event) =>
          (principalSource && event.principalVoiceSourceEventId === principalSource) ||
          (event.sourceEventIds.some((id) => selectedSources.has(id)) &&
            event.measureId === current.measureId &&
            event.onset.numerator * current.onset.denominator ===
              current.onset.numerator * event.onset.denominator)
      );
      return alternate
        ? { ...alternate, id: current.id, sourceEventIds: current.sourceEventIds }
        : current;
    });
    const events = overlayPassage(arrangement.events, replacements);
    const audit = this.auditProjection(workspaceId, arrangement, events);
    const hardReason =
      candidate.status === "rejected"
        ? (candidate.rejectionReason ?? "The source candidate failed a hard constraint.")
        : audit.status === "fail"
          ? (audit.findings.find((finding) => finding.severity === "hard")?.message ??
            "The mixed passage projection failed its Preservation Audit.")
          : undefined;
    return {
      id: `passage-candidate.${createHash("sha256")
        .update(`${passageSearch.digest}:${candidate.id}`)
        .digest("hex")
        .slice(0, 24)}`,
      sourceCandidateId: candidate.id,
      strategy: candidate.strategy,
      status: hardReason
        ? "rejected"
        : candidate.id === arrangement.selectedCandidateId
          ? "selected"
          : "survived",
      rank: candidate.rank,
      replacementEvents: replacements,
      changedArrangementEventIds: replacements
        .filter((event, index) => JSON.stringify(event) !== JSON.stringify(expanded[index]))
        .map((event) => event.id),
      evaluation: candidate.evaluation,
      audit,
      rejectionReason: hardReason,
      passageSearchId: passageSearch.id,
      lineage: {
        arrangementScoreId: arrangement.id,
        arrangementScoreVersion: arrangement.version ?? 1,
        arrangementPlanId: plan.id,
        arrangementSearchId: arrangement.arrangementSearchId!,
        sourceCandidateId: candidate.id,
        requestedEventIds: requested.map((event) => event.id),
        expandedEventIds: expanded.map((event) => event.id),
        planDecisionIds: plan.decisions.map((decision) => decision.id),
        evidenceIds: [
          passageSearch.analysisRecordId,
          ...plan.decisions.flatMap((decision) => decision.evidenceIds),
          ...passageSearch.dependencyContext.activeCommitmentIds,
        ],
      },
    };
  }

  private auditProjection(
    workspaceId: string,
    arrangement: ArrangementScore,
    events: ArrangementEvent[]
  ): PreservationAudit {
    const search = this.store.getArrangementSearch(workspaceId, arrangement.arrangementSearchId!);
    const source = this.store.getNormalizedScore(workspaceId, search.normalizedScoreId);
    const analysis = this.store.getAnalysisRecord(workspaceId, arrangement.analysisRecordId);
    const model = this.loadInstrument(
      arrangement.targetConfiguration.instrumentId,
      arrangement.targetConfiguration.instrumentInstance
    );
    if (
      arrangement.targetConfiguration.tuningId &&
      arrangement.targetConfiguration.instrumentId === "baroque-lute-13" &&
      !arrangement.targetConfiguration.instrumentInstance
    ) {
      model.setDiapasonScheme(arrangement.targetConfiguration.tuningId);
    }
    const faithful =
      analysis.texture === "continuo"
        ? auditContinuo(source, analysis, events)
        : analysis.texture === "imitative-polyphony"
          ? auditImitative(source, analysis, events, model)
          : auditFaithfulPrincipalVoice(
              source,
              analysis,
              events,
              arrangement.transpositionPlan.semitones
            );
    return applyPreservationPolicy(faithful, arrangement.preservationPolicy);
  }
}

function performanceBriefMatches(
  actual: NarrowPlanningRecords["performanceBrief"],
  requested: PerformanceBriefInput | undefined,
  target: TargetConfiguration
): boolean {
  const expected: PerformanceBriefInput = requested ?? {
    intendedUse: "study",
    performerProfile: {
      proficiency: "intermediate",
      assumptionSource: "guided_start_default_pending_owner_review",
      techniqueFamiliarity: [],
    },
    tempoContext: { status: "not_specified" },
    difficultyIntent: "intermediate",
    preparationExpectation: "practice_expected",
    reliabilityGoal: "repeatable",
    techniqueContext: { status: "unspecified" },
    notationContext: { needs: target.notationLayouts, ensembleRole: target.role },
  };
  return (
    actual.intendedUse === expected.intendedUse &&
    JSON.stringify(actual.performerProfile) === JSON.stringify(expected.performerProfile) &&
    JSON.stringify(actual.tempoContext) === JSON.stringify(expected.tempoContext) &&
    actual.difficultyIntent === expected.difficultyIntent &&
    actual.preparationExpectation === expected.preparationExpectation &&
    actual.reliabilityGoal === expected.reliabilityGoal &&
    JSON.stringify(actual.techniqueContext) === JSON.stringify(expected.techniqueContext) &&
    JSON.stringify(actual.notationContext) === JSON.stringify(expected.notationContext)
  );
}

function selectedPassage(arrangement: ArrangementScore, ids: string[]): ArrangementEvent[] {
  if (ids.length === 0) throw new ApiRouteError("Select at least one arrangement event", 400);
  const selected = ids.map((id) => {
    const event = arrangement.events.find((candidate) => candidate.id === id);
    if (!event) throw new ApiRouteError(`Arrangement event not found: ${id}`, 404);
    return event;
  });
  return selected;
}

function passageDependencyContext(
  store: WorkspaceStore,
  workspaceId: string,
  arrangement: ArrangementScore,
  source: NormalizedScore,
  analysis: AnalysisRecord,
  requested: ArrangementEvent[]
): PassageDependencyContext {
  const requestedIds = new Set(requested.map((event) => event.id));
  const indices = requested.map((event) => arrangement.events.indexOf(event));
  const firstIndex = Math.min(...indices);
  const lastIndex = Math.max(...indices);
  const incoming = firstIndex > 0 ? [arrangement.events[firstIndex - 1]!.id] : [];
  const outgoing =
    lastIndex + 1 < arrangement.events.length ? [arrangement.events[lastIndex + 1]!.id] : [];
  const requestedMeasures = new Set(requested.map((event) => event.measureId));
  const harmony = arrangement.events
    .filter((event) => requestedMeasures.has(event.measureId) && !requestedIds.has(event.id))
    .map((event) => event.id);
  const firstByMeasure = new Map<string, ArrangementEvent>();
  for (const event of requested) {
    const prior = firstByMeasure.get(event.measureId);
    if (!prior || rationalLess(event.onset, prior.onset))
      firstByMeasure.set(event.measureId, event);
  }
  const sustained = arrangement.events
    .filter((event) => {
      const boundary = firstByMeasure.get(event.measureId);
      if (!boundary || requestedIds.has(event.id) || !rationalLess(event.onset, boundary.onset)) {
        return false;
      }
      return rationalGreaterThan(rationalSum(event.onset, event.duration), boundary.onset);
    })
    .map((event) => event.id);
  const requestedSourceIds = new Set(requested.flatMap((event) => event.sourceEventIds));
  const phraseAndCadenceTargets = analysis.preservationTargets.filter(
    (target) =>
      ["phrase_contour", "cadential_goal"].includes(target.relationshipType ?? "") &&
      target.eventIds.some((id) => requestedSourceIds.has(id))
  );
  const phraseSources = new Set(phraseAndCadenceTargets.flatMap((target) => target.eventIds));
  const phraseEvents = arrangement.events
    .filter((event) => event.sourceEventIds.some((id) => phraseSources.has(id)))
    .map((event) => event.id);
  const occurrenceCount = new Map<string, number>();
  for (const occurrence of source.performedForm?.measureOccurrences ?? []) {
    occurrenceCount.set(occurrence.measureId, (occurrenceCount.get(occurrence.measureId) ?? 0) + 1);
  }
  const repeatMeasures = [...requestedMeasures].filter(
    (measureId) => (occurrenceCount.get(measureId) ?? 0) > 1
  );
  const repeatEvents = arrangement.events
    .filter((event) => repeatMeasures.includes(event.measureId))
    .map((event) => event.id);
  const workspace = store.get(workspaceId);
  const editorialCommitments = workspace.editorialCommitmentIds
    .map((id) => store.getEditorialCommitment(workspaceId, id))
    .filter((record) => record.status === "active" && record.arrangementScoreId === arrangement.id);
  const familyCommitments = workspace.familyCommitmentIds
    .map((id) => store.getFamilyCommitment(workspaceId, id))
    .filter(
      (record) =>
        record.status === "active" &&
        record.arrangementFamilyId === arrangement.arrangementFamilyId &&
        record.targetConfigurationIds.includes(arrangement.targetConfiguration.id)
    );
  const commitmentEvents = editorialCommitments.flatMap((record) => record.scope.objectIds);
  const activeCommitmentIds = [...editorialCommitments, ...familyCommitments].map(
    (record) => record.id
  );
  const expandedIds = new Set([
    ...requestedIds,
    ...incoming,
    ...outgoing,
    ...harmony,
    ...sustained,
    ...phraseEvents,
    ...repeatEvents,
    ...commitmentEvents,
  ]);
  const expandedEventIds = arrangement.events
    .filter((event) => expandedIds.has(event.id))
    .map((event) => event.id);
  return {
    requestedEventIds: requested.map((event) => event.id),
    expandedEventIds,
    incomingStateEventIds: incoming,
    outgoingStateEventIds: outgoing,
    sustainedEventIds: sustained,
    harmonyEventIds: harmony,
    phraseAndCadenceTargetIds: phraseAndCadenceTargets.map((target) => target.id),
    repeatMeasureIds: repeatMeasures,
    activeCommitmentIds,
    derivationEvidenceIds: [
      analysis.id,
      ...phraseAndCadenceTargets.map((target) => target.id),
      ...activeCommitmentIds,
    ],
  };
}

function assertPassageSearchIdentity(search: PassageSearch, suppliedId: string): void {
  if (search.id !== suppliedId) {
    throw new ApiRouteError(
      `Passage Search identity is stale or incompatible: expected ${search.id}, received ${suppliedId}`,
      409
    );
  }
}

function rationalSum(
  left: { numerator: number; denominator: number },
  right: { numerator: number; denominator: number }
) {
  return {
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  };
}

function rationalLess(
  left: { numerator: number; denominator: number },
  right: { numerator: number; denominator: number }
): boolean {
  return left.numerator * right.denominator < right.numerator * left.denominator;
}

function rationalGreaterThan(
  left: { numerator: number; denominator: number },
  right: { numerator: number; denominator: number }
): boolean {
  return left.numerator * right.denominator > right.numerator * left.denominator;
}

function overlayPassage(
  current: ArrangementEvent[],
  replacements: ArrangementEvent[]
): ArrangementEvent[] {
  const byId = new Map(replacements.map((event) => [event.id, event]));
  return current.map((event) => byId.get(event.id) ?? event);
}

function assertCandidateBelongsToArrangement(
  arrangement: ArrangementScore,
  candidate: ArrangementCandidate
): void {
  if (candidate.arrangementSearchId !== arrangement.arrangementSearchId) {
    throw new ApiRouteError(
      `Arrangement Candidate is not part of this Arrangement Score search: ${candidate.id}`,
      404
    );
  }
}

export function auditPolicyExceptions(
  arrangement: ArrangementScore,
  analysis: AnalysisRecord,
  exceptions: PolicyException[]
): { audit: PreservationAudit; drift: boolean } {
  const drift =
    exceptions.some((exception) => exception.severity === "critical") ||
    analysis.preservationTargets.some((target) => {
      const affectedObjects = new Set(
        exceptions
          .filter((exception) => exception.affectedPreservationTargetIds.includes(target.id))
          .flatMap((exception) => exception.scope.objectIds)
      );
      for (const event of arrangement.events) {
        if (affectedObjects.has(event.id)) {
          event.sourceEventIds.forEach((id) => affectedObjects.add(id));
        }
      }
      const protectedObjects = target.eventIds.filter((id) => affectedObjects.has(id));
      return target.eventIds.length > 0 && protectedObjects.length / target.eventIds.length >= 0.5;
    });
  return {
    drift,
    audit: {
      ...arrangement.preservationAudit,
      status: drift ? "fail" : "pass_with_exceptions",
      findings: [
        ...arrangement.preservationAudit.findings,
        ...exceptions.flatMap((exception) =>
          exception.affectedPreservationTargetIds.map((targetId) => ({
            targetId,
            severity: drift ? ("hard" as const) : ("soft" as const),
            code: drift ? "policy.drift" : "policy.exception",
            message: `${exception.musicalConsequence} Owner rationale: ${exception.rationale}`,
          }))
        ),
      ],
    },
  };
}

type RankingWeights = ArrangementSearch["rankingWeights"];

function persistableCandidates(
  generated: ArrangementCandidate[],
  searchId: string,
  createdAt: string,
  _weights: RankingWeights,
  plannedStrategy?: string
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
    const hardFailure = candidate.audit.status === "fail";
    const measurements = candidateMeasurements(candidate, plannedStrategy);
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
        measurements,
        selectionBasis: {
          method: "policy_lexicographic",
          status: hardFailure ? "rejected" : "survived",
        } as NonNullable<NonNullable<ArrangementCandidate["evaluation"]>["selectionBasis"]>,
        rationale:
          "Legacy normalized display scores are non-authoritative. Automatic selection uses the persisted hard-gate-first lexicographic comparison policy.",
      },
      rejectionReason: hardFailure
        ? (candidate.audit.findings.find((finding) => finding.severity === "hard")?.message ??
          "A hard search constraint failed.")
        : undefined,
      createdAt,
    } satisfies ArrangementCandidate;
  });
  const selection = selectLexicographically(
    evaluated.map((candidate) => ({
      id: candidate.id,
      hardGatePassed: candidate.status !== "rejected",
      measurements: candidate.evaluation!.measurements!,
    })),
    DEFAULT_CANDIDATE_METRICS,
    [...DEFAULT_LEXICOGRAPHIC_PRIORITIES]
  );
  if (selection.kind !== "selected") {
    throw new Error(
      selection.kind === "ambiguous"
        ? `Automatic candidate selection is ambiguous: ${selection.reason}`
        : selection.reason
    );
  }
  const survivors = evaluated
    .filter((candidate) => candidate.status !== "rejected")
    .sort((left, right) =>
      left.id === selection.candidateId
        ? -1
        : right.id === selection.candidateId
          ? 1
          : left.id.localeCompare(right.id)
    );
  survivors.forEach((candidate, index) => (candidate.rank = index + 1));
  for (const candidate of evaluated) {
    if (candidate.status === "rejected") {
      candidate.evaluation!.selectionBasis = {
        method: "policy_lexicographic",
        status: "rejected",
      };
      continue;
    }
    candidate.status = candidate.id === selection.candidateId ? "selected" : "survived";
    candidate.evaluation!.selectionBasis = {
      method: "policy_lexicographic",
      decisiveMetricId: selection.decisiveMetricId,
      status: candidate.status,
    };
  }
  return evaluated;
}

function candidateMeasurements(
  candidate: ArrangementCandidate,
  preferredStrategy?: string
): CandidateMeasurement[] {
  const transitionMotion = candidate.phraseSearchEvidence?.transitions.reduce(
    (total, transition) =>
      total +
      transition.fretDisplacement +
      transition.courseDisplacement +
      transition.handPositionDelta,
    0
  );
  const evidenceIds = candidate.events.map((event) => event.id);
  return [
    {
      metricId: "metric.adapter-preferred-strategy",
      applicability: preferredStrategy ? "applicable" : "unknown",
      ...(preferredStrategy ? { value: candidate.strategy === preferredStrategy ? 1 : 0 } : {}),
      uncertainty: preferredStrategy ? "exact_modeled_value" : "unknown",
      evidenceIds,
    },
    {
      metricId: "metric.source-pitch-class-coverage",
      applicability: "applicable",
      value: candidate.metrics.sourcePitchClassCoverage,
      uncertainty: "exact_modeled_value",
      evidenceIds,
    },
    {
      metricId: "metric.total-position-motion",
      applicability: transitionMotion === undefined ? "unknown" : "applicable",
      ...(transitionMotion === undefined ? {} : { value: transitionMotion }),
      uncertainty: transitionMotion === undefined ? "unknown" : "bounded_estimate",
      evidenceIds,
    },
    {
      metricId: "metric.average-fret",
      applicability: "applicable",
      value: candidate.metrics.averageFret,
      uncertainty: "exact_modeled_value",
      evidenceIds,
    },
    {
      metricId: "metric.open-string-count",
      applicability: "applicable",
      value: candidate.metrics.openStringCount,
      uncertainty: "exact_modeled_value",
      evidenceIds,
    },
  ];
}

function stableCandidateId(searchId: string, strategy: string): string {
  return `candidate.${createHash("sha256").update(`${searchId}:${strategy}`).digest("hex").slice(0, 24)}`;
}

function stableFamilyId(scoreId: string, analysisId: string): string {
  return `family.${createHash("sha256")
    .update(JSON.stringify({ scoreId, analysisId }))
    .digest("hex")
    .slice(0, 24)}`;
}

function buildSearchProtocol(input: {
  analysis: AnalysisRecord;
  plan: ArrangementPlan;
  targetConfiguration: TargetConfiguration;
  performanceBriefId: string;
  preservationPolicy: PreservationPolicy;
}): {
  constraintSpecifications: ConstraintSpecification[];
  attemptConfiguration: SearchAttemptConfiguration;
  executionIdentity: SearchExecutionIdentity;
} {
  const compilerIdentity = componentIdentity("compiler.arrangement-constraints", "1.0.0", {
    protocol: "serializable-constraint-specification",
    schemaVersion: 1,
  });
  const evaluator = componentIdentity("evaluator.preservation-target", "1.0.0", {
    modeledProperties: input.analysis.preservationTargets.map((target) => target.kind),
  });
  const constraintSpecifications: ConstraintSpecification[] =
    input.analysis.preservationTargets.map(
      (target, index): ConstraintSpecification => ({
        id: `constraint.${target.id}`,
        schemaVersion: 1,
        evaluatorId: evaluator.id,
        evaluatorVersion: evaluator.version,
        scope: {
          kind:
            target.kind === "voice" || target.kind === "principal_voice"
              ? "voice"
              : target.kind === "relationship"
                ? "passage"
                : "whole_target",
          targetConfigurationId: input.targetConfiguration.id,
          subjectIds: target.eventIds.length
            ? target.eventIds
            : target.partId
              ? [target.partId]
              : [target.id],
        },
        parameters: {
          preservationTargetKind: target.kind,
          relationshipType: target.relationshipType ?? null,
          requiredEventIds: target.eventIds,
          requiredEventGroups: target.eventGroups ?? [],
        },
        provenance: {
          kind: "preservation_target",
          sourceRecordId: target.id,
          evidenceIds: [input.analysis.id],
          observationDigest: digestJson(target),
        },
        enforcement: {
          rejection:
            input.preservationPolicy === "free_paraphrase" && target.kind !== "principal_voice"
              ? "retain_with_penalty"
              : "reject",
          comparisonPriority: index,
          exceptionPolicy: "policy_exception_required",
          confirmationPolicy: "none",
          rationale: `${target.rationale} Enforcement is compiled under ${input.preservationPolicy}.`,
          evaluationPhase: "both",
        },
        applicability: {
          status: "applicable",
          rationale: `The Analysis declares ${target.id} for this target search.`,
          requiredCapabilityIds:
            target.kind === "continuo_foundation"
              ? ["capability.bass-disposition"]
              : ["capability.polyphonic-voice-duration"],
        },
        compilerIdentity,
      })
    );
  for (const decision of input.plan.decisions.filter((candidate) =>
    candidate.targetConfigurationIds.includes(input.targetConfiguration.id)
  )) {
    for (const constraintId of decision.downstreamConstraintIds) {
      constraintSpecifications.push({
        id: constraintId,
        schemaVersion: 1,
        evaluatorId: evaluator.id,
        evaluatorVersion: evaluator.version,
        scope: {
          kind:
            decision.scope.kind === "whole_score"
              ? "whole_target"
              : decision.scope.kind === "section"
                ? "section"
                : "passage",
          targetConfigurationId: input.targetConfiguration.id,
          subjectIds: [
            ...decision.scope.eventIds,
            ...decision.scope.measureIds,
            ...decision.scope.passageIds,
            ...decision.scope.sectionIds,
          ].length
            ? [
                ...decision.scope.eventIds,
                ...decision.scope.measureIds,
                ...decision.scope.passageIds,
                ...decision.scope.sectionIds,
              ]
            : [decision.id],
        },
        parameters: {
          planDecisionId: decision.id,
          familyDecisionKey: decision.familyDecisionKey ?? null,
          dimension: decision.dimension,
          selectedValue: decision.selectedValue,
          portability: decision.portability,
          policyConsequence: decision.policyConsequence,
        },
        provenance: {
          kind: "plan_decision",
          sourceRecordId: decision.id,
          evidenceIds: decision.evidenceIds,
          observationDigest: digestJson(decision),
        },
        enforcement: {
          rejection: "reject",
          comparisonPriority: 0,
          exceptionPolicy: "policy_exception_required",
          confirmationPolicy:
            decision.confirmation.requirement === "owner" ? "owner_confirmation_required" : "none",
          rationale: `Realize Plan Decision ${decision.id} for target ${input.targetConfiguration.id}: ${decision.rationale}`,
          evaluationPhase: "both",
        },
        applicability: {
          status: "applicable",
          rationale: `Plan Decision ${decision.id} explicitly names this target configuration.`,
          requiredCapabilityIds: [],
        },
        compilerIdentity,
      });
    }
  }
  const mechanicalEvaluator = componentIdentity("evaluator.instrument-instance", "1.0.0", {
    modeledProperties: ["course construction", "sounding set", "stopped behavior"],
  });
  if (input.targetConfiguration.instrumentInstance) {
    const instance = input.targetConfiguration.instrumentInstance;
    constraintSpecifications.push({
      id: `constraint.${instance.id}`,
      schemaVersion: 1,
      evaluatorId: mechanicalEvaluator.id,
      evaluatorVersion: mechanicalEvaluator.version,
      scope: {
        kind: "whole_target",
        targetConfigurationId: input.targetConfiguration.id,
        subjectIds: instance.courses.map((course) => `course.${course.course}`),
      },
      parameters: {
        instrumentInstanceDigest: instance.contentDigest,
        courses: instance.courses,
        techniqueApplicability: instance.techniqueApplicability,
      },
      provenance: {
        kind: "instrument_mechanics",
        sourceRecordId: instance.id,
        evidenceIds: [instance.id],
        observationDigest: instance.contentDigest,
      },
      enforcement: {
        rejection: "reject",
        comparisonPriority: 0,
        exceptionPolicy: "forbidden",
        confirmationPolicy: "none",
        rationale:
          "Generated positions and sounding sets must match the exact Instrument Instance.",
        evaluationPhase: "both",
      },
      applicability: {
        status: "applicable",
        rationale: "The target carries an exact Instrument Instance configuration.",
        requiredCapabilityIds: ["capability.multi-string-course-sounding"],
      },
      compilerIdentity,
    });
  }
  const attemptConfiguration: SearchAttemptConfiguration = {
    schemaVersion: 1,
    seed: 0,
    width: 32,
    maximumExpandedStates: 10_000,
    maximumCandidates: 8,
    pruningPolicy: "adapter-safe-dominance-only",
    resourcePolicy: {
      timeoutMilliseconds: 30_000,
      diagnosticFrontierLimit: 64,
      rejectionEvidenceLimit: 256,
    },
  };
  const adapter = componentIdentity(
    `adapter.${input.targetConfiguration.instrumentId}.${input.plan.kind}`,
    "1.0.0",
    {
      instrumentProfileId: input.targetConfiguration.instrumentId,
      planKind: input.plan.kind,
      specialistIntent: input.plan.specialistIntent.kind,
    }
  );
  const identityWithoutDigest = {
    adapter,
    compiler: compilerIdentity,
    evaluators: input.targetConfiguration.instrumentInstance
      ? [evaluator, mechanicalEvaluator]
      : [evaluator],
    arrangementPlanId: input.plan.id,
    performanceBriefId: input.performanceBriefId,
    targetConfigurationId: input.targetConfiguration.id,
    instrumentInstanceDigest: input.targetConfiguration.instrumentInstance?.contentDigest,
    constraintDigests: constraintSpecifications.map(digestJson),
    attemptConfigurationDigest: digestJson(attemptConfiguration),
  };
  return {
    constraintSpecifications,
    attemptConfiguration,
    executionIdentity: {
      digest: digestJson(identityWithoutDigest),
      ...identityWithoutDigest,
    },
  };
}

function componentIdentity(id: string, version: string, definition: unknown) {
  return { id, version, digest: digestJson({ id, version, definition }) };
}

function isBaroqueGuitarStringing(value: string): value is BaroqueGuitarStringing {
  return value === "french" || value === "italian" || value === "mixed";
}

function isBaroqueLuteBassTuning(value: string): value is BaroqueLuteBassTuning {
  return ["d_minor", "a_minor", "g_minor", "d_major", "e_minor"].includes(value);
}

function digestJson(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
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
