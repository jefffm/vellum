import { Type, type Static } from "@sinclair/typebox";

import { OwnerReferenceMigrationQuarantineReasonSchema } from "./owner-reference-migration-reason.js";

const Strict = { additionalProperties: false } as const;
const SafeIdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const OpaqueRefSchema = Type.Object({ id: SafeIdSchema, digest: DigestSchema }, Strict);

export const OwnerReferenceWorkbenchAccessOperationSchema = Type.Union([
  Type.Literal("local_study"),
  Type.Literal("local_extraction"),
  Type.Literal("provider_egress"),
  Type.Literal("fixture_inclusion"),
  Type.Literal("repository_inclusion"),
  Type.Literal("export"),
  Type.Literal("redistribution"),
  Type.Literal("report"),
  Type.Literal("log"),
]);
export type OwnerReferenceWorkbenchAccessOperation = Static<
  typeof OwnerReferenceWorkbenchAccessOperationSchema
>;

export const OwnerReferenceWorkbenchAccessExplanationSchema = Type.Object(
  {
    operation: OwnerReferenceWorkbenchAccessOperationSchema,
    status: Type.Union([Type.Literal("deny"), Type.Literal("review_required")]),
    explanation: Type.String({ minLength: 1 }),
  },
  Strict
);
export type OwnerReferenceWorkbenchAccessExplanation = Static<
  typeof OwnerReferenceWorkbenchAccessExplanationSchema
>;

const OwnerReferenceWorkbenchMigrationSchema = Type.Object(
  {
    state: Type.Union([
      Type.Literal("mapped"),
      Type.Literal("quarantined"),
      Type.Literal("rolled_back"),
    ]),
    legacySourceState: Type.Union([
      Type.Literal("verified"),
      Type.Literal("missing"),
      Type.Literal("diverged"),
      Type.Literal("unavailable"),
    ]),
    quarantineReason: Type.Optional(OwnerReferenceMigrationQuarantineReasonSchema),
    explanation: Type.String({ minLength: 1 }),
  },
  Strict
);
export type OwnerReferenceWorkbenchMigration = Static<
  typeof OwnerReferenceWorkbenchMigrationSchema
>;

const OwnerReferenceWorkbenchRoleBindingsSchema = Type.Object(
  {
    state: Type.Union([Type.Literal("unbound"), Type.Literal("bound")]),
    ownerReferenceCount: Type.Integer({ minimum: 0 }),
    arrangementSourceCount: Type.Integer({ minimum: 0 }),
    evaluationSourceCount: Type.Integer({ minimum: 0 }),
    explanation: Type.String({ minLength: 1 }),
  },
  Strict
);

export const OwnerReferenceWorkbenchCardSchema = Type.Object(
  {
    id: SafeIdSchema,
    cardRef: OpaqueRefSchema,
    acquisitionRef: OpaqueRefSchema,
    assetRef: OpaqueRefSchema,
    origin: Type.Union([Type.Literal("migrated"), Type.Literal("upload")]),
    migration: Type.Union([OwnerReferenceWorkbenchMigrationSchema, Type.Null()]),
    mediaType: Type.String({ minLength: 1 }),
    byteLength: Type.Integer({ minimum: 0 }),
    identity: Type.Union([
      Type.Object(
        {
          state: Type.Literal("unresolved"),
          explanation: Type.String({ minLength: 1 }),
        },
        Strict
      ),
      Type.Object(
        {
          state: Type.Union([
            Type.Literal("candidate"),
            Type.Literal("reviewed"),
            Type.Literal("disputed"),
          ]),
          resolutionCount: Type.Integer({ minimum: 1 }),
          explanation: Type.String({ minLength: 1 }),
        },
        Strict
      ),
    ]),
    rights: Type.Object(
      {
        state: Type.Union([Type.Literal("unasserted"), Type.Literal("recorded")]),
        assertionCount: Type.Integer({ minimum: 0 }),
        explanation: Type.String({ minLength: 1 }),
      },
      Strict
    ),
    roleBindings: OwnerReferenceWorkbenchRoleBindingsSchema,
    access: Type.Array(OwnerReferenceWorkbenchAccessExplanationSchema, {
      minItems: 9,
      maxItems: 9,
    }),
    policyRef: OpaqueRefSchema,
  },
  Strict
);
export type OwnerReferenceWorkbenchCard = Static<typeof OwnerReferenceWorkbenchCardSchema>;

export const OwnerReferenceWorkbenchSnapshotSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    snapshotRef: OpaqueRefSchema,
    references: Type.Array(OwnerReferenceWorkbenchCardSchema),
  },
  Strict
);
export type OwnerReferenceWorkbenchSnapshot = Static<typeof OwnerReferenceWorkbenchSnapshotSchema>;

export const OwnerReferenceWorkbenchUploadConfirmationRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    acquisitionKey: Type.String({
      pattern: "^owner-upload\\.v2\\.[A-Za-z0-9_-]{43}$",
    }),
  },
  Strict
);
export type OwnerReferenceWorkbenchUploadConfirmationRequest = Static<
  typeof OwnerReferenceWorkbenchUploadConfirmationRequestSchema
>;

export const OwnerReferenceWorkbenchUploadConfirmationResultSchema = Type.Union([
  Type.Object(
    {
      schemaVersion: Type.Literal(1),
      status: Type.Literal("present"),
      snapshotRef: OpaqueRefSchema,
      cardRef: OpaqueRefSchema,
    },
    Strict
  ),
  Type.Object(
    {
      schemaVersion: Type.Literal(1),
      status: Type.Literal("absent"),
      snapshotRef: OpaqueRefSchema,
    },
    Strict
  ),
]);
export type OwnerReferenceWorkbenchUploadConfirmationResult = Static<
  typeof OwnerReferenceWorkbenchUploadConfirmationResultSchema
>;

export const OwnerReferenceWorkbenchLocalOperationSchema = Type.Union([
  Type.Literal("owner_private_study"),
  Type.Literal("local_extraction"),
]);
export type OwnerReferenceWorkbenchLocalOperation = Static<
  typeof OwnerReferenceWorkbenchLocalOperationSchema
>;

export const OwnerReferenceWorkbenchLocalOperationReviewRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    snapshotRef: OpaqueRefSchema,
    cardRef: OpaqueRefSchema,
    operation: OwnerReferenceWorkbenchLocalOperationSchema,
    purpose: Type.String({ minLength: 1, maxLength: 512, pattern: "\\S" }),
  },
  Strict
);
export type OwnerReferenceWorkbenchLocalOperationReviewRequest = Static<
  typeof OwnerReferenceWorkbenchLocalOperationReviewRequestSchema
>;

export const OwnerReferenceWorkbenchLocalOperationReviewResultSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    operation: OwnerReferenceWorkbenchLocalOperationSchema,
    status: Type.Union([Type.Literal("deny"), Type.Literal("review_required")]),
    reasonCode: Type.Union([
      Type.Literal("owner_private_local_review_required"),
      Type.Literal("workbench_snapshot_stale"),
      Type.Literal("workbench_card_not_found_or_mismatched"),
      Type.Literal("staging_snapshot_unavailable_or_invalid"),
    ]),
  },
  Strict
);
export type OwnerReferenceWorkbenchLocalOperationReviewResult = Static<
  typeof OwnerReferenceWorkbenchLocalOperationReviewResultSchema
>;

/**
 * One explicit Owner attestation for a byte-for-byte, local-only study view.
 *
 * The operation key is the canonical unpadded base64url encoding of exactly
 * 16 random bytes. It is never a source identifier and is never returned by
 * the server; the server persists only a keyed commitment to it.
 */
export const OwnerReferenceWorkbenchLocalStudyRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    snapshotRef: OpaqueRefSchema,
    cardRef: OpaqueRefSchema,
    operation: Type.Literal("owner_private_study"),
    purpose: Type.String({ minLength: 1, maxLength: 512, pattern: "\\S" }),
    authorization: Type.Literal("owner_attested_local_study"),
    operationKey: Type.String({
      pattern: "^owner-local-study\\.v1\\.[A-Za-z0-9_-]{21}[AQgw]$",
    }),
  },
  Strict
);
export type OwnerReferenceWorkbenchLocalStudyRequest = Static<
  typeof OwnerReferenceWorkbenchLocalStudyRequestSchema
>;

export const OwnerReferenceWorkbenchLocalStudyConflictDetailsSchema = Type.Union([
  Type.Object(
    {
      reason: Type.Literal("operation_key_bound_to_different_scope"),
      retrySafety: Type.Literal("reuse_exact_request"),
    },
    Strict
  ),
  Type.Object(
    {
      reason: Type.Literal("workbench_snapshot_stale_before_commit"),
      retrySafety: Type.Literal("refresh_and_rebind_same_operation_key"),
    },
    Strict
  ),
]);
export type OwnerReferenceWorkbenchLocalStudyConflictDetails = Static<
  typeof OwnerReferenceWorkbenchLocalStudyConflictDetailsSchema
>;
