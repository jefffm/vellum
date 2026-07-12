import type {
  AnalysisRecord,
  ArrangementPlan,
  ArrangementScore,
  PerformanceBrief,
  PerformanceBriefInput,
  ScoreTranscription,
  SourceArtifact,
  SourceTruthAssessment,
  TargetConfiguration,
} from "./music-domain.js";
import type { PreservationPolicy } from "./preservation-policy.js";

export type NarrowPlanningRecords = {
  sourceTruthAssessment: SourceTruthAssessment;
  performanceBrief: PerformanceBrief;
  arrangementPlan: ArrangementPlan;
};

export type EvaluationCardDimension = {
  id: string;
  status: "pass" | "fail" | "unknown" | "not_evaluated";
  hardGate: boolean;
  evidenceIds: string[];
  rationale: string;
};

export type NarrowEvaluationCard = {
  arrangementScoreId: string;
  arrangementScoreVersion: number;
  sourceTruthAssessmentId: string;
  arrangementPlanId: string;
  performanceBriefId: string;
  hardGateStatus: "pass" | "fail";
  dimensions: EvaluationCardDimension[];
};

export function buildNarrowPlanningRecords(input: {
  createId: () => string;
  createdAt: string;
  workspaceRevision: number;
  source: SourceArtifact;
  transcription: ScoreTranscription;
  normalizedScoreId: string;
  normalizedScoreVersion: number;
  analysis: AnalysisRecord;
  target: TargetConfiguration;
  preservationPolicy: PreservationPolicy;
  performanceBrief?: PerformanceBriefInput;
}): NarrowPlanningRecords {
  const unresolved = input.transcription.uncertainties
    .filter((uncertainty) => uncertainty.critical && !uncertainty.resolved)
    .map((uncertainty) => uncertainty.id);
  const sourceTruthAssessment: SourceTruthAssessment = {
    id: `truth.${input.createId()}`,
    sourceArtifactId: input.source.id,
    scoreTranscriptionId: input.transcription.id,
    scoreTranscriptionVersion: input.transcription.version,
    normalizedScoreId: input.normalizedScoreId,
    normalizedScoreVersion: input.normalizedScoreVersion,
    analysisRecordId: input.analysis.id,
    analysisRecordVersion: input.analysis.version,
    purpose: "arrangement_planning",
    outcome:
      unresolved.length === 0
        ? input.transcription.status === "best_effort"
          ? "best_effort_only"
          : "authoritative_for_purpose"
        : "review_required",
    authorizedClaimIds:
      unresolved.length === 0 ? input.analysis.claims.map((claim) => claim.id) : [],
    blockedClaimIds: [],
    unresolvedUncertaintyIds: unresolved,
    createdAt: input.createdAt,
  };
  const performanceBrief: PerformanceBrief = {
    id: `performance.${input.createId()}`,
    arrangementBriefRevision: input.workspaceRevision,
    targetConfigurationId: input.target.id,
    ...(input.performanceBrief ?? {
      intendedUse: "study",
      performerProfile: {
        proficiency: "intermediate",
        assumptionSource: "guided_start_default_pending_owner_review",
      },
      tempoContext: { status: "not_specified" },
      difficultyIntent: "intermediate",
      preparationExpectation: "practice_expected",
      reliabilityGoal: "repeatable",
    }),
    createdAt: input.createdAt,
  };
  const evidenceIds = [
    input.analysis.id,
    ...input.analysis.preservationTargets.map((target) => target.id),
  ];
  const decisions = [
    {
      id: `decision.${input.createId()}`,
      dimension: "musical_structure",
      selectedValue: "retain_source_structure",
      rationale: "A minimal projection does not redesign form, rhythm, or voice order.",
      evidenceIds,
      targetConfigurationIds: [input.target.id],
      confirmationStatus: "not_required_for_literal_projection" as const,
    },
    {
      id: `decision.${input.createId()}`,
      dimension: "preservation",
      selectedValue: input.preservationPolicy,
      rationale: "The selected Preservation Policy governs every projected event and relationship.",
      evidenceIds,
      targetConfigurationIds: [input.target.id],
      confirmationStatus: "not_required_for_literal_projection" as const,
    },
    {
      id: `decision.${input.createId()}`,
      dimension: "notation_projection",
      selectedValue: input.target.notationLayouts.join(","),
      rationale: "Notation is projected into the explicitly selected target layout.",
      evidenceIds: [input.target.id],
      targetConfigurationIds: [input.target.id],
      confirmationStatus: "not_required_for_literal_projection" as const,
    },
  ];
  const arrangementPlan: ArrangementPlan = {
    id: `plan.${input.createId()}`,
    version: 1,
    kind: "minimal_projection",
    sourceTruthAssessmentId: sourceTruthAssessment.id,
    normalizedScoreId: input.normalizedScoreId,
    normalizedScoreVersion: input.normalizedScoreVersion,
    analysisRecordId: input.analysis.id,
    analysisRecordVersion: input.analysis.version,
    performanceBriefId: performanceBrief.id,
    targetConfigurationId: input.target.id,
    preservationPolicy: input.preservationPolicy,
    decisions,
    status: "applicable_without_consequential_choice",
    createdAt: input.createdAt,
  };
  return { sourceTruthAssessment, performanceBrief, arrangementPlan };
}

export function buildNarrowEvaluationCard(input: {
  score: ArrangementScore;
  planning: NarrowPlanningRecords;
  deliverableIds: string[];
}): NarrowEvaluationCard {
  const planDecisionIds = input.planning.arrangementPlan.decisions.map((decision) => decision.id);
  const realized = new Set(input.score.realizedPlanDecisionIds ?? []);
  const dimensions: EvaluationCardDimension[] = [
    {
      id: "source_authority",
      status:
        input.planning.sourceTruthAssessment.outcome === "authoritative_for_purpose"
          ? "pass"
          : "fail",
      hardGate: true,
      evidenceIds: [input.planning.sourceTruthAssessment.id],
      rationale: "Planning is authorized only for the exact reviewed source lineage.",
    },
    {
      id: "preservation_and_transformation",
      status: input.score.preservationAudit.status === "fail" ? "fail" : "pass",
      hardGate: true,
      evidenceIds: input.score.preservationAudit.targetIds,
      rationale: "The complete Transformation Report and Preservation Audit govern this score.",
    },
    {
      id: "arrangement_plan_realization",
      status: planDecisionIds.every((id) => realized.has(id)) ? "pass" : "fail",
      hardGate: true,
      evidenceIds: planDecisionIds,
      rationale: "Every applicable minimal Plan Decision is linked to the selected score.",
    },
    {
      id: "mechanical_and_technique_evidence",
      status: "unknown",
      hardGate: false,
      evidenceIds: input.score.events.map((event) => event.id),
      rationale:
        "Modeled positions exist, but modeled feasibility and physical technique evidence are not interchangeable.",
    },
    {
      id: "historical_and_analytical_evidence",
      status: "unknown",
      hardGate: false,
      evidenceIds: [input.planning.arrangementPlan.analysisRecordId],
      rationale:
        "A machine Analysis Record exists; specialist historical or analytical review is not inferred.",
    },
    {
      id: "engraving_and_notation",
      status: input.deliverableIds.length > 0 ? "pass" : "unknown",
      hardGate: false,
      evidenceIds: input.deliverableIds,
      rationale:
        "Deliverables are evidence of successful projection; visual quality is not inferred.",
    },
    {
      id: "playback_and_performed_form",
      status: "unknown",
      hardGate: false,
      evidenceIds: [],
      rationale:
        "Canonical playback and Performed Form have not been independently evaluated in this tracer.",
    },
    {
      id: "workflow_and_recovery",
      status: "unknown",
      hardGate: false,
      evidenceIds: [input.score.id, input.planning.arrangementPlan.id],
      rationale:
        "This run completed and persisted, but the full recovery protocol is separate evidence.",
    },
    {
      id: "human_and_physical_evidence",
      status: "unknown",
      hardGate: false,
      evidenceIds: [],
      rationale: "No Owner playtest or expert physical review belongs to this automated tracer.",
    },
    {
      id: "explicit_owner_usefulness",
      status: "not_evaluated",
      hardGate: false,
      evidenceIds: [],
      rationale:
        "Usefulness requires later Owner evaluation and cannot be inferred from generation.",
    },
  ];
  return {
    arrangementScoreId: input.score.id,
    arrangementScoreVersion: input.score.version ?? 1,
    sourceTruthAssessmentId: input.planning.sourceTruthAssessment.id,
    arrangementPlanId: input.planning.arrangementPlan.id,
    performanceBriefId: input.planning.performanceBrief.id,
    hardGateStatus: dimensions.some(
      (dimension) => dimension.hardGate && dimension.status === "fail"
    )
      ? "fail"
      : "pass",
    dimensions,
  };
}
