import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EvaluationStore } from "./evaluation-store.js";
import { runContinuoEvaluation } from "./continuo-evaluation.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("contextual continuo shared evaluation loop", () => {
  it("evaluates complete, separate-bass, and honest-reduction Plans without flattening state", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-continuo-eval-store-"));
    roots.push(root);
    const result = await runContinuoEvaluation({ evaluationRoot: root });

    expect(result.cases.map(({ disposition }) => disposition)).toEqual([
      "complete_realization",
      "separate_bass_realization",
      "continuo_reduction",
    ]);
    expect(result.cases.map(({ planFoundationDisposition }) => planFoundationDisposition)).toEqual([
      "complete",
      "separate_bass",
      "reduced",
    ]);
    expect(result.cases[0]!.candidateStrategies).toEqual([
      "complete-realization",
      "lean-realization",
    ]);
    expect(result.cases[1]!.candidateStrategies).toEqual([
      "separate-bass-realization",
      "continuo-reduction",
    ]);
    expect(result.cases[2]!.candidateStrategies).toEqual(["continuo-reduction"]);
    expect(result.cases.every(({ auditStatus }) => auditStatus === "pass")).toBe(true);
    expect(result.cases.every(({ generatedVoiceEventCount }) => generatedVoiceEventCount > 0)).toBe(
      true
    );
    expect(result.cases[0]!.foundationEventCount).toBeGreaterThan(0);
    expect(result.cases[1]!.foundationEventCount).toBeGreaterThan(0);
    expect(result.cases[2]!.foundationEventCount).toBe(0);
    expect(
      result.cases.slice(0, 2).every(({ preparedResolutionAccepted }) => preparedResolutionAccepted)
    ).toBe(true);
    expect(result.cases[2]!.preparedResolutionAccepted).toBe(false);
    expect(
      result.cases.every(({ positionStateUsedAsDomainTruth }) => !positionStateUsedAsDomainTruth)
    ).toBe(true);

    expect(result.cards).toHaveLength(3);
    for (const card of result.cards) {
      expect(card).toMatchObject({ hardGateStatus: "pass", acceptanceStatus: "incomplete" });
      expect(card.dimensions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ dimensionId: "source_authority", absoluteOutcome: "pass" }),
          expect.objectContaining({
            dimensionId: "preservation_and_transformation",
            absoluteOutcome: "pass",
          }),
          expect.objectContaining({
            dimensionId: "arrangement_plan_realization",
            absoluteOutcome: "pass",
          }),
          expect.objectContaining({
            dimensionId: "playback_and_performed_form",
            absoluteOutcome: "pass",
          }),
          expect.objectContaining({
            dimensionId: "historical_and_analytical_evidence",
            absoluteOutcome: "unknown",
          }),
        ])
      );
    }
    const store = new EvaluationStore({ rootDirectory: root });
    for (const caseRunId of store.getRun(result.runId).caseRunIds) {
      expect(store.getCaseRun(caseRunId).diagnostics).toContainEqual(
        expect.objectContaining({
          code: "continuo.contextual_state",
          message: expect.stringMatching(/bass, figure, harmonic context, voice-leading/i),
        })
      );
    }
  });
});
