import { describe, expect, it } from "vitest";
import { applyPreservationPolicy } from "./preservation-policy.js";

const failedAudit = {
  status: "fail" as const,
  targetIds: ["target.principal"],
  findings: [
    {
      targetId: "target.principal",
      sourceEventId: "event.1",
      severity: "hard" as const,
      code: "principal.pitch_changed",
      message: "The protected pitch changed.",
    },
  ],
};

describe("Preservation Policy", () => {
  it("keeps note-level divergence hard under Faithful Reduction", () => {
    expect(applyPreservationPolicy(failedAudit, "faithful_reduction")).toEqual(failedAudit);
  });

  it.each(["idiomatic_adaptation", "free_paraphrase"] as const)(
    "keeps the full report inspectable without using note fidelity as a %s gate",
    (policy) => {
      expect(applyPreservationPolicy(failedAudit, policy)).toEqual({
        status: "pass",
        targetIds: ["target.principal"],
        findings: [
          expect.objectContaining({
            severity: "observation",
            code: `${policy}.principal.pitch_changed`,
          }),
        ],
      });
    }
  );
});
