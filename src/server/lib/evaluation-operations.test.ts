import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvaluationArtifactStore } from "./evaluation-artifact-store.js";
import { ALL_EVALUATION_SUITES, selectEvaluationSuites } from "./evaluation-impact.js";
import { EvaluationStore } from "./evaluation-store.js";
import { buildEvaluationRunReport } from "./evaluation-run-report.js";
import { createLiveExternalEvidence } from "./external-evaluation.js";
import { runFirstLoopEvaluation } from "./first-loop-evaluation.js";

vi.mock("../../lib/tracked-source-quarantine.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/tracked-source-quarantine.js")>();
  return {
    ...actual,
    authorizeTrackedSourceOperation: (
      request: Parameters<typeof actual.authorizeTrackedSourceOperation>[0]
    ) => {
      if (
        request.artifactId === "fixture.substitution-source" &&
        request.sha256 === "a".repeat(64) &&
        request.operation === "report" &&
        request.substitutionId === "substitution.test.exact"
      ) {
        return {
          outcome: "allow" as const,
          artifactId: request.artifactId,
          artifactSha256: request.sha256,
          resolvedArtifactId: "fixture.substitution-target",
          resolvedSha256: "b".repeat(64),
          operation: request.operation,
          decisionId: "decision.substitution.test",
          substitutionId: request.substitutionId,
          provenanceEvidenceRefs: ["provenance.substitution.test"],
          reasons: [],
        };
      }
      return actual.authorizeTrackedSourceOperation(request);
    },
  };
});

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
        artifactKind: "fixture",
        ownerRecordId: "fixture.unlicensed",
        retentionClass: "ordinary",
        expiresAt: "2026-07-11T00:00:00.000Z",
      })
    ).toThrow(/explicit operation-scoped rights decision/);
    const content = Buffer.from("identical evaluation bytes");
    const first = store.put(content, {
      mediaType: "application/json",
      artifactKind: "internal",
      ownerRecordId: "run.1",
      retentionClass: "ordinary",
      expiresAt: "2026-07-11T00:00:00.000Z",
      license: "Public Domain",
    });
    const second = store.put(content, {
      mediaType: "application/json",
      artifactKind: "internal",
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
    expect(store.readInternal(first.id)).toEqual(content);
    expect(() => store.readForOperation(first.id, "report")).toThrow(/not authorized/);
    expect(() => store.readForOperation(first.id, "export")).toThrow(/not authorized/);
    store.invalidateBaseline("baseline.1");
    expect(store.collect()).toEqual([first.id]);
    expect(existsSync(path.join(root, "blobs", first.sha256))).toBe(false);

    const canary = Buffer.from("PRIVATE_WORKSPACE_CANARY_91b7");
    const privateArtifact = store.put(canary, {
      mediaType: "text/plain",
      artifactKind: "internal",
      ownerRecordId: "run.private",
      retentionClass: "ordinary",
      expiresAt: "2027-01-01T00:00:00.000Z",
      privateWorkspaceId: "workspace.private",
    });
    store.put(canary, {
      mediaType: "text/plain",
      artifactKind: "internal",
      ownerRecordId: "run.linked-copy",
      retentionClass: "ordinary",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
    expect(store.deletePrivateWorkspace("workspace.private")).toEqual([privateArtifact.id]);
    expect(() => store.readInternal(privateArtifact.id)).toThrow(/not found/);
    expect(existsSync(path.join(root, "blobs", privateArtifact.sha256))).toBe(false);
  });

  it("requires exact operation-scoped authorization for fixtures, reports, and exports", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-evaluation-rights-"));
    roots.push(root);
    const fixtureSha256 = "187caee2fa16c81d9ce8f71f47e928f2276ad81d98bb38ba2d06adfbeee45a4e";
    const fixtureSource = {
      artifactId: "fixture.greensleeves-satb",
      sha256: fixtureSha256,
    };
    const store = new EvaluationArtifactStore(root, () => new Date("2026-07-10T00:00:00.000Z"));

    expect(() =>
      store.put(Buffer.from("a license label is not authority"), {
        mediaType: "text/plain",
        artifactKind: "fixture",
        ownerRecordId: "fixture.license-only",
        retentionClass: "ordinary",
        expiresAt: "2026-07-11T00:00:00.000Z",
        license: "Public Domain",
      })
    ).toThrow(/explicit operation-scoped rights decision/);

    expect(() =>
      store.put(Buffer.from("wrong operation"), {
        mediaType: "text/plain",
        artifactKind: "report",
        ownerRecordId: "report.wrong-operation",
        retentionClass: "ordinary",
        expiresAt: "2026-07-11T00:00:00.000Z",
        rights: { operation: "fixture", sources: [fixtureSource] },
      })
    ).toThrow(/cannot use a fixture rights decision/);

    expect(() =>
      store.put(Buffer.from("canonical report id without decision"), {
        mediaType: "text/plain",
        artifactKind: "report",
        ownerRecordId: "evaluation-report.missing-rights",
        retentionClass: "ordinary",
        expiresAt: "2026-07-11T00:00:00.000Z",
      })
    ).toThrow(/explicit operation-scoped rights decision/);

    for (const [artifactId, operation, outcome] of [
      ["fixture.unknown", "export", "review_required"],
      ["fixture.local-only", "fixture", "review_required"],
      ["fixture.conflicting", "report", "review_required"],
    ] as const) {
      expect(() =>
        store.put(Buffer.from(`${artifactId}:${operation}`), {
          mediaType: "text/plain",
          artifactKind: operation,
          ownerRecordId: `${operation}.denied-${artifactId}`,
          retentionClass: "ordinary",
          expiresAt: "2026-07-11T00:00:00.000Z",
          rights: { operation, sources: [{ artifactId, sha256: "a".repeat(64) }] },
          license: "CC0-1.0",
        })
      ).toThrow(new RegExp(`not authorized for ${operation}: ${outcome}`));
    }

    const callbackBypass = new (EvaluationArtifactStore as unknown as new (
      rootDirectory: string,
      now: () => Date,
      ignoredAuthorizer: () => unknown
    ) => EvaluationArtifactStore)(
      root,
      () => new Date("2026-07-10T00:00:00.000Z"),
      () => ({ outcome: "allow" })
    );
    expect(() =>
      callbackBypass.put(Buffer.from("callback injection is ignored"), {
        mediaType: "text/plain",
        artifactKind: "export",
        ownerRecordId: "arbitrary",
        retentionClass: "ordinary",
        expiresAt: "2026-07-11T00:00:00.000Z",
        rights: {
          operation: "export",
          sources: [{ artifactId: "fixture.unknown", sha256: "a".repeat(64) }],
        },
      })
    ).toThrow(/not authorized for export: review_required/);

    const fixture = store.put(Buffer.from("authorized fixture"), {
      mediaType: "text/plain",
      artifactKind: "fixture",
      ownerRecordId: "run.owner-id-does-not-imply-kind",
      retentionClass: "ordinary",
      expiresAt: "2026-07-11T00:00:00.000Z",
      rights: { operation: "fixture", sources: [fixtureSource] },
    });
    expect(fixture.references[0]).toMatchObject({
      artifactKind: "fixture",
      rights: {
        operation: "fixture",
        sources: [
          {
            ...fixtureSource,
            resolvedArtifactId: "fixture.greensleeves-satb",
            resolvedSha256: fixtureSha256,
            decisionId: "decision.greensleeves.fixture.allow",
            provenanceEvidenceRefs: expect.arrayContaining([
              "test/fixtures/greensleeves/PROVENANCE.md",
            ]),
          },
        ],
      },
    });
    expect(store.readForOperation(fixture.id, "fixture")).toEqual(
      Buffer.from("authorized fixture")
    );
    expect(() => store.readForOperation(fixture.id, "report")).toThrow(/not authorized/);
    store.pinBaseline("baseline.fixture", [fixture.id]);
    expect(() => store.readInternal(fixture.id)).toThrow(/not authorized/);
    expect(store.readForOperation(fixture.id, "fixture")).toEqual(
      Buffer.from("authorized fixture")
    );

    expect(() =>
      store.put(Buffer.from("internal cannot smuggle rights"), {
        mediaType: "text/plain",
        artifactKind: "internal",
        ownerRecordId: "fixture.misleading-owner-id",
        retentionClass: "ordinary",
        expiresAt: "2026-07-11T00:00:00.000Z",
        rights: { operation: "fixture", sources: [fixtureSource] },
      })
    ).toThrow(/Internal Evaluation Artifact cannot carry/);

    const internalWithMisleadingOwner = store.put(Buffer.from("owner id is not policy"), {
      mediaType: "text/plain",
      artifactKind: "internal",
      ownerRecordId: "report.this-name-grants-nothing",
      retentionClass: "ordinary",
      expiresAt: "2026-07-11T00:00:00.000Z",
    });
    expect(store.readInternal(internalWithMisleadingOwner.id)).toEqual(
      Buffer.from("owner id is not policy")
    );
    expect(() => store.readForOperation(internalWithMisleadingOwner.id, "report")).toThrow(
      /not authorized/
    );

    const substituted = store.put(Buffer.from("authorized substituted report"), {
      mediaType: "text/plain",
      artifactKind: "report",
      ownerRecordId: "arbitrary.owner-record",
      retentionClass: "ordinary",
      expiresAt: "2026-07-11T00:00:00.000Z",
      rights: {
        operation: "report",
        sources: [
          {
            artifactId: "fixture.substitution-source",
            sha256: "a".repeat(64),
            substitutionId: "substitution.test.exact",
          },
        ],
      },
    });
    expect(substituted.references[0]!.rights!.sources[0]).toMatchObject({
      artifactId: "fixture.substitution-source",
      sha256: "a".repeat(64),
      substitutionId: "substitution.test.exact",
      resolvedArtifactId: "fixture.substitution-target",
      resolvedSha256: "b".repeat(64),
      decisionId: "decision.substitution.test",
    });
    expect(store.readForOperation(substituted.id, "report")).toEqual(
      Buffer.from("authorized substituted report")
    );
    expect(() =>
      store.put(Buffer.from("wrong substitution"), {
        mediaType: "text/plain",
        artifactKind: "report",
        ownerRecordId: "arbitrary.owner-record",
        retentionClass: "ordinary",
        expiresAt: "2026-07-11T00:00:00.000Z",
        rights: {
          operation: "report",
          sources: [
            {
              artifactId: "fixture.substitution-source",
              sha256: "a".repeat(64),
              substitutionId: "substitution.test.forged",
            },
          ],
        },
      })
    ).toThrow(/not authorized for report/);
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
