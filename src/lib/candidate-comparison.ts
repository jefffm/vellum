import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const Id = Type.String({ pattern: "^[a-z0-9][a-z0-9._:-]*$", minLength: 1 });

export const ComparisonMetricDefinitionSchema = Type.Object(
  {
    id: Id,
    units: Type.String({ minLength: 1 }),
    direction: Type.Union([Type.Literal("higher_is_better"), Type.Literal("lower_is_better")]),
    normalization: Type.Union([Type.Literal("none"), Type.Literal("ratio_0_1")]),
    uncertainty: Type.Union([
      Type.Literal("exact_modeled_value"),
      Type.Literal("bounded_estimate"),
      Type.Literal("unknown"),
    ]),
    applicability: Type.String({ minLength: 1 }),
    missingValueBehavior: Type.Union([
      Type.Literal("reject_required_evaluation"),
      Type.Literal("incomparable"),
      Type.Literal("not_applicable"),
    ]),
    materiality: Type.Object(
      {
        threshold: Type.Number({ minimum: 0 }),
        units: Type.String({ minLength: 1 }),
        calibrationStatus: Type.Union([
          Type.Literal("mechanically_exact"),
          Type.Literal("uncalibrated"),
          Type.Literal("reviewed"),
        ]),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
);
export type ComparisonMetricDefinition = Static<typeof ComparisonMetricDefinitionSchema>;

export const DEFAULT_CANDIDATE_METRICS: ComparisonMetricDefinition[] = [
  {
    id: "metric.adapter-preferred-strategy",
    units: "boolean",
    direction: "higher_is_better",
    normalization: "none",
    uncertainty: "exact_modeled_value",
    applicability: "Candidates produced together by one pinned target Search Adapter execution.",
    missingValueBehavior: "reject_required_evaluation",
    materiality: { threshold: 0, units: "boolean", calibrationStatus: "mechanically_exact" },
  },
  {
    id: "metric.source-pitch-class-coverage",
    units: "ratio",
    direction: "higher_is_better",
    normalization: "ratio_0_1",
    uncertainty: "exact_modeled_value",
    applicability: "Candidates derived from source pitches with complete source-event lineage.",
    missingValueBehavior: "reject_required_evaluation",
    materiality: { threshold: 0, units: "ratio", calibrationStatus: "mechanically_exact" },
  },
  {
    id: "metric.total-position-motion",
    units: "fret-course transition points",
    direction: "lower_is_better",
    normalization: "none",
    uncertainty: "bounded_estimate",
    applicability: "Fretted target candidates with represented positions.",
    missingValueBehavior: "incomparable",
    materiality: {
      threshold: 0,
      units: "fret-course transition points",
      calibrationStatus: "uncalibrated",
    },
  },
  {
    id: "metric.average-fret",
    units: "fret number",
    direction: "lower_is_better",
    normalization: "none",
    uncertainty: "exact_modeled_value",
    applicability: "Fretted target candidates with represented positions.",
    missingValueBehavior: "incomparable",
    materiality: { threshold: 0, units: "fret number", calibrationStatus: "uncalibrated" },
  },
  {
    id: "metric.open-string-count",
    units: "position count",
    direction: "higher_is_better",
    normalization: "none",
    uncertainty: "exact_modeled_value",
    applicability: "Fretted target candidates with represented positions.",
    missingValueBehavior: "incomparable",
    materiality: { threshold: 0, units: "position count", calibrationStatus: "uncalibrated" },
  },
];

export const DEFAULT_LEXICOGRAPHIC_PRIORITIES = [
  "metric.adapter-preferred-strategy",
  "metric.source-pitch-class-coverage",
  "metric.total-position-motion",
  "metric.average-fret",
  "metric.open-string-count",
] as const;

export const CandidateMeasurementSchema = Type.Object(
  {
    metricId: Id,
    applicability: Type.Union([
      Type.Literal("applicable"),
      Type.Literal("not_applicable"),
      Type.Literal("unknown"),
    ]),
    value: Type.Optional(Type.Number()),
    uncertainty: Type.Union([
      Type.Literal("exact_modeled_value"),
      Type.Literal("bounded_estimate"),
      Type.Literal("unknown"),
    ]),
    evidenceIds: Type.Array(Id),
  },
  { additionalProperties: false }
);
export type CandidateMeasurement = Static<typeof CandidateMeasurementSchema>;

export type LexicographicCandidate = {
  id: string;
  hardGatePassed: boolean;
  measurements: CandidateMeasurement[];
};

export type LexicographicSelection =
  | {
      kind: "selected";
      candidateId: string;
      survivingCandidateIds: string[];
      decisiveMetricId: string;
    }
  | { kind: "ambiguous"; survivingCandidateIds: string[]; reason: string }
  | { kind: "no_candidate"; rejectedCandidateIds: string[]; reason: string };

export function paretoReduce(
  candidates: LexicographicCandidate[],
  metricDefinitions: ComparisonMetricDefinition[]
): LexicographicCandidate[] {
  const definitions = new Map(metricDefinitions.map((definition) => [definition.id, definition]));
  return candidates.filter(
    (candidate) =>
      !candidates.some(
        (other) => other.id !== candidate.id && paretoDominates(other, candidate, definitions)
      )
  );
}

function paretoDominates(
  left: LexicographicCandidate,
  right: LexicographicCandidate,
  definitions: Map<string, ComparisonMetricDefinition>
): boolean {
  const pairs = left.measurements.flatMap((leftMeasurement) => {
    const rightMeasurement = right.measurements.find(
      ({ metricId }) => metricId === leftMeasurement.metricId
    );
    const definition = definitions.get(leftMeasurement.metricId);
    return rightMeasurement &&
      definition &&
      leftMeasurement.applicability === "applicable" &&
      rightMeasurement.applicability === "applicable" &&
      leftMeasurement.value !== undefined &&
      rightMeasurement.value !== undefined
      ? [{ left: leftMeasurement.value, right: rightMeasurement.value, definition }]
      : [];
  });
  if (pairs.length === 0) return false;
  const noWorse = pairs.every(({ left, right, definition }) =>
    definition.direction === "higher_is_better" ? left >= right : left <= right
  );
  const strictlyBetter = pairs.some(({ left, right, definition }) =>
    definition.direction === "higher_is_better" ? left > right : left < right
  );
  return noWorse && strictlyBetter;
}

export function decodeMetricDefinition(value: unknown): ComparisonMetricDefinition {
  return Value.Decode(ComparisonMetricDefinitionSchema, value);
}

export function selectLexicographically(
  candidates: LexicographicCandidate[],
  metricDefinitions: ComparisonMetricDefinition[],
  priorityMetricIds: string[]
): LexicographicSelection {
  const definitionById = new Map(
    metricDefinitions.map((definition) => [definition.id, definition])
  );
  const hardSurvivors = candidates
    .filter((candidate) => candidate.hardGatePassed)
    .map((candidate) => ({ ...candidate, measurements: [...candidate.measurements] }));
  if (hardSurvivors.length === 0) {
    return {
      kind: "no_candidate",
      rejectedCandidateIds: candidates.map((candidate) => candidate.id),
      reason: "Every candidate failed at least one hard gate.",
    };
  }
  for (const candidate of hardSurvivors) {
    for (const metricId of priorityMetricIds) {
      const definition = definitionById.get(metricId);
      if (!definition) throw new Error(`Unknown comparison metric: ${metricId}`);
      const measurement = candidate.measurements.find((item) => item.metricId === metricId);
      if (
        !measurement ||
        measurement.applicability === "unknown" ||
        measurement.uncertainty === "unknown" ||
        (measurement.applicability === "applicable" && measurement.value === undefined)
      ) {
        if (definition.missingValueBehavior === "reject_required_evaluation") {
          candidate.hardGatePassed = false;
        }
      }
    }
  }
  let survivors = hardSurvivors.filter((candidate) => candidate.hardGatePassed);
  if (survivors.length === 0) {
    return {
      kind: "no_candidate",
      rejectedCandidateIds: candidates.map((candidate) => candidate.id),
      reason: "Every hard-gate survivor was missing required comparison evidence.",
    };
  }
  if (survivors.length === 1) {
    return {
      kind: "selected",
      candidateId: survivors[0]!.id,
      survivingCandidateIds: [survivors[0]!.id],
      decisiveMetricId: priorityMetricIds[0]!,
    };
  }
  for (const metricId of priorityMetricIds) {
    const definition = definitionById.get(metricId)!;
    const applicable = survivors.map((candidate) => ({
      candidate,
      measurement: candidate.measurements.find((item) => item.metricId === metricId),
    }));
    if (
      applicable.some(
        ({ measurement }) =>
          !measurement ||
          measurement.applicability !== "applicable" ||
          measurement.value === undefined
      )
    ) {
      continue;
    }
    const values = applicable.map(({ measurement }) => measurement!.value!);
    const best =
      definition.direction === "higher_is_better" ? Math.max(...values) : Math.min(...values);
    const narrowed = applicable
      .filter(({ measurement }) =>
        definition.direction === "higher_is_better"
          ? measurement!.value! >= best - definition.materiality.threshold
          : measurement!.value! <= best + definition.materiality.threshold
      )
      .map(({ candidate }) => candidate);
    if (narrowed.length < survivors.length) {
      survivors = narrowed;
      if (survivors.length === 1) {
        return {
          kind: "selected",
          candidateId: survivors[0]!.id,
          survivingCandidateIds: survivors.map((candidate) => candidate.id),
          decisiveMetricId: metricId,
        };
      }
    }
  }
  return {
    kind: "ambiguous",
    survivingCandidateIds: survivors.map((candidate) => candidate.id),
    reason: "No authoritative lexicographic metric produced a sole survivor.",
  };
}

export type FiniteSearchState = {
  key: string;
  depth: number;
  cost: number;
};

export function verifyPrunedSearchAgainstReference(input: {
  initial: FiniteSearchState;
  successors: (state: FiniteSearchState) => FiniteSearchState[];
  terminalDepth: number;
  equivalent: (left: FiniteSearchState, right: FiniteSearchState) => boolean;
  dominates: (left: FiniteSearchState, right: FiniteSearchState) => boolean;
}): {
  referenceBestKeys: string[];
  prunedBestKeys: string[];
  equivalentOptima: boolean;
  referenceExpanded: number;
  prunedExpanded: number;
} {
  const reference = explore(false);
  const pruned = explore(true);
  const minimumReference = Math.min(...reference.terminals.map((state) => state.cost));
  const minimumPruned = Math.min(...pruned.terminals.map((state) => state.cost));
  const referenceBest = reference.terminals.filter((state) => state.cost === minimumReference);
  const prunedBest = pruned.terminals.filter((state) => state.cost === minimumPruned);
  return {
    referenceBestKeys: referenceBest.map((state) => state.key).sort(),
    prunedBestKeys: prunedBest.map((state) => state.key).sort(),
    equivalentOptima:
      minimumReference === minimumPruned &&
      referenceBest.every((referenceState) =>
        prunedBest.some((prunedState) => input.equivalent(referenceState, prunedState))
      ),
    referenceExpanded: reference.expanded,
    prunedExpanded: pruned.expanded,
  };

  function explore(prune: boolean): { terminals: FiniteSearchState[]; expanded: number } {
    let frontier = [input.initial];
    let expanded = 0;
    while (frontier.some((state) => state.depth < input.terminalDepth)) {
      const successors = frontier.flatMap((state) => {
        if (state.depth >= input.terminalDepth) return [state];
        expanded += 1;
        return input.successors(state);
      });
      if (!prune) {
        frontier = successors;
        continue;
      }
      const retained: FiniteSearchState[] = [];
      for (const candidate of successors) {
        const dominating = retained.find(
          (prior) => input.equivalent(prior, candidate) && input.dominates(prior, candidate)
        );
        if (dominating) continue;
        for (let index = retained.length - 1; index >= 0; index -= 1) {
          const prior = retained[index]!;
          if (input.equivalent(prior, candidate) && input.dominates(candidate, prior)) {
            retained.splice(index, 1);
          }
        }
        retained.push(candidate);
      }
      frontier = retained;
    }
    return { terminals: frontier, expanded };
  }
}
