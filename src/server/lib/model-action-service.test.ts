import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelActionInputVersion } from "../../lib/music-domain.js";
import { ModelActionService } from "./model-action-service.js";
import { WorkspaceStore } from "./workspace-store.js";

describe("ModelActionService", () => {
  let store: WorkspaceStore;
  let service: ModelActionService;
  let workspaceId: string;
  let sequence: number;
  const original: ModelActionInputVersion[] = [
    { recordType: "normalized_score", recordId: "score.1111111111111111", version: 1 },
  ];

  beforeEach(async () => {
    sequence = 0;
    store = new WorkspaceStore({
      rootDirectory: await mkdtemp(path.join(tmpdir(), "vellum-actions-")),
      createId: () => "11111111-1111-4111-8111-111111111111",
      now: () => new Date("2026-07-11T12:00:00.000Z"),
    });
    workspaceId = store.create({ title: "Action fixture" }).id;
    vi.spyOn(store, "resolveCurrentInputVersions").mockImplementation((_workspaceId, values) =>
      values.map((value) => ({ ...value }))
    );
    vi.spyOn(store, "assertCanonicalResultReference").mockImplementation(() => undefined);
    service = new ModelActionService({
      store,
      createId: () => `${(++sequence).toString(16).padStart(16, "0")}`,
      now: () => new Date(`2026-07-11T12:00:${sequence.toString().padStart(2, "0")}.000Z`),
    });
  });

  it("persists exact inputs and returns the same action at an idempotency boundary", () => {
    const input = {
      kind: "musicological_analysis",
      intent: "Identify contrapuntal entries",
      inputVersions: original,
      lastConfirmedBoundary: "Normalized Score v1",
      idempotencyKey: "same-request-boundary",
    };
    const first = service.create(workspaceId, input);
    const duplicate = service.create(workspaceId, input);

    expect(duplicate.id).toBe(first.id);
    expect(store.listModelActions(workspaceId)).toHaveLength(1);
    expect(first.attempts[0]).toMatchObject({
      status: "running",
      inputVersions: original,
      lastConfirmedBoundary: "Normalized Score v1",
    });
    expect(() => service.create(workspaceId, { ...input, intent: "A different request" })).toThrow(
      /reused for different inputs/
    );
  });

  it("keeps partial output diagnostic and commits canonical state only after validation", () => {
    const action = service.create(workspaceId, {
      kind: "arrangement_generation",
      intent: "Create a faithful reduction",
      inputVersions: original,
      lastConfirmedBoundary: "Analysis Record v1",
    });
    service.progress(workspaceId, action.id, {
      completedLocalToolResults: [{ toolName: "theory", resultReference: "tool-result.1" }],
      partialProgressSummary: "Generated two bars",
      diagnosticPartialOutput: "Bearer secret-token and api_key=sk-1234567890",
    });
    const interrupted = service.interrupt(
      workspaceId,
      action.id,
      "network failed with token=secret-token"
    );

    expect(interrupted.status).toBe("interrupted");
    expect(interrupted.attempts[0]).toMatchObject({
      partialProgressSummary: "Generated two bars",
      interruptionReason: "network failed with token=[redacted]",
    });
    expect(interrupted.attempts[0]).not.toHaveProperty("canonicalResultReference");
    expect(JSON.stringify(interrupted)).not.toContain("secret-token");
    expect(JSON.stringify(interrupted)).not.toContain("sk-1234567890");
  });

  it("defaults retry to current inputs and records a difference without duplicating state", () => {
    const action = service.create(workspaceId, {
      kind: "analysis",
      intent: "Analyze texture",
      inputVersions: original,
      lastConfirmedBoundary: "Score v1",
    });
    service.interrupt(workspaceId, action.id, "provider expired");
    const retried = service.retry(workspaceId, action.id, "current_version", [
      { ...original[0]!, version: 2 },
    ]);

    expect(retried.attempts).toHaveLength(2);
    expect(retried.attempts[1]).toMatchObject({
      number: 2,
      mode: "current_version",
      status: "running",
      inputDifferenceSummary: "score.1111111111111111: v1 -> v2",
    });
    const completed = service.complete(workspaceId, action.id, "analysis.2222222222222222");
    expect(completed.status).toBe("completed");
    expect(completed.attempts[1]?.canonicalResultReference).toBe("analysis.2222222222222222");
    expect(() => service.retry(workspaceId, action.id, "current_version", original)).toThrow(
      /Only an interrupted/
    );
  });

  it("retries the original snapshot on a separately persisted Arrangement Branch", () => {
    const action = service.create(workspaceId, {
      kind: "arrangement",
      intent: "Preserve the principal voice",
      inputVersions: original,
      lastConfirmedBoundary: "Score v1",
    });
    service.interrupt(workspaceId, action.id, "logged out");
    const retried = service.retry(workspaceId, action.id, "original_snapshot_branch", [
      { ...original[0]!, version: 2 },
    ]);
    const branchId = retried.attempts[1]?.arrangementBranchId;

    expect(branchId).toBeDefined();
    expect(store.getArrangementBranch(workspaceId, branchId!)).toMatchObject({
      rootInputVersions: original,
      createdByModelActionId: action.id,
    });
  });

  it("cancels idempotently and never allows cancellation of committed work", () => {
    const running = service.create(workspaceId, {
      kind: "analysis",
      intent: "Analyze",
      inputVersions: original,
      lastConfirmedBoundary: "Score v1",
    });
    expect(service.cancel(workspaceId, running.id).status).toBe("cancelled");
    expect(service.cancel(workspaceId, running.id).status).toBe("cancelled");

    const interrupted = service.create(workspaceId, {
      kind: "analysis",
      intent: "Interrupt then cancel",
      inputVersions: original,
      lastConfirmedBoundary: "Score v1",
    });
    service.interrupt(workspaceId, interrupted.id, "network failure");
    expect(service.cancel(workspaceId, interrupted.id)).toMatchObject({
      status: "cancelled",
      attempts: [expect.objectContaining({ status: "cancelled" })],
    });

    const complete = service.create(workspaceId, {
      kind: "analysis",
      intent: "Analyze again",
      inputVersions: original,
      lastConfirmedBoundary: "Score v1",
    });
    service.complete(workspaceId, complete.id, "analysis.3333333333333333");
    expect(() => service.cancel(workspaceId, complete.id)).toThrow(/cannot be cancelled/);
  });
});
