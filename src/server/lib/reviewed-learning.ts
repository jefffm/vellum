import { randomUUID } from "node:crypto";
import type {
  EvaluatorDatasetManifest,
  EvaluatorRevision,
  ReviewedLearningDecision,
  ReviewedLearningOutputCandidate,
  ReviewedLearningProposal,
} from "../../lib/evaluation-domain.js";
import { digestValue } from "./evaluation-harness.js";
import { EvaluationStore } from "./evaluation-store.js";
import { OwnerStore } from "./owner-store.js";

type Options = {
  evaluationStore: EvaluationStore;
  ownerStore: OwnerStore;
  now?: () => Date;
  createId?: () => string;
};

export class ReviewedLearningService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(private readonly options: Options) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  propose(
    input: Omit<ReviewedLearningProposal, "id" | "status" | "createdAt">
  ): ReviewedLearningProposal {
    const expectedBoundary = {
      personal_default: "owner_personal_default",
      owner_ergonomic_profile: "owner_ergonomic_profile",
      knowledge_candidate: "historical_specialist_knowledge",
      evaluator_calibration: "evaluation_maintainer_calibration",
      golden_fixture: "fixture_maintainer_export",
      minimal_counterexample: "fixture_maintainer_export",
    } as const;
    if (input.reviewBoundary !== expectedBoundary[input.kind]) {
      throw new Error(`${input.kind} must use its existing review boundary`);
    }
    const evidenceKeys = input.evidence.map(
      (item) =>
        `${item.ref.id}@${item.ref.version}:${item.evaluatorRef.id}@${item.evaluatorRef.version}`
    );
    if (new Set(evidenceKeys).size !== evidenceKeys.length) {
      throw new Error("Learning evidence has one dataset role per evaluator version");
    }
    return this.options.evaluationStore.saveReviewedLearningProposal({
      ...input,
      id: `learning-proposal.${this.createId()}`,
      status: "proposed",
      createdAt: this.now().toISOString(),
    });
  }

  reject(input: {
    proposalId: string;
    reviewerRole: ReviewedLearningDecision["reviewerRole"];
    rationale: string;
  }): ReviewedLearningDecision {
    const proposal = this.options.evaluationStore.getReviewedLearningProposal(input.proposalId);
    this.assertReviewer(proposal, input.reviewerRole);
    return this.options.evaluationStore.saveReviewedLearningDecision({
      id: `learning-decision.${this.createId()}`,
      proposalRef: ref(proposal),
      decision: "rejected",
      reviewerRole: input.reviewerRole,
      rationale: input.rationale,
      createdAt: this.now().toISOString(),
    });
  }

  accept(input: {
    proposalId: string;
    reviewerRole: ReviewedLearningDecision["reviewerRole"];
    rationale: string;
  }): { decision: ReviewedLearningDecision; output: unknown } {
    const proposal = this.options.evaluationStore.getReviewedLearningProposal(input.proposalId);
    this.assertReviewer(proposal, input.reviewerRole);
    if (proposal.kind === "personal_default") {
      const value = objectValue(proposal.proposedValue);
      const output = this.options.ownerStore.proposeDefaultCandidate({
        dimension: stringValue(value.dimension, "dimension"),
        value: value.value,
        scope: stringRecord(value.scope, "scope"),
        evidenceChoiceIds: proposal.evidence.map((item) => item.ref.id),
      });
      return this.decide(proposal, input, output, { id: output.id, version: 1 });
    }
    if (proposal.kind === "knowledge_candidate") {
      const value = objectValue(proposal.proposedValue);
      const output = this.options.ownerStore.proposeKnowledge({
        statement: stringValue(value.statement, "statement"),
        referenceId: stringValue(value.referenceId, "referenceId"),
        citationLocator: stringValue(value.citationLocator, "citationLocator"),
        scope: value.scope as Parameters<OwnerStore["proposeKnowledge"]>[0]["scope"],
      });
      return this.decide(proposal, input, output, { id: output.id, version: 1 });
    }
    if (proposal.kind === "evaluator_calibration") {
      return this.acceptCalibration(proposal, input);
    }
    const value = objectValue(proposal.proposedValue);
    const privateEvidence = proposal.evidence.some((item) => item.privateWorkspaceEvidence);
    const privateExportReviewed = value.privateExportReviewed === true;
    if (
      (proposal.kind === "golden_fixture" || proposal.kind === "minimal_counterexample") &&
      privateEvidence &&
      !privateExportReviewed
    ) {
      throw new Error("Private workspace evidence requires deliberate reviewed fixture export");
    }
    const output: ReviewedLearningOutputCandidate = {
      id: `learning-output.${this.createId()}`,
      version: 1,
      proposalId: proposal.id,
      kind: proposal.kind,
      payload: value.payload,
      provenance: {
        license: stringValue(value.license, "license"),
        sourceEvidenceRefs: proposal.evidence.map((item) => item.ref),
        privateExportReviewed,
      },
      status: "candidate",
      createdAt: this.now().toISOString(),
    };
    this.options.evaluationStore.saveReviewedLearningOutputCandidate(output);
    return this.decide(proposal, input, output, { id: output.id, version: output.version });
  }

  private acceptCalibration(
    proposal: ReviewedLearningProposal,
    input: { reviewerRole: ReviewedLearningDecision["reviewerRole"]; rationale: string }
  ): { decision: ReviewedLearningDecision; output: EvaluatorRevision } {
    const value = objectValue(proposal.proposedValue);
    const evaluatorRefs = new Map(
      proposal.evidence.map((item) => [
        `${item.evaluatorRef.id}@${item.evaluatorRef.version}:${item.evaluatorRef.digest}`,
        item.evaluatorRef,
      ])
    );
    if (evaluatorRefs.size !== 1)
      throw new Error("Calibration evidence must target one evaluator version");
    const parentEvaluatorRef = [...evaluatorRefs.values()][0]!;
    const fitting = proposal.evidence.filter((item) => item.datasetRole === "fitting");
    const heldOut = proposal.evidence.filter((item) => item.datasetRole === "held_out");
    if (
      fitting.length === 0 ||
      heldOut.length === 0 ||
      !proposal.evidence.some((item) => item.relation === "supporting") ||
      !proposal.evidence.some((item) => item.relation === "conflicting")
    ) {
      throw new Error(
        "Calibration Candidate requires fitting, held-out, supporting, and conflicting evidence"
      );
    }
    const manifest: EvaluatorDatasetManifest = {
      id: `evaluator-dataset.${this.createId()}`,
      version: 1,
      evaluatorRef: parentEvaluatorRef,
      assignments: proposal.evidence.map((item) => ({
        evidenceRef: item.ref,
        role: item.datasetRole,
      })),
      incompatibleComparisonIds: [],
      createdAt: this.now().toISOString(),
    };
    this.options.evaluationStore.saveEvaluatorDatasetManifest(manifest);
    const revision: EvaluatorRevision = {
      id: `evaluator-revision.${this.createId()}`,
      version: parentEvaluatorRef.version + 1,
      parentEvaluatorRef,
      datasetManifestRef: ref(manifest),
      fittingInputRefs: fitting.map((item) => item.ref),
      heldOutInputRefs: heldOut.map((item) => item.ref),
      targetScope: proposal.targetScope,
      knownLimitations: stringArray(value.knownLimitations, "knownLimitations"),
      historicalDisagreementRefs: proposal.evidence
        .filter((item) => item.kind === "prediction_disagreement")
        .map((item) => item.ref),
      createdAt: this.now().toISOString(),
    };
    this.options.evaluationStore.saveEvaluatorRevision(revision);
    return this.decide(proposal, input, revision, { id: revision.id, version: revision.version });
  }

  private decide<T>(
    proposal: ReviewedLearningProposal,
    input: { reviewerRole: ReviewedLearningDecision["reviewerRole"]; rationale: string },
    output: T,
    outputIdentity: { id: string; version: number }
  ): { decision: ReviewedLearningDecision; output: T } {
    const decision = this.options.evaluationStore.saveReviewedLearningDecision({
      id: `learning-decision.${this.createId()}`,
      proposalRef: ref(proposal),
      decision: "accepted",
      reviewerRole: input.reviewerRole,
      rationale: input.rationale,
      outputRef: { ...outputIdentity, digest: digestValue(output) },
      createdAt: this.now().toISOString(),
    });
    return { decision, output };
  }

  private assertReviewer(
    proposal: ReviewedLearningProposal,
    reviewerRole: ReviewedLearningDecision["reviewerRole"]
  ): void {
    const required = {
      owner_personal_default: "owner",
      owner_ergonomic_profile: "owner",
      historical_specialist_knowledge: "historical_specialist",
      evaluation_maintainer_calibration: "evaluation_maintainer",
      fixture_maintainer_export: "fixture_maintainer",
    } as const;
    if (reviewerRole !== required[proposal.reviewBoundary]) {
      throw new Error(`${reviewerRole} cannot accept ${proposal.reviewBoundary}`);
    }
  }
}

function ref(value: { id: string; version?: number }) {
  return { id: value.id, version: value.version ?? 1, digest: digestValue(value) };
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Learning proposal value must be an object");
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value;
}

function stringArray(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new Error(`${field} must be a non-empty string array`);
  }
  return value as string[];
}

function stringRecord(value: unknown, field: string): Record<string, string> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.values(value).some((item) => typeof item !== "string")
  ) {
    throw new Error(`${field} must be a string record`);
  }
  return value as Record<string, string>;
}
