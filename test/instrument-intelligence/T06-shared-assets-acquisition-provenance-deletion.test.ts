import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAssetAcquisition,
  type ReferenceRecordRef,
  type ReferenceSourceDerivation,
  type ReferenceSourceStagingInputRecord,
  type ReferenceSourceStagingTransaction,
} from "../../src/lib/reference-source-domain.js";
import { ReferenceSourceLifecyclePlanningService } from "../../src/server/lib/reference-source-lifecycle-service.js";
import { createReferenceSourceLifecycleSecurityBundle } from "../../src/server/lib/reference-source-lifecycle-security.js";
import { ReferenceSourceControlledArtifactStore } from "../../src/server/lib/reference-source-controlled-artifact-store.js";
import { ReferenceSourceStagingService } from "../../src/server/lib/reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "../../src/server/lib/reference-source-staging-store.js";
import {
  TEST_REFERENCE_AUTHORITY_TRUST,
  TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
  createTestReferenceSourceLifecycleEvidenceProvider,
} from "../../src/server/test-support/reference-source-lifecycle-evidence.js";

const NOW = "2026-07-15T12:00:00.000Z";
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("T06 shared assets, acquisition provenance, and deletion", () => {
  it("keeps same-byte rights separate in either acquisition order and leaves legacy authority untouched", () => {
    const first = runOrdering(["repository", "local"]);
    const second = runOrdering(["local", "repository"]);

    expect(first.deleteRepository.consequences).toEqual(second.deleteRepository.consequences);
    expect(first.deleteRepository.permissions).toEqual(second.deleteRepository.permissions);
    expect(first.deleteLocal.consequences).toEqual(second.deleteLocal.consequences);
    expect(first.deleteLocal.permissions).toEqual(second.deleteLocal.permissions);

    expect(first.deleteRepository).toMatchObject({
      status: "ready",
      mode: "dry_run",
      permissions: [
        { useId: "use.local", state: "accessible", authorization: "direct" },
        { useId: "use.repository", state: "restricted", authorization: "none" },
      ],
    });
    expect(first.deleteLocal).toMatchObject({
      status: "ready",
      permissions: [
        { useId: "use.local", state: "restricted", authorization: "none" },
        { useId: "use.repository", state: "accessible", authorization: "direct" },
      ],
    });
    expect(first.before).toEqual(first.after);
    expect(first.after.legacyProjection.ownerReferences).toEqual([
      {
        id: "legacy.owner-reference",
        title: "Legacy compatibility source",
        citation: "Legacy citation",
        mimeType: "application/pdf",
        sha256: "9".repeat(64),
        createdAt: NOW,
        readOnly: true,
        identityConfidence: { kind: "unknown" },
      },
    ]);
    expect(first.after.capabilities).toEqual({
      stagingTransactions: true,
      canonicalPublication: false,
    });
    expect(Object.getOwnPropertyNames(ReferenceSourceLifecyclePlanningService.prototype)).toEqual([
      "constructor",
      "planDryRun",
    ]);
  });

  it("rolls back completely when planning is interrupted", () => {
    const harness = createHarness(["repository", "local"]);
    const before = harness.staging.readCurrent();
    const interrupted = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      now: () => new Date(NOW),
      evidenceProvider: createTestReferenceSourceLifecycleEvidenceProvider(),
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
      planner: () => {
        throw new Error("injected interruption before a complete plan exists");
      },
    });

    expect(() =>
      interrupted.planDryRun({
        schemaVersion: 1,
        expectedHeadRef: currentHeadRef(before),
        action: {
          kind: "delete_acquisition",
          targetAcquisitionRef: recordRef(harness.repositoryAcquisition),
          reason: "Exercise all-or-nothing rollback",
        },
      })
    ).toThrow(/injected interruption/);
    expect(harness.staging.readCurrent()).toEqual(before);
  });

  it("authorizes a later acquisition only through a receipt-bound reviewed substitution", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-t06-substitution-"));
    roots.push(root);
    const store = new ReferenceSourceStagingStore({ rootDirectory: root });
    const staging = new ReferenceSourceStagingService({
      store,
      now: () => new Date(NOW),
      createId: () => "t06-reviewed-substitution",
    });
    const graph = buildReviewedSubstitutionGraph();
    const committed = staging.applyTransaction(transaction(graph.records));
    const baseProvider = createTestReferenceSourceLifecycleEvidenceProvider();
    const service = new ReferenceSourceLifecyclePlanningService({
      store,
      now: () => new Date(NOW),
      evidenceProvider: baseProvider,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    const reviewed = service.planDryRun({
      schemaVersion: 1,
      expectedHeadRef: currentHeadRef(committed),
      action: {
        kind: "delete_acquisition",
        targetAcquisitionRef: recordRef(graph.restrictedAcquisition),
        reason: "Replace the restricted acquisition only through reviewed provenance",
      },
    });

    expect(reviewed).toMatchObject({
      status: "ready",
      permissions: [
        {
          useId: "use.reviewed-substitution",
          state: "accessible",
          authorization: "provenance_substitution",
          accessDecisionRef: recordRef(graph.replacementAccess),
        },
      ],
      verifiedEvidence: {
        authorityEvaluations: [
          expect.objectContaining({ accessDecisionRef: recordRef(graph.replacementAccess) }),
        ],
      },
    });

    const unboundService = new ReferenceSourceLifecyclePlanningService({
      store,
      now: () => new Date(NOW),
      evidenceProvider: (input) => {
        const evidence = baseProvider(input);
        evidence.authorityReceipts = evidence.authorityReceipts.map((receipt) =>
          receipt.accessDecisionRef.id === graph.replacementAccess.id
            ? withReferenceRecordDigest({
                ...withoutDigest(receipt),
                reviewedProvenanceSubstitutionRefs: [],
              })
            : receipt
        );
        return evidence;
      },
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });
    const unbound = unboundService.planDryRun({
      schemaVersion: 1,
      expectedHeadRef: currentHeadRef(committed),
      action: {
        kind: "delete_acquisition",
        targetAcquisitionRef: recordRef(graph.restrictedAcquisition),
        reason: "Reject a substitution omitted from the authenticated receipt",
      },
    });
    expect(unbound).toMatchObject({
      status: "blocked",
      issues: [expect.objectContaining({ code: "unverified_authority" })],
    });
  });

  it("does not demand authority for an active substitution outside every current use scope", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-t06-inert-substitution-"));
    roots.push(root);
    const store = new ReferenceSourceStagingStore({ rootDirectory: root });
    const staging = new ReferenceSourceStagingService({
      store,
      now: () => new Date(NOW),
      createId: () => "t06-inert-substitution",
    });
    const graph = buildReviewedSubstitutionGraph();
    const committed = staging.applyTransaction(transaction(graph.records));
    const baseProvider = createTestReferenceSourceLifecycleEvidenceProvider();
    const service = new ReferenceSourceLifecyclePlanningService({
      store,
      now: () => new Date(NOW),
      evidenceProvider: (input) => {
        const evidence = baseProvider(input);
        evidence.authorityReceipts = evidence.authorityReceipts.filter(
          ({ accessDecisionRef }) => accessDecisionRef.id !== graph.inertAccess.id
        );
        return evidence;
      },
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    const result = service.planDryRun({
      schemaVersion: 1,
      expectedHeadRef: currentHeadRef(committed),
      action: {
        kind: "delete_acquisition",
        targetAcquisitionRef: recordRef(graph.restrictedAcquisition),
        reason: "Ignore a provider-only substitution that cannot authorize the current local use",
      },
    });

    expect(result).toMatchObject({
      status: "ready",
      permissions: [
        expect.objectContaining({
          useId: "use.reviewed-substitution",
          authorization: "provenance_substitution",
          accessDecisionRef: recordRef(graph.replacementAccess),
        }),
      ],
    });
  });

  it("carries a reviewed substitution through real staging, production signing, inventory, and planning", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-t06-production-substitution-"));
    roots.push(root);
    const store = new ReferenceSourceStagingStore({
      rootDirectory: path.join(root, "staging"),
    });
    const staging = new ReferenceSourceStagingService({
      store,
      now: () => new Date(NOW),
      createId: () => "t06-production-substitution",
    });
    const graph = buildReviewedSubstitutionGraph();
    const committed = staging.applyTransaction(transaction(graph.records));
    const controlledStore = new ReferenceSourceControlledArtifactStore({
      rootDirectory: path.join(root, "controlled-artifacts"),
    });
    for (const artifact of graph.controlledArtifacts) controlledStore.put(artifact);
    const security = createReferenceSourceLifecycleSecurityBundle({
      inventoryAdapters: [controlledStore],
    });
    const service = new ReferenceSourceLifecyclePlanningService({
      store,
      now: () => new Date(NOW),
      evidenceProvider: security.evidenceProvider,
      authorityTrust: security.authorityTrust,
      retentionAuthorityTrust: security.retentionAuthorityTrust,
    });

    const result = service.planDryRun({
      schemaVersion: 1,
      expectedHeadRef: currentHeadRef(committed),
      action: {
        kind: "delete_acquisition",
        targetAcquisitionRef: recordRef(graph.restrictedAcquisition),
        reason: "Exercise the complete production substitution boundary",
      },
    });

    expect(result).toMatchObject({
      status: "ready",
      permissions: [
        expect.objectContaining({
          useId: "use.reviewed-substitution",
          authorization: "provenance_substitution",
          accessDecisionRef: recordRef(graph.replacementAccess),
        }),
      ],
      verifiedEvidence: {
        inventoryScope: "reference_source_staging_only",
        stores: [expect.objectContaining({ storeId: "reference-source-staging" })],
        authorityEvaluations: [
          expect.objectContaining({ accessDecisionRef: recordRef(graph.replacementAccess) }),
        ],
      },
    });
  });
});

function runOrdering(order: Array<"repository" | "local">) {
  const harness = createHarness(order);
  const before = harness.staging.readCurrent();
  const service = new ReferenceSourceLifecyclePlanningService({
    store: harness.store,
    now: () => new Date(NOW),
    evidenceProvider: createTestReferenceSourceLifecycleEvidenceProvider(),
    authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
    retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
  });
  const deleteRepository = service.planDryRun({
    schemaVersion: 1,
    expectedHeadRef: currentHeadRef(before),
    action: {
      kind: "delete_acquisition",
      targetAcquisitionRef: recordRef(harness.repositoryAcquisition),
      reason: "Remove only the repository acquisition",
    },
  });
  const deleteLocal = service.planDryRun({
    schemaVersion: 1,
    expectedHeadRef: currentHeadRef(before),
    action: {
      kind: "delete_acquisition",
      targetAcquisitionRef: recordRef(harness.localAcquisition),
      reason: "Remove only the local-study acquisition",
    },
  });
  if (deleteRepository.status !== "ready" || deleteLocal.status !== "ready") {
    throw new Error(
      `Expected both lifecycle plans to be ready: ${JSON.stringify({ deleteRepository, deleteLocal })}`
    );
  }
  return {
    before,
    deleteRepository,
    deleteLocal,
    after: harness.staging.readCurrent(),
  };
}

function createHarness(order: Array<"repository" | "local">): {
  store: ReferenceSourceStagingStore;
  staging: ReferenceSourceStagingService;
  repositoryAcquisition: ReferenceAssetAcquisition;
  localAcquisition: ReferenceAssetAcquisition;
} {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t06-"));
  roots.push(root);
  const store = new ReferenceSourceStagingStore({ rootDirectory: root });
  let sequence = 0;
  const staging = new ReferenceSourceStagingService({
    store,
    now: () => new Date(NOW),
    createId: () => "t06-" + ++sequence,
    listLegacyOwnerReferences: () => [
      {
        id: "legacy.owner-reference",
        title: "Legacy compatibility source",
        citation: "Legacy citation",
        mimeType: "application/pdf",
        sha256: "9".repeat(64),
        createdAt: NOW,
      },
    ],
  });
  const graph = buildGraph();
  const acquisitionsByRole = {
    repository: graph.repositoryAcquisition,
    local: graph.localAcquisition,
  };
  const orderedAcquisitions = order.map((role) => acquisitionsByRole[role]);
  const acquisitionIds = new Set(orderedAcquisitions.map((item) => item.id));
  const remaining = graph.records.filter((item) => !acquisitionIds.has(item.id));
  staging.applyTransaction(transaction([...orderedAcquisitions, ...remaining]));
  return {
    store,
    staging,
    repositoryAcquisition: graph.repositoryAcquisition,
    localAcquisition: graph.localAcquisition,
  };
}

function buildGraph(): {
  records: ReferenceSourceStagingInputRecord[];
  repositoryAcquisition: ReferenceAssetAcquisition;
  localAcquisition: ReferenceAssetAcquisition;
} {
  const asset = record({
    recordKind: "digital_asset",
    id: "asset.shared",
    sha256: "a".repeat(64),
    mediaType: "application/pdf",
    byteLength: 4096,
  });
  const repositoryRights = record({
    recordKind: "rights_assertion",
    id: "rights.repository",
    version: 1,
    subjectRef: ref(asset),
    subjectKind: "digital_asset",
    rightsKind: "export_redistribution",
    status: "permitted",
    claimant: { kind: "reviewer", claimantRef: externalRef("reviewer.rights") },
    evidenceRefs: [externalRef("evidence.repository")],
    assertedAt: NOW,
  });
  const localRights = record({
    recordKind: "rights_assertion",
    id: "rights.local",
    version: 1,
    subjectRef: ref(asset),
    subjectKind: "digital_asset",
    rightsKind: "local_extraction",
    status: "permitted",
    claimant: { kind: "owner", claimantRef: externalRef("owner.local") },
    evidenceRefs: [externalRef("evidence.owner-attestation")],
    assertedAt: NOW,
  });
  const repositoryCitationRights = record({
    recordKind: "rights_assertion",
    id: "rights.repository-citation",
    version: 1,
    subjectRef: ref(asset),
    subjectKind: "digital_asset",
    rightsKind: "pack_citation_excerpt",
    status: "permitted",
    claimant: { kind: "reviewer", claimantRef: externalRef("reviewer.rights") },
    evidenceRefs: [externalRef("evidence.repository-citation")],
    assertedAt: NOW,
  });
  const repositoryAcquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.repository",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: { sourceKind: "upload", ownerActionRef: externalRef("owner-action.repository") },
    acquiredAt: NOW,
    rightsAssertionRefs: [ref(repositoryRights), ref(repositoryCitationRights)],
    processingPolicyRef: externalRef("policy.repository"),
  }) as ReferenceAssetAcquisition;
  const localAcquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.local",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: { sourceKind: "upload", ownerActionRef: externalRef("owner-action.local") },
    acquiredAt: NOW,
    rightsAssertionRefs: [ref(localRights)],
    processingPolicyRef: externalRef("policy.local"),
  }) as ReferenceAssetAcquisition;
  const repositoryDerivation = sourceDerivation("derivation.repository", repositoryAcquisition);
  const localDerivation = sourceDerivation("derivation.local", localAcquisition);
  const repositoryAccess = accessDecision({
    id: "access.repository",
    operation: "repository_inclusion",
    destination: { kind: "repository", id: "repo.vellum" },
    purpose: "Include a rights-approved development fixture",
    acquisition: repositoryAcquisition,
    derivation: repositoryDerivation,
    rightsRefs: [ref(repositoryRights), ref(repositoryCitationRights)],
  });
  const localAccess = accessDecision({
    id: "access.local",
    operation: "local_extraction",
    destination: { kind: "local_runtime" },
    purpose: "Arrange the source locally",
    acquisition: localAcquisition,
    derivation: localDerivation,
    rightsRefs: [ref(localRights)],
    assetRole: "arrangement_source",
  });
  const binding = record({
    recordKind: "arrangement_source_binding",
    id: "binding.local",
    digitalAssetRef: ref(asset),
    acquisitionRefs: [recordRef(localAcquisition)],
    accessDecisionRefs: [recordRef(localAccess)],
    retentionPolicyRef: externalRef("retention.local"),
    workspaceRef: externalRef("workspace.t06"),
    createdAt: NOW,
  });
  const assetStorage = record({
    recordKind: "lifecycle_storage_policy",
    id: "storage.asset",
    version: 1,
    subjectRef: ref(asset),
    subjectKind: "asset_bytes",
    provenancePaths: [
      { acquisitionRefs: [recordRef(repositoryAcquisition)], derivationRefs: [] },
      {
        acquisitionRefs: [recordRef(localAcquisition)],
        derivationRefs: [],
        roleBindingRefs: [recordRef(binding)],
      },
    ],
    policyRef: externalRef("lifecycle-policy.asset"),
    custody: {
      kind: "vellum_controlled",
      storeIds: ["reference-source-staging"],
      retention: "unretained",
      tombstonePolicy: "preserve",
    },
    replayRequirement: "required",
    readinessRequirement: "required",
    createdAt: NOW,
  });
  const derivativeStorage = record({
    recordKind: "lifecycle_storage_policy",
    id: "storage.arrangement",
    version: 1,
    subjectRef: repositoryDerivation.derivedRef,
    subjectKind: "arrangement",
    provenancePaths: [
      {
        acquisitionRefs: [recordRef(repositoryAcquisition)],
        derivationRefs: [recordRef(repositoryDerivation)],
      },
      {
        acquisitionRefs: [recordRef(localAcquisition)],
        derivationRefs: [recordRef(localDerivation)],
        roleBindingRefs: [recordRef(binding)],
      },
    ],
    policyRef: externalRef("lifecycle-policy.arrangement"),
    custody: {
      kind: "vellum_controlled",
      storeIds: ["reference-source-staging"],
      retention: "unretained",
      tombstonePolicy: "discard",
    },
    replayRequirement: "required",
    readinessRequirement: "required",
    createdAt: NOW,
  });
  const repositoryUse = lifecycleUse(
    "use.repository",
    repositoryAcquisition,
    repositoryDerivation,
    repositoryAccess
  );
  const localUse = lifecycleUse(
    "use.local",
    localAcquisition,
    localDerivation,
    localAccess,
    "arrangement_source",
    recordRef(binding)
  );

  return {
    repositoryAcquisition,
    localAcquisition,
    records: [
      asset,
      repositoryRights,
      repositoryCitationRights,
      localRights,
      repositoryAcquisition,
      localAcquisition,
      repositoryDerivation,
      localDerivation,
      repositoryAccess,
      localAccess,
      binding,
      assetStorage,
      derivativeStorage,
      repositoryUse,
      localUse,
    ],
  };
}

function buildReviewedSubstitutionGraph(): {
  records: ReferenceSourceStagingInputRecord[];
  restrictedAcquisition: ReferenceAssetAcquisition;
  replacementAccess: ReferenceAccessDecision;
  inertAccess: ReferenceAccessDecision;
  controlledArtifacts: Array<{
    artifactRef: ReferenceRecordRef;
    sha256: string;
    byteLength: number;
    bytes: Uint8Array;
  }>;
} {
  const assetBytes = Buffer.from("T06 reviewed substitution source bytes");
  const derivativeBytes = Buffer.from("T06 reviewed substitution derivative bytes");
  const asset = record({
    recordKind: "digital_asset",
    id: "asset.reviewed-substitution",
    sha256: sha256(assetBytes),
    mediaType: "application/pdf",
    byteLength: assetBytes.byteLength,
  });
  const restrictedRights = record({
    recordKind: "rights_assertion",
    id: "rights.reviewed-substitution.restricted",
    version: 1,
    subjectRef: externalRef("pending.restricted-acquisition"),
    subjectKind: "asset_acquisition",
    rightsKind: "owner_private_access",
    status: "restricted",
    claimant: { kind: "reviewer", claimantRef: externalRef("reviewer.restriction") },
    evidenceRefs: [externalRef("evidence.restriction")],
    assertedAt: NOW,
  });
  const restrictedAcquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.reviewed-substitution.restricted",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: { sourceKind: "upload", ownerActionRef: externalRef("owner-action.restricted") },
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.restricted"),
  }) as ReferenceAssetAcquisition;
  const exactRestrictedRights = record({
    ...withoutDigest(restrictedRights),
    subjectRef: ref(restrictedAcquisition),
  });
  const replacementAcquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.reviewed-substitution.permitted",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: { sourceKind: "upload", ownerActionRef: externalRef("owner-action.permitted") },
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.permitted"),
  }) as ReferenceAssetAcquisition;
  const replacementRights = record({
    recordKind: "rights_assertion",
    id: "rights.reviewed-substitution.permitted",
    version: 1,
    subjectRef: ref(replacementAcquisition),
    subjectKind: "asset_acquisition",
    rightsKind: "owner_private_access",
    status: "permitted",
    claimant: { kind: "owner", claimantRef: externalRef("owner.local") },
    evidenceRefs: [externalRef("evidence.owner-attestation")],
    assertedAt: NOW,
  });
  const oldDerivation = sourceDerivation(
    "derivation.reviewed-substitution.restricted",
    restrictedAcquisition
  );
  const replacementDerivation = sourceDerivation(
    "derivation.reviewed-substitution.permitted",
    replacementAcquisition
  );
  const purpose = "Use the exact reviewed replacement for private local study";
  const oldAccess = record({
    recordKind: "access_decision",
    id: "access.reviewed-substitution.restricted",
    version: 1,
    outcome: "deny",
    operation: "owner_private_study",
    sourceRefs: [ref(restrictedAcquisition), ref(asset)],
    derivativeRefs: [ref(oldDerivation), oldDerivation.derivedRef],
    destination: { kind: "local_runtime" },
    purpose,
    policyRef: externalRef("access-policy.reviewed-substitution"),
    rightsAssertionRefs: [ref(exactRestrictedRights)],
    authorityRefs: [externalRef("reviewer.restriction")],
    rationale: "The earlier acquisition does not authorize this use",
    decidedAt: NOW,
  });
  const replacementAccess = record({
    recordKind: "access_decision",
    id: "access.reviewed-substitution.permitted",
    version: 1,
    outcome: "allow",
    operation: "owner_private_study",
    sourceRefs: [ref(replacementAcquisition), ref(asset)],
    derivativeRefs: [ref(replacementDerivation), replacementDerivation.derivedRef],
    destination: { kind: "local_runtime" },
    purpose,
    policyRef: externalRef("access-policy.reviewed-substitution"),
    rightsAssertionRefs: [ref(replacementRights)],
    authorityRefs: [externalRef("owner.local")],
    rationale: "The later acquisition is explicitly authorized for the replacement path",
    decidedAt: NOW,
  }) as ReferenceAccessDecision;
  const substitution = record({
    recordKind: "provenance_substitution",
    id: "substitution.reviewed-substitution",
    from: {
      acquisitionRef: ref(restrictedAcquisition),
      derivationRef: ref(oldDerivation),
    },
    to: {
      acquisitionRef: ref(replacementAcquisition),
      derivationRef: ref(replacementDerivation),
    },
    scope: {
      operation: "owner_private_study",
      sourceAndDerivativeRefs: [
        ref(restrictedAcquisition),
        ref(oldDerivation),
        ref(replacementAcquisition),
        ref(replacementDerivation),
        replacementDerivation.derivedRef,
      ],
      destination: { kind: "local_runtime" },
      purpose,
      policyRef: replacementAccess.policyRef,
    },
    accessDecisionRef: ref(replacementAccess),
    authority: {
      kind: "owner",
      authorityRef: externalRef("owner.local"),
      evidenceRefs: [ref(replacementRights)],
    },
    rationale: "The Owner reviewed this exact old-to-new provenance mapping",
    decidedAt: NOW,
  });
  const inertRights = record({
    recordKind: "rights_assertion",
    id: "rights.reviewed-substitution.provider-only",
    version: 1,
    subjectRef: ref(replacementAcquisition),
    subjectKind: "asset_acquisition",
    rightsKind: "named_provider_processing",
    status: "permitted",
    claimant: { kind: "owner", claimantRef: externalRef("owner.local") },
    evidenceRefs: [externalRef("evidence.provider-only")],
    assertedAt: NOW,
  });
  const inertPurpose = "Send the replacement path to one named provider";
  const inertAccess = record({
    recordKind: "access_decision",
    id: "access.reviewed-substitution.provider-only",
    version: 1,
    outcome: "allow",
    operation: "provider_model_processing",
    sourceRefs: [ref(replacementAcquisition), ref(asset)],
    derivativeRefs: [ref(replacementDerivation), replacementDerivation.derivedRef],
    destination: { kind: "provider", id: "provider.fixture" },
    purpose: inertPurpose,
    policyRef: externalRef("access-policy.provider-only"),
    rightsAssertionRefs: [ref(inertRights)],
    authorityRefs: [externalRef("owner.local")],
    rationale: "This separate decision does not authorize the current local use",
    decidedAt: NOW,
  }) as ReferenceAccessDecision;
  const inertSubstitution = record({
    recordKind: "provenance_substitution",
    id: "substitution.reviewed-substitution.provider-only",
    from: {
      acquisitionRef: ref(restrictedAcquisition),
      derivationRef: ref(oldDerivation),
    },
    to: {
      acquisitionRef: ref(replacementAcquisition),
      derivationRef: ref(replacementDerivation),
    },
    scope: {
      operation: inertAccess.operation,
      sourceAndDerivativeRefs: [
        ref(restrictedAcquisition),
        ref(oldDerivation),
        ref(replacementAcquisition),
        ref(replacementDerivation),
        replacementDerivation.derivedRef,
      ],
      destination: inertAccess.destination,
      purpose: inertPurpose,
      policyRef: inertAccess.policyRef,
    },
    accessDecisionRef: ref(inertAccess),
    authority: {
      kind: "owner",
      authorityRef: externalRef("owner.local"),
      evidenceRefs: [ref(inertRights)],
    },
    rationale: "This mapping is valid only for the separate provider operation",
    decidedAt: NOW,
  });
  const assetStorage = record({
    recordKind: "lifecycle_storage_policy",
    id: "storage.reviewed-substitution.asset",
    version: 1,
    subjectRef: ref(asset),
    subjectKind: "asset_bytes",
    provenancePaths: [
      { acquisitionRefs: [ref(restrictedAcquisition)], derivationRefs: [] },
      { acquisitionRefs: [ref(replacementAcquisition)], derivationRefs: [] },
    ],
    policyRef: externalRef("lifecycle-policy.reviewed-substitution.asset"),
    custody: {
      kind: "vellum_controlled",
      storeIds: ["reference-source-staging"],
      retention: "unretained",
      tombstonePolicy: "preserve",
    },
    replayRequirement: "required",
    readinessRequirement: "required",
    createdAt: NOW,
  });
  const derivativeStorage = record({
    recordKind: "lifecycle_storage_policy",
    id: "storage.reviewed-substitution.derivative",
    version: 1,
    subjectRef: replacementDerivation.derivedRef,
    subjectKind: "extraction",
    provenancePaths: [
      {
        acquisitionRefs: [ref(restrictedAcquisition)],
        derivationRefs: [ref(oldDerivation)],
      },
      {
        acquisitionRefs: [ref(replacementAcquisition)],
        derivationRefs: [ref(replacementDerivation)],
      },
    ],
    policyRef: externalRef("lifecycle-policy.reviewed-substitution.derivative"),
    custody: {
      kind: "vellum_controlled",
      storeIds: ["reference-source-staging"],
      retention: "unretained",
      tombstonePolicy: "discard",
    },
    replayRequirement: "required",
    readinessRequirement: "required",
    createdAt: NOW,
  });
  const use = record({
    recordKind: "lifecycle_use",
    id: "use.reviewed-substitution",
    version: 1,
    subjectRef: oldDerivation.derivedRef,
    provenancePaths: [
      {
        acquisitionRefs: [ref(restrictedAcquisition)],
        derivationRefs: [ref(oldDerivation)],
        accessDecisionRef: ref(oldAccess),
      },
    ],
    operation: "owner_private_study",
    destination: { kind: "local_runtime" },
    purpose,
    policyRef: replacementAccess.policyRef,
    baselineReplayability: "complete",
    readinessRequirement: "required",
    createdAt: NOW,
  });
  return {
    records: [
      asset,
      exactRestrictedRights,
      replacementRights,
      inertRights,
      restrictedAcquisition,
      replacementAcquisition,
      oldDerivation,
      replacementDerivation,
      oldAccess,
      replacementAccess,
      substitution,
      inertAccess,
      inertSubstitution,
      assetStorage,
      derivativeStorage,
      use,
    ],
    restrictedAcquisition,
    replacementAccess,
    inertAccess,
    controlledArtifacts: [
      {
        artifactRef: ref(asset),
        sha256: sha256(assetBytes),
        byteLength: assetBytes.byteLength,
        bytes: assetBytes,
      },
      {
        artifactRef: replacementDerivation.derivedRef,
        sha256: sha256(derivativeBytes),
        byteLength: derivativeBytes.byteLength,
        bytes: derivativeBytes,
      },
    ],
  };
}

function sourceDerivation(
  id: string,
  acquisition: ReferenceAssetAcquisition
): ReferenceSourceDerivation {
  return record({
    recordKind: "source_derivation",
    id,
    derivationKind: "extraction",
    inputRefs: [acquisition.digitalAssetRef],
    sourceAcquisitionRefs: [recordRef(acquisition)],
    sourceDerivationRefs: [],
    derivedRef: externalRef("arrangement.shared"),
    componentRef: externalRef("component.arranger"),
    configurationDigest: "f".repeat(64),
    createdAt: NOW,
  }) as ReferenceSourceDerivation;
}

function accessDecision(options: {
  id: string;
  operation: ReferenceAccessDecision["operation"];
  destination: ReferenceAccessDecision["destination"];
  purpose: string;
  acquisition: ReferenceAssetAcquisition;
  derivation: ReferenceSourceDerivation;
  rightsRefs: ReferenceRecordRef[];
  assetRole?: "arrangement_source";
}): ReferenceAccessDecision {
  return record({
    recordKind: "access_decision",
    id: options.id,
    version: 1,
    outcome: "allow",
    operation: options.operation,
    sourceRefs: [recordRef(options.acquisition), options.acquisition.digitalAssetRef],
    derivativeRefs: [recordRef(options.derivation), options.derivation.derivedRef],
    destination: options.destination,
    purpose: options.purpose,
    ...(options.assetRole ? { assetRole: options.assetRole } : {}),
    policyRef: externalRef("access-policy." + options.id),
    rightsAssertionRefs: options.rightsRefs,
    authorityRefs: [externalRef("authority." + options.id)],
    rationale: "Exact path and operation were reviewed",
    decidedAt: NOW,
  }) as ReferenceAccessDecision;
}

function lifecycleUse(
  id: string,
  acquisition: ReferenceAssetAcquisition,
  derivation: ReferenceSourceDerivation,
  decision: ReferenceAccessDecision,
  assetRole?: "arrangement_source",
  roleBindingRef?: ReferenceRecordRef
): ReferenceSourceStagingInputRecord {
  return record({
    recordKind: "lifecycle_use",
    id,
    version: 1,
    subjectRef: derivation.derivedRef,
    provenancePaths: [
      {
        acquisitionRefs: [recordRef(acquisition)],
        derivationRefs: [recordRef(derivation)],
        accessDecisionRef: recordRef(decision),
        ...(roleBindingRef ? { roleBindingRef } : {}),
      },
    ],
    operation: decision.operation,
    destination: decision.destination,
    purpose: decision.purpose,
    ...(assetRole ? { assetRole } : {}),
    policyRef: decision.policyRef,
    baselineReplayability: "complete",
    readinessRequirement: "required",
    createdAt: NOW,
  });
}

function transaction(
  records: ReferenceSourceStagingInputRecord[]
): ReferenceSourceStagingTransaction {
  return {
    schemaVersion: 1,
    id: "transaction.t06",
    operations: records.map((item) => ({ type: "append_record", record: item })),
    submittedAt: NOW,
  };
}

function currentHeadRef(value: {
  head: { snapshotId: string; digest: string } | null;
}): ReferenceRecordRef {
  if (!value.head) throw new Error("Expected current staging head");
  return { id: value.head.snapshotId, digest: value.head.digest };
}

function record(value: Record<string, unknown>): ReferenceSourceStagingInputRecord {
  return withReferenceRecordDigest(value) as ReferenceSourceStagingInputRecord;
}

function recordRef(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return recordRef(value);
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: withReferenceRecordDigest({ id }).digest };
}

function withoutDigest<T extends { digest: string }>(value: T): Omit<T, "digest"> {
  const { digest: _digest, ...core } = value;
  return core;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
