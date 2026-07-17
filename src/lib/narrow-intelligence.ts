import type {
  AnalysisRecord,
  ArrangementPlan,
  ArrangementBrief,
  ArrangementScore,
  PerformanceBrief,
  PerformanceBriefInput,
  PhraseObligation,
  ScoreTranscription,
  SourceArtifact,
  SourceTruthAssessment,
  TargetConfiguration,
} from "./music-domain.js";
import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import { noteToMidi } from "./pitch.js";
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
  arrangementBriefDigest: string;
  arrangementBrief: ArrangementBrief;
  source: SourceArtifact;
  transcription: ScoreTranscription;
  normalizedScoreId: string;
  normalizedScoreVersion: number;
  analysis: AnalysisRecord;
  target: TargetConfiguration;
  preservationPolicy: PreservationPolicy;
  performanceBrief?: PerformanceBriefInput;
}): NarrowPlanningRecords {
  assertAuthorityPathRuntime("authority.parameter.arrangement-defaults", "production");
  assertAuthorityPathRuntime("authority.ranker.shared-search", "production");
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
    scope: { kind: "whole_score", partIds: [], measureIds: [], eventIds: [] },
    preservationPolicy: input.preservationPolicy,
    targetConfigurationIds: [input.target.id],
    outcome:
      unresolved.length === 0
        ? input.transcription.status === "best_effort"
          ? "best_effort_only"
          : "authoritative_for_purpose"
        : "review_required",
    authorizedClaimIds:
      unresolved.length === 0 ? input.analysis.claims.map((claim) => claim.id) : [],
    blockedClaimIds: [],
    consideredUncertaintyIds: input.transcription.uncertainties.map(
      (uncertainty) => uncertainty.id
    ),
    unresolvedUncertaintyIds: unresolved,
    blockingUncertaintyIds: unresolved,
    consequences: input.transcription.uncertainties.map((uncertainty) => ({
      uncertaintyId: uncertainty.id,
      discoveredBy: "transcription" as const,
      dimensions: ["relationship" as const],
      affectedPartIds: [],
      affectedMeasureIds: [],
      affectedEventIds: uncertainty.eventIds,
      affectedTargetConfigurationIds: [],
      critical: uncertainty.critical,
      material: true,
      unresolved: !uncertainty.resolved,
      rationale: uncertainty.message,
    })),
    stability: {
      iteration: 1,
      newMaterialUncertaintyIds: unresolved,
      stable: unresolved.length === 0,
    },
    createdAt: input.createdAt,
  };
  const performanceBrief: PerformanceBrief = {
    id: `performance.${input.createId()}`,
    arrangementBriefRevision: input.workspaceRevision,
    arrangementBriefDigest: input.arrangementBriefDigest,
    arrangementBriefSnapshot: input.arrangementBrief,
    targetConfigurationId: input.target.id,
    difficultyContext: {
      targetConfigurationId: input.target.id,
      definitionId: `difficulty.${input.target.instrumentId}.${(input.performanceBrief?.difficultyIntent ?? "intermediate").replaceAll("_", "-")}.v1`,
      evidenceIds: [`profile.${input.target.instrumentId}`],
    },
    ...(input.performanceBrief ?? {
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
      notationContext: {
        needs: input.target.notationLayouts,
        ensembleRole: input.target.role,
      },
    }),
    createdAt: input.createdAt,
  };
  const evidenceIds = [
    input.analysis.id,
    ...input.analysis.preservationTargets.map((target) => target.id),
  ];
  const passages = input.analysis.passages ?? [
    {
      id: `passage.${input.analysis.id}.whole-score`,
      measureIds: [],
      eventIds: input.analysis.preservationTargets.flatMap((target) => target.eventIds),
      texture: input.analysis.texture,
      contrapuntalTechniques: input.analysis.contrapuntalTechniques ?? [],
      claimIds: [],
      boundaries: { startReason: "legacy analysis start", endReason: "legacy analysis end" },
      roles: [],
      phrases: [],
      cadences: [],
    },
  ];
  const phraseObligations = buildPhraseObligations(
    input.analysis,
    input.transcription,
    passages,
    input.target
  );
  const plannedVoiceIds = new Set(
    phraseObligations.flatMap((obligation) =>
      obligation.targetVoices.map((voice) => voice.sourceVoiceId)
    )
  );
  const isSectionalReduction = (input.analysis.sourceVoiceGraph?.voices ?? []).some(
    (voice) => !plannedVoiceIds.has(voice.id)
  );
  const decisions = [
    {
      id: `decision.${input.createId()}`,
      familyDecisionKey: `family-decision.${input.analysis.id}.musical-structure`,
      scope: {
        kind: "whole_score" as const,
        sectionIds: [],
        passageIds: passages.map((passage) => passage.id),
        measureIds: [],
        eventIds: [],
      },
      dimension: "musical_structure",
      selectedValue: "retain_source_structure",
      rationale: "A minimal projection does not redesign form, rhythm, or voice order.",
      evidenceIds,
      alternatives: [],
      confidence: 1,
      ambiguity: { status: "none" as const },
      targetConfigurationIds: [input.target.id],
      portability: "target_portable" as const,
      policyConsequence: {
        preservationPolicy: input.preservationPolicy,
        requiresPolicyException: false,
      },
      confirmation: { requirement: "not_required" as const, status: "not_required" as const },
      downstreamConstraintIds: [`constraint.plan.musical-structure.${input.target.id}`],
      downstreamStrategyIds: [],
    },
    {
      id: `decision.${input.createId()}`,
      familyDecisionKey: `family-decision.${input.analysis.id}.preservation.${input.preservationPolicy}`,
      scope: {
        kind: "whole_score" as const,
        sectionIds: [],
        passageIds: passages.map((passage) => passage.id),
        measureIds: [],
        eventIds: [],
      },
      dimension: "preservation",
      selectedValue: input.preservationPolicy,
      rationale: "The selected Preservation Policy governs every projected event and relationship.",
      evidenceIds,
      alternatives: [],
      confidence: 1,
      ambiguity: { status: "none" as const },
      targetConfigurationIds: [input.target.id],
      portability: "target_portable" as const,
      policyConsequence: {
        preservationPolicy: input.preservationPolicy,
        requiresPolicyException: false,
      },
      confirmation: { requirement: "not_required" as const, status: "not_required" as const },
      downstreamConstraintIds: [`constraint.plan.preservation.${input.target.id}`],
      downstreamStrategyIds: [],
    },
    {
      id: `decision.${input.createId()}`,
      scope: {
        kind: "whole_score" as const,
        sectionIds: [],
        passageIds: passages.map((passage) => passage.id),
        measureIds: [],
        eventIds: [],
      },
      dimension: "notation_projection",
      selectedValue: input.target.notationLayouts.join(","),
      rationale: "Notation is projected into the explicitly selected target layout.",
      evidenceIds: [input.target.id],
      alternatives: [],
      confidence: 1,
      ambiguity: { status: "none" as const },
      targetConfigurationIds: [input.target.id],
      portability: "target_local" as const,
      policyConsequence: {
        preservationPolicy: input.preservationPolicy,
        requiresPolicyException: false,
      },
      confirmation: { requirement: "not_required" as const, status: "not_required" as const },
      downstreamConstraintIds: [`constraint.plan.notation-projection.${input.target.id}`],
      downstreamStrategyIds: [],
    },
  ];
  const arrangementPlan: ArrangementPlan = {
    id: `plan.${input.createId()}`,
    version: 1,
    kind: isSectionalReduction ? "sectional_reduction" : "minimal_projection",
    sourceTruthAssessmentId: sourceTruthAssessment.id,
    normalizedScoreId: input.normalizedScoreId,
    normalizedScoreVersion: input.normalizedScoreVersion,
    analysisRecordId: input.analysis.id,
    analysisRecordVersion: input.analysis.version,
    arrangementBriefRevision: input.workspaceRevision,
    arrangementBriefDigest: input.arrangementBriefDigest,
    performanceBriefId: performanceBrief.id,
    targetConfigurationId: input.target.id,
    preservationPolicy: input.preservationPolicy,
    planningScope: {
      sectionIds: [],
      passageIds: passages.map((passage) => passage.id),
      declaredOverlapPassageIds: [],
    },
    ...(phraseObligations.length ? { phraseObligations } : {}),
    transpositionPlan: {
      status: "resolved",
      semitones: 0,
      rationale:
        "Minimal projection preserves source pitch unless target realization reports a conflict.",
    },
    sectionalIntent: passages.map((passage) => ({
      passageId: passage.id,
      texture: passage.texture,
      density: isSectionalReduction ? ("reduce" as const) : ("retain" as const),
      voiceDisposition: "retain analyzed voice roles and continuity",
      bassDisposition: passage.roles.some((role) => role.role === "continuo_foundation")
        ? "retain Continuo Foundation identity"
        : "retain analyzed bass function",
      contrapuntalDisposition: passage.contrapuntalTechniques.length
        ? `retain ${passage.contrapuntalTechniques.join(", ")}`
        : "retain analyzed relationships",
      harmonicPriority: "retain sonority, inversion, cadence, and tendency-tone evidence",
      formalFunctionTreatment: passage.cadences.length
        ? `preserve ${passage.cadences.map((cadence) => cadence.kind).join(", ")}`
        : "preserve source formal function",
    })),
    materialDisposition: [
      ...input.analysis.preservationTargets.map((target) => ({
        sourceObjectIds: target.eventIds.length ? target.eventIds : [target.id],
        disposition: "retained" as const,
        rationale: `Minimal projection retains Preservation Target ${target.id}.`,
      })),
      ...(input.analysis.sourceVoiceGraph?.voices ?? []).flatMap((voice) => {
        const plannedIds = new Set(
          phraseObligations.flatMap((obligation) =>
            obligation.targetVoices
              .filter((targetVoice) => targetVoice.sourceVoiceId === voice.id)
              .flatMap((targetVoice) => targetVoice.sourceEventIds)
          )
        );
        const retained = voice.eventIds.filter((id) => plannedIds.has(id));
        const omitted = voice.eventIds.filter((id) => !plannedIds.has(id));
        return [
          ...(retained.length
            ? [
                {
                  sourceObjectIds: retained,
                  disposition: "redistributed" as const,
                  rationale: `Source Voice ${voice.id} has explicit phrase continuity in the target plan.`,
                },
              ]
            : []),
          ...(omitted.length
            ? [
                {
                  sourceObjectIds: omitted,
                  disposition: "omitted" as const,
                  rationale: `These events from Source Voice ${voice.id} are explicitly omitted by the reduction plan rather than disappearing during event-local voicing.`,
                },
              ]
            : []),
        ];
      }),
    ],
    specialistIntent: { kind: "none" },
    decisions,
    status: "ready",
    createdAt: input.createdAt,
  };
  return { sourceTruthAssessment, performanceBrief, arrangementPlan };
}

function buildPhraseObligations(
  analysis: AnalysisRecord,
  transcription: ScoreTranscription,
  passages: NonNullable<AnalysisRecord["passages"]>,
  target: TargetConfiguration
): NonNullable<ArrangementPlan["phraseObligations"]> {
  const graph = analysis.sourceVoiceGraph;
  if (!graph) return [];
  return passages.flatMap((passage) => {
    const principal = graph.voices.find((voice) => voice.partId === analysis.principalVoicePartId);
    if (!principal) return [];
    const passageVoices = graph.voices.filter((voice) =>
      passage.roles.some((role) => role.partId === voice.partId)
    );
    const explicitBass = passageVoices.find((voice) =>
      passage.roles.some(
        (role) =>
          role.partId === voice.partId && ["bass", "continuo_foundation"].includes(role.role)
      )
    );
    const alternatives = passageVoices.filter((voice) => voice.id !== principal?.id);
    const subordinate =
      target.instrumentId !== "classical-guitar-6"
        ? undefined
        : (explicitBass ??
          alternatives.sort(
            (left, right) =>
              averageVoiceMidi(transcription, passage, left.partId) -
              averageVoiceMidi(transcription, passage, right.partId)
          )[0]);
    const selected = [principal, subordinate].filter(
      (voice, index, all): voice is NonNullable<typeof voice> =>
        Boolean(voice) && all.findIndex((candidate) => candidate?.id === voice?.id) === index
    );
    const cadenceGoalEventIds = passage.cadences.flatMap((cadence) => cadence.goalEventIds);
    const targetVoices = selected.map((voice) => {
      const phrases = passage.phrases.filter((phrase) => phrase.partId === voice.partId);
      const role =
        voice.id === principal?.id
          ? ("principal_voice" as const)
          : voice.id === explicitBass?.id
            ? ("bass" as const)
            : ("subordinate" as const);
      const phraseEventIds = phrases.flatMap((phrase) => phrase.eventIds);
      const sourceEventIds =
        role === "principal_voice"
          ? phraseEventIds
          : phraseEventIds.filter((id) => {
              const event = transcription.events.find((candidate) => candidate.id === id);
              return (
                event?.type === "note" &&
                transcription.events.some(
                  (candidate) =>
                    candidate.type === "note" &&
                    candidate.partId === principal?.partId &&
                    candidate.measureId === event.measureId &&
                    candidate.onset.numerator * event.onset.denominator ===
                      event.onset.numerator * candidate.onset.denominator
                )
              );
            });
      return {
        id: `target-voice.${passage.id}.${voice.partId}`,
        sourceVoiceId: voice.id,
        sourcePartId: voice.partId,
        role,
        sourceEventIds,
        phraseIds: phrases.map((phrase) => phrase.id),
        restEventIds: voice.restEventIds.filter((id) => passage.eventIds.includes(id)),
        continuity: "required" as const,
        omissionPolicy: "forbidden" as const,
        allowedTransformations: ["uniform_transposition" as const, "octave_relocation" as const],
      };
    });
    const relationships: PhraseObligation["relationshipPlan"] = analysis.preservationTargets
      .filter(
        (target) =>
          target.kind === "relationship" &&
          target.eventIds.some((id) => passage.eventIds.includes(id)) &&
          ["phrase_contour", "cadential_goal"].includes(target.relationshipType ?? "")
      )
      .map((target) => ({
        id: `target-relationship.${passage.id}.${target.id}`,
        kind: target.relationshipType as "phrase_contour" | "cadential_goal",
        sourceTargetId: target.id,
        sourceEventGroups: target.eventGroups ?? [target.eventIds],
        required: true,
      }));
    if (subordinate) {
      const subordinateEvents = targetVoices.find(
        (voice) => voice.sourcePartId === subordinate.partId
      )?.sourceEventIds;
      if (subordinateEvents?.length) {
        relationships.push({
          id: `target-relationship.${passage.id}.voice-continuity.${subordinate.partId}`,
          kind: "voice_continuity",
          sourceTargetId: undefined,
          sourceEventGroups: [subordinateEvents],
          required: true,
        });
      }
    }
    return [
      {
        passageId: passage.id,
        targetVoices,
        harmonicPlan: {
          ...(subordinate && subordinate.id === explicitBass?.id
            ? { bassVoiceId: `target-voice.${passage.id}.${subordinate.partId}` }
            : {}),
          cadenceGoalEventIds,
          preserveSourceBassFunction: Boolean(subordinate && subordinate.id === explicitBass?.id),
        },
        relationshipPlan: relationships,
      },
    ];
  });
}

function averageVoiceMidi(
  transcription: ScoreTranscription,
  passage: NonNullable<AnalysisRecord["passages"]>[number],
  partId: string
): number {
  const notes = transcription.events.filter(
    (event): event is Extract<ScoreTranscription["events"][number], { type: "note" }> =>
      event.type === "note" && event.partId === partId && passage.eventIds.includes(event.id)
  );
  return notes.length
    ? notes.reduce((sum, note) => sum + noteToMidi(note.pitch), 0) / notes.length
    : Number.POSITIVE_INFINITY;
}

export function buildNarrowEvaluationCard(input: {
  score: ArrangementScore;
  planning: NarrowPlanningRecords;
  deliverableIds: string[];
}): NarrowEvaluationCard {
  assertAuthorityPathRuntime("authority.validator.arrangement-evaluation-card", "production");
  const planDecisionIds = input.planning.arrangementPlan.decisions.map((decision) => decision.id);
  const realized = new Set(input.score.realizedPlanDecisionIds ?? []);
  const dimensions: EvaluationCardDimension[] = [
    {
      id: "source_authority",
      status: ["authoritative_for_purpose", "authoritative_with_disclosed_uncertainty"].includes(
        input.planning.sourceTruthAssessment.outcome
      )
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
