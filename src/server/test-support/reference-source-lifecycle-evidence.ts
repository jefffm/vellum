import {
  REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS,
  type ReferenceAuthorityVerificationReceipt,
} from "../../lib/reference-source-authority.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceStagingSnapshot,
} from "../../lib/reference-source-domain.js";
import {
  bindReferenceSourceInventoryClosureWitness,
  bindReferenceSourceRequiredStoreRegistry,
  bindReferenceSourceStoreEnumeration,
} from "../../lib/reference-source-inventory.js";
import type { ReferenceSourceRetentionAuthorityReceipt } from "../../lib/reference-source-retention-authority.js";
import {
  deriveReferenceSourceAuthoritySubjectClosure,
  deriveRequiredReviewedProvenanceSubstitutionRefs,
  deriveRequiredReferenceSourceAuthoritySubjectFacets,
  type ReferenceSourceAuthorityTrust,
  type ReferenceSourceLifecycleEvidenceProvider,
  type ReferenceSourceRetentionAuthorityTrust,
} from "../lib/reference-source-lifecycle-service.js";

export const TEST_REFERENCE_AUTHORITY_RECEIPT_VERIFIER = () => true;
export const TEST_REFERENCE_AUTHORITY_TRUST: ReferenceSourceAuthorityTrust = {
  verifyReceipt: TEST_REFERENCE_AUTHORITY_RECEIPT_VERIFIER,
  verifierRef: externalRef("test-authority-verifier"),
  verifierPolicyRef: externalRef("test-authority-policy"),
  algorithm: "hmac-sha256",
  keyId: "test-only-key",
};
export const TEST_REFERENCE_RETENTION_AUTHORITY_TRUST: ReferenceSourceRetentionAuthorityTrust = {
  verifyReceipt: () => true,
  authorityProofRef: externalRef("test-retention-authority-proof"),
  signingKeyRef: externalRef("test-retention-signing-key"),
  verifierRef: externalRef("test-retention-verifier"),
};

/** Deterministic fake-server evidence for tests that exercise the trusted service boundary. */
export function createTestReferenceSourceLifecycleEvidenceProvider(): ReferenceSourceLifecycleEvidenceProvider {
  return ({ snapshot, effectiveAt }) => {
    const registry = bindReferenceSourceRequiredStoreRegistry({
      schemaVersion: 1,
      registryGeneration: snapshot.revision,
      stores: [
        {
          storeId: "reference-source-staging",
          storeKind: "reference_source_staging",
          controlBoundary: "vellum_controlled",
          required: true,
          storeGeneration: snapshot.revision,
          storeStateDigest: snapshot.digest,
        },
      ],
    });
    const enumeration = bindReferenceSourceStoreEnumeration({
      storeId: "reference-source-staging",
      storeGeneration: snapshot.revision,
      storeStateDigest: snapshot.digest,
      status: "complete",
      artifactBindings: controlledArtifactBindings(snapshot),
    });
    const witness = bindReferenceSourceInventoryClosureWitness({
      schemaVersion: 1,
      producer: {
        kind: "vellum_server",
        instanceId: "vellum-test-server",
        buildDigest: referenceSourceDigest({ build: "vellum-test-server" }),
      },
      producedAt: effectiveAt,
      requiredStoreRegistryRef: ref(registry),
      requiredStoreRegistryGeneration: registry.registryGeneration,
      status: "complete",
      storeEnumerations: [enumeration],
    });
    const decisions = snapshot.records.filter(
      (record): record is ReferenceAccessDecision => record.recordKind === "access_decision"
    );
    const roleBindings = snapshot.records.filter(
      (record) =>
        record.recordKind === "arrangement_source_binding" ||
        record.recordKind === "owner_reference_binding" ||
        record.recordKind === "evaluation_source_binding"
    );
    return {
      inventory: { currentRegistry: registry, witness },
      authorityReceipts: decisions.map((decision) => receipt(decision, snapshot, effectiveAt)),
      retentionAuthorityReceipts: roleBindings.map((binding) =>
        retentionReceipt(binding, snapshot, effectiveAt)
      ),
    };
  };
}

function retentionReceipt(
  binding: Extract<
    ReferenceSourceStagingSnapshot["records"][number],
    {
      recordKind:
        | "arrangement_source_binding"
        | "owner_reference_binding"
        | "evaluation_source_binding";
    }
  >,
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  effectiveAt: string
): ReferenceSourceRetentionAuthorityReceipt {
  return withReferenceRecordDigest({
    recordKind: "reference_retention_authority_receipt",
    schemaVersion: 1,
    id: `retention-receipt.${binding.id}`,
    observedSnapshotRef: ref(snapshot),
    roleBindingRef: ref(binding),
    digitalAssetRef: binding.digitalAssetRef,
    acquisitionRefs: binding.acquisitionRefs,
    accessDecisionRefs: binding.accessDecisionRefs,
    retentionPolicyRef: binding.retentionPolicyRef,
    outcome: "retain",
    verifiedAt: effectiveAt,
    validUntil: "2099-12-31T23:59:59.999Z",
    authorityProofRef: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST.authorityProofRef,
    signingKeyRef: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST.signingKeyRef,
    verifierRef: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST.verifierRef,
    proof: {
      kind: "server_signature",
      algorithm: "hmac-sha256",
      signature: "test-only-retention-signature",
    },
  }) as ReferenceSourceRetentionAuthorityReceipt;
}

function receipt(
  decision: ReferenceAccessDecision,
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  effectiveAt: string
): ReferenceAuthorityVerificationReceipt {
  const assertions = snapshot.records.filter(
    (record): record is ReferenceRightsAssertion =>
      record.recordKind === "rights_assertion" &&
      decision.rightsAssertionRefs.some((item) =>
        refsEqual(item, { id: record.id, digest: record.digest })
      )
  );
  const requiredFacets = [...REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS[decision.operation]];
  const authoritySubjectRefs = deriveReferenceSourceAuthoritySubjectClosure(snapshot, decision);
  const requiredSubjectFacets = deriveRequiredReferenceSourceAuthoritySubjectFacets(
    snapshot,
    decision,
    authoritySubjectRefs
  );
  const assertedSubjectFacets = new Set(
    assertions.map(
      (assertion) =>
        `${assertion.subjectRef.id}\u0000${assertion.subjectRef.digest}\u0000${assertion.rightsKind}`
    )
  );
  return withReferenceRecordDigest({
    recordKind: "reference_authority_verification_receipt",
    schemaVersion: 1,
    id: `authority-receipt.${decision.id}.${decision.version}`,
    observedSnapshotRef: ref(snapshot),
    accessDecisionRef: ref(decision),
    accessDecisionFirstObservedRevision: observationRevision(snapshot, ref(decision)),
    reviewedProvenanceSubstitutionRefs: deriveRequiredReviewedProvenanceSubstitutionRefs(
      snapshot,
      decision,
      effectiveAt
    ),
    currentRightsAssertionRefs: decision.rightsAssertionRefs,
    rightsAssertionObservations: decision.rightsAssertionRefs.map((rightsAssertionRef) => ({
      rightsAssertionRef,
      firstObservedRevision: observationRevision(snapshot, rightsAssertionRef),
    })),
    authoritySubjectRefs,
    verifiedAuthorityRefs: decision.authorityRefs,
    requiredFacets,
    requiredSubjectFacets,
    notApplicableFacets: requiredSubjectFacets
      .filter(
        ({ subjectRef, facet }) =>
          !assertedSubjectFacets.has(`${subjectRef.id}\u0000${subjectRef.digest}\u0000${facet}`)
      )
      .map(({ subjectRef, facet }) => ({
        subjectRef,
        facet,
        rationale: `Test fixture marks ${facet} inapplicable for ${subjectRef.id} through the fake trusted verifier`,
        evidenceRefs: [externalRef(`test-not-applicable.${decision.id}.${subjectRef.id}.${facet}`)],
      })),
    verifierRef: externalRef("test-authority-verifier"),
    verifierPolicyRef: externalRef("test-authority-policy"),
    verifiedAt: effectiveAt,
    proof: {
      kind: "server_signature",
      algorithm: "hmac-sha256",
      keyId: "test-only-key",
      signature: "test-only-signature",
    },
  }) as ReferenceAuthorityVerificationReceipt;
}

function controlledArtifactBindings(snapshot: Readonly<ReferenceSourceStagingSnapshot>) {
  const refs: ReferenceRecordRef[] = [];
  for (const record of snapshot.records) {
    if (record.recordKind === "digital_asset") refs.push(ref(record));
    if (record.recordKind === "source_derivation") refs.push(record.derivedRef);
    if (
      record.recordKind === "lifecycle_storage_policy" &&
      record.custody.kind === "vellum_controlled"
    ) {
      refs.push(record.subjectRef);
    }
  }
  return uniqueRefs(refs).map((artifactRef) => {
    const digitalAsset = snapshot.records.find(
      (record) => record.recordKind === "digital_asset" && refsEqual(ref(record), artifactRef)
    );
    return {
      artifactRef,
      blobSha256:
        digitalAsset?.recordKind === "digital_asset"
          ? digitalAsset.sha256
          : referenceSourceDigest({ schemaVersion: 1, artifactRef, fixture: "test-bytes" }),
      byteLength: digitalAsset?.recordKind === "digital_asset" ? digitalAsset.byteLength : 0,
    };
  });
}

function uniqueRefs(refs: ReferenceRecordRef[]): ReferenceRecordRef[] {
  return [...new Map(refs.map((item) => [`${item.id}\u0000${item.digest}`, item])).values()];
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}

function refsEqual(left: ReferenceRecordRef, right: ReferenceRecordRef): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function observationRevision(
  snapshot: Readonly<ReferenceSourceStagingSnapshot>,
  target: ReferenceRecordRef
): number {
  const observation = snapshot.recordObservations?.find(({ recordRef }) =>
    refsEqual(recordRef, target)
  );
  if (!observation || observation.orderingTrust !== "server_observed") {
    throw new Error(`Missing trusted test observation for ${target.id}`);
  }
  return observation.firstObservedRevision;
}
