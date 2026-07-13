import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { EvaluationStore } from "./lib/evaluation-store.js";
import {
  createLiveExternalEvidence,
  evaluateRecordedModelFixture,
  evaluateRecordedOmrFixture,
} from "./lib/external-evaluation.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const kind = value(args, "--kind");
  if (kind !== "omr" && kind !== "model") throw new Error("--kind must be omr or model");
  const live = args.includes("--live");
  const output = value(args, "--output");
  const store = new EvaluationStore({
    rootDirectory: output ? path.join(output, "store") : undefined,
  });
  let result: unknown;
  if (live) {
    if (process.env.VELLUM_EVAL_LIVE !== "1") {
      throw new Error(
        "Live evaluation requires VELLUM_EVAL_LIVE=1 and is never an offline default"
      );
    }
    if (!process.env.VELLUM_LIVE_EVAL_RESULT_JSON) {
      throw new Error("Live adapter must supply VELLUM_LIVE_EVAL_RESULT_JSON");
    }
    const now = new Date();
    const evidence = createLiveExternalEvidence({
      enabled: true,
      kind: kind === "omr" ? "omr" : "model_judge",
      provider: process.env.VELLUM_LIVE_EVAL_PROVIDER ?? "explicit-live-adapter",
      modelOrBackend: process.env.VELLUM_LIVE_EVAL_MODEL ?? "external-current",
      request: { invokedBy: "external-evaluation-cli", kind },
      result: JSON.parse(process.env.VELLUM_LIVE_EVAL_RESULT_JSON),
      now,
      staleAfter: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      limitations: ["Live external evidence is dated, re-invocable, and not reproducible."],
    });
    store.saveExternalEvaluationEvidence(evidence);
    result = { ok: true, command: `eval:${kind}`, evidence };
  } else if (kind === "omr") {
    const evidence = evaluateRecordedOmrFixture();
    store.saveExternalEvaluationEvidence(evidence);
    result = { ok: true, command: "eval:omr", evidence };
  } else {
    const recorded = evaluateRecordedModelFixture();
    store.saveExternalEvaluationEvidence(recorded.evidence);
    store.saveModelJudgeAction(recorded.action);
    result = { ok: true, command: "eval:model", ...recorded };
  }
  const json = `${JSON.stringify(result)}\n`;
  if (output) {
    mkdirSync(output, { recursive: true });
    writeFileSync(path.join(output, "result.json"), json, { mode: 0o600 });
  }
  process.stdout.write(json);
}

function value(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: String(error) })}\n`);
  process.exitCode = 1;
});
