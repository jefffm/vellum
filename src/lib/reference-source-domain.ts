import { createHash } from "node:crypto";

import { Type, type Static } from "@sinclair/typebox";

const Strict = { additionalProperties: false } as const;
const IdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const VersionSchema = Type.Integer({ minimum: 1 });
const RevisionSchema = Type.Integer({ minimum: 0 });
const Sha256Schema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const DigestSchema = Sha256Schema;
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
});

export const ReferenceRecordRefSchema = Type.Object({ id: IdSchema, digest: DigestSchema }, Strict);
export type ReferenceRecordRef = Static<typeof ReferenceRecordRefSchema>;

export const VersionedReferenceRecordRefSchema = Type.Object(
  { id: IdSchema, version: VersionSchema, digest: DigestSchema },
  Strict
);
export type VersionedReferenceRecordRef = Static<typeof VersionedReferenceRecordRefSchema>;

export const ReferenceIdentityConfidenceSchema = Type.Union([
  Type.Object({ kind: Type.Literal("unknown") }, Strict),
  Type.Object(
    {
      kind: Type.Literal("assessed"),
      value: Type.Number({ minimum: 0, maximum: 1 }),
      basis: Type.String({ minLength: 1 }),
      evidenceRefs: Type.Array(ReferenceRecordRefSchema),
    },
    Strict
  ),
]);
export type ReferenceIdentityConfidence = Static<typeof ReferenceIdentityConfidenceSchema>;

export const ReferenceClaimantSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("owner"),
      Type.Literal("provider"),
      Type.Literal("catalog"),
      Type.Literal("importer"),
      Type.Literal("reviewer"),
      Type.Literal("system"),
    ]),
    claimantRef: ReferenceRecordRefSchema,
  },
  Strict
);
export type ReferenceClaimant = Static<typeof ReferenceClaimantSchema>;

const DateRangeSchema = Type.Object(
  {
    start: Type.Optional(Type.String({ minLength: 1 })),
    end: Type.Optional(Type.String({ minLength: 1 })),
    display: Type.Optional(Type.String({ minLength: 1 })),
  },
  Strict
);

export const ReferenceIdentityValueSchema = Type.Union([
  Type.Object({ kind: Type.Literal("unknown"), reason: Type.String({ minLength: 1 }) }, Strict),
  Type.Object({ kind: Type.Literal("text"), value: Type.String({ minLength: 1 }) }, Strict),
  Type.Object({ kind: Type.Literal("date_range"), value: DateRangeSchema }, Strict),
  Type.Object({ kind: Type.Literal("entity_ref"), value: ReferenceRecordRefSchema }, Strict),
  Type.Object(
    {
      kind: Type.Literal("entity_refs"),
      values: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    },
    Strict
  ),
  Type.Object(
    {
      kind: Type.Literal("classification"),
      vocabulary: Type.String({ minLength: 1 }),
      term: Type.String({ minLength: 1 }),
    },
    Strict
  ),
]);
export type ReferenceIdentityValue = Static<typeof ReferenceIdentityValueSchema>;

export const ReferenceSourceIdentityAssertionSchema = Type.Object(
  {
    recordKind: Type.Literal("identity_assertion"),
    id: IdSchema,
    version: VersionSchema,
    parentVersionRef: Type.Optional(VersionedReferenceRecordRefSchema),
    subjectRef: ReferenceRecordRefSchema,
    subjectKind: Type.Union([
      Type.Literal("work"),
      Type.Literal("source_manifestation"),
      Type.Literal("exemplar"),
      Type.Literal("digital_asset"),
      Type.Literal("asset_acquisition"),
    ]),
    property: Type.String({ minLength: 1 }),
    assertedValue: ReferenceIdentityValueSchema,
    claimant: ReferenceClaimantSchema,
    evidenceRefs: Type.Array(ReferenceRecordRefSchema),
    confidence: ReferenceIdentityConfidenceSchema,
    completeness: Type.Union([
      Type.Literal("complete"),
      Type.Literal("incomplete"),
      Type.Literal("unknown"),
    ]),
    composition: Type.Union([Type.Literal("atomic"), Type.Literal("composite")]),
    componentAssertionRefs: Type.Array(ReferenceRecordRefSchema),
    assertionState: Type.Union([
      Type.Literal("candidate"),
      Type.Literal("reviewed"),
      Type.Literal("disputed"),
      Type.Literal("rejected"),
    ]),
    predecessorAssertionRefs: Type.Array(ReferenceRecordRefSchema),
    successorRelationship: Type.Union([
      Type.Literal("initial"),
      Type.Literal("correction"),
      Type.Literal("refinement"),
      Type.Literal("supersession"),
    ]),
    conflictAssertionRefs: Type.Array(ReferenceRecordRefSchema),
    assertedAt: IsoTimestampSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceSourceIdentityAssertion = Static<
  typeof ReferenceSourceIdentityAssertionSchema
>;

const BibliographicIdentityStateSchema = Type.Union([
  Type.Literal("incomplete"),
  Type.Literal("candidate"),
  Type.Literal("reviewed"),
  Type.Literal("disputed"),
]);

export const ReferenceWorkSchema = Type.Object(
  {
    recordKind: Type.Literal("work"),
    id: IdSchema,
    version: VersionSchema,
    parentVersionRef: Type.Optional(VersionedReferenceRecordRefSchema),
    preferredTitle: Type.Optional(Type.String({ minLength: 1 })),
    creatorIdentityRefs: Type.Array(ReferenceRecordRefSchema),
    workDate: Type.Optional(DateRangeSchema),
    identityAssertionRefs: Type.Array(ReferenceRecordRefSchema),
    identityState: BibliographicIdentityStateSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceWork = Static<typeof ReferenceWorkSchema>;

const WorkRelationSchema = Type.Object(
  {
    workRef: ReferenceRecordRefSchema,
    role: Type.Union([
      Type.Literal("contains"),
      Type.Literal("edition_of"),
      Type.Literal("excerpt_of"),
    ]),
  },
  Strict
);

const ManifestationRelationSchema = Type.Object(
  {
    manifestationRef: ReferenceRecordRefSchema,
    role: Type.Union([
      Type.Literal("part_of"),
      Type.Literal("bound_with"),
      Type.Literal("supplement_to"),
    ]),
  },
  Strict
);

export const ReferenceSourceManifestationSchema = Type.Object(
  {
    recordKind: Type.Literal("source_manifestation"),
    id: IdSchema,
    version: VersionSchema,
    parentVersionRef: Type.Optional(VersionedReferenceRecordRefSchema),
    manifestationKind: Type.Union([
      Type.Literal("edition"),
      Type.Literal("issue"),
      Type.Literal("volume"),
      Type.Literal("part"),
      Type.Literal("manuscript"),
      Type.Literal("compilation"),
    ]),
    workRelations: Type.Array(WorkRelationSchema),
    parentRelations: Type.Array(ManifestationRelationSchema),
    publicationDate: Type.Optional(DateRangeSchema),
    publicationStatement: Type.Optional(Type.String({ minLength: 1 })),
    languages: Type.Array(Type.String({ minLength: 1 })),
    editorIdentityRefs: Type.Array(ReferenceRecordRefSchema),
    translatorIdentityRefs: Type.Array(ReferenceRecordRefSchema),
    declaredChanges: Type.Array(Type.String({ minLength: 1 })),
    identityAssertionRefs: Type.Array(ReferenceRecordRefSchema),
    identityState: BibliographicIdentityStateSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceSourceManifestation = Static<typeof ReferenceSourceManifestationSchema>;

export const ReferenceExemplarSchema = Type.Object(
  {
    recordKind: Type.Literal("exemplar"),
    id: IdSchema,
    version: VersionSchema,
    parentVersionRef: Type.Optional(VersionedReferenceRecordRefSchema),
    manifestationRefs: Type.Array(ReferenceRecordRefSchema),
    holdingInstitution: Type.Optional(Type.String({ minLength: 1 })),
    shelfmark: Type.Optional(Type.String({ minLength: 1 })),
    completeness: Type.Union([
      Type.Literal("complete"),
      Type.Literal("incomplete"),
      Type.Literal("unknown"),
    ]),
    exemplarNotes: Type.Array(Type.String({ minLength: 1 })),
    identityAssertionRefs: Type.Array(ReferenceRecordRefSchema),
    identityState: BibliographicIdentityStateSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceExemplar = Static<typeof ReferenceExemplarSchema>;

export const ReferenceDigitalAssetSchema = Type.Object(
  {
    recordKind: Type.Literal("digital_asset"),
    id: IdSchema,
    sha256: Sha256Schema,
    mediaType: Type.String({ minLength: 1 }),
    byteLength: Type.Integer({ minimum: 0 }),
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceDigitalAsset = Static<typeof ReferenceDigitalAssetSchema>;

const RedactedRetrievalUriSchema = Type.String({
  pattern: "^urn:vellum:redacted-retrieval:[A-Za-z0-9][A-Za-z0-9._~-]*$",
});

/**
 * Acquisition provenance is deliberately discriminated. A source kind cannot
 * be asserted without the minimum durable evidence needed to identify that
 * exact acquisition, and URL-bearing origins retain only a non-resolving
 * redacted locator in this graph.
 */
export const ReferenceAcquisitionOriginSchema = Type.Union([
  Type.Object(
    {
      sourceKind: Type.Literal("upload"),
      ownerActionRef: ReferenceRecordRefSchema,
    },
    Strict
  ),
  Type.Object(
    {
      sourceKind: Type.Literal("private_scan"),
      ownerActionRef: ReferenceRecordRefSchema,
    },
    Strict
  ),
  Type.Object(
    {
      sourceKind: Type.Literal("stable_url"),
      providerRef: ReferenceRecordRefSchema,
      providerObjectId: Type.String({ minLength: 1 }),
      redactedRetrievalUri: RedactedRetrievalUriSchema,
    },
    Strict
  ),
  Type.Object(
    {
      sourceKind: Type.Literal("iiif"),
      providerRef: ReferenceRecordRefSchema,
      providerObjectId: Type.String({ minLength: 1 }),
      redactedRetrievalUri: RedactedRetrievalUriSchema,
    },
    Strict
  ),
  Type.Object(
    {
      sourceKind: Type.Literal("library_object"),
      providerRef: ReferenceRecordRefSchema,
      providerObjectId: Type.String({ minLength: 1 }),
    },
    Strict
  ),
]);
export type ReferenceAcquisitionOrigin = Static<typeof ReferenceAcquisitionOriginSchema>;

export const ReferenceAssetAcquisitionSchema = Type.Object(
  {
    recordKind: Type.Literal("asset_acquisition"),
    id: IdSchema,
    digitalAssetRef: ReferenceRecordRefSchema,
    representedExemplarRefs: Type.Array(ReferenceRecordRefSchema),
    origin: ReferenceAcquisitionOriginSchema,
    acquiredAt: IsoTimestampSchema,
    rightsAssertionRefs: Type.Array(ReferenceRecordRefSchema),
    processingPolicyRef: ReferenceRecordRefSchema,
    supersedesAcquisitionRef: Type.Optional(ReferenceRecordRefSchema),
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceAssetAcquisition = Static<typeof ReferenceAssetAcquisitionSchema>;

const DerivationKindSchema = Type.Union([
  Type.Literal("segment"),
  Type.Literal("crop"),
  Type.Literal("extraction"),
  Type.Literal("transcription"),
  Type.Literal("translation"),
  Type.Literal("candidate"),
  Type.Literal("pack_entry"),
  Type.Literal("fixture"),
  Type.Literal("prompt"),
  Type.Literal("report"),
  Type.Literal("log"),
  Type.Literal("export"),
  Type.Literal("other"),
]);

export const ReferenceSourceDerivationSchema = Type.Object(
  {
    recordKind: Type.Literal("source_derivation"),
    id: IdSchema,
    derivationKind: DerivationKindSchema,
    inputRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    sourceAcquisitionRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    sourceDerivationRefs: Type.Array(ReferenceRecordRefSchema),
    derivedRef: ReferenceRecordRefSchema,
    componentRef: ReferenceRecordRefSchema,
    configurationDigest: DigestSchema,
    createdAt: IsoTimestampSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceSourceDerivation = Static<typeof ReferenceSourceDerivationSchema>;

const PageTransformSchema = Type.Object(
  {
    kind: Type.Union([Type.Literal("identity"), Type.Literal("affine"), Type.Literal("crop")]),
    matrix: Type.Array(Type.Number(), { minItems: 6, maxItems: 6 }),
  },
  Strict
);

const PageRegionSchema = Type.Object(
  {
    id: IdSchema,
    x: Type.Number(),
    y: Type.Number(),
    width: Type.Number({ exclusiveMinimum: 0 }),
    height: Type.Number({ exclusiveMinimum: 0 }),
    unit: Type.Union([Type.Literal("pixel"), Type.Literal("normalized")]),
  },
  Strict
);

export const ReferenceSourceSegmentVersionSchema = Type.Object(
  {
    recordKind: Type.Literal("source_segment_version"),
    id: IdSchema,
    version: VersionSchema,
    parentVersionRef: Type.Optional(VersionedReferenceRecordRefSchema),
    digitalAssetRef: ReferenceRecordRefSchema,
    acquisitionRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    provenancePathRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    pageAtlasRef: ReferenceRecordRefSchema,
    canvasId: IdSchema,
    printedLocator: Type.Optional(Type.String({ minLength: 1 })),
    scanLocator: Type.String({ minLength: 1 }),
    coordinateSystem: Type.String({ minLength: 1 }),
    regionTransforms: Type.Array(PageTransformSchema),
    regions: Type.Array(PageRegionSchema, { minItems: 1 }),
    musicalRange: Type.Optional(Type.String({ minLength: 1 })),
    modality: Type.Union([
      Type.Literal("text"),
      Type.Literal("image"),
      Type.Literal("notation"),
      Type.Literal("mixed"),
    ]),
    sourceImageRef: ReferenceRecordRefSchema,
    cropDigest: DigestSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceSourceSegmentVersion = Static<typeof ReferenceSourceSegmentVersionSchema>;

const RightsSubjectKindSchema = Type.Union([
  Type.Literal("work"),
  Type.Literal("source_manifestation"),
  Type.Literal("exemplar"),
  Type.Literal("digital_asset"),
  Type.Literal("asset_acquisition"),
  Type.Literal("source_derivation"),
  Type.Literal("source_segment_version"),
]);

export const ReferenceRightsAssertionSchema = Type.Object(
  {
    recordKind: Type.Literal("rights_assertion"),
    id: IdSchema,
    version: VersionSchema,
    parentVersionRef: Type.Optional(VersionedReferenceRecordRefSchema),
    subjectRef: ReferenceRecordRefSchema,
    subjectKind: RightsSubjectKindSchema,
    rightsKind: Type.Union([
      Type.Literal("underlying_work_status"),
      Type.Literal("manifestation_editorial"),
      Type.Literal("translation"),
      Type.Literal("exemplar_restriction"),
      Type.Literal("scan_provider_terms"),
      Type.Literal("owner_private_access"),
      Type.Literal("local_extraction"),
      Type.Literal("named_provider_processing"),
      Type.Literal("pack_citation_excerpt"),
      Type.Literal("export_redistribution"),
      Type.Literal("attribution"),
    ]),
    status: Type.Union([
      Type.Literal("public_domain"),
      Type.Literal("licensed"),
      Type.Literal("permitted"),
      Type.Literal("restricted"),
      Type.Literal("unknown"),
      Type.Literal("conflicting"),
      Type.Literal("not_applicable"),
    ]),
    claimant: ReferenceClaimantSchema,
    jurisdiction: Type.Optional(Type.String({ minLength: 1 })),
    evidenceRefs: Type.Array(ReferenceRecordRefSchema),
    validFrom: Type.Optional(IsoTimestampSchema),
    validUntil: Type.Optional(IsoTimestampSchema),
    assertedAt: IsoTimestampSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceRightsAssertion = Static<typeof ReferenceRightsAssertionSchema>;

export const ReferenceAccessOperationSchema = Type.Union([
  Type.Literal("underlying_work_use"),
  Type.Literal("manifestation_use"),
  Type.Literal("exemplar_access"),
  Type.Literal("scan_provider_use"),
  Type.Literal("owner_private_study"),
  Type.Literal("local_extraction"),
  Type.Literal("provider_ocr"),
  Type.Literal("provider_omr"),
  Type.Literal("provider_translation"),
  Type.Literal("provider_model_processing"),
  Type.Literal("pack_citation"),
  Type.Literal("pack_excerpt"),
  Type.Literal("fixture_inclusion"),
  Type.Literal("repository_inclusion"),
  Type.Literal("export"),
  Type.Literal("redistribution"),
]);
export type ReferenceAccessOperation = Static<typeof ReferenceAccessOperationSchema>;

export const ReferenceAccessDestinationSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("local_runtime"),
      Type.Literal("provider"),
      Type.Literal("repository"),
      Type.Literal("export"),
      Type.Literal("recipient"),
    ]),
    id: Type.Optional(Type.String({ minLength: 1 })),
  },
  Strict
);
export type ReferenceAccessDestination = Static<typeof ReferenceAccessDestinationSchema>;

export const ReferenceAssetRoleSchema = Type.Union([
  Type.Literal("arrangement_source"),
  Type.Literal("owner_reference"),
  Type.Literal("evaluation_source"),
]);
export type ReferenceAssetRole = Static<typeof ReferenceAssetRoleSchema>;

export const ReferenceAccessDecisionSchema = Type.Object(
  {
    recordKind: Type.Literal("access_decision"),
    id: IdSchema,
    version: VersionSchema,
    parentVersionRef: Type.Optional(VersionedReferenceRecordRefSchema),
    outcome: Type.Union([
      Type.Literal("allow"),
      Type.Literal("deny"),
      Type.Literal("review_required"),
    ]),
    operation: ReferenceAccessOperationSchema,
    sourceRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    derivativeRefs: Type.Array(ReferenceRecordRefSchema),
    destination: ReferenceAccessDestinationSchema,
    purpose: Type.String({ minLength: 1 }),
    assetRole: Type.Optional(ReferenceAssetRoleSchema),
    policyRef: ReferenceRecordRefSchema,
    rightsAssertionRefs: Type.Array(ReferenceRecordRefSchema),
    authorityRefs: Type.Array(ReferenceRecordRefSchema),
    rationale: Type.String({ minLength: 1 }),
    decidedAt: IsoTimestampSchema,
    validUntil: Type.Optional(IsoTimestampSchema),
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceAccessDecision = Static<typeof ReferenceAccessDecisionSchema>;

export const ReferenceLifecycleReplayabilitySchema = Type.Union([
  Type.Literal("complete"),
  Type.Literal("partial"),
  Type.Literal("unavailable"),
  Type.Literal("legacy_unverifiable"),
]);
export type ReferenceLifecycleReplayability = Static<typeof ReferenceLifecycleReplayabilitySchema>;

export const ReferenceLifecycleReadinessRequirementSchema = Type.Union([
  Type.Literal("required"),
  Type.Literal("advisory"),
  Type.Literal("none"),
]);
export type ReferenceLifecycleReadinessRequirement = Static<
  typeof ReferenceLifecycleReadinessRequirementSchema
>;

export const ReferenceLifecycleStorageSubjectKindSchema = Type.Union([
  Type.Literal("asset_bytes"),
  Type.Literal("segment"),
  Type.Literal("crop"),
  Type.Literal("extraction"),
  Type.Literal("transcription"),
  Type.Literal("translation"),
  Type.Literal("candidate"),
  Type.Literal("pack_entry"),
  Type.Literal("fixture"),
  Type.Literal("prompt"),
  Type.Literal("release"),
  Type.Literal("arrangement"),
  Type.Literal("evaluation"),
  Type.Literal("report"),
  Type.Literal("log"),
  Type.Literal("cache"),
  Type.Literal("backup"),
  Type.Literal("managed_export"),
  Type.Literal("unmanaged_disclosure"),
  Type.Literal("provider_payload"),
  Type.Literal("provider_result"),
  Type.Literal("other_derivative"),
]);
export type ReferenceLifecycleStorageSubjectKind = Static<
  typeof ReferenceLifecycleStorageSubjectKindSchema
>;

export const ReferenceLifecycleProvenancePathSchema = Type.Object(
  {
    acquisitionRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    derivationRefs: Type.Array(ReferenceRecordRefSchema),
    roleBindingRefs: Type.Optional(Type.Array(ReferenceRecordRefSchema)),
  },
  Strict
);
export type ReferenceLifecycleProvenancePath = Static<
  typeof ReferenceLifecycleProvenancePathSchema
>;

export const ReferenceLifecycleAuthorizedPathSchema = Type.Object(
  {
    acquisitionRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    derivationRefs: Type.Array(ReferenceRecordRefSchema),
    accessDecisionRef: ReferenceRecordRefSchema,
    roleBindingRef: Type.Optional(ReferenceRecordRefSchema),
  },
  Strict
);
export type ReferenceLifecycleAuthorizedPath = Static<
  typeof ReferenceLifecycleAuthorizedPathSchema
>;

const ReferenceLifecycleControlledCustodySchema = Type.Object(
  {
    kind: Type.Literal("vellum_controlled"),
    storeIds: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    retention: Type.Union([
      Type.Literal("unretained"),
      Type.Literal("encrypted_local_pin"),
      Type.Literal("required_hold"),
    ]),
    tombstonePolicy: Type.Union([Type.Literal("preserve"), Type.Literal("discard")]),
  },
  Strict
);

const ReferenceLifecycleUnmanagedCustodySchema = Type.Object(
  {
    kind: Type.Literal("unmanaged_recipient"),
    recipientRef: ReferenceRecordRefSchema,
    disclosureAccessDecisionRef: ReferenceRecordRefSchema,
    disclosedAt: IsoTimestampSchema,
    tombstonePolicy: Type.Literal("preserve"),
  },
  Strict
);

export const ReferenceLifecycleStoragePolicySchema = Type.Object(
  {
    recordKind: Type.Literal("lifecycle_storage_policy"),
    id: IdSchema,
    version: VersionSchema,
    parentVersionRef: Type.Optional(VersionedReferenceRecordRefSchema),
    subjectRef: ReferenceRecordRefSchema,
    subjectKind: ReferenceLifecycleStorageSubjectKindSchema,
    provenancePaths: Type.Array(ReferenceLifecycleProvenancePathSchema, { minItems: 1 }),
    policyRef: ReferenceRecordRefSchema,
    custody: Type.Union([
      ReferenceLifecycleControlledCustodySchema,
      ReferenceLifecycleUnmanagedCustodySchema,
    ]),
    replayRequirement: Type.Union([
      Type.Literal("required"),
      Type.Literal("optional"),
      Type.Literal("none"),
    ]),
    readinessRequirement: ReferenceLifecycleReadinessRequirementSchema,
    createdAt: IsoTimestampSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceLifecycleStoragePolicy = Static<typeof ReferenceLifecycleStoragePolicySchema>;

export const ReferenceLifecycleUseSchema = Type.Object(
  {
    recordKind: Type.Literal("lifecycle_use"),
    id: IdSchema,
    version: VersionSchema,
    parentVersionRef: Type.Optional(VersionedReferenceRecordRefSchema),
    subjectRef: ReferenceRecordRefSchema,
    provenancePaths: Type.Array(ReferenceLifecycleAuthorizedPathSchema, { minItems: 1 }),
    operation: ReferenceAccessOperationSchema,
    destination: ReferenceAccessDestinationSchema,
    purpose: Type.String({ minLength: 1 }),
    assetRole: Type.Optional(ReferenceAssetRoleSchema),
    policyRef: ReferenceRecordRefSchema,
    baselineReplayability: ReferenceLifecycleReplayabilitySchema,
    readinessRequirement: ReferenceLifecycleReadinessRequirementSchema,
    createdAt: IsoTimestampSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceLifecycleUse = Static<typeof ReferenceLifecycleUseSchema>;

const RoleBindingCommon = {
  id: IdSchema,
  digitalAssetRef: ReferenceRecordRefSchema,
  acquisitionRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
  accessDecisionRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
  retentionPolicyRef: ReferenceRecordRefSchema,
  createdAt: IsoTimestampSchema,
  digest: DigestSchema,
};

export const ArrangementSourceBindingSchema = Type.Object(
  {
    recordKind: Type.Literal("arrangement_source_binding"),
    ...RoleBindingCommon,
    workspaceRef: ReferenceRecordRefSchema,
  },
  Strict
);
export type ArrangementSourceBinding = Static<typeof ArrangementSourceBindingSchema>;

export const OwnerReferenceBindingSchema = Type.Object(
  {
    recordKind: Type.Literal("owner_reference_binding"),
    ...RoleBindingCommon,
    ownerLibraryRef: ReferenceRecordRefSchema,
  },
  Strict
);
export type OwnerReferenceBinding = Static<typeof OwnerReferenceBindingSchema>;

export const EvaluationSourceBindingSchema = Type.Object(
  {
    recordKind: Type.Literal("evaluation_source_binding"),
    ...RoleBindingCommon,
    evaluationContext: Type.Object(
      {
        kind: Type.Literal("disclosed_development_fixture"),
        evaluationFixtureRef: ReferenceRecordRefSchema,
      },
      Strict
    ),
  },
  Strict
);

export type EvaluationSourceBinding = Static<typeof EvaluationSourceBindingSchema>;

export const ReferenceEvaluationSourceBindingCommitmentSchema = Type.Object(
  {
    recordKind: Type.Literal("evaluation_source_binding_commitment"),
    id: IdSchema,
    evaluationContext: Type.Object(
      {
        kind: Type.Literal("vault_commitment"),
        algorithm: Type.Literal("hmac-sha256"),
        keyId: Type.String({ minLength: 1 }),
        commitment: DigestSchema,
      },
      Strict
    ),
    createdAt: IsoTimestampSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceEvaluationSourceBindingCommitment = Static<
  typeof ReferenceEvaluationSourceBindingCommitmentSchema
>;

export const ReferenceAssetRoleBindingSchema = Type.Union([
  ArrangementSourceBindingSchema,
  OwnerReferenceBindingSchema,
  EvaluationSourceBindingSchema,
]);
export type ReferenceAssetRoleBinding = Static<typeof ReferenceAssetRoleBindingSchema>;

export const ReferenceIdentityRedirectSchema = Type.Object(
  {
    recordKind: Type.Literal("identity_redirect"),
    id: IdSchema,
    redirectKind: Type.Union([
      Type.Literal("alias"),
      Type.Literal("merge"),
      Type.Literal("split"),
      Type.Literal("supersession"),
    ]),
    fromRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    toRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    evidenceRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    decidedByRef: ReferenceRecordRefSchema,
    decidedAt: IsoTimestampSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceIdentityRedirect = Static<typeof ReferenceIdentityRedirectSchema>;

const ProvenanceEndpointSchema = Type.Object(
  {
    acquisitionRef: ReferenceRecordRefSchema,
    derivationRef: ReferenceRecordRefSchema,
  },
  Strict
);

const ProvenanceSubstitutionScopeSchema = Type.Object(
  {
    operation: ReferenceAccessOperationSchema,
    sourceAndDerivativeRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    destination: ReferenceAccessDestinationSchema,
    purpose: Type.String({ minLength: 1 }),
    policyRef: ReferenceRecordRefSchema,
  },
  Strict
);

export const ReferenceProvenanceSubstitutionSchema = Type.Object(
  {
    recordKind: Type.Literal("provenance_substitution"),
    id: IdSchema,
    from: ProvenanceEndpointSchema,
    to: ProvenanceEndpointSchema,
    scope: ProvenanceSubstitutionScopeSchema,
    accessDecisionRef: ReferenceRecordRefSchema,
    roleBindingRef: Type.Optional(ReferenceRecordRefSchema),
    authority: Type.Object(
      {
        kind: Type.Union([
          Type.Literal("owner"),
          Type.Literal("rights_reviewer"),
          Type.Literal("policy"),
        ]),
        authorityRef: ReferenceRecordRefSchema,
        evidenceRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
      },
      Strict
    ),
    rationale: Type.String({ minLength: 1 }),
    decidedAt: IsoTimestampSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceProvenanceSubstitution = Static<typeof ReferenceProvenanceSubstitutionSchema>;

export const ReferenceDependencyScopeSchema = Type.Union([
  Type.Literal("identity"),
  Type.Literal("rights"),
  Type.Literal("access"),
  Type.Literal("provenance"),
  Type.Literal("content"),
  Type.Literal("publication"),
]);
export type ReferenceDependencyScope = Static<typeof ReferenceDependencyScopeSchema>;

export const ReferenceDependencyEdgeSchema = Type.Object(
  {
    recordKind: Type.Literal("dependency_edge"),
    id: IdSchema,
    dependencyRef: ReferenceRecordRefSchema,
    dependentRef: ReferenceRecordRefSchema,
    scope: ReferenceDependencyScopeSchema,
    reason: Type.String({ minLength: 1 }),
    createdAt: IsoTimestampSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceDependencyEdge = Static<typeof ReferenceDependencyEdgeSchema>;

export const ReferenceInvalidationSchema = Type.Object(
  {
    recordKind: Type.Literal("invalidation"),
    id: IdSchema,
    triggerRef: ReferenceRecordRefSchema,
    invalidatedRef: ReferenceRecordRefSchema,
    dependencyEdgeRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    dependencyPath: Type.Array(ReferenceRecordRefSchema, { minItems: 2 }),
    scope: ReferenceDependencyScopeSchema,
    reason: Type.String({ minLength: 1 }),
    replacementRef: Type.Optional(ReferenceRecordRefSchema),
    invalidatedAt: IsoTimestampSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceInvalidation = Static<typeof ReferenceInvalidationSchema>;

const ReferenceSourceStagingInputRecordSchemas = [
  ReferenceSourceIdentityAssertionSchema,
  ReferenceWorkSchema,
  ReferenceSourceManifestationSchema,
  ReferenceExemplarSchema,
  ReferenceDigitalAssetSchema,
  ReferenceAssetAcquisitionSchema,
  ReferenceSourceDerivationSchema,
  ReferenceSourceSegmentVersionSchema,
  ReferenceRightsAssertionSchema,
  ReferenceAccessDecisionSchema,
  ReferenceLifecycleStoragePolicySchema,
  ReferenceLifecycleUseSchema,
  ArrangementSourceBindingSchema,
  OwnerReferenceBindingSchema,
  EvaluationSourceBindingSchema,
  ReferenceEvaluationSourceBindingCommitmentSchema,
  ReferenceIdentityRedirectSchema,
  ReferenceProvenanceSubstitutionSchema,
  ReferenceDependencyEdgeSchema,
] as const;

export const ReferenceSourceStagingInputRecordSchema = Type.Union([
  ...ReferenceSourceStagingInputRecordSchemas,
]);
export type ReferenceSourceStagingInputRecord = Static<
  typeof ReferenceSourceStagingInputRecordSchema
>;

export const ReferenceSourceStagingRecordSchema = Type.Union([
  ...ReferenceSourceStagingInputRecordSchemas,
  ReferenceInvalidationSchema,
]);
export type ReferenceSourceStagingRecord = Static<typeof ReferenceSourceStagingRecordSchema>;

export const ReferenceSourceStagingOperationSchema = Type.Object(
  {
    type: Type.Literal("append_record"),
    record: ReferenceSourceStagingInputRecordSchema,
  },
  Strict
);
export type ReferenceSourceStagingOperation = Static<typeof ReferenceSourceStagingOperationSchema>;

export const ReferenceSourceStagingTransactionSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    expectedHeadRef: Type.Optional(ReferenceRecordRefSchema),
    operations: Type.Array(ReferenceSourceStagingOperationSchema, { minItems: 1 }),
    submittedAt: IsoTimestampSchema,
  },
  Strict
);
export type ReferenceSourceStagingTransaction = Static<
  typeof ReferenceSourceStagingTransactionSchema
>;

/**
 * Server-minted first-observation metadata. Client-authored event timestamps
 * remain useful documentary claims, but lifecycle ordering is derived only
 * from this snapshot-bound append generation.
 */
export const ReferenceSourceRecordObservationSchema = Type.Object(
  {
    recordRef: ReferenceRecordRefSchema,
    firstObservedRevision: Type.Integer({ minimum: 1 }),
    observedAt: IsoTimestampSchema,
    // Optional on the wire solely so snapshots written before observation-trust
    // metadata remain readable by the explicit migration path. Every new or
    // migrated snapshot writes this field, and missing values never authorize
    // lifecycle ordering.
    orderingTrust: Type.Optional(
      Type.Union([Type.Literal("server_observed"), Type.Literal("legacy_unverifiable")])
    ),
  },
  Strict
);
export type ReferenceSourceRecordObservation = Static<
  typeof ReferenceSourceRecordObservationSchema
>;

export const ReferenceSourceStagingSnapshotSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    revision: RevisionSchema,
    parentSnapshotRef: Type.Optional(ReferenceRecordRefSchema),
    publicationState: Type.Literal("staging_only"),
    createdAt: IsoTimestampSchema,
    recordObservations: Type.Optional(Type.Array(ReferenceSourceRecordObservationSchema)),
    records: Type.Array(ReferenceSourceStagingRecordSchema),
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceSourceStagingSnapshot = Static<typeof ReferenceSourceStagingSnapshotSchema>;

/** Canonical JSON for source-graph identities. Arrays retain their declared order. */
export function canonicalReferenceJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/** SHA-256 over the canonical JSON representation. */
export function referenceSourceDigest(value: unknown): string {
  return createHash("sha256").update(canonicalReferenceJson(value)).digest("hex");
}

/**
 * Add a digest to a new immutable record. An existing digest is ignored so callers
 * cannot make a self-referential digest or preserve a stale value accidentally.
 */
export function withReferenceRecordDigest<T extends Record<string, unknown>>(
  value: T
): Readonly<Omit<T, "digest"> & { digest: string }> {
  const core = omitDigest(structuredClone(value));
  return deepFreeze({ ...core, digest: referenceSourceDigest(core) });
}

/** Verify an immutable record or snapshot against its canonical core bytes. */
export function verifyReferenceRecordDigest(value: unknown): boolean {
  if (
    !isPlainObject(value) ||
    typeof value.digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.digest)
  ) {
    return false;
  }
  try {
    return referenceSourceDigest(omitDigest(value)) === value.digest;
  } catch {
    return false;
  }
}

function omitDigest<T extends Record<string, unknown>>(value: T): Omit<T, "digest"> {
  const { digest: _digest, ...core } = value;
  return core;
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Reference-source values must be finite");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) {
    throw new TypeError("Reference-source values must be plain JSON values");
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => {
        const child = value[key];
        if (child === undefined) {
          throw new TypeError("Reference-source values cannot contain undefined");
        }
        return [key, canonicalize(child)];
      })
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
