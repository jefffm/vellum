import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EvaluationArtifactStore } from "./evaluation-artifact-store.js";
import { ALL_EVALUATION_SUITES, selectEvaluationSuites } from "./evaluation-impact.js";
import { EvaluationStore } from "./evaluation-store.js";
import { buildEvaluationRunReport } from "./evaluation-run-report.js";
import { createLiveExternalEvidence } from "./external-evaluation.js";
import { runFirstLoopEvaluation } from "./first-loop-evaluation.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("evaluation retention and CI impact", () => {
  it("deduplicates bytes, honors retention boundaries and pins, and deletes private canaries", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-evaluation-artifacts-"));
    roots.push(root);
    let now = new Date("2026-07-10T00:00:00.000Z");
    const store = new EvaluationArtifactStore(root, () => now);
    expect(() =>
      store.put(Buffer.from("fixture without rights"), {
        mediaType: "text/plain",
        ownerRecordId: "fixture.unlicensed",
        retentionClass: "ordinary",
        expiresAt: "2026-07-11T00:00:00.000Z",
      })
    ).toThrow(/license provenance/);
    const content = Buffer.from("identical evaluation bytes");
    const first = store.put(content, {
      mediaType: "application/json",
      ownerRecordId: "run.1",
      retentionClass: "ordinary",
      expiresAt: "2026-07-11T00:00:00.000Z",
      license: "Public Domain",
    });
    const second = store.put(content, {
      mediaType: "application/json",
      ownerRecordId: "run.2",
      retentionClass: "ephemeral",
      expiresAt: "2026-07-10T12:00:00.000Z",
      license: "Public Domain",
    });
    expect(second.id).toBe(first.id);
    expect(store.get(first.id).references).toHaveLength(2);
    expect(existsSync(path.join(root, "blobs", first.sha256))).toBe(true);
    store.pinBaseline("baseline.1", [first.id]);
    now = new Date("2026-07-12T00:00:00.000Z");
    expect(store.collect()).toEqual([]);
    expect(store.read(first.id)).toEqual(content);
    store.invalidateBaseline("baseline.1");
    expect(store.collect()).toEqual([first.id]);
    expect(existsSync(path.join(root, "blobs", first.sha256))).toBe(false);

    const canary = Buffer.from("PRIVATE_WORKSPACE_CANARY_91b7");
    const privateArtifact = store.put(canary, {
      mediaType: "text/plain",
      ownerRecordId: "report.private",
      retentionClass: "ordinary",
      expiresAt: "2027-01-01T00:00:00.000Z",
      privateWorkspaceId: "workspace.private",
    });
    store.put(canary, {
      mediaType: "text/plain",
      ownerRecordId: "report.linked-copy",
      retentionClass: "ordinary",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
    expect(store.deletePrivateWorkspace("workspace.private")).toEqual([privateArtifact.id]);
    expect(() => store.read(privateArtifact.id)).toThrow(/not found/);
    expect(existsSync(path.join(root, "blobs", privateArtifact.sha256))).toBe(false);
  });

  it("selects representative suites and falls back broadly for unknown or dynamic impact", () => {
    expect(selectEvaluationSuites(["src/lib/audio-preview.ts"])).toMatchObject({
      suites: ["fast", "golden", "playback"],
      broadFallback: false,
      disclaimer: expect.stringMatching(/does not prove.*irrelevant/i),
    });
    expect(selectEvaluationSuites(["src/plugins/dynamic-registry.ts"])).toMatchObject({
      suites: [...ALL_EVALUATION_SUITES],
      broadFallback: true,
    });
    expect(selectEvaluationSuites(["unknown/new-capability.ts"])).toMatchObject({
      suites: [...ALL_EVALUATION_SUITES],
      broadFallback: true,
    });
  });

  it("reports external evidence compatibility and clock-derived staleness separately", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-evaluation-report-"));
    roots.push(root);
    const run = await runFirstLoopEvaluation({ evaluationRoot: root });
    const store = new EvaluationStore({ rootDirectory: root });
    store.saveExternalEvaluationEvidence(
      createLiveExternalEvidence({
        enabled: true,
        kind: "omr",
        provider: "Audiveris",
        modelOrBackend: "live-reviewed",
        request: { fixture: "reviewed" },
        result: { reviewed: true },
        now: new Date("2026-06-01T00:00:00.000Z"),
        staleAfter: new Date("2026-07-01T00:00:00.000Z"),
        limitations: ["Reviewed external environment"],
      })
    );
    expect(
      buildEvaluationRunReport(store, run.runId, new Date("2026-07-12T00:00:00.000Z"))
    ).toMatchObject({
      externalEvidence: {
        status: "reported_separately",
        items: [
          {
            observedAt: "2026-06-01T00:00:00.000Z",
            compatible: true,
            stale: true,
            reproducibility: "external_not_reproducible",
          },
        ],
      },
      disclaimer: expect.stringMatching(/never inferred from offline CI success/i),
    });
  });

  it("confines evaluation writes to the configured evaluation root", async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), "vellum-evaluation-isolation-"));
    roots.push(workspace);
    const productState = path.join(workspace, "canonical-product-state.json");
    const original = '{"defaultProfile":"owner-reviewed"}\n';
    writeFileSync(productState, original);

    await runFirstLoopEvaluation({ evaluationRoot: path.join(workspace, ".evaluation-output") });

    expect(readFileSync(productState, "utf8")).toBe(original);
    expect(existsSync(path.join(workspace, ".evaluation-output", "runs"))).toBe(true);
  });
});
