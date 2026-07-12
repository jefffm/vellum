import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadArrangementIntelligenceState,
  validatePlanningState,
  validateRequirementEvidence,
} from "../scripts/verify-arrangement-intelligence.mjs";

const root = path.resolve(import.meta.dirname, "..");

function currentState() {
  return loadArrangementIntelligenceState(root);
}

describe("Arrangement Intelligence completion verifier", () => {
  it("accepts the complete planning map while implementation evidence remains open", () => {
    expect(validatePlanningState(currentState())).toEqual([]);
  });

  it("rejects duplicate and unmapped requirements", () => {
    const state = currentState();
    state.requirements.push({ ...state.requirements[0] });
    state.requirements[1] = { ...state.requirements[1], ownerExpression: "T99" };
    const errors = validatePlanningState(state);
    expect(errors.some((error: string) => error.includes("requirement IDs duplicated"))).toBe(true);
    expect(errors.some((error: string) => error.includes("invalid owner tracers"))).toBe(true);
  });

  it("rejects a missing audit finding", () => {
    const state = currentState();
    state.findings = state.findings.filter(({ id }: { id: string }) => id !== "F046");
    expect(validatePlanningState(state)).toContain("audit finding IDs missing: F046");
  });

  it("rejects stale, contradictory, and human-incomplete evidence", () => {
    const requirement = {
      ...currentState().requirements.find(
        ({ humanEvidence }: { humanEvidence: string }) => !humanEvidence.startsWith("H0")
      ),
    };
    const errors = validateRequirementEvidence(root, requirement, {
      status: "verified",
      requirementDigest: requirement.digest,
      implementationCommit: "0".repeat(40),
      verificationCommit: "1".repeat(40),
      stale: true,
      automated: [
        {
          command: "npm test",
          result: "fail",
          artifact: "artifact.json",
          recordedAt: "2026-07-11T00:00:00Z",
          dependencies: [{ path: "package.json", sha256: "0".repeat(64) }],
        },
      ],
      human: [],
    });
    expect(errors.some((error: string) => error.includes("explicitly stale"))).toBe(true);
    expect(errors.some((error: string) => error.includes("incomplete or non-passing"))).toBe(true);
    expect(errors.some((error: string) => error.includes("stale dependency"))).toBe(true);
    expect(errors.some((error: string) => error.includes("missing mandatory human evidence"))).toBe(
      true
    );
  });
});
