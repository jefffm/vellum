import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  ExternalEvaluationEvidence,
  ModelJudgeAction,
  StochasticEvaluationAggregate,
} from "../../lib/evaluation-domain.js";
import { canonicalJson } from "./evaluation-store.js";

type RecordedOmrFixture = {
  fixtureVersion: number;
  evidenceClass: "recorded_contract";
  backend: { provider: string; version: string };
  expected: { symbols: string[]; voices: string[] };
  observed: { symbols: string[]; voices: string[] };
  limitations: string[];
};

type RecordedModelFixture = {
  fixtureVersion: number;
  evidenceClass: "recorded_contract";
  provider: string;
  model: string;
  prompt: string;
  configuration: { temperature: number; sampleCount: number };
  candidateOrder: string[];
  generatorRelationship: ModelJudgeAction["generatorRelationship"];
  evidenceRefs: ModelJudgeAction["evidenceRefs"];
  samples: StochasticEvaluationAggregate["samples"];
  limitations: string[];
};

export function evaluateRecordedOmrFixture(
  projectRoot = process.cwd()
): ExternalEvaluationEvidence {
  const fixturePath = path.join(projectRoot, "test/fixtures/evaluation/omr-recorded-contract.json");
  const bytes = readFileSync(fixturePath);
  const fixture = JSON.parse(bytes.toString("utf8")) as RecordedOmrFixture;
  const mismatchedSymbols = fixture.expected.symbols.filter(
    (symbol, index) => fixture.observed.symbols[index] !== symbol
  ).length;
  const correctVoices = fixture.expected.voices.filter(
    (voice, index) => fixture.observed.voices[index] === voice
  ).length;
  return {
    id: `external-evidence.${sha256(bytes).slice(0, 24)}`,
    kind: "omr",
    mode: "recorded_contract",
    reproducibility: "deterministic_recorded_fixture",
    provider: fixture.backend.provider,
    modelOrBackend: fixture.backend.version,
    fixtureOrRequestDigest: sha256(bytes),
    compatibility: {
      productVersion: "0.1.0",
      adapterVersion: "omr-contract-v1",
      compatible: true,
      limitations: fixture.limitations,
    },
    observedAt: "2026-01-01T00:00:00.000Z",
    result: {
      evidenceClass: "contract_only",
      symbolErrorRate: mismatchedSymbols / fixture.expected.symbols.length,
      voiceAssignmentAccuracy: correctVoices / fixture.expected.voices.length,
      currentQualityClaim: "not_established",
    },
  };
}

export function evaluateRecordedModelFixture(projectRoot = process.cwd()): {
  evidence: ExternalEvaluationEvidence;
  action: ModelJudgeAction;
  aggregate: StochasticEvaluationAggregate;
} {
  const fixturePath = path.join(
    projectRoot,
    "test/fixtures/evaluation/model-judge-recorded-contract.json"
  );
  const bytes = readFileSync(fixturePath);
  const fixture = JSON.parse(bytes.toString("utf8")) as RecordedModelFixture;
  const digest = sha256(bytes);
  const action: ModelJudgeAction = {
    id: `model-judge-action.${digest.slice(0, 24)}`,
    version: fixture.fixtureVersion,
    provider: fixture.provider,
    model: fixture.model,
    prompt: fixture.prompt,
    configuration: fixture.configuration,
    candidateOrder: fixture.candidateOrder,
    evidenceRefs: fixture.evidenceRefs,
    generatorRelationship: fixture.generatorRelationship,
    uncertainty: { confidence: 0.6, limitations: fixture.limitations },
    output: { samples: fixture.samples },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const aggregate = aggregateStochasticSamples({
    samples: fixture.samples,
    temperature: fixture.configuration.temperature,
    compatibilityLimitations: fixture.limitations,
  });
  return {
    evidence: {
      id: `external-evidence.${digest.slice(0, 24)}`,
      kind: "model_judge",
      mode: "recorded_contract",
      reproducibility: "deterministic_recorded_fixture",
      provider: fixture.provider,
      modelOrBackend: fixture.model,
      fixtureOrRequestDigest: digest,
      compatibility: {
        productVersion: "0.1.0",
        adapterVersion: "model-judge-contract-v1",
        compatible: true,
        limitations: fixture.limitations,
      },
      observedAt: "2026-01-01T00:00:00.000Z",
      result: { evidenceClass: "contract_only", actionId: action.id, aggregate },
    },
    action,
    aggregate,
  };
}

export function aggregateStochasticSamples(input: {
  samples: StochasticEvaluationAggregate["samples"];
  temperature: number;
  compatibilityLimitations: string[];
}): StochasticEvaluationAggregate {
  if (input.samples.length === 0)
    throw new Error("Stochastic aggregation requires retained samples");
  const mean =
    input.samples.reduce((total, sample) => total + sample.measuredValue, 0) / input.samples.length;
  const uncertainty = Math.max(...input.samples.map((sample) => sample.uncertainty));
  const hardFailure = input.samples.some((sample) => sample.hardGateStatus === "fail");
  return {
    sampling: {
      sampleCount: input.samples.length,
      temperature: input.temperature,
      retainedOutputs: true,
    },
    samples: input.samples,
    deterministicGateStatus: hardFailure ? "fail" : "pass",
    stochasticStatus: hardFailure ? "fail" : uncertainty >= 0.5 ? "inconclusive" : "pass",
    mean,
    uncertainty,
    compatibilityLimitations: input.compatibilityLimitations,
  };
}

export function modelJudgePresentation(
  action: ModelJudgeAction,
  dimension: "fidelity" | "history" | "musical_quality" | "physical_playability" | "advisory"
): "observation_only" | "measured_evidence" {
  if (dimension !== "advisory") return "observation_only";
  return action.generatorRelationship === "independent_judge"
    ? "measured_evidence"
    : "observation_only";
}

export function createLiveExternalEvidence(input: {
  enabled: boolean;
  kind: "omr" | "model_judge";
  provider: string;
  modelOrBackend: string;
  request: unknown;
  result: unknown;
  now: Date;
  staleAfter: Date;
  limitations: string[];
}): ExternalEvaluationEvidence {
  if (!input.enabled) {
    throw new Error("Live external evaluation requires an explicit opt-in flag");
  }
  return {
    id: `external-evidence.${sha256(Buffer.from(canonicalJson(input))).slice(0, 24)}`,
    kind: input.kind,
    mode: "live_current",
    reproducibility: "external_not_reproducible",
    provider: input.provider,
    modelOrBackend: input.modelOrBackend,
    fixtureOrRequestDigest: sha256(Buffer.from(canonicalJson(input.request))),
    compatibility: {
      productVersion: "0.1.0",
      adapterVersion: "live-external-v1",
      compatible: true,
      limitations: input.limitations,
    },
    observedAt: input.now.toISOString(),
    staleAfter: input.staleAfter.toISOString(),
    result: input.result,
  };
}

export function runGeneratorInputInIsolatedProcess(input: unknown): {
  digest: string;
  output: string;
} {
  const program = [
    "const fs=require('node:fs'),crypto=require('node:crypto');",
    "const input=fs.readFileSync(0,'utf8');",
    "process.stdout.write(JSON.stringify({digest:crypto.createHash('sha256').update(input).digest('hex'),input:JSON.parse(input)}));",
  ].join("");
  const child = spawnSync(process.execPath, ["-e", program], {
    input: canonicalJson(input),
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", LANG: "C", LC_ALL: "C" },
  });
  if (child.status !== 0) throw new Error(child.stderr || "Isolated evaluator failed");
  return { digest: sha256(Buffer.from(child.stdout)), output: child.stdout };
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
