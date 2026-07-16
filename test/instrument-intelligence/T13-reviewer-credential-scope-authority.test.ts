// @vitest-environment jsdom

import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAdvisoryVerification,
  buildReviewerAuthorityScope,
  buildReviewerCredentialAssertion,
  buildReviewerIdentitySnapshot,
  buildReviewerRevocationSnapshot,
  buildReviewerTrustPolicy,
  buildReviewerVerifierReceipt,
  buildScopedReleaseAdvisory,
  buildScopedReleaseAttestation,
  reviewerAuthorityRef,
  reviewerVerifierReceiptSigningPayload,
  type ReviewerAuthorityRef,
  type ReviewerAuthorityScope,
  type ReviewerCredentialAssertion,
  type ReviewerRole,
  type ReviewerVerifierReceipt,
  type ReviewerVerifierRequest,
} from "../../src/lib/reviewer-authority-contract.js";
import { referenceSourceDigest } from "../../src/lib/reference-source-domain.js";
import { renderReviewerAuthorityWorkbench } from "../../src/reviewer-authority-workbench.js";
import {
  KnowledgePublicationStore,
  type KnowledgePublicationGenerationRef,
  type KnowledgePublicationRecordKind,
  type KnowledgePublicationSnapshot,
} from "../../src/server/lib/knowledge-publication-store.js";
import {
  ReviewerAuthorityService,
  type ExternalReviewerVerifier,
} from "../../src/server/lib/reviewer-authority-service.js";

const SECRET = "t13-synthetic-verifier-secret";
const INITIAL_TIME = "2026-07-16T12:00:00.000Z";
const roots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("T13 reviewer credential, scope, expiry, and revocation authority", () => {
  it("publishes an exact externally verified synthetic scope without minting human or activation authority", async () => {
    const fixture = createFixture();
    const result = await fixture.verify();

    expect(fixture.providerRequests).toHaveLength(1);
    expect(result.verification).toMatchObject({
      recordKind: "attestation_verification",
      result: "verified_authorized",
      reason: "authorized",
      reviewerRole: "historical_practice_specialist",
      authorityDisposition: "synthetic_test_no_authority",
      humanAuthority: false,
      activationDecisionPublished: false,
      environment: "synthetic_test",
      evaluatedScopeRef: reviewerAuthorityRef(fixture.requestedScope),
    });
    expect("authorizationScopeRef" in result.verification).toBe(true);
    expect(
      result.snapshot.records.some(({ recordKind }) => recordKind === "activation_decision")
    ).toBe(false);
    expect(result.snapshot.records.map(({ recordKind }) => recordKind)).toEqual(
      expect.arrayContaining([
        "reviewer_authority_scope",
        "reviewer_identity_snapshot",
        "reviewer_credential_assertion",
        "reviewer_trust_policy",
        "reviewer_revocation_snapshot",
        "reviewer_verifier_receipt",
        "release_attestation",
        "attestation_verification",
      ])
    );

    const workbench = await fixture.service.readWorkbench();
    expect(workbench).toMatchObject({
      state: "configured",
      boundary: "external_verifier_required",
      policy: {
        policyRef: reviewerAuthorityRef(fixture.policy),
        synthetic: true,
        verifierCount: 1,
        revocationSourceCount: 1,
      },
      activationDecisionState: "not_present",
      roleConflicts: [],
      verifications: [
        {
          result: "verified_authorized",
          reason: "authorized",
          freshness: "current",
          revocation: "clear",
          authorityConferred: false,
          humanAuthority: false,
          synthetic: true,
          evaluatedScope: {
            roles: ["historical_practice_specialist"],
            dimensions: ["historical_practice", "instrument_idiom"],
          },
          authorizationScope: {
            roles: ["historical_practice_specialist"],
            dimensions: ["historical_practice", "instrument_idiom"],
          },
          unclaimedDimensions: ["target_playability"],
          disagreements: ["Synthetic disagreement retained for Workbench disclosure"],
        },
      ],
    });

    const container = document.createElement("div");
    renderReviewerAuthorityWorkbench(container, workbench);
    expect(container.textContent).toContain("Credentials and review claims do not grant authority");
    expect(container.textContent).toContain("Synthetic contract-test policy");
    expect(container.textContent).toContain("None conferred");
    expect(container.textContent).toContain("Target playability");
    expect(container.textContent).toContain("Synthetic disagreement retained");
    expect(container.textContent).toContain("Not present · owned by the later resolver slice");
  });

  it("pins verifier identity, trust root, method, supported kinds, exact scope, clocks, revocation sources, and policy validity", () => {
    const fixture = createFixture();
    expect(fixture.policy).toMatchObject({
      policyVersion: 1,
      authorizedVerifiers: [
        {
          verifierIdentityRef: fixture.refs.verifier,
          verifierComponentRef: fixture.refs.component,
          trustRootRefs: [fixture.refs.trustRoot],
          verificationMethodRefs: [fixture.refs.method],
          credentialKinds: ["advisory_issuer", "reviewer_role"],
          advisoryKinds: ["attestation_revoked", "retracted", "rights_restricted", "superseded"],
          subjectKinds: ["release_advisory", "release_attestation"],
          reviewerRoles: expect.arrayContaining([
            "curator",
            "truth_reviewer",
            "evaluator_implementer",
            "evaluator_calibrator",
            "run_operator",
            "historical_practice_specialist",
          ]),
          authorizationScopeRef: reviewerAuthorityRef(fixture.policyScope),
        },
      ],
      clockPolicy: {
        policyRef: fixture.refs.clockPolicy,
        timeBasis: "utc",
        maximumClockSkewMs: 30_000,
        maximumReceiptAgeMs: 300_000,
        maximumRevocationAgeMs: 300_000,
      },
      revocationSourceRefs: [fixture.refs.revocationSource],
      roleConflicts: expect.arrayContaining([
        ["curator", "truth_reviewer"],
        ["evaluator_implementer", "evaluator_calibrator"],
        ["evaluator_calibrator", "run_operator"],
      ]),
      validFrom: "2026-07-01T00:00:00.000Z",
      validUntil: "2026-08-01T00:00:00.000Z",
      environment: "synthetic_test",
    });
  });

  it.each([
    {
      name: "unsigned or forged receipt",
      options: { receiptSignature: "forged" } satisfies FixtureOptions,
      result: "unverified",
      reason: "receipt_signature_invalid",
    },
    {
      name: "unauthorized verifier identity",
      options: {
        receiptVerifierIdentity: externalRef("verifier.unauthorized"),
      } satisfies FixtureOptions,
      result: "unverified",
      reason: "unauthorized_verifier",
    },
    {
      name: "unauthorized trust root",
      options: {
        receiptTrustRoot: externalRef("trust-root.unauthorized"),
      } satisfies FixtureOptions,
      result: "unverified",
      reason: "unauthorized_verifier",
    },
    {
      name: "claimant self-issued credential",
      options: { selfIssued: true } satisfies FixtureOptions,
      result: "unverified",
      reason: "self_issued_credential",
    },
    {
      name: "missing exact artifact scope",
      options: { omitRequestedArtifact: true } satisfies FixtureOptions,
      result: "unverified",
      reason: "missing_scope",
    },
    {
      name: "ambiguous receipt subject",
      options: { receiptIdentity: externalRef("identity.ambiguous") } satisfies FixtureOptions,
      result: "unverified",
      reason: "receipt_binding_mismatch",
    },
    {
      name: "stale verifier receipt",
      options: { receiptCheckedAt: "2026-07-16T11:50:00.000Z" } satisfies FixtureOptions,
      result: "unverified",
      reason: "verification_stale",
    },
    {
      name: "future receipt beyond clock skew",
      options: { receiptCheckedAt: "2026-07-16T12:01:00.000Z" } satisfies FixtureOptions,
      result: "unverified",
      reason: "clock_policy_mismatch",
    },
    {
      name: "expired credential",
      options: { credentialValidUntil: "2026-07-16T11:59:59.000Z" } satisfies FixtureOptions,
      result: "unverified",
      reason: "credential_expired",
    },
    {
      name: "revoked credential",
      options: { revokeCredential: true } satisfies FixtureOptions,
      result: "revoked",
      reason: "credential_revoked",
    },
    {
      name: "stale revocation status",
      options: { revocationObservedAt: "2026-07-16T11:50:00.000Z" } satisfies FixtureOptions,
      result: "unverified",
      reason: "revocation_status_stale",
    },
    {
      name: "unsupported credential kind",
      options: { credentialKind: "advisory_issuer" } satisfies FixtureOptions,
      result: "unverified",
      reason: "unsupported_credential_kind",
    },
    {
      name: "policy not yet valid",
      options: { policyValidFrom: "2026-07-17T00:00:00.000Z" } satisfies FixtureOptions,
      result: "unverified",
      reason: "policy_not_yet_valid",
    },
    {
      name: "expired policy",
      options: { policyValidUntil: "2026-07-16T11:59:59.000Z" } satisfies FixtureOptions,
      result: "unverified",
      reason: "policy_expired",
    },
  ])(
    "fails closed for $name and carries no evaluated or authority scope",
    async ({ options, result, reason }) => {
      const fixture = createFixture(options);
      const verification = (await fixture.verify()).verification;
      expect(verification).toMatchObject({
        result,
        reason,
        authorityDisposition: "none",
        humanAuthority: false,
        activationDecisionPublished: false,
      });
      expect("evaluatedScopeRef" in verification).toBe(false);
      expect("authorizationScopeRef" in verification).toBe(false);
      const projection = await fixture.service.readWorkbench();
      expect(projection.state).toBe("configured");
      if (projection.state !== "configured") throw new Error("configured projection expected");
      expect(projection.verifications[0]).toMatchObject({
        result,
        reason,
        evaluatedScope: null,
        authorizationScope: null,
        authorityConferred: false,
        humanAuthority: false,
      });
    }
  );

  it("records a verified out-of-scope comparison but confers no positive authority", async () => {
    const fixture = createFixture({ omitCredentialDimension: "instrument_idiom" });
    const verification = (await fixture.verify()).verification;
    expect(verification).toMatchObject({
      result: "verified_out_of_scope",
      reason: "scope_intersection_failed",
      authorityDisposition: "none",
      humanAuthority: false,
    });
    expect("evaluatedScopeRef" in verification).toBe(true);
    expect("authorizationScopeRef" in verification).toBe(true);
    const projection = await fixture.service.readWorkbench();
    if (projection.state !== "configured") throw new Error("configured projection expected");
    expect(projection.verifications[0]).toMatchObject({
      result: "verified_out_of_scope",
      evaluatedScope: { dimensions: ["historical_practice", "instrument_idiom"] },
      authorizationScope: { dimensions: ["historical_practice"] },
      authorityConferred: false,
      humanAuthority: false,
    });
  });

  it("keeps curator, truth reviewer, evaluator implementer, calibrator, and run operator distinct and rejects conflicts", async () => {
    const roles: ReviewerRole[] = [
      "curator",
      "truth_reviewer",
      "evaluator_implementer",
      "evaluator_calibrator",
      "run_operator",
    ];
    expect(new Set(roles).size).toBe(5);

    const fixture = createFixture({ conflictingRole: "truth_reviewer", requestedRole: "curator" });
    const verification = (await fixture.verify()).verification;
    expect(verification).toMatchObject({ result: "unverified", reason: "role_conflict" });
    const projection = await fixture.service.readWorkbench();
    if (projection.state !== "configured") throw new Error("configured projection expected");
    expect(projection.roleConflicts).toEqual([
      {
        reviewerIdentityRef: reviewerAuthorityRef(fixture.identity),
        leftRole: "curator",
        rightRole: "truth_reviewer",
      },
    ]);
  });

  it("does not let an expired historical credential create a permanent role conflict", async () => {
    const fixture = createFixture({
      conflictingRole: "truth_reviewer",
      conflictingCredentialValidUntil: "2026-07-16T11:59:59.000Z",
      requestedRole: "curator",
    });
    const verification = (await fixture.verify()).verification;
    expect(verification).toMatchObject({ result: "verified_authorized", reason: "authorized" });
    const projection = await fixture.service.readWorkbench();
    if (projection.state !== "configured") throw new Error("configured projection expected");
    expect(projection.roleConflicts).toEqual([]);
  });

  it("publishes immutable expiry and revocation successors without changing release or attestation bytes", async () => {
    let now = INITIAL_TIME;
    const fixture = createFixture({
      credentialValidUntil: "2026-07-16T12:03:00.000Z",
      now: () => new Date(now),
    });
    const first = await fixture.verify();
    expect(first.verification.result).toBe("verified_authorized");
    const releaseBytes = publicationContentBytes(first.snapshot, "knowledge_pack_release");
    const attestationBytes = publicationContentBytes(first.snapshot, "release_attestation");

    now = "2026-07-16T12:04:00.000Z";
    const second = await fixture.service.refreshCurrentStatus({
      verificationRef: reviewerAuthorityRef(first.verification),
      expectedHead: generationRef(first.snapshot),
    });
    expect(second.verification).toMatchObject({
      result: "unverified",
      reason: "credential_expired",
      authorityDisposition: "none",
    });
    expect(second.snapshot.generation.revision).toBe(first.snapshot.generation.revision + 1);
    expect(publicationContentBytes(second.snapshot, "knowledge_pack_release")).toBe(releaseBytes);
    expect(publicationContentBytes(second.snapshot, "release_attestation")).toBe(attestationBytes);
    expect(
      second.snapshot.records.filter(({ recordKind }) => recordKind === "attestation_verification")
    ).toHaveLength(2);
    expect(
      second.snapshot.records.some(({ recordKind }) => recordKind === "activation_decision")
    ).toBe(false);
    const successorRecord = second.snapshot.records.find(
      ({ recordKind, content }) =>
        recordKind === "attestation_verification" &&
        typeof content === "object" &&
        content !== null &&
        "digest" in content &&
        content.digest === second.verification.digest
    );
    expect(successorRecord?.successorRefs).toHaveLength(1);
    expect(fixture.providerRequests).toHaveLength(1);
  });

  it("publishes a new immutable revoked status when a fresh verifier-bound revocation snapshot arrives", async () => {
    const fixture = createFixture();
    const first = await fixture.verify();
    const releaseBytes = publicationContentBytes(first.snapshot, "knowledge_pack_release");
    const attestationBytes = publicationContentBytes(first.snapshot, "release_attestation");
    const revokedSnapshot = buildReviewerRevocationSnapshot({
      recordKind: "reviewer_revocation_snapshot",
      schemaVersion: 1,
      id: "reviewer-revocation.revoked.synthetic.t13",
      sourceRef: fixture.refs.revocationSource,
      observedAt: INITIAL_TIME,
      validUntil: "2026-08-01T00:00:00.000Z",
      revokedCredentialRefs: [reviewerAuthorityRef(fixture.credential)],
      revokedIdentityRefs: [],
      evidenceRefs: [fixture.refs.evidence],
      environment: "synthetic_test",
    });
    const withRevocation = fixture.service.publishMaterials(
      [revokedSnapshot],
      generationRef(first.snapshot)
    );
    const second = await fixture.service.verify({
      subjectRecordRef: reviewerAuthorityRef(fixture.attestation),
      trustPolicyRef: reviewerAuthorityRef(fixture.policy),
      credentialAssertionRefs: [reviewerAuthorityRef(fixture.credential)],
      revocationSnapshotRefs: [reviewerAuthorityRef(revokedSnapshot)],
      expectedHead: generationRef(withRevocation),
    });
    expect(second.verification).toMatchObject({
      result: "revoked",
      reason: "credential_revoked",
      authorityDisposition: "none",
      humanAuthority: false,
    });
    expect(publicationContentBytes(second.snapshot, "knowledge_pack_release")).toBe(releaseBytes);
    expect(publicationContentBytes(second.snapshot, "release_attestation")).toBe(attestationBytes);
    expect(
      second.snapshot.records.filter(({ recordKind }) => recordKind === "attestation_verification")
    ).toHaveLength(2);
    expect(
      second.snapshot.records.some(({ recordKind }) => recordKind === "activation_decision")
    ).toBe(false);
    expect(fixture.providerRequests).toHaveLength(2);
  });

  it("verifies advisory issuer authority and fails closed for an unsupported advisory kind", async () => {
    const authorized = createFixture({ advisory: true });
    const authorizedVerification = (await authorized.verify()).verification;
    expect(authorizedVerification).toMatchObject({
      recordKind: "advisory_verification",
      result: "verified_authorized",
      authorityDisposition: "synthetic_test_no_authority",
    });

    const unsupported = createFixture({ advisory: true, policyAdvisoryKinds: ["retracted"] });
    const unsupportedVerification = (await unsupported.verify()).verification;
    expect(unsupportedVerification).toMatchObject({
      recordKind: "advisory_verification",
      result: "unverified",
      reason: "unsupported_advisory_kind",
      authorityDisposition: "none",
    });
  });

  it("coexists with earlier activation records without ever writing one itself", async () => {
    const fixture = createFixture();
    const existingActivation = genericContent(
      "activation_decision",
      "activation.preexisting.synthetic.t13"
    );
    fixture.store.publish({
      schemaVersion: 1,
      transactionId: "t13.preexisting-activation",
      writerKind: "activation",
      expectedHead: generationRef(fixture.materialSnapshot),
      writes: [writeFor(existingActivation)],
    });
    const result = await fixture.verify();
    expect(result.verification.result).toBe("verified_authorized");
    expect(
      result.snapshot.records.filter(({ recordKind }) => recordKind === "activation_decision")
    ).toHaveLength(1);
    expect(result.snapshot.generation.newRecordRefs).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ recordKind: "activation_decision" })])
    );
    const projection = await fixture.service.readWorkbench();
    expect(projection.state).toBe("configured");
    expect(projection.activationDecisionState).toBe("outside_t13_scope");
  });

  it("downgrades an imported verification-shaped record when its receipt is not independently valid", async () => {
    const fixture = createFixture();
    const legitimate = await fixture.verify();
    const current = legitimate.snapshot;
    const forgedReceipt = buildReceipt(fixture.providerRequests[0]!, fixture, {
      signature: "claimant-controlled-forgery",
    });
    const imported = buildAdvisoryVerification({
      recordKind: "advisory_verification",
      schemaVersion: 1,
      id: "advisory-verification.imported-forgery",
      familyId: "advisory-verification.imported-forgery",
      subjectRecordRef: reviewerAuthorityRef(fixture.attestation),
      verifierPolicyRef: reviewerAuthorityRef(fixture.policy),
      verifierIdentityRef: fixture.refs.verifier,
      verifierComponentRef: fixture.refs.component,
      reviewerIdentitySnapshotRef: reviewerAuthorityRef(fixture.identity),
      credentialAssertionRefs: [reviewerAuthorityRef(fixture.credential)],
      verificationMethodRef: fixture.refs.method,
      revocationSnapshotRefs: [reviewerAuthorityRef(fixture.revocation)],
      receiptRef: reviewerAuthorityRef(forgedReceipt),
      checkedAt: INITIAL_TIME,
      evidenceRefs: [fixture.refs.evidence],
      reviewerRole: "historical_practice_specialist",
      disagreements: [],
      unclaimedDimensions: [],
      authorityDisposition: "eligible_for_later_resolution",
      humanAuthority: true,
      activationDecisionPublished: false,
      environment: "production",
      result: "verified_authorized",
      reason: "authorized",
      evaluatedScopeRef: reviewerAuthorityRef(fixture.requestedScope),
      authorizationScopeRef: reviewerAuthorityRef(fixture.requestedScope),
    });
    fixture.store.publish({
      schemaVersion: 1,
      transactionId: "claimant.imported-verification",
      writerKind: "upload",
      expectedHead: generationRef(current),
      writes: [writeFor(forgedReceipt), writeFor(imported)],
    });

    const projection = await fixture.service.readWorkbench();
    if (projection.state !== "configured") throw new Error("configured projection expected");
    const importedProjection = projection.verifications.find(
      ({ verificationRef }) => verificationRef.id === imported.id
    );
    expect(importedProjection).toMatchObject({
      result: "unverified",
      reason: "receipt_signature_invalid",
      evaluatedScope: null,
      authorizationScope: null,
      authorityConferred: false,
      humanAuthority: false,
    });
  });

  it("shows an explicit fail-closed unconfigured state when no Trust Policy exists", async () => {
    const store = createStore();
    const service = new ReviewerAuthorityService({ publicationStore: store });
    const projection = await service.readWorkbench();
    expect(projection).toEqual({
      schemaVersion: 1,
      state: "unconfigured",
      boundary: "external_verifier_required",
      verifications: [],
      roleConflicts: [],
      activationDecisionState: "not_present",
    });
    const container = document.createElement("div");
    renderReviewerAuthorityWorkbench(container, projection);
    expect(container.textContent).toContain(
      "Human, historical, specialist, and advisory authority remain unavailable"
    );
  });
});

type FixtureOptions = Readonly<{
  now?: () => Date;
  requestedRole?: ReviewerRole;
  conflictingRole?: ReviewerRole;
  conflictingCredentialValidUntil?: string;
  selfIssued?: boolean;
  credentialKind?: "reviewer_role" | "advisory_issuer";
  credentialValidUntil?: string;
  omitCredentialDimension?: "historical_practice" | "instrument_idiom";
  omitRequestedArtifact?: boolean;
  revokeCredential?: boolean;
  revocationObservedAt?: string;
  policyValidFrom?: string;
  policyValidUntil?: string;
  policyAdvisoryKinds?: Array<
    "superseded" | "retracted" | "attestation_revoked" | "rights_restricted"
  >;
  receiptSignature?: string;
  receiptVerifierIdentity?: ReviewerAuthorityRef;
  receiptTrustRoot?: ReviewerAuthorityRef;
  receiptIdentity?: ReviewerAuthorityRef;
  receiptCheckedAt?: string;
  advisory?: boolean;
}>;

type Fixture = ReturnType<typeof createFixture>;

function createFixture(options: FixtureOptions = {}) {
  const store = createStore();
  const now = options.now ?? (() => new Date(INITIAL_TIME));
  const refs = {
    verifier: externalRef("verifier.synthetic.t13"),
    component: externalRef("component.synthetic-verifier.t13"),
    trustRoot: externalRef("trust-root.synthetic.t13"),
    method: externalRef("verification-method.hmac-sha256.synthetic.t13"),
    clockPolicy: externalRef("clock-policy.utc-bounded.t13"),
    revocationSource: externalRef("revocation-source.synthetic.t13"),
    issuer: externalRef("credential-issuer.synthetic.t13"),
    reviewerSubject: externalRef("reviewer-subject.synthetic.t13"),
    evidence: externalRef("evidence.synthetic.t13"),
  };
  const release = genericContent("knowledge_pack_release", "release.synthetic.t13");
  const profile = genericContent("knowledge_profile", "profile.synthetic.t13");
  const seeded = store.publish({
    schemaVersion: 1,
    transactionId: "t13.seed-exact-release",
    writerKind: "system",
    expectedHead: null,
    writes: [writeFor(release), writeFor(profile)],
  });
  const requestedRole = options.requestedRole ?? "historical_practice_specialist";
  const scopeCore = {
    reviewerRoles: [requestedRole],
    subjectKinds: [options.advisory ? "release_advisory" : "release_attestation"] as const,
    subjectRefs: [reviewerAuthorityRef(release)],
    actions: [options.advisory ? "issue_advisory" : "attest_release"] as const,
    artifactRefs: options.omitRequestedArtifact ? [] : [reviewerAuthorityRef(release)],
    applicabilityRefs: [reviewerAuthorityRef(profile)],
    claimDimensions: ["historical_practice", "instrument_idiom"] as const,
    advisoryKinds: options.advisory ? (["rights_restricted"] as const) : [],
    unclaimedDimensions: ["target_playability"] as const,
  };
  const requestedScope = buildReviewerAuthorityScope({
    recordKind: "reviewer_authority_scope",
    schemaVersion: 1,
    id: "scope.requested.synthetic.t13",
    ...scopeCore,
  });
  const credentialScope = buildReviewerAuthorityScope({
    recordKind: "reviewer_authority_scope",
    schemaVersion: 1,
    id: "scope.credential.synthetic.t13",
    ...scopeCore,
    claimDimensions: scopeCore.claimDimensions.filter(
      (dimension) => dimension !== options.omitCredentialDimension
    ),
  });
  const policyScope = buildReviewerAuthorityScope({
    recordKind: "reviewer_authority_scope",
    schemaVersion: 1,
    id: "scope.policy.synthetic.t13",
    ...scopeCore,
  });
  const identity = buildReviewerIdentitySnapshot({
    recordKind: "reviewer_identity_snapshot",
    schemaVersion: 1,
    id: "reviewer-identity.synthetic.t13",
    subjectRef: refs.reviewerSubject,
    displayLabel: "Synthetic T13 reviewer",
    assertedAttributes: { fixture: "contract-test-only" },
    evidenceRefs: [refs.evidence],
    capturedAt: "2026-07-01T00:00:00.000Z",
    environment: "synthetic_test",
  });
  const credential = buildReviewerCredentialAssertion({
    recordKind: "reviewer_credential_assertion",
    schemaVersion: 1,
    id: "reviewer-credential.synthetic.t13",
    reviewerIdentitySnapshotRef: reviewerAuthorityRef(identity),
    issuerIdentityRef: options.selfIssued ? refs.reviewerSubject : refs.issuer,
    kind: options.credentialKind ?? (options.advisory ? "advisory_issuer" : "reviewer_role"),
    reviewerRole: requestedRole,
    scopeRef: reviewerAuthorityRef(credentialScope),
    validFrom: "2026-07-01T00:00:00.000Z",
    ...(options.credentialValidUntil ? { validUntil: options.credentialValidUntil } : {}),
    revocationSourceRefs: [refs.revocationSource],
    evidenceRefs: [refs.evidence],
    environment: "synthetic_test",
  });
  const conflictingCredential = options.conflictingRole
    ? buildReviewerCredentialAssertion({
        recordKind: "reviewer_credential_assertion",
        schemaVersion: 1,
        id: "reviewer-credential.conflicting.synthetic.t13",
        reviewerIdentitySnapshotRef: reviewerAuthorityRef(identity),
        issuerIdentityRef: refs.issuer,
        kind: "reviewer_role",
        reviewerRole: options.conflictingRole,
        scopeRef: reviewerAuthorityRef(credentialScope),
        validFrom: "2026-07-01T00:00:00.000Z",
        ...(options.conflictingCredentialValidUntil
          ? { validUntil: options.conflictingCredentialValidUntil }
          : {}),
        revocationSourceRefs: [refs.revocationSource],
        evidenceRefs: [refs.evidence],
        environment: "synthetic_test",
      })
    : null;
  const revocation = buildReviewerRevocationSnapshot({
    recordKind: "reviewer_revocation_snapshot",
    schemaVersion: 1,
    id: "reviewer-revocation.synthetic.t13",
    sourceRef: refs.revocationSource,
    observedAt: options.revocationObservedAt ?? INITIAL_TIME,
    validUntil: "2026-08-01T00:00:00.000Z",
    revokedCredentialRefs: options.revokeCredential ? [reviewerAuthorityRef(credential)] : [],
    revokedIdentityRefs: [],
    evidenceRefs: [refs.evidence],
    environment: "synthetic_test",
  });
  const allRoles: ReviewerRole[] = [
    "curator",
    "truth_reviewer",
    "evaluator_implementer",
    "evaluator_calibrator",
    "run_operator",
    "historical_practice_specialist",
    "release_reviewer",
    "owner",
  ];
  if (!allRoles.includes(requestedRole)) allRoles.push(requestedRole);
  const policy = buildReviewerTrustPolicy({
    recordKind: "reviewer_trust_policy",
    schemaVersion: 1,
    id: "reviewer-trust-policy.synthetic.t13",
    policyVersion: 1,
    authorizedVerifiers: [
      {
        verifierIdentityRef: refs.verifier,
        verifierComponentRef: refs.component,
        trustRootRefs: [refs.trustRoot],
        verificationMethodRefs: [refs.method],
        credentialKinds: ["advisory_issuer", "reviewer_role"],
        advisoryKinds: options.policyAdvisoryKinds ?? [
          "attestation_revoked",
          "retracted",
          "rights_restricted",
          "superseded",
        ],
        subjectKinds: ["release_advisory", "release_attestation"],
        reviewerRoles: allRoles,
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
    validFrom: options.policyValidFrom ?? "2026-07-01T00:00:00.000Z",
    validUntil: options.policyValidUntil ?? "2026-08-01T00:00:00.000Z",
    environment: "synthetic_test",
  });
  const attestation = buildScopedReleaseAttestation({
    recordKind: "release_attestation",
    schemaVersion: 1,
    id: "release-attestation.synthetic.t13",
    releaseRef: reviewerAuthorityRef(release),
    kind: "specialist_reviewed",
    reviewerIdentitySnapshotRef: reviewerAuthorityRef(identity),
    reviewerRole: requestedRole,
    reviewScopeRef: reviewerAuthorityRef(requestedScope),
    evidenceRefs: [refs.evidence],
    issuedAt: "2026-07-16T11:55:00.000Z",
    disagreements: ["Synthetic disagreement retained for Workbench disclosure"],
    environment: "synthetic_test",
  });
  const advisory = options.advisory
    ? buildScopedReleaseAdvisory({
        recordKind: "release_advisory",
        schemaVersion: 1,
        id: "release-advisory.synthetic.t13",
        subjectRef: reviewerAuthorityRef(release),
        subjectKind: "knowledge_pack_release",
        kind: "rights_restricted",
        issuerIdentitySnapshotRef: reviewerAuthorityRef(identity),
        issuerRole: requestedRole,
        requestedScopeRef: reviewerAuthorityRef(requestedScope),
        effectiveAt: INITIAL_TIME,
        rationale: "Synthetic rights restriction for advisory-verification coverage",
        evidenceRefs: [refs.evidence],
        environment: "synthetic_test",
      })
    : null;
  const providerRequests: ReviewerVerifierRequest[] = [];
  const holder = {} as Fixture;
  const verifier: ExternalReviewerVerifier = {
    verify: (request) => {
      providerRequests.push(structuredClone(request));
      return buildReceipt(request, holder, {
        signature: options.receiptSignature,
        verifierIdentityRef: options.receiptVerifierIdentity,
        trustRootRef: options.receiptTrustRoot,
        identitySnapshotRef: options.receiptIdentity,
        checkedAt: options.receiptCheckedAt,
      });
    },
  };
  const service = new ReviewerAuthorityService({
    publicationStore: store,
    verifier,
    verifyReceipt: verifySyntheticReceipt,
    now,
  });
  const materials = [
    requestedScope,
    credentialScope,
    policyScope,
    identity,
    credential,
    ...(conflictingCredential ? [conflictingCredential] : []),
    revocation,
    policy,
    options.advisory ? advisory! : attestation,
  ];
  const materialSnapshot = service.publishMaterials(materials, generationRef(seeded));
  const fixture = Object.assign(holder, {
    store,
    service,
    refs,
    release,
    profile,
    requestedScope,
    credentialScope,
    policyScope,
    identity,
    credential,
    conflictingCredential,
    revocation,
    policy,
    attestation,
    advisory,
    materialSnapshot,
    providerRequests,
    verify: (expectedHead = generationRef(store.readCurrent()!)) =>
      service.verify({
        subjectRecordRef: reviewerAuthorityRef(options.advisory ? advisory! : attestation),
        trustPolicyRef: reviewerAuthorityRef(policy),
        credentialAssertionRefs: [reviewerAuthorityRef(credential)],
        revocationSnapshotRefs: [reviewerAuthorityRef(revocation)],
        expectedHead,
      }),
  });
  return fixture;
}

function buildReceipt(
  request: ReviewerVerifierRequest,
  fixture: Fixture,
  options: Readonly<{
    signature?: string;
    verifierIdentityRef?: ReviewerAuthorityRef;
    trustRootRef?: ReviewerAuthorityRef;
    identitySnapshotRef?: ReviewerAuthorityRef;
    checkedAt?: string;
  }> = {}
): ReviewerVerifierReceipt {
  const core = {
    recordKind: "reviewer_verifier_receipt" as const,
    schemaVersion: 1 as const,
    id: `reviewer-verifier-receipt.${request.requestDigest.slice(0, 40)}`,
    requestDigest: request.requestDigest,
    verifierIdentityRef: options.verifierIdentityRef ?? fixture.refs.verifier,
    verifierComponentRef: fixture.refs.component,
    trustRootRef: options.trustRootRef ?? fixture.refs.trustRoot,
    verificationMethodRef: fixture.refs.method,
    identitySnapshotRef: options.identitySnapshotRef ?? reviewerAuthorityRef(fixture.identity),
    credentialAssertionRefs: request.credentialAssertionRefs,
    result: "authenticated" as const,
    checkedAt: options.checkedAt ?? request.verificationTime,
    validUntil: "2026-08-01T00:00:00.000Z",
    evidenceRefs: [fixture.refs.evidence],
    signature: "pending",
    environment: "synthetic_test" as const,
  };
  const unsigned = buildReviewerVerifierReceipt(core);
  const signature = options.signature ?? signReviewerReceipt(unsigned);
  return buildReviewerVerifierReceipt({ ...core, signature });
}

function signReviewerReceipt(receipt: ReviewerVerifierReceipt): string {
  return createHmac("sha256", SECRET)
    .update(reviewerVerifierReceiptSigningPayload(receipt))
    .digest("hex");
}

function verifySyntheticReceipt(receipt: ReviewerVerifierReceipt): boolean {
  const expected = Buffer.from(signReviewerReceipt(receipt), "utf8");
  const actual = Buffer.from(receipt.signature, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function createStore(): KnowledgePublicationStore {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t13-reviewer-authority-"));
  roots.push(root);
  return new KnowledgePublicationStore({ rootDirectory: root, now: () => new Date(INITIAL_TIME) });
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

function publicationContentBytes(
  snapshot: KnowledgePublicationSnapshot,
  recordKind: KnowledgePublicationRecordKind
): string {
  const matches = snapshot.records.filter((record) => record.recordKind === recordKind);
  if (matches.length !== 1) throw new Error(`Expected one ${recordKind} record`);
  return JSON.stringify(matches[0]!.content);
}
