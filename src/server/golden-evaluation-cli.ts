import path from "node:path";
import process from "node:process";
import { runFirstLoopEvaluation } from "./lib/first-loop-evaluation.js";

try {
  const output = path.resolve(argument("--output") ?? ".vellum/evaluations");
  const result = await runFirstLoopEvaluation({ evaluationRoot: output });
  const hardFailure = result.cards.some((card) => card.hardGateStatus === "fail");
  process.stdout.write(
    `${JSON.stringify({
      ok: result.executionStatus === "completed" && !hardFailure,
      command: "eval:golden",
      corpusScope: "first-loop-promoted-baseline",
      output,
      ...result,
    })}\n`
  );
  if (result.executionStatus !== "completed" || hardFailure) process.exitCode = 1;
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
