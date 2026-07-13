import path from "node:path";
import process from "node:process";
import { runThreeTargetParityEvaluation } from "./lib/three-target-parity.js";

try {
  const output = path.resolve(argument("--output") ?? ".vellum/evaluations");
  const reviewArtifactRoot = argument("--review-artifacts");
  const result = await runThreeTargetParityEvaluation({
    evaluationRoot: output,
    ...(reviewArtifactRoot ? { reviewArtifactRoot: path.resolve(reviewArtifactRoot) } : {}),
  });
  const hardFailure = result.cards.some((card) => card.hardGateStatus === "fail");
  process.stdout.write(
    `${JSON.stringify({
      ok: !hardFailure && result.targets.length === 3,
      command: "eval:parity",
      output,
      ...result,
    })}\n`
  );
  if (hardFailure || result.targets.length !== 3) process.exitCode = 1;
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
