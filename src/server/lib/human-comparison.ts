import { Value } from "@sinclair/typebox/value";
import {
  HumanComparisonProtocolSchema,
  HumanEvaluationSchema,
  type EvaluationDefinition,
  type HumanComparisonConclusion,
  type HumanComparisonProtocol,
  type HumanEvaluation,
} from "../../lib/evaluation-domain.js";
import { digestInstrumentInstance } from "../../lib/instrument-instance.js";
import { digestValue, validateHumanComparisonProtocol } from "./evaluation-harness.js";
import { EvaluationStore } from "./evaluation-store.js";
import { WorkspaceStore } from "./workspace-store.js";

export function validateAndSaveHumanEvaluation(input: {
  workspaceId: string;
  evaluation: HumanEvaluation;
  protocolDefinition: EvaluationDefinition;
  workspaceStore: WorkspaceStore;
  evaluationStore: EvaluationStore;
}): HumanEvaluation {
  const evaluation = Value.Decode(HumanEvaluationSchema, input.evaluation);
  if (input.protocolDefinition.kind !== "human_protocol") {
    throw new Error("Human Evaluation requires a human_protocol definition");
  }
  const protocol = Value.Decode(HumanComparisonProtocolSchema, input.protocolDefinition.payload);
  validateHumanComparisonProtocol(protocol);
  if (
    evaluation.protocolRef.id !== input.protocolDefinition.id ||
    evaluation.protocolRef.version !== input.protocolDefinition.version ||
    evaluation.protocolRef.digest !== digestValue(input.protocolDefinition)
  ) {
    throw new Error("Human Evaluation protocol reference is stale or incompatible");
  }
  const left = validateCandidateContext(
    input.workspaceId,
    evaluation.pairwise.left,
    input.workspaceStore
  );
  const right = validateCandidateContext(
    input.workspaceId,
    evaluation.pairwise.right,
    input.workspaceStore
  );
  if (left.id === right.id)
    throw new Error("Pairwise Human Evaluation requires distinct candidates");
  if (
    left.arrangementSearchId !== right.arrangementSearchId ||
    evaluation.pairwise.left.arrangementSearchRef.id !==
      evaluation.pairwise.right.arrangementSearchRef.id ||
    evaluation.pairwise.left.performanceBriefRef.id !==
      evaluation.pairwise.right.performanceBriefRef.id ||
    evaluation.pairwise.left.instrumentInstanceDigest !==
      evaluation.pairwise.right.instrumentInstanceDigest ||
    JSON.stringify(evaluation.pairwise.left.arrangementScoreEventIds) !==
      JSON.stringify(evaluation.pairwise.right.arrangementScoreEventIds) ||
    JSON.stringify(evaluation.pairwise.left.sourceEventIds) !==
      JSON.stringify(evaluation.pairwise.right.sourceEventIds) ||
    JSON.stringify(evaluation.pairwise.left.playbackOccurrenceIds) !==
      JSON.stringify(evaluation.pairwise.right.playbackOccurrenceIds)
  ) {
    throw new Error(
      "Pairwise Human Evaluation candidates do not share an exact compatible context"
    );
  }
  const anchorById = new Map(protocol.rubricAnchors.map((anchor) => [anchor.id, anchor]));
  const authorityByDimension = new Map(
    protocol.requiredRolesByDimension.map((entry) => [entry.dimension, entry.authorizedRoles])
  );
  for (const judgment of evaluation.judgments) {
    const anchor = anchorById.get(judgment.rubricAnchorId);
    if (!anchor || anchor.dimension !== judgment.dimension) {
      throw new Error(`Judgment ${judgment.dimension} lacks a compatible rubric anchor`);
    }
    if (!authorityByDimension.get(judgment.dimension)?.includes(evaluation.reviewer.role)) {
      throw new Error(
        `${evaluation.reviewer.role} is not authorized for ${judgment.dimension} under this protocol`
      );
    }
    if (judgment.dimension === "historical_practice" && judgment.citedEvidenceIds.length === 0) {
      throw new Error("Historical-practice judgment requires cited evidence");
    }
  }
  if (
    evaluation.evidenceBasis.some((basis) => !protocol.evidenceBasis.includes(basis)) ||
    evaluation.reviewer.conflictsOfInterest.some((conflict) => !conflict.trim())
  ) {
    throw new Error("Human Evaluation disclosure or evidence basis violates its protocol");
  }
  if (evaluation.evidenceBasis.includes("physical_playing")) {
    if (evaluation.ownerPlaytestIds.length === 0) {
      throw new Error("Physical Human Evaluation must reference Owner Playtest evidence");
    }
    const testedCandidateIds = new Set<string>();
    for (const id of evaluation.ownerPlaytestIds) {
      const playtest = input.workspaceStore.getOwnerPlaytest(input.workspaceId, id);
      if (!playtest.actualContext.evidenceBasis.includes("physical_playing")) {
        throw new Error("Referenced Owner Playtest is not physical-playing evidence");
      }
      if (
        playtest.performanceBriefId !== evaluation.pairwise.left.performanceBriefRef.id ||
        playtest.instrumentInstanceDigest !== evaluation.pairwise.left.instrumentInstanceDigest ||
        JSON.stringify(playtest.arrangementEventIds) !==
          JSON.stringify(evaluation.pairwise.left.arrangementScoreEventIds) ||
        JSON.stringify(playtest.playbackOccurrenceIds) !==
          JSON.stringify(evaluation.pairwise.left.playbackOccurrenceIds)
      ) {
        throw new Error("Referenced Owner Playtest context is incompatible with the comparison");
      }
      if (playtest.candidateId) testedCandidateIds.add(playtest.candidateId);
    }
    if (![left.id, right.id].every((id) => testedCandidateIds.has(id))) {
      throw new Error(
        "Physical pairwise conclusion requires Playtest evidence for both candidates"
      );
    }
  } else if (evaluation.ownerPlaytestIds.length > 0) {
    throw new Error("Non-physical Human Evaluation must not duplicate Owner Playtest evidence");
  }
  if (
    evaluation.conclusion.status !== "single_scoped_judgment" ||
    evaluation.conclusion.winner !== undefined ||
    evaluation.regressionEligible !== false ||
    evaluation.learningDisposition !== "scoped_judgment_only"
  ) {
    throw new Error(
      "One Human Evaluation remains one scoped judgment and cannot establish a comparative winner or regression"
    );
  }
  return input.evaluationStore.saveHumanEvaluation(evaluation);
}

export function deriveHumanComparisonConclusion(input: {
  id: string;
  protocolRef: HumanEvaluation["protocolRef"];
  protocol: HumanComparisonProtocol;
  evaluations: HumanEvaluation[];
  adjudicator?: HumanEvaluation;
  createdAt: string;
}): HumanComparisonConclusion {
  if (input.evaluations.length === 0) throw new Error("Human comparison requires judgments");
  const first = input.evaluations[0]!;
  const samePair = input.evaluations.every(
    (evaluation) =>
      evaluation.protocolRef.id === input.protocolRef.id &&
      evaluation.protocolRef.version === input.protocolRef.version &&
      evaluation.protocolRef.digest === input.protocolRef.digest &&
      evaluation.pairwise.left.candidateRef.id === first.pairwise.left.candidateRef.id &&
      evaluation.pairwise.right.candidateRef.id === first.pairwise.right.candidateRef.id
  );
  if (!samePair) throw new Error("Human comparison judgments do not share one exact pair");
  const preferences = input.evaluations.flatMap((evaluation) =>
    evaluation.judgments.map((judgment) => judgment.preference)
  );
  const decisive = preferences.filter(
    (preference): preference is "left" | "right" => preference === "left" || preference === "right"
  );
  const distinctReviewers = new Set(
    input.evaluations.map((evaluation) => evaluation.reviewer.pseudonymousId)
  ).size;
  const duplicateCount = input.evaluations.filter(
    (evaluation) => evaluation.pairwise.duplicateAssignmentId
  ).length;
  const orders = new Set(
    input.evaluations.map((evaluation) => evaluation.pairwise.presentedOrder.join("-"))
  );
  const insufficient =
    distinctReviewers < input.protocol.minimumJudgmentsForComparativeConclusion ||
    decisive.length < input.protocol.minimumJudgmentsForComparativeConclusion ||
    (input.protocol.duplicates.required &&
      duplicateCount < input.protocol.duplicates.minimumCount) ||
    orders.size < Math.min(2, input.protocol.minimumJudgmentsForComparativeConclusion);
  const counts = {
    left: decisive.filter((preference) => preference === "left").length,
    right: decisive.filter((preference) => preference === "right").length,
  };
  const minority = Math.min(counts.left, counts.right);
  const disagreementRatio = decisive.length ? minority / decisive.length : 1;
  const disagreed = disagreementRatio >= input.protocol.disagreement.threshold;
  const adjudicatorPreference = input.adjudicator?.judgments
    .map((judgment) => judgment.preference)
    .find(
      (preference): preference is "left" | "right" =>
        preference === "left" || preference === "right"
    );
  if (input.adjudicator) {
    if (
      input.adjudicator.reviewer.role !== input.protocol.adjudication.requiredRole ||
      !adjudicatorPreference
    ) {
      throw new Error("Adjudicator role or decisive rationale does not satisfy the protocol");
    }
    return {
      id: input.id,
      protocolRef: input.protocolRef,
      humanEvaluationIds: input.evaluations.map(({ id }) => id),
      status: "adjudicated",
      winner: adjudicatorPreference,
      adjudicatorEvaluationId: input.adjudicator.id,
      rationale: input.adjudicator.conclusion.rationale,
      regressionEligible: false,
      createdAt: input.createdAt,
    };
  }
  if (insufficient) {
    return {
      id: input.id,
      protocolRef: input.protocolRef,
      humanEvaluationIds: input.evaluations.map(({ id }) => id),
      status: "insufficient_evidence",
      rationale:
        "The protocol minimum, duplicate requirement, or balanced ordering has not been met.",
      regressionEligible: false,
      createdAt: input.createdAt,
    };
  }
  if (disagreed || counts.left === counts.right) {
    return {
      id: input.id,
      protocolRef: input.protocolRef,
      humanEvaluationIds: input.evaluations.map(({ id }) => id),
      status: "unresolved_disagreement",
      rationale: "Conflicting scoped judgments remain unresolved under the declared threshold.",
      regressionEligible: false,
      createdAt: input.createdAt,
    };
  }
  return {
    id: input.id,
    protocolRef: input.protocolRef,
    humanEvaluationIds: input.evaluations.map(({ id }) => id),
    status: "concluded",
    winner: counts.left > counts.right ? "left" : "right",
    rationale: "The declared evidence minimum, duplicate policy, and balanced ordering are met.",
    regressionEligible: false,
    createdAt: input.createdAt,
  };
}

function validateCandidateContext(
  workspaceId: string,
  context: HumanEvaluation["pairwise"]["left"],
  store: WorkspaceStore
) {
  const candidate = store.getArrangementCandidate(workspaceId, context.candidateRef.id);
  const search = candidate.arrangementSearchId
    ? store.getArrangementSearch(workspaceId, candidate.arrangementSearchId)
    : undefined;
  if (
    context.candidateRef.version !== 1 ||
    context.candidateRef.digest !== digestValue(candidate) ||
    !search ||
    context.arrangementSearchRef.id !== search.id ||
    context.arrangementSearchRef.version !== 1 ||
    context.arrangementSearchRef.digest !== digestValue(search)
  ) {
    throw new Error("Human Evaluation candidate/search identity is stale or incompatible");
  }
  const brief = store.getPerformanceBrief(workspaceId, search.performanceBriefId);
  if (
    context.performanceBriefRef.id !== brief.id ||
    context.performanceBriefRef.version !== 1 ||
    context.performanceBriefRef.digest !== digestValue(brief) ||
    !search.targetConfiguration.instrumentInstance ||
    context.instrumentInstanceDigest !==
      digestInstrumentInstance(search.targetConfiguration.instrumentInstance)
  ) {
    throw new Error("Human Evaluation Brief or Instrument Instance is stale or incompatible");
  }
  const candidateEventIds = new Set(candidate.events.map((event) => event.id));
  if (context.candidateEventIds.some((id) => !candidateEventIds.has(id))) {
    throw new Error("Human Evaluation passage is not present in its candidate");
  }
  const candidateSourceIds = new Set(
    candidate.events
      .filter((event) => context.candidateEventIds.includes(event.id))
      .flatMap((event) => event.sourceEventIds)
  );
  if (context.sourceEventIds.some((id) => !candidateSourceIds.has(id))) {
    throw new Error("Human Evaluation candidate passage has incompatible source lineage");
  }
  const analysis = store.getAnalysisRecord(workspaceId, search.analysisRecordId);
  const normalized = store.getNormalizedScore(workspaceId, analysis.normalizedScoreId);
  const occurrenceIds = new Set(
    normalized.performedForm?.measureOccurrences.map((occurrence) => occurrence.id) ?? []
  );
  if (context.playbackOccurrenceIds.some((id) => !occurrenceIds.has(id))) {
    throw new Error("Human Evaluation references an unknown Playback Occurrence");
  }
  return candidate;
}
