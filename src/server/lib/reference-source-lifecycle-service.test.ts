import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceRecordRef,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingSnapshot,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import {
  planReferenceSourceLifecycle,
  type ReferenceSourceLifecycleComputationResult,
  type ReferenceSourceLifecyclePlannerInput,
} from "../../lib/reference-source-lifecycle.js";
import {
  ReferenceSourceStagingConflictError,
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingNotFoundError,
  ReferenceSourceStagingStore,
} from "./reference-source-staging-store.js";
import { ReferenceSourceStagingService } from "./reference-source-staging-service.js";
import { ReferenceSourceLifecyclePlanningService } from "./reference-source-lifecycle-service.js";
import {
  TEST_REFERENCE_AUTHORITY_TRUST,
  TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
  createTestReferenceSourceLifecycleEvidenceProvider,
} from "../test-support/reference-source-lifecycle-evidence.js";

const RECORDED_AT = "2026-07-15T12:00:00.000Z";
const COMMITTED_AT = "2026-07-15T13:00:00.000Z";
const EFFECTIVE_AT = "2026-07-15T14:00:00.000Z";
const TEST_EVIDENCE_PROVIDER = createTestReferenceSourceLifecycleEvidenceProvider();

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("ReferenceSourceLifecyclePlanningService", () => {
  it("plans from one exact current snapshot without mutating staging", () => {
    const harness = createHarness();
    const graph = lifecycleGraph();
    const committed = harness.staging.applyTransaction(transaction("base", graph.records));
    const expectedHeadRef = headRef(committed);
    const inputSpy = vi.fn((input: ReferenceSourceLifecyclePlannerInput) =>
      planReferenceSourceLifecycle(input)
    );
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      now: () => new Date(EFFECTIVE_AT),
      planner: inputSpy,
      evidenceProvider: TEST_EVIDENCE_PROVIDER,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });
    const diskBefore = snapshotDirectory(harness.root);
    const stateBefore = harness.store.readCurrentState();

    const result = service.planDryRun({
      schemaVersion: 1,
      expectedHeadRef,
      action: {
        kind: "delete_acquisition",
        targetAcquisitionRef: ref(graph.acquisition),
        reason: "Owner requested a rights-safe dry run",
      },
    });

    expect(result).toMatchObject({
      mode: "dry_run",
      baseSnapshotRef: expectedHeadRef,
      effectiveAt: EFFECTIVE_AT,
      verifiedEvidence: expect.objectContaining({
        validatedAt: EFFECTIVE_AT,
        authorityEvaluations: [],
      }),
    });
    expect(inputSpy).toHaveBeenCalledTimes(1);
    expect(inputSpy.mock.calls[0]![0]).toEqual({
      schemaVersion: 1,
      baseSnapshot: stateBefore!.snapshot,
      effectiveAt: EFFECTIVE_AT,
      action: {
        kind: "delete_acquisition",
        targetAcquisitionRef: ref(graph.acquisition),
        reason: "Owner requested a rights-safe dry run",
      },
      retentionOutcomes: [{ roleBindingRef: ref(graph.binding), outcome: "retain" }],
    });
    expect(inputSpy.mock.calls[0]![0].baseSnapshot).not.toBe(stateBefore!.snapshot);
    expect(harness.store.readCurrentState()).toEqual(stateBefore);
    expect(snapshotDirectory(harness.root)).toEqual(diskBefore);
    expect(Object.getOwnPropertyNames(ReferenceSourceLifecyclePlanningService.prototype)).toEqual([
      "constructor",
      "planDryRun",
    ]);
  });

  it("rejects caller-supplied graph material before invoking the planner", () => {
    const harness = createHarness();
    const graph = lifecycleGraph();
    const committed = harness.staging.applyTransaction(transaction("base", graph.records));
    const planner = vi.fn(planReferenceSourceLifecycle);
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      planner,
      evidenceProvider: TEST_EVIDENCE_PROVIDER,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    expect(() =>
      service.planDryRun({
        schemaVersion: 1,
        expectedHeadRef: headRef(committed),
        action: {
          kind: "delete_acquisition",
          targetAcquisitionRef: ref(graph.acquisition),
          reason: "Attempt to supply a partial graph",
        },
        acquisitions: [graph.acquisition],
      } as never)
    ).toThrow(/schema validation/);
    expect(planner).not.toHaveBeenCalled();
  });

  it("fails closed when the caller observed a stale head", () => {
    const harness = createHarness();
    const graph = lifecycleGraph();
    const base = harness.staging.applyTransaction(transaction("base", graph.records));
    harness.staging.applyTransaction(
      transaction("advance", [unrelatedAsset("asset.advance", "b")], headRef(base))
    );
    const planner = vi.fn(planReferenceSourceLifecycle);
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      planner,
      evidenceProvider: TEST_EVIDENCE_PROVIDER,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    expect(() =>
      service.planDryRun({
        schemaVersion: 1,
        expectedHeadRef: headRef(base),
        action: {
          kind: "delete_acquisition",
          targetAcquisitionRef: ref(graph.acquisition),
          reason: "Stale request",
        },
      })
    ).toThrow(ReferenceSourceStagingConflictError);
    expect(planner).not.toHaveBeenCalled();
  });

  it("discards a plan if the staging head moves while planning", () => {
    const harness = createHarness();
    const graph = lifecycleGraph();
    const base = harness.staging.applyTransaction(transaction("base", graph.records));
    const planner = vi.fn((input: ReferenceSourceLifecyclePlannerInput) => {
      harness.staging.applyTransaction(
        transaction("racing-advance", [unrelatedAsset("asset.race", "c")], headRef(base))
      );
      return planReferenceSourceLifecycle(input);
    });
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      planner,
      evidenceProvider: TEST_EVIDENCE_PROVIDER,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    expect(() =>
      service.planDryRun({
        schemaVersion: 1,
        expectedHeadRef: headRef(base),
        action: {
          kind: "delete_acquisition",
          targetAcquisitionRef: ref(graph.acquisition),
          reason: "Request that races a writer",
        },
      })
    ).toThrow(ReferenceSourceStagingConflictError);
    expect(planner).toHaveBeenCalledTimes(1);
  });

  it("requires an existing staging snapshot", () => {
    const harness = createHarness();
    const planner = vi.fn(planReferenceSourceLifecycle);
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      planner,
      evidenceProvider: TEST_EVIDENCE_PROVIDER,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    expect(() =>
      service.planDryRun({
        schemaVersion: 1,
        expectedHeadRef: externalRef("snapshot.missing"),
        action: {
          kind: "delete_acquisition",
          targetAcquisitionRef: externalRef("acquisition.missing"),
          reason: "No snapshot exists",
        },
      })
    ).toThrow(ReferenceSourceStagingNotFoundError);
    expect(planner).not.toHaveBeenCalled();
  });

  it("rejects a digest-valid but semantically corrupt snapshot before planning", () => {
    const harness = createHarness();
    const graph = lifecycleGraph();
    const corruptStorage = record({
      ...withoutDigest(graph.storage),
      subjectRef: externalRef("asset.not-in-snapshot"),
    });
    const core = {
      schemaVersion: 1 as const,
      id: "reference-source-snapshot.semantic-corruption",
      revision: 1,
      publicationState: "staging_only" as const,
      createdAt: COMMITTED_AT,
      records: graph.records.map((entry) =>
        entry.id === graph.storage.id ? corruptStorage : entry
      ),
    };
    const snapshot: ReferenceSourceStagingSnapshot = {
      ...core,
      digest: referenceSourceDigest(core),
    };
    const head = harness.store.commit(snapshot);
    const planner = vi.fn(planReferenceSourceLifecycle);
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      planner,
      evidenceProvider: TEST_EVIDENCE_PROVIDER,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    expect(() =>
      service.planDryRun({
        schemaVersion: 1,
        expectedHeadRef: { id: head.snapshotId, digest: head.digest },
        action: {
          kind: "delete_acquisition",
          targetAcquisitionRef: ref(graph.acquisition),
          reason: "Semantically corrupt base graph",
        },
      })
    ).toThrow(ReferenceSourceStagingIntegrityError);
    expect(planner).not.toHaveBeenCalled();
  });

  it("rejects a validly sealed planner result for a different action", () => {
    const harness = createHarness();
    const graph = lifecycleGraph();
    const committed = harness.staging.applyTransaction(transaction("base", graph.records));
    const planner = vi.fn((input: ReferenceSourceLifecyclePlannerInput) => {
      const valid = planReferenceSourceLifecycle(input);
      const { id: _id, digest: _digest, ...value } = valid;
      return sealTestComputation({
        ...value,
        action: {
          kind: "restrict_access",
          targetAccessDecisionRef: ref(graph.access),
          reason: "Different action than the caller authorized",
        },
      });
    });
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      planner,
      evidenceProvider: TEST_EVIDENCE_PROVIDER,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    expect(() =>
      service.planDryRun({
        schemaVersion: 1,
        expectedHeadRef: headRef(committed),
        action: {
          kind: "delete_acquisition",
          targetAcquisitionRef: ref(graph.acquisition),
          reason: "Delete the exact acquisition",
        },
      })
    ).toThrow(ReferenceSourceStagingIntegrityError);
  });
});

function createHarness(): {
  root: string;
  store: ReferenceSourceStagingStore;
  staging: ReferenceSourceStagingService;
} {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-reference-lifecycle-service-"));
  roots.push(root);
  const store = new ReferenceSourceStagingStore({ rootDirectory: root });
  let sequence = 0;
  return {
    root,
    store,
    staging: new ReferenceSourceStagingService({
      store,
      now: () => new Date(COMMITTED_AT),
      createId: () => `lifecycle-${++sequence}`,
    }),
  };
}

function lifecycleGraph() {
  const asset = record({
    recordKind: "digital_asset",
    id: "asset.lifecycle-source",
    sha256: "a".repeat(64),
    mediaType: "application/pdf",
    byteLength: 1024,
  });
  const acquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.lifecycle-source",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: { sourceKind: "upload", ownerActionRef: externalRef("owner-action.upload") },
    acquiredAt: RECORDED_AT,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("policy.local-processing"),
  });
  const rights = record({
    recordKind: "rights_assertion",
    id: "rights.lifecycle-source",
    version: 1,
    subjectRef: ref(acquisition),
    subjectKind: "asset_acquisition",
    rightsKind: "owner_private_access",
    status: "permitted",
    claimant: { kind: "reviewer", claimantRef: externalRef("reviewer.rights") },
    evidenceRefs: [externalRef("evidence.owner-upload")],
    assertedAt: RECORDED_AT,
  });
  const access = record({
    recordKind: "access_decision",
    id: "access.lifecycle-source",
    version: 1,
    outcome: "allow",
    operation: "owner_private_study",
    sourceRefs: [ref(acquisition), ref(asset)],
    derivativeRefs: [],
    destination: { kind: "local_runtime" },
    purpose: "Arrange an owner-provided source locally",
    assetRole: "arrangement_source",
    policyRef: externalRef("policy.owner-private-study"),
    rightsAssertionRefs: [ref(rights)],
    authorityRefs: [externalRef("owner.authority")],
    rationale: "Owner upload is authorized for local private study",
    decidedAt: RECORDED_AT,
  });
  const binding = record({
    recordKind: "arrangement_source_binding",
    id: "binding.lifecycle-source",
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(acquisition)],
    accessDecisionRefs: [ref(access)],
    retentionPolicyRef: externalRef("policy.retention"),
    workspaceRef: externalRef("workspace.fixture"),
    createdAt: RECORDED_AT,
  });
  const storage = record({
    recordKind: "lifecycle_storage_policy",
    id: "storage.lifecycle-source",
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
    policyRef: externalRef("policy.lifecycle"),
    custody: {
      kind: "vellum_controlled",
      storeIds: ["reference-source-staging"],
      retention: "unretained",
      tombstonePolicy: "preserve",
    },
    replayRequirement: "required",
    readinessRequirement: "required",
    createdAt: RECORDED_AT,
  });
  const use = record({
    recordKind: "lifecycle_use",
    id: "use.lifecycle-source",
    version: 1,
    subjectRef: ref(asset),
    provenancePaths: [
      {
        acquisitionRefs: [ref(acquisition)],
        derivationRefs: [],
        accessDecisionRef: ref(access),
        roleBindingRef: ref(binding),
      },
    ],
    operation: access.operation,
    destination: access.destination,
    purpose: access.purpose,
    assetRole: access.assetRole,
    policyRef: access.policyRef,
    baselineReplayability: "complete",
    readinessRequirement: "required",
    createdAt: RECORDED_AT,
  });
  return {
    records: [asset, acquisition, rights, access, binding, storage, use],
    asset,
    acquisition,
    access,
    binding,
    storage,
  };
}

function unrelatedAsset(id: string, digestFill: string): ReferenceSourceStagingRecord {
  return record({
    recordKind: "digital_asset",
    id,
    sha256: digestFill.repeat(64),
    mediaType: "application/octet-stream",
    byteLength: 1,
  });
}

function transaction(
  id: string,
  records: ReferenceSourceStagingRecord[],
  expectedHeadRef?: ReferenceRecordRef
): ReferenceSourceStagingTransaction {
  return {
    schemaVersion: 1,
    id: `transaction.${id}`,
    ...(expectedHeadRef ? { expectedHeadRef } : {}),
    operations: records.map((entry) => ({ type: "append_record", record: entry })),
    submittedAt: RECORDED_AT,
  } as ReferenceSourceStagingTransaction;
}

function record<T extends Record<string, unknown>>(value: T): T & ReferenceSourceStagingRecord {
  return withReferenceRecordDigest(value) as unknown as T & ReferenceSourceStagingRecord;
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: withReferenceRecordDigest({ id }).digest };
}

function headRef(value: {
  head: { snapshotId: string; digest: string } | null;
}): ReferenceRecordRef {
  if (!value.head) throw new Error("Expected a staging head");
  return { id: value.head.snapshotId, digest: value.head.digest };
}

function snapshotDirectory(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      const absolute = path.join(directory, entry);
      const relative = path.relative(root, absolute);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else result[relative] = readFileSync(absolute).toString("base64");
    }
  };
  visit(root);
  return result;
}

function withoutDigest<T extends { digest: string }>(value: T): Omit<T, "digest"> {
  const { digest: _digest, ...core } = value;
  return core;
}

function sealTestComputation(
  value: Record<string, unknown>
): ReferenceSourceLifecycleComputationResult {
  const seed = referenceSourceDigest(value);
  const withId = { ...value, id: `reference-lifecycle-plan.${seed.slice(0, 24)}` };
  return {
    ...withId,
    digest: referenceSourceDigest(withId),
  } as ReferenceSourceLifecycleComputationResult;
}
