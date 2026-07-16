import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import bundledInventoryJson from "./data/authority-path-inventory.v1.json" with { type: "json" };

const Strict = { additionalProperties: false } as const;
const NonEmptyStringSchema = Type.String({ minLength: 1 });
const Sha256Schema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const AuthorityPathRuntimeContextSchema = Type.Union([
  Type.Literal("evaluation"),
  Type.Literal("inspection"),
  Type.Literal("production"),
]);
export type AuthorityPathRuntimeContext = Static<typeof AuthorityPathRuntimeContextSchema>;

export const AuthorityPathCategorySchema = Type.Union([
  Type.Literal("builtin_lookup_table"),
  Type.Literal("cache"),
  Type.Literal("compiler_branch"),
  Type.Literal("governance_metadata"),
  Type.Literal("legacy_pack"),
  Type.Literal("parameter"),
  Type.Literal("presentation_label"),
  Type.Literal("profile_constant"),
  Type.Literal("prompt_example"),
  Type.Literal("prompt_instruction"),
  Type.Literal("ranker"),
  Type.Literal("tool_description_default"),
  Type.Literal("validator"),
]);
export type AuthorityPathCategory = Static<typeof AuthorityPathCategorySchema>;

export const AuthorityPathClassificationSchema = Type.Union([
  Type.Literal("editorial_convention"),
  Type.Literal("evaluator_only_logic"),
  Type.Literal("forbidden_unregistered_bypass"),
  Type.Literal("maintainer_reviewed_software_heuristic"),
  Type.Literal("mechanical_fact"),
  Type.Literal("owner_local_preference"),
  Type.Literal("reviewed_knowledge_consequence"),
]);
export type AuthorityPathClassification = Static<typeof AuthorityPathClassificationSchema>;

export const AuthorityLaneSchema = Type.Union([
  Type.Literal("editorial_convention"),
  Type.Literal("historical_practice"),
  Type.Literal("modern_pedagogy"),
  Type.Literal("owner_local_reviewed_guidance"),
  Type.Literal("software_heuristic"),
]);
export type AuthorityLane = Static<typeof AuthorityLaneSchema>;

export const AuthorityPathCompatibilityModeSchema = Type.Union([
  Type.Literal("evaluation_only_exact_identity"),
  Type.Literal("exact_current_reader"),
  Type.Literal("legacy_reader_shadow_required"),
  Type.Literal("quarantined_inspection_only"),
  Type.Literal("quarantined_no_read"),
  Type.Literal("read_only_no_activation"),
]);
export type AuthorityPathCompatibilityMode = Static<typeof AuthorityPathCompatibilityModeSchema>;

export const AuthorityPathQuarantineStateSchema = Type.Union([
  Type.Literal("not_quarantined"),
  Type.Literal("quarantined"),
  Type.Literal("read_only_compatibility"),
]);
export type AuthorityPathQuarantineState = Static<typeof AuthorityPathQuarantineStateSchema>;

export const AuthorityPathFutureBindingStatusSchema = Type.Union([
  Type.Literal("not_applicable"),
  Type.Literal("planned"),
  Type.Literal("unknown"),
]);
export type AuthorityPathFutureBindingStatus = Static<
  typeof AuthorityPathFutureBindingStatusSchema
>;

export const AuthorityPathLocatorSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("cache"),
      Type.Literal("file_region"),
      Type.Literal("json_pointer"),
      Type.Literal("symbol"),
      Type.Literal("yaml_pointer"),
    ]),
    path: NonEmptyStringSchema,
    selector: NonEmptyStringSchema,
  },
  Strict
);
export type AuthorityPathLocator = Static<typeof AuthorityPathLocatorSchema>;

const AuthorityPathWriteSchema = Type.Object(
  {
    locator: AuthorityPathLocatorSchema,
    outputFields: Type.Array(NonEmptyStringSchema, { minItems: 1 }),
  },
  Strict
);

const AuthorityPathDeniedMutationSchema = Type.Object(
  {
    locator: AuthorityPathLocatorSchema,
    disposition: Type.Literal("always_rejected"),
    reasonCode: NonEmptyStringSchema,
  },
  Strict
);

const AuthorityPathRuntimeGuardModeSchema = Type.Union([
  Type.Literal("constructor_prologue"),
  Type.Literal("function_prologue"),
  Type.Literal("module_constant_prologue"),
  Type.Literal("root_guard"),
]);

const AuthorityPathRuntimeGuardBindingSchema = Type.Object(
  {
    access: Type.Union([Type.Literal("read"), Type.Literal("write")]),
    locator: AuthorityPathLocatorSchema,
    guardScope: Type.Object(
      {
        mode: AuthorityPathRuntimeGuardModeSchema,
        path: NonEmptyStringSchema,
        selector: NonEmptyStringSchema,
      },
      Strict
    ),
  },
  Strict
);

const AuthorityPathEffectSchema = Type.Object(
  {
    changesMusicalBehavior: Type.Boolean(),
    changesAuthorityClaim: Type.Boolean(),
  },
  Strict
);

const MechanicalEvidenceRefSchema = Type.Object(
  {
    resolverPathId: NonEmptyStringSchema,
    resolverSelectors: Type.Array(NonEmptyStringSchema, { minItems: 1 }),
  },
  Strict
);

const AuthorityPathCompatibilitySchema = Type.Object(
  {
    mode: AuthorityPathCompatibilityModeSchema,
    readerId: Type.Union([NonEmptyStringSchema, Type.Null()]),
  },
  Strict
);

const AuthorityPathQuarantineSchema = Type.Object(
  {
    state: AuthorityPathQuarantineStateSchema,
    reasonCodes: Type.Array(NonEmptyStringSchema),
  },
  Strict
);

const AuthorityPathFutureBindingSchema = Type.Object(
  {
    status: AuthorityPathFutureBindingStatusSchema,
    componentId: Type.Union([NonEmptyStringSchema, Type.Null()]),
    componentKind: Type.Union([NonEmptyStringSchema, Type.Null()]),
  },
  Strict
);

export const AuthorityPathDefinitionSourceSchema = Type.Object(
  {
    path: NonEmptyStringSchema,
    digest: Sha256Schema,
  },
  Strict
);
export type AuthorityPathDefinitionSource = Static<typeof AuthorityPathDefinitionSourceSchema>;

export const AuthorityPathEntrySchema = Type.Object(
  {
    id: NonEmptyStringSchema,
    category: AuthorityPathCategorySchema,
    owner: NonEmptyStringSchema,
    definitionSources: Type.Array(AuthorityPathDefinitionSourceSchema, { minItems: 1 }),
    reads: Type.Array(AuthorityPathLocatorSchema),
    writes: Type.Array(AuthorityPathWriteSchema),
    deniedMutations: Type.Array(AuthorityPathDeniedMutationSchema),
    effect: AuthorityPathEffectSchema,
    mechanicality: Type.Union([Type.Literal("mechanical"), Type.Literal("nonmechanical")]),
    classification: AuthorityPathClassificationSchema,
    authorityLane: Type.Union([AuthorityLaneSchema, Type.Null()]),
    mechanicalEvidenceRef: Type.Union([MechanicalEvidenceRefSchema, Type.Null()]),
    subjectDomains: Type.Array(NonEmptyStringSchema, { minItems: 1 }),
    compatibility: AuthorityPathCompatibilitySchema,
    quarantine: AuthorityPathQuarantineSchema,
    futureBinding: AuthorityPathFutureBindingSchema,
    runtimeAccess: Type.Array(AuthorityPathRuntimeContextSchema, { minItems: 1 }),
    runtimeGuardBindings: Type.Array(AuthorityPathRuntimeGuardBindingSchema),
    claimLimitations: Type.Array(NonEmptyStringSchema, { minItems: 1 }),
    digest: Sha256Schema,
  },
  Strict
);
export type AuthorityPathEntry = Static<typeof AuthorityPathEntrySchema>;

export const AuthorityPathCoverageSchema = Type.Object(
  {
    sourcePath: NonEmptyStringSchema,
    sourceDigest: Sha256Schema,
    surfaceScope: Type.Union([Type.Literal("evaluation"), Type.Literal("production")]),
    disposition: Type.Union([Type.Literal("authority_path"), Type.Literal("no_authority_effect")]),
    authorityPathIds: Type.Array(NonEmptyStringSchema),
    reviewRationale: NonEmptyStringSchema,
    reviewOwner: NonEmptyStringSchema,
  },
  Strict
);
export type AuthorityPathCoverage = Static<typeof AuthorityPathCoverageSchema>;

export const AuthorityPathDeclarationCoverageSchema = Type.Object(
  {
    sourcePath: NonEmptyStringSchema,
    selector: NonEmptyStringSchema,
    disposition: Type.Union([Type.Literal("authority_path"), Type.Literal("no_authority_effect")]),
    authorityPathIds: Type.Array(NonEmptyStringSchema),
  },
  Strict
);
export type AuthorityPathDeclarationCoverage = Static<
  typeof AuthorityPathDeclarationCoverageSchema
>;

const AuthorityPathLegacyReaderLocatorSchema = Type.Object(
  {
    authorityPathId: NonEmptyStringSchema,
    locator: AuthorityPathLocatorSchema,
  },
  Strict
);

export const AuthorityPathShadowFixtureSchema = Type.Object(
  {
    id: NonEmptyStringSchema,
    fixtureRef: NonEmptyStringSchema,
    pathIds: Type.Array(NonEmptyStringSchema, { minItems: 1 }),
    legacyReaderLocators: Type.Array(AuthorityPathLegacyReaderLocatorSchema, { minItems: 1 }),
    futureReaderBinding: NonEmptyStringSchema,
    fixtureDigest: Sha256Schema,
    inputDigest: Sha256Schema,
    expectedLegacyOutputDigest: Sha256Schema,
    comparison: Type.Literal("canonical_json_exact"),
    futureReaderState: Type.Literal("not_implemented"),
    productionEffect: Type.Literal("none"),
    digest: Sha256Schema,
  },
  Strict
);
export type AuthorityPathShadowFixture = Static<typeof AuthorityPathShadowFixtureSchema>;

const VersionedFileRefSchema = Type.Object(
  {
    id: NonEmptyStringSchema,
    version: Type.Integer({ minimum: 1 }),
    path: NonEmptyStringSchema,
    digest: Sha256Schema,
  },
  Strict
);

export const AuthorityPathManifestCompletenessSchema = Type.Object(
  {
    status: Type.Literal("not_evaluated"),
    componentRegistrySnapshot: Type.Literal("not_available"),
    appliedKnowledgeManifest: Type.Literal("not_available"),
    reasonCodes: Type.Array(NonEmptyStringSchema, { minItems: 1 }),
  },
  Strict
);
export type AuthorityPathManifestCompleteness = Static<
  typeof AuthorityPathManifestCompletenessSchema
>;

export const AuthorityPathInventorySchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    inventoryId: Type.Literal("authority-path-inventory.v1"),
    snapshotRevision: Type.Integer({ minimum: 1 }),
    state: Type.Object(
      {
        purpose: Type.Literal("inventory_and_shadow_specification_only"),
        resolver: Type.Literal("disabled"),
        productionActivation: Type.Literal("unchanged"),
        completenessClaim: Type.Literal("frozen_repository_snapshot_not_future_manifest"),
      },
      Strict
    ),
    builderRef: VersionedFileRefSchema,
    classificationPolicyRef: VersionedFileRefSchema,
    definitionRef: VersionedFileRefSchema,
    writerContractRef: VersionedFileRefSchema,
    manifestCompleteness: AuthorityPathManifestCompletenessSchema,
    coverage: Type.Array(AuthorityPathCoverageSchema, { minItems: 1 }),
    declarationCoverage: Type.Array(AuthorityPathDeclarationCoverageSchema, { minItems: 1 }),
    entries: Type.Array(AuthorityPathEntrySchema, { minItems: 1 }),
    shadowFixtures: Type.Array(AuthorityPathShadowFixtureSchema, { minItems: 1 }),
    digest: Sha256Schema,
  },
  Strict
);
export type AuthorityPathInventory = Static<typeof AuthorityPathInventorySchema>;

const InventoryRefSchema = Type.Object(
  {
    id: Type.Literal("authority-path-inventory.v1"),
    snapshotRevision: Type.Integer({ minimum: 1 }),
    digest: Sha256Schema,
  },
  Strict
);

export const AuthorityPathObservationSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    inventoryRef: InventoryRefSchema,
    pathId: NonEmptyStringSchema,
    pathDigest: Sha256Schema,
    context: AuthorityPathRuntimeContextSchema,
    classification: AuthorityPathClassificationSchema,
    mechanicality: Type.Union([Type.Literal("mechanical"), Type.Literal("nonmechanical")]),
    quarantineState: AuthorityPathQuarantineStateSchema,
    compatibilityMode: AuthorityPathCompatibilityModeSchema,
    guardDecision: Type.Literal("observation_only"),
    authorityGranted: Type.Literal(false),
    resolver: Type.Literal("disabled"),
    manifestCompleteness: Type.Literal("not_evaluated"),
    productionActivation: Type.Literal("unchanged"),
    digest: Sha256Schema,
  },
  Strict
);
export type AuthorityPathObservation = Static<typeof AuthorityPathObservationSchema>;

export const AuthorityPathInspectionSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    inventoryRef: InventoryRefSchema,
    entry: AuthorityPathEntrySchema,
    coverage: Type.Array(AuthorityPathCoverageSchema),
    declarationCoverage: Type.Array(AuthorityPathDeclarationCoverageSchema),
    shadowFixtureIds: Type.Array(NonEmptyStringSchema),
    authorityGranted: Type.Literal(false),
    access: Type.Literal("inspection"),
    resolver: Type.Literal("disabled"),
    manifestCompleteness: Type.Literal("not_evaluated"),
    productionActivation: Type.Literal("unchanged"),
  },
  Strict
);
export type AuthorityPathInspection = Static<typeof AuthorityPathInspectionSchema>;

export const AuthorityPathShadowComparisonResultSchema = Type.Union([
  Type.Literal("exact_match"),
  Type.Literal("different"),
  Type.Literal("unknown"),
  Type.Literal("error"),
]);
export type AuthorityPathShadowComparisonResult = Static<
  typeof AuthorityPathShadowComparisonResultSchema
>;

export const AuthorityPathShadowComparisonSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    inventoryRef: InventoryRefSchema,
    fixtureId: NonEmptyStringSchema,
    fixtureDigest: Sha256Schema,
    pathIds: Type.Array(NonEmptyStringSchema, { minItems: 1 }),
    expectedLegacyOutputDigest: Sha256Schema,
    suppliedLegacyOutputDigest: Sha256Schema,
    candidateOutputDigest: Type.Union([Sha256Schema, Type.Null()]),
    result: AuthorityPathShadowComparisonResultSchema,
    reasonCodes: Type.Array(NonEmptyStringSchema),
    productionEffect: Type.Literal("none"),
    candidateDisposition: Type.Literal("shadow_only"),
    activationDecision: Type.Literal("not_evaluated"),
    manifestCompleteness: Type.Literal("not_evaluated"),
    productionActivation: Type.Literal("unchanged"),
    digest: Sha256Schema,
  },
  Strict
);
export type AuthorityPathShadowComparison = Static<typeof AuthorityPathShadowComparisonSchema>;

export interface CompareAuthorityPathShadowInput {
  fixtureId: string;
  legacyOutput: unknown;
  candidateOutput?: unknown;
  candidateError?: unknown;
}

export const AuthorityPathFileVerificationSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    inventoryRef: InventoryRefSchema,
    status: Type.Literal("verified"),
    builderDigest: Sha256Schema,
    classificationPolicyDigest: Sha256Schema,
    definitionDigest: Sha256Schema,
    writerContractDigest: Sha256Schema,
    coverageFileCount: Type.Integer({ minimum: 1 }),
    shadowFixtureCount: Type.Integer({ minimum: 1 }),
    verifiedBindingCount: Type.Integer({ minimum: 1 }),
    uniqueFileCount: Type.Integer({ minimum: 1 }),
    manifestCompleteness: Type.Literal("not_evaluated"),
    productionActivation: Type.Literal("unchanged"),
    digest: Sha256Schema,
  },
  Strict
);
export type AuthorityPathFileVerification = Static<typeof AuthorityPathFileVerificationSchema>;

const T14AuthorityPathHandoffEntrySchema = Type.Object(
  {
    inventoryPathId: NonEmptyStringSchema,
    pathDigest: Sha256Schema,
    mechanicality: Type.Union([Type.Literal("mechanical"), Type.Literal("nonmechanical")]),
    classification: AuthorityPathClassificationSchema,
    authorityLane: Type.Union([AuthorityLaneSchema, Type.Null()]),
    futureBindingStatus: AuthorityPathFutureBindingStatusSchema,
    futureComponentId: Type.Union([NonEmptyStringSchema, Type.Null()]),
    componentRef: Type.Null(),
    manifestOutcomeRef: Type.Null(),
    disposition: Type.Literal("unknown"),
    reasonCodes: Type.Array(NonEmptyStringSchema, { minItems: 1 }),
  },
  Strict
);

const T14AuthorityPathHandoffShadowSchema = Type.Object(
  {
    fixtureId: NonEmptyStringSchema,
    fixtureDigest: Sha256Schema,
    pathIds: Type.Array(NonEmptyStringSchema, { minItems: 1 }),
    comparisonStatus: Type.Literal("not_evaluated"),
  },
  Strict
);

export const T14AuthorityPathHandoffSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    handoffId: Type.Literal("authority-path-inventory.t14-handoff.v1"),
    inventoryRef: InventoryRefSchema,
    manifestCompleteness: AuthorityPathManifestCompletenessSchema,
    entries: Type.Array(T14AuthorityPathHandoffEntrySchema, { minItems: 1 }),
    shadowFixtures: Type.Array(T14AuthorityPathHandoffShadowSchema, { minItems: 1 }),
    productionActivation: Type.Literal("unchanged"),
    digest: Sha256Schema,
  },
  Strict
);
export type T14AuthorityPathHandoff = Static<typeof T14AuthorityPathHandoffSchema>;

type AuthorityPathInventoryErrorCode =
  | "callback_forbidden"
  | "canonical_json_invalid"
  | "digest_mismatch"
  | "filesystem_binding_invalid"
  | "inventory_semantics_invalid"
  | "inventory_schema_invalid"
  | "legacy_observation_mismatch"
  | "runtime_context_forbidden"
  | "shadow_fixture_missing"
  | "unknown_authority_path";

export class AuthorityPathInventoryError extends Error {
  constructor(
    readonly code: AuthorityPathInventoryErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AuthorityPathInventoryError";
  }
}

const REQUIRED_SURFACE_CATEGORIES: readonly AuthorityPathCategory[] = [
  "builtin_lookup_table",
  "cache",
  "compiler_branch",
  "legacy_pack",
  "parameter",
  "presentation_label",
  "profile_constant",
  "prompt_example",
  "prompt_instruction",
  "ranker",
  "tool_description_default",
  "validator",
];

const EXPECTED_COMPLETENESS_REASON_CODES = [
  "classification_only",
  "resolver_disabled",
  "t14_reconciliation_pending",
] as const;

const EXPECTED_WRITER_CONTRACT_DIGEST =
  "e4370aec374896db2d5cab72e2451af967e8114b24b721a4159886b68d657527";

const DOMAIN_PREFIX = "vellum.authority-path-inventory.v1\0";

function fail(code: AuthorityPathInventoryErrorCode, message: string): never {
  throw new AuthorityPathInventoryError(code, message);
}

function decode<T>(schema: Parameters<typeof Value.Decode>[0], value: unknown, label: string): T {
  try {
    return Value.Decode(schema, structuredClone(value)) as T;
  } catch (error) {
    fail(
      "inventory_schema_invalid",
      `${label} does not match its closed schema: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function canonicalJson(value: unknown, active = new Set<object>()): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("canonical_json_invalid", "Canonical authority observations require finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    fail(
      "canonical_json_invalid",
      `Canonical authority observations cannot contain ${typeof value} values`
    );
  }
  if (active.has(value)) {
    fail("canonical_json_invalid", "Canonical authority observations cannot contain cycles");
  }
  active.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalJson(item, active)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("canonical_json_invalid", "Canonical authority observations require plain objects");
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], active)}`)
      .join(",")}}`;
  } finally {
    active.delete(value);
  }
}

function authorityDigest(domain: string, value: unknown): string {
  return createHash("sha256")
    .update(DOMAIN_PREFIX)
    .update(domain)
    .update("\0")
    .update(canonicalJson(value))
    .digest("hex");
}

function rawSha256(value: string | NodeJS.ArrayBufferView): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Canonical digest used by the frozen shadow fixtures for reader observations. */
export function authorityPathObservationDigest(value: unknown): string {
  return authorityDigest("shadow-observation", value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function requireSortedUnique(values: readonly string[], label: string): void {
  const expected = [...new Set(values)].sort();
  if (expected.length !== values.length || expected.some((item, index) => item !== values[index])) {
    fail("inventory_semantics_invalid", `${label} must be sorted and contain no duplicates`);
  }
}

function requireUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    fail("inventory_semantics_invalid", `${label} must contain no duplicates`);
  }
}

function assertExactStringArray(
  actual: readonly string[],
  expected: readonly string[],
  label: string
): void {
  if (actual.length !== expected.length || expected.some((item, index) => actual[index] !== item)) {
    fail("inventory_semantics_invalid", `${label} does not match the frozen T08 contract`);
  }
}

function validateEntrySemantics(entry: AuthorityPathEntry): void {
  for (const binding of entry.runtimeGuardBindings) {
    if (
      binding.guardScope.path !== binding.locator.path ||
      binding.guardScope.selector !== binding.locator.selector
    ) {
      fail(
        "inventory_semantics_invalid",
        `${entry.id} guard scope must be the exact locator declaration`
      );
    }
  }
  requireSortedUnique(
    entry.definitionSources.map((source) => source.path),
    `${entry.id}.definitionSources`
  );
  requireSortedUnique(entry.reads.map(locatorIdentity), `${entry.id}.reads`);
  requireSortedUnique(
    entry.writes.map((write) => locatorIdentity(write.locator)),
    `${entry.id}.writes`
  );
  requireSortedUnique(
    entry.deniedMutations.map((item) => locatorIdentity(item.locator)),
    `${entry.id}.deniedMutations`
  );
  requireSortedUnique(
    entry.runtimeGuardBindings.map(
      (binding) => `${binding.access}\0${locatorIdentity(binding.locator)}`
    ),
    `${entry.id}.runtimeGuardBindings`
  );
  requireSortedUnique(entry.subjectDomains, `${entry.id}.subjectDomains`);
  requireSortedUnique(entry.runtimeAccess, `${entry.id}.runtimeAccess`);
  requireSortedUnique(entry.claimLimitations, `${entry.id}.claimLimitations`);
  requireUnique(entry.quarantine.reasonCodes, `${entry.id}.quarantine.reasonCodes`);

  for (const write of entry.writes) {
    requireSortedUnique(write.outputFields, `${entry.id}.writes.outputFields`);
    if (write.outputFields.includes("legacy_record")) {
      fail(
        "inventory_semantics_invalid",
        `${entry.id} write output cannot use a fabricated legacy_record`
      );
    }
  }

  const expectedRuntimeBindings = [
    ...entry.reads.map((locator) => `read\0${locatorIdentity(locator)}`),
    ...entry.writes.map((write) => `write\0${locatorIdentity(write.locator)}`),
  ].sort();
  const actualRuntimeBindings = entry.runtimeGuardBindings
    .map((binding) => `${binding.access}\0${locatorIdentity(binding.locator)}`)
    .sort();
  if (entry.runtimeAccess.includes("production")) {
    if (
      expectedRuntimeBindings.length !== actualRuntimeBindings.length ||
      expectedRuntimeBindings.some((value, index) => value !== actualRuntimeBindings[index])
    ) {
      fail(
        "inventory_semantics_invalid",
        `${entry.id} production runtime guard bindings do not exactly cover reads and writes`
      );
    }
  } else if (actualRuntimeBindings.length > 0) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} non-production path cannot claim production runtime guard bindings`
    );
  }
  if (
    entry.deniedMutations.length > 0 &&
    (entry.runtimeAccess.includes("production") || entry.quarantine.state === "not_quarantined")
  ) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} denied mutations must remain in a non-production quarantine`
    );
  }

  if (!entry.effect.changesMusicalBehavior && !entry.effect.changesAuthorityClaim) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} is inventoried but declares no musical or authority effect`
    );
  }

  const readerId = entry.reads.map((locator) => locator.selector).join("|");
  if (entry.reads.length === 0 || entry.compatibility.readerId !== readerId) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} compatibility reader must equal its exact sorted read selectors`
    );
  }

  if (entry.classification === "mechanical_fact") {
    if (
      entry.mechanicality !== "mechanical" ||
      entry.authorityLane !== null ||
      entry.mechanicalEvidenceRef === null ||
      entry.compatibility.mode !== "exact_current_reader"
    ) {
      fail(
        "inventory_semantics_invalid",
        `${entry.id} mechanical facts require neutral, exact-reader mechanical evidence`
      );
    }
    if (!["profile_constant", "validator"].includes(entry.category)) {
      fail(
        "inventory_semantics_invalid",
        `${entry.id} mechanical fact must be a profile constant or validator`
      );
    }
    if (!entry.subjectDomains.includes("mechanics")) {
      fail(
        "inventory_semantics_invalid",
        `${entry.id} mechanical fact must bind the mechanics subject domain`
      );
    }
    requireSortedUnique(
      entry.mechanicalEvidenceRef.resolverSelectors,
      `${entry.id}.mechanicalEvidenceRef.resolverSelectors`
    );
  } else if (entry.mechanicality !== "nonmechanical" || entry.mechanicalEvidenceRef !== null) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} only mechanical_fact may be mechanical or carry mechanical evidence`
    );
  }

  if (
    entry.classification === "evaluator_only_logic" &&
    (entry.runtimeAccess.includes("production") ||
      entry.compatibility.mode !== "evaluation_only_exact_identity" ||
      entry.authorityLane !== null)
  ) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} evaluator-only logic cannot be production reachable or carry an authority lane`
    );
  }

  if (
    entry.classification === "forbidden_unregistered_bypass" &&
    (entry.quarantine.state !== "quarantined" ||
      entry.runtimeAccess.includes("production") ||
      !["quarantined_inspection_only", "quarantined_no_read"].includes(entry.compatibility.mode))
  ) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} forbidden bypass must remain quarantined and unavailable to production`
    );
  }

  if (
    entry.classification === "owner_local_preference" &&
    entry.authorityLane !== "owner_local_reviewed_guidance"
  ) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} Owner preference must use only the Owner-local authority lane`
    );
  }

  if (
    entry.classification === "editorial_convention" &&
    entry.authorityLane !== "editorial_convention"
  ) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} editorial convention must remain in the editorial authority lane`
    );
  }

  if (
    entry.classification === "maintainer_reviewed_software_heuristic" &&
    entry.authorityLane !== "software_heuristic"
  ) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} maintainer-reviewed heuristic must remain in the software authority lane`
    );
  }

  if (entry.quarantine.state === "not_quarantined") {
    if (entry.quarantine.reasonCodes.length !== 0) {
      fail(
        "inventory_semantics_invalid",
        `${entry.id} unquarantined path cannot carry quarantine reasons`
      );
    }
  } else {
    if (
      entry.quarantine.reasonCodes.length === 0 ||
      !entry.quarantine.reasonCodes.includes("activation_forbidden") ||
      entry.runtimeAccess.includes("production")
    ) {
      fail(
        "inventory_semantics_invalid",
        `${entry.id} quarantined/read-only path must explain and forbid activation`
      );
    }
  }

  if (
    entry.quarantine.state === "read_only_compatibility" &&
    entry.compatibility.mode !== "read_only_no_activation"
  ) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} read-only quarantine requires read_only_no_activation compatibility`
    );
  }

  if (
    entry.mechanicality === "nonmechanical" &&
    entry.runtimeAccess.includes("production") &&
    (!["exact_current_reader", "legacy_reader_shadow_required"].includes(
      entry.compatibility.mode
    ) ||
      entry.futureBinding.status !== "planned")
  ) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} production nonmechanical compatibility requires an exact reader and planned binding`
    );
  }

  if (entry.futureBinding.status === "planned") {
    if (
      entry.futureBinding.componentId === null ||
      entry.futureBinding.componentKind === null ||
      entry.futureBinding.componentKind !== entry.futureBinding.componentId.split(".", 1)[0]
    ) {
      fail(
        "inventory_semantics_invalid",
        `${entry.id} planned future binding requires a matching component id and kind`
      );
    }
  } else if (
    entry.futureBinding.componentId !== null ||
    entry.futureBinding.componentKind !== null
  ) {
    fail(
      "inventory_semantics_invalid",
      `${entry.id} unplanned future binding cannot claim a component identity`
    );
  }
}

function locatorIdentity(locator: AuthorityPathLocator): string {
  return `${locator.kind}\0${locator.path}\0${locator.selector}`;
}

function validateInventorySemantics(inventory: AuthorityPathInventory): void {
  if (
    inventory.builderRef.id !== "build-authority-path-inventory.v1" ||
    inventory.builderRef.version !== 1 ||
    inventory.builderRef.path !== "scripts/build-authority-path-inventory.mjs"
  ) {
    fail("inventory_semantics_invalid", "Inventory builder identity is not the T08 builder");
  }
  if (
    inventory.classificationPolicyRef.id !== "authority-path-classification-policy.v1" ||
    inventory.classificationPolicyRef.version !== 1 ||
    inventory.classificationPolicyRef.path !==
      "src/lib/data/authority-path-classification-policy.v1.json"
  ) {
    fail("inventory_semantics_invalid", "Inventory classification-policy identity is invalid");
  }
  if (
    inventory.definitionRef.id !== "authority-path-inventory.v1.seed" ||
    inventory.definitionRef.version !== 1 ||
    inventory.definitionRef.path !== "src/lib/data/authority-path-inventory-seed.v1.json"
  ) {
    fail("inventory_semantics_invalid", "Inventory definition identity is invalid");
  }
  if (
    inventory.writerContractRef.id !== "authority-writer-contract.v1" ||
    inventory.writerContractRef.version !== 1 ||
    inventory.writerContractRef.path !== "src/lib/data/authority-writer-contract.v1.json" ||
    inventory.writerContractRef.digest !== EXPECTED_WRITER_CONTRACT_DIGEST
  ) {
    fail("inventory_semantics_invalid", "Inventory writer-contract identity is invalid");
  }
  assertExactStringArray(
    inventory.manifestCompleteness.reasonCodes,
    EXPECTED_COMPLETENESS_REASON_CODES,
    "manifestCompleteness.reasonCodes"
  );

  requireSortedUnique(
    inventory.entries.map((entry) => entry.id),
    "inventory.entries"
  );
  requireSortedUnique(
    inventory.coverage.map((item) => item.sourcePath),
    "inventory.coverage"
  );
  requireSortedUnique(
    inventory.declarationCoverage.map((item) => `${item.sourcePath}\0${item.selector}`),
    "inventory.declarationCoverage"
  );
  requireSortedUnique(
    inventory.shadowFixtures.map((fixture) => fixture.id),
    "inventory.shadowFixtures"
  );

  const entries = new Map(inventory.entries.map((entry) => [entry.id, entry]));
  const coverage = new Map(inventory.coverage.map((item) => [item.sourcePath, item]));
  const observedCategories = new Set<AuthorityPathCategory>();

  for (const entry of inventory.entries) {
    validateEntrySemantics(entry);
    observedCategories.add(entry.category);
    for (const locator of [
      ...entry.reads,
      ...entry.writes.map((write) => write.locator),
      ...entry.deniedMutations.map((item) => item.locator),
      ...entry.runtimeGuardBindings.map((binding) => ({
        kind: "symbol" as const,
        path: binding.guardScope.path,
        selector: binding.guardScope.selector,
      })),
    ]) {
      if (!coverage.has(locator.path)) {
        fail(
          "inventory_semantics_invalid",
          `${entry.id} locator references uncovered source ${locator.path}`
        );
      }
    }
    for (const definitionSource of entry.definitionSources) {
      const coverageItem = coverage.get(definitionSource.path);
      if (
        !coverageItem ||
        coverageItem.disposition !== "authority_path" ||
        !coverageItem.authorityPathIds.includes(entry.id) ||
        coverageItem.sourceDigest !== definitionSource.digest
      ) {
        fail(
          "inventory_semantics_invalid",
          `${entry.id} definition source ${definitionSource.path} lacks reciprocal digest-bound authority coverage`
        );
      }
    }
  }

  for (const category of REQUIRED_SURFACE_CATEGORIES) {
    if (!observedCategories.has(category)) {
      fail("inventory_semantics_invalid", `Required authority category is missing: ${category}`);
    }
  }

  for (const item of inventory.coverage) {
    requireSortedUnique(item.authorityPathIds, `${item.sourcePath}.authorityPathIds`);
    const classifiedEntries = item.authorityPathIds.map((id) => entries.get(id));
    const hasEvaluatorOnly = classifiedEntries.some(
      (entry) => entry?.classification === "evaluator_only_logic"
    );
    const hasProduction = classifiedEntries.some((entry) =>
      entry?.runtimeAccess.includes("production")
    );
    if (hasEvaluatorOnly && hasProduction) {
      fail(
        "inventory_semantics_invalid",
        `${item.sourcePath} mixes evaluator-only and production classifications`
      );
    }
    const expectedScope =
      item.sourcePath.startsWith("test/fixtures/") || hasEvaluatorOnly
        ? "evaluation"
        : "production";
    if (item.surfaceScope !== expectedScope) {
      fail(
        "inventory_semantics_invalid",
        `${item.sourcePath} has inconsistent ${item.surfaceScope} surface scope`
      );
    }
    if (
      (item.disposition === "authority_path" && item.authorityPathIds.length === 0) ||
      (item.disposition === "no_authority_effect" && item.authorityPathIds.length !== 0)
    ) {
      fail(
        "inventory_semantics_invalid",
        `${item.sourcePath} disposition disagrees with its authority-path ids`
      );
    }
    for (const pathId of item.authorityPathIds) {
      const entry = entries.get(pathId);
      if (!entry) {
        fail(
          "inventory_semantics_invalid",
          `${item.sourcePath} references unknown authority path ${pathId}`
        );
      }
      if (!entry.definitionSources.some((source) => source.path === item.sourcePath)) {
        fail(
          "inventory_semantics_invalid",
          `${item.sourcePath} authority coverage is not reciprocal for ${pathId}`
        );
      }
    }
  }

  for (const item of inventory.declarationCoverage) {
    requireSortedUnique(
      item.authorityPathIds,
      `${item.sourcePath}::${item.selector}.authorityPathIds`
    );
    const coverageItem = coverage.get(item.sourcePath);
    if (!coverageItem) {
      fail(
        "inventory_semantics_invalid",
        `${item.sourcePath}::${item.selector} references an uncovered source`
      );
    }
    if (
      (item.disposition === "authority_path" && item.authorityPathIds.length === 0) ||
      (item.disposition === "no_authority_effect" && item.authorityPathIds.length !== 0)
    ) {
      fail(
        "inventory_semantics_invalid",
        `${item.sourcePath}::${item.selector} disposition disagrees with its authority-path ids`
      );
    }
    for (const pathId of item.authorityPathIds) {
      const entry = entries.get(pathId);
      if (!entry) {
        fail(
          "inventory_semantics_invalid",
          `${item.sourcePath}::${item.selector} references unknown authority path ${pathId}`
        );
      }
      if (
        !coverageItem.authorityPathIds.includes(pathId) ||
        !entry.definitionSources.some((source) => source.path === item.sourcePath)
      ) {
        fail(
          "inventory_semantics_invalid",
          `${item.sourcePath}::${item.selector} declaration coverage is not reciprocal for ${pathId}`
        );
      }
    }
  }

  const fixtureRefs = new Set<string>();
  const shadowedPathIds = new Set<string>();
  for (const fixture of inventory.shadowFixtures) {
    requireSortedUnique(fixture.pathIds, `${fixture.id}.pathIds`);
    requireSortedUnique(
      fixture.legacyReaderLocators.map(
        (binding) => `${binding.authorityPathId}\0${locatorIdentity(binding.locator)}`
      ),
      `${fixture.id}.legacyReaderLocators`
    );
    if (fixtureRefs.has(fixture.fixtureRef)) {
      fail(
        "inventory_semantics_invalid",
        `${fixture.id} duplicates fixture path ${fixture.fixtureRef}`
      );
    }
    fixtureRefs.add(fixture.fixtureRef);
    for (const pathId of fixture.pathIds) {
      const entry = entries.get(pathId);
      if (!entry) {
        fail(
          "inventory_semantics_invalid",
          `${fixture.id} references unknown authority path ${pathId}`
        );
      }
      shadowedPathIds.add(pathId);
      const bindings = fixture.legacyReaderLocators.filter(
        (binding) => binding.authorityPathId === pathId
      );
      if (
        bindings.length === 0 ||
        bindings.some(
          (binding) =>
            !entry.reads.some(
              (reader) => locatorIdentity(reader) === locatorIdentity(binding.locator)
            )
        )
      ) {
        fail(
          "inventory_semantics_invalid",
          `${fixture.id} must bind an exact current legacy reader for ${pathId}`
        );
      }
    }
    if (
      fixture.legacyReaderLocators.some(
        (binding) => !fixture.pathIds.includes(binding.authorityPathId)
      )
    ) {
      fail(
        "inventory_semantics_invalid",
        `${fixture.id} binds a legacy reader outside its declared pathIds`
      );
    }
  }

  for (const entry of inventory.entries) {
    if (
      entry.compatibility.mode === "legacy_reader_shadow_required" &&
      !shadowedPathIds.has(entry.id)
    ) {
      fail("inventory_semantics_invalid", `${entry.id} requires a legacy-reader shadow fixture`);
    }
  }

  for (const entry of inventory.entries) {
    const evidenceRef = entry.mechanicalEvidenceRef;
    if (evidenceRef !== null) {
      const resolver = entries.get(evidenceRef.resolverPathId);
      if (!resolver) {
        fail(
          "inventory_semantics_invalid",
          `${entry.id} mechanical evidence references unknown path ${evidenceRef.resolverPathId}`
        );
      }
      if (
        resolver.classification !== "mechanical_fact" ||
        resolver.mechanicality !== "mechanical" ||
        resolver.category !== "validator"
      ) {
        fail(
          "inventory_semantics_invalid",
          `${entry.id} mechanical evidence resolver must be a mechanical validator`
        );
      }
      const resolverSelectors = resolver.reads.map((locator) => locator.selector).sort();
      if (
        evidenceRef.resolverSelectors.length !== resolverSelectors.length ||
        evidenceRef.resolverSelectors.some(
          (selector, index) => selector !== resolverSelectors[index]
        )
      ) {
        fail(
          "inventory_semantics_invalid",
          `${entry.id} mechanical evidence selectors must exactly match resolver reads`
        );
      }
      if (!entry.runtimeAccess.every((context) => resolver.runtimeAccess.includes(context))) {
        fail(
          "inventory_semantics_invalid",
          `${entry.id} mechanical evidence resolver does not cover every runtime context`
        );
      }
      if (!entry.subjectDomains.some((domain) => resolver.subjectDomains.includes(domain))) {
        fail(
          "inventory_semantics_invalid",
          `${entry.id} mechanical evidence resolver has no bound subject domain`
        );
      }
    }
  }
}

function validateInventoryDigests(inventory: AuthorityPathInventory): void {
  for (const entry of inventory.entries) {
    const { digest, ...core } = entry;
    if (authorityDigest("entry", core) !== digest) {
      fail("digest_mismatch", `${entry.id} entry digest does not match its canonical core`);
    }
  }
  for (const fixture of inventory.shadowFixtures) {
    const { digest, ...core } = fixture;
    if (authorityDigest("shadow-fixture", core) !== digest) {
      fail("digest_mismatch", `${fixture.id} shadow digest does not match its canonical core`);
    }
  }
  const { digest, ...core } = inventory;
  if (authorityDigest("inventory", core) !== digest) {
    fail("digest_mismatch", "Inventory digest does not match its canonical core");
  }
}

/** Decode, semantically validate, independently re-digest, and freeze an inventory snapshot. */
export function validateAuthorityPathInventory(value: unknown): AuthorityPathInventory {
  const inventory = decode<AuthorityPathInventory>(
    AuthorityPathInventorySchema,
    value,
    "Authority Path Inventory"
  );
  validateInventorySemantics(inventory);
  validateInventoryDigests(inventory);
  return deepFreeze(inventory);
}

export const bundledAuthorityPathInventory = validateAuthorityPathInventory(bundledInventoryJson);

const bundledEntriesById = new Map(
  bundledAuthorityPathInventory.entries.map((entry) => [entry.id, entry])
);
const bundledShadowFixturesById = new Map(
  bundledAuthorityPathInventory.shadowFixtures.map((fixture) => [fixture.id, fixture])
);

function inventoryRef(): Static<typeof InventoryRefSchema> {
  return {
    id: bundledAuthorityPathInventory.inventoryId,
    snapshotRevision: bundledAuthorityPathInventory.snapshotRevision,
    digest: bundledAuthorityPathInventory.digest,
  };
}

/** Clone-safe read-only view for the HTTP inspection route. */
export function getAuthorityPathInventoryView(): AuthorityPathInventory {
  return structuredClone(bundledAuthorityPathInventory);
}

/** Inspect one classified path without resolving or activating it. */
export function inspectAuthorityPath(id: string): AuthorityPathInspection {
  const entry = bundledEntriesById.get(id);
  if (!entry) fail("unknown_authority_path", `Unknown Authority Path Inventory id: ${id}`);
  const inspection: AuthorityPathInspection = {
    schemaVersion: 1,
    inventoryRef: inventoryRef(),
    entry: structuredClone(entry),
    coverage: bundledAuthorityPathInventory.coverage
      .filter((item) => item.authorityPathIds.includes(id))
      .map((item) => structuredClone(item)),
    declarationCoverage: bundledAuthorityPathInventory.declarationCoverage
      .filter((item) => item.authorityPathIds.includes(id))
      .map((item) => structuredClone(item)),
    shadowFixtureIds: bundledAuthorityPathInventory.shadowFixtures
      .filter((fixture) => fixture.pathIds.includes(id))
      .map((fixture) => fixture.id),
    authorityGranted: false,
    access: "inspection",
    resolver: "disabled",
    manifestCompleteness: "not_evaluated",
    productionActivation: "unchanged",
  };
  return deepFreeze(inspection);
}

/**
 * Produce a bounded guard observation. This proves only that the path and requested context are
 * classified; it deliberately does not produce an activation or manifest-completeness decision.
 */
export function observeAuthorityPath(
  id: string,
  context: AuthorityPathRuntimeContext
): AuthorityPathObservation {
  if (!Value.Check(AuthorityPathRuntimeContextSchema, context)) {
    fail("runtime_context_forbidden", `Unknown authority runtime context: ${String(context)}`);
  }
  const entry = bundledEntriesById.get(id);
  if (!entry) fail("unknown_authority_path", `Unknown Authority Path Inventory id: ${id}`);
  if (!entry.runtimeAccess.includes(context)) {
    fail("runtime_context_forbidden", `${id} is not classified for the ${context} runtime context`);
  }
  if (
    context === "production" &&
    (entry.quarantine.state !== "not_quarantined" ||
      entry.classification === "evaluator_only_logic" ||
      entry.classification === "forbidden_unregistered_bypass")
  ) {
    fail("runtime_context_forbidden", `${id} cannot be observed through a production path`);
  }
  const core = {
    schemaVersion: 1 as const,
    inventoryRef: inventoryRef(),
    pathId: entry.id,
    pathDigest: entry.digest,
    context,
    classification: entry.classification,
    mechanicality: entry.mechanicality,
    quarantineState: entry.quarantine.state,
    compatibilityMode: entry.compatibility.mode,
    guardDecision: "observation_only" as const,
    authorityGranted: false as const,
    resolver: "disabled" as const,
    manifestCompleteness: "not_evaluated" as const,
    productionActivation: "unchanged" as const,
  };
  return deepFreeze({ ...core, digest: authorityDigest("runtime-observation", core) });
}

/** Execute a classified compatibility callback, failing closed before callback invocation. */
export function withAuthorityPath<T>(
  id: string,
  context: AuthorityPathRuntimeContext,
  callback: (observation: AuthorityPathObservation) => T
): T {
  const observation = observeAuthorityPath(id, context);
  const entry = bundledEntriesById.get(id)!;
  if (
    typeof callback !== "function" ||
    entry.compatibility.mode === "quarantined_no_read" ||
    (entry.compatibility.mode === "quarantined_inspection_only" && context !== "inspection") ||
    (entry.compatibility.mode === "read_only_no_activation" && context === "production")
  ) {
    fail("callback_forbidden", `${id} cannot invoke a compatibility callback in ${context}`);
  }
  return callback(observation);
}

function exactInputKeys(value: object, allowed: readonly string[], label: string): void {
  const keys = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    fail("inventory_schema_invalid", `${label} has unknown or missing fields`);
  }
}

/** Compare a future-reader observation without executing a reader or changing production state. */
export function compareAuthorityPathShadow(
  input: CompareAuthorityPathShadowInput
): AuthorityPathShadowComparison {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("inventory_schema_invalid", "Shadow comparison input must be an object");
  }
  const hasCandidateOutput = Object.prototype.hasOwnProperty.call(input, "candidateOutput");
  const hasCandidateError = Object.prototype.hasOwnProperty.call(input, "candidateError");
  exactInputKeys(
    input,
    [
      "fixtureId",
      "legacyOutput",
      ...(hasCandidateOutput ? ["candidateOutput"] : []),
      ...(hasCandidateError ? ["candidateError"] : []),
    ],
    "Shadow comparison input"
  );
  if (typeof input.fixtureId !== "string" || input.fixtureId.length === 0) {
    fail("inventory_schema_invalid", "Shadow comparison fixtureId must be a non-empty string");
  }
  if (hasCandidateOutput && hasCandidateError) {
    fail(
      "inventory_schema_invalid",
      "Shadow comparison cannot provide both candidateOutput and candidateError"
    );
  }
  const fixture = bundledShadowFixturesById.get(input.fixtureId);
  if (!fixture) {
    fail("shadow_fixture_missing", `Unknown authority shadow fixture: ${input.fixtureId}`);
  }
  const suppliedLegacyOutputDigest = authorityPathObservationDigest(input.legacyOutput);
  if (suppliedLegacyOutputDigest !== fixture.expectedLegacyOutputDigest) {
    fail(
      "legacy_observation_mismatch",
      `${fixture.id} supplied legacy output does not match its frozen fixture digest`
    );
  }

  let result: AuthorityPathShadowComparisonResult;
  let candidateOutputDigest: string | null = null;
  let reasonCodes: string[];
  if (hasCandidateError) {
    result = "error";
    reasonCodes = ["candidate_reader_error"];
  } else if (!hasCandidateOutput) {
    result = "unknown";
    reasonCodes = ["candidate_observation_not_supplied"];
  } else {
    try {
      candidateOutputDigest = authorityPathObservationDigest(input.candidateOutput);
      result =
        candidateOutputDigest === fixture.expectedLegacyOutputDigest ? "exact_match" : "different";
      reasonCodes = result === "exact_match" ? [] : ["canonical_output_digest_differs"];
    } catch (error) {
      if (!(error instanceof AuthorityPathInventoryError)) throw error;
      result = "error";
      candidateOutputDigest = null;
      reasonCodes = ["candidate_output_not_canonical_json"];
    }
  }

  const core = {
    schemaVersion: 1 as const,
    inventoryRef: inventoryRef(),
    fixtureId: fixture.id,
    fixtureDigest: fixture.digest,
    pathIds: [...fixture.pathIds],
    expectedLegacyOutputDigest: fixture.expectedLegacyOutputDigest,
    suppliedLegacyOutputDigest,
    candidateOutputDigest,
    result,
    reasonCodes,
    productionEffect: "none" as const,
    candidateDisposition: "shadow_only" as const,
    activationDecision: "not_evaluated" as const,
    manifestCompleteness: "not_evaluated" as const,
    productionActivation: "unchanged" as const,
  };
  return deepFreeze({ ...core, digest: authorityDigest("shadow-comparison", core) });
}

const ShadowFixtureFileSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: NonEmptyStringSchema,
    input: Type.Unknown(),
    expectedLegacyOutput: Type.Unknown(),
  },
  Strict
);
type ShadowFixtureFile = Static<typeof ShadowFixtureFileSchema>;

function resolveProjectFile(projectRoot: string, relativePath: string): string {
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    relativePath.includes("\0") ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath === ".." ||
    relativePath.startsWith("../")
  ) {
    fail("filesystem_binding_invalid", "Inventory contains an unsafe relative file binding");
  }
  try {
    const root = realpathSync(projectRoot);
    const candidate = realpathSync(path.resolve(root, ...relativePath.split("/")));
    const containment = path.relative(root, candidate);
    if (
      containment === ".." ||
      containment.startsWith(`..${path.sep}`) ||
      path.isAbsolute(containment) ||
      !statSync(candidate).isFile()
    ) {
      fail("filesystem_binding_invalid", "Inventory file binding escapes the project root");
    }
    return candidate;
  } catch (error) {
    if (error instanceof AuthorityPathInventoryError) throw error;
    fail(
      "filesystem_binding_invalid",
      `Inventory file binding is unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function readBoundBytes(projectRoot: string, relativePath: string, expectedDigest: string): Buffer {
  const bytes = readFileSync(resolveProjectFile(projectRoot, relativePath));
  if (rawSha256(bytes) !== expectedDigest) {
    fail("digest_mismatch", `Raw file digest mismatch for ${relativePath}`);
  }
  return bytes;
}

/** Independently verify every raw builder, policy, seed, writer-contract, source, and fixture binding. */
export function verifyAuthorityPathInventoryFiles(
  projectRoot: string
): AuthorityPathFileVerification {
  if (typeof projectRoot !== "string" || projectRoot.length === 0) {
    fail("filesystem_binding_invalid", "A project root is required for raw inventory verification");
  }
  const verifiedPaths = new Set<string>();
  const verify = (relativePath: string, digest: string): Buffer => {
    const bytes = readBoundBytes(projectRoot, relativePath, digest);
    verifiedPaths.add(relativePath);
    return bytes;
  };

  verify(
    bundledAuthorityPathInventory.builderRef.path,
    bundledAuthorityPathInventory.builderRef.digest
  );
  verify(
    bundledAuthorityPathInventory.classificationPolicyRef.path,
    bundledAuthorityPathInventory.classificationPolicyRef.digest
  );
  verify(
    bundledAuthorityPathInventory.definitionRef.path,
    bundledAuthorityPathInventory.definitionRef.digest
  );
  verify(
    bundledAuthorityPathInventory.writerContractRef.path,
    bundledAuthorityPathInventory.writerContractRef.digest
  );
  for (const item of bundledAuthorityPathInventory.coverage) {
    verify(item.sourcePath, item.sourceDigest);
  }
  for (const fixture of bundledAuthorityPathInventory.shadowFixtures) {
    const bytes = verify(fixture.fixtureRef, fixture.fixtureDigest);
    let parsed: unknown;
    try {
      parsed = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      fail(
        "filesystem_binding_invalid",
        `${fixture.fixtureRef} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    const fixtureFile = decode<ShadowFixtureFile>(
      ShadowFixtureFileSchema,
      parsed,
      `Shadow fixture ${fixture.id}`
    );
    if (
      fixtureFile.id !== fixture.id ||
      authorityPathObservationDigest(fixtureFile.input) !== fixture.inputDigest ||
      authorityPathObservationDigest(fixtureFile.expectedLegacyOutput) !==
        fixture.expectedLegacyOutputDigest
    ) {
      fail(
        "digest_mismatch",
        `${fixture.id} raw fixture identity or canonical observation digest does not match`
      );
    }
  }

  const core = {
    schemaVersion: 1 as const,
    inventoryRef: inventoryRef(),
    status: "verified" as const,
    builderDigest: bundledAuthorityPathInventory.builderRef.digest,
    classificationPolicyDigest: bundledAuthorityPathInventory.classificationPolicyRef.digest,
    definitionDigest: bundledAuthorityPathInventory.definitionRef.digest,
    writerContractDigest: bundledAuthorityPathInventory.writerContractRef.digest,
    coverageFileCount: bundledAuthorityPathInventory.coverage.length,
    shadowFixtureCount: bundledAuthorityPathInventory.shadowFixtures.length,
    verifiedBindingCount:
      4 +
      bundledAuthorityPathInventory.coverage.length +
      bundledAuthorityPathInventory.shadowFixtures.length +
      bundledAuthorityPathInventory.entries.reduce(
        (count, entry) => count + entry.runtimeGuardBindings.length + entry.deniedMutations.length,
        0
      ),
    uniqueFileCount: verifiedPaths.size,
    manifestCompleteness: "not_evaluated" as const,
    productionActivation: "unchanged" as const,
  };
  return deepFreeze({ ...core, digest: authorityDigest("filesystem-verification", core) });
}

/** Deterministic, evidence-empty T14 reconciliation input. */
export function buildT14AuthorityPathHandoff(): T14AuthorityPathHandoff {
  const core = {
    schemaVersion: 1 as const,
    handoffId: "authority-path-inventory.t14-handoff.v1" as const,
    inventoryRef: inventoryRef(),
    manifestCompleteness: structuredClone(bundledAuthorityPathInventory.manifestCompleteness),
    entries: bundledAuthorityPathInventory.entries.map((entry) => ({
      inventoryPathId: entry.id,
      pathDigest: entry.digest,
      mechanicality: entry.mechanicality,
      classification: entry.classification,
      authorityLane: entry.authorityLane,
      futureBindingStatus: entry.futureBinding.status,
      futureComponentId: entry.futureBinding.componentId,
      componentRef: null,
      manifestOutcomeRef: null,
      disposition: "unknown" as const,
      reasonCodes: ["applied_knowledge_manifest_not_available", "component_registry_not_available"],
    })),
    shadowFixtures: bundledAuthorityPathInventory.shadowFixtures.map((fixture) => ({
      fixtureId: fixture.id,
      fixtureDigest: fixture.digest,
      pathIds: [...fixture.pathIds],
      comparisonStatus: "not_evaluated" as const,
    })),
    productionActivation: "unchanged" as const,
  };
  return deepFreeze({ ...core, digest: authorityDigest("t14-handoff", core) });
}
