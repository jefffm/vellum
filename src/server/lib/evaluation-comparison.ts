import { randomUUID } from "node:crypto";
import type {
  AbsoluteDimensionResult,
  Compatibility,
  DigestedRef,
  DimensionDelta,
  EvaluationBaseline,
  EvaluationCard,
  EvaluationComparison,
  EvaluationDefinition,
  EvaluationReport,
  EvaluationScope,
  KnownDefect,
} from "../../lib/evaluation-domain.js";
import { digestValue } from "./evaluation-harness.js";
import { EvaluationStore } from "./evaluation-store.js";
import { createNodeGeneratedArtifactSecurity } from "./generated-artifact-security-node.js";

export type ComparisonPolicy = {
  id: string;
  version: number;
  noise: "none";
  hardGatesCompensable: false;
  minimumEvidenceRefs: number;
  unknownHandling: "undetermined";
  mixedResultHandling: "mixed";
  gateEligibleDimensions: string[];
};

export type EvaluationComparisonMigrations = {
  suite?: DigestedRef;
  evaluators?: DigestedRef;
  cases?: Array<{ baselineCaseId: string; proposedCaseId: string; mappingRef: DigestedRef }>;
};

export class EvaluationComparisonService {
  constructor(
    private readonly options: {
      store: EvaluationStore;
      now?: () => Date;
      createId?: () => string;
    }
  ) {}

  promoteBaseline(input: {
    evaluationRunId: string;
    comparisonScope: EvaluationScope;
    knownDefects: KnownDefect[];
    promotedBy: EvaluationBaseline["promotedBy"];
    rationale: string;
    supersedesBaselineId?: string;
  }): EvaluationBaseline {
    const run = this.options.store.getRun(input.evaluationRunId);
    if (run.executionStatus !== "completed") {
      throw new Error("Only a completed Evaluation Run can be promoted as a baseline");
    }
    const manifest = this.options.store.getManifest(run.manifestId);
    if (run.caseRunIds.length === 0) throw new Error("A baseline Run must contain case results");
    for (const caseRunId of run.caseRunIds) this.options.store.getCaseRun(caseRunId);
    const disclosedDimensions = new Set(input.knownDefects.map((defect) => defect.dimensionId));
    const undisclosed = this.cardsForRun(run.id)
      .flatMap((card) => card.dimensions)
      .filter(
        (dimension) =>
          dimension.absoluteOutcome === "fail" ||
          dimension.absoluteOutcome === "outside_range" ||
          dimension.absoluteOutcome === "unknown" ||
          dimension.completeness !== "complete"
      )
      .map((dimension) => dimension.dimensionId)
      .filter((dimensionId) => !disclosedDimensions.has(dimensionId));
    if (undisclosed.length > 0) {
      throw new Error(
        `Baseline promotion omits known defects for dimensions: ${[...new Set(undisclosed)].join(", ")}`
      );
    }
    if (input.supersedesBaselineId) this.options.store.getBaseline(input.supersedesBaselineId);
    const createId = this.options.createId ?? randomUUID;
    return this.options.store.saveBaseline({
      id: `evaluation-baseline.${createId()}`,
      version: 1,
      suiteRef: manifest.suiteRef,
      evaluationRunId: run.id,
      manifestId: manifest.id,
      comparisonScope: input.comparisonScope,
      knownDefects: input.knownDefects,
      promotedBy: input.promotedBy,
      rationale: input.rationale,
      promotedAt: (this.options.now ?? (() => new Date()))().toISOString(),
      ...(input.supersedesBaselineId ? { supersedesBaselineId: input.supersedesBaselineId } : {}),
    });
  }

  compare(input: {
    baselineId: string;
    proposedRunId: string;
    policy: ComparisonPolicy;
    attribution?: EvaluationComparison["attributions"][number];
    migrations?: EvaluationComparisonMigrations;
  }): EvaluationComparison {
    const baseline = this.options.store.getBaseline(input.baselineId);
    const baselineRun = this.options.store.getRun(baseline.evaluationRunId);
    const proposedRun = this.options.store.getRun(input.proposedRunId);
    if (proposedRun.executionStatus !== "completed") {
      throw new Error("A proposed Evaluation Run must be completed before comparison");
    }
    const baselineManifest = this.options.store.getManifest(baselineRun.manifestId);
    const proposedManifest = this.options.store.getManifest(proposedRun.manifestId);
    validatePolicy(input.policy, proposedManifest.comparisonPolicyRef);

    const suiteCompatibility = compareEvaluationRef(
      baselineManifest.suiteRef,
      proposedManifest.suiteRef,
      "suite",
      input.migrations?.suite
    );
    const evaluatorCompatibility = compareEvaluationRefLists(
      baselineManifest.evaluators,
      proposedManifest.evaluators,
      "evaluator",
      input.migrations?.evaluators
    );
    const proposedCases = new Map(
      proposedManifest.cases.map((entry) => [refKey(entry.caseRef), entry.caseRef])
    );
    const caseAlignment = baselineManifest.cases.map((entry) => {
      const exact = proposedCases.get(refKey(entry.caseRef));
      const sameIdentity = proposedManifest.cases.find(
        (candidate) =>
          candidate.caseRef.id === entry.caseRef.id &&
          candidate.caseRef.version === entry.caseRef.version
      )?.caseRef;
      const migration = input.migrations?.cases?.find(
        (candidate) => candidate.baselineCaseId === entry.caseRef.id
      );
      const migratedCase = migration
        ? proposedManifest.cases.find(
            (candidate) => candidate.caseRef.id === migration.proposedCaseId
          )?.caseRef
        : undefined;
      return {
        baselineCaseRef: entry.caseRef,
        ...(exact || sameIdentity || migratedCase
          ? { proposedCaseRef: exact ?? sameIdentity ?? migratedCase }
          : {}),
        compatibility: exact
          ? compatible("Exact case identity and digest match.")
          : sameIdentity
            ? changedSemantics("Case identity matches but authored semantics changed.")
            : migratedCase && migration
              ? migrated(
                  "A reviewed migration mapping aligns the changed case identity.",
                  migration.mappingRef
                )
              : incomparable("No exact case identity or declared migration mapping exists."),
      };
    });
    const globallyComparable =
      isComparableCompatibility(suiteCompatibility) &&
      isComparableCompatibility(evaluatorCompatibility) &&
      caseAlignment.every((alignment) => isComparableCompatibility(alignment.compatibility));

    const baselineCards = this.cardsForRun(baselineRun.id);
    const proposedCards = this.cardsForRun(proposedRun.id);
    const proposedByCase = new Map(
      proposedCards.map((card) => [this.options.store.getCaseRun(card.caseRunId).caseRef.id, card])
    );
    const dimensionDeltas = baselineCards.flatMap((baselineCard) => {
      const caseId = this.options.store.getCaseRun(baselineCard.caseRunId).caseRef.id;
      const alignedCaseId = caseAlignment.find(
        (alignment) => alignment.baselineCaseRef.id === caseId
      )?.proposedCaseRef?.id;
      const proposedCard = proposedByCase.get(alignedCaseId ?? caseId);
      if (!proposedCard) {
        return baselineCard.dimensions.map((dimension) =>
          incomparableDelta(dimension, "The proposed Run has no aligned case Card.")
        );
      }
      const proposedDimensions = new Map(
        proposedCard.dimensions.map((dimension) => [dimension.dimensionId, dimension])
      );
      return baselineCard.dimensions.map((before) => {
        const after = proposedDimensions.get(before.dimensionId);
        if (!after) return incomparableDelta(before, "The proposed Card omits this dimension.");
        return compareDimension(before, after, {
          globallyComparable,
          evaluatorCompatible: isComparableCompatibility(evaluatorCompatibility),
          policy: input.policy,
        });
      });
    });
    const classifications = classifyComparison(dimensionDeltas, baselineCards, proposedCards, {
      suiteCompatibility,
      evaluatorCompatibility,
      intentional: input.attribution === "intentional_design",
    });
    const attributions = new Set<EvaluationComparison["attributions"][number]>([
      input.attribution ?? (globallyComparable ? "product_code" : "incompatibility"),
    ]);
    if (evaluatorCompatibility.status !== "compatible") attributions.add("evaluator_semantics");
    if (!globallyComparable) attributions.add("incompatibility");
    const createId = this.options.createId ?? randomUUID;
    return this.options.store.saveComparison({
      id: `evaluation-comparison.${createId()}`,
      version: 1,
      baselineId: baseline.id,
      proposedRunId: proposedRun.id,
      baselineManifestId: baselineManifest.id,
      proposedManifestId: proposedManifest.id,
      suiteCompatibility,
      caseAlignment,
      evaluatorCompatibility,
      dimensionDeltas,
      classifications,
      attributions: [...attributions],
      reviewStatus: "unreviewed",
      createdAt: (this.options.now ?? (() => new Date()))().toISOString(),
    });
  }

  renderReport(input: { comparisonId: string }): EvaluationReport {
    const comparison = this.options.store.getComparison(input.comparisonId);
    const baseline = this.options.store.getBaseline(comparison.baselineId);
    const baselineCards = this.cardsForRun(baseline.evaluationRunId);
    const proposedCards = this.cardsForRun(comparison.proposedRunId);
    const cards = [...baselineCards, ...proposedCards];
    const scopes = uniqueScopes([
      baseline.comparisonScope,
      ...comparison.dimensionDeltas.flatMap((delta) =>
        cards.flatMap((card) =>
          card.dimensions
            .filter((dimension) => dimension.dimensionId === delta.dimensionId)
            .map((dimension) => dimension.scope)
        )
      ),
    ]);
    const artifactRefs = uniqueRefs(
      [...baselineCards, ...proposedCards].flatMap((card) => {
        const caseRun = this.options.store.getCaseRun(card.caseRunId);
        return [...caseRun.generatedRecordRefs, ...caseRun.deliverableRefs];
      })
    );
    const reviewNeeds = reportReviewNeeds(comparison, baseline);
    const unsafeMarkup = renderMarkup({ comparison, baseline, cards, artifactRefs, reviewNeeds });
    const security = createNodeGeneratedArtifactSecurity();
    try {
      const sanitized = security.sanitizeEvaluationReport(unsafeMarkup);
      const createId = this.options.createId ?? randomUUID;
      return this.options.store.saveReport({
        id: `evaluation-report.${createId()}`,
        version: 1,
        comparisonId: comparison.id,
        baselineId: baseline.id,
        proposedRunId: comparison.proposedRunId,
        cardRefs: cards.map(recordRef),
        musicalScopes: scopes,
        artifactRefs,
        reviewNeeds,
        sanitizedMarkup: sanitized.markup,
        sanitizerPolicyVersion: security.policyVersion,
        generatedAt: (this.options.now ?? (() => new Date()))().toISOString(),
      });
    } finally {
      security.dispose();
    }
  }

  private cardsForRun(runId: string): EvaluationCard[] {
    const run = this.options.store.getRun(runId);
    return run.caseRunIds.map((caseRunId) => {
      const card = this.options.store.getCardForCaseRun(caseRunId);
      if (!card) throw new Error(`Evaluation Card not found for Case Run ${caseRunId}`);
      return card;
    });
  }
}

function validatePolicy(policy: ComparisonPolicy, ref: DigestedRef): void {
  const definition: EvaluationDefinition = {
    id: policy.id,
    version: policy.version,
    kind: "comparison_policy",
    payload: {
      noise: policy.noise,
      hardGatesCompensable: policy.hardGatesCompensable,
      minimumEvidenceRefs: policy.minimumEvidenceRefs,
      unknownHandling: policy.unknownHandling,
      mixedResultHandling: policy.mixedResultHandling,
      gateEligibleDimensions: policy.gateEligibleDimensions,
    },
  };
  if (
    ref.id !== policy.id ||
    ref.version !== policy.version ||
    ref.digest !== digestValue(definition)
  ) {
    throw new Error("Comparison Policy does not match the proposed Run manifest");
  }
}

function compareDimension(
  before: AbsoluteDimensionResult,
  after: AbsoluteDimensionResult,
  context: {
    globallyComparable: boolean;
    evaluatorCompatible: boolean;
    policy: ComparisonPolicy;
  }
): DimensionDelta {
  const evidenceRefs = uniqueRefs([
    ...before.observations.flatMap((observation) => observation.evidenceRefs),
    ...after.observations.flatMap((observation) => observation.evidenceRefs),
  ]);
  if (!context.globallyComparable) {
    return {
      dimensionId: before.dimensionId,
      comparability: context.evaluatorCompatible ? "incomparable" : "changed_semantics",
      direction: "unknown",
      materiality: "undetermined",
      evidenceRefs,
      rationale: "Manifest or evaluator compatibility does not authorize a directional claim.",
    };
  }
  if (
    before.absoluteOutcome === "unknown" ||
    after.absoluteOutcome === "unknown" ||
    before.completeness !== "complete" ||
    after.completeness !== "complete" ||
    evidenceRefs.length < context.policy.minimumEvidenceRefs
  ) {
    return {
      dimensionId: before.dimensionId,
      comparability: "comparable",
      direction: "unknown",
      materiality: "undetermined",
      evidenceRefs,
      rationale: "The aligned dimension lacks complete evidence for a directional conclusion.",
    };
  }
  const beforeRank = outcomeRank(before.absoluteOutcome);
  const afterRank = outcomeRank(after.absoluteOutcome);
  const direction =
    afterRank > beforeRank ? "improved" : afterRank < beforeRank ? "regressed" : "unchanged";
  return {
    dimensionId: before.dimensionId,
    comparability: "comparable",
    direction,
    materiality: direction === "unchanged" ? "immaterial" : "material",
    evidenceRefs,
    rationale:
      direction === "unchanged"
        ? "The aligned absolute result is unchanged under the pinned comparison policy."
        : `The aligned absolute result ${direction} under the pinned comparison policy.`,
  };
}

function outcomeRank(outcome: AbsoluteDimensionResult["absoluteOutcome"]): number {
  if (outcome === "pass" || outcome === "within_range") return 1;
  if (outcome === "fail" || outcome === "outside_range") return -1;
  return 0;
}

function classifyComparison(
  deltas: DimensionDelta[],
  beforeCards: EvaluationCard[],
  afterCards: EvaluationCard[],
  context: {
    suiteCompatibility: Compatibility;
    evaluatorCompatibility: Compatibility;
    intentional: boolean;
  }
): EvaluationComparison["classifications"] {
  const result = new Set<EvaluationComparison["classifications"][number]>();
  if (
    context.suiteCompatibility.status === "incomparable" ||
    deltas.some((delta) => delta.comparability === "incomparable")
  )
    result.add("incomparable");
  if (context.evaluatorCompatibility.status !== "compatible") result.add("evaluator_change");
  for (const delta of deltas) {
    if (delta.direction === "improved") result.add("improvement");
    if (delta.direction === "unknown") result.add("unknown_change");
    if (delta.direction !== "regressed") continue;
    const before = beforeCards
      .flatMap((card) => card.dimensions)
      .find((item) => item.dimensionId === delta.dimensionId);
    const after = afterCards
      .flatMap((card) => card.dimensions)
      .find((item) => item.dimensionId === delta.dimensionId);
    if (
      before?.permittedPresentation === "rubric_evidence" ||
      after?.permittedPresentation === "rubric_evidence"
    ) {
      result.add("human_judgment_delta");
    } else if (
      before?.permittedPresentation === "hard_gate" ||
      after?.permittedPresentation === "hard_gate"
    ) {
      result.add("hard_regression");
    } else {
      result.add("measured_regression");
    }
  }
  if (context.intentional && deltas.some((delta) => delta.direction !== "unchanged")) {
    result.add("intentional_difference");
  }
  if (result.size === 0) result.add("unknown_change");
  return [...result];
}

export function compareEvaluationRef(
  left: DigestedRef,
  right: DigestedRef,
  label: string,
  migrationRef?: DigestedRef
): Compatibility {
  if (refKey(left) === refKey(right))
    return compatible(`Exact ${label} identity and digest match.`);
  if (migrationRef)
    return migrated(`A reviewed migration mapping aligns the changed ${label}.`, migrationRef);
  if (left.id === right.id && left.version === right.version) {
    return changedSemantics(`${label} identity matches but its digest changed.`);
  }
  return incomparable(`${label} identity differs and no migration mapping was provided.`);
}

export function compareEvaluationRefLists(
  left: DigestedRef[],
  right: DigestedRef[],
  label: string,
  migrationRef?: DigestedRef
): Compatibility {
  if (left.length !== right.length) {
    return migrationRef
      ? migrated(`A reviewed migration mapping aligns changed ${label} sets.`, migrationRef)
      : incomparable(`${label} sets have different cardinality.`);
  }
  const statuses = left.map((ref, index) =>
    compareEvaluationRef(ref, right[index]!, label, migrationRef)
  );
  return (
    statuses.find((item) => item.status !== "compatible") ??
    compatible(`Exact ${label} sets match.`)
  );
}

function compatible(rationale: string): Compatibility {
  return { status: "compatible", rationale };
}
function changedSemantics(rationale: string): Compatibility {
  return { status: "changed_semantics", rationale };
}
function migrated(rationale: string, migrationRef: DigestedRef): Compatibility {
  return { status: "migrated", rationale, migrationRef };
}
function incomparable(rationale: string): Compatibility {
  return { status: "incomparable", rationale };
}

function isComparableCompatibility(value: Compatibility): boolean {
  return value.status === "compatible" || value.status === "migrated";
}

function incomparableDelta(before: AbsoluteDimensionResult, rationale: string): DimensionDelta {
  return {
    dimensionId: before.dimensionId,
    comparability: "incomparable",
    direction: "unknown",
    materiality: "undetermined",
    evidenceRefs: before.observations.flatMap((observation) => observation.evidenceRefs),
    rationale,
  };
}

function reportReviewNeeds(
  comparison: EvaluationComparison,
  baseline: EvaluationBaseline
): string[] {
  const needs = baseline.knownDefects.map((defect) => `Retained baseline defect: ${defect.id}`);
  if (comparison.classifications.includes("hard_regression"))
    needs.push("Resolve hard regression before promotion.");
  if (comparison.classifications.includes("evaluator_change"))
    needs.push("Review evaluator-semantic compatibility.");
  if (comparison.dimensionDeltas.some((delta) => delta.direction === "unknown")) {
    needs.push("Complete or explicitly waive missing comparative evidence.");
  }
  return needs;
}

function renderMarkup(input: {
  comparison: EvaluationComparison;
  baseline: EvaluationBaseline;
  cards: EvaluationCard[];
  artifactRefs: DigestedRef[];
  reviewNeeds: string[];
}): string {
  const rows = input.comparison.dimensionDeltas
    .map(
      (delta) =>
        `<tr><th>${escapeHtml(delta.dimensionId)}</th><td>${escapeHtml(delta.comparability)}</td><td>${escapeHtml(delta.direction)}</td><td>${escapeHtml(delta.materiality)}</td><td>${escapeHtml(delta.rationale)}</td></tr>`
    )
    .join("");
  return `<article><h1>Evaluation comparison</h1><p>Baseline ${escapeHtml(input.baseline.id)} versus Run ${escapeHtml(input.comparison.proposedRunId)}</p><h2>Known baseline defects</h2><ul>${input.baseline.knownDefects.map((defect) => `<li>${escapeHtml(defect.id)}: ${escapeHtml(defect.description)}</li>`).join("")}</ul><h2>Dimension deltas</h2><table><thead><tr><th>Dimension</th><th>Compatibility</th><th>Direction</th><th>Materiality</th><th>Rationale</th></tr></thead><tbody>${rows}</tbody></table><h2>Linked cards</h2><ul>${input.cards.map((card) => `<li>${escapeHtml(card.id)}</li>`).join("")}</ul><h2>Artifacts</h2><ul>${input.artifactRefs.map((ref) => `<li>${escapeHtml(ref.id)}</li>`).join("")}</ul><h2>Review needs</h2><ul>${input.reviewNeeds.map((need) => `<li>${escapeHtml(need)}</li>`).join("")}</ul></article>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!
  );
}

function recordRef(record: { id: string; version?: number }): DigestedRef {
  return { id: record.id, version: record.version ?? 1, digest: digestValue(record) };
}

function refKey(ref: DigestedRef): string {
  return `${ref.id}@${ref.version}:${ref.digest}`;
}

function uniqueRefs(refs: DigestedRef[]): DigestedRef[] {
  return [...new Map(refs.map((ref) => [refKey(ref), ref])).values()];
}

function uniqueScopes(scopes: EvaluationScope[]): EvaluationScope[] {
  return [
    ...new Map(scopes.map((scope) => [`${scope.kind}:${scope.ids.join("|")}`, scope])).values(),
  ];
}
