import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { Value } from "@sinclair/typebox/value";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReferenceAuthorityVerificationReceipt } from "../../lib/reference-source-authority.js";
import type { ReferenceSourceRetentionAuthorityReceipt } from "../../lib/reference-source-retention-authority.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceRecordRef,
  type ReferenceSourceStagingInputRecord,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceLifecyclePlanResultSchema,
  planReferenceSourceLifecycle,
  type ReferenceLifecyclePlanningIssue,
  type ReferenceSourceLifecycleComputationResult,
  type ReferenceSourceLifecyclePlanResult,
  type ReferenceSourceLifecyclePlannerInput,
} from "../../lib/reference-source-lifecycle.js";
import {
  bindReferenceSourceInventoryClosureWitness,
  bindReferenceSourceRequiredStoreRegistry,
  bindReferenceSourceStoreEnumeration,
} from "../../lib/reference-source-inventory.js";
import {
  TEST_REFERENCE_AUTHORITY_TRUST,
  TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
  createTestReferenceSourceLifecycleEvidenceProvider,
} from "../test-support/reference-source-lifecycle-evidence.js";
import {
  ReferenceSourceLifecyclePlanningService,
  type ReferenceSourceAuthorityTrust,
  type ReferenceSourceLifecycleEvidence,
  type ReferenceSourceLifecycleEvidenceProvider,
} from "./reference-source-lifecycle-service.js";
import {
  ReferenceSourceStagingConflictError,
  ReferenceSourceStagingStore,
} from "./reference-source-staging-store.js";
import { ReferenceSourceStagingService } from "./reference-source-staging-service.js";

const RECORDED_AT = "2026-07-15T12:00:00.000Z";
const COMMITTED_AT = "2026-07-15T13:00:00.000Z";
const EFFECTIVE_AT = "2026-07-15T14:00:00.000Z";
const BASE_EVIDENCE_PROVIDER = createTestReferenceSourceLifecycleEvidenceProvider();
const roots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("reference-source lifecycle preflight adversarial boundary", () => {
  it("returns a sealed blocked plan and never calls the planner without server evidence", () => {
    const harness = createHarness();
    const graph = lifecycleGraph();
    const committed = harness.staging.applyTransaction(transaction("base", graph.records));
    const planner = vi.fn(planReferenceSourceLifecycle);
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      now: () => new Date(EFFECTIVE_AT),
      planner,
    });

    const result = planAuthorityCheck(service, committed, graph.restrictionTarget);

    expectBlocked(result, ["incomplete_controlled_store_inventory", "unverified_authority"]);
    expect(planner).not.toHaveBeenCalled();
  });

  it("blocks an internally valid inventory witness that omits a controlled artifact", () => {
    const provider = transformEvidence((evidence) => {
      const enumeration = evidence.inventory.witness.storeEnumerations[0]!;
      if (enumeration.status !== "complete") {
        throw new Error("Expected the baseline test enumeration to be complete");
      }
      const reboundEnumeration = bindReferenceSourceStoreEnumeration({
        ...withoutDigest(enumeration),
        artifactBindings: [],
      });
      evidence.inventory.witness = bindReferenceSourceInventoryClosureWitness({
        ...withoutIdentity(evidence.inventory.witness),
        storeEnumerations: [reboundEnumeration],
      });
      return evidence;
    });

    const { result, planner } = runBlockedPreflight(provider);

    expectBlocked(result, ["incomplete_controlled_store_inventory"]);
    expect(planner).not.toHaveBeenCalled();
  });

  it("blocks an exact-ref inventory whose persisted bytes contradict the Digital Asset", () => {
    const provider = transformEvidence((evidence) => {
      const enumeration = evidence.inventory.witness.storeEnumerations[0]!;
      if (enumeration.status !== "complete") {
        throw new Error("Expected the baseline test enumeration to be complete");
      }
      const reboundEnumeration = bindReferenceSourceStoreEnumeration({
        ...withoutDigest(enumeration),
        artifactBindings: enumeration.artifactBindings.map((binding) =>
          binding.artifactRef.id === "asset.lifecycle-preflight"
            ? { ...binding, blobSha256: "f".repeat(64), byteLength: binding.byteLength + 1 }
            : binding
        ),
      });
      evidence.inventory.witness = bindReferenceSourceInventoryClosureWitness({
        ...withoutIdentity(evidence.inventory.witness),
        storeEnumerations: [reboundEnumeration],
      });
      return evidence;
    });

    const { result, planner } = runBlockedPreflight(provider);

    expectBlocked(result, ["incomplete_controlled_store_inventory"]);
    expect(planner).not.toHaveBeenCalled();
  });

  it("blocks an internally valid inventory witness that includes an orphan artifact", () => {
    const provider = transformEvidence((evidence) => {
      const enumeration = evidence.inventory.witness.storeEnumerations[0]!;
      if (enumeration.status !== "complete") {
        throw new Error("Expected the baseline test enumeration to be complete");
      }
      const reboundEnumeration = bindReferenceSourceStoreEnumeration({
        ...withoutDigest(enumeration),
        artifactBindings: [
          ...enumeration.artifactBindings,
          artifactBinding(externalRef("orphan.controlled-artifact")),
        ],
      });
      evidence.inventory.witness = bindReferenceSourceInventoryClosureWitness({
        ...withoutIdentity(evidence.inventory.witness),
        storeEnumerations: [reboundEnumeration],
      });
      return evidence;
    });

    const { result, planner } = runBlockedPreflight(provider);

    expectBlocked(result, ["incomplete_controlled_store_inventory"]);
    expect(planner).not.toHaveBeenCalled();
  });

  it("accepts an independently versioned store catalog with exact artifact placement", () => {
    const provider = transformEvidence((evidence) => {
      const original = evidence.inventory.witness.storeEnumerations[0]!;
      if (original.status !== "complete") {
        throw new Error("Expected the baseline test enumeration to be complete");
      }
      const storeGeneration = 27;
      const storeStateDigest = referenceSourceDigest({
        catalog: "independent-controlled-artifact-store",
        generation: storeGeneration,
      });
      const enumeration = bindReferenceSourceStoreEnumeration({
        ...withoutDigest(original),
        storeGeneration,
        storeStateDigest,
      });
      const registry = bindReferenceSourceRequiredStoreRegistry({
        schemaVersion: 1,
        registryGeneration: 9,
        stores: evidence.inventory.currentRegistry.stores.map((store) => ({
          ...store,
          storeGeneration,
          storeStateDigest,
        })),
      });
      evidence.inventory = {
        currentRegistry: registry,
        witness: bindReferenceSourceInventoryClosureWitness({
          ...withoutIdentity(evidence.inventory.witness),
          requiredStoreRegistryRef: ref(registry),
          requiredStoreRegistryGeneration: registry.registryGeneration,
          storeEnumerations: [enumeration],
        }),
      };
      return evidence;
    });

    const { result, planner } = runBlockedPreflight(
      provider,
      TEST_REFERENCE_AUTHORITY_TRUST,
      "delete"
    );

    expect(result.status).toBe("ready");
    expect(planner).toHaveBeenCalledOnce();
  });

  it("accepts the same artifact in primary and backup stores when policy binds both placements", () => {
    const harness = createHarness();
    const graph = lifecycleGraph({
      storeIds: ["reference-source-staging", "reference-source-backup"],
    });
    const committed = harness.staging.applyTransaction(transaction("base", graph.records));
    const provider: ReferenceSourceLifecycleEvidenceProvider = (input) => {
      const evidence = BASE_EVIDENCE_PROVIDER(input);
      const backupStateDigest = referenceSourceDigest({ backup: input.snapshot.digest });
      const registry = bindReferenceSourceRequiredStoreRegistry({
        schemaVersion: 1,
        registryGeneration: evidence.inventory.currentRegistry.registryGeneration,
        stores: [
          ...evidence.inventory.currentRegistry.stores,
          {
            storeId: "reference-source-backup",
            storeKind: "reference_source_backup",
            controlBoundary: "vellum_controlled",
            required: true,
            storeGeneration: input.snapshot.revision,
            storeStateDigest: backupStateDigest,
          },
        ],
      });
      const primary = evidence.inventory.witness.storeEnumerations[0]!;
      const backup = bindReferenceSourceStoreEnumeration({
        storeId: "reference-source-backup",
        storeGeneration: input.snapshot.revision,
        storeStateDigest: backupStateDigest,
        status: "complete",
        artifactBindings: primary.artifactBindings,
      });
      evidence.inventory = {
        currentRegistry: registry,
        witness: bindReferenceSourceInventoryClosureWitness({
          ...withoutIdentity(evidence.inventory.witness),
          requiredStoreRegistryRef: ref(registry),
          storeEnumerations: [primary, backup],
        }),
      };
      return evidence;
    };
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      now: () => new Date(EFFECTIVE_AT),
      evidenceProvider: provider,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    expect(planDelete(service, committed, graph.acquisition).status).toBe("ready");
  });

  it("uses only the current effective storage-policy generation for exact placement", () => {
    const harness = createHarness();
    const graph = lifecycleGraph();
    const base = harness.staging.applyTransaction(transaction("base", graph.records));
    const currentStorage = record({
      ...withoutDigest(graph.storage),
      version: 2,
      parentVersionRef: {
        ...ref(graph.storage),
        version: graph.storage.version,
      },
      custody: {
        ...graph.storage.custody,
        storeIds: ["reference-source-backup"],
      },
      createdAt: "2026-07-15T13:30:00.000Z",
    });
    const futureStorage = record({
      ...withoutDigest(currentStorage),
      version: 3,
      parentVersionRef: {
        ...ref(currentStorage),
        version: currentStorage.version,
      },
      custody: {
        ...currentStorage.custody,
        storeIds: ["reference-source-future"],
      },
      createdAt: "2026-07-16T00:00:00.000Z",
    });
    const committed = harness.staging.applyTransaction({
      ...transaction("move-storage", [currentStorage, futureStorage]),
      expectedHeadRef: headRef(base),
    });
    const provider: ReferenceSourceLifecycleEvidenceProvider = (input) => {
      const evidence = BASE_EVIDENCE_PROVIDER(input);
      const original = evidence.inventory.witness.storeEnumerations[0]!;
      if (original.status !== "complete") throw new Error("Expected complete test inventory");
      const primary = bindReferenceSourceStoreEnumeration({
        ...withoutDigest(original),
        artifactBindings: [],
      });
      const backupStateDigest = referenceSourceDigest({
        store: "reference-source-backup",
        snapshot: input.snapshot.digest,
      });
      const backup = bindReferenceSourceStoreEnumeration({
        storeId: "reference-source-backup",
        storeGeneration: input.snapshot.revision,
        storeStateDigest: backupStateDigest,
        status: "complete",
        artifactBindings: original.artifactBindings,
      });
      const registry = bindReferenceSourceRequiredStoreRegistry({
        schemaVersion: 1,
        registryGeneration: input.snapshot.revision,
        stores: [
          evidence.inventory.currentRegistry.stores[0]!,
          {
            storeId: "reference-source-backup",
            storeKind: "reference_source_backup",
            controlBoundary: "vellum_controlled",
            required: true,
            storeGeneration: input.snapshot.revision,
            storeStateDigest: backupStateDigest,
          },
        ],
      });
      evidence.inventory = {
        currentRegistry: registry,
        witness: bindReferenceSourceInventoryClosureWitness({
          ...withoutIdentity(evidence.inventory.witness),
          requiredStoreRegistryRef: ref(registry),
          storeEnumerations: [primary, backup],
        }),
      };
      return evidence;
    };
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      now: () => new Date(EFFECTIVE_AT),
      evidenceProvider: provider,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    expect(planDelete(service, committed, graph.acquisition).status).toBe("ready");
  });

  it("allows a later role binding when a successor policy pins the expanded retention roots", () => {
    const harness = createHarness();
    const graph = lifecycleGraph();
    const base = harness.staging.applyTransaction(transaction("base", graph.records));
    const ownerAccess = record({
      ...withoutDigest(graph.access),
      id: "access.lifecycle-preflight.owner-reference",
      purpose: "Retain the same acquisition in the Owner Reference Library",
      assetRole: "owner_reference",
      policyRef: externalRef("access-policy.owner-reference"),
      rationale: "The Owner separately authorized this exact role",
      decidedAt: COMMITTED_AT,
    });
    const ownerBinding = record({
      recordKind: "owner_reference_binding",
      id: "binding.lifecycle-preflight.owner-reference",
      digitalAssetRef: graph.binding.digitalAssetRef,
      acquisitionRefs: [ref(graph.acquisition)],
      accessDecisionRefs: [ref(ownerAccess)],
      retentionPolicyRef: externalRef("retention-policy.owner-library"),
      ownerLibraryRef: externalRef("owner-library.local"),
      createdAt: COMMITTED_AT,
    });
    const ownerUse = record({
      recordKind: "lifecycle_use",
      id: "use.lifecycle-preflight.owner-reference",
      version: 1,
      subjectRef: graph.storage.subjectRef,
      provenancePaths: [
        {
          acquisitionRefs: [ref(graph.acquisition)],
          derivationRefs: [],
          accessDecisionRef: ref(ownerAccess),
          roleBindingRef: ref(ownerBinding),
        },
      ],
      operation: ownerAccess.operation,
      destination: ownerAccess.destination,
      purpose: ownerAccess.purpose,
      assetRole: ownerAccess.assetRole,
      policyRef: ownerAccess.policyRef,
      baselineReplayability: "complete",
      readinessRequirement: "required",
      createdAt: COMMITTED_AT,
    });
    const successorPolicy = record({
      ...withoutDigest(graph.storage),
      version: 2,
      parentVersionRef: {
        ...ref(graph.storage),
        version: graph.storage.version,
      },
      provenancePaths: graph.storage.provenancePaths.map((path) => ({
        ...path,
        roleBindingRefs: [ref(graph.binding), ref(ownerBinding)],
      })),
      createdAt: COMMITTED_AT,
    });

    const committed = harness.staging.applyTransaction({
      ...transaction("add-owner-role", [ownerAccess, ownerBinding, ownerUse, successorPolicy]),
      expectedHeadRef: headRef(base),
    });

    expect(committed.snapshot?.records).toEqual(
      expect.arrayContaining([ownerAccess, ownerBinding, ownerUse, successorPolicy])
    );
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      now: () => new Date(EFFECTIVE_AT),
      evidenceProvider: BASE_EVIDENCE_PROVIDER,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });
    const result = planDelete(service, committed, graph.acquisition);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(
        result.verifiedEvidence.retentionEvaluations.map(({ roleBindingRef }) => roleBindingRef)
      ).toEqual(expect.arrayContaining([ref(graph.binding), ref(ownerBinding)]));
    }
  });

  it("blocks a witness whose outer seal hides a tampered store enumeration", () => {
    const provider = transformEvidence((evidence) => {
      const enumeration = structuredClone(evidence.inventory.witness.storeEnumerations[0]!);
      enumeration.artifactBindings = [];
      evidence.inventory.witness = bindReferenceSourceInventoryClosureWitness({
        ...withoutIdentity(evidence.inventory.witness),
        storeEnumerations: [enumeration],
      });
      return evidence;
    });

    const { result, planner } = runBlockedPreflight(provider);

    expectBlocked(result, ["incomplete_controlled_store_inventory"]);
    expect(planner).not.toHaveBeenCalled();
  });

  it("blocks a receipt rejected by the server signature verifier", () => {
    const { result, planner } = runBlockedPreflight(BASE_EVIDENCE_PROVIDER, {
      ...TEST_REFERENCE_AUTHORITY_TRUST,
      verifyReceipt: () => false,
    });

    expectBlocked(result, ["unverified_authority"]);
    expect(planner).not.toHaveBeenCalled();
  });

  it("blocks a signed receipt whose key identity is outside the pinned trust root", () => {
    const { result, planner } = runBlockedPreflight(BASE_EVIDENCE_PROVIDER, {
      ...TEST_REFERENCE_AUTHORITY_TRUST,
      keyId: "untrusted-key",
    });

    expectBlocked(result, ["unverified_authority"]);
    expect(planner).not.toHaveBeenCalled();
  });

  it("blocks a permissive decision that omits a restrictive assertion elsewhere in its exact closure", () => {
    const harness = createHarness();
    const graph = lifecycleGraph({ includeOmittedRestriction: true });
    const committed = harness.staging.applyTransaction(transaction("base", graph.records));
    const planner = vi.fn(planReferenceSourceLifecycle);
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      now: () => new Date(EFFECTIVE_AT),
      planner,
      evidenceProvider: BASE_EVIDENCE_PROVIDER,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    const result = planAuthorityCheck(service, committed, graph.restrictionTarget);

    expectBlocked(result, ["unverified_authority"]);
    expect(planner).not.toHaveBeenCalled();
  });

  it("discards a plan when a controlled-store witness changes before return", () => {
    const harness = createHarness();
    const graph = lifecycleGraph();
    const committed = harness.staging.applyTransaction(transaction("base", graph.records));
    let calls = 0;
    const provider: ReferenceSourceLifecycleEvidenceProvider = (input) => {
      const evidence = BASE_EVIDENCE_PROVIDER(input);
      calls += 1;
      if (calls === 2) {
        evidence.inventory.witness = bindReferenceSourceInventoryClosureWitness({
          ...withoutIdentity(evidence.inventory.witness),
          producer: {
            ...evidence.inventory.witness.producer,
            instanceId: "vellum-test-server-postflight",
          },
        });
      }
      return evidence;
    };
    const planner = vi.fn(planReferenceSourceLifecycle);
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      now: () => new Date(EFFECTIVE_AT),
      planner,
      evidenceProvider: provider,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    expect(() => planDelete(service, committed, graph.acquisition)).toThrow(
      ReferenceSourceStagingConflictError
    );
    expect(planner).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
  });

  it("discards a plan when staging advances during evidence postflight", () => {
    const harness = createHarness();
    const graph = lifecycleGraph();
    const committed = harness.staging.applyTransaction(transaction("base", graph.records));
    let calls = 0;
    const provider: ReferenceSourceLifecycleEvidenceProvider = (input) => {
      calls += 1;
      if (calls === 2) {
        const lateAsset = record({
          recordKind: "digital_asset",
          id: "asset.postflight-race",
          sha256: "f".repeat(64),
          mediaType: "application/octet-stream",
          byteLength: 1,
        });
        harness.staging.applyTransaction({
          schemaVersion: 1,
          id: "transaction.postflight-race",
          expectedHeadRef: headRef(committed),
          operations: [
            { type: "append_record", record: lateAsset as ReferenceSourceStagingInputRecord },
          ],
          submittedAt: RECORDED_AT,
        });
      }
      return BASE_EVIDENCE_PROVIDER(input);
    };
    const service = new ReferenceSourceLifecyclePlanningService({
      store: harness.store,
      now: () => new Date(EFFECTIVE_AT),
      evidenceProvider: provider,
      authorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
      retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
    });

    expect(() => planDelete(service, committed, graph.acquisition)).toThrow(
      ReferenceSourceStagingConflictError
    );
    expect(calls).toBe(2);
  });

  it("blocks a validly digested receipt bound to the wrong first observation", () => {
    const provider = transformEvidence((evidence) => {
      evidence.authorityReceipts[0] = redigestReceipt(evidence.authorityReceipts[0]!, {
        accessDecisionFirstObservedRevision:
          evidence.authorityReceipts[0]!.accessDecisionFirstObservedRevision + 1,
      });
      return evidence;
    });

    const { result, planner } = runBlockedPreflight(provider);

    expectBlocked(result, ["unverified_authority"]);
    expect(planner).not.toHaveBeenCalled();
  });

  it("blocks a role binding whose retention policy lacks an authenticated receipt", () => {
    const provider = transformEvidence((evidence) => {
      evidence.retentionAuthorityReceipts = [];
      return evidence;
    });

    const { result, planner } = runBlockedPreflight(provider);

    expectBlocked(result, ["unverified_retention_policy"]);
    expect(planner).not.toHaveBeenCalled();
  });

  it("applies an authenticated release instead of treating every role binding as a hold", () => {
    const retained = runBlockedPreflight(
      BASE_EVIDENCE_PROVIDER,
      TEST_REFERENCE_AUTHORITY_TRUST,
      "delete"
    ).result;
    const releasedProvider = transformEvidence((evidence) => {
      evidence.retentionAuthorityReceipts[0] = redigestRetentionReceipt(
        evidence.retentionAuthorityReceipts[0]!,
        { outcome: "release" }
      );
      return evidence;
    });
    const released = runBlockedPreflight(
      releasedProvider,
      TEST_REFERENCE_AUTHORITY_TRUST,
      "delete"
    ).result;

    expect(retained).toMatchObject({
      status: "ready",
      consequences: [{ subjectKind: "asset_acquisition" }, { state: "restricted" }],
    });
    expect(released).toMatchObject({
      status: "ready",
      consequences: [{ subjectKind: "asset_acquisition" }, { state: "tombstone" }],
    });
  });

  it.each([
    ["impossible inventory time", "inventory", "2026-02-30T14:00:00.000Z"],
    ["noncanonical receipt time", "receipt", "2026-07-15T14:00:00Z"],
    ["impossible receipt time", "receipt", "2026-02-30T14:00:00.000Z"],
  ] as const)("blocks evidence with %s", (_label, target, timestamp) => {
    const provider = transformEvidence((evidence) => {
      if (target === "inventory") {
        evidence.inventory.witness = bindReferenceSourceInventoryClosureWitness({
          ...withoutIdentity(evidence.inventory.witness),
          producedAt: timestamp,
        });
      } else {
        evidence.authorityReceipts[0] = redigestReceipt(evidence.authorityReceipts[0]!, {
          verifiedAt: timestamp,
        });
      }
      return evidence;
    });

    const { result, planner } = runBlockedPreflight(provider);

    expectBlocked(result, [
      target === "inventory" ? "incomplete_controlled_store_inventory" : "unverified_authority",
    ]);
    expect(planner).not.toHaveBeenCalled();
  });

  it.each([
    [
      "misclassified source bytes",
      { decisionScope: "asset_as_derivative" } as const,
      /places source identity in derivativeRefs/,
    ],
    [
      "missing use role binding",
      { includeUseRoleBinding: false } as const,
      /must pin its exact Asset Role Binding/,
    ],
    [
      "missing retention root",
      { includeStorageRoleBindings: false } as const,
      /must pin the exact role-binding retention roots/,
    ],
  ])("rejects %s before lifecycle preflight", (_label, options, message) => {
    const harness = createHarness();
    const graph = lifecycleGraph(options);

    expect(() => harness.staging.applyTransaction(transaction("invalid", graph.records))).toThrow(
      message
    );
    expect(harness.store.readCurrentState()).toBeNull();
  });

  it.each([
    ["2026-02-30T12:00:00.000Z", /noncanonical or impossible timestamp/],
    ["2026-07-15T12:00:00Z", /schema validation/],
  ])("rejects lifecycle records with unsafe timestamp %s", (recordedAt, message) => {
    const harness = createHarness();
    const graph = lifecycleGraph({ recordedAt });

    expect(() =>
      harness.staging.applyTransaction(transaction("unsafe-time", graph.records))
    ).toThrow(message);
    expect(harness.store.readCurrentState()).toBeNull();
  });
});

function runBlockedPreflight(
  provider: ReferenceSourceLifecycleEvidenceProvider,
  authorityTrust: ReferenceSourceAuthorityTrust = TEST_REFERENCE_AUTHORITY_TRUST,
  action: "authority_check" | "delete" = "authority_check"
): {
  result: ReferenceSourceLifecyclePlanResult;
  planner: ReturnType<
    typeof vi.fn<
      (input: ReferenceSourceLifecyclePlannerInput) => ReferenceSourceLifecycleComputationResult
    >
  >;
} {
  const harness = createHarness();
  const graph = lifecycleGraph();
  const committed = harness.staging.applyTransaction(transaction("base", graph.records));
  const planner = vi.fn((input: ReferenceSourceLifecyclePlannerInput) =>
    planReferenceSourceLifecycle(input)
  );
  const service = new ReferenceSourceLifecyclePlanningService({
    store: harness.store,
    now: () => new Date(EFFECTIVE_AT),
    planner,
    evidenceProvider: provider,
    authorityTrust,
    retentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
  });
  return {
    result:
      action === "delete"
        ? planDelete(service, committed, graph.acquisition)
        : planAuthorityCheck(service, committed, graph.restrictionTarget),
    planner,
  };
}

function planAuthorityCheck(
  service: ReferenceSourceLifecyclePlanningService,
  committed: { head: { snapshotId: string; digest: string } | null },
  targetDecision: { id: string; digest: string }
): ReferenceSourceLifecyclePlanResult {
  return service.planDryRun({
    schemaVersion: 1,
    expectedHeadRef: headRef(committed),
    action: {
      kind: "restrict_access",
      targetAccessDecisionRef: ref(targetDecision),
      reason: "Verify every independent surviving authorization",
    },
  });
}

function planDelete(
  service: ReferenceSourceLifecyclePlanningService,
  committed: { head: { snapshotId: string; digest: string } | null },
  acquisition: { id: string; digest: string }
): ReferenceSourceLifecyclePlanResult {
  return service.planDryRun({
    schemaVersion: 1,
    expectedHeadRef: headRef(committed),
    action: {
      kind: "delete_acquisition",
      targetAcquisitionRef: ref(acquisition),
      reason: "Adversarial lifecycle preflight",
    },
  });
}

function expectBlocked(
  result: ReferenceSourceLifecyclePlanResult,
  expectedCodes: ReferenceLifecyclePlanningIssue["code"][]
): void {
  expect(Value.Check(ReferenceSourceLifecyclePlanResultSchema, result)).toBe(true);
  expect(result.status).toBe("blocked");
  if (result.status !== "blocked") throw new Error("Expected a blocked lifecycle plan");
  expect(result.issues.map(({ code }) => code)).toEqual(expect.arrayContaining(expectedCodes));
  const { id, digest, ...value } = result;
  const seed = referenceSourceDigest(value);
  expect(id).toBe(`reference-lifecycle-plan.${seed.slice(0, 24)}`);
  expect(digest).toBe(referenceSourceDigest({ ...value, id }));
}

function transformEvidence(
  transform: (evidence: ReferenceSourceLifecycleEvidence) => ReferenceSourceLifecycleEvidence
): ReferenceSourceLifecycleEvidenceProvider {
  return (input) => {
    const base = BASE_EVIDENCE_PROVIDER(input);
    return transform({
      inventory: structuredClone(base.inventory),
      authorityReceipts: structuredClone(base.authorityReceipts),
      retentionAuthorityReceipts: structuredClone(base.retentionAuthorityReceipts),
    });
  };
}

function redigestReceipt(
  receipt: ReferenceAuthorityVerificationReceipt,
  changes: Partial<Omit<ReferenceAuthorityVerificationReceipt, "digest">>
): ReferenceAuthorityVerificationReceipt {
  return withReferenceRecordDigest({
    ...withoutDigest(receipt),
    ...changes,
  }) as ReferenceAuthorityVerificationReceipt;
}

function redigestRetentionReceipt(
  receipt: ReferenceSourceRetentionAuthorityReceipt,
  changes: Partial<Omit<ReferenceSourceRetentionAuthorityReceipt, "digest">>
): ReferenceSourceRetentionAuthorityReceipt {
  return withReferenceRecordDigest({
    ...withoutDigest(receipt),
    ...changes,
  }) as ReferenceSourceRetentionAuthorityReceipt;
}

function createHarness(): {
  store: ReferenceSourceStagingStore;
  staging: ReferenceSourceStagingService;
} {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-lifecycle-preflight-"));
  roots.push(root);
  const store = new ReferenceSourceStagingStore({ rootDirectory: root });
  let sequence = 0;
  return {
    store,
    staging: new ReferenceSourceStagingService({
      store,
      now: () => new Date(COMMITTED_AT),
      createId: () => `lifecycle-preflight-${++sequence}`,
    }),
  };
}

type LifecycleGraphOptions = {
  decisionScope?: "exact" | "asset_as_derivative";
  includeUseRoleBinding?: boolean;
  includeStorageRoleBindings?: boolean;
  recordedAt?: string;
  storeIds?: string[];
  includeOmittedRestriction?: boolean;
};

function lifecycleGraph(options: LifecycleGraphOptions = {}) {
  const recordedAt = options.recordedAt ?? RECORDED_AT;
  const asset = record({
    recordKind: "digital_asset",
    id: "asset.lifecycle-preflight",
    sha256: "a".repeat(64),
    mediaType: "application/pdf",
    byteLength: 1024,
  });
  const acquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.lifecycle-preflight",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: {
      sourceKind: "upload",
      ownerActionRef: externalRef("owner-action.lifecycle-preflight"),
    },
    acquiredAt: recordedAt,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.local"),
  });
  const rights = record({
    recordKind: "rights_assertion",
    id: "rights.lifecycle-preflight",
    version: 1,
    subjectRef: ref(acquisition),
    subjectKind: "asset_acquisition",
    rightsKind: "owner_private_access",
    status: "permitted",
    claimant: { kind: "owner", claimantRef: externalRef("owner.local") },
    evidenceRefs: [externalRef("evidence.owner-upload")],
    assertedAt: recordedAt,
  });
  const omittedRestriction = record({
    recordKind: "rights_assertion",
    id: "rights.lifecycle-preflight.omitted-restriction",
    version: 1,
    subjectRef: ref(asset),
    subjectKind: "digital_asset",
    rightsKind: "owner_private_access",
    status: "restricted",
    claimant: { kind: "reviewer", claimantRef: externalRef("reviewer.restriction") },
    evidenceRefs: [externalRef("evidence.restriction")],
    assertedAt: recordedAt,
  });
  const access = record({
    recordKind: "access_decision",
    id: "access.lifecycle-preflight",
    version: 1,
    outcome: "allow",
    operation: "owner_private_study",
    sourceRefs:
      options.decisionScope === "asset_as_derivative"
        ? [ref(acquisition)]
        : [ref(acquisition), ref(asset)],
    derivativeRefs: options.decisionScope === "asset_as_derivative" ? [ref(asset)] : [],
    destination: { kind: "local_runtime" },
    purpose: "Arrange an owner-provided source locally",
    assetRole: "arrangement_source",
    policyRef: externalRef("access-policy.owner-private-study"),
    rightsAssertionRefs: [ref(rights)],
    authorityRefs: [externalRef("owner.local")],
    rationale: "Exact Owner upload authorized for local private study",
    decidedAt: recordedAt,
  });
  const binding = record({
    recordKind: "arrangement_source_binding",
    id: "binding.lifecycle-preflight",
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(acquisition)],
    accessDecisionRefs: [ref(access)],
    retentionPolicyRef: externalRef("retention-policy.workspace"),
    workspaceRef: externalRef("workspace.lifecycle-preflight"),
    createdAt: recordedAt,
  });
  const storage = record({
    recordKind: "lifecycle_storage_policy",
    id: "storage.lifecycle-preflight",
    version: 1,
    subjectRef: ref(asset),
    subjectKind: "asset_bytes",
    provenancePaths: [
      {
        acquisitionRefs: [ref(acquisition)],
        derivationRefs: [],
        roleBindingRefs: options.includeStorageRoleBindings === false ? [] : [ref(binding)],
      },
    ],
    policyRef: externalRef("lifecycle-policy.local-bytes"),
    custody: {
      kind: "vellum_controlled",
      storeIds: options.storeIds ?? ["reference-source-staging"],
      retention: "unretained",
      tombstonePolicy: "preserve",
    },
    replayRequirement: "required",
    readinessRequirement: "required",
    createdAt: recordedAt,
  });
  const use = record({
    recordKind: "lifecycle_use",
    id: "use.lifecycle-preflight",
    version: 1,
    subjectRef: ref(asset),
    provenancePaths: [
      {
        acquisitionRefs: [ref(acquisition)],
        derivationRefs: [],
        accessDecisionRef: ref(access),
        ...(options.includeUseRoleBinding === false ? {} : { roleBindingRef: ref(binding) }),
      },
    ],
    operation: access.operation,
    destination: access.destination,
    purpose: access.purpose,
    assetRole: access.assetRole,
    policyRef: access.policyRef,
    baselineReplayability: "complete",
    readinessRequirement: "required",
    createdAt: recordedAt,
  });
  const restrictionTarget = record({
    recordKind: "access_decision",
    id: "access.lifecycle-preflight.restriction-target",
    version: 1,
    outcome: "deny",
    operation: "owner_private_study",
    sourceRefs: [ref(acquisition), ref(asset)],
    derivativeRefs: [],
    destination: { kind: "local_runtime" },
    purpose: "Independent restriction target for preflight testing",
    policyRef: externalRef("access-policy.restriction-target"),
    rightsAssertionRefs: [ref(rights)],
    authorityRefs: [externalRef("owner.local")],
    rationale: "The target is denied independently of the surviving lifecycle use",
    decidedAt: recordedAt,
  });

  return {
    records: [
      asset,
      acquisition,
      rights,
      ...(options.includeOmittedRestriction ? [omittedRestriction] : []),
      access,
      binding,
      storage,
      use,
      restrictionTarget,
    ],
    acquisition,
    access,
    binding,
    storage,
    restrictionTarget,
  };
}

function transaction(
  id: string,
  records: ReferenceSourceStagingRecord[]
): ReferenceSourceStagingTransaction {
  return {
    schemaVersion: 1,
    id: `transaction.${id}`,
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
  return { id, digest: referenceSourceDigest({ id }) };
}

function artifactBinding(artifactRef: ReferenceRecordRef) {
  return {
    artifactRef,
    blobSha256: referenceSourceDigest({ artifactRef, fixture: "orphan-bytes" }),
    byteLength: 1,
  };
}

function headRef(value: {
  head: { snapshotId: string; digest: string } | null;
}): ReferenceRecordRef {
  if (!value.head) throw new Error("Expected a staging head");
  return { id: value.head.snapshotId, digest: value.head.digest };
}

function withoutDigest<T extends { digest: string }>(value: T): Omit<T, "digest"> {
  const { digest: _digest, ...core } = value;
  return core;
}

function withoutIdentity<T extends { id: string; digest: string }>(
  value: T
): Omit<T, "id" | "digest"> {
  const { id: _id, digest: _digest, ...core } = value;
  return core;
}
