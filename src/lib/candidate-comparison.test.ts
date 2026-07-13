import { describe, expect, it } from "vitest";
import {
  ComparisonMetricDefinitionSchema,
  decodeMetricDefinition,
  paretoReduce,
  selectLexicographically,
  verifyPrunedSearchAgainstReference,
  type ComparisonMetricDefinition,
} from "./candidate-comparison.js";
import { Value } from "@sinclair/typebox/value";

const metrics: ComparisonMetricDefinition[] = [
  {
    id: "metric.principal-coverage",
    units: "ratio",
    direction: "higher_is_better",
    normalization: "ratio_0_1",
    uncertainty: "exact_modeled_value",
    applicability: "Faithful reductions with a Principal Voice Preservation Target.",
    missingValueBehavior: "reject_required_evaluation",
    materiality: { threshold: 0, units: "ratio", calibrationStatus: "mechanically_exact" },
  },
  {
    id: "metric.total-position-motion",
    units: "fret-course transition points",
    direction: "lower_is_better",
    normalization: "none",
    uncertainty: "bounded_estimate",
    applicability: "Fretted target candidates with complete represented positions.",
    missingValueBehavior: "incomparable",
    materiality: {
      threshold: 0,
      units: "fret-course transition points",
      calibrationStatus: "uncalibrated",
    },
  },
];

describe("candidate comparison and search correctness", () => {
  it("requires every metric to declare units, direction, applicability, uncertainty, and materiality", () => {
    for (const metric of metrics) {
      expect(decodeMetricDefinition(metric)).toEqual(metric);
      expect(Value.Check(ComparisonMetricDefinitionSchema, metric)).toBe(true);
    }
    expect(
      Value.Check(ComparisonMetricDefinitionSchema, {
        ...metrics[0],
        materiality: undefined,
      })
    ).toBe(false);
  });

  it("rejects hard failures and uses authoritative lexicographic priorities instead of totals", () => {
    const result = selectLexicographically(
      [
        {
          id: "candidate.hard-failure-with-attractive-motion",
          hardGatePassed: false,
          measurements: [
            measurement("metric.principal-coverage", 1),
            measurement("metric.total-position-motion", 1),
          ],
        },
        {
          id: "candidate.complete-but-busy",
          hardGatePassed: true,
          measurements: [
            measurement("metric.principal-coverage", 1),
            measurement("metric.total-position-motion", 8),
          ],
        },
        {
          id: "candidate.incomplete-but-smooth",
          hardGatePassed: true,
          measurements: [
            measurement("metric.principal-coverage", 0.9),
            measurement("metric.total-position-motion", 2),
          ],
        },
      ],
      metrics,
      ["metric.principal-coverage", "metric.total-position-motion"]
    );
    expect(result).toEqual({
      kind: "selected",
      candidateId: "candidate.complete-but-busy",
      survivingCandidateIds: ["candidate.complete-but-busy"],
      decisiveMetricId: "metric.principal-coverage",
    });
  });

  it("does not treat unknown required evidence as zero or neutral", () => {
    const unknown = {
      metricId: "metric.principal-coverage",
      applicability: "unknown" as const,
      uncertainty: "unknown" as const,
      evidenceIds: [],
    };
    const result = selectLexicographically(
      [
        { id: "candidate.unknown", hardGatePassed: true, measurements: [unknown] },
        {
          id: "candidate.known",
          hardGatePassed: true,
          measurements: [measurement("metric.principal-coverage", 0.8)],
        },
      ],
      metrics,
      ["metric.principal-coverage"]
    );
    expect(result).toMatchObject({ kind: "selected", candidateId: "candidate.known" });
  });

  it("replays the same policy result independent of candidate enumeration order", () => {
    const candidates = [
      {
        id: "candidate.complete-smoother",
        hardGatePassed: true,
        measurements: [
          measurement("metric.principal-coverage", 1),
          measurement("metric.total-position-motion", 3),
        ],
      },
      {
        id: "candidate.complete-busier",
        hardGatePassed: true,
        measurements: [
          measurement("metric.principal-coverage", 1),
          measurement("metric.total-position-motion", 7),
        ],
      },
    ];
    const priorities = ["metric.principal-coverage", "metric.total-position-motion"];

    const forward = selectLexicographically(candidates, metrics, priorities);
    const reversed = selectLexicographically([...candidates].reverse(), metrics, priorities);

    expect(forward).toEqual({
      kind: "selected",
      candidateId: "candidate.complete-smoother",
      survivingCandidateIds: ["candidate.complete-smoother"],
      decisiveMetricId: "metric.total-position-motion",
    });
    expect(reversed).toEqual(forward);
  });

  it("reports a material tie as ambiguous instead of inventing an automatic winner", () => {
    const result = selectLexicographically(
      [
        {
          id: "candidate.alpha",
          hardGatePassed: true,
          measurements: [
            measurement("metric.principal-coverage", 1),
            measurement("metric.total-position-motion", 4),
          ],
        },
        {
          id: "candidate.beta",
          hardGatePassed: true,
          measurements: [
            measurement("metric.principal-coverage", 1),
            measurement("metric.total-position-motion", 4),
          ],
        },
      ],
      metrics,
      ["metric.principal-coverage", "metric.total-position-motion"]
    );

    expect(result).toEqual({
      kind: "ambiguous",
      survivingCandidateIds: ["candidate.alpha", "candidate.beta"],
      reason: "No authoritative lexicographic metric produced a sole survivor.",
    });
  });

  it("uses only mutually applicable dimensions for Pareto dominance", () => {
    const candidates = [
      {
        id: "candidate.fretted",
        hardGatePassed: true,
        measurements: [
          measurement("metric.principal-coverage", 1),
          measurement("metric.total-position-motion", 3),
        ],
      },
      {
        id: "candidate.non-position-domain",
        hardGatePassed: true,
        measurements: [
          measurement("metric.principal-coverage", 1),
          {
            metricId: "metric.total-position-motion",
            applicability: "not_applicable" as const,
            uncertainty: "exact_modeled_value" as const,
            evidenceIds: ["evidence.not-applicable"],
          },
        ],
      },
    ];
    expect(paretoReduce(candidates, metrics).map(({ id }) => id)).toEqual([
      "candidate.fretted",
      "candidate.non-position-domain",
    ]);
  });

  it("proves a documented dominance relation against unpruned finite reference search", () => {
    const result = verifyPrunedSearchAgainstReference({
      initial: { key: "root", depth: 0, cost: 0 },
      terminalDepth: 3,
      successors: (state) => [
        { key: `${state.key}.low`, depth: state.depth + 1, cost: state.cost + 1 },
        { key: `${state.key}.high`, depth: state.depth + 1, cost: state.cost + 3 },
      ],
      equivalent: (left, right) => left.depth === right.depth,
      dominates: (left, right) => left.cost <= right.cost,
    });
    expect(result).toMatchObject({
      referenceBestKeys: ["root.low.low.low"],
      prunedBestKeys: ["root.low.low.low"],
      equivalentOptima: true,
    });
    expect(result.prunedExpanded).toBeLessThan(result.referenceExpanded);
  });

  it("differentially checks the sufficient relation over a family of finite spaces and catches an adversarial merge", () => {
    for (const depth of [1, 2, 3, 4]) {
      for (const highCost of [2, 3, 5]) {
        expect(
          verifyPrunedSearchAgainstReference({
            initial: { key: "root", depth: 0, cost: 0 },
            terminalDepth: depth,
            successors: (state) => [
              { key: `${state.key}.low`, depth: state.depth + 1, cost: state.cost + 1 },
              {
                key: `${state.key}.high`,
                depth: state.depth + 1,
                cost: state.cost + highCost,
              },
            ],
            equivalent: (left, right) => left.depth === right.depth,
            dominates: (left, right) => left.cost <= right.cost,
          }).equivalentOptima
        ).toBe(true);
      }
    }

    const unsafe = verifyPrunedSearchAgainstReference({
      initial: { key: "root", depth: 0, cost: 0 },
      terminalDepth: 2,
      successors: (state) =>
        state.depth === 0
          ? [
              { key: "promising", depth: 1, cost: 2 },
              { key: "cheap-dead-end", depth: 1, cost: 1 },
            ]
          : [
              {
                key: `${state.key}.finish`,
                depth: 2,
                cost: state.cost + (state.key === "promising" ? 0 : 100),
              },
            ],
      equivalent: (left, right) => left.depth === right.depth,
      dominates: (left, right) => left.cost <= right.cost,
    });
    expect(unsafe.equivalentOptima).toBe(false);
  });
});

function measurement(metricId: string, value: number) {
  return {
    metricId,
    applicability: "applicable" as const,
    value,
    uncertainty: "exact_modeled_value" as const,
    evidenceIds: [`evidence.${metricId.split(".").at(-1)}`],
  };
}
