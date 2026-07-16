import { Type, type Static } from "@sinclair/typebox";

import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";

const Strict = { additionalProperties: false } as const;
const IdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
});
const RefSchema = Type.Object({ id: IdSchema, digest: DigestSchema }, Strict);

const RoleSchema = Type.Union([
  Type.Literal("release_reviewer"),
  Type.Literal("curator"),
  Type.Literal("truth_reviewer"),
  Type.Literal("evaluator_implementer"),
  Type.Literal("evaluator_calibrator"),
  Type.Literal("run_operator"),
  Type.Literal("target_player"),
  Type.Literal("historical_practice_specialist"),
  Type.Literal("continuo_specialist"),
  Type.Literal("counterpoint_specialist"),
  Type.Literal("engraving_editor"),
  Type.Literal("owner"),
]);

const DimensionSchema = Type.Union([
  Type.Literal("historical_practice"),
  Type.Literal("instrument_idiom"),
  Type.Literal("target_playability"),
  Type.Literal("continuo"),
  Type.Literal("counterpoint"),
  Type.Literal("engraving"),
  Type.Literal("metadata_rights"),
  Type.Literal("source_transcription"),
  Type.Literal("evaluation_truth"),
  Type.Literal("holdout_independence"),
  Type.Literal("software_editorial"),
  Type.Literal("owner_usefulness"),
]);

const ScopeSummarySchema = Type.Object(
  {
    scopeRef: RefSchema,
    roles: Type.Array(RoleSchema, { maxItems: 16 }),
    subjectKinds: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { maxItems: 16 }),
    actions: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { maxItems: 16 }),
    artifactCount: Type.Integer({ minimum: 0, maximum: 256 }),
    applicabilityCount: Type.Integer({ minimum: 0, maximum: 256 }),
    dimensions: Type.Array(DimensionSchema, { maxItems: 16 }),
    advisoryKinds: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { maxItems: 8 }),
  },
  Strict
);

const VerificationSummarySchema = Type.Object(
  {
    verificationRef: RefSchema,
    verificationKind: Type.Union([Type.Literal("attestation"), Type.Literal("advisory")]),
    subjectRef: RefSchema,
    reviewerIdentityRef: RefSchema,
    reviewerRole: RoleSchema,
    verifierPolicyRef: RefSchema,
    verifierIdentityRef: RefSchema,
    verifierComponentRef: RefSchema,
    result: Type.Union([
      Type.Literal("verified_authorized"),
      Type.Literal("verified_out_of_scope"),
      Type.Literal("unverified"),
      Type.Literal("revoked"),
    ]),
    reason: Type.String({ minLength: 1, maxLength: 100 }),
    checkedAt: IsoTimestampSchema,
    validUntil: Type.Union([IsoTimestampSchema, Type.Null()]),
    freshness: Type.Union([
      Type.Literal("current"),
      Type.Literal("expired"),
      Type.Literal("stale"),
    ]),
    revocation: Type.Union([
      Type.Literal("clear"),
      Type.Literal("revoked"),
      Type.Literal("unavailable"),
    ]),
    evaluatedScope: Type.Union([ScopeSummarySchema, Type.Null()]),
    authorizationScope: Type.Union([ScopeSummarySchema, Type.Null()]),
    authorityConferred: Type.Boolean(),
    humanAuthority: Type.Boolean(),
    synthetic: Type.Boolean(),
    sourceRefs: Type.Array(RefSchema, { maxItems: 128 }),
    disagreements: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), { maxItems: 32 }),
    unclaimedDimensions: Type.Array(DimensionSchema, { maxItems: 16 }),
  },
  Strict
);

const RoleConflictSummarySchema = Type.Object(
  {
    reviewerIdentityRef: RefSchema,
    leftRole: RoleSchema,
    rightRole: RoleSchema,
  },
  Strict
);

const ActivationDecisionStateSchema = Type.Union([
  Type.Literal("not_present"),
  Type.Literal("outside_t13_scope"),
]);

const UnconfiguredProjectionSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    state: Type.Literal("unconfigured"),
    boundary: Type.Literal("external_verifier_required"),
    verifications: Type.Tuple([]),
    roleConflicts: Type.Tuple([]),
    activationDecisionState: ActivationDecisionStateSchema,
  },
  Strict
);

const ConfiguredProjectionSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    state: Type.Literal("configured"),
    boundary: Type.Literal("external_verifier_required"),
    policy: Type.Object(
      {
        policyRef: RefSchema,
        policyVersion: Type.Integer({ minimum: 1 }),
        validFrom: IsoTimestampSchema,
        validUntil: Type.Union([IsoTimestampSchema, Type.Null()]),
        clockPolicyRef: RefSchema,
        maximumClockSkewMs: Type.Integer({ minimum: 0 }),
        maximumReceiptAgeMs: Type.Integer({ minimum: 1 }),
        maximumRevocationAgeMs: Type.Integer({ minimum: 1 }),
        verifierCount: Type.Integer({ minimum: 1 }),
        revocationSourceCount: Type.Integer({ minimum: 1 }),
        synthetic: Type.Boolean(),
      },
      Strict
    ),
    verifications: Type.Array(VerificationSummarySchema, { maxItems: 4096 }),
    roleConflicts: Type.Array(RoleConflictSummarySchema, { maxItems: 4096 }),
    activationDecisionState: ActivationDecisionStateSchema,
  },
  Strict
);

assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
export const ReviewerAuthorityWorkbenchProjectionSchema = Type.Union([
  UnconfiguredProjectionSchema,
  ConfiguredProjectionSchema,
]);
export type ReviewerAuthorityWorkbenchProjection = Static<
  typeof ReviewerAuthorityWorkbenchProjectionSchema
>;
