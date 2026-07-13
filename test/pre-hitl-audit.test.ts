import { describe, expect, it } from "vitest";
// @ts-expect-error The audited CLI is intentionally plain ESM and has no emitted declaration file.
import { runPreHitlAudit } from "../scripts/pre-hitl-audit.mjs";

describe("machine pre-HITL audit", () => {
  it("maps every requirement, AFK tracer, and audit finding without laundering human evidence", () => {
    const result = runPreHitlAudit(process.cwd());
    expect(result.counts.requirements).toBe(447);
    expect(result.counts.findings).toBe(47);
    expect(result.counts.unmappedFindings).toBe(0);
    expect(result.counts.completedAfkTracers).toBe(39);
    expect(result.requirementDispositions).toContainEqual(
      expect.objectContaining({ disposition: "awaiting_scheduled_HITL" })
    );
    expect(result.requirementDispositions).not.toContainEqual(
      expect.objectContaining({
        disposition: "machine_verified",
        human: expect.stringMatching(/^H[1-9]/),
      })
    );
    expect(result).toMatchObject({ result: "pass", failures: [], machineRequirementGaps: [] });
  });
});
