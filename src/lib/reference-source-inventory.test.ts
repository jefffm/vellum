import { describe, expect, it } from "vitest";

import { referenceSourceDigest } from "./reference-source-domain.js";
import {
  bindReferenceSourceInventoryClosureWitness,
  bindReferenceSourceRequiredStoreRegistry,
  bindReferenceSourceStoreEnumeration,
  planReferenceSourceInventoryClosure,
  type ReferenceSourceInventoryClosurePlan,
  type ReferenceSourceRequiredStore,
  type ReferenceSourceRequiredStoreRegistry,
  type ReferenceSourceStoreEnumeration,
} from "./reference-source-inventory.js";

describe("reference-source controlled-store inventory closure", () => {
  it("seals an exact server-produced enumeration of every current required store", () => {
    const registry = requiredStoreRegistry();
    const primary = completeEnumeration(registry.stores[0]!, [artifact("asset.primary", "a")]);
    const backup = completeEnumeration(registry.stores[1]!, [
      artifact("asset.primary", "a"),
      artifact("derivative.ocr", "b"),
    ]);
    const witness = closureWitness(registry, [backup, primary], "complete");

    const plan = planReferenceSourceInventoryClosure({ currentRegistry: registry, witness });

    if (plan.status !== "ready") throw new Error("Expected inventory closure to be ready");
    expect(plan.requiredStoreRegistryRef).toEqual({ id: registry.id, digest: registry.digest });
    expect(plan.witnessRef).toEqual({ id: witness.id, digest: witness.digest });
    expect(plan.requiredStoreCount).toBe(2);
    expect(plan.artifactCount).toBe(3);
    expect(plan.stores.map(({ storeId }) => storeId)).toEqual([
      "controlled-store.backup",
      "controlled-store.primary",
    ]);
    expect(plan.stores[0]).toMatchObject({
      storeGeneration: registry.stores[1]!.storeGeneration,
      storeStateDigest: registry.stores[1]!.storeStateDigest,
      enumerationDigest: backup.digest,
    });
    expectBoundDigest(witness);
    expectBoundDigest(primary);
    expectBoundDigest(plan);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.stores[0]!.artifactBindings)).toBe(true);
  });

  it("fails closed for missing, duplicate, and unregistered store enumerations", () => {
    const registry = requiredStoreRegistry();
    const primary = completeEnumeration(registry.stores[0]!, []);
    const rogue = bindReferenceSourceStoreEnumeration({
      storeId: "controlled-store.rogue",
      storeGeneration: 1,
      storeStateDigest: "9".repeat(64),
      status: "complete",
      artifactBindings: [],
    });
    const witness = closureWitness(registry, [primary, primary, rogue], "complete");

    expect(
      issueKeys(planReferenceSourceInventoryClosure({ currentRegistry: registry, witness }))
    ).toEqual(
      expect.arrayContaining([
        "duplicate_store_enumeration:controlled-store.primary",
        "missing_store_enumeration:controlled-store.backup",
        "unregistered_store_enumeration:controlled-store.rogue",
      ])
    );
  });

  it("blocks a failed enumeration even when it returns a partial artifact list", () => {
    const registry = requiredStoreRegistry();
    const witness = closureWitness(
      registry,
      [
        completeEnumeration(registry.stores[0]!, []),
        bindReferenceSourceStoreEnumeration({
          storeId: registry.stores[1]!.storeId,
          storeGeneration: registry.stores[1]!.storeGeneration,
          storeStateDigest: registry.stores[1]!.storeStateDigest,
          status: "failed",
          failureCode: "read_error",
          artifactBindings: [artifact("partial.result", "c")],
        }),
      ],
      "failed"
    );

    expect(
      issueKeys(planReferenceSourceInventoryClosure({ currentRegistry: registry, witness }))
    ).toContain("failed_store_enumeration:controlled-store.backup");
  });

  it("rejects stale registry and store generations or state digests without consulting time", () => {
    const oldRegistry = requiredStoreRegistry();
    const oldWitness = closureWitness(
      oldRegistry,
      oldRegistry.stores.map((store) => completeEnumeration(store, [])),
      "complete"
    );
    const currentRegistry = bindReferenceSourceRequiredStoreRegistry({
      schemaVersion: 1,
      registryGeneration: oldRegistry.registryGeneration + 1,
      stores: oldRegistry.stores.map((store) =>
        store.storeId === "controlled-store.backup"
          ? {
              ...store,
              storeGeneration: store.storeGeneration + 1,
              storeStateDigest: "e".repeat(64),
            }
          : store
      ),
    });

    const issues = issueKeys(
      planReferenceSourceInventoryClosure({ currentRegistry, witness: oldWitness })
    );
    expect(issues).toContain("stale_required_store_registry:");
    expect(issues).toContain("stale_store_enumeration:controlled-store.backup");
  });

  it("rejects duplicate required registrations and duplicate artifact references", () => {
    const base = requiredStoreRegistry();
    const duplicateRegistry = bindReferenceSourceRequiredStoreRegistry({
      schemaVersion: 1,
      registryGeneration: base.registryGeneration,
      stores: [base.stores[0]!, base.stores[0]!],
    });
    const duplicateWitness = closureWitness(
      duplicateRegistry,
      [
        completeEnumeration(duplicateRegistry.stores[0]!, [
          artifact("asset.repeated", "d"),
          artifact("asset.repeated", "d"),
        ]),
      ],
      "complete"
    );

    const issues = issueKeys(
      planReferenceSourceInventoryClosure({
        currentRegistry: duplicateRegistry,
        witness: duplicateWitness,
      })
    );
    expect(issues).toContain("duplicate_required_store:controlled-store.primary");
    expect(issues).toContain("duplicate_artifact_ref:controlled-store.primary");
  });

  it("detects tampering independently at registry, witness, and store-enumeration boundaries", () => {
    const registry = requiredStoreRegistry();
    const primary = completeEnumeration(registry.stores[0]!, []);
    const backup = completeEnumeration(registry.stores[1]!, []);
    const witness = closureWitness(registry, [primary, backup], "complete");

    const tamperedRegistry = { ...registry, registryGeneration: registry.registryGeneration + 1 };
    expect(
      issueKeys(planReferenceSourceInventoryClosure({ currentRegistry: tamperedRegistry, witness }))
    ).toEqual(["invalid_required_store_registry_digest:"]);

    const tamperedWitness = { ...witness, producedAt: "2026-07-15T17:00:00.000Z" };
    expect(
      issueKeys(
        planReferenceSourceInventoryClosure({ currentRegistry: registry, witness: tamperedWitness })
      )
    ).toEqual(["invalid_inventory_witness_digest:"]);

    const invalidEnumeration = { ...primary, digest: "f".repeat(64) };
    const reboundWitness = closureWitness(registry, [invalidEnumeration, backup], "complete");
    expect(
      issueKeys(
        planReferenceSourceInventoryClosure({ currentRegistry: registry, witness: reboundWitness })
      )
    ).toContain("invalid_store_enumeration_digest:controlled-store.primary");
  });

  it("rejects inconsistent aggregate status and non-server witness producers", () => {
    const registry = requiredStoreRegistry();
    const failed = bindReferenceSourceStoreEnumeration({
      storeId: registry.stores[1]!.storeId,
      storeGeneration: registry.stores[1]!.storeGeneration,
      storeStateDigest: registry.stores[1]!.storeStateDigest,
      status: "failed",
      failureCode: "enumeration_incomplete",
      artifactBindings: [],
    });
    const inconsistent = closureWitness(
      registry,
      [completeEnumeration(registry.stores[0]!, []), failed],
      "complete"
    );

    const issues = issueKeys(
      planReferenceSourceInventoryClosure({ currentRegistry: registry, witness: inconsistent })
    );
    expect(issues).toContain("inconsistent_witness_status:");
    expect(issues).toContain("failed_store_enumeration:controlled-store.backup");

    const clientProduced = {
      ...inconsistent,
      producer: { ...inconsistent.producer, kind: "client" },
    };
    expect(
      issueKeys(
        planReferenceSourceInventoryClosure({ currentRegistry: registry, witness: clientProduced })
      )
    ).toEqual(["invalid_inventory_witness:"]);
  });
});

function requiredStoreRegistry(): ReferenceSourceRequiredStoreRegistry {
  return bindReferenceSourceRequiredStoreRegistry({
    schemaVersion: 1,
    registryGeneration: 4,
    stores: [
      {
        storeId: "controlled-store.primary",
        storeKind: "content_addressed_assets",
        controlBoundary: "vellum_controlled",
        required: true,
        storeGeneration: 11,
        storeStateDigest: "1".repeat(64),
      },
      {
        storeId: "controlled-store.backup",
        storeKind: "managed_backup",
        controlBoundary: "vellum_controlled",
        required: true,
        storeGeneration: 7,
        storeStateDigest: "2".repeat(64),
      },
    ],
  });
}

function completeEnumeration(
  store: ReferenceSourceRequiredStore,
  artifactBindings: Array<{
    artifactRef: { id: string; digest: string };
    blobSha256: string;
    byteLength: number;
  }>
): ReferenceSourceStoreEnumeration {
  return bindReferenceSourceStoreEnumeration({
    storeId: store.storeId,
    storeGeneration: store.storeGeneration,
    storeStateDigest: store.storeStateDigest,
    status: "complete",
    artifactBindings,
  });
}

function closureWitness(
  registry: ReferenceSourceRequiredStoreRegistry,
  storeEnumerations: ReferenceSourceStoreEnumeration[],
  status: "complete" | "failed"
) {
  return bindReferenceSourceInventoryClosureWitness({
    schemaVersion: 1,
    producer: {
      kind: "vellum_server",
      instanceId: "vellum-server.local",
      buildDigest: "8".repeat(64),
    },
    producedAt: "2026-07-15T16:00:00.000Z",
    requiredStoreRegistryRef: { id: registry.id, digest: registry.digest },
    requiredStoreRegistryGeneration: registry.registryGeneration,
    status,
    storeEnumerations,
  });
}

function artifact(id: string, digestSeed: string) {
  return {
    artifactRef: { id, digest: digestSeed.repeat(64) },
    blobSha256: digestSeed.repeat(64),
    byteLength: 1,
  };
}

function issueKeys(plan: ReferenceSourceInventoryClosurePlan): string[] {
  if (plan.status !== "blocked") throw new Error("Expected inventory closure to be blocked");
  return plan.issues.map(({ code, storeId }) => `${code}:${storeId ?? ""}`);
}

function expectBoundDigest(value: { digest: string } & Record<string, unknown>): void {
  const { digest, ...core } = value;
  expect(digest).toBe(referenceSourceDigest(core));
}
