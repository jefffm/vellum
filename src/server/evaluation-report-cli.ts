import path from "node:path";
import process from "node:process";
import { EvaluationStore } from "./lib/evaluation-store.js";
import { buildEvaluationRunReport } from "./lib/evaluation-run-report.js";

try {
  const root = path.resolve(argument("--output") ?? ".vellum/evaluations");
  const runId = argument("--run");
  if (!runId) throw new Error("eval:report requires --run <evaluation-run-id>");
  const now = new Date(argument("--now") ?? new Date().toISOString());
  if (Number.isNaN(now.getTime())) throw new Error("eval:report --now must be an ISO date");
  const store = new EvaluationStore({ rootDirectory: root });
  process.stdout.write(`${JSON.stringify(buildEvaluationRunReport(store, runId, now))}\n`);
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`
  );
  process.exitCode = 1;
}

function argument(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}
