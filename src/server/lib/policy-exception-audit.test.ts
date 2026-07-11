import { describe, expect, it } from "vitest";
import type { AnalysisRecord, ArrangementScore, PolicyException } from "../../lib/music-domain.js";
import { auditPolicyExceptions } from "./arrangement-service.js";

const arrangement = {
  preservationAudit: { status: "pass", targetIds: ["target.principal"], findings: [] },
  events: [1, 2, 3, 4].map((number) => ({
    id: `arrangement-event.${number}`,
    sourceEventIds: [`source-event.${number}`],
  })),
} as unknown as ArrangementScore;
const analysis = {
  preservationTargets: [
    {
      id: "target.principal",
      eventIds: [1, 2, 3, 4].map((number) => `source-event.${number}`),
    },
  ],
} as unknown as AnalysisRecord;

function exception(number: number, severity: "localized" | "critical" = "localized") {
  return {
    id: `exception.${number}`,
    severity,
    affectedPreservationTargetIds: ["target.principal"],
    scope: { objectIds: [`arrangement-event.${number}`], dimension: "principal_voice_pitch" },
    musicalConsequence: `Changed protected event ${number}.`,
    rationale: "Owner-approved local reading.",
  } as unknown as PolicyException;
}

describe("Policy Exception audit", () => {
  it("discloses a localized exception without hiding the Faithful Reduction audit", () => {
    const result = auditPolicyExceptions(arrangement, analysis, [exception(1)]);
    expect(result).toMatchObject({
      drift: false,
      audit: {
        status: "pass_with_exceptions",
        findings: [expect.objectContaining({ code: "policy.exception", severity: "soft" })],
      },
    });
  });

  it("detects cumulative consequence and a single critical exception as Policy Drift", () => {
    expect(
      auditPolicyExceptions(arrangement, analysis, [exception(1), exception(2)])
    ).toMatchObject({
      drift: true,
      audit: {
        status: "fail",
        findings: expect.arrayContaining([expect.objectContaining({ code: "policy.drift" })]),
      },
    });
    expect(auditPolicyExceptions(arrangement, analysis, [exception(1, "critical")]).drift).toBe(
      true
    );
  });
});
