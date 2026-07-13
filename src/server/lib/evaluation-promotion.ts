import { randomUUID } from "node:crypto";
import type { EvaluationBaseline, EvaluationPromotionReview } from "../../lib/evaluation-domain.js";
import { EvaluationStore } from "./evaluation-store.js";

export class EvaluationPromotionService {
  constructor(
    private readonly store: EvaluationStore,
    private readonly options: { now?: () => Date; createId?: () => string } = {}
  ) {}

  review(input: {
    evaluationRunId: string;
    changeClassification: "product" | "evaluator";
    mandatoryDeterministicSuites: EvaluationPromotionReview["mandatoryDeterministicSuites"];
    hardRegressions: EvaluationPromotionReview["hardRegressions"];
    materialDeltaIds: string[];
    reviewedMaterialDeltaIds: string[];
    requiredHumanEvidenceIds: string[];
    completedHumanEvidenceRefs: EvaluationPromotionReview["completedHumanEvidenceRefs"];
    disclosedUnknownDimensionIds: string[];
    promoter: EvaluationBaseline["promotedBy"];
    rationale: string;
  }): EvaluationPromotionReview {
    const run = this.store.getRun(input.evaluationRunId);
    const blockers: string[] = [];
    if (run.executionStatus !== "completed") blockers.push("Evaluation Run is not complete.");
    if (input.mandatoryDeterministicSuites.some((suite) => suite.status !== "completed")) {
      blockers.push("A mandatory deterministic suite did not complete.");
    }
    if (
      input.hardRegressions.some(
        (regression) =>
          regression.status === "unresolved" ||
          (regression.status === "authorized_rejection" && !regression.authority)
      )
    ) {
      blockers.push("A hard regression is unresolved or lacks rejection authority.");
    }
    const reviewedDeltas = new Set(input.reviewedMaterialDeltaIds);
    if (input.materialDeltaIds.some((id) => !reviewedDeltas.has(id))) {
      blockers.push("A material measured delta lacks review.");
    }
    const completedHuman = new Set(input.completedHumanEvidenceRefs.map(({ id }) => id));
    if (input.requiredHumanEvidenceIds.some((id) => !completedHuman.has(id))) {
      blockers.push("Required human evidence is incomplete.");
    }
    const actualUnknowns = new Set(
      run.caseRunIds
        .map((id) => this.store.getCardForCaseRun(id))
        .flatMap((card) => card?.dimensions ?? [])
        .filter(
          (dimension) =>
            dimension.absoluteOutcome === "unknown" || dimension.completeness !== "complete"
        )
        .map(({ dimensionId }) => dimensionId)
    );
    const disclosed = new Set(input.disclosedUnknownDimensionIds);
    if ([...actualUnknowns].some((id) => !disclosed.has(id))) {
      blockers.push("An unknown or incomplete dimension was not disclosed.");
    }
    const review: EvaluationPromotionReview = {
      id: `promotion-review.${(this.options.createId ?? randomUUID)()}`,
      ...input,
      status: blockers.length ? "blocked" : "promotable",
      blockers,
      createdAt: (this.options.now ?? (() => new Date()))().toISOString(),
    };
    return this.store.savePromotionReview(review);
  }
}
