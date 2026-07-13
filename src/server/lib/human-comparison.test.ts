import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  HumanComparisonProtocolSchema,
  type HumanEvaluation,
} from "../../lib/evaluation-domain.js";
import { createFirstLoopRegistry } from "./first-loop-evaluation.js";
import { digestValue } from "./evaluation-harness.js";
import { deriveHumanComparisonConclusion } from "./human-comparison.js";

describe("human comparison protocol", () => {
  it("keeps one vote scoped, retains disagreement, and requires the declared adjudicator role", () => {
    const definition = createFirstLoopRegistry().definitions.find(
      (item) => item.id === "protocol.first-loop-human"
    )!;
    const protocol = Value.Decode(HumanComparisonProtocolSchema, definition.payload);
    const first = evaluation(definition, "human.1", "reviewer.1", "left", ["left", "right"]);
    expect(
      deriveHumanComparisonConclusion({
        id: "human-conclusion.1",
        protocolRef: first.protocolRef,
        protocol,
        evaluations: [first],
        createdAt: "2026-07-10T18:00:00.000Z",
      })
    ).toMatchObject({ status: "insufficient_evidence", regressionEligible: false });

    const second = evaluation(
      definition,
      "human.2",
      "reviewer.2",
      "right",
      ["right", "left"],
      "duplicate.1"
    );
    expect(
      deriveHumanComparisonConclusion({
        id: "human-conclusion.2",
        protocolRef: first.protocolRef,
        protocol,
        evaluations: [first, second],
        createdAt: "2026-07-10T18:00:00.000Z",
      })
    ).toMatchObject({ status: "unresolved_disagreement", regressionEligible: false });

    const adjudicator = {
      ...evaluation(definition, "human.3", "reviewer.3", "right", ["left", "right"]),
      reviewer: {
        ...first.reviewer,
        pseudonymousId: "reviewer.3",
        role: "owner_usability" as const,
      },
      conclusion: {
        status: "single_scoped_judgment" as const,
        rationale: "Owner adjudication applies only to personal adoption.",
      },
    };
    expect(
      deriveHumanComparisonConclusion({
        id: "human-conclusion.3",
        protocolRef: first.protocolRef,
        protocol,
        evaluations: [first, second],
        adjudicator,
        createdAt: "2026-07-10T18:00:00.000Z",
      })
    ).toMatchObject({
      status: "adjudicated",
      winner: "right",
      adjudicatorEvaluationId: adjudicator.id,
      regressionEligible: false,
    });
  });
});

function evaluation(
  definition: ReturnType<typeof createFirstLoopRegistry>["definitions"][number],
  id: string,
  reviewerId: string,
  preference: "left" | "right",
  presentedOrder: ["left", "right"] | ["right", "left"],
  duplicateAssignmentId?: string
): HumanEvaluation {
  const digest = "a".repeat(64);
  const context = (candidateId: string) => ({
    candidateRef: { id: candidateId, version: 1, digest },
    arrangementSearchRef: { id: "search.1", version: 1, digest },
    performanceBriefRef: { id: "brief.1", version: 1, digest },
    instrumentInstanceDigest: digest,
    candidateEventIds: [`${candidateId}.event.1`],
    arrangementScoreEventIds: ["arrangement-event.1"],
    sourceEventIds: ["source-event.1"],
    playbackOccurrenceIds: ["occurrence.1"],
  });
  return {
    id,
    protocolRef: {
      id: definition.id,
      version: definition.version,
      digest: digestValue(definition),
    },
    reviewer: {
      pseudonymousId: reviewerId,
      role: "target_player",
      qualifications: ["Declared target player"],
      confidence: 0.8,
      conflictsOfInterest: [],
      consented: true,
    },
    evidenceBasis: ["physical_playing"],
    ownerPlaytestIds: ["playtest.1", "playtest.2"],
    pairwise: {
      left: context("candidate.left"),
      right: context("candidate.right"),
      retainedRandomizationSeed: "seed.1",
      presentedOrder,
      ...(duplicateAssignmentId ? { duplicateAssignmentId } : {}),
      practicalBlindingApplied: true,
      blindingLimitations: "Musical style may reveal identity.",
    },
    judgments: [
      {
        dimension: "physical_execution",
        rubricAnchorId: "rubric.physical-execution",
        preference,
        rationale: "Scoped pairwise judgment.",
        citedEvidenceIds: [],
      },
    ],
    conclusion: {
      status: "single_scoped_judgment",
      rationale: "One scoped judgment only.",
    },
    learningDisposition: "scoped_judgment_only",
    regressionEligible: false,
    createdAt: "2026-07-10T17:00:00.000Z",
  };
}
