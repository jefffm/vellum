import { describe, expect, it } from "vitest";
import {
  overallPrivateHoldoutStatus,
  redactPrivateHoldoutAttempt,
  type PrivateHoldoutCaseResult,
} from "./private-holdout-evaluation.js";

describe("simple private holdout reporting", () => {
  it("does not average hard failures away or disclose private truth identities", () => {
    const privateEventId = "private-source-event.do-not-log";
    const workspaceId = "workspace.private-do-not-log";
    const result: PrivateHoldoutCaseResult = {
      caseId: "holdout.12345678",
      status: overallPrivateHoldoutStatus([
        { id: "source_fidelity", status: "fail", findingCodes: ["holdout.mismatch"] },
        { id: "phrase_and_cadence", status: "pass", findingCodes: [] },
      ]),
      dimensions: [
        { id: "source_fidelity", status: "fail", findingCodes: ["holdout.mismatch"] },
        { id: "phrase_and_cadence", status: "pass", findingCodes: [] },
      ],
    };
    const redacted = JSON.stringify(redactPrivateHoldoutAttempt(result));
    expect(result.status).toBe("fail");
    expect(redacted).not.toContain(privateEventId);
    expect(redacted).not.toContain(workspaceId);
    expect(redacted).toContain("holdout.12345678");
    expect(
      overallPrivateHoldoutStatus([
        { id: "source_fidelity", status: "blocked", findingCodes: [] },
        { id: "phrase_and_cadence", status: "incomplete", findingCodes: [] },
      ])
    ).toBe("blocked");
  });
});
