import { describe, expect, it } from "vitest";
import {
  aggregateStochasticSamples,
  createLiveExternalEvidence,
  evaluateRecordedModelFixture,
  evaluateRecordedOmrFixture,
  modelJudgePresentation,
  runGeneratorInputInIsolatedProcess,
} from "./external-evaluation.js";

describe("OMR and model evaluation isolation", () => {
  it("runs retained OMR and provider fixtures deterministically as contract evidence only", () => {
    const firstOmr = evaluateRecordedOmrFixture();
    expect(evaluateRecordedOmrFixture()).toEqual(firstOmr);
    expect(firstOmr).toMatchObject({
      kind: "omr",
      mode: "recorded_contract",
      reproducibility: "deterministic_recorded_fixture",
      result: { evidenceClass: "contract_only", currentQualityClaim: "not_established" },
    });
    const firstModel = evaluateRecordedModelFixture();
    expect(evaluateRecordedModelFixture()).toEqual(firstModel);
    expect(firstModel.action).toMatchObject({
      provider: "recorded-provider",
      model: "recorded-judge-v1",
      prompt: expect.any(String),
      configuration: { temperature: 0.2, sampleCount: 2 },
      candidateOrder: ["candidate.a", "candidate.b"],
      evidenceRefs: [expect.any(Object)],
      generatorRelationship: "same_model_self_evaluation",
      uncertainty: { confidence: 0.6, limitations: expect.any(Array) },
    });
    expect(modelJudgePresentation(firstModel.action, "physical_playability")).toBe(
      "observation_only"
    );
  });

  it("keeps one retained hard failure visible despite a favorable stochastic mean", () => {
    const aggregate = aggregateStochasticSamples({
      samples: [
        { id: "sample.pass-1", hardGateStatus: "pass", measuredValue: 0.99, uncertainty: 0.1 },
        { id: "sample.fail", hardGateStatus: "fail", measuredValue: 0.95, uncertainty: 0.2 },
        { id: "sample.pass-2", hardGateStatus: "pass", measuredValue: 0.98, uncertainty: 0.1 },
      ],
      temperature: 0.7,
      compatibilityLimitations: ["Recorded stochastic samples only"],
    });
    expect(aggregate).toMatchObject({
      deterministicGateStatus: "fail",
      stochasticStatus: "fail",
      sampling: { sampleCount: 3, retainedOutputs: true },
      samples: expect.arrayContaining([expect.objectContaining({ id: "sample.fail" })]),
    });
    expect(aggregate.mean).toBeGreaterThan(0.9);
  });

  it("requires explicit live opt-in and labels dated evidence non-reproducible", () => {
    const input = {
      enabled: false,
      kind: "omr" as const,
      provider: "Audiveris",
      modelOrBackend: "live",
      request: { source: "explicit" },
      result: { status: "observed" },
      now: new Date("2026-07-10T20:00:00.000Z"),
      staleAfter: new Date("2026-08-10T20:00:00.000Z"),
      limitations: ["External environment"],
    };
    expect(() => createLiveExternalEvidence(input)).toThrow(/explicit opt-in/);
    expect(createLiveExternalEvidence({ ...input, enabled: true })).toMatchObject({
      mode: "live_current",
      reproducibility: "external_not_reproducible",
      observedAt: "2026-07-10T20:00:00.000Z",
      staleAfter: "2026-08-10T20:00:00.000Z",
    });
  });

  it("does not expose a held-out canary to the isolated generator/fitting process", () => {
    const canary = "HELD_OUT_EXPECTATION_CANARY_7f3d";
    process.env.VELLUM_HELD_OUT_CANARY = canary;
    try {
      const result = runGeneratorInputInIsolatedProcess({
        source: "generator-visible-source-only",
        brief: "generator-visible-brief-only",
      });
      expect(result.output).not.toContain(canary);
      expect(result.output).not.toContain("VELLUM_HELD_OUT_CANARY");
    } finally {
      delete process.env.VELLUM_HELD_OUT_CANARY;
    }
  });
});
