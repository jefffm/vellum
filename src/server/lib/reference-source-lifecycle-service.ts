import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import {
  ReferenceRecordRefSchema,
  canonicalReferenceJson,
  referenceSourceDigest,
  type ReferenceAccessDecision,
  type ReferenceAssetRoleBinding,
  type ReferenceLifecycleStoragePolicy,
  type ReferenceLifecycleUse,
  type ReferenceProvenanceSubstitution,
  type ReferenceRecordRef,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingSnapshot,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceLifecycleActionSchema,
  ReferenceSourceLifecycleComputationResultSchema,
  ReferenceSourceLifecyclePlanResultSchema,
  blockReferenceSourceLifecyclePlan,
  planReferenceSourceLifecycle,
  type ReferenceLifecyclePlanningIssue,
  type ReferenceSourceLifecycleComputationResult,
  type ReferenceSourceLifecycleComputedPlan,
  type ReferenceSourceLifecyclePreflightEvidence,
  type ReferenceSourceLifecyclePlanResult,
  type ReferenceSourceLifecyclePlannerInput,
} from "../../lib/reference-source-lifecycle.js";
import {
  REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS,
  evaluateReferenceSourceAuthority,
  type ReferenceAuthorityReceiptVerifier,
  type ReferenceAuthoritySubjectFacetRequirement,
  type ReferenceAuthorityVerificationReceipt,
} from "../../lib/reference-source-authority.js";
import {
  planReferenceSourceInventoryClosure,
  type ReferenceSourceInventoryClosureWitness,
  type ReferenceSourceRequiredStoreRegistry,
} from "../../lib/reference-source-inventory.js";
import { compareReferenceSourceInstants } from "../../lib/reference-source-instant.js";
import {
  evaluateReferenceSourceRetentionAuthority,
  type ReferenceSourceRetentionAuthorityReceipt,
  type ReferenceSourceRetentionAuthorityReceiptVerifier,
} from "../../lib/reference-source-retention-authority.js";
import { assertReferenceSourceStagingSnapshotIntegrity } from "./reference-source-staging-service.js";
import {
  ReferenceSourceStagingConflictError,
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingNotFoundError,
  ReferenceSourceStagingStore,
  type ReferenceSourceStagingHead,
} from "./reference-source-staging-store.js";

const Strict = { additionalProperties: false } as const;

export const ReferenceSourceLifecycleDryRunRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    expectedHeadRef: ReferenceRecordRefSchema,
    action: ReferenceSourceLifecycleActionSchema,
  },
  Strict
);
export type ReferenceSourceLifecycleDryRunRequest = Static<
  typeof ReferenceSourceLifecycleDryRunRequestSchema
>;

export type ReferenceSourceLifecyclePlanningServiceOptions = {
  store?: ReferenceSourceStagingStore;
  now?: () => Date;
  planner?: (
    input: ReferenceSourceLifecyclePlannerInput
  ) => ReferenceSourceLifecycleComputationResult;
  evidenceProvider?: ReferenceSourceLifecycleEvidenceProvider;
  authorityTrust?: ReferenceSourceAuthorityTrust;
  retentionAuthorityTrust?: ReferenceSourceRetentionAuthorityTrust;
};

export type ReferenceSourceAuthorityTrust = {
  verifyReceipt: ReferenceAuthorityReceiptVerifier;
  verifierRef: ReferenceRecordRef;
  verifierPolicyRef: ReferenceRecordRef;
  algorithm: ReferenceAuthorityVerificationReceipt["proof"]["algorithm"];
  keyId: string;
};

export type ReferenceSourceRetentionAuthorityTrust = {
  verifyReceipt: ReferenceSourceRetentionAuthorityReceiptVerifier;
  authorityProofRef: ReferenceRecordRef;
  signingKeyRef: ReferenceRecordRef;
  verifierRef: ReferenceRecordRef;
};

export type ReferenceSourceLifecycleEvidence = {
  inventory: {
    currentRegistry: ReferenceSourceRequiredStoreRegistry;
    witness: ReferenceSourceInventoryClosureWitness;
  };
  authorityReceipts: ReferenceAuthorityVerificationReceipt[];
  retentionAuthorityReceipts: ReferenceSourceRetentionAuthorityReceipt[];
};

export type ReferenceSourceLifecycleEvidenceProvider = (input: {
  snapshot: Readonly<ReferenceSourceStagingSnapshot>;
  effectiveAt: string;
}) => ReferenceSourceLifecycleEvidence;

/**
 * Read-only application boundary for lifecycle planning.
 *
 * The caller supplies only an action and the exact CAS head it observed. Every
 * acquisition, derivation, rights/access record, role binding, substitution,
 * storage policy, and lifecycle use comes from one integrity-checked current
 * staging snapshot. The service has no writer and rechecks the head after the
 * pure planner returns, so it can never publish a mixed-generation plan.
 */
export class ReferenceSourceLifecyclePlanningService {
  readonly store: ReferenceSourceStagingStore;
  private readonly now: () => Date;
  private readonly planner: (
    input: ReferenceSourceLifecyclePlannerInput
  ) => ReferenceSourceLifecycleComputationResult;
  private readonly evidenceProvider: ReferenceSourceLifecycleEvidenceProvider | undefined;
  private readonly authorityTrust: ReferenceSourceAuthorityTrust | undefined;
  private readonly retentionAuthorityTrust: ReferenceSourceRetentionAuthorityTrust | undefined;

  constructor(options: ReferenceSourceLifecyclePlanningServiceOptions = {}) {
    this.store = options.store ?? new ReferenceSourceStagingStore();
    this.now = options.now ?? (() => new Date());
    this.planner = options.planner ?? planReferenceSourceLifecycle;
    this.evidenceProvider = options.evidenceProvider;
    this.authorityTrust = options.authorityTrust;
    this.retentionAuthorityTrust = options.retentionAuthorityTrust;
  }

  planDryRun(request: ReferenceSourceLifecycleDryRunRequest): ReferenceSourceLifecyclePlanResult {
    const decoded = decodeRequest(request);
    const state = this.store.readCurrentState();
    if (!state) {
      throw new ReferenceSourceStagingNotFoundError(
        "Reference-source lifecycle planning requires a current staging snapshot"
      );
    }
    assertExpectedHead(decoded.expectedHeadRef, state.head);
    assertReferenceSourceStagingSnapshotIntegrity(state.snapshot);

    const effectiveAt = this.now().toISOString();
    const preflightInput: ReferenceSourceLifecyclePlannerInput = {
      schemaVersion: 1,
      baseSnapshot: structuredClone(state.snapshot),
      effectiveAt,
      action: structuredClone(decoded.action),
      retentionOutcomes: [],
    };
    const preflight = validateLifecycleEvidence(
      preflightInput,
      this.evidenceProvider,
      this.authorityTrust,
      this.retentionAuthorityTrust
    );
    let result: ReferenceSourceLifecyclePlanResult;
    if (preflight.issues.length > 0) {
      result = blockReferenceSourceLifecyclePlan(preflightInput, preflight.issues);
    } else {
      if (!preflight.verifiedEvidence) {
        throw new ReferenceSourceStagingIntegrityError(
          "Lifecycle preflight succeeded without digest-bound verified evidence"
        );
      }
      const plannerInput: ReferenceSourceLifecyclePlannerInput = {
        ...preflightInput,
        retentionOutcomes: preflight.verifiedEvidence.retentionEvaluations.map(
          ({ roleBindingRef, outcome }) => ({ roleBindingRef, outcome })
        ),
      };
      const computation = this.planner(plannerInput);
      assertComputationResult(computation, plannerInput);
      result = promoteLifecycleComputation(computation, preflight.verifiedEvidence);
    }
    assertPlanResult(result, preflightInput, preflight.verifiedEvidence);

    const finalHead = this.store.readHead();
    if (!finalHead || !sameHead(finalHead, state.head)) {
      throw new ReferenceSourceStagingConflictError(
        "Reference-source staging head changed during lifecycle planning",
        finalHead
      );
    }
    if (preflight.consistencyDigest) {
      const postflight = validateLifecycleEvidence(
        preflightInput,
        this.evidenceProvider,
        this.authorityTrust,
        this.retentionAuthorityTrust
      );
      if (
        postflight.issues.length > 0 ||
        postflight.consistencyDigest !== preflight.consistencyDigest
      ) {
        throw new ReferenceSourceStagingConflictError(
          "Controlled-store or authority evidence changed during lifecycle planning",
          finalHead
        );
      }
    }
    const postflightHead = this.store.readHead();
    if (!postflightHead || !sameHead(postflightHead, state.head)) {
      throw new ReferenceSourceStagingConflictError(
        "Reference-source staging head changed during lifecycle evidence postflight",
        postflightHead
      );
    }
    return result;
  }
}

type LifecycleEvidenceValidation = {
  issues: ReferenceLifecyclePlanningIssue[];
  verifiedEvidence?: ReferenceSourceLifecyclePreflightEvidence;
  consistencyDigest?: string;
};

function validateLifecycleEvidence(
  input: ReferenceSourceLifecyclePlannerInput,
  provider: ReferenceSourceLifecycleEvidenceProvider | undefined,
  authorityTrust: ReferenceSourceAuthorityTrust | undefined,
  retentionAuthorityTrust: ReferenceSourceRetentionAuthorityTrust | undefined
): LifecycleEvidenceValidation {
  const issues: ReferenceLifecyclePlanningIssue[] = [];
  let evidence: ReferenceSourceLifecycleEvidence | undefined;
  try {
    evidence = provider?.({
      snapshot: structuredClone(input.baseSnapshot),
      effectiveAt: input.effectiveAt,
    });
  } catch {
    evidence = undefined;
  }

  if (!evidence) {
    issues.push({
      code: "incomplete_controlled_store_inventory",
      detail:
        "Lifecycle planning requires a server-produced closure witness for every registered Vellum-controlled store.",
    });
    if (requiredAuthorityDecisionRefs(input).length > 0) {
      issues.push({
        code: "unverified_authority",
        detail:
          "Lifecycle planning requires server-authenticated authority receipts for every decision that could preserve access.",
      });
    }
    if (requiredRetentionRoleBindingRefs(input.baseSnapshot, input.effectiveAt).length > 0) {
      issues.push({
        code: "unverified_retention_policy",
        detail:
          "Lifecycle planning requires server-authenticated retention-policy receipts for every active Asset Role Binding.",
      });
    }
    return { issues };
  }

  const inventory = planReferenceSourceInventoryClosure({
    currentRegistry: evidence.inventory.currentRegistry,
    witness: evidence.inventory.witness,
  });
  if (inventory.status === "blocked") {
    issues.push({
      code: "incomplete_controlled_store_inventory",
      detail: `Controlled-store inventory closure failed: ${inventory.issues
        .map(({ code, storeId }) => `${code}${storeId ? `:${storeId}` : ""}`)
        .sort()
        .join(", ")}.`,
    });
  } else {
    const requiredArtifacts = controlledArtifactRefs(input.baseSnapshot, input.effectiveAt);
    const expectedByStore = controlledArtifactsByStore(input.baseSnapshot, input.effectiveAt);
    const registeredStoreIds = new Set(inventory.stores.map(({ storeId }) => storeId));
    const placedArtifacts = uniqueRefs([...expectedByStore.values()].flat());
    const exactPlacement = inventory.stores.every((store) =>
      sameRefSet(
        store.artifactBindings.map(({ artifactRef }) => artifactRef),
        expectedByStore.get(store.storeId) ?? []
      )
    );
    const exactDigitalAssetBytes = inventory.stores.every((store) =>
      store.artifactBindings.every((binding) =>
        bindingMatchesSnapshotDigitalAsset(binding, input.baseSnapshot)
      )
    );
    if (
      !sameRefSet(placedArtifacts, requiredArtifacts) ||
      [...expectedByStore.keys()].some((storeId) => !registeredStoreIds.has(storeId)) ||
      !exactPlacement ||
      !exactDigitalAssetBytes
    ) {
      issues.push({
        code: "incomplete_controlled_store_inventory",
        detail:
          "The complete-store witness must exactly match each lifecycle policy's controlled store placement and the exact digest and length declared by every Digital Asset, including primary and backup copies, with no unplaced, mismatched, or orphan artifacts.",
      });
    }
  }

  const records = input.baseSnapshot.records;
  const decisions = records.filter(
    (record): record is Extract<(typeof records)[number], { recordKind: "access_decision" }> =>
      record.recordKind === "access_decision"
  );
  const rightsAssertions = records.filter(
    (record): record is Extract<(typeof records)[number], { recordKind: "rights_assertion" }> =>
      record.recordKind === "rights_assertion"
  );
  const invalidatedRefKeys = new Set(
    records
      .filter(
        (record): record is Extract<(typeof records)[number], { recordKind: "invalidation" }> =>
          record.recordKind === "invalidation" &&
          compareReferenceSourceInstants(record.invalidatedAt, input.effectiveAt) <= 0
      )
      .map((record) => refKey(record.invalidatedRef))
  );
  const authorityEvaluations: Array<{
    accessDecisionRef: ReferenceRecordRef;
    receiptRef: ReferenceRecordRef;
    evaluationDigest: string;
  }> = [];
  for (const decisionRef of requiredAuthorityDecisionRefs(input)) {
    const exactDecision = decisions.find((decision) => refsEqual(recordRef(decision), decisionRef));
    const receipts = evidence.authorityReceipts.filter(({ accessDecisionRef }) =>
      refsEqual(accessDecisionRef, decisionRef)
    );
    if (receipts.length !== 1) {
      issues.push({
        code: "unverified_authority",
        subjectRef: decisionRef,
        detail:
          "An exact access decision must have exactly one current server-authenticated authority receipt.",
      });
      continue;
    }
    const authoritySubjectRefs = exactDecision
      ? deriveReferenceSourceAuthoritySubjectClosure(input.baseSnapshot, exactDecision)
      : [];
    const requiredSubjectFacets = exactDecision
      ? deriveRequiredReferenceSourceAuthoritySubjectFacets(
          input.baseSnapshot,
          exactDecision,
          authoritySubjectRefs
        )
      : [];
    const requiredSubstitutionRefs = exactDecision
      ? deriveRequiredReviewedProvenanceSubstitutionRefs(
          input.baseSnapshot,
          exactDecision,
          input.effectiveAt
        )
      : [];
    if (
      !exactDecision ||
      [
        decisionRef,
        ...authoritySubjectRefs,
        ...requiredSubstitutionRefs,
        ...receipts[0]!.currentRightsAssertionRefs,
      ].some((ref) => invalidatedRefKeys.has(refKey(ref))) ||
      !receiptMatchesCompleteRightsClosure(
        receipts[0]!,
        exactDecision,
        rightsAssertions,
        requiredSubjectFacets,
        requiredSubstitutionRefs,
        input.effectiveAt
      ) ||
      !receiptMatchesServerObservations(receipts[0]!, input.baseSnapshot)
    ) {
      issues.push({
        code: "unverified_authority",
        subjectRef: decisionRef,
        detail:
          "Authority receipt is not bound to the exact non-invalidated server-observed snapshot, decision, subject, and rights generations.",
      });
      continue;
    }
    if (
      !authorityTrust ||
      !refsEqual(receipts[0]!.verifierRef, authorityTrust.verifierRef) ||
      !refsEqual(receipts[0]!.verifierPolicyRef, authorityTrust.verifierPolicyRef) ||
      receipts[0]!.proof.algorithm !== authorityTrust.algorithm ||
      receipts[0]!.proof.keyId !== authorityTrust.keyId
    ) {
      issues.push({
        code: "unverified_authority",
        subjectRef: decisionRef,
        detail:
          "Authority receipt verifier, policy, algorithm, and key identity must match the independently pinned server trust root.",
      });
      continue;
    }
    try {
      const evaluation = evaluateReferenceSourceAuthority({
        schemaVersion: 1,
        effectiveAt: input.effectiveAt,
        accessDecisionRef: decisionRef,
        authoritySubjectRefs,
        requiredSubjectFacets,
        accessDecisions: decisions,
        rightsAssertions,
        receipt: receipts[0]!,
        verifyServerReceipt: authorityTrust.verifyReceipt,
      });
      if (evaluation.status !== "allow") {
        issues.push({
          code: "unverified_authority",
          subjectRef: decisionRef,
          detail: `Authority closure failed: ${evaluation.findings
            .map(({ code }) => code)
            .sort()
            .join(", ")}.`,
        });
      } else {
        authorityEvaluations.push({
          accessDecisionRef: decisionRef,
          receiptRef: recordRef(receipts[0]!),
          evaluationDigest: referenceSourceDigest(evaluation),
        });
      }
    } catch {
      issues.push({
        code: "unverified_authority",
        subjectRef: decisionRef,
        detail: "Authority closure could not be decoded or authenticated.",
      });
    }
  }
  const roleBindings = activeRoleBindings(input.baseSnapshot, input.effectiveAt);
  const retentionEvaluations: ReferenceSourceLifecyclePreflightEvidence["retentionEvaluations"] =
    [];
  for (const binding of roleBindings) {
    const bindingRef = recordRef(binding);
    const receipts = evidence.retentionAuthorityReceipts.filter((receipt) =>
      refsEqual(receipt.roleBindingRef, bindingRef)
    );
    if (receipts.length !== 1 || !retentionAuthorityTrust) {
      issues.push({
        code: "unverified_retention_policy",
        subjectRef: bindingRef,
        detail:
          receipts.length !== 1
            ? "Each Asset Role Binding requires exactly one authenticated retention-policy receipt."
            : "Retention-policy receipts require an independently configured server trust root.",
      });
      continue;
    }
    try {
      const evaluation = evaluateReferenceSourceRetentionAuthority({
        schemaVersion: 1,
        effectiveAt: input.effectiveAt,
        observedSnapshotRef: recordRef(input.baseSnapshot),
        roleBindingRef: bindingRef,
        digitalAssetRef: binding.digitalAssetRef,
        acquisitionRefs: binding.acquisitionRefs,
        accessDecisionRefs: binding.accessDecisionRefs,
        retentionPolicyRef: binding.retentionPolicyRef,
        authorityProofRef: retentionAuthorityTrust.authorityProofRef,
        signingKeyRef: retentionAuthorityTrust.signingKeyRef,
        verifierRef: retentionAuthorityTrust.verifierRef,
        receipt: receipts[0]!,
        verifyServerReceipt: retentionAuthorityTrust.verifyReceipt,
      });
      if (evaluation.status !== "allow") {
        issues.push({
          code: "unverified_retention_policy",
          subjectRef: bindingRef,
          detail: `Retention authority failed: ${evaluation.findings
            .map(({ code }) => code)
            .sort()
            .join(", ")}.`,
        });
      } else {
        retentionEvaluations.push({
          roleBindingRef: bindingRef,
          receiptRef: evaluation.receiptRef,
          outcome: evaluation.outcome,
          evaluationDigest: referenceSourceDigest(evaluation),
        });
      }
    } catch {
      issues.push({
        code: "unverified_retention_policy",
        subjectRef: bindingRef,
        detail: "Retention authority could not be decoded or authenticated.",
      });
    }
  }
  const expectedBindingRefs = roleBindings.map(recordRef);
  if (
    evidence.retentionAuthorityReceipts.some(
      (receipt) => !containsRef(expectedBindingRefs, receipt.roleBindingRef)
    )
  ) {
    issues.push({
      code: "unverified_retention_policy",
      detail: "Retention evidence contains a receipt for a role binding outside this snapshot.",
    });
  }
  if (issues.length > 0 || inventory.status !== "ready") return { issues };
  const verifiedEvidence = bindLifecyclePreflightEvidence({
    inventoryScope: "reference_source_staging_only",
    validatedAt: input.effectiveAt,
    requiredStoreRegistryRef: inventory.requiredStoreRegistryRef,
    inventoryWitnessRef: inventory.witnessRef,
    stores: inventory.stores.map((store) => ({
      storeId: store.storeId,
      storeGeneration: store.storeGeneration,
      storeStateDigest: store.storeStateDigest,
      enumerationDigest: store.enumerationDigest,
    })),
    authorityEvaluations,
    retentionEvaluations,
  });
  return {
    issues,
    verifiedEvidence,
    consistencyDigest: referenceSourceDigest(verifiedEvidence),
  };
}

function receiptMatchesCompleteRightsClosure(
  receipt: ReferenceAuthorityVerificationReceipt,
  decision: ReferenceSourceStagingSnapshot["records"][number] & {
    recordKind: "access_decision";
  },
  assertions: Array<
    ReferenceSourceStagingSnapshot["records"][number] & { recordKind: "rights_assertion" }
  >,
  requiredSubjectFacets: ReferenceAuthoritySubjectFacetRequirement[],
  requiredSubstitutionRefs: ReferenceRecordRef[],
  effectiveAt: string
): boolean {
  const requiredPairs = new Set(
    requiredSubjectFacets.map(({ subjectRef, facet }) => `${refKey(subjectRef)}\u0000${facet}`)
  );
  const currentById = new Map<string, (typeof assertions)[number]>();
  for (const assertion of assertions) {
    if (
      compareReferenceSourceInstants(assertion.assertedAt, effectiveAt) > 0 ||
      !requiredPairs.has(`${refKey(assertion.subjectRef)}\u0000${assertion.rightsKind}`)
    ) {
      continue;
    }
    const current = currentById.get(assertion.id);
    if (!current || assertion.version > current.version) currentById.set(assertion.id, assertion);
  }
  const expected = [...currentById.values()].map(recordRef);
  return (
    sameRefSet(receipt.reviewedProvenanceSubstitutionRefs, requiredSubstitutionRefs) &&
    sameRefSet(receipt.currentRightsAssertionRefs, expected) &&
    sameRefSet(decision.rightsAssertionRefs, expected)
  );
}

function receiptMatchesServerObservations(
  receipt: ReferenceAuthorityVerificationReceipt,
  snapshot: ReferenceSourceStagingSnapshot
): boolean {
  if (!refsEqual(receipt.observedSnapshotRef, recordRef(snapshot))) return false;
  const observations = new Map(
    (snapshot.recordObservations ?? []).map((observation) => [
      `${observation.recordRef.id}\u0000${observation.recordRef.digest}`,
      observation,
    ])
  );
  const decisionObservation = observations.get(
    `${receipt.accessDecisionRef.id}\u0000${receipt.accessDecisionRef.digest}`
  );
  if (
    decisionObservation?.orderingTrust !== "server_observed" ||
    decisionObservation.firstObservedRevision !== receipt.accessDecisionFirstObservedRevision
  ) {
    return false;
  }
  if (receipt.rightsAssertionObservations.length !== receipt.currentRightsAssertionRefs.length) {
    return false;
  }
  const seen = new Set<string>();
  for (const observation of receipt.rightsAssertionObservations) {
    const key = `${observation.rightsAssertionRef.id}\u0000${observation.rightsAssertionRef.digest}`;
    if (
      seen.has(key) ||
      !containsRef(receipt.currentRightsAssertionRefs, observation.rightsAssertionRef)
    ) {
      return false;
    }
    seen.add(key);
    const serverObservation = observations.get(key);
    if (
      serverObservation?.orderingTrust !== "server_observed" ||
      serverObservation.firstObservedRevision !== observation.firstObservedRevision
    ) {
      return false;
    }
  }
  if (
    receipt.reviewedProvenanceSubstitutionRefs.some(
      (ref) => observations.get(refKey(ref))?.orderingTrust !== "server_observed"
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Derive the rights-bearing subject closure from the exact decision scope and
 * staged provenance graph. Receipt-selected scope is never trusted: upstream
 * Work, Manifestation, Exemplar, Acquisition, Asset, Segment, and Derivation
 * subjects are included whenever the exact path reaches them.
 */
export function deriveReferenceSourceAuthoritySubjectClosure(
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  decision: Readonly<ReferenceAccessDecision>
): ReferenceRecordRef[] {
  const byRef = new Map(snapshot.records.map((record) => [refKey(record), record]));
  const pending = uniqueRefs([...decision.sourceRefs, ...decision.derivativeRefs]);
  const closure = new Map<string, ReferenceRecordRef>();
  const enqueue = (refs: readonly ReferenceRecordRef[]) => {
    for (const ref of refs) {
      const key = refKey(ref);
      if (!closure.has(key) && !pending.some((candidate) => refKey(candidate) === key)) {
        pending.push(ref);
      }
    }
  };

  while (pending.length > 0) {
    const ref = pending.shift()!;
    const key = refKey(ref);
    if (closure.has(key)) continue;
    closure.set(key, ref);
    const record = byRef.get(key);
    if (!record) continue;
    switch (record.recordKind) {
      case "asset_acquisition":
        enqueue([record.digitalAssetRef, ...record.representedExemplarRefs]);
        break;
      case "exemplar":
        enqueue(record.manifestationRefs);
        break;
      case "source_manifestation":
        enqueue([
          ...record.workRelations.map(({ workRef }) => workRef),
          ...record.parentRelations.map(({ manifestationRef }) => manifestationRef),
        ]);
        break;
      case "source_derivation":
        enqueue([
          ...record.inputRefs,
          ...record.sourceAcquisitionRefs,
          ...record.sourceDerivationRefs,
          record.derivedRef,
        ]);
        break;
      case "source_segment_version":
        enqueue([
          record.digitalAssetRef,
          ...record.acquisitionRefs,
          ...record.provenancePathRefs,
          record.sourceImageRef,
        ]);
        break;
    }
  }
  return [...closure.values()].sort(compareRefs);
}

function bindLifecyclePreflightEvidence(
  core: Omit<ReferenceSourceLifecyclePreflightEvidence, "id" | "digest" | "schemaVersion">
): ReferenceSourceLifecyclePreflightEvidence {
  const normalized = {
    schemaVersion: 1 as const,
    ...structuredClone(core),
    stores: [...core.stores].sort((left, right) => left.storeId.localeCompare(right.storeId)),
    authorityEvaluations: [...core.authorityEvaluations].sort((left, right) =>
      compareRefs(left.accessDecisionRef, right.accessDecisionRef)
    ),
    retentionEvaluations: [...core.retentionEvaluations].sort((left, right) =>
      compareRefs(left.roleBindingRef, right.roleBindingRef)
    ),
  };
  const seed = referenceSourceDigest(normalized);
  const identified = {
    ...normalized,
    id: `reference-lifecycle-preflight.${seed.slice(0, 24)}`,
  };
  return { ...identified, digest: referenceSourceDigest(identified) };
}

function requiredAuthorityDecisionRefs(
  input: ReferenceSourceLifecyclePlannerInput
): ReferenceRecordRef[] {
  const refs: ReferenceRecordRef[] = [];
  const impactedDerivationRefs =
    input.action.kind === "delete_acquisition"
      ? impactedDerivationRefKeys(input.baseSnapshot, input.action.targetAcquisitionRef)
      : new Set<string>();
  for (const use of currentLifecycleUses(input.baseSnapshot, input.effectiveAt)) {
    for (const path of use.provenancePaths) {
      const affected =
        input.action.kind === "delete_acquisition"
          ? containsRef(path.acquisitionRefs, input.action.targetAcquisitionRef) ||
            path.derivationRefs.some((ref) => impactedDerivationRefs.has(refKey(ref)))
          : refsEqual(path.accessDecisionRef, input.action.targetAccessDecisionRef);
      if (!affected) refs.push(path.accessDecisionRef);
    }
  }
  // Ask the same deterministic consequence engine which exact surviving path
  // it would select. This prevents an inert, scope-mismatched, or unavailable
  // substitution from demanding an authority receipt and denial-of-servicing
  // an otherwise safe deletion, while keeping preflight independent from the
  // injectable planner used to produce the final public plan.
  const candidate = planReferenceSourceLifecycle({
    ...input,
    retentionOutcomes: [],
  });
  if (candidate.status === "computed") {
    for (const permission of candidate.permissions) {
      if (
        permission.state === "accessible" &&
        permission.authorization === "provenance_substitution" &&
        permission.accessDecisionRef
      ) {
        refs.push(permission.accessDecisionRef);
      }
    }
  }
  for (const policy of currentLifecycleStoragePolicies(input.baseSnapshot, input.effectiveAt)) {
    if (policy.custody.kind === "unmanaged_recipient") {
      if (
        input.action.kind !== "restrict_access" ||
        !refsEqual(policy.custody.disclosureAccessDecisionRef, input.action.targetAccessDecisionRef)
      ) {
        refs.push(policy.custody.disclosureAccessDecisionRef);
      }
    }
  }
  return uniqueRefs(refs);
}

function impactedDerivationRefKeys(
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  targetAcquisitionRef: ReferenceRecordRef
): Set<string> {
  const derivations = snapshot.records.filter(
    (
      record
    ): record is Extract<ReferenceSourceStagingRecord, { recordKind: "source_derivation" }> =>
      record.recordKind === "source_derivation"
  );
  const impacted = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const derivation of derivations) {
      const key = refKey(derivation);
      if (impacted.has(key)) continue;
      if (
        containsRef(derivation.sourceAcquisitionRefs, targetAcquisitionRef) ||
        derivation.sourceDerivationRefs.some((ref) => impacted.has(refKey(ref)))
      ) {
        impacted.add(key);
        changed = true;
      }
    }
  }
  return impacted;
}

export function deriveRequiredReviewedProvenanceSubstitutionRefs(
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  decision: Readonly<ReferenceAccessDecision>,
  effectiveAt: string
): ReferenceRecordRef[] {
  return activeProvenanceSubstitutions(snapshot, effectiveAt)
    .filter(({ accessDecisionRef }) => refsEqual(accessDecisionRef, recordRef(decision)))
    .map(recordRef)
    .sort(compareRefs);
}

export function deriveRequiredReferenceSourceAuthoritySubjectFacets(
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  decision: ReferenceAccessDecision,
  authoritySubjectRefs: ReferenceRecordRef[]
): ReferenceAuthoritySubjectFacetRequirement[] {
  const scope = new Map(authoritySubjectRefs.map((ref) => [refKey(ref), ref]));
  const recordsByRef = new Map(snapshot.records.map((record) => [refKey(record), record]));
  const refsOfKinds = (...kinds: ReferenceSourceStagingRecord["recordKind"][]) =>
    authoritySubjectRefs.filter((ref) => {
      const record = recordsByRef.get(refKey(ref));
      return record !== undefined && kinds.includes(record.recordKind);
    });
  const acquisitions = refsOfKinds("asset_acquisition");
  const bibliographicSources = refsOfKinds("work", "source_manifestation", "exemplar");
  const derivationSubjects = refsOfKinds("source_derivation", "source_segment_version");
  const exactDerivatives = decision.derivativeRefs.filter((ref) => scope.has(refKey(ref)));
  const exactSources = decision.sourceRefs.filter((ref) => scope.has(refKey(ref)));
  const scopeAssertions = snapshot.records.filter(
    (record): record is Extract<ReferenceSourceStagingRecord, { recordKind: "rights_assertion" }> =>
      record.recordKind === "rights_assertion" && scope.has(refKey(record.subjectRef))
  );
  const fallback = (preferred: ReferenceRecordRef[], secondary: ReferenceRecordRef[]) =>
    uniqueRefs(preferred.length > 0 ? preferred : secondary.length > 0 ? secondary : exactSources);

  return REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS[decision.operation].flatMap((facet) => {
    let subjects: ReferenceRecordRef[];
    switch (facet) {
      case "underlying_work_status":
        subjects = fallback(refsOfKinds("work"), bibliographicSources);
        break;
      case "manifestation_editorial":
      case "translation":
        subjects = fallback(refsOfKinds("source_manifestation"), bibliographicSources);
        break;
      case "exemplar_restriction":
        subjects = fallback(refsOfKinds("exemplar"), acquisitions);
        break;
      case "local_extraction":
        subjects = fallback(derivationSubjects, exactDerivatives);
        break;
      case "pack_citation_excerpt":
      case "export_redistribution":
        subjects = fallback(uniqueRefs([...derivationSubjects, ...exactDerivatives]), exactSources);
        break;
      case "scan_provider_terms":
      case "owner_private_access":
      case "named_provider_processing":
      case "attribution":
        subjects = fallback(acquisitions, exactSources);
        break;
    }
    // The domain default establishes the minimum subjects that must be
    // resolved. Every current assertion in the signed authority closure also
    // makes its exact subject-facet pair applicable, even when the decision
    // omitted that assertion. This prevents a permissive decision from hiding
    // an upstream restriction behind a narrower default heuristic.
    const assertedSubjects = scopeAssertions
      .filter(
        (assertion) => assertion.rightsKind === facet && scope.has(refKey(assertion.subjectRef))
      )
      .map((assertion) => assertion.subjectRef);
    return uniqueRefs([...subjects, ...assertedSubjects]).map((subjectRef) => ({
      subjectRef,
      facet,
    }));
  });
}

function requiredRetentionRoleBindingRefs(
  snapshot: ReferenceSourceStagingSnapshot,
  effectiveAt: string
): ReferenceRecordRef[] {
  return activeRoleBindings(snapshot, effectiveAt).map(recordRef).sort(compareRefs);
}

function controlledArtifactRefs(
  snapshot: ReferenceSourceStagingSnapshot,
  effectiveAt: string
): ReferenceRecordRef[] {
  return uniqueRefs(
    currentLifecycleStoragePolicies(snapshot, effectiveAt)
      .filter(({ custody }) => custody.kind === "vellum_controlled")
      .map(({ subjectRef }) => subjectRef)
  );
}

function bindingMatchesSnapshotDigitalAsset(
  binding: { artifactRef: ReferenceRecordRef; blobSha256: string; byteLength: number },
  snapshot: Readonly<ReferenceSourceStagingSnapshot>
): boolean {
  const record = snapshot.records.find((candidate) =>
    refsEqual(recordRef(candidate), binding.artifactRef)
  );
  return (
    record?.recordKind !== "digital_asset" ||
    (record.sha256 === binding.blobSha256 && record.byteLength === binding.byteLength)
  );
}

function controlledArtifactsByStore(
  snapshot: ReferenceSourceStagingSnapshot,
  effectiveAt: string
): Map<string, ReferenceRecordRef[]> {
  const placements = new Map<string, ReferenceRecordRef[]>();
  for (const record of currentLifecycleStoragePolicies(snapshot, effectiveAt)) {
    if (record.custody.kind !== "vellum_controlled") continue;
    for (const storeId of record.custody.storeIds) {
      placements.set(storeId, uniqueRefs([...(placements.get(storeId) ?? []), record.subjectRef]));
    }
  }
  return placements;
}

function currentLifecycleStoragePolicies(
  snapshot: ReferenceSourceStagingSnapshot,
  effectiveAt: string
): ReferenceLifecycleStoragePolicy[] {
  return currentEffectiveVersionedRecords(
    snapshot.records.filter(
      (record): record is ReferenceLifecycleStoragePolicy =>
        record.recordKind === "lifecycle_storage_policy"
    ),
    snapshot,
    effectiveAt
  );
}

function currentLifecycleUses(
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  effectiveAt: string
): ReferenceLifecycleUse[] {
  return currentEffectiveVersionedRecords(
    snapshot.records.filter(
      (record): record is ReferenceLifecycleUse => record.recordKind === "lifecycle_use"
    ),
    snapshot,
    effectiveAt
  );
}

function currentEffectiveVersionedRecords<
  T extends { id: string; version: number; createdAt: string; digest: string },
>(records: T[], snapshot: Readonly<ReferenceSourceStagingSnapshot>, effectiveAt: string): T[] {
  const invalidatedRefs = effectiveInvalidatedRefKeys(snapshot, effectiveAt);
  const currentById = new Map<string, T>();
  for (const record of records) {
    if (compareReferenceSourceInstants(record.createdAt, effectiveAt) > 0) continue;
    const current = currentById.get(record.id);
    if (
      !current ||
      record.version > current.version ||
      (record.version === current.version && record.digest.localeCompare(current.digest) > 0)
    ) {
      currentById.set(record.id, record);
    }
  }
  return [...currentById.values()]
    .filter((record) => !invalidatedRefs.has(refKey(record)))
    .sort(
      (left, right) =>
        left.id.localeCompare(right.id) ||
        left.version - right.version ||
        left.digest.localeCompare(right.digest)
    );
}

function activeRoleBindings(
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  effectiveAt: string
): ReferenceAssetRoleBinding[] {
  const invalidatedRefs = effectiveInvalidatedRefKeys(snapshot, effectiveAt);
  return snapshot.records
    .filter(
      (record): record is ReferenceAssetRoleBinding =>
        record.recordKind === "arrangement_source_binding" ||
        record.recordKind === "owner_reference_binding" ||
        record.recordKind === "evaluation_source_binding"
    )
    .filter(
      (record) =>
        compareReferenceSourceInstants(record.createdAt, effectiveAt) <= 0 &&
        !invalidatedRefs.has(refKey(record))
    )
    .sort((left, right) => compareRefs(recordRef(left), recordRef(right)));
}

function activeProvenanceSubstitutions(
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  effectiveAt: string
): ReferenceProvenanceSubstitution[] {
  const invalidatedRefs = effectiveInvalidatedRefKeys(snapshot, effectiveAt);
  const observations = new Map(
    (snapshot.recordObservations ?? []).map((observation) => [
      refKey(observation.recordRef),
      observation,
    ])
  );
  return snapshot.records
    .filter(
      (record): record is ReferenceProvenanceSubstitution =>
        record.recordKind === "provenance_substitution"
    )
    .filter(
      (record) =>
        compareReferenceSourceInstants(record.decidedAt, effectiveAt) <= 0 &&
        !invalidatedRefs.has(refKey(record)) &&
        observations.get(refKey(record))?.orderingTrust === "server_observed"
    )
    .sort((left, right) => compareRefs(recordRef(left), recordRef(right)));
}

function effectiveInvalidatedRefKeys(
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  effectiveAt: string
): Set<string> {
  return new Set(
    snapshot.records
      .filter(
        (record): record is Extract<ReferenceSourceStagingRecord, { recordKind: "invalidation" }> =>
          record.recordKind === "invalidation" &&
          compareReferenceSourceInstants(record.invalidatedAt, effectiveAt) <= 0
      )
      .map(({ invalidatedRef }) => refKey(invalidatedRef))
  );
}

function uniqueRefs(refs: ReferenceRecordRef[]): ReferenceRecordRef[] {
  return [...new Map(refs.map((ref) => [`${ref.id}\u0000${ref.digest}`, ref])).values()].sort(
    (left, right) => left.id.localeCompare(right.id) || left.digest.localeCompare(right.digest)
  );
}

function containsRef(refs: ReferenceRecordRef[], target: ReferenceRecordRef): boolean {
  return refs.some((ref) => refsEqual(ref, target));
}

function sameRefSet(left: ReferenceRecordRef[], right: ReferenceRecordRef[]): boolean {
  if (left.length !== right.length) return false;
  const leftKeys = new Set(left.map((ref) => `${ref.id}\u0000${ref.digest}`));
  const rightKeys = new Set(right.map((ref) => `${ref.id}\u0000${ref.digest}`));
  return (
    leftKeys.size === left.length &&
    rightKeys.size === right.length &&
    [...leftKeys].every((key) => rightKeys.has(key))
  );
}

function refKey(ref: ReferenceRecordRef): string {
  return `${ref.id}\u0000${ref.digest}`;
}

function compareRefs(left: ReferenceRecordRef, right: ReferenceRecordRef): number {
  return left.id.localeCompare(right.id) || left.digest.localeCompare(right.digest);
}

function refsEqual(left: ReferenceRecordRef, right: ReferenceRecordRef): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function recordRef(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function decodeRequest(
  request: ReferenceSourceLifecycleDryRunRequest
): ReferenceSourceLifecycleDryRunRequest {
  try {
    return Value.Decode(ReferenceSourceLifecycleDryRunRequestSchema, request);
  } catch (error) {
    throw new ReferenceSourceStagingIntegrityError(
      `Reference-source lifecycle request failed schema validation: ${errorMessage(error)}`
    );
  }
}

function assertExpectedHead(
  expected: ReferenceRecordRef,
  current: ReferenceSourceStagingHead
): void {
  if (expected.id !== current.snapshotId || expected.digest !== current.digest) {
    throw new ReferenceSourceStagingConflictError(
      "Reference-source lifecycle request does not match the current staging head",
      current
    );
  }
}

function assertPlanResult(
  result: ReferenceSourceLifecyclePlanResult,
  input: ReferenceSourceLifecyclePlannerInput,
  verifiedEvidence: ReferenceSourceLifecyclePreflightEvidence | undefined
): void {
  const resultEvidence = "verifiedEvidence" in result ? result.verifiedEvidence : undefined;
  if (
    !Value.Check(ReferenceSourceLifecyclePlanResultSchema, result) ||
    !hasValidPlanSeal(result) ||
    result.mode !== "dry_run" ||
    result.baseSnapshotRef.id !== input.baseSnapshot.id ||
    result.baseSnapshotRef.digest !== input.baseSnapshot.digest ||
    result.effectiveAt !== input.effectiveAt ||
    canonicalReferenceJson(result.action) !== canonicalReferenceJson(input.action) ||
    canonicalReferenceJson(resultEvidence ?? null) !==
      canonicalReferenceJson(verifiedEvidence ?? null)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      "Reference-source lifecycle planner returned a result for another snapshot or mode"
    );
  }
}

function assertComputationResult(
  result: ReferenceSourceLifecycleComputationResult,
  input: ReferenceSourceLifecyclePlannerInput
): void {
  const resultRetentionOutcomes =
    result.status === "computed" ? result.retentionOutcomes : input.retentionOutcomes;
  if (
    !Value.Check(ReferenceSourceLifecycleComputationResultSchema, result) ||
    !hasValidPlanSeal(result) ||
    result.mode !== "dry_run" ||
    result.baseSnapshotRef.id !== input.baseSnapshot.id ||
    result.baseSnapshotRef.digest !== input.baseSnapshot.digest ||
    result.effectiveAt !== input.effectiveAt ||
    canonicalReferenceJson(result.action) !== canonicalReferenceJson(input.action) ||
    canonicalReferenceJson(resultRetentionOutcomes) !==
      canonicalReferenceJson(input.retentionOutcomes)
  ) {
    throw new ReferenceSourceStagingIntegrityError(
      "Reference-source lifecycle planner returned a computation for another snapshot or assumption set"
    );
  }
}

function promoteLifecycleComputation(
  computation: ReferenceSourceLifecycleComputationResult,
  verifiedEvidence: ReferenceSourceLifecyclePreflightEvidence
): ReferenceSourceLifecyclePlanResult {
  if (computation.status === "blocked") {
    const { id: _id, digest: _digest, ...blockedPlan } = computation;
    return sealLifecyclePlan({ ...blockedPlan, verifiedEvidence });
  }
  const {
    id: _id,
    digest: _digest,
    status: _status,
    retentionOutcomes: _retentionOutcomes,
    ...computedPlan
  } = computation as ReferenceSourceLifecycleComputedPlan;
  return sealLifecyclePlan({
    ...computedPlan,
    status: "ready",
    verifiedEvidence,
  });
}

function sealLifecyclePlan(
  value: Omit<ReferenceSourceLifecyclePlanResult, "id" | "digest">
): ReferenceSourceLifecyclePlanResult {
  const seed = referenceSourceDigest(value);
  const identified = { ...value, id: `reference-lifecycle-plan.${seed.slice(0, 24)}` };
  return {
    ...identified,
    digest: referenceSourceDigest(identified),
  } as ReferenceSourceLifecyclePlanResult;
}

function hasValidPlanSeal(result: { id: string; digest: string }): boolean {
  const { id, digest, ...value } = result;
  const seed = referenceSourceDigest(value);
  const expectedId = `reference-lifecycle-plan.${seed.slice(0, 24)}`;
  return id === expectedId && digest === referenceSourceDigest({ ...value, id });
}

function sameHead(left: ReferenceSourceStagingHead, right: ReferenceSourceStagingHead): boolean {
  return (
    left.snapshotId === right.snapshotId &&
    left.digest === right.digest &&
    left.revision === right.revision
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
