import { Type, type Static } from "@sinclair/typebox";

import {
  ReferenceAssetAcquisitionSchema,
  ReferenceDigitalAssetSchema,
  ReferenceRecordRefSchema,
} from "./reference-source-domain.js";

const Strict = { additionalProperties: false } as const;
const SafeIdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
});

export const OwnerReferenceMigrationRecordKindSchema = Type.Union([
  Type.Literal("owner_reference_migration_mapping"),
  Type.Literal("owner_reference_migration_quarantine"),
  Type.Literal("owner_reference_migration_journal"),
]);
export type OwnerReferenceMigrationRecordKind = Static<
  typeof OwnerReferenceMigrationRecordKindSchema
>;

export const LegacyOwnerReferenceIdentityDispositionSchema = Type.Union([
  Type.Literal("asset_only"),
  Type.Literal("incomplete"),
  Type.Literal("composite"),
]);
export type LegacyOwnerReferenceIdentityDisposition = Static<
  typeof LegacyOwnerReferenceIdentityDispositionSchema
>;

export const LegacyOwnerReferenceSnapshotSchema = Type.Object(
  {
    id: SafeIdSchema,
    title: Type.String({ minLength: 1 }),
    citation: Type.String({ minLength: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    sha256: DigestSchema,
    byteLength: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    createdAt: IsoTimestampSchema,
    rawRecordSha256: DigestSchema,
    rawRecordByteLength: Type.Integer({ minimum: 1 }),
  },
  Strict
);
export type LegacyOwnerReferenceSnapshot = Static<typeof LegacyOwnerReferenceSnapshotSchema>;

export const OwnerReferenceByteVerificationSchema = Type.Object(
  {
    declaredSha256: DigestSchema,
    observedSha256: DigestSchema,
    targetSha256: DigestSchema,
    declaredByteLength: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    observedByteLength: Type.Integer({ minimum: 1 }),
    targetByteLength: Type.Integer({ minimum: 1 }),
    exact: Type.Literal(true),
  },
  Strict
);
export type OwnerReferenceByteVerification = Static<typeof OwnerReferenceByteVerificationSchema>;

export const OwnerReferenceMigrationEvidenceRefSchema = Type.Object(
  {
    kind: Type.Union([Type.Literal("legacy_record"), Type.Literal("observed_content")]),
    sha256: DigestSchema,
    byteLength: Type.Integer({ minimum: 1 }),
  },
  Strict
);
export type OwnerReferenceMigrationEvidenceRef = Static<
  typeof OwnerReferenceMigrationEvidenceRefSchema
>;

export const OwnerReferenceMigrationTargetRecordSchema = Type.Union([
  ReferenceDigitalAssetSchema,
  ReferenceAssetAcquisitionSchema,
]);
export type OwnerReferenceMigrationTargetRecord = Static<
  typeof OwnerReferenceMigrationTargetRecordSchema
>;

export const OwnerReferenceMigrationMappingSchema = Type.Object(
  {
    schemaId: Type.Literal("vellum.owner-reference-migration.mapping.v1"),
    legacyId: SafeIdSchema,
    legacyRecordDigest: DigestSchema,
    legacyRecordRef: ReferenceRecordRefSchema,
    legacyCitationDigest: DigestSchema,
    legacySnapshot: LegacyOwnerReferenceSnapshotSchema,
    legacyRecordEvidence: OwnerReferenceMigrationEvidenceRefSchema,
    byteVerification: OwnerReferenceByteVerificationSchema,
    targetRecords: Type.Array(OwnerReferenceMigrationTargetRecordSchema, { minItems: 2 }),
    targetAssetRef: ReferenceRecordRefSchema,
    targetAcquisitionRef: ReferenceRecordRefSchema,
    accessDecisionRefs: Type.Array(ReferenceRecordRefSchema, { maxItems: 0 }),
    bibliographicIdentity: Type.Object(
      {
        state: Type.Literal("not_asserted"),
        workRefs: Type.Array(ReferenceRecordRefSchema, { maxItems: 0 }),
        manifestationRefs: Type.Array(ReferenceRecordRefSchema, { maxItems: 0 }),
        exemplarRefs: Type.Array(ReferenceRecordRefSchema, { maxItems: 0 }),
      },
      Strict
    ),
    bindingDisposition: Type.Literal("pending_owner_authorization"),
  },
  Strict
);
export type OwnerReferenceMigrationMapping = Static<typeof OwnerReferenceMigrationMappingSchema>;

export const OwnerReferenceMigrationQuarantineReasonSchema = Type.Union([
  Type.Literal("legacy_id_collision"),
  Type.Literal("missing_bytes"),
  Type.Literal("hash_mismatch"),
  Type.Literal("length_mismatch"),
  Type.Literal("invalid_legacy_record"),
  Type.Literal("unsafe_legacy_path"),
  Type.Literal("unstable_legacy_bytes"),
  Type.Literal("incomplete_identity"),
  Type.Literal("composite_identity"),
  Type.Literal("immutable_mapping_conflict"),
  Type.Literal("target_record_collision"),
]);
export type OwnerReferenceMigrationQuarantineReason = Static<
  typeof OwnerReferenceMigrationQuarantineReasonSchema
>;

export const OwnerReferenceMigrationQuarantineActionSchema = Type.Union([
  Type.Literal("resolve_legacy_id_collision"),
  Type.Literal("restore_exact_legacy_bytes"),
  Type.Literal("review_legacy_record"),
  Type.Literal("repair_legacy_storage_boundary"),
  Type.Literal("retry_stable_snapshot"),
  Type.Literal("review_source_identity"),
  Type.Literal("review_immutable_mapping_conflict"),
  Type.Literal("review_target_record_collision"),
]);
export type OwnerReferenceMigrationQuarantineAction = Static<
  typeof OwnerReferenceMigrationQuarantineActionSchema
>;

export const OwnerReferenceMigrationQuarantineSchema = Type.Object(
  {
    schemaId: Type.Literal("vellum.owner-reference-migration.quarantine.v1"),
    batchId: SafeIdSchema,
    legacyId: SafeIdSchema,
    rawLegacyId: Type.String(),
    legacyRecordDigest: Type.Union([DigestSchema, Type.Null()]),
    legacyRecordByteLength: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    legacySnapshot: Type.Union([LegacyOwnerReferenceSnapshotSchema, Type.Null()]),
    legacyRecordEvidence: Type.Union([OwnerReferenceMigrationEvidenceRefSchema, Type.Null()]),
    observedContentEvidence: Type.Union([OwnerReferenceMigrationEvidenceRefSchema, Type.Null()]),
    reason: OwnerReferenceMigrationQuarantineReasonSchema,
    action: OwnerReferenceMigrationQuarantineActionSchema,
    declaredSha256: Type.Union([DigestSchema, Type.Null()]),
    observedSha256: Type.Union([DigestSchema, Type.Null()]),
    declaredByteLength: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    observedByteLength: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  },
  Strict
);
export type OwnerReferenceMigrationQuarantine = Static<
  typeof OwnerReferenceMigrationQuarantineSchema
>;

export const OwnerReferenceMigrationJournalSchema = Type.Object(
  {
    schemaId: Type.Literal("vellum.owner-reference-migration.journal.v1"),
    batchId: SafeIdSchema,
    planDigest: DigestSchema,
    legacyInventoryDigest: DigestSchema,
    action: Type.Union([
      Type.Literal("commit"),
      Type.Literal("rollback"),
      Type.Literal("rollback_interrupted"),
    ]),
    state: Type.Union([Type.Literal("committed"), Type.Literal("rolled_back")]),
    sequence: Type.Integer({ minimum: 1 }),
    publicationParentRef: Type.Union([
      Type.Object(
        {
          id: SafeIdSchema,
          digest: DigestSchema,
          revision: Type.Integer({ minimum: 1 }),
        },
        Strict
      ),
      Type.Null(),
    ]),
    graphHeadRef: Type.Union([ReferenceRecordRefSchema, Type.Null()]),
    mappingRecordRefs: Type.Array(ReferenceRecordRefSchema),
    quarantineRecordRefs: Type.Array(ReferenceRecordRefSchema),
    predecessorJournalRef: Type.Union([ReferenceRecordRefSchema, Type.Null()]),
    recordedAt: IsoTimestampSchema,
  },
  Strict
);
export type OwnerReferenceMigrationJournal = Static<typeof OwnerReferenceMigrationJournalSchema>;

export const OwnerReferenceMigrationRecordContentSchema = Type.Union([
  OwnerReferenceMigrationMappingSchema,
  OwnerReferenceMigrationQuarantineSchema,
  OwnerReferenceMigrationJournalSchema,
]);
export type OwnerReferenceMigrationRecordContent = Static<
  typeof OwnerReferenceMigrationRecordContentSchema
>;
