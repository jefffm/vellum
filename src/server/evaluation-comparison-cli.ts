import path from "node:path";
import { EvaluationComparisonService } from "./lib/evaluation-comparison.js";
import { digestValue } from "./lib/evaluation-harness.js";
import { EvaluationStore } from "./lib/evaluation-store.js";
import {
  FIRST_LOOP_COMPARISON_POLICY,
  runFirstLoopEvaluation,
} from "./lib/first-loop-evaluation.js";

async function main(): Promise<void> {
  const output = path.resolve(argumentValue("--output") ?? ".vellum/evaluations");
  const clean = await runFirstLoopEvaluation({ evaluationRoot: output });
  const mutated = await runFirstLoopEvaluation({
    evaluationRoot: output,
    mutationId: "mutation.principal-voice-omission",
  });
  const store = new EvaluationStore({ rootDirectory: output });
  const service = new EvaluationComparisonService({ store });
  const baseline = service.promoteBaseline({
    evaluationRunId: clean.runId,
    comparisonScope: { kind: "case", ids: ["case.greensleeves-first-loop"] },
    knownDefects: clean.cards.flatMap((card) =>
      card.dimensions
        .filter(
          (dimension) =>
            dimension.absoluteOutcome === "unknown" || dimension.completeness !== "complete"
        )
        .map((dimension) => ({
          id: `known-defect.first-loop.${dimension.dimensionId}`,
          dimensionId: dimension.dimensionId,
          scope: dimension.scope,
          description: dimension.observations[0]?.message ?? "Evaluation evidence is incomplete.",
          evidenceRefs: [{ id: card.id, version: 1, digest: digestValue(card) }],
          acceptedTradeoff:
            "This development baseline retains the disclosed gap without presenting the dimension as passing.",
        }))
    ),
    promotedBy: {
      id: "reviewer.repository-fixture-author",
      role: "baseline_reviewer",
      displayName: "Repository fixture author",
    },
    rationale:
      "Pin the first-loop development output, including disclosed unknowns, to verify mutation sensitivity.",
  });
  const comparison = service.compare({
    baselineId: baseline.id,
    proposedRunId: mutated.runId,
    policy: FIRST_LOOP_COMPARISON_POLICY,
    attribution: "intentional_design",
  });
  const report = service.renderReport({ comparisonId: comparison.id });
  const principalDelta = comparison.dimensionDeltas.find(
    (delta) => delta.dimensionId === "preservation_and_transformation"
  );
  const mutationDetected =
    principalDelta?.direction === "regressed" &&
    principalDelta.materiality === "material" &&
    comparison.classifications.includes("hard_regression");
  process.stdout.write(
    `${JSON.stringify({
      ok: mutationDetected,
      output,
      baselineId: baseline.id,
      baselineRunId: clean.runId,
      proposedRunId: mutated.runId,
      comparisonId: comparison.id,
      reportId: report.id,
      mutationDetected,
      classifications: comparison.classifications,
      principalDelta,
      reviewNeeds: report.reviewNeeds,
    })}\n`
  );
  if (!mutationDetected) process.exitCode = 1;
}

function argumentValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

main().catch((error: unknown) => {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`
  );
  process.exitCode = 1;
});
