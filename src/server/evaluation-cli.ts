import path from "node:path";
import process from "node:process";
import { runFirstLoopEvaluation } from "./lib/first-loop-evaluation.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

try {
  const output = path.resolve(argument("--output") ?? ".vellum/evaluations");
  const result = await runFirstLoopEvaluation({ evaluationRoot: output });
  process.stdout.write(`${JSON.stringify({ ok: true, output, ...result })}\n`);
  if (
    result.executionStatus !== "completed" ||
    result.cards.some((card) => card.hardGateStatus === "fail")
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`
  );
  process.exitCode = 1;
}
