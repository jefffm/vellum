import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import {
  canonicalReferenceJson,
  referenceSourceDigest,
  verifyReferenceRecordDigest,
} from "./reference-source-domain.js";

const Strict = { additionalProperties: false } as const;
const IdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
});

assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");

export const ReviewerAuthorityRefSchema = Type.Object(
  { id: IdSchema, digest: DigestSchema },
  Strict
);
export type ReviewerAuthorityRef = Static<typeof ReviewerAuthorityRefSchema>;

export const ReviewerRoleSchema = Type.Union([
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
export type ReviewerRole = Static<typeof ReviewerRoleSchema>;

export const ReviewerAuthorityActionSchema = Type.Union([
  Type.Literal("attest_release"),
  Type.Literal("attest_exact_artifact"),
  Type.Literal("review_evaluation_truth"),
  Type.Literal("curate_holdout_split"),
  Type.Literal("implement_evaluator"),
  Type.Literal("calibrate_evaluator"),
  Type.Literal("operate_qualification_run"),
  Type.Literal("issue_advisory"),
]);
export type ReviewerAuthorityAction = Static<typeof ReviewerAuthorityActionSchema>;

export const ReviewerClaimDimensionSchema = Type.Union([
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
export type ReviewerClaimDimension = Static<typeof ReviewerClaimDimensionSchema>;

export const ReviewerSubjectKindSchema = Type.Union([
  Type.Literal("knowledge_pack_release"),
  Type.Literal("release_attestation"),
  Type.Literal("release_advisory"),
  Type.Literal("exact_artifact"),
  Type.Literal("knowledge_profile"),
  Type.Literal("holdout_split"),
  Type.Literal("evaluation_gate"),
  Type.Literal("qualification_run"),
]);
export type ReviewerSubjectKind = Static<typeof ReviewerSubjectKindSchema>;

export const ReleaseAdvisoryKindSchema = Type.Union([
  Type.Literal("superseded"),
  Type.Literal("retracted"),
  Type.Literal("attestation_revoked"),
  Type.Literal("rights_restricted"),
]);
export type ReleaseAdvisoryKind = Static<typeof ReleaseAdvisoryKindSchema>;

const ReviewerAuthorityScopeCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("reviewer_authority_scope"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    reviewerRoles: Type.Array(ReviewerRoleSchema, { maxItems: 16, uniqueItems: true }),
    subjectKinds: Type.Array(ReviewerSubjectKindSchema, { maxItems: 16, uniqueItems: true }),
    subjectRefs: Type.Array(ReviewerAuthorityRefSchema, { maxItems: 256, uniqueItems: true }),
    actions: Type.Array(ReviewerAuthorityActionSchema, { maxItems: 16, uniqueItems: true }),
    artifactRefs: Type.Array(ReviewerAuthorityRefSchema, { maxItems: 256, uniqueItems: true }),
    applicabilityRefs: Type.Array(ReviewerAuthorityRefSchema, { maxItems: 256, uniqueItems: true }),
    claimDimensions: Type.Array(ReviewerClaimDimensionSchema, {
      maxItems: 16,
      uniqueItems: true,
    }),
    advisoryKinds: Type.Array(ReleaseAdvisoryKindSchema, { maxItems: 8, uniqueItems: true }),
    unclaimedDimensions: Type.Array(ReviewerClaimDimensionSchema, {
      maxItems: 16,
      uniqueItems: true,
    }),
  },
  Strict
);
export const ReviewerAuthorityScopeSchema = Type.Object(
  { ...ReviewerAuthorityScopeCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type ReviewerAuthorityScope = Static<typeof ReviewerAuthorityScopeSchema>;

const ReviewerIdentitySnapshotCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("reviewer_identity_snapshot"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    subjectRef: ReviewerAuthorityRefSchema,
    displayLabel: Type.String({ minLength: 1, maxLength: 160 }),
    assertedAttributes: Type.Record(
      Type.String({ maxLength: 80 }),
      Type.String({ maxLength: 500 })
    ),
    evidenceRefs: Type.Array(ReviewerAuthorityRefSchema, { maxItems: 64, uniqueItems: true }),
    capturedAt: IsoTimestampSchema,
    environment: Type.Union([Type.Literal("production"), Type.Literal("synthetic_test")]),
  },
  Strict
);
export const ReviewerIdentitySnapshotSchema = Type.Object(
  { ...ReviewerIdentitySnapshotCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type ReviewerIdentitySnapshot = Static<typeof ReviewerIdentitySnapshotSchema>;

export const ReviewerCredentialKindSchema = Type.Union([
  Type.Literal("reviewer_role"),
  Type.Literal("advisory_issuer"),
]);
export type ReviewerCredentialKind = Static<typeof ReviewerCredentialKindSchema>;

const ReviewerCredentialAssertionCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("reviewer_credential_assertion"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    reviewerIdentitySnapshotRef: ReviewerAuthorityRefSchema,
    issuerIdentityRef: ReviewerAuthorityRefSchema,
    kind: ReviewerCredentialKindSchema,
    reviewerRole: ReviewerRoleSchema,
    scopeRef: ReviewerAuthorityRefSchema,
    validFrom: IsoTimestampSchema,
    validUntil: Type.Optional(IsoTimestampSchema),
    revocationSourceRefs: Type.Array(ReviewerAuthorityRefSchema, {
      minItems: 1,
      maxItems: 32,
      uniqueItems: true,
    }),
    evidenceRefs: Type.Array(ReviewerAuthorityRefSchema, { minItems: 1, maxItems: 64 }),
    signatureRef: Type.Optional(ReviewerAuthorityRefSchema),
    environment: Type.Union([Type.Literal("production"), Type.Literal("synthetic_test")]),
  },
  Strict
);
export const ReviewerCredentialAssertionSchema = Type.Object(
  { ...ReviewerCredentialAssertionCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type ReviewerCredentialAssertion = Static<typeof ReviewerCredentialAssertionSchema>;

export const ReviewerClockPolicySchema = Type.Object(
  {
    policyRef: ReviewerAuthorityRefSchema,
    timeBasis: Type.Literal("utc"),
    maximumClockSkewMs: Type.Integer({ minimum: 0, maximum: 86_400_000 }),
    maximumReceiptAgeMs: Type.Integer({ minimum: 1, maximum: 31_536_000_000 }),
    maximumRevocationAgeMs: Type.Integer({ minimum: 1, maximum: 31_536_000_000 }),
  },
  Strict
);
export type ReviewerClockPolicy = Static<typeof ReviewerClockPolicySchema>;

export const ReviewerRoleConflictSchema = Type.Tuple([ReviewerRoleSchema, ReviewerRoleSchema]);
export type ReviewerRoleConflict = Static<typeof ReviewerRoleConflictSchema>;

export const AuthorizedReviewerVerifierSchema = Type.Object(
  {
    verifierIdentityRef: ReviewerAuthorityRefSchema,
    verifierComponentRef: ReviewerAuthorityRefSchema,
    trustRootRefs: Type.Array(ReviewerAuthorityRefSchema, {
      minItems: 1,
      maxItems: 32,
      uniqueItems: true,
    }),
    verificationMethodRefs: Type.Array(ReviewerAuthorityRefSchema, {
      minItems: 1,
      maxItems: 32,
      uniqueItems: true,
    }),
    credentialKinds: Type.Array(ReviewerCredentialKindSchema, {
      minItems: 1,
      maxItems: 2,
      uniqueItems: true,
    }),
    advisoryKinds: Type.Array(ReleaseAdvisoryKindSchema, { maxItems: 4, uniqueItems: true }),
    subjectKinds: Type.Array(ReviewerSubjectKindSchema, {
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
    }),
    reviewerRoles: Type.Array(ReviewerRoleSchema, {
      minItems: 1,
      maxItems: 16,
      uniqueItems: true,
    }),
    authorizationScopeRef: ReviewerAuthorityRefSchema,
  },
  Strict
);
export type AuthorizedReviewerVerifier = Static<typeof AuthorizedReviewerVerifierSchema>;

const ReviewerTrustPolicyCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("reviewer_trust_policy"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    policyVersion: Type.Integer({ minimum: 1 }),
    authorizedVerifiers: Type.Array(AuthorizedReviewerVerifierSchema, {
      minItems: 1,
      maxItems: 32,
    }),
    clockPolicy: ReviewerClockPolicySchema,
    revocationSourceRefs: Type.Array(ReviewerAuthorityRefSchema, {
      minItems: 1,
      maxItems: 32,
      uniqueItems: true,
    }),
    roleConflicts: Type.Array(ReviewerRoleConflictSchema, { maxItems: 64 }),
    validFrom: IsoTimestampSchema,
    validUntil: Type.Optional(IsoTimestampSchema),
    environment: Type.Union([Type.Literal("production"), Type.Literal("synthetic_test")]),
  },
  Strict
);
export const ReviewerTrustPolicySchema = Type.Object(
  { ...ReviewerTrustPolicyCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type ReviewerTrustPolicy = Static<typeof ReviewerTrustPolicySchema>;

const ReviewerRevocationSnapshotCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("reviewer_revocation_snapshot"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    sourceRef: ReviewerAuthorityRefSchema,
    observedAt: IsoTimestampSchema,
    validUntil: IsoTimestampSchema,
    revokedCredentialRefs: Type.Array(ReviewerAuthorityRefSchema, {
      maxItems: 4096,
      uniqueItems: true,
    }),
    revokedIdentityRefs: Type.Array(ReviewerAuthorityRefSchema, {
      maxItems: 4096,
      uniqueItems: true,
    }),
    evidenceRefs: Type.Array(ReviewerAuthorityRefSchema, { minItems: 1, maxItems: 64 }),
    environment: Type.Union([Type.Literal("production"), Type.Literal("synthetic_test")]),
  },
  Strict
);
export const ReviewerRevocationSnapshotSchema = Type.Object(
  { ...ReviewerRevocationSnapshotCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type ReviewerRevocationSnapshot = Static<typeof ReviewerRevocationSnapshotSchema>;

const ScopedReleaseAttestationCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("release_attestation"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    releaseRef: ReviewerAuthorityRefSchema,
    kind: Type.Union([
      Type.Literal("maintainer_reviewed_system"),
      Type.Literal("owner_reviewed_local"),
      Type.Literal("specialist_reviewed"),
    ]),
    reviewerIdentitySnapshotRef: ReviewerAuthorityRefSchema,
    reviewerRole: ReviewerRoleSchema,
    reviewScopeRef: ReviewerAuthorityRefSchema,
    evidenceRefs: Type.Array(ReviewerAuthorityRefSchema, { minItems: 1, maxItems: 256 }),
    issuedAt: IsoTimestampSchema,
    disagreements: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), { maxItems: 32 }),
    environment: Type.Union([Type.Literal("production"), Type.Literal("synthetic_test")]),
  },
  Strict
);
export const ScopedReleaseAttestationSchema = Type.Object(
  { ...ScopedReleaseAttestationCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type ScopedReleaseAttestation = Static<typeof ScopedReleaseAttestationSchema>;

const ScopedReleaseAdvisoryCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("release_advisory"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    subjectRef: ReviewerAuthorityRefSchema,
    subjectKind: ReviewerSubjectKindSchema,
    kind: ReleaseAdvisoryKindSchema,
    issuerIdentitySnapshotRef: ReviewerAuthorityRefSchema,
    issuerRole: ReviewerRoleSchema,
    requestedScopeRef: ReviewerAuthorityRefSchema,
    effectiveAt: IsoTimestampSchema,
    rationale: Type.String({ minLength: 1, maxLength: 2_000 }),
    evidenceRefs: Type.Array(ReviewerAuthorityRefSchema, { minItems: 1, maxItems: 256 }),
    replacementRef: Type.Optional(ReviewerAuthorityRefSchema),
    environment: Type.Union([Type.Literal("production"), Type.Literal("synthetic_test")]),
  },
  Strict
);
export const ScopedReleaseAdvisorySchema = Type.Object(
  { ...ScopedReleaseAdvisoryCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type ScopedReleaseAdvisory = Static<typeof ScopedReleaseAdvisorySchema>;

export const ReviewerVerifierRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    requestId: IdSchema,
    verificationKind: Type.Union([Type.Literal("attestation"), Type.Literal("advisory")]),
    subjectRecordRef: ReviewerAuthorityRefSchema,
    identitySnapshotRef: ReviewerAuthorityRefSchema,
    credentialAssertionRefs: Type.Array(ReviewerAuthorityRefSchema, {
      minItems: 1,
      maxItems: 32,
      uniqueItems: true,
    }),
    requestedScopeRef: ReviewerAuthorityRefSchema,
    trustPolicyRef: ReviewerAuthorityRefSchema,
    revocationSnapshotRefs: Type.Array(ReviewerAuthorityRefSchema, {
      minItems: 1,
      maxItems: 32,
      uniqueItems: true,
    }),
    verificationTime: IsoTimestampSchema,
    requestDigest: DigestSchema,
  },
  Strict
);
export type ReviewerVerifierRequest = Static<typeof ReviewerVerifierRequestSchema>;

const ReviewerVerifierReceiptCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("reviewer_verifier_receipt"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    requestDigest: DigestSchema,
    verifierIdentityRef: ReviewerAuthorityRefSchema,
    verifierComponentRef: ReviewerAuthorityRefSchema,
    trustRootRef: ReviewerAuthorityRefSchema,
    verificationMethodRef: ReviewerAuthorityRefSchema,
    identitySnapshotRef: ReviewerAuthorityRefSchema,
    credentialAssertionRefs: Type.Array(ReviewerAuthorityRefSchema, {
      minItems: 1,
      maxItems: 32,
      uniqueItems: true,
    }),
    result: Type.Union([Type.Literal("authenticated"), Type.Literal("rejected")]),
    checkedAt: IsoTimestampSchema,
    validUntil: Type.Optional(IsoTimestampSchema),
    evidenceRefs: Type.Array(ReviewerAuthorityRefSchema, { minItems: 1, maxItems: 64 }),
    signature: Type.String({ minLength: 1, maxLength: 4096 }),
    environment: Type.Union([Type.Literal("production"), Type.Literal("synthetic_test")]),
  },
  Strict
);
export const ReviewerVerifierReceiptSchema = Type.Object(
  { ...ReviewerVerifierReceiptCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type ReviewerVerifierReceipt = Static<typeof ReviewerVerifierReceiptSchema>;

export const ReviewerVerificationReasonSchema = Type.Union([
  Type.Literal("authorized"),
  Type.Literal("scope_intersection_failed"),
  Type.Literal("provider_rejected"),
  Type.Literal("receipt_signature_invalid"),
  Type.Literal("receipt_binding_mismatch"),
  Type.Literal("unauthorized_verifier"),
  Type.Literal("unsupported_credential_kind"),
  Type.Literal("unsupported_advisory_kind"),
  Type.Literal("self_issued_credential"),
  Type.Literal("subject_ambiguous"),
  Type.Literal("role_conflict"),
  Type.Literal("missing_scope"),
  Type.Literal("credential_not_yet_valid"),
  Type.Literal("credential_expired"),
  Type.Literal("verification_stale"),
  Type.Literal("policy_not_yet_valid"),
  Type.Literal("policy_expired"),
  Type.Literal("clock_policy_mismatch"),
  Type.Literal("revocation_status_stale"),
  Type.Literal("credential_revoked"),
  Type.Literal("identity_revoked"),
]);
export type ReviewerVerificationReason = Static<typeof ReviewerVerificationReasonSchema>;

const ReviewerVerificationSharedProperties = {
  schemaVersion: Type.Literal(1),
  id: IdSchema,
  familyId: IdSchema,
  subjectRecordRef: ReviewerAuthorityRefSchema,
  verifierPolicyRef: ReviewerAuthorityRefSchema,
  verifierIdentityRef: ReviewerAuthorityRefSchema,
  verifierComponentRef: ReviewerAuthorityRefSchema,
  reviewerIdentitySnapshotRef: ReviewerAuthorityRefSchema,
  credentialAssertionRefs: Type.Array(ReviewerAuthorityRefSchema, {
    minItems: 1,
    maxItems: 32,
    uniqueItems: true,
  }),
  verificationMethodRef: ReviewerAuthorityRefSchema,
  revocationSnapshotRefs: Type.Array(ReviewerAuthorityRefSchema, {
    minItems: 1,
    maxItems: 32,
    uniqueItems: true,
  }),
  receiptRef: ReviewerAuthorityRefSchema,
  checkedAt: IsoTimestampSchema,
  validUntil: Type.Optional(IsoTimestampSchema),
  evidenceRefs: Type.Array(ReviewerAuthorityRefSchema, { minItems: 1, maxItems: 128 }),
  reviewerRole: ReviewerRoleSchema,
  disagreements: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), { maxItems: 32 }),
  unclaimedDimensions: Type.Array(ReviewerClaimDimensionSchema, {
    maxItems: 16,
    uniqueItems: true,
  }),
  authorityDisposition: Type.Union([
    Type.Literal("eligible_for_later_resolution"),
    Type.Literal("synthetic_test_no_authority"),
    Type.Literal("none"),
  ]),
  humanAuthority: Type.Boolean(),
  activationDecisionPublished: Type.Literal(false),
  environment: Type.Union([Type.Literal("production"), Type.Literal("synthetic_test")]),
} as const;

const ReviewerVerificationResultProperties = {
  ...ReviewerVerificationSharedProperties,
  result: Type.Union([
    Type.Literal("verified_authorized"),
    Type.Literal("verified_out_of_scope"),
    Type.Literal("unverified"),
    Type.Literal("revoked"),
  ]),
  reason: ReviewerVerificationReasonSchema,
  evaluatedScopeRef: Type.Optional(ReviewerAuthorityRefSchema),
  authorizationScopeRef: Type.Optional(ReviewerAuthorityRefSchema),
  digest: DigestSchema,
} as const;

export const AttestationVerificationSchema = Type.Object(
  {
    recordKind: Type.Literal("attestation_verification"),
    ...ReviewerVerificationResultProperties,
  },
  Strict
);
export type AttestationVerification = Static<typeof AttestationVerificationSchema>;
export const AdvisoryVerificationSchema = Type.Object(
  {
    recordKind: Type.Literal("advisory_verification"),
    ...ReviewerVerificationResultProperties,
  },
  Strict
);
export type AdvisoryVerification = Static<typeof AdvisoryVerificationSchema>;
export type ReviewerAuthorityVerification = AttestationVerification | AdvisoryVerification;

type DigestedRecord = { digest: string };

function buildRecord<T extends DigestedRecord>(schema: TSchema, value: Omit<T, "digest">): T {
  const decoded = Value.Decode(schema, {
    ...structuredClone(value),
    digest: referenceSourceDigest(value),
  }) as T;
  return validateRecord(schema, decoded);
}

function validateRecord<T extends DigestedRecord>(schema: TSchema, value: unknown): T {
  const decoded = Value.Decode(schema, value) as T;
  if (!verifyReferenceRecordDigest(decoded))
    throw new TypeError("Reviewer authority digest is invalid");
  return decoded;
}

export const buildReviewerAuthorityScope = (value: Omit<ReviewerAuthorityScope, "digest">) =>
  buildRecord<ReviewerAuthorityScope>(ReviewerAuthorityScopeSchema, value);
export const validateReviewerAuthorityScope = (value: unknown) =>
  validateRecord<ReviewerAuthorityScope>(ReviewerAuthorityScopeSchema, value);
export const buildReviewerIdentitySnapshot = (value: Omit<ReviewerIdentitySnapshot, "digest">) =>
  buildRecord<ReviewerIdentitySnapshot>(ReviewerIdentitySnapshotSchema, value);
export const validateReviewerIdentitySnapshot = (value: unknown) =>
  validateRecord<ReviewerIdentitySnapshot>(ReviewerIdentitySnapshotSchema, value);
export const buildReviewerCredentialAssertion = (
  value: Omit<ReviewerCredentialAssertion, "digest">
) => buildRecord<ReviewerCredentialAssertion>(ReviewerCredentialAssertionSchema, value);
export const validateReviewerCredentialAssertion = (value: unknown) =>
  validateRecord<ReviewerCredentialAssertion>(ReviewerCredentialAssertionSchema, value);
export const buildReviewerTrustPolicy = (value: Omit<ReviewerTrustPolicy, "digest">) =>
  buildRecord<ReviewerTrustPolicy>(ReviewerTrustPolicySchema, value);
export const validateReviewerTrustPolicy = (value: unknown) =>
  validateRecord<ReviewerTrustPolicy>(ReviewerTrustPolicySchema, value);
export const buildReviewerRevocationSnapshot = (
  value: Omit<ReviewerRevocationSnapshot, "digest">
) => buildRecord<ReviewerRevocationSnapshot>(ReviewerRevocationSnapshotSchema, value);
export const validateReviewerRevocationSnapshot = (value: unknown) =>
  validateRecord<ReviewerRevocationSnapshot>(ReviewerRevocationSnapshotSchema, value);
export const buildScopedReleaseAttestation = (value: Omit<ScopedReleaseAttestation, "digest">) =>
  buildRecord<ScopedReleaseAttestation>(ScopedReleaseAttestationSchema, value);
export const validateScopedReleaseAttestation = (value: unknown) =>
  validateRecord<ScopedReleaseAttestation>(ScopedReleaseAttestationSchema, value);
export const buildScopedReleaseAdvisory = (value: Omit<ScopedReleaseAdvisory, "digest">) =>
  buildRecord<ScopedReleaseAdvisory>(ScopedReleaseAdvisorySchema, value);
export const validateScopedReleaseAdvisory = (value: unknown) =>
  validateRecord<ScopedReleaseAdvisory>(ScopedReleaseAdvisorySchema, value);
export const buildReviewerVerifierReceipt = (value: Omit<ReviewerVerifierReceipt, "digest">) =>
  buildRecord<ReviewerVerifierReceipt>(ReviewerVerifierReceiptSchema, value);
export const validateReviewerVerifierReceipt = (value: unknown) =>
  validateRecord<ReviewerVerifierReceipt>(ReviewerVerifierReceiptSchema, value);
export const buildAttestationVerification = (value: Omit<AttestationVerification, "digest">) =>
  assertVerificationVariant(
    buildRecord<AttestationVerification>(AttestationVerificationSchema, value)
  );
export const validateAttestationVerification = (value: unknown) =>
  assertVerificationVariant(
    validateRecord<AttestationVerification>(AttestationVerificationSchema, value)
  );
export const buildAdvisoryVerification = (value: Omit<AdvisoryVerification, "digest">) =>
  assertVerificationVariant(buildRecord<AdvisoryVerification>(AdvisoryVerificationSchema, value));
export const validateAdvisoryVerification = (value: unknown) =>
  assertVerificationVariant(
    validateRecord<AdvisoryVerification>(AdvisoryVerificationSchema, value)
  );

function assertVerificationVariant<T extends ReviewerAuthorityVerification>(value: T): T {
  const scoped = value.result === "verified_authorized" || value.result === "verified_out_of_scope";
  if (
    scoped !== (value.evaluatedScopeRef !== undefined && value.authorizationScopeRef !== undefined)
  ) {
    throw new TypeError("Reviewer verification scope fields do not match its result");
  }
  if (
    (value.result === "verified_authorized" && value.reason !== "authorized") ||
    (value.result === "verified_out_of_scope" && value.reason !== "scope_intersection_failed") ||
    ((value.result === "unverified" || value.result === "revoked") &&
      (value.reason === "authorized" || value.reason === "scope_intersection_failed")) ||
    (value.result === "revoked" &&
      value.reason !== "credential_revoked" &&
      value.reason !== "identity_revoked")
  ) {
    throw new TypeError("Reviewer verification reason does not match its result");
  }
  return value;
}

export function reviewerAuthorityRef(value: { id: string; digest: string }): ReviewerAuthorityRef {
  return Value.Decode(ReviewerAuthorityRefSchema, { id: value.id, digest: value.digest });
}

export function reviewerVerifierRequestDigest(
  value: Omit<ReviewerVerifierRequest, "requestDigest">
): string {
  return referenceSourceDigest({
    digestDomain: "vellum.reviewer-verifier-request.v1",
    ...value,
  });
}

export function reviewerVerifierReceiptSigningPayload(value: ReviewerVerifierReceipt): string {
  const { digest: _digest, signature: _signature, ...payload } = value;
  return canonicalReferenceJson({
    digestDomain: "vellum.reviewer-verifier-receipt-signature.v1",
    ...payload,
  });
}
