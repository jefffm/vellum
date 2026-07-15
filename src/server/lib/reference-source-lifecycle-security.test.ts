import {
  evaluateReferenceSourceAuthority,
  referenceAuthorityReceiptSigningPayload,
  type ReferenceAuthorityVerificationReceipt,
} from "../../lib/reference-source-authority.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAssetRoleBinding,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingSnapshot,
} from "../../lib/reference-source-domain.js";
import { planReferenceSourceInventoryClosure } from "../../lib/reference-source-inventory.js";
import {
  evaluateReferenceSourceRetentionAuthority,
  referenceSourceRetentionAuthorityReceiptSigningPayload,
  type ReferenceSourceRetentionAuthorityReceipt,
} from "../../lib/reference-source-retention-authority.js";
import { describe, expect, it } from "vitest";
import {
  deriveReferenceSourceAuthoritySubjectClosure,
  deriveRequiredReferenceSourceAuthoritySubjectFacets,
} from "./reference-source-lifecycle-service.js";
import { createReferenceSourceLifecycleSecurityBundle } from "./reference-source-lifecycle-security.js";
import { createUnlinkedReferenceSourceStagingInventoryAdapter } from "./reference-source-inventory-provider.js";

const RECORDED_AT = "2026-07-15T12:00:00.000Z";
const EFFECTIVE_AT = "2026-07-15T13:00:00.000Z";

describe("process-local reference-source lifecycle security", () => {
  it("authenticates its own authority receipt and rejects a redigested HMAC tamper", () => {
    const fixture = ownerPrivateFixture();
    const security = createSecurity();
    const receipt = authorityReceipt(security, fixture.snapshot);

    expect(
      security.authorityTrust.verifyReceipt({
        receipt,
        signingPayload: referenceAuthorityReceiptSigningPayload(receipt),
      })
    ).toBe(true);

    const tampered = redigestAuthorityReceipt(receipt, {
      validUntil: "2099-12-31T23:59:59.999Z",
    });
    expect(
      security.authorityTrust.verifyReceipt({
        receipt: tampered,
        signingPayload: referenceAuthorityReceiptSigningPayload(tampered),
      })
    ).toBe(false);
    expect(
      security.authorityTrust.verifyReceipt({
        receipt: tampered,
        signingPayload: referenceAuthorityReceiptSigningPayload(receipt),
      })
    ).toBe(false);
    expect(
      createSecurity().authorityTrust.verifyReceipt({
        receipt,
        signingPayload: referenceAuthorityReceiptSigningPayload(receipt),
      })
    ).toBe(false);
  });

  it("returns byte-for-byte deterministic evidence on two reads in one process bundle", () => {
    const fixture = ownerPrivateFixture();
    const security = createSecurity();
    const input = { snapshot: fixture.snapshot, effectiveAt: EFFECTIVE_AT };

    const first = security.evidenceProvider(input);
    const second = security.evidenceProvider(structuredClone(input));

    expect(second).toEqual(first);
    expect(
      planReferenceSourceInventoryClosure({
        currentRegistry: first.inventory.currentRegistry,
        witness: first.inventory.witness,
      })
    ).toMatchObject({
      status: "blocked",
      issues: [expect.objectContaining({ code: "failed_store_enumeration" })],
    });
    expect(first.inventory.currentRegistry.stores.map(({ storeId }) => storeId)).toEqual([
      "reference-source-staging",
    ]);
  });

  it("allows an explicit evidence-bearing owner-private authority fixture", () => {
    const fixture = ownerPrivateFixture();
    const security = createSecurity();
    const receipt = authorityReceipt(security, fixture.snapshot);
    const authoritySubjectRefs = deriveReferenceSourceAuthoritySubjectClosure(
      fixture.snapshot,
      fixture.decision
    );
    const requiredSubjectFacets = deriveRequiredReferenceSourceAuthoritySubjectFacets(
      fixture.snapshot,
      fixture.decision,
      authoritySubjectRefs
    );

    const evaluation = evaluateReferenceSourceAuthority({
      schemaVersion: 1,
      effectiveAt: EFFECTIVE_AT,
      accessDecisionRef: ref(fixture.decision),
      authoritySubjectRefs,
      requiredSubjectFacets,
      accessDecisions: [fixture.decision],
      rightsAssertions: fixture.rightsAssertions,
      receipt,
      verifyServerReceipt: security.authorityTrust.verifyReceipt,
    });

    expect(requiredSubjectFacets).toEqual([
      { subjectRef: ref(fixture.acquisition), facet: "owner_private_access" },
    ]);
    expect(evaluation).toMatchObject({ status: "allow", findings: [] });
  });

  it("does not sign an incomplete Owner-private authority closure", () => {
    const fixture = ownerPrivateFixture({ includeRightsAssertion: false });
    const security = createSecurity();
    expect(
      security.evidenceProvider({ snapshot: fixture.snapshot, effectiveAt: EFFECTIVE_AT })
        .authorityReceipts
    ).toEqual([]);
  });

  it("never turns the process-local key into export authority or a forged Owner claim", () => {
    const fixture = ownerPrivateFixture();
    const security = createSecurity();
    const originalRights = fixture.rightsAssertions[0]!;
    const { digest: _rightsDigest, ...rightsCore } = originalRights;
    const exportRights = record({
      ...rightsCore,
      id: "rights.local-security.export",
      rightsKind: "export_redistribution",
    });
    const { digest: _decisionDigest, assetRole: _assetRole, ...decisionCore } = fixture.decision;
    const exportDecision = record({
      ...decisionCore,
      id: "access.local-security.export",
      operation: "export",
      destination: { kind: "export", id: "export.public" },
      purpose: "Attempt to export with only the process-local key",
      rightsAssertionRefs: [ref(exportRights)],
      rationale: "Must require an independent export authority",
    });
    const exportSnapshot = snapshotFromRecords(
      fixture.snapshot.records
        .filter(
          (record) =>
            record.id !== originalRights.id &&
            record.id !== fixture.decision.id &&
            record.recordKind !== "owner_reference_binding" &&
            record.recordKind !== "lifecycle_storage_policy"
        )
        .concat(exportRights, exportDecision)
    );
    expect(
      security.evidenceProvider({ snapshot: exportSnapshot, effectiveAt: EFFECTIVE_AT })
        .authorityReceipts
    ).toEqual([]);

    const forgedDecision = record({
      ...decisionCore,
      authorityRefs: [externalRef("attacker.not-owner")],
    });
    const forgedSnapshot = snapshotFromRecords(
      fixture.snapshot.records.map((record) =>
        record.id === fixture.decision.id ? forgedDecision : record
      )
    );
    expect(
      security.evidenceProvider({ snapshot: forgedSnapshot, effectiveAt: EFFECTIVE_AT })
        .authorityReceipts
    ).toEqual([]);

    const restrictedRights = record({ ...rightsCore, status: "restricted" });
    const restrictedDecision = record({
      ...decisionCore,
      rightsAssertionRefs: [ref(restrictedRights)],
    });
    const restrictedSnapshot = snapshotFromRecords(
      fixture.snapshot.records.map((record) =>
        record.id === originalRights.id
          ? restrictedRights
          : record.id === fixture.decision.id
            ? restrictedDecision
            : record
      )
    );
    expect(
      security.evidenceProvider({ snapshot: restrictedSnapshot, effectiveAt: EFFECTIVE_AT })
        .authorityReceipts
    ).toEqual([]);
  });

  it("signs only Owner-attested substitution review, never a claimed reviewer shortcut", () => {
    const fixture = ownerPrivateFixture();
    const security = createSecurity();
    const mapping = {
      recordKind: "provenance_substitution" as const,
      id: "substitution.local-security",
      from: {
        acquisitionRef: externalRef("acquisition.previous"),
        derivationRef: externalRef("derivation.previous"),
      },
      to: {
        acquisitionRef: ref(fixture.acquisition),
        derivationRef: externalRef("derivation.replacement"),
      },
      scope: {
        operation: fixture.decision.operation,
        sourceAndDerivativeRefs: [
          externalRef("acquisition.previous"),
          externalRef("derivation.previous"),
          ref(fixture.acquisition),
          externalRef("derivation.replacement"),
        ],
        destination: fixture.decision.destination,
        purpose: fixture.decision.purpose,
        policyRef: fixture.decision.policyRef,
      },
      accessDecisionRef: ref(fixture.decision),
      rationale: "Exact mapping review must be authenticated",
      decidedAt: RECORDED_AT,
    };
    const claimedReviewer = record({
      ...mapping,
      authority: {
        kind: "rights_reviewer",
        authorityRef: externalRef("owner.local"),
        evidenceRefs: [ref(fixture.rightsAssertions[0]!)],
      },
    });
    const claimedReviewerSnapshot = snapshotFromRecords([
      ...fixture.snapshot.records,
      claimedReviewer,
    ]);
    expect(
      security.evidenceProvider({
        snapshot: claimedReviewerSnapshot,
        effectiveAt: EFFECTIVE_AT,
      }).authorityReceipts
    ).toEqual([]);

    const ownerReviewed = record({
      ...mapping,
      id: "substitution.local-security.owner-reviewed",
      authority: {
        kind: "owner",
        authorityRef: externalRef("owner.local"),
        evidenceRefs: [ref(fixture.rightsAssertions[0]!)],
      },
    });
    const ownerReviewedSnapshot = snapshotFromRecords([...fixture.snapshot.records, ownerReviewed]);
    const receipts = security.evidenceProvider({
      snapshot: ownerReviewedSnapshot,
      effectiveAt: EFFECTIVE_AT,
    }).authorityReceipts;
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.reviewedProvenanceSubstitutionRefs).toEqual([ref(ownerReviewed)]);
  });

  it("accepts only the exact signed role-binding tuple and conservatively retains it", () => {
    const fixture = ownerPrivateFixture();
    const security = createSecurity();
    const receipt = security.evidenceProvider({
      snapshot: fixture.snapshot,
      effectiveAt: EFFECTIVE_AT,
    }).retentionAuthorityReceipts[0]!;
    const exact = retentionInput(fixture, security, receipt);

    expect(evaluateReferenceSourceRetentionAuthority(exact)).toMatchObject({
      status: "allow",
      outcome: "retain",
      findings: [],
    });
    expect(
      security.retentionAuthorityTrust.verifyReceipt({
        receipt,
        signingPayload: referenceSourceRetentionAuthorityReceiptSigningPayload(receipt),
      })
    ).toBe(true);

    const wrongTuple = evaluateReferenceSourceRetentionAuthority({
      ...exact,
      acquisitionRefs: [externalRef("acquisition.not-the-role-binding")],
    });
    expect(wrongTuple.status).toBe("blocked");
    expect(wrongTuple.outcome).toBe("retain");
    expect(wrongTuple.findings.map(({ code }) => code)).toContain("receipt_scope_mismatch");

    const releasedWithoutResigning = redigestRetentionReceipt(receipt, { outcome: "release" });
    const tampered = evaluateReferenceSourceRetentionAuthority({
      ...exact,
      receipt: releasedWithoutResigning,
    });
    expect(tampered.status).toBe("blocked");
    expect(tampered.outcome).toBe("retain");
    expect(tampered.findings.map(({ code }) => code)).toContain("receipt_signature_invalid");
  });
});

function createSecurity(): ReturnType<typeof createReferenceSourceLifecycleSecurityBundle> {
  return createReferenceSourceLifecycleSecurityBundle({
    inventoryAdapters: [createUnlinkedReferenceSourceStagingInventoryAdapter()],
  });
}

function ownerPrivateFixture(options: { includeRightsAssertion?: boolean } = {}): {
  snapshot: ReferenceSourceStagingSnapshot;
  acquisition: Extract<ReferenceSourceStagingRecord, { recordKind: "asset_acquisition" }>;
  decision: ReferenceAccessDecision;
  binding: ReferenceAssetRoleBinding;
  rightsAssertions: ReferenceRightsAssertion[];
} {
  const asset = record({
    recordKind: "digital_asset",
    id: "asset.local-security",
    sha256: "a".repeat(64),
    mediaType: "application/pdf",
    byteLength: 1024,
  });
  const acquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.local-security",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: {
      sourceKind: "upload",
      ownerActionRef: externalRef("owner-action.local-security"),
    },
    acquiredAt: RECORDED_AT,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.local-security"),
  });
  const rights = record({
    recordKind: "rights_assertion",
    id: "rights.local-security.owner-private",
    version: 1,
    subjectRef: ref(acquisition),
    subjectKind: "asset_acquisition",
    rightsKind: "owner_private_access",
    status: "permitted",
    claimant: { kind: "owner", claimantRef: externalRef("owner.local") },
    evidenceRefs: [externalRef("evidence.owner-upload")],
    assertedAt: RECORDED_AT,
  });
  const rightsAssertions = options.includeRightsAssertion === false ? [] : [rights];
  const decision = record({
    recordKind: "access_decision",
    id: "access.local-security.owner-private",
    version: 1,
    outcome: "allow",
    operation: "owner_private_study",
    sourceRefs: [ref(acquisition), ref(asset)],
    derivativeRefs: [],
    destination: { kind: "local_runtime" },
    purpose: "Arrange an explicitly Owner-provided source locally",
    assetRole: "owner_reference",
    policyRef: externalRef("access-policy.owner-private-study"),
    rightsAssertionRefs: rightsAssertions.map(ref),
    authorityRefs: [externalRef("owner.local")],
    rationale: "Explicit evidence-bearing Owner-private access",
    decidedAt: RECORDED_AT,
  });
  const binding = record({
    recordKind: "owner_reference_binding",
    id: "binding.local-security.owner-reference",
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(acquisition)],
    accessDecisionRefs: [ref(decision)],
    retentionPolicyRef: externalRef("retention-policy.owner-library"),
    ownerLibraryRef: externalRef("owner-library.local"),
    createdAt: RECORDED_AT,
  });
  const storage = record({
    recordKind: "lifecycle_storage_policy",
    id: "storage.local-security",
    version: 1,
    subjectRef: ref(asset),
    subjectKind: "asset_bytes",
    provenancePaths: [
      {
        acquisitionRefs: [ref(acquisition)],
        derivationRefs: [],
        roleBindingRefs: [ref(binding)],
      },
    ],
    policyRef: externalRef("lifecycle-policy.local-security"),
    custody: {
      kind: "vellum_controlled",
      storeIds: ["reference-source-staging"],
      retention: "required_hold",
      tombstonePolicy: "preserve",
    },
    replayRequirement: "required",
    readinessRequirement: "required",
    createdAt: RECORDED_AT,
  });
  const records: ReferenceSourceStagingRecord[] = [
    asset,
    acquisition,
    ...rightsAssertions,
    decision,
    binding,
    storage,
  ];
  const snapshotCore = {
    schemaVersion: 1 as const,
    id: "reference-source-snapshot.local-security",
    revision: 1,
    publicationState: "staging_only" as const,
    createdAt: RECORDED_AT,
    recordObservations: records.map((entry) => ({
      recordRef: ref(entry),
      firstObservedRevision: 1,
      observedAt: RECORDED_AT,
      orderingTrust: "server_observed" as const,
    })),
    records,
  };
  const snapshot = {
    ...snapshotCore,
    digest: referenceSourceDigest(snapshotCore),
  } as ReferenceSourceStagingSnapshot;
  return { snapshot, acquisition, decision, binding, rightsAssertions };
}

function snapshotFromRecords(
  records: ReferenceSourceStagingRecord[]
): ReferenceSourceStagingSnapshot {
  const core = {
    schemaVersion: 1 as const,
    id: `reference-source-snapshot.security-${referenceSourceDigest(records).slice(0, 12)}`,
    revision: 1,
    publicationState: "staging_only" as const,
    createdAt: RECORDED_AT,
    recordObservations: records.map((entry) => ({
      recordRef: ref(entry),
      firstObservedRevision: 1,
      observedAt: RECORDED_AT,
      orderingTrust: "server_observed" as const,
    })),
    records,
  };
  return { ...core, digest: referenceSourceDigest(core) };
}

function authorityReceipt(
  security: ReturnType<typeof createReferenceSourceLifecycleSecurityBundle>,
  snapshot: ReferenceSourceStagingSnapshot
): ReferenceAuthorityVerificationReceipt {
  const receipt = security.evidenceProvider({ snapshot, effectiveAt: EFFECTIVE_AT })
    .authorityReceipts[0];
  if (!receipt) throw new Error("Expected an authority receipt");
  return receipt;
}

function retentionInput(
  fixture: ReturnType<typeof ownerPrivateFixture>,
  security: ReturnType<typeof createReferenceSourceLifecycleSecurityBundle>,
  receipt: ReferenceSourceRetentionAuthorityReceipt
) {
  return {
    schemaVersion: 1 as const,
    effectiveAt: EFFECTIVE_AT,
    observedSnapshotRef: ref(fixture.snapshot),
    roleBindingRef: ref(fixture.binding),
    digitalAssetRef: fixture.binding.digitalAssetRef,
    acquisitionRefs: fixture.binding.acquisitionRefs,
    accessDecisionRefs: fixture.binding.accessDecisionRefs,
    retentionPolicyRef: fixture.binding.retentionPolicyRef,
    authorityProofRef: security.retentionAuthorityTrust.authorityProofRef,
    signingKeyRef: security.retentionAuthorityTrust.signingKeyRef,
    verifierRef: security.retentionAuthorityTrust.verifierRef,
    receipt,
    verifyServerReceipt: security.retentionAuthorityTrust.verifyReceipt,
  };
}

function redigestAuthorityReceipt(
  receipt: ReferenceAuthorityVerificationReceipt,
  changes: Partial<Omit<ReferenceAuthorityVerificationReceipt, "digest">>
): ReferenceAuthorityVerificationReceipt {
  const { digest: _digest, ...core } = receipt;
  return withReferenceRecordDigest({
    ...core,
    ...changes,
  }) as ReferenceAuthorityVerificationReceipt;
}

function redigestRetentionReceipt(
  receipt: ReferenceSourceRetentionAuthorityReceipt,
  changes: Partial<Omit<ReferenceSourceRetentionAuthorityReceipt, "digest">>
): ReferenceSourceRetentionAuthorityReceipt {
  const { digest: _digest, ...core } = receipt;
  return withReferenceRecordDigest({
    ...core,
    ...changes,
  }) as ReferenceSourceRetentionAuthorityReceipt;
}

function record<const T extends Record<string, unknown>>(
  value: T
): T & ReferenceSourceStagingRecord {
  return withReferenceRecordDigest(value) as unknown as T & ReferenceSourceStagingRecord;
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}
