import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { ReferenceRecordRefSchema, referenceSourceDigest } from "./reference-source-domain.js";

const Strict = { additionalProperties: false } as const;
const IdentifierSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

export const ReferenceSourceRequiredStoreSchema = Type.Object(
  {
    storeId: IdentifierSchema,
    storeKind: IdentifierSchema,
    controlBoundary: Type.Literal("vellum_controlled"),
    required: Type.Literal(true),
    storeGeneration: Type.Integer({ minimum: 0 }),
    storeStateDigest: DigestSchema,
  },
  Strict
);
export type ReferenceSourceRequiredStore = Static<typeof ReferenceSourceRequiredStoreSchema>;

export const ReferenceSourceRequiredStoreRegistrySchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: IdentifierSchema,
    digest: DigestSchema,
    registryGeneration: Type.Integer({ minimum: 0 }),
    stores: Type.Array(ReferenceSourceRequiredStoreSchema, { minItems: 1 }),
  },
  Strict
);
export type ReferenceSourceRequiredStoreRegistry = Static<
  typeof ReferenceSourceRequiredStoreRegistrySchema
>;

const ReferenceSourceCompleteStoreEnumerationCoreSchema = Type.Object(
  {
    storeId: IdentifierSchema,
    storeGeneration: Type.Integer({ minimum: 0 }),
    storeStateDigest: DigestSchema,
    status: Type.Literal("complete"),
    artifactRefs: Type.Array(ReferenceRecordRefSchema),
  },
  Strict
);

const ReferenceSourceFailedStoreEnumerationCoreSchema = Type.Object(
  {
    storeId: IdentifierSchema,
    storeGeneration: Type.Integer({ minimum: 0 }),
    storeStateDigest: DigestSchema,
    status: Type.Literal("failed"),
    failureCode: Type.Union([
      Type.Literal("unreachable"),
      Type.Literal("read_error"),
      Type.Literal("generation_changed"),
      Type.Literal("state_digest_changed"),
      Type.Literal("enumeration_incomplete"),
    ]),
    artifactRefs: Type.Array(ReferenceRecordRefSchema),
  },
  Strict
);

export const ReferenceSourceStoreEnumerationCoreSchema = Type.Union([
  ReferenceSourceCompleteStoreEnumerationCoreSchema,
  ReferenceSourceFailedStoreEnumerationCoreSchema,
]);
export type ReferenceSourceStoreEnumerationCore = Static<
  typeof ReferenceSourceStoreEnumerationCoreSchema
>;

const ReferenceSourceCompleteStoreEnumerationSchema = Type.Object(
  {
    ...ReferenceSourceCompleteStoreEnumerationCoreSchema.properties,
    digest: DigestSchema,
  },
  Strict
);
const ReferenceSourceFailedStoreEnumerationSchema = Type.Object(
  {
    ...ReferenceSourceFailedStoreEnumerationCoreSchema.properties,
    digest: DigestSchema,
  },
  Strict
);
export const ReferenceSourceStoreEnumerationSchema = Type.Union([
  ReferenceSourceCompleteStoreEnumerationSchema,
  ReferenceSourceFailedStoreEnumerationSchema,
]);
export type ReferenceSourceStoreEnumeration = Static<typeof ReferenceSourceStoreEnumerationSchema>;

const ReferenceSourceInventoryProducerSchema = Type.Object(
  {
    kind: Type.Literal("vellum_server"),
    instanceId: IdentifierSchema,
    buildDigest: DigestSchema,
  },
  Strict
);
export type ReferenceSourceInventoryProducer = Static<
  typeof ReferenceSourceInventoryProducerSchema
>;

export const ReferenceSourceInventoryClosureWitnessSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: IdentifierSchema,
    digest: DigestSchema,
    producer: ReferenceSourceInventoryProducerSchema,
    producedAt: IsoTimestampSchema,
    requiredStoreRegistryRef: ReferenceRecordRefSchema,
    requiredStoreRegistryGeneration: Type.Integer({ minimum: 0 }),
    status: Type.Union([Type.Literal("complete"), Type.Literal("failed")]),
    storeEnumerations: Type.Array(ReferenceSourceStoreEnumerationSchema),
  },
  Strict
);
export type ReferenceSourceInventoryClosureWitness = Static<
  typeof ReferenceSourceInventoryClosureWitnessSchema
>;

export const ReferenceSourceInventoryClosureIssueCodeSchema = Type.Union([
  Type.Literal("invalid_required_store_registry"),
  Type.Literal("invalid_required_store_registry_digest"),
  Type.Literal("duplicate_required_store"),
  Type.Literal("invalid_inventory_witness"),
  Type.Literal("invalid_inventory_witness_digest"),
  Type.Literal("stale_required_store_registry"),
  Type.Literal("inconsistent_witness_status"),
  Type.Literal("duplicate_store_enumeration"),
  Type.Literal("missing_store_enumeration"),
  Type.Literal("unregistered_store_enumeration"),
  Type.Literal("invalid_store_enumeration_digest"),
  Type.Literal("failed_store_enumeration"),
  Type.Literal("stale_store_enumeration"),
  Type.Literal("duplicate_artifact_ref"),
]);
export type ReferenceSourceInventoryClosureIssueCode = Static<
  typeof ReferenceSourceInventoryClosureIssueCodeSchema
>;

const ReferenceSourceInventoryClosureIssueSchema = Type.Object(
  {
    code: ReferenceSourceInventoryClosureIssueCodeSchema,
    storeId: Type.Optional(IdentifierSchema),
  },
  Strict
);
export type ReferenceSourceInventoryClosureIssue = Static<
  typeof ReferenceSourceInventoryClosureIssueSchema
>;

const ReferenceSourceValidatedStoreSchema = Type.Object(
  {
    storeId: IdentifierSchema,
    storeKind: IdentifierSchema,
    storeGeneration: Type.Integer({ minimum: 0 }),
    storeStateDigest: DigestSchema,
    enumerationDigest: DigestSchema,
    artifactRefs: Type.Array(ReferenceRecordRefSchema),
  },
  Strict
);

const ReferenceSourceInventoryClosurePlanCore = {
  schemaVersion: Type.Literal(1),
  id: IdentifierSchema,
  digest: DigestSchema,
  mode: Type.Literal("inventory_closure_validation"),
};

const ReferenceSourceInventoryClosureReadyPlanSchema = Type.Object(
  {
    ...ReferenceSourceInventoryClosurePlanCore,
    status: Type.Literal("ready"),
    requiredStoreRegistryRef: ReferenceRecordRefSchema,
    witnessRef: ReferenceRecordRefSchema,
    requiredStoreCount: Type.Integer({ minimum: 1 }),
    artifactCount: Type.Integer({ minimum: 0 }),
    stores: Type.Array(ReferenceSourceValidatedStoreSchema, { minItems: 1 }),
  },
  Strict
);

const ReferenceSourceInventoryClosureBlockedPlanSchema = Type.Object(
  {
    ...ReferenceSourceInventoryClosurePlanCore,
    status: Type.Literal("blocked"),
    requiredStoreRegistryRef: Type.Optional(ReferenceRecordRefSchema),
    witnessRef: Type.Optional(ReferenceRecordRefSchema),
    issues: Type.Array(ReferenceSourceInventoryClosureIssueSchema, { minItems: 1 }),
  },
  Strict
);

export const ReferenceSourceInventoryClosurePlanSchema = Type.Union([
  ReferenceSourceInventoryClosureReadyPlanSchema,
  ReferenceSourceInventoryClosureBlockedPlanSchema,
]);
export type ReferenceSourceInventoryClosurePlan = Static<
  typeof ReferenceSourceInventoryClosurePlanSchema
>;

export type ReferenceSourceRequiredStoreRegistryCore = Omit<
  ReferenceSourceRequiredStoreRegistry,
  "id" | "digest"
>;
export type ReferenceSourceInventoryClosureWitnessCore = Omit<
  ReferenceSourceInventoryClosureWitness,
  "id" | "digest"
>;

/** Binds the current required-store registry without asserting that its membership is coherent. */
export function bindReferenceSourceRequiredStoreRegistry(
  core: ReferenceSourceRequiredStoreRegistryCore
): ReferenceSourceRequiredStoreRegistry {
  return bindIdentified(
    "reference-store-registry",
    core,
    ReferenceSourceRequiredStoreRegistrySchema
  );
}

/** Binds one exact store generation and its enumerated artifact references. */
export function bindReferenceSourceStoreEnumeration(
  core: ReferenceSourceStoreEnumerationCore
): ReferenceSourceStoreEnumeration {
  const cloned = structuredClone(core);
  const value = { ...cloned, digest: referenceSourceDigest(cloned) };
  return decodeAndFreeze(ReferenceSourceStoreEnumerationSchema, value);
}

/**
 * Binds a server-produced witness. Semantic closure is deliberately checked by
 * the planner so missing, duplicate, failed, and stale enumerations remain
 * explicit blocked results rather than constructor exceptions.
 */
export function bindReferenceSourceInventoryClosureWitness(
  core: ReferenceSourceInventoryClosureWitnessCore
): ReferenceSourceInventoryClosureWitness {
  return bindIdentified(
    "reference-inventory-witness",
    core,
    ReferenceSourceInventoryClosureWitnessSchema
  );
}

/**
 * Validates the witness against the exact current required-store registry.
 * Freshness comes only from registry/store generation and digest equality;
 * wall-clock timestamps never make an observation current.
 */
export function planReferenceSourceInventoryClosure(input: {
  currentRegistry: unknown;
  witness: unknown;
}): ReferenceSourceInventoryClosurePlan {
  const registry = decodeIfValid(ReferenceSourceRequiredStoreRegistrySchema, input.currentRegistry);
  if (!registry) {
    return blockedPlan([{ code: "invalid_required_store_registry" }]);
  }
  if (!verifyBoundDigest(registry)) {
    return blockedPlan([{ code: "invalid_required_store_registry_digest" }]);
  }
  const registryRef = recordRef(registry);

  const witness = decodeIfValid(ReferenceSourceInventoryClosureWitnessSchema, input.witness);
  if (!witness) {
    return blockedPlan([{ code: "invalid_inventory_witness" }], registryRef);
  }
  if (!verifyBoundDigest(witness)) {
    return blockedPlan([{ code: "invalid_inventory_witness_digest" }], registryRef);
  }
  const witnessRef = recordRef(witness);
  const issues: ReferenceSourceInventoryClosureIssue[] = [];

  const requiredById = new Map<string, ReferenceSourceRequiredStore>();
  for (const store of registry.stores) {
    if (requiredById.has(store.storeId)) {
      addIssue(issues, "duplicate_required_store", store.storeId);
    } else {
      requiredById.set(store.storeId, store);
    }
  }

  if (
    witness.requiredStoreRegistryRef.id !== registry.id ||
    witness.requiredStoreRegistryRef.digest !== registry.digest ||
    witness.requiredStoreRegistryGeneration !== registry.registryGeneration
  ) {
    addIssue(issues, "stale_required_store_registry");
  }

  const enumerationCounts = new Map<string, number>();
  for (const enumeration of witness.storeEnumerations) {
    enumerationCounts.set(
      enumeration.storeId,
      (enumerationCounts.get(enumeration.storeId) ?? 0) + 1
    );
  }
  for (const [storeId, count] of enumerationCounts) {
    if (count > 1) addIssue(issues, "duplicate_store_enumeration", storeId);
  }

  const allEnumerationsComplete = witness.storeEnumerations.every(
    ({ status }) => status === "complete"
  );
  if (
    (witness.status === "complete" && !allEnumerationsComplete) ||
    (witness.status === "failed" && allEnumerationsComplete)
  ) {
    addIssue(issues, "inconsistent_witness_status");
  }

  for (const required of registry.stores) {
    if (!enumerationCounts.has(required.storeId)) {
      addIssue(issues, "missing_store_enumeration", required.storeId);
    }
  }

  for (const enumeration of witness.storeEnumerations) {
    const required = requiredById.get(enumeration.storeId);
    if (!required) {
      addIssue(issues, "unregistered_store_enumeration", enumeration.storeId);
      continue;
    }
    if (!verifyBoundDigest(enumeration)) {
      addIssue(issues, "invalid_store_enumeration_digest", enumeration.storeId);
    }
    if (enumeration.status === "failed") {
      addIssue(issues, "failed_store_enumeration", enumeration.storeId);
    }
    if (
      enumeration.storeGeneration !== required.storeGeneration ||
      enumeration.storeStateDigest !== required.storeStateDigest
    ) {
      addIssue(issues, "stale_store_enumeration", enumeration.storeId);
    }
    const artifactKeys = new Set<string>();
    for (const artifactRef of enumeration.artifactRefs) {
      const key = `${artifactRef.id}:${artifactRef.digest}`;
      if (artifactKeys.has(key)) {
        addIssue(issues, "duplicate_artifact_ref", enumeration.storeId);
      }
      artifactKeys.add(key);
    }
  }

  if (issues.length > 0 || witness.status !== "complete") {
    if (issues.length === 0) addIssue(issues, "inconsistent_witness_status");
    return blockedPlan(issues, registryRef, witnessRef);
  }

  const stores = registry.stores
    .map((required) => {
      const enumeration = witness.storeEnumerations.find(
        ({ storeId }) => storeId === required.storeId
      )!;
      return {
        storeId: required.storeId,
        storeKind: required.storeKind,
        storeGeneration: required.storeGeneration,
        storeStateDigest: required.storeStateDigest,
        enumerationDigest: enumeration.digest,
        artifactRefs: enumeration.artifactRefs,
      };
    })
    .sort((left, right) => left.storeId.localeCompare(right.storeId));
  const artifactCount = stores.reduce((count, store) => count + store.artifactRefs.length, 0);
  return finalizePlan({
    schemaVersion: 1,
    mode: "inventory_closure_validation",
    status: "ready",
    requiredStoreRegistryRef: registryRef,
    witnessRef,
    requiredStoreCount: stores.length,
    artifactCount,
    stores,
  });
}

function blockedPlan(
  issues: ReferenceSourceInventoryClosureIssue[],
  requiredStoreRegistryRef?: Static<typeof ReferenceRecordRefSchema>,
  witnessRef?: Static<typeof ReferenceRecordRefSchema>
): ReferenceSourceInventoryClosurePlan {
  return finalizePlan({
    schemaVersion: 1,
    mode: "inventory_closure_validation",
    status: "blocked",
    ...(requiredStoreRegistryRef ? { requiredStoreRegistryRef } : {}),
    ...(witnessRef ? { witnessRef } : {}),
    issues: uniqueIssues(issues),
  });
}

function finalizePlan(core: Record<string, unknown>): ReferenceSourceInventoryClosurePlan {
  return bindIdentified(
    "reference-inventory-plan",
    core,
    ReferenceSourceInventoryClosurePlanSchema
  );
}

function addIssue(
  issues: ReferenceSourceInventoryClosureIssue[],
  code: ReferenceSourceInventoryClosureIssueCode,
  storeId?: string
): void {
  issues.push({ code, ...(storeId ? { storeId } : {}) });
}

function uniqueIssues(
  issues: ReferenceSourceInventoryClosureIssue[]
): ReferenceSourceInventoryClosureIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.storeId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function bindIdentified<TSchemaValue extends TSchema>(
  prefix: string,
  core: Record<string, unknown>,
  schema: TSchemaValue
): Static<TSchemaValue> {
  const cloned = structuredClone(core);
  const seed = referenceSourceDigest(cloned);
  const withId = { ...cloned, id: `${prefix}.${seed.slice(0, 24)}` };
  const value = { ...withId, digest: referenceSourceDigest(withId) };
  return decodeAndFreeze(schema, value);
}

function verifyBoundDigest(value: { digest: string } & Record<string, unknown>): boolean {
  const { digest, ...core } = value;
  return digest === referenceSourceDigest(core);
}

function recordRef(value: { id: string; digest: string }): Static<typeof ReferenceRecordRefSchema> {
  return { id: value.id, digest: value.digest };
}

function decodeIfValid<TSchemaValue extends TSchema>(
  schema: TSchemaValue,
  value: unknown
): Static<TSchemaValue> | null {
  return Value.Check(schema, value) ? (structuredClone(value) as Static<TSchemaValue>) : null;
}

function decodeAndFreeze<TSchemaValue extends TSchema>(
  schema: TSchemaValue,
  value: unknown
): Static<TSchemaValue> {
  return deepFreeze(Value.Decode(schema, value));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
