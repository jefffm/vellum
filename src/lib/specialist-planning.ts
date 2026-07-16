import type {
  AnalysisRecord,
  ArrangementPlan,
  PlanDecision,
  TargetConfiguration,
} from "./music-domain.js";
import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";

type PreservationPolicy = ArrangementPlan["preservationPolicy"];

export function specializeArrangementPlan(input: {
  base: ArrangementPlan;
  analysis: AnalysisRecord;
  target: TargetConfiguration;
  preservationPolicy: PreservationPolicy;
}): ArrangementPlan {
  assertAuthorityPathRuntime("authority.ranker.shared-search", "production");
  assertAuthorityPathRuntime("authority.parameter.arrangement-defaults", "production");
  const { base, analysis, target, preservationPolicy } = input;
  if (analysis.texture === "continuo" || target.realizationProfileId) {
    const foundations = analysis.preservationTargets.filter(
      (candidate) => candidate.kind === "continuo_foundation"
    );
    const decision = specialistDecision(base, {
      suffix: "continuo-profile",
      dimension: "continuo_realization",
      selectedValue: target.continuoBassInstrumentId
        ? "separate_bass_realization"
        : preservationPolicy === "faithful_reduction"
          ? "complete_realization"
          : "continuo_reduction",
      rationale:
        "Realize the exact Continuo Foundation and figures under the selected Realization Profile.",
      evidenceIds: [analysis.id, ...foundations.map((target) => target.id)],
      alternatives: [
        {
          value: "lean_realization",
          consequence: "Reduces upper-voice density while retaining the figured harmonic content.",
          viable: true,
        },
      ],
      strategies: ["strategy.continuo.voice-leading"],
      expectedCompromise: "Continuo voicing may redistribute or reduce upper-voice density.",
    });
    const foundationDisposition = target.continuoBassInstrumentId
      ? "separate_bass"
      : preservationPolicy === "faithful_reduction"
        ? "complete"
        : "reduced";
    return {
      ...base,
      kind: "continuo_realization",
      specialistIntent: {
        kind: "continuo_realization",
        realizationProfileId: target.realizationProfileId ?? "realization-profile.required",
        foundationDisposition,
        figureTreatment: "contextual realization of every explicit figure",
        voiceLeadingPriority: "stepwise upper voices with prepared dissonance handling",
        foundationTargetIds: foundations.map((candidate) => candidate.id),
        candidateStrategies: target.continuoBassInstrumentId
          ? ["separate-bass-realization", "continuo-reduction"]
          : preservationPolicy === "faithful_reduction"
            ? ["complete-realization", "lean-realization"]
            : ["lean-realization", "continuo-reduction"],
      },
      decisions: [...base.decisions, decision],
    };
  }
  if (analysis.texture === "imitative-polyphony") {
    const entryTargets = analysis.preservationTargets.filter(
      (candidate) =>
        candidate.kind === "relationship" && candidate.relationshipType === "ordered_entries"
    );
    const cadenceTargets = analysis.preservationTargets.filter(
      (candidate) =>
        candidate.kind === "relationship" && candidate.relationshipType === "cadential_goal"
    );
    const decision = specialistDecision(base, {
      suffix: "imitative-distribution",
      dimension: "imitative_voice_distribution",
      selectedValue: "preserve_entries_and_cadences",
      rationale:
        "Distribute independent voices across courses without merging ordered entries or cadential goals.",
      evidenceIds: [
        analysis.id,
        ...entryTargets.map((target) => target.id),
        ...cadenceTargets.map((target) => target.id),
      ],
      alternatives: [
        {
          value: "low_fret_polyphony",
          consequence: "Optimizes local hand position while retaining every independent voice.",
          viable: true,
        },
        {
          value: "voice_continuity",
          consequence: "Prioritizes stable course identity for each contrapuntal voice.",
          viable: true,
        },
      ],
      strategies: ["strategy.imitation.entries", "strategy.imitation.cadences"],
      expectedCompromise:
        "Course distribution may trade local hand position against voice continuity.",
    });
    return {
      ...base,
      kind: "imitative_intabulation",
      specialistIntent: {
        kind: "imitative_intabulation",
        voiceDistribution: "independent course-aware voice lineages",
        overlapPolicy: "preserve simultaneous entries without course collision",
        entryTargetIds: entryTargets.map((target) => target.id),
        cadenceTargetIds: cadenceTargets.map((target) => target.id),
        candidateStrategies: ["low-fret-polyphony", "voice-continuity"],
      },
      decisions: [...base.decisions, decision],
    };
  }
  if (preservationPolicy === "free_paraphrase") {
    const decision = specialistDecision(base, {
      suffix: "creative-design",
      dimension: "creative_design",
      selectedValue: "ornamented_idiomatic_paraphrase",
      rationale:
        "The explicitly selected free-paraphrase policy authorizes generated idiomatic material while retaining disclosed source lineage.",
      evidenceIds: [analysis.id, ...analysis.preservationTargets.map((target) => target.id)],
      alternatives: [
        {
          value: "idiomatic_revoicing",
          consequence: "Changes texture and position without adding ornamental pitch material.",
          viable: true,
        },
      ],
      strategies: ["strategy.creative.ornament", "strategy.creative.revoice"],
      expectedCompromise:
        "Generated ornament changes literal source pitch content by explicit policy.",
      confirmedAt: base.createdAt,
    });
    return {
      ...base,
      kind: "creative_arrangement",
      specialistIntent: {
        kind: "creative_arrangement",
        formalDesign: "retain source form while permitting local elaboration",
        texturalDesign: "idiomatic plucked-string revoicing",
        harmonicDesign: "retain cadence goals while permitting ornamental non-chord tones",
        idiomaticDesign: "generated ornaments and resonant open-string voicing",
        generatedMaterialDecisionIds: [decision.id],
        candidateStrategies: ["ornamented-paraphrase", "idiomatic-revoicing"],
      },
      materialDisposition: [
        ...base.materialDisposition,
        {
          sourceObjectIds: [analysis.id],
          disposition: "generated",
          rationale: `Generated material is owned by Plan Decision ${decision.id}.`,
        },
      ],
      decisions: [...base.decisions, decision],
    };
  }
  return base;
}

function specialistDecision(
  base: ArrangementPlan,
  input: {
    suffix: string;
    dimension: string;
    selectedValue: string;
    rationale: string;
    evidenceIds: string[];
    alternatives: PlanDecision["alternatives"];
    strategies: string[];
    confirmedAt?: string;
    expectedCompromise: string;
  }
): PlanDecision {
  const passages = base.planningScope.passageIds;
  return {
    id: `decision.${base.id.slice("plan.".length)}.${input.suffix}`,
    scope: {
      kind: "whole_score",
      sectionIds: base.planningScope.sectionIds,
      passageIds: passages,
      measureIds: [],
      eventIds: [],
    },
    dimension: input.dimension,
    selectedValue: input.selectedValue,
    rationale: input.rationale,
    evidenceIds: input.evidenceIds,
    alternatives: input.alternatives,
    confidence: 1,
    ambiguity: { status: "none" },
    targetConfigurationIds: [base.targetConfigurationId],
    portability: "target_local",
    policyConsequence: {
      preservationPolicy: base.preservationPolicy,
      expectedCompromise: input.expectedCompromise,
      requiresPolicyException: false,
    },
    confirmation: input.confirmedAt
      ? { requirement: "owner", status: "confirmed", confirmedAt: input.confirmedAt }
      : { requirement: "not_required", status: "not_required" },
    downstreamConstraintIds: [`constraint.plan.${input.suffix}.${base.targetConfigurationId}`],
    downstreamStrategyIds: input.strategies,
  };
}
