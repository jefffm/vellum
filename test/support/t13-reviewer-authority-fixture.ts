import { createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";

import {
  buildReviewerAuthorityScope,
  buildReviewerCredentialAssertion,
  buildReviewerIdentitySnapshot,
  buildReviewerRevocationSnapshot,
  buildReviewerTrustPolicy,
  buildReviewerVerifierReceipt,
  buildScopedReleaseAttestation,
  reviewerAuthorityRef,
  reviewerVerifierReceiptSigningPayload,
  type ReviewerAuthorityRef,
  type ReviewerVerifierReceipt,
  type ReviewerVerifierRequest,
} from "../../src/lib/reviewer-authority-contract.js";
import { referenceSourceDigest } from "../../src/lib/reference-source-domain.js";
import {
  KnowledgePublicationStore,
  type KnowledgePublicationGenerationRef,
  type KnowledgePublicationRecordKind,
  type KnowledgePublicationSnapshot,
} from "../../src/server/lib/knowledge-publication-store.js";
import {
  ReviewerAuthorityService,
  type ReviewerVerifierReceiptVerifier,
} from "../../src/server/lib/reviewer-authority-service.js";

const NOW = "2026-07-16T12:00:00.000Z";
const SECRET = "t13-browser-synthetic-verifier-secret";

export async function createT13BrowserAuthorityFixture(rootDirectory: string) {
  const store = new KnowledgePublicationStore({
    rootDirectory: path.join(rootDirectory, "publication"),
    now: () => new Date(NOW),
  });
  const refs = {
    verifier: externalRef("verifier.synthetic.browser-t13"),
    component: externalRef("component.synthetic.browser-t13"),
    trustRoot: externalRef("trust-root.synthetic.browser-t13"),
    method: externalRef("method.hmac.synthetic.browser-t13"),
    clockPolicy: externalRef("clock-policy.utc.browser-t13"),
    revocationSource: externalRef("revocation-source.synthetic.browser-t13"),
    issuer: externalRef("credential-issuer.synthetic.browser-t13"),
    subject: externalRef("reviewer-subject.synthetic.browser-t13"),
    evidence: externalRef("evidence.synthetic.browser-t13"),
  };
  const release = genericContent("knowledge_pack_release", "release.synthetic.browser-t13");
  const profile = genericContent("knowledge_profile", "profile.synthetic.browser-t13");
  const seeded = store.publish({
    schemaVersion: 1,
    transactionId: "t13-browser.seed-release",
    writerKind: "system",
    expectedHead: null,
    writes: [writeFor(release), writeFor(profile)],
  });
  const scopeFields = {
    reviewerRoles: ["historical_practice_specialist"] as const,
    subjectKinds: ["release_attestation"] as const,
    subjectRefs: [reviewerAuthorityRef(release)],
    actions: ["attest_release"] as const,
    artifactRefs: [reviewerAuthorityRef(release)],
    applicabilityRefs: [reviewerAuthorityRef(profile)],
    claimDimensions: ["historical_practice", "instrument_idiom"] as const,
    advisoryKinds: [],
    unclaimedDimensions: ["target_playability", "continuo", "counterpoint"] as const,
  };
  const requestedScope = buildReviewerAuthorityScope({
    recordKind: "reviewer_authority_scope",
    schemaVersion: 1,
    id: "scope.requested.synthetic.browser-t13",
    ...scopeFields,
  });
  const credentialScope = buildReviewerAuthorityScope({
    recordKind: "reviewer_authority_scope",
    schemaVersion: 1,
    id: "scope.credential.synthetic.browser-t13",
    ...scopeFields,
  });
  const policyScope = buildReviewerAuthorityScope({
    recordKind: "reviewer_authority_scope",
    schemaVersion: 1,
    id: "scope.policy.synthetic.browser-t13",
    ...scopeFields,
  });
  const identity = buildReviewerIdentitySnapshot({
    recordKind: "reviewer_identity_snapshot",
    schemaVersion: 1,
    id: "reviewer-identity.synthetic.browser-t13",
    subjectRef: refs.subject,
    displayLabel: "Private synthetic reviewer label that must not cross the API",
    assertedAttributes: { privateCanary: "PRIVATE-T13-IDENTITY-CANARY" },
    evidenceRefs: [refs.evidence],
    capturedAt: "2026-07-01T00:00:00.000Z",
    environment: "synthetic_test",
  });
  const credential = buildReviewerCredentialAssertion({
    recordKind: "reviewer_credential_assertion",
    schemaVersion: 1,
    id: "credential.synthetic.browser-t13",
    reviewerIdentitySnapshotRef: reviewerAuthorityRef(identity),
    issuerIdentityRef: refs.issuer,
    kind: "reviewer_role",
    reviewerRole: "historical_practice_specialist",
    scopeRef: reviewerAuthorityRef(credentialScope),
    validFrom: "2026-07-01T00:00:00.000Z",
    validUntil: "2026-08-01T00:00:00.000Z",
    revocationSourceRefs: [refs.revocationSource],
    evidenceRefs: [refs.evidence],
    environment: "synthetic_test",
  });
  const revocation = buildReviewerRevocationSnapshot({
    recordKind: "reviewer_revocation_snapshot",
    schemaVersion: 1,
    id: "revocation.synthetic.browser-t13",
    sourceRef: refs.revocationSource,
    observedAt: NOW,
    validUntil: "2026-08-01T00:00:00.000Z",
    revokedCredentialRefs: [],
    revokedIdentityRefs: [],
    evidenceRefs: [refs.evidence],
    environment: "synthetic_test",
  });
  const policy = buildReviewerTrustPolicy({
    recordKind: "reviewer_trust_policy",
    schemaVersion: 1,
    id: "trust-policy.synthetic.browser-t13",
    policyVersion: 1,
    authorizedVerifiers: [
      {
        verifierIdentityRef: refs.verifier,
        verifierComponentRef: refs.component,
        trustRootRefs: [refs.trustRoot],
        verificationMethodRefs: [refs.method],
        credentialKinds: ["reviewer_role"],
        advisoryKinds: [],
        subjectKinds: ["release_attestation"],
        reviewerRoles: ["historical_practice_specialist"],
        authorizationScopeRef: reviewerAuthorityRef(policyScope),
      },
    ],
    clockPolicy: {
      policyRef: refs.clockPolicy,
      timeBasis: "utc",
      maximumClockSkewMs: 30_000,
      maximumReceiptAgeMs: 300_000,
      maximumRevocationAgeMs: 300_000,
    },
    revocationSourceRefs: [refs.revocationSource],
    roleConflicts: [
      ["curator", "truth_reviewer"],
      ["evaluator_implementer", "evaluator_calibrator"],
      ["evaluator_calibrator", "run_operator"],
    ],
    validFrom: "2026-07-01T00:00:00.000Z",
    validUntil: "2026-08-01T00:00:00.000Z",
    environment: "synthetic_test",
  });
  const attestation = buildScopedReleaseAttestation({
    recordKind: "release_attestation",
    schemaVersion: 1,
    id: "attestation.synthetic.browser-t13",
    releaseRef: reviewerAuthorityRef(release),
    kind: "specialist_reviewed",
    reviewerIdentitySnapshotRef: reviewerAuthorityRef(identity),
    reviewerRole: "historical_practice_specialist",
    reviewScopeRef: reviewerAuthorityRef(requestedScope),
    evidenceRefs: [refs.evidence],
    issuedAt: "2026-07-16T11:55:00.000Z",
    disagreements: ["Synthetic source disagreement remains unresolved"],
    environment: "synthetic_test",
  });
  const verifyReceipt: ReviewerVerifierReceiptVerifier = (receipt) => {
    const expected = Buffer.from(signReceipt(receipt), "utf8");
    const actual = Buffer.from(receipt.signature, "utf8");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  };
  const service = new ReviewerAuthorityService({
    publicationStore: store,
    now: () => new Date(NOW),
    verifier: {
      verify: (request) => receiptFor(request, refs, identity, credential),
    },
    verifyReceipt,
  });
  const materials = service.publishMaterials(
    [
      requestedScope,
      credentialScope,
      policyScope,
      identity,
      credential,
      revocation,
      policy,
      attestation,
    ],
    generationRef(seeded)
  );
  await service.verify({
    subjectRecordRef: reviewerAuthorityRef(attestation),
    trustPolicyRef: reviewerAuthorityRef(policy),
    credentialAssertionRefs: [reviewerAuthorityRef(credential)],
    revocationSnapshotRefs: [reviewerAuthorityRef(revocation)],
    expectedHead: generationRef(materials),
  });
  return Object.freeze({ store, verifyReceipt, policy, attestation });
}

function receiptFor(
  request: ReviewerVerifierRequest,
  refs: Record<string, ReviewerAuthorityRef>,
  identity: { id: string; digest: string },
  credential: { id: string; digest: string }
): ReviewerVerifierReceipt {
  const core = {
    recordKind: "reviewer_verifier_receipt" as const,
    schemaVersion: 1 as const,
    id: `receipt.synthetic.browser-t13.${request.requestDigest.slice(0, 32)}`,
    requestDigest: request.requestDigest,
    verifierIdentityRef: refs.verifier!,
    verifierComponentRef: refs.component!,
    trustRootRef: refs.trustRoot!,
    verificationMethodRef: refs.method!,
    identitySnapshotRef: reviewerAuthorityRef(identity),
    credentialAssertionRefs: [reviewerAuthorityRef(credential)],
    result: "authenticated" as const,
    checkedAt: request.verificationTime,
    validUntil: "2026-08-01T00:00:00.000Z",
    evidenceRefs: [refs.evidence!],
    signature: "pending",
    environment: "synthetic_test" as const,
  };
  const unsigned = buildReviewerVerifierReceipt(core);
  return buildReviewerVerifierReceipt({ ...core, signature: signReceipt(unsigned) });
}

function signReceipt(receipt: ReviewerVerifierReceipt): string {
  return createHmac("sha256", SECRET)
    .update(reviewerVerifierReceiptSigningPayload(receipt))
    .digest("hex");
}

function externalRef(id: string): ReviewerAuthorityRef {
  return { id, digest: referenceSourceDigest({ id }) };
}

function genericContent(recordKind: KnowledgePublicationRecordKind, id: string) {
  const core = { recordKind, schemaVersion: 1 as const, id };
  return { ...core, digest: referenceSourceDigest(core) };
}

function writeFor(content: { recordKind: string; digest: string }) {
  return {
    recordKind: content.recordKind as KnowledgePublicationRecordKind,
    id: `published.${content.recordKind}.${content.digest}`,
    successorRefs: [],
    content,
  };
}

function generationRef(snapshot: KnowledgePublicationSnapshot): KnowledgePublicationGenerationRef {
  return {
    id: snapshot.generation.id,
    digest: snapshot.generation.digest,
    revision: snapshot.generation.revision,
  };
}
