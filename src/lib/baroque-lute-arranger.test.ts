import { describe, expect, it } from "vitest";
import { styleBriseAuthorization } from "./baroque-guitar-arranger.js";

describe("faithful 13-course baroque-lute arrangement search", () => {
  it("requires both a Plan Decision and historical-profile claim before style brise applies", () => {
    const base = buildMinimalAuthorizationFixture();
    expect(styleBriseAuthorization(undefined, base.analysis).status).toBe("not_applied");
    expect(styleBriseAuthorization(base.plan, { ...base.analysis, claims: [] }).status).toBe(
      "not_applied"
    );
    expect(
      styleBriseAuthorization(
        {
          ...base.plan,
          decisions: base.plan.decisions.map((decision) => ({
            ...decision,
            scope: { ...decision.scope, eventIds: ["event.unrelated"] },
          })),
        },
        base.analysis
      ).status
    ).toBe("not_applied");
    expect(styleBriseAuthorization(base.plan, base.analysis)).toMatchObject({
      status: "applied",
      planDecisionIds: ["decision.style-brise"],
      historicalClaimIds: ["claim.style-brise"],
    });
  });
});

function buildMinimalAuthorizationFixture() {
  const analysis = {
    id: "analysis.style-brise",
    normalizedScoreId: "score.style-brise",
    texture: "melody-with-accompaniment",
    claims: [
      {
        id: "claim.style-brise",
        kind: "historical_style_brise_applicability",
        subjectIds: ["score.style-brise"],
        statement: "Style brise is historically supported for this passage.",
        basis: "inference" as const,
        confidence: 0.8,
        scope: { measureIds: [], eventIds: ["event.1"] },
        evidence: [
          {
            kind: "historical_profile" as const,
            sourceIds: ["profile.baroque-lute-13"],
            explanation: "Reviewed historical profile.",
          },
        ],
      },
    ],
    preservationTargets: [
      {
        id: "target.principal",
        kind: "principal_voice" as const,
        partId: "part.soprano",
        eventIds: ["event.1"],
        rationale: "Protected.",
      },
    ],
    createdAt: "2026-07-12T12:00:00.000Z",
  };
  const plan = {
    id: "plan.style-brise",
    decisions: [
      {
        id: "decision.style-brise",
        dimension: "style_brise",
        selectedValue: "style_brise",
        scope: {
          kind: "whole_score",
          sectionIds: [],
          passageIds: [],
          measureIds: [],
          eventIds: ["event.1"],
        },
      },
    ],
  };
  return { analysis, plan } as unknown as {
    analysis: Parameters<typeof styleBriseAuthorization>[1];
    plan: NonNullable<Parameters<typeof styleBriseAuthorization>[0]>;
  };
}
