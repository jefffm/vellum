import path from "node:path";
import process from "node:process";
import { assertAuthorityPathRuntime } from "../lib/authority-path-runtime.js";
import { runFirstLoopEvaluation } from "./lib/first-loop-evaluation.js";
import { loadGoldenCorpus, validateGoldenCandidate } from "./lib/golden-corpus.js";

export async function main(): Promise<void> {
  assertAuthorityPathRuntime("authority.validator.evaluator-only", "evaluation");

  try {
    const output = path.resolve(argument("--output") ?? ".vellum/evaluations");
    const corpus = loadGoldenCorpus();
    const corpusResults = corpus.cases.map((evaluationCase) => {
      const invariantIds = evaluationCase.invariants.map(({ id }) => id);
      const alternatives = evaluationCase.acceptableAlternatives.map((alternative) => ({
        id: alternative.id,
        ...validateGoldenCandidate(evaluationCase, {
          satisfiedInvariantIds: invariantIds,
          referenceAlternativeId: alternative.id,
        }),
      }));
      const mutations = evaluationCase.mutations.map((mutation) => {
        const violated = new Set(mutation.expectedInvariantIds);
        const result = validateGoldenCandidate(evaluationCase, {
          satisfiedInvariantIds: invariantIds.filter((id) => !violated.has(id)),
        });
        return { id: mutation.id, detected: result.status === "fail", ...result };
      });
      return { caseId: evaluationCase.id, alternatives, mutations };
    });
    const result = await runFirstLoopEvaluation({ evaluationRoot: output });
    const hardFailure = result.cards.some((card) => card.hardGateStatus === "fail");
    const corpusFailure = corpusResults.some(
      (evaluationCase) =>
        evaluationCase.alternatives.some(({ status }) => status !== "pass") ||
        evaluationCase.mutations.some(({ detected }) => !detected)
    );
    process.stdout.write(
      `${JSON.stringify({
        ok: result.executionStatus === "completed" && !hardFailure && !corpusFailure,
        command: "eval:golden",
        corpusScope: corpus.dataset,
        corpusResults,
        output,
        ...result,
      })}\n`
    );
    if (result.executionStatus !== "completed" || hardFailure || corpusFailure) {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`
    );
    process.exitCode = 1;
  }
}

function argument(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

await main();
