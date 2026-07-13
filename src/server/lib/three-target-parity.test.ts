import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EvaluationStore } from "./evaluation-store.js";
import { runThreeTargetParityEvaluation } from "./three-target-parity.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("initial three-target parity candidate", () => {
  it("shares source truth and family planning while independently searching and projecting", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-three-target-parity-eval-"));
    roots.push(root);
    const result = await runThreeTargetParityEvaluation({ evaluationRoot: root });

    expect(result.targets.map(({ instrumentId }) => instrumentId).sort()).toEqual([
      "baroque-guitar-5",
      "baroque-lute-13",
      "classical-guitar-6",
    ]);
    expect(new Set(result.targets.map(({ analysisRecordId }) => analysisRecordId)).size).toBe(1);
    expect(new Set(result.targets.map(({ normalizedScoreId }) => normalizedScoreId)).size).toBe(1);
    expect(new Set(result.targets.map(({ sourceDigest }) => sourceDigest)).size).toBe(1);
    expect(new Set(result.targets.map(({ arrangementFamilyId }) => arrangementFamilyId)).size).toBe(
      1
    );
    expect(new Set(result.targets.map(({ arrangementId }) => arrangementId)).size).toBe(3);
    expect(new Set(result.targets.map(({ searchId }) => searchId)).size).toBe(3);
    expect(new Set(result.targets.map(({ planId }) => planId)).size).toBe(3);
    expect(result.targets[1]!.portableFamilyDecisionKeys).toEqual(
      result.targets[0]!.portableFamilyDecisionKeys
    );
    expect(result.targets[2]!.portableFamilyDecisionKeys).toEqual(
      result.targets[0]!.portableFamilyDecisionKeys
    );
    expect(result.targets.map(({ notationLayout }) => notationLayout)).toEqual([
      "french-letter-tablature",
      "french-letter-tablature",
      "standard-notation",
    ]);
    for (const target of result.targets) {
      expect(target.deliverableIds).toHaveLength(5);
      expect(target.candidateCount).toBeGreaterThan(1);
      expect(target.comparisonMethod).toBe("policy_lexicographic");
      expect(target).toMatchObject({
        physicalEvidence: "awaiting_human",
        specialistEvidence: "awaiting_human",
      });
    }

    expect(result.cards).toHaveLength(3);
    for (const card of result.cards) {
      expect(card).toMatchObject({ hardGateStatus: "pass", acceptanceStatus: "incomplete" });
      expect(card).not.toHaveProperty("overallGrade");
      expect(card.dimensions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ dimensionId: "source_authority", absoluteOutcome: "pass" }),
          expect.objectContaining({
            dimensionId: "arrangement_plan_realization",
            absoluteOutcome: "pass",
          }),
          expect.objectContaining({
            dimensionId: "engraving_and_notation",
            absoluteOutcome: "pass",
          }),
          expect.objectContaining({
            dimensionId: "playback_and_performed_form",
            absoluteOutcome: "pass",
          }),
          expect.objectContaining({
            dimensionId: "human_and_physical_evidence",
            absoluteOutcome: "unknown",
          }),
          expect.objectContaining({
            dimensionId: "explicit_owner_usefulness",
            absoluteOutcome: "unknown",
          }),
        ])
      );
    }

    const store = new EvaluationStore({ rootDirectory: root });
    const run = store.getRun(result.runId);
    expect(run.caseRunIds).toHaveLength(3);
    for (const caseRunId of run.caseRunIds) {
      const caseRun = store.getCaseRun(caseRunId);
      expect(caseRun.deliverableRefs).toHaveLength(5);
      expect(caseRun.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "three_target.independent_search",
          severity: "info",
          message: expect.stringMatching(/lexicographically evaluated candidate/i),
        })
      );
      expect(JSON.stringify(caseRun)).not.toMatch(/first[-_ ]fit|proxy[-_ ]labeled/i);
    }
  }, 120_000);
});
