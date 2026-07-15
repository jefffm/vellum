import { referenceSourceDigest } from "../../lib/reference-source-domain.js";
import {
  bindReferenceSourceInventoryClosureWitness,
  bindReferenceSourceRequiredStoreRegistry,
  bindReferenceSourceStoreEnumeration,
  type ReferenceSourceInventoryClosureWitness,
  type ReferenceSourceInventoryProducer,
  type ReferenceSourceRequiredStoreRegistry,
  type ReferenceSourceStoreEnumerationCore,
} from "../../lib/reference-source-inventory.js";

type WithoutStoreId<T> = T extends unknown ? Omit<T, "storeId"> : never;
type StoreObservation = WithoutStoreId<ReferenceSourceStoreEnumerationCore>;

/**
 * Server-owned boundary for one concrete Vellum-controlled store.
 *
 * `observe` must enumerate the store itself. It deliberately receives no
 * reference-source snapshot: deriving an enumeration from the expected graph
 * would make missing bytes, orphan bytes, and an omitted store invisible.
 */
export type ReferenceSourceControlledStoreInventoryAdapter = {
  readonly storeId: string;
  readonly storeKind: string;
  observe(): StoreObservation;
};

export type ReferenceSourceInventoryEvidence = {
  currentRegistry: ReferenceSourceRequiredStoreRegistry;
  witness: ReferenceSourceInventoryClosureWitness;
};

export type ReferenceSourceInventoryProviderOptions = {
  adapters: readonly ReferenceSourceControlledStoreInventoryAdapter[];
  registryGeneration: number;
  producer: ReferenceSourceInventoryProducer;
};

export type ReferenceSourceInventoryProvider = (input: {
  producedAt: string;
}) => ReferenceSourceInventoryEvidence;

/**
 * Build an inventory provider from an independently configured, exhaustive
 * controlled-store registry. Snapshot records are intentionally not an input.
 */
export function createReferenceSourceInventoryProvider(
  options: ReferenceSourceInventoryProviderOptions
): ReferenceSourceInventoryProvider {
  if (options.adapters.length === 0) {
    throw new Error("Reference-source inventory requires at least one controlled-store adapter");
  }
  if (!Number.isSafeInteger(options.registryGeneration) || options.registryGeneration < 0) {
    throw new Error("Reference-source inventory registry generation must be a safe integer");
  }

  const adapters = options.adapters.map((adapter) => ({
    storeId: adapter.storeId,
    storeKind: adapter.storeKind,
    observe: adapter.observe.bind(adapter),
  }));
  const producer = structuredClone(options.producer);
  const storeIds = new Set<string>();
  for (const adapter of adapters) {
    if (storeIds.has(adapter.storeId)) {
      throw new Error(`Duplicate reference-source controlled-store adapter: ${adapter.storeId}`);
    }
    storeIds.add(adapter.storeId);
  }

  return ({ producedAt }) => {
    const observations = adapters.map((adapter) => observeStore(adapter));
    const registry = bindReferenceSourceRequiredStoreRegistry({
      schemaVersion: 1,
      registryGeneration: options.registryGeneration,
      stores: observations.map(({ adapter, observation }) => ({
        storeId: adapter.storeId,
        storeKind: adapter.storeKind,
        controlBoundary: "vellum_controlled" as const,
        required: true as const,
        storeGeneration: observation.storeGeneration,
        storeStateDigest: observation.storeStateDigest,
      })),
    });
    const enumerations = observations.map(({ adapter, observation }) =>
      bindStoreObservation(adapter.storeId, observation)
    );
    const witness = bindReferenceSourceInventoryClosureWitness({
      schemaVersion: 1,
      producer: structuredClone(producer),
      producedAt,
      requiredStoreRegistryRef: { id: registry.id, digest: registry.digest },
      requiredStoreRegistryGeneration: registry.registryGeneration,
      status: enumerations.every(({ status }) => status === "complete") ? "complete" : "failed",
      storeEnumerations: enumerations,
    });
    return { currentRegistry: registry, witness };
  };
}

/**
 * Honest production placeholder until the staging graph is linked to a real
 * byte-store catalog. It never upgrades metadata refs into a completeness
 * claim, and therefore makes lifecycle planning fail closed.
 */
export function createUnlinkedReferenceSourceStagingInventoryAdapter(): ReferenceSourceControlledStoreInventoryAdapter {
  const storeId = "reference-source-staging";
  const storeKind = "reference_source_staging";
  const storeStateDigest = referenceSourceDigest({
    schemaVersion: 1,
    storeId,
    storeKind,
    status: "byte_store_linkage_unavailable",
  });

  return {
    storeId,
    storeKind,
    observe: () => ({
      storeGeneration: 0,
      storeStateDigest,
      status: "failed",
      failureCode: "enumeration_incomplete",
      artifactBindings: [],
    }),
  };
}

function observeStore(adapter: ReferenceSourceControlledStoreInventoryAdapter): {
  adapter: ReferenceSourceControlledStoreInventoryAdapter;
  observation: StoreObservation;
} {
  try {
    return { adapter, observation: structuredClone(adapter.observe()) };
  } catch {
    return {
      adapter,
      observation: {
        storeGeneration: 0,
        storeStateDigest: failedObservationDigest(adapter),
        status: "failed",
        failureCode: "read_error",
        artifactBindings: [],
      },
    };
  }
}

function failedObservationDigest(adapter: ReferenceSourceControlledStoreInventoryAdapter): string {
  return referenceSourceDigest({
    schemaVersion: 1,
    storeId: adapter.storeId,
    storeKind: adapter.storeKind,
    status: "observation_failed",
  });
}

function bindStoreObservation(storeId: string, observation: StoreObservation) {
  return observation.status === "complete"
    ? bindReferenceSourceStoreEnumeration({ storeId, ...observation })
    : bindReferenceSourceStoreEnumeration({ storeId, ...observation });
}
