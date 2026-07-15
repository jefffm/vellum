import { describe, expect, it } from "vitest";

import { referenceSourceDigest } from "../../lib/reference-source-domain.js";
import { planReferenceSourceInventoryClosure } from "../../lib/reference-source-inventory.js";
import {
  createReferenceSourceInventoryProvider,
  createUnlinkedReferenceSourceStagingInventoryAdapter,
  type ReferenceSourceControlledStoreInventoryAdapter,
} from "./reference-source-inventory-provider.js";

const PRODUCED_AT = "2026-07-15T13:00:00.000Z";
const PRODUCER = {
  kind: "vellum_server" as const,
  instanceId: "reference-source-inventory-provider-test",
  buildDigest: "f".repeat(64),
};

describe("reference-source controlled-store inventory provider", () => {
  it("fails closed while staging metadata has no exact byte-store linkage", () => {
    const provide = createReferenceSourceInventoryProvider({
      adapters: [createUnlinkedReferenceSourceStagingInventoryAdapter()],
      registryGeneration: 1,
      producer: PRODUCER,
    });

    const evidence = provide({ producedAt: PRODUCED_AT });
    const plan = planReferenceSourceInventoryClosure({
      currentRegistry: evidence.currentRegistry,
      witness: evidence.witness,
    });

    expect(evidence.witness).toMatchObject({
      status: "failed",
      storeEnumerations: [
        {
          storeId: "reference-source-staging",
          status: "failed",
          failureCode: "enumeration_incomplete",
          artifactBindings: [],
        },
      ],
    });
    expect(plan.status).toBe("blocked");
    if (plan.status !== "blocked") throw new Error("Expected incomplete inventory to block");
    expect(plan.issues).toContainEqual({
      code: "failed_store_enumeration",
      storeId: "reference-source-staging",
    });
  });

  it("uses only independently registered store observations", () => {
    let actualArtifacts = [artifactBinding("asset.actual", "a")];
    const adapter: ReferenceSourceControlledStoreInventoryAdapter = {
      storeId: "controlled-store.actual",
      storeKind: "content_addressed_bytes",
      observe: () => ({
        storeGeneration: 7,
        storeStateDigest: referenceSourceDigest(actualArtifacts),
        status: "complete",
        artifactBindings: actualArtifacts,
      }),
    };
    const provide = createReferenceSourceInventoryProvider({
      adapters: [adapter],
      registryGeneration: 3,
      producer: PRODUCER,
    });

    const first = provide({ producedAt: PRODUCED_AT });
    actualArtifacts = [artifactBinding("asset.actual", "a"), artifactBinding("asset.orphan", "b")];
    const second = provide({ producedAt: PRODUCED_AT });

    expect(first.currentRegistry.stores.map(({ storeId }) => storeId)).toEqual([
      "controlled-store.actual",
    ]);
    expect(first.witness.storeEnumerations[0]?.artifactBindings).toEqual([
      artifactBinding("asset.actual", "a"),
    ]);
    expect(second.witness.storeEnumerations[0]?.artifactBindings).toEqual(actualArtifacts);
    expect(second.currentRegistry.stores[0]?.storeStateDigest).not.toBe(
      first.currentRegistry.stores[0]?.storeStateDigest
    );
  });

  it("turns an adapter read failure into failed evidence instead of omission", () => {
    const provide = createReferenceSourceInventoryProvider({
      adapters: [
        {
          storeId: "controlled-store.unreadable",
          storeKind: "content_addressed_bytes",
          observe: () => {
            throw new Error("disk is unavailable");
          },
        },
      ],
      registryGeneration: 1,
      producer: PRODUCER,
    });

    const evidence = provide({ producedAt: PRODUCED_AT });

    expect(evidence.currentRegistry.stores.map(({ storeId }) => storeId)).toEqual([
      "controlled-store.unreadable",
    ]);
    expect(evidence.witness.storeEnumerations).toMatchObject([
      {
        storeId: "controlled-store.unreadable",
        status: "failed",
        failureCode: "read_error",
      },
    ]);
  });

  it("rejects empty and duplicate server registry configuration", () => {
    expect(() =>
      createReferenceSourceInventoryProvider({
        adapters: [],
        registryGeneration: 1,
        producer: PRODUCER,
      })
    ).toThrow(/at least one controlled-store adapter/);

    const adapter = createUnlinkedReferenceSourceStagingInventoryAdapter();
    expect(() =>
      createReferenceSourceInventoryProvider({
        adapters: [adapter, adapter],
        registryGeneration: 1,
        producer: PRODUCER,
      })
    ).toThrow(/Duplicate reference-source controlled-store adapter/);
  });
});

function artifactRef(id: string, fill: string) {
  return { id, digest: fill.repeat(64) };
}

function artifactBinding(id: string, fill: string) {
  return {
    artifactRef: artifactRef(id, fill),
    blobSha256: fill.repeat(64),
    byteLength: 1,
  };
}
