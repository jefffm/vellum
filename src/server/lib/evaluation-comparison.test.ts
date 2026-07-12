import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compareEvaluationRef,
  compareEvaluationRefLists,
  EvaluationComparisonService,
} from "./evaluation-comparison.js";
import { digestValue } from "./evaluation-harness.js";
import { EvaluationStore } from "./evaluation-store.js";
import { FIRST_LOOP_COMPARISON_POLICY, runFirstLoopEvaluation } from "./first-loop-evaluation.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Evaluation baseline, mutation comparison, and report", () => {
  it("classifies exact, migrated, changed-semantic, and incomparable identities", () => {
    const exact = { id: "case.a", version: 1, digest: "a".repeat(64) };
    const changed = { ...exact, digest: "b".repeat(64) };
    const different = { id: "case.b", version: 2, digest: "c".repeat(64) };
    const mapping = { id: "migration.a-b", version: 1, digest: "d".repeat(64) };
    expect(compareEvaluationRef(exact, exact, "case").status).toBe("compatible");
    expect(compareEvaluationRef(exact, changed, "case").status).toBe("changed_semantics");
    expect(compareEvaluationRef(exact, different, "case").status).toBe("incomparable");
    expect(compareEvaluationRef(exact, different, "case", mapping)).toEqual({
      status: "migrated",
      migrationRef: mapping,
      rationale: expect.stringMatching(/reviewed migration/i),
    });
    expect(compareEvaluationRefLists([exact], [], "evaluator").status).toBe("incomparable");
    expect(compareEvaluationRefLists([exact], [], "evaluator", mapping).status).toBe("migrated");
  });

  it("retains known defects and detects a Principal Voice omission without hiding unknowns", async () => {
    const root = temporaryRoot();
    let nextId = 0;
    const createId = () => `20000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
    const now = () => new Date("2026-07-12T14:00:00.000Z");
    const clean = await runFirstLoopEvaluation({ evaluationRoot: root, createId, now });
    const mutated = await runFirstLoopEvaluation({
      evaluationRoot: root,
      createId,
      now,
      mutationId: "mutation.principal-voice-omission",
    });
    const store = new EvaluationStore({ rootDirectory: root });
    const service = new EvaluationComparisonService({ store, createId, now });
    const baseline = service.promoteBaseline({
      evaluationRunId: clean.runId,
      comparisonScope: { kind: "passage", ids: ["greensleeves.complete"] },
      knownDefects: clean.cards.flatMap((card) =>
        card.dimensions
          .filter(
            (dimension) =>
              dimension.absoluteOutcome === "unknown" || dimension.completeness !== "complete"
          )
          .map((dimension) => ({
            id: `known-defect.${dimension.dimensionId}`,
            dimensionId: dimension.dimensionId,
            scope: dimension.scope,
            description:
              dimension.dimensionId === "engraving_and_notation"
                ? '<img src=x onerror="steal()"> Reviewed evidence remains missing.'
                : (dimension.observations[0]?.message ?? "Evidence remains incomplete."),
            evidenceRefs: [{ id: card.id, version: 1, digest: digestValue(card) }],
            acceptedTradeoff: "Keep the unknown explicit in this development baseline.",
          }))
      ),
      promotedBy: {
        id: "reviewer.fixture-author",
        role: "baseline_reviewer",
        displayName: "Fixture author",
      },
      rationale: "Retain current behavior and every disclosed unknown.",
    });
    expect(baseline).toMatchObject({
      evaluationRunId: clean.runId,
      manifestId: clean.manifestId,
    });
    expect(baseline.knownDefects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "known-defect.mechanical_and_technique_evidence" }),
      ])
    );
    expect(store.getBaseline(baseline.id)).toEqual(baseline);

    const replacement = service.promoteBaseline({
      evaluationRunId: clean.runId,
      comparisonScope: baseline.comparisonScope,
      knownDefects: baseline.knownDefects,
      promotedBy: baseline.promotedBy,
      rationale: "A distinct promotion record preserves history.",
      supersedesBaselineId: baseline.id,
    });
    expect(replacement.id).not.toBe(baseline.id);
    expect(store.getBaseline(baseline.id)).toEqual(baseline);

    const comparison = service.compare({
      baselineId: baseline.id,
      proposedRunId: mutated.runId,
      policy: FIRST_LOOP_COMPARISON_POLICY,
      attribution: "intentional_design",
    });
    expect(comparison).toMatchObject({
      suiteCompatibility: { status: "compatible" },
      evaluatorCompatibility: { status: "compatible" },
      caseAlignment: [{ compatibility: { status: "compatible" } }],
      reviewStatus: "unreviewed",
      classifications: expect.arrayContaining(["hard_regression", "intentional_difference"]),
      attributions: ["intentional_design"],
    });
    expect(
      comparison.dimensionDeltas.find(
        (delta) => delta.dimensionId === "preservation_and_transformation"
      )
    ).toMatchObject({
      comparability: "comparable",
      direction: "regressed",
      materiality: "material",
    });
    expect(
      comparison.dimensionDeltas.find((delta) => delta.dimensionId === "engraving_and_notation")
    ).toMatchObject({ direction: "unknown", materiality: "undetermined" });
    const mutatedCard = mutated.cards[0]!;
    expect(mutatedCard).toMatchObject({ hardGateStatus: "fail", acceptanceStatus: "fail" });

    const report = service.renderReport({ comparisonId: comparison.id });
    expect(report.cardRefs).toHaveLength(2);
    expect(report.musicalScopes).toContainEqual(baseline.comparisonScope);
    expect(report.artifactRefs.length).toBeGreaterThan(0);
    expect(report.reviewNeeds).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/baseline defect/i),
        expect.stringMatching(/hard regression/i),
        expect.stringMatching(/missing comparative evidence/i),
      ])
    );
    expect(report.sanitizedMarkup).not.toMatch(/<img|<script/i);
    expect(report.sanitizedMarkup).toContain("&lt;img");
    expect(report.sanitizedMarkup).toContain("hard regression");
    expect(store.getReport(report.id)).toEqual(report);
  });

  it("rejects unresolved runs and a policy that is not pinned by the proposed manifest", async () => {
    const root = temporaryRoot();
    const store = new EvaluationStore({ rootDirectory: root });
    const service = new EvaluationComparisonService({ store });
    store.saveRun({
      id: "evaluation-run.running",
      manifestId: "evaluation-manifest.missing",
      executionStatus: "running",
      caseRunIds: [],
      startedAt: "2026-07-12T14:00:00.000Z",
    });
    expect(() =>
      service.promoteBaseline({
        evaluationRunId: "evaluation-run.running",
        comparisonScope: { kind: "case", ids: ["case.test"] },
        knownDefects: [],
        promotedBy: { id: "reviewer.test", role: "baseline_reviewer", displayName: "Test" },
        rationale: "This must fail because the Run is unresolved.",
      })
    ).toThrow(/completed/);

    const clean = await runFirstLoopEvaluation({ evaluationRoot: root });
    expect(() =>
      service.promoteBaseline({
        evaluationRunId: clean.runId,
        comparisonScope: { kind: "case", ids: ["case.greensleeves-first-loop"] },
        knownDefects: [],
        promotedBy: { id: "reviewer.test", role: "baseline_reviewer", displayName: "Test" },
        rationale: "This must fail because known gaps were not disclosed.",
      })
    ).toThrow(/omits known defects/);
    const baseline = new EvaluationComparisonService({ store }).promoteBaseline({
      evaluationRunId: clean.runId,
      comparisonScope: { kind: "case", ids: ["case.greensleeves-first-loop"] },
      knownDefects: clean.cards.flatMap((card) =>
        card.dimensions
          .filter(
            (dimension) =>
              dimension.absoluteOutcome === "unknown" || dimension.completeness !== "complete"
          )
          .map((dimension) => ({
            id: `known-defect.${dimension.dimensionId}`,
            dimensionId: dimension.dimensionId,
            scope: dimension.scope,
            description: "Evidence remains incomplete.",
            evidenceRefs: [{ id: card.id, version: 1, digest: digestValue(card) }],
            acceptedTradeoff: "Retain this disclosed gap for the fixture comparison.",
          }))
      ),
      promotedBy: { id: "reviewer.test", role: "baseline_reviewer", displayName: "Test" },
      rationale: "Valid fixture promotion.",
    });
    expect(() =>
      service.compare({
        baselineId: baseline.id,
        proposedRunId: clean.runId,
        policy: { ...FIRST_LOOP_COMPARISON_POLICY, minimumEvidenceRefs: 999 },
      })
    ).toThrow(/Policy/);
  });
});

function temporaryRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-evaluation-comparison-"));
  roots.push(root);
  return root;
}
