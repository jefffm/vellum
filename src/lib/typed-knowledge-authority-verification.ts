import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import {
  REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS,
  ReferenceAuthoritySubjectFacetRequirementSchema,
  ReferenceAuthorityVerificationReceiptSchema,
  referenceAuthorityReceiptSigningPayload,
  type ReferenceAuthorityReceiptVerifier,
  type ReferenceAuthoritySubjectFacetRequirement,
  type ReferenceAuthorityVerificationReceipt,
} from "./reference-source-authority.js";
import {
  ReferenceRecordRefSchema,
  canonicalReferenceJson,
  referenceSourceDigest,
  verifyReferenceRecordDigest,
  type ReferenceRecordRef,
} from "./reference-source-domain.js";
import {
  KnowledgeExternalEvidenceRefSchema,
  KnowledgeRecordRefSchema,
  type KnowledgeExternalEvidenceRef,
  type KnowledgeRecordRef,
} from "./reviewed-knowledge-contract.js";

const Strict = { additionalProperties: false } as const;
const SafeIdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
});

const RefProperties = {
  id: SafeIdSchema,
  digest: DigestSchema,
} as const;

export const TypedKnowledgeAuthoritySourceRefSchema = Type.Union([
  Type.Object({ recordKind: Type.Literal("work"), ...RefProperties }, Strict),
  Type.Object({ recordKind: Type.Literal("source_manifestation"), ...RefProperties }, Strict),
  Type.Object({ recordKind: Type.Literal("exemplar"), ...RefProperties }, Strict),
  Type.Object({ recordKind: Type.Literal("digital_asset"), ...RefProperties }, Strict),
  Type.Object({ recordKind: Type.Literal("asset_acquisition"), ...RefProperties }, Strict),
]);
export type TypedKnowledgeAuthoritySourceRef = Static<
  typeof TypedKnowledgeAuthoritySourceRefSchema
>;

export const TypedKnowledgePackCitationDecisionCommitmentSchema = Type.Object(
  {
    accessDecisionRef: ReferenceRecordRefSchema,
    outcome: Type.Literal("allow"),
    rightsAssertionRefs: Type.Array(ReferenceRecordRefSchema, {
      minItems: 1,
      maxItems: 256,
    }),
    authorityRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1, maxItems: 256 }),
    decidedAt: IsoTimestampSchema,
    rationaleCode: Type.Literal("exact_pack_citation_scope_verified"),
  },
  Strict
);
export type TypedKnowledgePackCitationDecisionCommitment = Static<
  typeof TypedKnowledgePackCitationDecisionCommitmentSchema
>;

export const TypedKnowledgeAuthorityVerificationSchema = Type.Object(
  {
    recordKind: Type.Literal("authority_verification"),
    schemaVersion: Type.Literal(1),
    id: SafeIdSchema,
    releaseRef: KnowledgeRecordRefSchema,
    operation: Type.Literal("pack_citation"),
    evaluatedAt: IsoTimestampSchema,
    observedSnapshotRef: ReferenceRecordRefSchema,
    sourceRefs: Type.Array(TypedKnowledgeAuthoritySourceRefSchema, {
      minItems: 5,
      maxItems: 5,
    }),
    derivativeRefs: Type.Array(KnowledgeExternalEvidenceRefSchema, {
      minItems: 1,
      maxItems: 256,
    }),
    authoritySubjectRefs: Type.Array(ReferenceRecordRefSchema, {
      minItems: 6,
      maxItems: 261,
    }),
    requiredFacets: Type.Array(
      Type.Union(
        REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.pack_citation.map((facet) =>
          Type.Literal(facet)
        )
      ),
      { minItems: 6, maxItems: 6 }
    ),
    requiredSubjectFacets: Type.Array(ReferenceAuthoritySubjectFacetRequirementSchema, {
      minItems: 6,
      maxItems: 261,
    }),
    destination: Type.Object(
      {
        kind: Type.Literal("repository"),
        id: Type.Literal("vellum.reviewed-knowledge-library"),
      },
      Strict
    ),
    purpose: Type.Literal(
      "Publish the exact cited Mace extraction as an inactive typed Knowledge Pack release"
    ),
    accessPolicyRef: ReferenceRecordRefSchema,
    verifierRef: ReferenceRecordRefSchema,
    verifierPolicyRef: ReferenceRecordRefSchema,
    decisionCommitment: TypedKnowledgePackCitationDecisionCommitmentSchema,
    receipt: ReferenceAuthorityVerificationReceiptSchema,
    digest: DigestSchema,
  },
  Strict
);
export type TypedKnowledgeAuthorityVerification = Static<
  typeof TypedKnowledgeAuthorityVerificationSchema
>;

export type BuildTypedKnowledgeAuthorityVerificationInput = Readonly<
  Omit<TypedKnowledgeAuthorityVerification, "recordKind" | "schemaVersion" | "id" | "digest">
>;

export function buildTypedKnowledgeAuthorityVerification(
  input: BuildTypedKnowledgeAuthorityVerificationInput
): TypedKnowledgeAuthorityVerification {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  const id = `authority-verification.pack-citation.${input.releaseRef.digest}`;
  const core = Value.Decode(TypedKnowledgeAuthorityVerificationSchema, {
    recordKind: "authority_verification",
    schemaVersion: 1,
    id,
    ...structuredClone(input),
    digest: "0".repeat(64),
  });
  const { digest: _placeholder, ...withoutDigest } = core;
  return validateTypedKnowledgeAuthorityVerification({
    ...withoutDigest,
    digest: referenceSourceDigest(withoutDigest),
  });
}

export function validateTypedKnowledgeAuthorityVerification(
  value: unknown
): TypedKnowledgeAuthorityVerification {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  const decoded = Value.Decode(TypedKnowledgeAuthorityVerificationSchema, value);
  if (!verifyReferenceRecordDigest(decoded)) {
    throw new TypeError("Typed Knowledge authority-verification digest is invalid");
  }
  if (decoded.id !== `authority-verification.pack-citation.${decoded.releaseRef.digest}`) {
    throw new TypeError("Typed Knowledge authority-verification ID is not release-bound");
  }
  assertSemanticTimestamp(decoded.evaluatedAt, "authority evaluation time");
  assertSemanticTimestamp(decoded.decisionCommitment.decidedAt, "decision time");
  if (Date.parse(decoded.decisionCommitment.decidedAt) > Date.parse(decoded.evaluatedAt)) {
    throw new TypeError("Typed Knowledge decision commitment is future-dated");
  }

  const sourceKinds = decoded.sourceRefs.map(({ recordKind }) => recordKind);
  const expectedSourceKinds = [
    "asset_acquisition",
    "digital_asset",
    "exemplar",
    "source_manifestation",
    "work",
  ];
  if (
    canonicalReferenceJson([...sourceKinds].sort(compareCodePoints)) !==
    canonicalReferenceJson(expectedSourceKinds)
  ) {
    throw new TypeError("Typed Knowledge authority source closure is incomplete");
  }

  assertUniqueSortedTypedRefs(decoded.sourceRefs, "source refs");
  assertUniqueSortedTypedRefs(decoded.derivativeRefs, "derivative refs");
  assertUniqueSortedRefs(decoded.authoritySubjectRefs, "authority-subject refs");
  assertUniqueSortedStrings(decoded.requiredFacets, "required facets");
  assertUniqueSortedSubjectFacets(decoded.requiredSubjectFacets);
  assertUniqueSortedRefs(
    decoded.decisionCommitment.rightsAssertionRefs,
    "decision rights-assertion refs"
  );
  assertUniqueSortedRefs(decoded.decisionCommitment.authorityRefs, "decision authority refs");

  if (
    !sameStringSet(
      decoded.requiredFacets,
      REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.pack_citation
    ) ||
    !sameRefSet(decoded.authoritySubjectRefs, [
      ...decoded.sourceRefs.map(bareRef),
      ...decoded.derivativeRefs.map(bareRef),
    ]) ||
    !sameSubjectFacetSet(
      decoded.requiredSubjectFacets,
      expectedSubjectFacets(decoded.sourceRefs, decoded.derivativeRefs)
    )
  ) {
    throw new TypeError("Typed Knowledge authority scope is not the exact pack-citation closure");
  }

  const receipt = decoded.receipt;
  if (!verifyReferenceRecordDigest(receipt)) {
    throw new TypeError("Typed Knowledge authority receipt digest is invalid");
  }
  assertSemanticTimestamp(receipt.verifiedAt, "receipt verification time");
  if (
    receipt.verifiedAt !== decoded.evaluatedAt ||
    (receipt.validUntil !== undefined &&
      (Date.parse(receipt.validUntil) <= Date.parse(decoded.evaluatedAt) ||
        !Number.isFinite(Date.parse(receipt.validUntil))))
  ) {
    throw new TypeError(
      "Typed Knowledge authority receipt was not minted for the exact evaluation instant"
    );
  }
  if (
    !refsEqual(receipt.observedSnapshotRef, decoded.observedSnapshotRef) ||
    !refsEqual(receipt.accessDecisionRef, decoded.decisionCommitment.accessDecisionRef) ||
    !refsEqual(receipt.verifierRef, decoded.verifierRef) ||
    !refsEqual(receipt.verifierPolicyRef, decoded.verifierPolicyRef) ||
    !sameRefSet(
      receipt.currentRightsAssertionRefs,
      decoded.decisionCommitment.rightsAssertionRefs
    ) ||
    !sameRefSet(receipt.verifiedAuthorityRefs, decoded.decisionCommitment.authorityRefs) ||
    !sameRefSet(receipt.authoritySubjectRefs, decoded.authoritySubjectRefs) ||
    !sameStringSet(receipt.requiredFacets, decoded.requiredFacets) ||
    !sameSubjectFacetSet(receipt.requiredSubjectFacets, decoded.requiredSubjectFacets)
  ) {
    throw new TypeError("Typed Knowledge authority receipt does not bind its commitment");
  }
  return deepFreeze(decoded);
}

export function verifyPersistedTypedKnowledgeAuthorityReceipt(
  authorityVerification: TypedKnowledgeAuthorityVerification,
  verifyPersistedReceipt: ReferenceAuthorityReceiptVerifier
): boolean {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  const validated = validateTypedKnowledgeAuthorityVerification(authorityVerification);
  if (typeof verifyPersistedReceipt !== "function") return false;
  try {
    return verifyPersistedReceipt({
      receipt: validated.receipt,
      signingPayload: referenceAuthorityReceiptSigningPayload(validated.receipt),
    });
  } catch {
    return false;
  }
}

export function typedKnowledgeAuthorityVerificationRef(
  value: TypedKnowledgeAuthorityVerification
): KnowledgeRecordRef {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
  const validated = validateTypedKnowledgeAuthorityVerification(value);
  return { id: validated.id, digest: validated.digest };
}

function expectedSubjectFacets(
  sourceRefs: readonly TypedKnowledgeAuthoritySourceRef[],
  derivativeRefs: readonly KnowledgeExternalEvidenceRef[]
): ReferenceAuthoritySubjectFacetRequirement[] {
  const sourceFacet = {
    work: "underlying_work_status",
    source_manifestation: "manifestation_editorial",
    exemplar: "exemplar_restriction",
    digital_asset: "scan_provider_terms",
    asset_acquisition: "attribution",
  } as const;
  return [
    ...sourceRefs.map((source) => ({
      subjectRef: bareRef(source),
      facet: sourceFacet[source.recordKind],
    })),
    ...derivativeRefs.map((derivative) => ({
      subjectRef: bareRef(derivative),
      facet: "pack_citation_excerpt" as const,
    })),
  ];
}

function assertSemanticTimestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new TypeError(`Typed Knowledge ${label} is not a semantic UTC instant`);
  }
}

function assertUniqueSortedTypedRefs(
  refs: ReadonlyArray<ReferenceRecordRef & { recordKind: string }>,
  label: string
): void {
  const keys = refs.map(typedRefKey);
  if (
    new Set(keys).size !== keys.length ||
    canonicalReferenceJson(keys) !== canonicalReferenceJson([...keys].sort(compareCodePoints))
  ) {
    throw new TypeError(`Typed Knowledge ${label} must be unique and canonically sorted`);
  }
}

function assertUniqueSortedRefs(refs: readonly ReferenceRecordRef[], label: string): void {
  const keys = refs.map(refKey);
  if (
    new Set(keys).size !== keys.length ||
    canonicalReferenceJson(keys) !== canonicalReferenceJson([...keys].sort(compareCodePoints))
  ) {
    throw new TypeError(`Typed Knowledge ${label} must be unique and canonically sorted`);
  }
}

function assertUniqueSortedStrings(values: readonly string[], label: string): void {
  if (
    new Set(values).size !== values.length ||
    canonicalReferenceJson(values) !== canonicalReferenceJson([...values].sort(compareCodePoints))
  ) {
    throw new TypeError(`Typed Knowledge ${label} must be unique and canonically sorted`);
  }
}

function assertUniqueSortedSubjectFacets(
  values: readonly ReferenceAuthoritySubjectFacetRequirement[]
): void {
  const keys = values.map(subjectFacetKey);
  if (
    new Set(keys).size !== keys.length ||
    canonicalReferenceJson(keys) !== canonicalReferenceJson([...keys].sort(compareCodePoints))
  ) {
    throw new TypeError(
      "Typed Knowledge subject-facet requirements must be unique and canonically sorted"
    );
  }
}

function sameRefSet(left: readonly ReferenceRecordRef[], right: readonly ReferenceRecordRef[]) {
  return (
    canonicalReferenceJson(left.map(refKey).sort(compareCodePoints)) ===
    canonicalReferenceJson(right.map(refKey).sort(compareCodePoints))
  );
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return (
    canonicalReferenceJson([...left].sort(compareCodePoints)) ===
    canonicalReferenceJson([...right].sort(compareCodePoints))
  );
}

function sameSubjectFacetSet(
  left: readonly ReferenceAuthoritySubjectFacetRequirement[],
  right: readonly ReferenceAuthoritySubjectFacetRequirement[]
) {
  return (
    canonicalReferenceJson(left.map(subjectFacetKey).sort(compareCodePoints)) ===
    canonicalReferenceJson(right.map(subjectFacetKey).sort(compareCodePoints))
  );
}

function refsEqual(left: ReferenceRecordRef, right: ReferenceRecordRef): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function bareRef(value: ReferenceRecordRef): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function refKey(value: ReferenceRecordRef): string {
  return `${value.id}\u0000${value.digest}`;
}

function typedRefKey(value: ReferenceRecordRef & { recordKind: string }): string {
  return `${value.recordKind}\u0000${refKey(value)}`;
}

function subjectFacetKey(value: ReferenceAuthoritySubjectFacetRequirement): string {
  return `${refKey(value.subjectRef)}\u0000${value.facet}`;
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
