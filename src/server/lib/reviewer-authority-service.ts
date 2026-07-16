import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  canonicalReferenceJson,
  referenceSourceDigest,
} from "../../lib/reference-source-domain.js";
import {
  buildAdvisoryVerification,
  buildAttestationVerification,
  buildReviewerAuthorityScope,
  reviewerAuthorityRef,
  ReviewerVerifierRequestSchema,
  reviewerVerifierRequestDigest,
  validateAdvisoryVerification,
  validateAttestationVerification,
  validateReviewerAuthorityScope,
  validateReviewerCredentialAssertion,
  validateReviewerIdentitySnapshot,
  validateReviewerRevocationSnapshot,
  validateReviewerTrustPolicy,
  validateReviewerVerifierReceipt,
  validateScopedReleaseAdvisory,
  validateScopedReleaseAttestation,
  type AdvisoryVerification,
  type AttestationVerification,
  type AuthorizedReviewerVerifier,
  type ReviewerAuthorityRef,
  type ReviewerAuthorityScope,
  type ReviewerAuthorityVerification,
  type ReviewerCredentialAssertion,
  type ReviewerIdentitySnapshot,
  type ReviewerRevocationSnapshot,
  type ReviewerRole,
  type ReviewerTrustPolicy,
  type ReviewerVerificationReason,
  type ReviewerVerifierReceipt,
  type ReviewerVerifierRequest,
  type ScopedReleaseAdvisory,
  type ScopedReleaseAttestation,
} from "../../lib/reviewer-authority-contract.js";
import {
  ReviewerAuthorityWorkbenchProjectionSchema,
  type ReviewerAuthorityWorkbenchProjection,
} from "../../lib/reviewer-authority-wire.js";
import {
  KnowledgePublicationStore,
  knowledgePublicationRecordRefForWrite,
  type KnowledgePublicationGenerationRef,
  type KnowledgePublicationRecord,
  type KnowledgePublicationRecordKind,
  type KnowledgePublicationSnapshot,
  type KnowledgePublicationTransaction,
  type KnowledgePublicationWrite,
} from "./knowledge-publication-store.js";

export type ExternalReviewerVerifier = Readonly<{
  verify: (
    request: ReviewerVerifierRequest,
    signal?: AbortSignal
  ) => ReviewerVerifierReceipt | Promise<ReviewerVerifierReceipt>;
}>;

export type ReviewerVerifierReceiptVerifier = (
  receipt: ReviewerVerifierReceipt
) => boolean | Promise<boolean>;

export type ReviewerAuthorityMaterial =
  | ReviewerAuthorityScope
  | ReviewerIdentitySnapshot
  | ReviewerCredentialAssertion
  | ReviewerTrustPolicy
  | ReviewerRevocationSnapshot
  | ScopedReleaseAttestation
  | ScopedReleaseAdvisory;

export type ReviewerAuthorityServiceOptions = Readonly<{
  publicationStore: KnowledgePublicationStore;
  verifier?: ExternalReviewerVerifier;
  verifyReceipt?: ReviewerVerifierReceiptVerifier;
  now?: () => Date;
}>;

export type ReviewerAuthorityVerificationRequest = Readonly<{
  subjectRecordRef: ReviewerAuthorityRef;
  trustPolicyRef: ReviewerAuthorityRef;
  credentialAssertionRefs: readonly ReviewerAuthorityRef[];
  revocationSnapshotRefs: readonly ReviewerAuthorityRef[];
  expectedHead: KnowledgePublicationGenerationRef;
}>;

export type ReviewerAuthorityStatusRefreshRequest = Readonly<{
  verificationRef: ReviewerAuthorityRef;
  expectedHead: KnowledgePublicationGenerationRef;
}>;

type EvaluationSubject =
  | Readonly<{
      verificationKind: "attestation";
      record: ScopedReleaseAttestation;
      identitySnapshotRef: ReviewerAuthorityRef;
      requestedScopeRef: ReviewerAuthorityRef;
      reviewerRole: ReviewerRole;
      subjectKind: "release_attestation";
      advisoryKind: null;
      disagreements: readonly string[];
    }>
  | Readonly<{
      verificationKind: "advisory";
      record: ScopedReleaseAdvisory;
      identitySnapshotRef: ReviewerAuthorityRef;
      requestedScopeRef: ReviewerAuthorityRef;
      reviewerRole: ReviewerRole;
      subjectKind: "release_advisory";
      advisoryKind: ScopedReleaseAdvisory["kind"];
      disagreements: readonly string[];
    }>;

type EvaluationContext = Readonly<{
  snapshot: KnowledgePublicationSnapshot;
  subject: EvaluationSubject;
  policy: ReviewerTrustPolicy;
  identity: ReviewerIdentitySnapshot;
  credentials: readonly ReviewerCredentialAssertion[];
  requestedScope: ReviewerAuthorityScope;
  revocations: readonly ReviewerRevocationSnapshot[];
  request: ReviewerVerifierRequest;
  receipt: ReviewerVerifierReceipt;
  receiptSignatureValid: boolean;
  allIdentityCredentials: readonly ReviewerCredentialAssertion[];
}>;

type Decision = Readonly<{
  result: ReviewerAuthorityVerification["result"];
  reason: ReviewerVerificationReason;
  authorizationScope?: ReviewerAuthorityScope;
  validUntil?: string;
  freshness: "current" | "expired" | "stale";
  revocation: "clear" | "revoked" | "unavailable";
}>;

const MATERIAL_KINDS = new Set<KnowledgePublicationRecordKind>([
  "reviewer_authority_scope",
  "reviewer_identity_snapshot",
  "reviewer_credential_assertion",
  "reviewer_trust_policy",
  "reviewer_revocation_snapshot",
  "release_attestation",
  "release_advisory",
]);

/**
 * T13 external-verifier boundary.
 *
 * Claimant records are inert inputs. This service derives one exact request,
 * invokes the configured verifier, verifies its receipt independently, then
 * recomputes policy, credential, scope, clock, role-conflict, and revocation
 * intersections before publishing an immutable status. It never publishes an
 * Activation Decision.
 */
export class ReviewerAuthorityService {
  private readonly publicationStore: KnowledgePublicationStore;
  private readonly verifier: ExternalReviewerVerifier | undefined;
  private readonly verifyReceipt: ReviewerVerifierReceiptVerifier | undefined;
  private readonly now: () => Date;

  constructor(options: ReviewerAuthorityServiceOptions) {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    this.publicationStore = options.publicationStore;
    this.verifier = options.verifier;
    this.verifyReceipt = options.verifyReceipt;
    this.now = options.now ?? (() => new Date());
  }

  publishMaterials(
    materialsValue: readonly ReviewerAuthorityMaterial[],
    expectedHead: KnowledgePublicationGenerationRef
  ): KnowledgePublicationSnapshot {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const materials = materialsValue.map(validateMaterial);
    if (materials.length === 0) throw new ReviewerAuthorityIntegrityError("No materials supplied");
    assertUniqueMaterialRefs(materials);
    const writes = materials.map(materialWrite);
    const transaction = materialTransaction(writes, expectedHead);
    const published = this.publicationStore.publish(transaction);
    assertNoActivationDecisionIntroduced(published);
    for (const material of materials) requireContent(published, material.recordKind, material);
    return published;
  }

  async verify(
    input: ReviewerAuthorityVerificationRequest,
    signal?: AbortSignal
  ): Promise<
    Readonly<{
      verification: ReviewerAuthorityVerification;
      snapshot: KnowledgePublicationSnapshot;
    }>
  > {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    if (!this.verifier || !this.verifyReceipt) throw new ReviewerAuthorityUnavailableError();
    if (signal?.aborted) throw new ReviewerAuthorityCancelledError();
    const snapshot = requireCurrent(this.publicationStore);
    if (!sameGenerationRef(snapshot.generation, input.expectedHead)) {
      throw new ReviewerAuthorityConflictError();
    }
    const subject = loadSubject(snapshot, input.subjectRecordRef);
    const policy = requireContent(
      snapshot,
      "reviewer_trust_policy",
      input.trustPolicyRef,
      validateReviewerTrustPolicy
    );
    const identity = requireContent(
      snapshot,
      "reviewer_identity_snapshot",
      subject.identitySnapshotRef,
      validateReviewerIdentitySnapshot
    );
    const credentials = sortedUniqueRefs(input.credentialAssertionRefs).map((reference) =>
      requireContent(
        snapshot,
        "reviewer_credential_assertion",
        reference,
        validateReviewerCredentialAssertion
      )
    );
    const requestedScope = requireContent(
      snapshot,
      "reviewer_authority_scope",
      subject.requestedScopeRef,
      validateReviewerAuthorityScope
    );
    const revocations = sortedUniqueRefs(input.revocationSnapshotRefs).map((reference) =>
      requireContent(
        snapshot,
        "reviewer_revocation_snapshot",
        reference,
        validateReviewerRevocationSnapshot
      )
    );
    const verificationTime = this.now().toISOString();
    const requestWithoutDigest = {
      schemaVersion: 1 as const,
      requestId: `reviewer-verification-request.${referenceSourceDigest({
        subjectRecordRef: input.subjectRecordRef,
        trustPolicyRef: input.trustPolicyRef,
        credentials: credentials.map(reviewerAuthorityRef),
        revocations: revocations.map(reviewerAuthorityRef),
        verificationTime,
      }).slice(0, 40)}`,
      verificationKind: subject.verificationKind,
      subjectRecordRef: reviewerAuthorityRef(subject.record),
      identitySnapshotRef: reviewerAuthorityRef(identity),
      credentialAssertionRefs: credentials.map(reviewerAuthorityRef),
      requestedScopeRef: reviewerAuthorityRef(requestedScope),
      trustPolicyRef: reviewerAuthorityRef(policy),
      revocationSnapshotRefs: revocations.map(reviewerAuthorityRef),
      verificationTime,
    };
    const request = Value.Decode(
      // Decode through the public schema indirectly by binding the digest helper's type.
      // The verifier receives no publication-store objects or claimant-selected verifier identity.
      ReviewerVerifierRequestSchema,
      {
        ...requestWithoutDigest,
        requestDigest: reviewerVerifierRequestDigest(requestWithoutDigest),
      }
    );
    const receipt = validateReviewerVerifierReceipt(await this.verifier.verify(request, signal));
    if (signal?.aborted) throw new ReviewerAuthorityCancelledError();
    const receiptSignatureValid = await this.verifyReceipt(receipt);
    const context: EvaluationContext = {
      snapshot,
      subject,
      policy,
      identity,
      credentials,
      requestedScope,
      revocations,
      request,
      receipt,
      receiptSignatureValid,
      allIdentityCredentials: loadIdentityCredentials(snapshot, identity),
    };
    const decision = decide(context);
    const verification = buildVerification(context, decision);
    const writes = verificationWrites(context, decision, verification, snapshot);
    const transaction = verificationTransaction(request, verification, writes, input.expectedHead);
    const published = this.publicationStore.publish(transaction);
    assertNoActivationDecisionIntroduced(published);
    await assertVerificationMintEnvelope(published, transaction, verification, this.verifyReceipt);
    return Object.freeze({ verification, snapshot: published });
  }

  /**
   * Publish a successor when an already verified receipt, credential, policy,
   * or revocation snapshot crosses a pinned validity boundary. This does not
   * call the external verifier and can only remove authority; a fresh positive
   * result still requires verify().
   */
  async refreshCurrentStatus(input: ReviewerAuthorityStatusRefreshRequest): Promise<
    Readonly<{
      verification: ReviewerAuthorityVerification;
      snapshot: KnowledgePublicationSnapshot;
    }>
  > {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    if (!this.verifyReceipt) throw new ReviewerAuthorityUnavailableError();
    const snapshot = requireCurrent(this.publicationStore);
    if (!sameGenerationRef(snapshot.generation, input.expectedHead)) {
      throw new ReviewerAuthorityConflictError();
    }
    const previous = loadVerification(snapshot, input.verificationRef);
    const latest = latestVerificationPerFamily(
      snapshot.records
        .filter(({ recordKind }) => recordKind === previous.recordKind)
        .map(({ content }) =>
          previous.recordKind === "attestation_verification"
            ? validateAttestationVerification(content)
            : validateAdvisoryVerification(content)
        )
        .filter(({ familyId }) => familyId === previous.familyId)
    )[0];
    if (!latest || !refsEqual(latest, previous)) {
      throw new ReviewerAuthorityConflictError();
    }
    const subject = loadSubject(snapshot, previous.subjectRecordRef);
    const policy = requireContent(
      snapshot,
      "reviewer_trust_policy",
      previous.verifierPolicyRef,
      validateReviewerTrustPolicy
    );
    const identity = requireContent(
      snapshot,
      "reviewer_identity_snapshot",
      previous.reviewerIdentitySnapshotRef,
      validateReviewerIdentitySnapshot
    );
    const credentials = previous.credentialAssertionRefs.map((reference) =>
      requireContent(
        snapshot,
        "reviewer_credential_assertion",
        reference,
        validateReviewerCredentialAssertion
      )
    );
    const requestedScope = requireContent(
      snapshot,
      "reviewer_authority_scope",
      subject.requestedScopeRef,
      validateReviewerAuthorityScope
    );
    const revocations = previous.revocationSnapshotRefs.map((reference) =>
      requireContent(
        snapshot,
        "reviewer_revocation_snapshot",
        reference,
        validateReviewerRevocationSnapshot
      )
    );
    const receipt = requireContent(
      snapshot,
      "reviewer_verifier_receipt",
      previous.receiptRef,
      validateReviewerVerifierReceipt
    );
    const verificationTime = this.now().toISOString();
    const request: ReviewerVerifierRequest = {
      schemaVersion: 1,
      requestId: `reviewer-status-refresh.${referenceSourceDigest({
        previous: reviewerAuthorityRef(previous),
        verificationTime,
      }).slice(0, 40)}`,
      verificationKind: subject.verificationKind,
      subjectRecordRef: reviewerAuthorityRef(subject.record),
      identitySnapshotRef: reviewerAuthorityRef(identity),
      credentialAssertionRefs: credentials.map(reviewerAuthorityRef),
      requestedScopeRef: reviewerAuthorityRef(requestedScope),
      trustPolicyRef: reviewerAuthorityRef(policy),
      revocationSnapshotRefs: revocations.map(reviewerAuthorityRef),
      verificationTime,
      requestDigest: receipt.requestDigest,
    };
    const context: EvaluationContext = {
      snapshot,
      subject,
      policy,
      identity,
      credentials,
      requestedScope,
      revocations,
      request,
      receipt,
      receiptSignatureValid: await this.verifyReceipt(receipt),
      allIdentityCredentials: loadIdentityCredentials(snapshot, identity),
    };
    const decision = decide(context);
    if (decision.result === previous.result && decision.reason === previous.reason) {
      throw new ReviewerAuthorityNoStatusChangeError();
    }
    if (decision.result === "verified_authorized") {
      throw new ReviewerAuthorityIntegrityError(
        "A local status refresh cannot create positive reviewer authority"
      );
    }
    const verification = buildVerification(context, decision);
    const writes = verificationWrites(context, decision, verification, snapshot);
    const transaction = verificationTransaction(request, verification, writes, input.expectedHead);
    const published = this.publicationStore.publish(transaction);
    assertNoActivationDecisionIntroduced(published);
    await assertVerificationMintEnvelope(published, transaction, verification, this.verifyReceipt);
    return Object.freeze({ verification, snapshot: published });
  }

  async readWorkbench(): Promise<ReviewerAuthorityWorkbenchProjection> {
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const snapshot = this.publicationStore.readCurrent();
    if (!snapshot) return unconfiguredProjection(false);
    const policies = snapshot.records
      .filter(({ recordKind }) => recordKind === "reviewer_trust_policy")
      .map(({ content }) => validateReviewerTrustPolicy(content));
    if (policies.length === 0) return unconfiguredProjection(hasActivationDecision(snapshot));
    const currentPolicy = selectCurrentPolicy(policies);
    const scopes = new Map(
      snapshot.records
        .filter(({ recordKind }) => recordKind === "reviewer_authority_scope")
        .map(({ content }) => validateReviewerAuthorityScope(content))
        .map((scope) => [refKey(scope), scope] as const)
    );
    const receipts = new Map(
      snapshot.records
        .filter(({ recordKind }) => recordKind === "reviewer_verifier_receipt")
        .map(({ content }) => validateReviewerVerifierReceipt(content))
        .map((receipt) => [refKey(receipt), receipt] as const)
    );
    const verifications = snapshot.records
      .filter(
        ({ recordKind }) =>
          recordKind === "attestation_verification" || recordKind === "advisory_verification"
      )
      .map(({ recordKind, content }) =>
        recordKind === "attestation_verification"
          ? validateAttestationVerification(content)
          : validateAdvisoryVerification(content)
      );
    const currentVerifications = latestVerificationPerFamily(verifications);
    const verifiedSummaries = [];
    for (const verification of currentVerifications) {
      const receipt = receipts.get(refKey(verification.receiptRef));
      if (!receipt || !this.verifyReceipt || !(await this.verifyReceipt(receipt))) {
        verifiedSummaries.push(projectUntrustedVerification(verification));
        continue;
      }
      if (!persistedVerificationMatchesDecision(snapshot, verification, receipt)) {
        verifiedSummaries.push(projectUntrustedVerification(verification));
        continue;
      }
      verifiedSummaries.push(projectVerification(verification, scopes, this.now().getTime()));
    }
    const identities = snapshot.records
      .filter(({ recordKind }) => recordKind === "reviewer_identity_snapshot")
      .map(({ content }) => validateReviewerIdentitySnapshot(content));
    const credentials = snapshot.records
      .filter(({ recordKind }) => recordKind === "reviewer_credential_assertion")
      .map(({ content }) => validateReviewerCredentialAssertion(content));
    const revocations = snapshot.records
      .filter(({ recordKind }) => recordKind === "reviewer_revocation_snapshot")
      .map(({ content }) => validateReviewerRevocationSnapshot(content));
    return Value.Decode(ReviewerAuthorityWorkbenchProjectionSchema, {
      schemaVersion: 1,
      state: "configured",
      boundary: "external_verifier_required",
      policy: {
        policyRef: reviewerAuthorityRef(currentPolicy),
        policyVersion: currentPolicy.policyVersion,
        validFrom: currentPolicy.validFrom,
        validUntil: currentPolicy.validUntil ?? null,
        clockPolicyRef: currentPolicy.clockPolicy.policyRef,
        maximumClockSkewMs: currentPolicy.clockPolicy.maximumClockSkewMs,
        maximumReceiptAgeMs: currentPolicy.clockPolicy.maximumReceiptAgeMs,
        maximumRevocationAgeMs: currentPolicy.clockPolicy.maximumRevocationAgeMs,
        verifierCount: currentPolicy.authorizedVerifiers.length,
        revocationSourceCount: currentPolicy.revocationSourceRefs.length,
        synthetic: currentPolicy.environment === "synthetic_test",
      },
      verifications: verifiedSummaries,
      roleConflicts: projectRoleConflicts(
        currentPolicy,
        identities,
        credentials,
        revocations,
        this.now().getTime()
      ),
      activationDecisionState: hasActivationDecision(snapshot)
        ? "outside_t13_scope"
        : "not_present",
    });
  }
}

function persistedVerificationMatchesDecision(
  snapshot: KnowledgePublicationSnapshot,
  verification: ReviewerAuthorityVerification,
  receipt: ReviewerVerifierReceipt
): boolean {
  try {
    const subject = loadSubject(snapshot, verification.subjectRecordRef);
    const policy = requireContent(
      snapshot,
      "reviewer_trust_policy",
      verification.verifierPolicyRef,
      validateReviewerTrustPolicy
    );
    const identity = requireContent(
      snapshot,
      "reviewer_identity_snapshot",
      verification.reviewerIdentitySnapshotRef,
      validateReviewerIdentitySnapshot
    );
    const credentials = verification.credentialAssertionRefs.map((reference) =>
      requireContent(
        snapshot,
        "reviewer_credential_assertion",
        reference,
        validateReviewerCredentialAssertion
      )
    );
    const requestedScope = requireContent(
      snapshot,
      "reviewer_authority_scope",
      subject.requestedScopeRef,
      validateReviewerAuthorityScope
    );
    const revocations = verification.revocationSnapshotRefs.map((reference) =>
      requireContent(
        snapshot,
        "reviewer_revocation_snapshot",
        reference,
        validateReviewerRevocationSnapshot
      )
    );
    const request: ReviewerVerifierRequest = {
      schemaVersion: 1,
      requestId: `persisted-verification.${verification.digest.slice(0, 32)}`,
      verificationKind: subject.verificationKind,
      subjectRecordRef: reviewerAuthorityRef(subject.record),
      identitySnapshotRef: reviewerAuthorityRef(identity),
      credentialAssertionRefs: credentials.map(reviewerAuthorityRef),
      requestedScopeRef: reviewerAuthorityRef(requestedScope),
      trustPolicyRef: reviewerAuthorityRef(policy),
      revocationSnapshotRefs: revocations.map(reviewerAuthorityRef),
      verificationTime: verification.checkedAt,
      requestDigest: receipt.requestDigest,
    };
    const context: EvaluationContext = {
      snapshot,
      subject,
      policy,
      identity,
      credentials,
      requestedScope,
      revocations,
      request,
      receipt,
      receiptSignatureValid: true,
      allIdentityCredentials: loadIdentityCredentials(snapshot, identity),
    };
    const decision = decide(context);
    if (decision.result !== verification.result || decision.reason !== verification.reason) {
      return false;
    }
    if (decision.result === "verified_authorized" || decision.result === "verified_out_of_scope") {
      if (
        verification.evaluatedScopeRef === undefined ||
        verification.authorizationScopeRef === undefined ||
        !refsEqual(verification.evaluatedScopeRef, requestedScope) ||
        !decision.authorizationScope ||
        !refsEqual(verification.authorizationScopeRef, decision.authorizationScope)
      ) {
        return false;
      }
    } else if (
      verification.evaluatedScopeRef !== undefined ||
      verification.authorizationScopeRef !== undefined
    ) {
      return false;
    }
    const environment = verificationEnvironment(context);
    const expectedDisposition =
      decision.result === "verified_authorized"
        ? environment === "synthetic_test"
          ? "synthetic_test_no_authority"
          : "eligible_for_later_resolution"
        : "none";
    return (
      verification.environment === environment &&
      verification.authorityDisposition === expectedDisposition &&
      verification.humanAuthority ===
        (decision.result === "verified_authorized" &&
          environment === "production" &&
          subject.record.environment === "production" &&
          subjectCanConferHumanAuthority(subject)) &&
      verification.activationDecisionPublished === false
    );
  } catch {
    return false;
  }
}

function decide(context: EvaluationContext): Decision {
  const now = Date.parse(context.request.verificationTime);
  const clock = context.policy.clockPolicy;
  const policyStart = Date.parse(context.policy.validFrom);
  const policyEnd = context.policy.validUntil ? Date.parse(context.policy.validUntil) : Infinity;
  if (now < policyStart) return failure("unverified", "policy_not_yet_valid", "current", "clear");
  if (now >= policyEnd) return failure("unverified", "policy_expired", "expired", "clear");
  if (!receiptBindsRequest(context)) {
    return failure("unverified", "receipt_binding_mismatch", "current", "clear");
  }
  if (!context.receiptSignatureValid) {
    return failure("unverified", "receipt_signature_invalid", "current", "clear");
  }
  const receiptTime = Date.parse(context.receipt.checkedAt);
  if (receiptTime - now > clock.maximumClockSkewMs) {
    return failure("unverified", "clock_policy_mismatch", "stale", "clear");
  }
  if (now - receiptTime > clock.maximumReceiptAgeMs) {
    return failure("unverified", "verification_stale", "stale", "clear");
  }
  if (context.receipt.validUntil && now >= Date.parse(context.receipt.validUntil)) {
    return failure("unverified", "verification_stale", "expired", "clear");
  }
  const verifier = authorizedVerifier(context);
  if (!verifier) return failure("unverified", "unauthorized_verifier", "current", "clear");
  if (context.receipt.result !== "authenticated") {
    return failure("unverified", "provider_rejected", "current", "clear");
  }
  if (!refsEqual(context.identity, context.receipt.identitySnapshotRef)) {
    return failure("unverified", "subject_ambiguous", "current", "clear");
  }
  if (!requestedScopeIsComplete(context)) {
    return failure("unverified", "missing_scope", "current", "clear");
  }
  if (
    context.credentials.some((credential) =>
      refsEqual(credential.issuerIdentityRef, context.identity.subjectRef)
    )
  ) {
    return failure("unverified", "self_issued_credential", "current", "clear");
  }
  if (
    context.credentials.some(
      (credential) =>
        !refsEqual(credential.reviewerIdentitySnapshotRef, context.identity) ||
        credential.reviewerRole !== context.subject.reviewerRole
    )
  ) {
    return failure("unverified", "subject_ambiguous", "current", "clear");
  }
  if (hasRoleConflict(context)) {
    return failure("unverified", "role_conflict", "current", "clear");
  }
  const credentialKind =
    context.subject.verificationKind === "attestation" ? "reviewer_role" : "advisory_issuer";
  if (
    !verifier.credentialKinds.includes(credentialKind) ||
    context.credentials.some(({ kind }) => kind !== credentialKind)
  ) {
    return failure("unverified", "unsupported_credential_kind", "current", "clear");
  }
  if (
    context.subject.advisoryKind &&
    (!verifier.advisoryKinds.includes(context.subject.advisoryKind) ||
      !context.requestedScope.advisoryKinds.includes(context.subject.advisoryKind))
  ) {
    return failure("unverified", "unsupported_advisory_kind", "current", "clear");
  }
  if (!verifier.subjectKinds.includes(context.subject.subjectKind)) {
    return failure("unverified", "subject_ambiguous", "current", "clear");
  }
  if (!verifier.reviewerRoles.includes(context.subject.reviewerRole)) {
    return failure("unverified", "scope_intersection_failed", "current", "clear");
  }
  for (const credential of context.credentials) {
    const start = Date.parse(credential.validFrom);
    const end = credential.validUntil ? Date.parse(credential.validUntil) : Infinity;
    if (now < start) return failure("unverified", "credential_not_yet_valid", "current", "clear");
    if (now >= end) return failure("unverified", "credential_expired", "expired", "clear");
  }
  const revocationDecision = evaluateRevocation(context, now);
  if (revocationDecision) return revocationDecision;
  const policyScope = requireContent(
    context.snapshot,
    "reviewer_authority_scope",
    verifier.authorizationScopeRef,
    validateReviewerAuthorityScope
  );
  const credentialScopes = context.credentials.map((credential) =>
    requireContent(
      context.snapshot,
      "reviewer_authority_scope",
      credential.scopeRef,
      validateReviewerAuthorityScope
    )
  );
  const authorizationScope = intersectScopes(
    `reviewer-authority-intersection.${context.request.requestDigest}`,
    [policyScope, ...credentialScopes]
  );
  const validUntil = minimumTimestamp([
    context.policy.validUntil,
    context.receipt.validUntil,
    ...context.credentials.map(({ validUntil }) => validUntil),
    ...context.revocations.map(({ validUntil }) => validUntil),
  ]);
  if (!scopeCovers(authorizationScope, context.requestedScope)) {
    return {
      result: "verified_out_of_scope",
      reason: "scope_intersection_failed",
      authorizationScope,
      ...(validUntil ? { validUntil } : {}),
      freshness: "current",
      revocation: "clear",
    };
  }
  return {
    result: "verified_authorized",
    reason: "authorized",
    authorizationScope,
    ...(validUntil ? { validUntil } : {}),
    freshness: "current",
    revocation: "clear",
  };
}

function buildVerification(
  context: EvaluationContext,
  decision: Decision
): ReviewerAuthorityVerification {
  const environment = verificationEnvironment(context);
  const authorityDisposition: ReviewerAuthorityVerification["authorityDisposition"] =
    decision.result === "verified_authorized"
      ? environment === "synthetic_test"
        ? "synthetic_test_no_authority"
        : "eligible_for_later_resolution"
      : "none";
  const humanAuthority =
    decision.result === "verified_authorized" &&
    environment === "production" &&
    context.subject.record.environment === "production" &&
    subjectCanConferHumanAuthority(context.subject);
  const familyId = `${context.subject.verificationKind}-verification.${context.subject.record.id}`;
  const common = {
    schemaVersion: 1 as const,
    id: `${familyId}.${referenceSourceDigest({ request: context.request.requestDigest, decision }).slice(0, 32)}`,
    familyId,
    subjectRecordRef: reviewerAuthorityRef(context.subject.record),
    verifierPolicyRef: reviewerAuthorityRef(context.policy),
    verifierIdentityRef: context.receipt.verifierIdentityRef,
    verifierComponentRef: context.receipt.verifierComponentRef,
    reviewerIdentitySnapshotRef: reviewerAuthorityRef(context.identity),
    credentialAssertionRefs: context.credentials.map(reviewerAuthorityRef),
    verificationMethodRef: context.receipt.verificationMethodRef,
    revocationSnapshotRefs: context.revocations.map(reviewerAuthorityRef),
    receiptRef: reviewerAuthorityRef(context.receipt),
    checkedAt: context.request.verificationTime,
    ...(decision.validUntil ? { validUntil: decision.validUntil } : {}),
    evidenceRefs: dedupeSortedRefs([
      ...context.receipt.evidenceRefs,
      ...context.credentials.flatMap(({ evidenceRefs }) => evidenceRefs),
      ...context.revocations.flatMap(({ evidenceRefs }) => evidenceRefs),
    ]),
    reviewerRole: context.subject.reviewerRole,
    disagreements: [...context.subject.disagreements],
    unclaimedDimensions: context.requestedScope.unclaimedDimensions,
    authorityDisposition,
    humanAuthority,
    activationDecisionPublished: false as const,
    environment,
    result: decision.result,
    reason: decision.reason,
  };
  if (decision.result === "verified_authorized" || decision.result === "verified_out_of_scope") {
    const scoped = {
      ...common,
      evaluatedScopeRef: reviewerAuthorityRef(context.requestedScope),
      authorizationScopeRef: reviewerAuthorityRef(decision.authorizationScope!),
    };
    return context.subject.verificationKind === "attestation"
      ? buildAttestationVerification({ recordKind: "attestation_verification", ...scoped })
      : buildAdvisoryVerification({ recordKind: "advisory_verification", ...scoped });
  }
  const unscoped = { ...common, result: decision.result as "unverified" | "revoked" };
  return context.subject.verificationKind === "attestation"
    ? buildAttestationVerification({ recordKind: "attestation_verification", ...unscoped })
    : buildAdvisoryVerification({ recordKind: "advisory_verification", ...unscoped });
}

function verificationWrites(
  context: EvaluationContext,
  decision: Decision,
  verification: ReviewerAuthorityVerification,
  snapshot: KnowledgePublicationSnapshot
): KnowledgePublicationWrite[] {
  const previous = latestVerificationPerFamily(
    snapshot.records
      .filter(
        (record) =>
          record.recordKind === verification.recordKind &&
          isRecordFamily(record.content, verification.familyId)
      )
      .map(({ content }) =>
        verification.recordKind === "attestation_verification"
          ? validateAttestationVerification(content)
          : validateAdvisoryVerification(content)
      )
  )[0];
  const writes: KnowledgePublicationWrite[] = [];
  if (decision.authorizationScope) writes.push(materialWrite(decision.authorizationScope));
  writes.push(materialWrite(context.receipt));
  writes.push({
    ...materialWrite(verification),
    successorRefs: previous ? [publicationRefForContent(snapshot, previous)] : [],
  });
  return writes;
}

function isRecordFamily(value: unknown, familyId: string): boolean {
  return isPlainRecord(value) && value.familyId === familyId;
}

function evaluateRevocation(context: EvaluationContext, now: number): Decision | null {
  const policySources = new Set(context.policy.revocationSourceRefs.map(refKey));
  const snapshotsBySource = new Map(
    context.revocations.map((snapshot) => [refKey(snapshot.sourceRef), snapshot])
  );
  const credentialSources = new Set(
    context.credentials.flatMap(({ revocationSourceRefs }) => revocationSourceRefs.map(refKey))
  );
  const requiredSources = new Set([...policySources, ...credentialSources]);
  if ([...requiredSources].some((source) => !snapshotsBySource.has(source))) {
    return failure("unverified", "revocation_status_stale", "stale", "unavailable");
  }
  for (const snapshot of context.revocations) {
    const observed = Date.parse(snapshot.observedAt);
    if (
      observed - now > context.policy.clockPolicy.maximumClockSkewMs ||
      now - observed > context.policy.clockPolicy.maximumRevocationAgeMs ||
      now >= Date.parse(snapshot.validUntil)
    ) {
      return failure("unverified", "revocation_status_stale", "stale", "unavailable");
    }
    if (snapshot.revokedIdentityRefs.some((reference) => refsEqual(reference, context.identity))) {
      return failure("revoked", "identity_revoked", "current", "revoked");
    }
    if (
      snapshot.revokedCredentialRefs.some((reference) =>
        context.credentials.some((credential) => refsEqual(reference, credential))
      )
    ) {
      return failure("revoked", "credential_revoked", "current", "revoked");
    }
  }
  return null;
}

function authorizedVerifier(context: EvaluationContext): AuthorizedReviewerVerifier | null {
  const matches = context.policy.authorizedVerifiers.filter(
    (entry) =>
      refsEqual(entry.verifierIdentityRef, context.receipt.verifierIdentityRef) &&
      refsEqual(entry.verifierComponentRef, context.receipt.verifierComponentRef) &&
      entry.trustRootRefs.some((reference) => refsEqual(reference, context.receipt.trustRootRef)) &&
      entry.verificationMethodRefs.some((reference) =>
        refsEqual(reference, context.receipt.verificationMethodRef)
      )
  );
  return matches.length === 1 ? matches[0]! : null;
}

function receiptBindsRequest(context: EvaluationContext): boolean {
  return (
    context.receipt.requestDigest === context.request.requestDigest &&
    refsEqual(context.receipt.identitySnapshotRef, context.request.identitySnapshotRef) &&
    sameRefSet(context.receipt.credentialAssertionRefs, context.request.credentialAssertionRefs)
  );
}

function hasRoleConflict(context: EvaluationContext): boolean {
  const now = Date.parse(context.request.verificationTime);
  const roles = new Set(
    context.allIdentityCredentials
      .filter((credential) => refsEqual(credential.reviewerIdentitySnapshotRef, context.identity))
      .filter((credential) => credentialIsCurrentAndClear(credential, context.revocations, now))
      .map(({ reviewerRole }) => reviewerRole)
  );
  return context.policy.roleConflicts.some(
    ([left, right]) => left !== right && roles.has(left) && roles.has(right)
  );
}

function credentialIsCurrentAndClear(
  credential: ReviewerCredentialAssertion,
  revocations: readonly ReviewerRevocationSnapshot[],
  now: number
): boolean {
  if (
    now < Date.parse(credential.validFrom) ||
    (credential.validUntil !== undefined && now >= Date.parse(credential.validUntil))
  ) {
    return false;
  }
  return !revocations.some((snapshot) =>
    snapshot.revokedCredentialRefs.some((reference) => refsEqual(reference, credential))
  );
}

function requestedScopeIsComplete(context: EvaluationContext): boolean {
  const scope = context.requestedScope;
  const expectedAction =
    context.subject.verificationKind === "advisory" ? "issue_advisory" : "attest_release";
  const artifactRef =
    context.subject.verificationKind === "attestation"
      ? context.subject.record.releaseRef
      : context.subject.record.subjectRef;
  return (
    scope.reviewerRoles.includes(context.subject.reviewerRole) &&
    scope.subjectKinds.includes(context.subject.subjectKind) &&
    scope.actions.includes(expectedAction) &&
    scope.subjectRefs.some((reference) => refsEqual(reference, artifactRef)) &&
    scope.artifactRefs.some((reference) => refsEqual(reference, artifactRef)) &&
    scope.applicabilityRefs.length > 0 &&
    scope.claimDimensions.length > 0 &&
    (context.subject.advisoryKind === null ||
      scope.advisoryKinds.includes(context.subject.advisoryKind))
  );
}

function subjectCanConferHumanAuthority(subject: EvaluationSubject): boolean {
  return (
    subject.verificationKind === "advisory" ||
    subject.record.kind === "owner_reviewed_local" ||
    subject.record.kind === "specialist_reviewed"
  );
}

function intersectScopes(
  id: string,
  scopes: readonly ReviewerAuthorityScope[]
): ReviewerAuthorityScope {
  const first = scopes[0];
  if (!first) throw new ReviewerAuthorityIntegrityError("Scope intersection is empty");
  const intersection = <T extends string>(values: readonly (readonly T[])[]): T[] =>
    [...new Set(values[0] ?? [])]
      .filter((value) => values.every((items) => items.includes(value)))
      .sort(compareCodePoints);
  const intersectRefs = (values: readonly (readonly ReviewerAuthorityRef[])[]) =>
    sortedUniqueRefs(values[0] ?? []).filter((reference) =>
      values.every((items) => items.some((candidate) => refsEqual(candidate, reference)))
    );
  return buildReviewerAuthorityScope({
    recordKind: "reviewer_authority_scope",
    schemaVersion: 1,
    id,
    reviewerRoles: intersection(scopes.map(({ reviewerRoles }) => reviewerRoles)),
    subjectKinds: intersection(scopes.map(({ subjectKinds }) => subjectKinds)),
    subjectRefs: intersectRefs(scopes.map(({ subjectRefs }) => subjectRefs)),
    actions: intersection(scopes.map(({ actions }) => actions)),
    artifactRefs: intersectRefs(scopes.map(({ artifactRefs }) => artifactRefs)),
    applicabilityRefs: intersectRefs(scopes.map(({ applicabilityRefs }) => applicabilityRefs)),
    claimDimensions: intersection(scopes.map(({ claimDimensions }) => claimDimensions)),
    advisoryKinds: intersection(scopes.map(({ advisoryKinds }) => advisoryKinds)),
    unclaimedDimensions: intersection(scopes.map(({ unclaimedDimensions }) => unclaimedDimensions)),
  });
}

function scopeCovers(
  authorization: ReviewerAuthorityScope,
  requested: ReviewerAuthorityScope
): boolean {
  return (
    setCovers(authorization.reviewerRoles, requested.reviewerRoles) &&
    setCovers(authorization.subjectKinds, requested.subjectKinds) &&
    refSetCovers(authorization.subjectRefs, requested.subjectRefs) &&
    setCovers(authorization.actions, requested.actions) &&
    refSetCovers(authorization.artifactRefs, requested.artifactRefs) &&
    refSetCovers(authorization.applicabilityRefs, requested.applicabilityRefs) &&
    setCovers(authorization.claimDimensions, requested.claimDimensions) &&
    setCovers(authorization.advisoryKinds, requested.advisoryKinds)
  );
}

function verificationEnvironment(context: EvaluationContext): "production" | "synthetic_test" {
  return [
    context.policy.environment,
    context.identity.environment,
    context.subject.record.environment,
    context.receipt.environment,
    ...context.credentials.map(({ environment }) => environment),
    ...context.revocations.map(({ environment }) => environment),
  ].every((environment) => environment === "production")
    ? "production"
    : "synthetic_test";
}

function loadSubject(
  snapshot: KnowledgePublicationSnapshot,
  reference: ReviewerAuthorityRef
): EvaluationSubject {
  const attestationRecords = matchingContents(snapshot, "release_attestation", reference);
  const advisoryRecords = matchingContents(snapshot, "release_advisory", reference);
  if (attestationRecords.length + advisoryRecords.length !== 1) {
    throw new ReviewerAuthorityIntegrityError("Reviewer authority subject is missing or ambiguous");
  }
  if (attestationRecords.length === 1) {
    const record = validateScopedReleaseAttestation(attestationRecords[0]);
    requireAnyContent(snapshot, "knowledge_pack_release", record.releaseRef);
    return {
      verificationKind: "attestation",
      record,
      identitySnapshotRef: record.reviewerIdentitySnapshotRef,
      requestedScopeRef: record.reviewScopeRef,
      reviewerRole: record.reviewerRole,
      subjectKind: "release_attestation",
      advisoryKind: null,
      disagreements: record.disagreements,
    };
  }
  const record = validateScopedReleaseAdvisory(advisoryRecords[0]);
  requireAnyContent(snapshot, undefined, record.subjectRef);
  return {
    verificationKind: "advisory",
    record,
    identitySnapshotRef: record.issuerIdentitySnapshotRef,
    requestedScopeRef: record.requestedScopeRef,
    reviewerRole: record.issuerRole,
    subjectKind: "release_advisory",
    advisoryKind: record.kind,
    disagreements: [],
  };
}

function loadVerification(
  snapshot: KnowledgePublicationSnapshot,
  reference: ReviewerAuthorityRef
): ReviewerAuthorityVerification {
  const attestations = matchingContents(snapshot, "attestation_verification", reference);
  const advisories = matchingContents(snapshot, "advisory_verification", reference);
  if (attestations.length + advisories.length !== 1) {
    throw new ReviewerAuthorityIntegrityError("Verification status is missing or ambiguous");
  }
  return attestations.length === 1
    ? validateAttestationVerification(attestations[0])
    : validateAdvisoryVerification(advisories[0]);
}

function loadIdentityCredentials(
  snapshot: KnowledgePublicationSnapshot,
  identity: ReviewerIdentitySnapshot
): ReviewerCredentialAssertion[] {
  return snapshot.records
    .filter(({ recordKind }) => recordKind === "reviewer_credential_assertion")
    .map(({ content }) => validateReviewerCredentialAssertion(content))
    .filter(({ reviewerIdentitySnapshotRef }) => refsEqual(reviewerIdentitySnapshotRef, identity));
}

function materialWrite(
  material: ReviewerAuthorityMaterial | ReviewerVerifierReceipt | ReviewerAuthorityVerification
): KnowledgePublicationWrite {
  if (
    !MATERIAL_KINDS.has(material.recordKind as KnowledgePublicationRecordKind) &&
    material.recordKind !== "reviewer_verifier_receipt" &&
    material.recordKind !== "attestation_verification" &&
    material.recordKind !== "advisory_verification"
  ) {
    throw new ReviewerAuthorityIntegrityError("Unsupported reviewer authority record kind");
  }
  return {
    recordKind: material.recordKind as KnowledgePublicationRecordKind,
    id: `published.${material.recordKind}.${material.digest}`,
    successorRefs: [],
    content: material,
  };
}

function materialTransaction(
  writes: readonly KnowledgePublicationWrite[],
  expectedHead: KnowledgePublicationGenerationRef
): KnowledgePublicationTransaction {
  return {
    schemaVersion: 1,
    transactionId: `reviewer-authority-materials.${referenceSourceDigest({ writes, expectedHead }).slice(0, 40)}`,
    writerKind: "review",
    expectedHead,
    writes: [...writes],
  };
}

function verificationTransaction(
  request: ReviewerVerifierRequest,
  verification: ReviewerAuthorityVerification,
  writes: readonly KnowledgePublicationWrite[],
  expectedHead: KnowledgePublicationGenerationRef
): KnowledgePublicationTransaction {
  return {
    schemaVersion: 1,
    transactionId: `reviewer-authority-verification.${referenceSourceDigest({
      requestDigest: request.requestDigest,
      verificationRef: reviewerAuthorityRef(verification),
    }).slice(0, 40)}`,
    writerKind: "review",
    expectedHead,
    writes: [...writes],
  };
}

async function assertVerificationMintEnvelope(
  snapshot: KnowledgePublicationSnapshot,
  transaction: KnowledgePublicationTransaction,
  verification: ReviewerAuthorityVerification,
  verifyReceipt: ReviewerVerifierReceiptVerifier
): Promise<void> {
  if (
    snapshot.generation.transactionId !== transaction.transactionId ||
    snapshot.generation.writerKind !== "review"
  ) {
    throw new ReviewerAuthorityIntegrityError("Verification mint envelope is invalid");
  }
  const verificationWrite = transaction.writes.find(
    (write) =>
      write.recordKind === verification.recordKind &&
      isPlainRecord(write.content) &&
      write.content.digest === verification.digest
  );
  if (!verificationWrite)
    throw new ReviewerAuthorityIntegrityError(
      "Verification was not introduced by its adapter transaction"
    );
  const verificationRef = knowledgePublicationRecordRefForWrite(verificationWrite);
  if (
    !snapshot.generation.newRecordRefs.some((reference) =>
      publicationRefsEqual(reference, verificationRef)
    )
  ) {
    throw new ReviewerAuthorityIntegrityError(
      "Verification mint envelope omitted the verification record"
    );
  }
  const receipt = requireContent(
    snapshot,
    "reviewer_verifier_receipt",
    verification.receiptRef,
    validateReviewerVerifierReceipt
  );
  const receiptValid = await verifyReceipt(receipt);
  if (
    (verification.reason === "receipt_signature_invalid" && receiptValid) ||
    (verification.reason !== "receipt_signature_invalid" && !receiptValid)
  ) {
    throw new ReviewerAuthorityIntegrityError(
      "Persisted verifier receipt validity does not match its fail-closed status"
    );
  }
}

function validateMaterial(value: ReviewerAuthorityMaterial): ReviewerAuthorityMaterial {
  switch (value.recordKind) {
    case "reviewer_authority_scope":
      return validateReviewerAuthorityScope(value);
    case "reviewer_identity_snapshot":
      return validateReviewerIdentitySnapshot(value);
    case "reviewer_credential_assertion":
      return validateReviewerCredentialAssertion(value);
    case "reviewer_trust_policy":
      return validateReviewerTrustPolicy(value);
    case "reviewer_revocation_snapshot":
      return validateReviewerRevocationSnapshot(value);
    case "release_attestation":
      return validateScopedReleaseAttestation(value);
    case "release_advisory":
      return validateScopedReleaseAdvisory(value);
  }
}

function requireCurrent(store: KnowledgePublicationStore): KnowledgePublicationSnapshot {
  const snapshot = store.readCurrent();
  if (!snapshot) throw new ReviewerAuthorityUnavailableError();
  return snapshot;
}

function requireContent<T>(
  snapshot: KnowledgePublicationSnapshot,
  recordKind: KnowledgePublicationRecordKind,
  reference: ReviewerAuthorityRef,
  validate?: (value: unknown) => T
): T {
  const matches = matchingContents(snapshot, recordKind, reference);
  if (matches.length !== 1)
    throw new ReviewerAuthorityIntegrityError(
      "Referenced authority record is missing or ambiguous"
    );
  return validate ? validate(matches[0]) : (matches[0] as T);
}

function requireAnyContent(
  snapshot: KnowledgePublicationSnapshot,
  recordKind: KnowledgePublicationRecordKind | undefined,
  reference: ReviewerAuthorityRef
): unknown {
  const matches = snapshot.records.filter(
    (record) =>
      (recordKind === undefined || record.recordKind === recordKind) &&
      isPlainRecord(record.content) &&
      record.content.id === reference.id &&
      record.content.digest === reference.digest
  );
  if (matches.length !== 1)
    throw new ReviewerAuthorityIntegrityError("Exact subject record is missing or ambiguous");
  return matches[0]!.content;
}

function matchingContents(
  snapshot: KnowledgePublicationSnapshot,
  recordKind: KnowledgePublicationRecordKind,
  reference: ReviewerAuthorityRef
): unknown[] {
  return snapshot.records
    .filter(
      (record) =>
        record.recordKind === recordKind &&
        isPlainRecord(record.content) &&
        record.content.id === reference.id &&
        record.content.digest === reference.digest
    )
    .map(({ content }) => content);
}

function publicationRefForContent(
  snapshot: KnowledgePublicationSnapshot,
  content: ReviewerAuthorityVerification
) {
  const matches = snapshot.records.filter(
    (record) =>
      record.recordKind === content.recordKind &&
      isPlainRecord(record.content) &&
      record.content.id === content.id &&
      record.content.digest === content.digest
  );
  if (matches.length !== 1)
    throw new ReviewerAuthorityIntegrityError("Predecessor verification is missing");
  const record = matches[0]!;
  return { recordKind: record.recordKind, id: record.id, digest: record.digest };
}

function assertUniqueMaterialRefs(materials: readonly ReviewerAuthorityMaterial[]): void {
  const keys = materials.map(refKey);
  if (new Set(keys).size !== keys.length)
    throw new ReviewerAuthorityIntegrityError("Duplicate material ref");
}

function assertNoActivationDecisionIntroduced(snapshot: KnowledgePublicationSnapshot): void {
  if (
    snapshot.generation.newRecordRefs.some(({ recordKind }) => recordKind === "activation_decision")
  ) {
    throw new ReviewerAuthorityIntegrityError("T13 cannot publish an Activation Decision");
  }
}

function sameGenerationRef(
  generation: KnowledgePublicationSnapshot["generation"],
  reference: KnowledgePublicationGenerationRef
): boolean {
  return (
    generation.id === reference.id &&
    generation.digest === reference.digest &&
    generation.revision === reference.revision
  );
}

function refsEqual(
  left: { id: string; digest: string },
  right: { id: string; digest: string }
): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function refKey(value: { id: string; digest: string }): string {
  return `${value.id}\u0000${value.digest}`;
}

function sortedUniqueRefs<T extends ReviewerAuthorityRef>(values: readonly T[]): T[] {
  const sorted = [...values].sort((left, right) => compareCodePoints(refKey(left), refKey(right)));
  if (new Set(sorted.map(refKey)).size !== sorted.length) {
    throw new ReviewerAuthorityIntegrityError("Duplicate authority ref");
  }
  return sorted;
}

function dedupeSortedRefs<T extends ReviewerAuthorityRef>(values: readonly T[]): T[] {
  const unique = new Map(values.map((value) => [refKey(value), value] as const));
  return [...unique.values()].sort((left, right) => compareCodePoints(refKey(left), refKey(right)));
}

function sameRefSet(
  left: readonly ReviewerAuthorityRef[],
  right: readonly ReviewerAuthorityRef[]
): boolean {
  return (
    canonicalReferenceJson(sortedUniqueRefs(left)) ===
    canonicalReferenceJson(sortedUniqueRefs(right))
  );
}

function refSetCovers(
  available: readonly ReviewerAuthorityRef[],
  requested: readonly ReviewerAuthorityRef[]
): boolean {
  return requested.every((reference) =>
    available.some((candidate) => refsEqual(candidate, reference))
  );
}

function setCovers<T extends string>(available: readonly T[], requested: readonly T[]): boolean {
  const values = new Set(available);
  return requested.every((value) => values.has(value));
}

function minimumTimestamp(values: readonly (string | undefined)[]): string | undefined {
  return values.filter((value): value is string => value !== undefined).sort(compareCodePoints)[0];
}

function failure(
  result: "unverified" | "revoked",
  reason: ReviewerVerificationReason,
  freshness: Decision["freshness"],
  revocation: Decision["revocation"]
): Decision {
  return { result, reason, freshness, revocation };
}

function selectCurrentPolicy(policies: readonly ReviewerTrustPolicy[]): ReviewerTrustPolicy {
  const sorted = [...policies].sort(
    (left, right) =>
      right.policyVersion - left.policyVersion || compareCodePoints(right.digest, left.digest)
  );
  if (sorted.length > 1 && sorted[0]!.policyVersion === sorted[1]!.policyVersion) {
    throw new ReviewerAuthorityIntegrityError("Current reviewer Trust Policy is ambiguous");
  }
  return sorted[0]!;
}

function latestVerificationPerFamily<T extends ReviewerAuthorityVerification>(
  values: readonly T[]
): T[] {
  const latest = new Map<string, T>();
  for (const value of values) {
    const current = latest.get(value.familyId);
    if (
      !current ||
      value.checkedAt > current.checkedAt ||
      (value.checkedAt === current.checkedAt && value.digest > current.digest)
    ) {
      latest.set(value.familyId, value);
    }
  }
  return [...latest.values()].sort((left, right) =>
    compareCodePoints(left.familyId, right.familyId)
  );
}

function projectVerification(
  verification: ReviewerAuthorityVerification,
  scopes: ReadonlyMap<string, ReviewerAuthorityScope>,
  now: number
) {
  const evaluatedScope =
    verification.evaluatedScopeRef !== undefined
      ? scopes.get(refKey(verification.evaluatedScopeRef))
      : undefined;
  const authorizationScope =
    verification.authorizationScopeRef !== undefined
      ? scopes.get(refKey(verification.authorizationScopeRef))
      : undefined;
  if (
    (verification.evaluatedScopeRef !== undefined && !evaluatedScope) ||
    (verification.authorizationScopeRef !== undefined && !authorizationScope)
  ) {
    throw new ReviewerAuthorityIntegrityError("Verification scope closure is incomplete");
  }
  const freshness =
    verification.validUntil && now >= Date.parse(verification.validUntil) ? "expired" : "current";
  return {
    verificationRef: reviewerAuthorityRef(verification),
    verificationKind:
      verification.recordKind === "attestation_verification" ? "attestation" : "advisory",
    subjectRef: verification.subjectRecordRef,
    reviewerIdentityRef: verification.reviewerIdentitySnapshotRef,
    reviewerRole: verification.reviewerRole,
    verifierPolicyRef: verification.verifierPolicyRef,
    verifierIdentityRef: verification.verifierIdentityRef,
    verifierComponentRef: verification.verifierComponentRef,
    result: freshness === "expired" ? "unverified" : verification.result,
    reason: freshness === "expired" ? "credential_expired" : verification.reason,
    checkedAt: verification.checkedAt,
    validUntil: verification.validUntil ?? null,
    freshness,
    revocation: verification.result === "revoked" ? "revoked" : "clear",
    evaluatedScope: evaluatedScope ? projectScope(evaluatedScope) : null,
    authorizationScope: authorizationScope ? projectScope(authorizationScope) : null,
    authorityConferred:
      freshness === "current" &&
      verification.result === "verified_authorized" &&
      verification.authorityDisposition === "eligible_for_later_resolution",
    humanAuthority:
      freshness === "current" &&
      verification.result === "verified_authorized" &&
      verification.humanAuthority,
    synthetic: verification.environment === "synthetic_test",
    sourceRefs: verification.evidenceRefs,
    disagreements: verification.disagreements,
    unclaimedDimensions: verification.unclaimedDimensions,
  };
}

function projectUntrustedVerification(verification: ReviewerAuthorityVerification) {
  return {
    verificationRef: reviewerAuthorityRef(verification),
    verificationKind:
      verification.recordKind === "attestation_verification" ? "attestation" : "advisory",
    subjectRef: verification.subjectRecordRef,
    reviewerIdentityRef: verification.reviewerIdentitySnapshotRef,
    reviewerRole: verification.reviewerRole,
    verifierPolicyRef: verification.verifierPolicyRef,
    verifierIdentityRef: verification.verifierIdentityRef,
    verifierComponentRef: verification.verifierComponentRef,
    result: "unverified" as const,
    reason: "receipt_signature_invalid",
    checkedAt: verification.checkedAt,
    validUntil: verification.validUntil ?? null,
    freshness: "stale" as const,
    revocation: "unavailable" as const,
    evaluatedScope: null,
    authorizationScope: null,
    authorityConferred: false,
    humanAuthority: false,
    synthetic: verification.environment === "synthetic_test",
    sourceRefs: verification.evidenceRefs,
    disagreements: verification.disagreements,
    unclaimedDimensions: verification.unclaimedDimensions,
  };
}

function projectScope(scope: ReviewerAuthorityScope) {
  return {
    scopeRef: reviewerAuthorityRef(scope),
    roles: scope.reviewerRoles,
    subjectKinds: scope.subjectKinds,
    actions: scope.actions,
    artifactCount: scope.artifactRefs.length,
    applicabilityCount: scope.applicabilityRefs.length,
    dimensions: scope.claimDimensions,
    advisoryKinds: scope.advisoryKinds,
  };
}

function projectRoleConflicts(
  policy: ReviewerTrustPolicy,
  identities: readonly ReviewerIdentitySnapshot[],
  credentials: readonly ReviewerCredentialAssertion[],
  revocations: readonly ReviewerRevocationSnapshot[],
  now: number
) {
  const result = [];
  for (const identity of identities) {
    const roles = new Set(
      credentials
        .filter(({ reviewerIdentitySnapshotRef }) =>
          refsEqual(reviewerIdentitySnapshotRef, identity)
        )
        .filter((credential) => credentialIsCurrentAndClear(credential, revocations, now))
        .map(({ reviewerRole }) => reviewerRole)
    );
    for (const [leftRole, rightRole] of policy.roleConflicts) {
      if (leftRole !== rightRole && roles.has(leftRole) && roles.has(rightRole)) {
        result.push({ reviewerIdentityRef: reviewerAuthorityRef(identity), leftRole, rightRole });
      }
    }
  }
  return result;
}

function unconfiguredProjection(hasActivation: boolean): ReviewerAuthorityWorkbenchProjection {
  return Value.Decode(ReviewerAuthorityWorkbenchProjectionSchema, {
    schemaVersion: 1,
    state: "unconfigured",
    boundary: "external_verifier_required",
    verifications: [],
    roleConflicts: [],
    activationDecisionState: hasActivation ? "outside_t13_scope" : "not_present",
  });
}

function hasActivationDecision(snapshot: KnowledgePublicationSnapshot): boolean {
  return snapshot.records.some(({ recordKind }) => recordKind === "activation_decision");
}

function publicationRefsEqual(
  left: { recordKind: string; id: string; digest: string },
  right: { recordKind: string; id: string; digest: string }
): boolean {
  return (
    left.recordKind === right.recordKind && left.id === right.id && left.digest === right.digest
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export class ReviewerAuthorityUnavailableError extends Error {
  readonly code = "reviewer_authority_unavailable";
}

export class ReviewerAuthorityConflictError extends Error {
  readonly code = "reviewer_authority_conflict";
}

export class ReviewerAuthorityCancelledError extends Error {
  readonly code = "reviewer_authority_cancelled";
}

export class ReviewerAuthorityIntegrityError extends Error {
  readonly code = "reviewer_authority_integrity";
}

export class ReviewerAuthorityNoStatusChangeError extends Error {
  readonly code = "reviewer_authority_no_status_change";
}
