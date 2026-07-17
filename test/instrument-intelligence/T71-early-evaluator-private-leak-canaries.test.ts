import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EvaluationLeakCanaryError,
  EvaluationLeakCanaryGuard,
  guardedLeakBoundaryEffect,
  guardedPublicWrite,
} from "../../src/server/lib/evaluation-leak-canary.js";
import { EvaluationHarness } from "../../src/server/lib/evaluation-harness.js";
import {
  createFirstLoopRegistry,
  FIRST_LOOP_SUITE_REF,
} from "../../src/server/lib/first-loop-evaluation.js";
import { EvaluationStore } from "../../src/server/lib/evaluation-store.js";

const roots: string[] = [];

afterEach(() => {
  delete process.env.VELLUM_T71_SYNTHETIC_SECRET;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("T71 early evaluator and private-data leak canaries", () => {
  it("blocks encoded, compressed, nested, truncated, renamed, and weak-hash variants safely", () => {
    const secret = randomBytes(32);
    const text = secret.toString("hex");
    const variants = [
      secret,
      text,
      secret.toString("base64"),
      secret.toString("base64url"),
      encodeURIComponent(secret.toString("base64")),
      gzipSync(secret).toString("base64"),
      text.slice(0, 32),
      [...text].reverse().join(""),
      createHash("sha256").update(secret).digest("hex"),
      createHash("sha1").update(secret).digest("hex"),
      createHash("md5").update(secret).digest("hex"),
    ];
    const guard = new EvaluationLeakCanaryGuard(secret, {
      sessionId: "canary-session.synthetic-t71",
      commitmentKey: randomBytes(32),
      now: () => new Date("2026-07-17T01:00:00.000Z"),
    });
    for (const [index, value] of variants.entries()) {
      let caught: EvaluationLeakCanaryError | undefined;
      try {
        guard.assertSafe("public_writer", { nested: { [`renamed_${index}`]: value } });
      } catch (error) {
        if (error instanceof EvaluationLeakCanaryError) caught = error;
      }
      expect(caught).toBeDefined();
      const serialized = JSON.stringify(caught);
      expect(serialized).not.toContain(secret.toString("hex"));
      expect(serialized).not.toContain(String(value));
      expect(caught!.receipt).toMatchObject({
        schemaVersion: 1,
        guardVersion: "t71.v1",
        boundary: "public_writer",
        outcome: "blocked",
        findingClassIds: expect.arrayContaining([expect.stringMatching(/^canary-class\./)]),
      });
    }
  });

  it("fails closed after expiry or teardown and emits only non-resolving clear receipts", () => {
    let now = new Date("2026-07-17T01:00:00.000Z");
    const secret = randomBytes(32);
    const guard = new EvaluationLeakCanaryGuard(secret, {
      now: () => now,
      maximumAgeMs: 1_000,
      commitmentKey: randomBytes(32),
    });
    const receipt = guard.assertSafe("generation_input", { prompt: "public synthetic input" });
    expect(receipt).toMatchObject({ outcome: "clear", findingClassIds: [] });
    expect(JSON.stringify(receipt)).not.toContain(secret.toString("hex"));
    now = new Date("2026-07-17T01:00:01.001Z");
    expect(() => guard.assertSafe("result_commit", {})).toThrow("stale");
    guard.close();
    expect(() => guard.assertSafe("diagnostic", {})).toThrow("inactive");
  });

  it("blocks a synthetic environment leak before the evaluation executor runs", async () => {
    const secret = randomBytes(32);
    process.env.VELLUM_T71_SYNTHETIC_SECRET = secret.toString("hex");
    const executeCase = vi.fn();
    const guard = new EvaluationLeakCanaryGuard(secret, { commitmentKey: randomBytes(32) });
    const harness = evaluationHarness(guard, executeCase);
    let caught: unknown;
    try {
      await harness.run(FIRST_LOOP_SUITE_REF, executionIdentity());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EvaluationLeakCanaryError);
    expect(String(caught)).not.toContain(secret.toString("hex"));
    expect(executeCase).not.toHaveBeenCalled();
    expect(() => guard.assertSafe("diagnostic", {})).toThrow("inactive");
  });

  it("blocks a synthetic diagnostic before any Evaluation Card or Result Commit persists", async () => {
    const secret = randomBytes(32);
    const guard = new EvaluationLeakCanaryGuard(secret, { commitmentKey: randomBytes(32) });
    const store = evaluationStore();
    const harness = new EvaluationHarness({
      store,
      registry: createFirstLoopRegistry(),
      leakCanaryGuard: guard,
      executeCase: async () => ({
        generatedRecordRefs: [],
        deliverableRefs: [],
        dimensionResults: [],
        diagnostics: [
          { severity: "error", code: "synthetic_failure", message: secret.toString("base64") },
        ],
      }),
    });
    await expect(harness.run(FIRST_LOOP_SUITE_REF, executionIdentity())).rejects.toThrow(
      "Synthetic leak canary blocked result_commit"
    );
    expect(store.getCardForCaseRun("synthetic-case-run")).toBeUndefined();
  });

  it("blocks provider, tool, and public-writer effects before their callbacks run", () => {
    const secret = randomBytes(32);
    const guard = new EvaluationLeakCanaryGuard(secret, { commitmentKey: randomBytes(32) });
    const provider = vi.fn();
    const tool = vi.fn();
    const writer = vi.fn();

    expect(() =>
      guardedLeakBoundaryEffect(guard, "provider_egress", secret.toString("base64url"), provider)
    ).toThrow("Synthetic leak canary blocked provider_egress");
    expect(() =>
      guardedLeakBoundaryEffect(guard, "tool_payload", { argument: secret }, tool)
    ).toThrow("Synthetic leak canary blocked tool_payload");
    expect(() => guardedLeakBoundaryEffect(guard, "log", secret.toString("hex"), tool)).toThrow(
      "Synthetic leak canary blocked log"
    );
    expect(() => guardedPublicWrite(guard, { cropText: secret.toString("hex") }, writer)).toThrow(
      "Synthetic leak canary blocked public_writer"
    );
    expect(provider).not.toHaveBeenCalled();
    expect(tool).not.toHaveBeenCalled();
    expect(writer).not.toHaveBeenCalled();
    expect(() => guardedPublicWrite(undefined, { safe: true }, writer)).toThrow(
      "Synthetic leak canary guard required"
    );
  });

  it("gives the real evaluation executor guarded fake-provider and tool boundaries", async () => {
    const secret = randomBytes(32);
    const guard = new EvaluationLeakCanaryGuard(secret, { commitmentKey: randomBytes(32) });
    const provider = vi.fn();
    const tool = vi.fn();
    const harness = new EvaluationHarness({
      store: evaluationStore(),
      registry: createFirstLoopRegistry(),
      leakCanaryGuard: guard,
      executeCase: async (_evaluationCase, _manifest, boundaries) => {
        boundaries.guardEffect("tool_payload", { prompt: "safe synthetic prompt" }, tool);
        return boundaries.guardEffect(
          "provider_egress",
          { prompt: secret.toString("base64") },
          provider
        );
      },
    });

    await expect(harness.run(FIRST_LOOP_SUITE_REF, executionIdentity())).rejects.toThrow(
      "Synthetic leak canary blocked provider_egress"
    );
    expect(tool).toHaveBeenCalledOnce();
    expect(provider).not.toHaveBeenCalled();
  });

  it("rejects encoded secrets in repository files without disclosing file paths", () => {
    const secret = randomBytes(32);
    const guard = new EvaluationLeakCanaryGuard(secret, { commitmentKey: randomBytes(32) });
    const root = mkdtempSync(path.join(tmpdir(), "vellum-t71-private-path-"));
    roots.push(root);
    const privatePath = path.join(
      root,
      `owner-private-${secret.toString("hex").slice(0, 32)}.json`
    );
    writeFileSync(privatePath, JSON.stringify({ renamedMetadata: secret.toString("base64url") }));

    let caught: unknown;
    try {
      guard.assertFilesSafe([privatePath]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EvaluationLeakCanaryError);
    expect(String(caught)).not.toContain(privatePath);
    expect(String(caught)).not.toContain(secret.toString("hex"));
  });
});

function evaluationHarness(
  leakCanaryGuard: EvaluationLeakCanaryGuard,
  executeCase: ReturnType<typeof vi.fn>
): EvaluationHarness {
  return new EvaluationHarness({
    store: evaluationStore(),
    registry: createFirstLoopRegistry(),
    leakCanaryGuard,
    executeCase,
  });
}

function evaluationStore(): EvaluationStore {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t71-canary-"));
  roots.push(root);
  return new EvaluationStore({ rootDirectory: root });
}

function executionIdentity() {
  return {
    productVersion: "synthetic-t71",
    runtime: "node-test",
    platform: "test",
    architecture: "test",
    command: "test:t71",
  };
}
