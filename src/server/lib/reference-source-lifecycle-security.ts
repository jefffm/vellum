import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS,
  referenceAuthorityReceiptSigningPayload,
  type ReferenceAuthoritySubjectFacetRequirement,
  type ReferenceAuthorityVerificationReceipt,
} from "../../lib/reference-source-authority.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAssetRoleBinding,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceStagingSnapshot,
} from "../../lib/reference-source-domain.js";
import {
  referenceSourceRetentionAuthorityReceiptSigningPayload,
  type ReferenceSourceRetentionAuthorityReceipt,
} from "../../lib/reference-source-retention-authority.js";
import {
  deriveReferenceSourceAuthoritySubjectClosure,
  deriveRequiredReviewedProvenanceSubstitutionRefs,
  deriveRequiredReferenceSourceAuthoritySubjectFacets,
  type ReferenceSourceAuthorityTrust,
  type ReferenceSourceLifecycleEvidenceProvider,
  type ReferenceSourceRetentionAuthorityTrust,
} from "./reference-source-lifecycle-service.js";
import {
  createReferenceSourceInventoryProvider,
  type ReferenceSourceControlledStoreInventoryAdapter,
} from "./reference-source-inventory-provider.js";
import { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";

const AUTHORITY_VERIFIER_ID = "vellum.local.owner-private-upload-verifier.v1";
const AUTHORITY_POLICY_ID = "vellum.local.owner-private-upload-attestation-policy.v1";
const RETENTION_AUTHORITY_ID = "vellum.local.retention-authority.v1";
const RETENTION_VERIFIER_ID = "vellum.local.retention-verifier.v1";
const RECEIPT_LIFETIME_MS = 5 * 60 * 1000;
const LOCAL_SECURITY_BUILD_DIGEST = referenceSourceDigest({
  component: "reference-source-lifecycle-security",
  schemaVersion: 1,
});

export type ReferenceSourceLifecycleSecurityBundle = {
  evidenceProvider: ReferenceSourceLifecycleEvidenceProvider;
  authorityTrust: ReferenceSourceAuthorityTrust;
  retentionAuthorityTrust: ReferenceSourceRetentionAuthorityTrust;
};

export type ReferenceSourceLifecycleSecurityOptions = {
  inventoryAdapters?: readonly ReferenceSourceControlledStoreInventoryAdapter[];
};

/**
 * Create the process-local trust boundary used by lifecycle dry runs.
 *
 * The HMAC key never leaves these closures. Receipts attest only to the exact
 * current staging snapshot and its explicit records; the provider does not
 * manufacture missing permission or infer rights from byte identity.
 */
export function createReferenceSourceLifecycleSecurityBundle(
  options: ReferenceSourceLifecycleSecurityOptions = {}
): ReferenceSourceLifecycleSecurityBundle {
  const secret = randomBytes(32);
  const keyFingerprint = createHash("sha256").update(secret).digest("hex").slice(0, 24);
  const keyId = `vellum.local.lifecycle-hmac.${keyFingerprint}`;
  const verifierRef = externalRef(AUTHORITY_VERIFIER_ID);
  const verifierPolicyRef = externalRef(AUTHORITY_POLICY_ID);
  const authorityProofRef = externalRef(RETENTION_AUTHORITY_ID);
  const signingKeyRef = externalRef(keyId);
  const retentionVerifierRef = externalRef(RETENTION_VERIFIER_ID);
  const inventoryProvider = createReferenceSourceInventoryProvider({
    adapters: options.inventoryAdapters ?? [new ReferenceSourceControlledArtifactStore()],
    registryGeneration: 1,
    producer: {
      kind: "vellum_server",
      instanceId: `vellum-local-${keyFingerprint}`,
      buildDigest: LOCAL_SECURITY_BUILD_DIGEST,
    },
  });

  const authorityTrust: ReferenceSourceAuthorityTrust = {
    verifierRef,
    verifierPolicyRef,
    algorithm: "hmac-sha256",
    keyId,
    verifyReceipt: ({ receipt, signingPayload }) =>
      receipt.proof.kind === "server_signature" &&
      receipt.proof.algorithm === "hmac-sha256" &&
      receipt.proof.keyId === keyId &&
      signingPayload === referenceAuthorityReceiptSigningPayload(receipt) &&
      verifyHmac(secret, signingPayload, receipt.proof.signature),
  };
  const retentionAuthorityTrust: ReferenceSourceRetentionAuthorityTrust = {
    authorityProofRef,
    signingKeyRef,
    verifierRef: retentionVerifierRef,
    verifyReceipt: ({ receipt, signingPayload }) =>
      receipt.proof.kind === "server_signature" &&
      receipt.proof.algorithm === "hmac-sha256" &&
      refsEqual(receipt.authorityProofRef, authorityProofRef) &&
      refsEqual(receipt.signingKeyRef, signingKeyRef) &&
      refsEqual(receipt.verifierRef, retentionVerifierRef) &&
      signingPayload === referenceSourceRetentionAuthorityReceiptSigningPayload(receipt) &&
      verifyHmac(secret, signingPayload, receipt.proof.signature),
  };

  const evidenceProvider: ReferenceSourceLifecycleEvidenceProvider = ({
    snapshot,
    effectiveAt,
  }) => {
    const inventory = inventoryProvider({ producedAt: effectiveAt });

    const decisions = snapshot.records.filter(
      (record): record is ReferenceAccessDecision => record.recordKind === "access_decision"
    );
    const roleBindings = snapshot.records.filter(
      (record): record is ReferenceAssetRoleBinding =>
        record.recordKind === "arrangement_source_binding" ||
        record.recordKind === "owner_reference_binding" ||
        record.recordKind === "evaluation_source_binding"
    );

    return {
      inventory,
      authorityReceipts: decisions.flatMap((decision) => {
        const receipt = createAuthorityReceipt({
          snapshot,
          effectiveAt,
          decision,
          verifierRef,
          verifierPolicyRef,
          keyId,
          secret,
        });
        return receipt ? [receipt] : [];
      }),
      retentionAuthorityReceipts: roleBindings.map((binding) =>
        createRetentionReceipt({
          snapshot,
          effectiveAt,
          binding,
          authorityProofRef,
          signingKeyRef,
          verifierRef: retentionVerifierRef,
          secret,
        })
      ),
    };
  };

  return { evidenceProvider, authorityTrust, retentionAuthorityTrust };
}

function createAuthorityReceipt(input: {
  snapshot: Readonly<ReferenceSourceStagingSnapshot>;
  effectiveAt: string;
  decision: ReferenceAccessDecision;
  verifierRef: ReferenceRecordRef;
  verifierPolicyRef: ReferenceRecordRef;
  keyId: string;
  secret: Buffer;
}): ReferenceAuthorityVerificationReceipt | undefined {
  const { snapshot, effectiveAt, decision, verifierRef, verifierPolicyRef, keyId, secret } = input;
  const decisionRevision = observationRevision(snapshot, recordRef(decision));
  if (decisionRevision === undefined) return undefined;

  const requiredFacets = [...REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS[decision.operation]];
  const authoritySubjectRefs = deriveReferenceSourceAuthoritySubjectClosure(snapshot, decision);
  const requiredSubjectFacets: ReferenceAuthoritySubjectFacetRequirement[] =
    deriveRequiredReferenceSourceAuthoritySubjectFacets(snapshot, decision, authoritySubjectRefs);
  const currentAssertions = currentApplicableAssertions(
    snapshot,
    requiredSubjectFacets,
    effectiveAt
  );
  if (
    !isLocallySelfAttestableOwnerPrivateDecision({
      snapshot,
      effectiveAt,
      decision,
      requiredSubjectFacets,
      currentAssertions,
    })
  ) {
    return undefined;
  }
  const assertionObservations = currentAssertions.map((assertion) => ({
    rightsAssertionRef: recordRef(assertion),
    firstObservedRevision: observationRevision(snapshot, recordRef(assertion)),
  }));
  if (
    assertionObservations.some(({ firstObservedRevision }) => firstObservedRevision === undefined)
  ) {
    return undefined;
  }

  const receiptSeed = referenceSourceDigest({
    snapshotRef: recordRef(snapshot),
    decisionRef: recordRef(decision),
    effectiveAt,
    keyId,
  });
  const unsigned = {
    recordKind: "reference_authority_verification_receipt" as const,
    schemaVersion: 1 as const,
    id: `reference-authority-receipt.${receiptSeed.slice(0, 24)}`,
    observedSnapshotRef: recordRef(snapshot),
    accessDecisionRef: recordRef(decision),
    accessDecisionFirstObservedRevision: decisionRevision,
    reviewedProvenanceSubstitutionRefs: deriveRequiredReviewedProvenanceSubstitutionRefs(
      snapshot,
      decision,
      effectiveAt
    ),
    currentRightsAssertionRefs: currentAssertions.map(recordRef),
    rightsAssertionObservations: assertionObservations.map((observation) => ({
      rightsAssertionRef: observation.rightsAssertionRef,
      firstObservedRevision: observation.firstObservedRevision!,
    })),
    authoritySubjectRefs,
    verifiedAuthorityRefs: uniqueRefs(decision.authorityRefs),
    requiredFacets,
    requiredSubjectFacets,
    // An explicit evidence-bearing `not_applicable` Rights Assertion is
    // evaluated as such by the authority evaluator. Creating a second receipt-
    // local N/A result would conflict with that assertion, so missing facets
    // deliberately remain missing and fail closed.
    verifierRef,
    verifierPolicyRef,
    verifiedAt: effectiveAt,
    validUntil: receiptExpiry(effectiveAt),
    proof: {
      kind: "server_signature" as const,
      algorithm: "hmac-sha256" as const,
      keyId,
      signature: "pending",
    },
  };
  const placeholder = withReferenceRecordDigest(unsigned) as ReferenceAuthorityVerificationReceipt;
  const signature = signHmac(secret, referenceAuthorityReceiptSigningPayload(placeholder));
  return withReferenceRecordDigest({
    ...unsigned,
    proof: { ...unsigned.proof, signature },
  }) as ReferenceAuthorityVerificationReceipt;
}

/**
 * The process-local verifier is intentionally not a general rights authority.
 * It may authenticate only the Owner's narrow claim that an exact local upload
 * can be used for private local study. Provider egress, publication, export,
 * redistribution, and every non-Owner claim require an independently supplied
 * verifier and therefore receive no default receipt.
 */
function isLocallySelfAttestableOwnerPrivateDecision(input: {
  snapshot: Readonly<ReferenceSourceStagingSnapshot>;
  effectiveAt: string;
  decision: ReferenceAccessDecision;
  requiredSubjectFacets: readonly ReferenceAuthoritySubjectFacetRequirement[];
  currentAssertions: readonly ReferenceRightsAssertion[];
}): boolean {
  const { snapshot, effectiveAt, decision, requiredSubjectFacets, currentAssertions } = input;
  if (
    decision.outcome !== "allow" ||
    decision.operation !== "owner_private_study" ||
    decision.destination.kind !== "local_runtime" ||
    requiredSubjectFacets.length === 0 ||
    currentAssertions.length === 0 ||
    !sameRefSet(currentAssertions.map(recordRef), decision.rightsAssertionRefs)
  ) {
    return false;
  }

  const recordsByRef = new Map(snapshot.records.map((record) => [refKey(record), record]));
  if (
    requiredSubjectFacets.some(({ subjectRef, facet }) => {
      const subject = recordsByRef.get(refKey(subjectRef));
      return (
        facet !== "owner_private_access" ||
        subject?.recordKind !== "asset_acquisition" ||
        subject.origin.sourceKind !== "upload"
      );
    })
  ) {
    return false;
  }

  const ownerAuthorityRefs = uniqueRefs(
    currentAssertions.flatMap((assertion) =>
      assertion.claimant.kind === "owner" ? [assertion.claimant.claimantRef] : []
    )
  );
  const currentAssertionRefs = currentAssertions.map(recordRef);
  const reviewedSubstitutions = deriveRequiredReviewedProvenanceSubstitutionRefs(
    snapshot,
    decision,
    effectiveAt
  ).map((ref) => recordsByRef.get(refKey(ref)));
  return (
    ownerAuthorityRefs.length > 0 &&
    sameRefSet(ownerAuthorityRefs, decision.authorityRefs) &&
    currentAssertions.every(
      (assertion) =>
        assertion.rightsKind === "owner_private_access" &&
        assertion.status === "permitted" &&
        assertion.claimant.kind === "owner" &&
        assertion.evidenceRefs.length > 0 &&
        Date.parse(assertion.assertedAt) <= Date.parse(effectiveAt)
    ) &&
    reviewedSubstitutions.every(
      (substitution) =>
        substitution?.recordKind === "provenance_substitution" &&
        substitution.authority.kind === "owner" &&
        containsRef(ownerAuthorityRefs, substitution.authority.authorityRef) &&
        sameRefSet(substitution.authority.evidenceRefs, currentAssertionRefs)
    )
  );
}

function createRetentionReceipt(input: {
  snapshot: Readonly<ReferenceSourceStagingSnapshot>;
  effectiveAt: string;
  binding: ReferenceAssetRoleBinding;
  authorityProofRef: ReferenceRecordRef;
  signingKeyRef: ReferenceRecordRef;
  verifierRef: ReferenceRecordRef;
  secret: Buffer;
}): ReferenceSourceRetentionAuthorityReceipt {
  const { snapshot, effectiveAt, binding, authorityProofRef, signingKeyRef, verifierRef, secret } =
    input;
  const receiptSeed = referenceSourceDigest({
    snapshotRef: recordRef(snapshot),
    roleBindingRef: recordRef(binding),
    effectiveAt,
    signingKeyRef,
  });
  const unsigned = {
    recordKind: "reference_retention_authority_receipt" as const,
    schemaVersion: 1 as const,
    id: `reference-retention-receipt.${receiptSeed.slice(0, 24)}`,
    observedSnapshotRef: recordRef(snapshot),
    roleBindingRef: recordRef(binding),
    digitalAssetRef: binding.digitalAssetRef,
    acquisitionRefs: uniqueRefs(binding.acquisitionRefs),
    accessDecisionRefs: uniqueRefs(binding.accessDecisionRefs),
    retentionPolicyRef: binding.retentionPolicyRef,
    outcome: "retain" as const,
    verifiedAt: effectiveAt,
    validUntil: receiptExpiry(effectiveAt),
    authorityProofRef,
    signingKeyRef,
    verifierRef,
    proof: {
      kind: "server_signature" as const,
      algorithm: "hmac-sha256" as const,
      signature: "pending",
    },
  };
  const placeholder = withReferenceRecordDigest(
    unsigned
  ) as ReferenceSourceRetentionAuthorityReceipt;
  const signature = signHmac(
    secret,
    referenceSourceRetentionAuthorityReceiptSigningPayload(placeholder)
  );
  return withReferenceRecordDigest({
    ...unsigned,
    proof: { ...unsigned.proof, signature },
  }) as ReferenceSourceRetentionAuthorityReceipt;
}

function currentApplicableAssertions(
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  requiredSubjectFacets: readonly ReferenceAuthoritySubjectFacetRequirement[],
  effectiveAt: string
): ReferenceRightsAssertion[] {
  const currentById = new Map<string, ReferenceRightsAssertion>();
  for (const record of snapshot.records) {
    if (
      record.recordKind !== "rights_assertion" ||
      Date.parse(record.assertedAt) > Date.parse(effectiveAt) ||
      !requiredSubjectFacets.some(
        ({ subjectRef, facet }) =>
          facet === record.rightsKind && refsEqual(subjectRef, record.subjectRef)
      )
    ) {
      continue;
    }
    const current = currentById.get(record.id);
    if (!current || record.version > current.version) currentById.set(record.id, record);
  }
  return [...currentById.values()].sort(compareVersionedRecords);
}

function observationRevision(
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  target: ReferenceRecordRef
): number | undefined {
  const observation = snapshot.recordObservations?.find(({ recordRef: candidate }) =>
    refsEqual(candidate, target)
  );
  return observation?.orderingTrust === "server_observed"
    ? observation.firstObservedRevision
    : undefined;
}

function receiptExpiry(effectiveAt: string): string {
  return new Date(Date.parse(effectiveAt) + RECEIPT_LIFETIME_MS).toISOString();
}

function signHmac(secret: Buffer, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function verifyHmac(secret: Buffer, payload: string, signature: string): boolean {
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secret).update(payload).digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}

function recordRef(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function refKey(ref: ReferenceRecordRef): string {
  return `${ref.id}\u0000${ref.digest}`;
}

function refsEqual(left: ReferenceRecordRef, right: ReferenceRecordRef): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function containsRef(refs: readonly ReferenceRecordRef[], target: ReferenceRecordRef): boolean {
  return refs.some((ref) => refsEqual(ref, target));
}

function sameRefSet(
  left: readonly ReferenceRecordRef[],
  right: readonly ReferenceRecordRef[]
): boolean {
  if (left.length !== right.length) return false;
  const leftKeys = new Set(left.map(refKey));
  const rightKeys = new Set(right.map(refKey));
  return (
    leftKeys.size === left.length &&
    rightKeys.size === right.length &&
    [...leftKeys].every((key) => rightKeys.has(key))
  );
}

function uniqueRefs(refs: readonly ReferenceRecordRef[]): ReferenceRecordRef[] {
  return [...new Map(refs.map((ref) => [refKey(ref), structuredClone(ref)])).values()].sort(
    compareRefs
  );
}

function compareRefs(left: ReferenceRecordRef, right: ReferenceRecordRef): number {
  return left.id.localeCompare(right.id) || left.digest.localeCompare(right.digest);
}

function compareVersionedRecords(
  left: Pick<ReferenceRightsAssertion, "id" | "version" | "digest">,
  right: Pick<ReferenceRightsAssertion, "id" | "version" | "digest">
): number {
  return (
    left.id.localeCompare(right.id) ||
    left.version - right.version ||
    left.digest.localeCompare(right.digest)
  );
}
