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
import { ReferenceSourceStagingService } from "../../src/server/lib/reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "../../src/server/lib/reference-source-staging-store.js";

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
});

function runOrdering(order: Array<"repository" | "local">) {
  const harness = createHarness(order);
  const before = harness.staging.readCurrent();
  const service = new ReferenceSourceLifecyclePlanningService({
    store: harness.store,
    now: () => new Date(NOW),
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
    throw new Error("Expected both lifecycle plans to be ready");
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
  const repositoryAcquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.repository",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: { sourceKind: "upload", ownerActionRef: externalRef("owner-action.repository") },
    acquiredAt: NOW,
    rightsAssertionRefs: [ref(repositoryRights)],
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
    rightsRef: ref(repositoryRights),
  });
  const localAccess = accessDecision({
    id: "access.local",
    operation: "local_extraction",
    destination: { kind: "local_runtime" },
    purpose: "Arrange the source locally",
    acquisition: localAcquisition,
    derivation: localDerivation,
    rightsRef: ref(localRights),
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
      { acquisitionRefs: [recordRef(localAcquisition)], derivationRefs: [] },
    ],
    policyRef: externalRef("lifecycle-policy.asset"),
    custody: {
      kind: "vellum_controlled",
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
      },
    ],
    policyRef: externalRef("lifecycle-policy.arrangement"),
    custody: {
      kind: "vellum_controlled",
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
    "arrangement_source"
  );

  return {
    repositoryAcquisition,
    localAcquisition,
    records: [
      asset,
      repositoryRights,
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
  rightsRef: ReferenceRecordRef;
  assetRole?: "arrangement_source";
}): ReferenceAccessDecision {
  return record({
    recordKind: "access_decision",
    id: options.id,
    version: 1,
    outcome: "allow",
    operation: options.operation,
    sourceRefs: [recordRef(options.acquisition)],
    derivativeRefs: [recordRef(options.derivation), options.derivation.derivedRef],
    destination: options.destination,
    purpose: options.purpose,
    ...(options.assetRole ? { assetRole: options.assetRole } : {}),
    policyRef: externalRef("access-policy." + options.id),
    rightsAssertionRefs: [options.rightsRef],
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
  assetRole?: "arrangement_source"
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
