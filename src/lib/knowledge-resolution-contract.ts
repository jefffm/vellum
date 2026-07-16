import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import { referenceSourceDigest } from "./reference-source-domain.js";
import {
  KnowledgeExecutionIdentitySchema,
  type KnowledgeExecutionIdentity,
} from "./knowledge-resolution-identity.js";

export {
  KnowledgeExecutionIdentitySchema,
  type KnowledgeExecutionIdentity,
} from "./knowledge-resolution-identity.js";

const Strict = { additionalProperties: false } as const;
const IdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
});

assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");

export const KnowledgeResolutionRefSchema = Type.Object(
  { id: IdSchema, digest: DigestSchema },
  Strict
);
export type KnowledgeResolutionRef = Static<typeof KnowledgeResolutionRefSchema>;

export const KnowledgeResolutionGenerationRefSchema = Type.Object(
  { id: IdSchema, digest: DigestSchema, revision: Type.Integer({ minimum: 1 }) },
  Strict
);
export type KnowledgeResolutionGenerationRef = Static<
  typeof KnowledgeResolutionGenerationRefSchema
>;

export const KnowledgeResolutionModeSchema = Type.Union([
  Type.Literal("ordinary_default"),
  Type.Literal("provisional_research"),
  Type.Literal("isolated_evaluation"),
]);
export type KnowledgeResolutionMode = Static<typeof KnowledgeResolutionModeSchema>;

export const KnowledgeResolutionContextSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_resolution_context"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    mode: KnowledgeResolutionModeSchema,
    sourceProfile: Type.Union([Type.Literal("mace-musicks-monument-1676"), Type.Null()]),
    instrumentFamily: Type.Union([Type.Literal("baroque_lute"), Type.Null()]),
    notationSystem: Type.Union([Type.Literal("french_tablature"), Type.Null()]),
    sourceCourseCount: Type.Union([Type.Literal(12), Type.Null()]),
    historicalSignState: Type.Union([Type.Literal("unresolved"), Type.Null()]),
    passageRef: KnowledgeResolutionRefSchema,
    sourceContextRefs: Type.Array(KnowledgeResolutionRefSchema, { maxItems: 64 }),
    analysisRef: KnowledgeResolutionRefSchema,
    arrangementPlanRef: KnowledgeResolutionRefSchema,
    arrangementBriefRef: KnowledgeResolutionRefSchema,
    performanceBriefRef: KnowledgeResolutionRefSchema,
    preservationPolicyRef: KnowledgeResolutionRefSchema,
    instrumentInstanceRef: KnowledgeResolutionRefSchema,
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgeResolutionContext = Static<typeof KnowledgeResolutionContextSchema>;

export const KnowledgeResolutionPolicySchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_resolution_policy"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    policyVersion: Type.Literal(1),
    inventoryBuilderRef: KnowledgeResolutionRefSchema,
    inventoryPolicyRef: KnowledgeResolutionRefSchema,
    catalogBuilderRef: KnowledgeResolutionRefSchema,
    resolverSpecRef: KnowledgeResolutionRefSchema,
    clockPolicyRef: KnowledgeResolutionRefSchema,
    trustPolicyRef: KnowledgeResolutionRefSchema,
    configuredRegistryRefs: Type.Array(KnowledgeResolutionRefSchema, { minItems: 1 }),
    allowedTestUses: Type.Tuple([
      Type.Literal("isolated_evaluation"),
      Type.Literal("provisional_research"),
    ]),
    ordinaryTestOnlyDisposition: Type.Literal("deny"),
    unknownDisposition: Type.Literal("review_required"),
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgeResolutionPolicy = Static<typeof KnowledgeResolutionPolicySchema>;

export const KnowledgeInventoryOutcomeStateSchema = Type.Union([
  Type.Literal("eligible"),
  Type.Literal("excluded"),
  Type.Literal("conflicting"),
  Type.Literal("retracted"),
  Type.Literal("unavailable_source"),
  Type.Literal("inapplicable"),
  Type.Literal("unknown"),
]);
export type KnowledgeInventoryOutcomeState = Static<typeof KnowledgeInventoryOutcomeStateSchema>;

export const KnowledgeInventoryOutcomeSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_inventory_outcome"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    releaseRef: KnowledgeResolutionRefSchema,
    state: KnowledgeInventoryOutcomeStateSchema,
    profileRefs: Type.Array(KnowledgeResolutionRefSchema),
    componentRefs: Type.Array(KnowledgeResolutionRefSchema),
    dependencyRefs: Type.Array(KnowledgeResolutionRefSchema),
    conflictRefs: Type.Array(KnowledgeResolutionRefSchema),
    exclusionReasonCodes: Type.Array(IdSchema),
    rightsDecisionRefs: Type.Array(KnowledgeResolutionRefSchema),
    attestationRefs: Type.Array(KnowledgeResolutionRefSchema),
    verificationRefs: Type.Array(KnowledgeResolutionRefSchema),
    advisoryRefs: Type.Array(KnowledgeResolutionRefSchema),
    advisoryVerificationRefs: Type.Array(KnowledgeResolutionRefSchema),
    validThrough: Type.Optional(IsoTimestampSchema),
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgeInventoryOutcome = Static<typeof KnowledgeInventoryOutcomeSchema>;

export const KnowledgeLibraryInventorySnapshotSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_library_inventory_snapshot"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    configuredRegistryRefs: Type.Array(KnowledgeResolutionRefSchema, { minItems: 1 }),
    allReleaseRefs: Type.Array(KnowledgeResolutionRefSchema),
    inventoryBuilderRef: KnowledgeResolutionRefSchema,
    inventoryPolicyRef: KnowledgeResolutionRefSchema,
    authoritativePublicationGenerationRef: KnowledgeResolutionRefSchema,
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgeLibraryInventorySnapshot = Static<
  typeof KnowledgeLibraryInventorySnapshotSchema
>;

export const KnowledgeCatalogSnapshotSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_catalog_snapshot"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    inventorySnapshotRef: KnowledgeResolutionRefSchema,
    resolutionTime: IsoTimestampSchema,
    clockPolicyRef: KnowledgeResolutionRefSchema,
    eligibleReleaseRefs: Type.Array(KnowledgeResolutionRefSchema),
    inventoryOutcomeRefs: Type.Array(KnowledgeResolutionRefSchema),
    attestationRefs: Type.Array(KnowledgeResolutionRefSchema),
    verificationRefs: Type.Array(KnowledgeResolutionRefSchema),
    advisoryRefs: Type.Array(KnowledgeResolutionRefSchema),
    advisoryVerificationRefs: Type.Array(KnowledgeResolutionRefSchema),
    rightsDecisionRefs: Type.Array(KnowledgeResolutionRefSchema),
    trustPolicyRef: KnowledgeResolutionRefSchema,
    catalogBuilderRef: KnowledgeResolutionRefSchema,
    validThrough: Type.Optional(IsoTimestampSchema),
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgeCatalogSnapshot = Static<typeof KnowledgeCatalogSnapshotSchema>;

export const KnowledgePredicateResultSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_predicate_result"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    predicateRef: KnowledgeResolutionRefSchema,
    evaluatedContextRef: KnowledgeResolutionRefSchema,
    evaluatorComponentRef: KnowledgeResolutionRefSchema,
    result: Type.Union([
      Type.Literal("true"),
      Type.Literal("false"),
      Type.Literal("unknown"),
      Type.Literal("error"),
    ]),
    evidenceRefs: Type.Array(KnowledgeResolutionRefSchema),
    rationaleCode: IdSchema,
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgePredicateResult = Static<typeof KnowledgePredicateResultSchema>;

const TestOnlyActivationAuthoritySchema = Type.Object(
  {
    kind: Type.Literal("test_only"),
    testPolicyRef: KnowledgeResolutionRefSchema,
    permittedUse: Type.Union([
      Type.Literal("isolated_evaluation"),
      Type.Literal("provisional_research"),
    ]),
  },
  Strict
);

const ActivationDecisionBase = {
  recordKind: Type.Literal("activation_decision"),
  schemaVersion: Type.Literal(1),
  id: IdSchema,
  releaseRef: KnowledgeResolutionRefSchema,
  profileRef: KnowledgeResolutionRefSchema,
  attestationRefs: Type.Array(KnowledgeResolutionRefSchema),
  verificationRefs: Type.Array(KnowledgeResolutionRefSchema),
  rightsDecisionRefs: Type.Array(KnowledgeResolutionRefSchema),
  applicableAdvisoryRefs: Type.Array(KnowledgeResolutionRefSchema),
  advisoryVerificationRefs: Type.Array(KnowledgeResolutionRefSchema),
  requestedScopeRef: KnowledgeResolutionRefSchema,
  resolutionPolicyRef: KnowledgeResolutionRefSchema,
  resolutionTime: IsoTimestampSchema,
  clockPolicyRef: KnowledgeResolutionRefSchema,
  validThrough: Type.Optional(IsoTimestampSchema),
  rationaleCode: IdSchema,
};

export const KnowledgeActivationDecisionSchema = Type.Union([
  Type.Object(
    {
      ...ActivationDecisionBase,
      result: Type.Literal("allow"),
      authority: TestOnlyActivationAuthoritySchema,
      digest: DigestSchema,
    },
    Strict
  ),
  Type.Object(
    {
      ...ActivationDecisionBase,
      result: Type.Union([Type.Literal("deny"), Type.Literal("review_required")]),
      digest: DigestSchema,
    },
    Strict
  ),
]);
export type KnowledgeActivationDecision = Static<typeof KnowledgeActivationDecisionSchema>;

export const KnowledgeAuthorityPathOutcomeSchema = Type.Object(
  {
    inventoryPathId: IdSchema,
    pathDigest: DigestSchema,
    disposition: Type.Union([
      Type.Literal("registered_component"),
      Type.Literal("mechanical_model"),
      Type.Literal("evaluator_only"),
      Type.Literal("disabled"),
      Type.Literal("not_applicable"),
    ]),
    componentRef: Type.Union([KnowledgeResolutionRefSchema, Type.Null()]),
    manifestOutcomeRef: KnowledgeResolutionRefSchema,
    reasonCodes: Type.Array(IdSchema, { minItems: 1 }),
  },
  Strict
);
export type KnowledgeAuthorityPathOutcome = Static<typeof KnowledgeAuthorityPathOutcomeSchema>;

export const KnowledgeComponentRegistryEntrySchema = Type.Object(
  {
    componentRef: KnowledgeResolutionRefSchema,
    artifactRef: KnowledgeResolutionRefSchema,
    interfaceRef: KnowledgeResolutionRefSchema,
    parameterSchemaRef: KnowledgeResolutionRefSchema,
    unitSchemaRef: KnowledgeResolutionRefSchema,
    compatibilityRef: KnowledgeResolutionRefSchema,
    resourcePolicyRef: KnowledgeResolutionRefSchema,
    replayState: Type.Union([Type.Literal("available"), Type.Literal("inspection_only")]),
    authorityPathIds: Type.Array(IdSchema, { minItems: 1 }),
  },
  Strict
);
export type KnowledgeComponentRegistryEntry = Static<typeof KnowledgeComponentRegistryEntrySchema>;

export const KnowledgeComponentRegistrySnapshotSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_component_registry_snapshot"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    authorityPathInventoryRef: KnowledgeResolutionRefSchema,
    entries: Type.Array(KnowledgeComponentRegistryEntrySchema),
    authorityPathOutcomes: Type.Array(KnowledgeAuthorityPathOutcomeSchema, { minItems: 1 }),
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgeComponentRegistrySnapshot = Static<
  typeof KnowledgeComponentRegistrySnapshotSchema
>;

export const KnowledgeProvisionalConsequenceSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_provisional_consequence"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    releaseRef: KnowledgeResolutionRefSchema,
    profileRef: KnowledgeResolutionRefSchema,
    componentRef: KnowledgeResolutionRefSchema,
    kind: Type.Literal("mace_diapason_course_signs"),
    courseMappings: Type.Tuple([
      Type.Object({ course: Type.Literal(7), sign: Type.Literal("a") }, Strict),
      Type.Object({ course: Type.Literal(8), sign: Type.Literal("/a") }, Strict),
      Type.Object({ course: Type.Literal(9), sign: Type.Literal("//a") }, Strict),
      Type.Object({ course: Type.Literal(10), sign: Type.Literal("///a") }, Strict),
      Type.Object({ course: Type.Literal(11), sign: Type.Literal("4") }, Strict),
      Type.Object({ course: Type.Literal(12), sign: Type.Literal("5") }, Strict),
    ]),
    course13Disposition: Type.Literal("unresolved_no_mapping"),
    presentation: Type.Literal("provisional_research_only"),
    readinessClaim: Type.Literal(false),
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgeProvisionalConsequence = Static<typeof KnowledgeProvisionalConsequenceSchema>;

export const AppliedKnowledgeEntrySchema = Type.Object(
  {
    releaseRef: KnowledgeResolutionRefSchema,
    profileRef: KnowledgeResolutionRefSchema,
    status: Type.Union([
      Type.Literal("applicable"),
      Type.Literal("inapplicable"),
      Type.Literal("conflicting"),
      Type.Literal("unknown"),
      Type.Literal("excluded"),
      Type.Literal("retracted"),
      Type.Literal("unavailable_source"),
    ]),
    predicateResultRefs: Type.Array(KnowledgeResolutionRefSchema),
    consequenceRefs: Type.Array(KnowledgeResolutionRefSchema),
    evidenceRefs: Type.Array(KnowledgeResolutionRefSchema),
    conflictRefs: Type.Array(KnowledgeResolutionRefSchema),
    activationDecisionRef: KnowledgeResolutionRefSchema,
    rationaleCode: IdSchema,
  },
  Strict
);
export type AppliedKnowledgeEntry = Static<typeof AppliedKnowledgeEntrySchema>;

export const AppliedKnowledgeManifestSchema = Type.Object(
  {
    recordKind: Type.Literal("applied_knowledge_manifest"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    contextRef: KnowledgeResolutionRefSchema,
    inventorySnapshotRef: KnowledgeResolutionRefSchema,
    catalogSnapshotRef: KnowledgeResolutionRefSchema,
    resolverSpecRef: KnowledgeResolutionRefSchema,
    resolutionPolicyRef: KnowledgeResolutionRefSchema,
    componentRegistrySnapshotRef: KnowledgeResolutionRefSchema,
    dependencyClosureRefs: Type.Array(KnowledgeResolutionRefSchema),
    releaseOutcomeRefs: Type.Array(KnowledgeResolutionRefSchema),
    entries: Type.Array(AppliedKnowledgeEntrySchema),
    conflictRefs: Type.Array(KnowledgeResolutionRefSchema),
    selectionDecisionRefs: Type.Array(KnowledgeResolutionRefSchema),
    compiledConstraintRefs: Type.Array(KnowledgeResolutionRefSchema),
    authorityPathOutcomeRefs: Type.Array(KnowledgeResolutionRefSchema, { minItems: 1 }),
    completeness: Type.Literal("complete"),
    digest: DigestSchema,
  },
  Strict
);
export type AppliedKnowledgeManifest = Static<typeof AppliedKnowledgeManifestSchema>;

export const KnowledgeResolutionProjectionSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    mode: KnowledgeResolutionModeSchema,
    publicationGenerationRef: KnowledgeResolutionGenerationRefSchema,
    context: KnowledgeResolutionContextSchema,
    policy: KnowledgeResolutionPolicySchema,
    inventory: KnowledgeLibraryInventorySnapshotSchema,
    outcomes: Type.Array(KnowledgeInventoryOutcomeSchema),
    catalog: KnowledgeCatalogSnapshotSchema,
    componentRegistry: KnowledgeComponentRegistrySnapshotSchema,
    predicateResults: Type.Array(KnowledgePredicateResultSchema),
    activationDecisions: Type.Array(KnowledgeActivationDecisionSchema),
    consequences: Type.Array(KnowledgeProvisionalConsequenceSchema),
    manifest: AppliedKnowledgeManifestSchema,
    executionIdentity: KnowledgeExecutionIdentitySchema,
    ordinaryActivation: Type.Literal(false),
    readinessClaim: Type.Literal(false),
  },
  Strict
);
export type KnowledgeResolutionProjection = Static<typeof KnowledgeResolutionProjectionSchema>;

type DigestedRecord = { readonly id: string; readonly digest: string };

export function buildKnowledgeResolutionRecord<T extends DigestedRecord>(
  schema: TSchema,
  domain: string,
  value: Omit<T, "digest">
): T {
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  const decoded = Value.Decode(schema, { ...structuredClone(value), digest: "0".repeat(64) }) as T;
  const { digest: _placeholder, ...core } = decoded;
  return validateKnowledgeResolutionRecord<T>(schema, {
    ...core,
    digest: referenceSourceDigest({ domain, ...core }),
  });
}

export function validateKnowledgeResolutionRecord<T extends DigestedRecord>(
  schema: TSchema,
  value: unknown
): T {
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  const decoded = Value.Decode(schema, value) as T;
  const { digest, ...core } = decoded;
  const domain = recordDigestDomain(decoded);
  if (referenceSourceDigest({ domain, ...core }) !== digest) {
    throw new TypeError(`${decoded.id} knowledge-resolution digest is invalid`);
  }
  return Object.freeze(structuredClone(decoded));
}

export function knowledgeResolutionRef(value: DigestedRecord): KnowledgeResolutionRef {
  return Value.Decode(KnowledgeResolutionRefSchema, { id: value.id, digest: value.digest });
}

export function buildKnowledgeExecutionIdentity(
  value: Omit<KnowledgeExecutionIdentity, "digest">
): KnowledgeExecutionIdentity {
  const decoded = Value.Decode(KnowledgeExecutionIdentitySchema, {
    ...structuredClone(value),
    digest: "0".repeat(64),
  });
  const { digest: _placeholder, ...core } = decoded;
  return Value.Decode(KnowledgeExecutionIdentitySchema, {
    ...core,
    digest: referenceSourceDigest({ domain: "knowledge-execution-identity", ...core }),
  });
}

function recordDigestDomain(value: DigestedRecord): string {
  const recordKind = (value as { recordKind?: unknown }).recordKind;
  return typeof recordKind === "string" ? recordKind : "knowledge-resolution-record";
}
