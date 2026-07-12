import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { PerformanceBriefInputSchema } from "./music-domain.js";

const valid = {
  intendedUse: "prepared_performance",
  performerProfile: {
    proficiency: "advanced",
    assumptionSource: "owner_declared",
    techniqueFamiliarity: ["barre", "campanella"],
  },
  tempoContext: { status: "specified", minimumBpm: 72, maximumBpm: 88 },
  difficultyIntent: "advanced",
  preparationExpectation: "performance_ready",
  reliabilityGoal: "performance_reliable",
  techniqueContext: { status: "specified", allowed: ["barre"], avoided: ["thumb-over"] },
  notationContext: { needs: ["clear voice separation"], ensembleRole: "solo" },
} as const;

describe("Performance Brief ownership boundary", () => {
  it("accepts performer demands, technique familiarity, and notation context", () => {
    expect(Value.Decode(PerformanceBriefInputSchema, valid)).toEqual(valid);
  });

  it.each([
    ["Owner anatomy", { ...valid, handSpanMillimeters: 190 }],
    ["instrument scale", { ...valid, scaleLengthMillimeters: 650 }],
    ["instrument tuning", { ...valid, tuning: ["E2", "A2", "D3"] }],
    ["instrument stringing", { ...valid, stringing: "paired courses" }],
  ])("rejects %s from the Intended Performer Profile boundary", (_label, input) => {
    expect(() => Value.Decode(PerformanceBriefInputSchema, input)).toThrow();
  });
});
