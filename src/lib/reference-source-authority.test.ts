import { createHmac } from "node:crypto";

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS,
  ReferenceAuthorityVerificationReceiptSchema,
  evaluateReferenceSourceAuthority,
  referenceAuthorityReceiptSigningPayload,
  type ReferenceAuthorityFacet,
  type ReferenceAuthorityVerificationReceipt,
  type ReferenceSourceAuthorityEvaluationInput,
} from "./reference-source-authority.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAccessOperation,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
} from "./reference-source-domain.js";

const NOW = "2026-07-15T16:00:00.000Z";
const EARLIER = "2026-07-15T15:00:00.000Z";
const SECRET = "authority-test-key";
const SUBJECT_REF = ref("asset.authority", "a");
const AUTHORITY_REF = ref("authority.owner-reviewed", "b");
const POLICY_REF = ref("policy.authority", "c");

describe("reference-source authority closure", () => {
  it("defines a complete conjunctive facet matrix for every operation", () => {
    const operations: ReferenceAccessOperation[] = [
      "underlying_work_use",
      "manifestation_use",
      "exemplar_access",
      "scan_provider_use",
      "owner_private_study",
      "local_extraction",
      "provider_ocr",
      "provider_omr",
      "provider_translation",
      "provider_model_processing",
      "pack_citation",
      "pack_excerpt",
      "fixture_inclusion",
      "repository_inclusion",
      "export",
      "redistribution",
    ];

    expect(Object.keys(REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS).sort()).toEqual(
      [...operations].sort()
    );
    expect(REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.provider_translation).toEqual(
      expect.arrayContaining([
        "translation",
        "named_provider_processing",
        "scan_provider_terms",
        "owner_private_access",
      ])
    );
    expect(REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.repository_inclusion).toEqual(
      expect.arrayContaining(["pack_citation_excerpt", "export_redistribution"])
    );
  });

  it("allows only a server-verified exact current conjunctive closure", () => {
    const input = completeInput("repository_inclusion");
    const before = structuredClone(withoutVerifier(input));

    const result = evaluateReferenceSourceAuthority(input);

    expect(result).toMatchObject({
      status: "allow",
      operation: "repository_inclusion",
      findings: [],
    });
    expect(result.requiredFacets).toEqual(
      [...REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.repository_inclusion].sort()
    );
    expect(withoutVerifier(input)).toEqual(before);
  });

  it("does not treat opaque authority refs or a receipt-shaped object as verification", () => {
    const input = completeInput("owner_private_study");
    const result = evaluateReferenceSourceAuthority({
      ...input,
      verifyServerReceipt: () => false,
    });

    expect(result.status).toBe("review_required");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "receipt_signature_invalid" })
    );
  });

  it("requires the receipt to verify the decision's exact authority refs", () => {
    const input = completeInput("owner_private_study");
    const receipt = signedReceipt({
      ...withoutDigest(input.receipt),
      verifiedAuthorityRefs: [ref("authority.someone-else", "2")],
    });

    const result = evaluateReferenceSourceAuthority({ ...input, receipt });

    expect(result.status).toBe("review_required");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "receipt_authority_mismatch" })
    );
  });

  it("applies deny, conflict, and unknown precedence over affirmative claims", () => {
    const input = completeInput("repository_inclusion");
    const required = input.receipt.requiredFacets;
    const assertions = required.flatMap((facet, index) => {
      const affirmative = rights(`rights.${facet}.affirmative`, facet, "permitted");
      if (index === 0) {
        return [affirmative, rights(`rights.${facet}.restricted`, facet, "restricted")];
      }
      if (index === 1) {
        return [affirmative, rights(`rights.${facet}.conflicting`, facet, "conflicting")];
      }
      if (index === 2) {
        return [affirmative, rights(`rights.${facet}.unknown`, facet, "unknown")];
      }
      return [affirmative];
    });
    const decision = accessDecision("repository_inclusion", assertions);
    const receipt = authorityReceipt(decision, assertions, required);

    const result = evaluateReferenceSourceAuthority({
      ...input,
      accessDecisionRef: recordRef(decision),
      accessDecisions: [decision],
      rightsAssertions: assertions,
      receipt,
    });

    expect(result.status).toBe("deny");
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["facet_restricted", "facet_conflicting", "facet_unknown"])
    );
    expect(
      result.findings.findIndex((finding) => finding.code === "facet_restricted")
    ).toBeLessThan(result.findings.findIndex((finding) => finding.code === "facet_conflicting"));
    expect(
      result.findings.findIndex((finding) => finding.code === "facet_conflicting")
    ).toBeLessThan(result.findings.findIndex((finding) => finding.code === "facet_unknown"));
  });

  it("accepts explicit not-applicable only when it is evidence-backed", () => {
    const permittedInput = completeInput("manifestation_use", {
      statuses: { manifestation_editorial: "not_applicable" },
    });
    expect(evaluateReferenceSourceAuthority(permittedInput).status).toBe("allow");

    const assertionWithoutEvidence = rights(
      "rights.manifestation_editorial",
      "manifestation_editorial",
      "not_applicable",
      { evidenceRefs: [] }
    );
    const underlying = rights(
      "rights.underlying_work_status",
      "underlying_work_status",
      "permitted"
    );
    const assertions = [underlying, assertionWithoutEvidence];
    const decision = accessDecision("manifestation_use", assertions);
    const receipt = authorityReceipt(
      decision,
      assertions,
      REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.manifestation_use
    );
    const result = evaluateReferenceSourceAuthority({
      schemaVersion: 1,
      effectiveAt: NOW,
      accessDecisionRef: recordRef(decision),
      accessDecisions: [decision],
      rightsAssertions: assertions,
      receipt,
      verifyServerReceipt: verifier,
    });

    expect(result.status).toBe("review_required");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "rights_assertion_evidence_missing",
        facet: "manifestation_editorial",
      })
    );
  });

  it("binds the receipt and decision to the exact current assertion closure", () => {
    const oldAssertion = rights("rights.export", "export_redistribution", "permitted");
    const restricted = rights("rights.export", "export_redistribution", "restricted", {
      version: 2,
      parent: oldAssertion,
      assertedAt: "2026-07-15T15:30:00.000Z",
    });
    const supporting = REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.export
      .filter((facet) => facet !== "export_redistribution")
      .map((facet) => rights(`rights.${facet}`, facet, "not_applicable"));
    const staleAssertions = [...supporting, oldAssertion];
    const decision = accessDecision("export", staleAssertions);
    const staleReceipt = authorityReceipt(
      decision,
      staleAssertions,
      REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.export
    );

    const result = evaluateReferenceSourceAuthority({
      schemaVersion: 1,
      effectiveAt: NOW,
      accessDecisionRef: recordRef(decision),
      accessDecisions: [decision],
      rightsAssertions: [...staleAssertions, restricted],
      receipt: staleReceipt,
      verifyServerReceipt: verifier,
    });

    expect(result.status).toBe("deny");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "facet_restricted" }),
        expect.objectContaining({ code: "receipt_rights_mismatch" }),
        expect.objectContaining({ code: "rights_assertion_scope_missing" }),
      ])
    );
  });

  it("does not permit a decision to omit a separate current restrictive claim", () => {
    const input = completeInput("repository_inclusion");
    const restricted = rights(
      "rights.export_redistribution.reviewer-two",
      "export_redistribution",
      "restricted"
    );

    const result = evaluateReferenceSourceAuthority({
      ...input,
      rightsAssertions: [...input.rightsAssertions, restricted],
    });

    expect(result.status).toBe("deny");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "facet_restricted" }),
        expect.objectContaining({ code: "receipt_rights_mismatch" }),
        expect.objectContaining({ code: "rights_assertion_scope_missing" }),
      ])
    );
  });

  it("rejects a narrowed facet receipt and impossible timestamps", () => {
    const input = completeInput("provider_translation");
    const narrowed = signedReceipt({
      ...withoutDigest(input.receipt),
      requiredFacets: ["named_provider_processing"],
      validUntil: "2026-99-99T99:99:99.000Z",
    });
    expect(Value.Check(ReferenceAuthorityVerificationReceiptSchema, narrowed)).toBe(true);

    const result = evaluateReferenceSourceAuthority({ ...input, receipt: narrowed });

    expect(result.status).toBe("review_required");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "receipt_facets_mismatch" }),
        expect.objectContaining({ code: "receipt_not_current" }),
      ])
    );
  });

  it("rejects closed-schema extensions before invoking receipt verification", () => {
    const input = completeInput("owner_private_study");
    let invoked = false;

    expect(() =>
      evaluateReferenceSourceAuthority({
        ...input,
        inventedAuthority: true,
        verifyServerReceipt: () => {
          invoked = true;
          return true;
        },
      } as ReferenceSourceAuthorityEvaluationInput)
    ).toThrow(/closed schema/);
    expect(invoked).toBe(false);
  });
});

function completeInput(
  operation: ReferenceAccessOperation,
  options: {
    statuses?: Partial<Record<ReferenceAuthorityFacet, ReferenceRightsAssertion["status"]>>;
  } = {}
): ReferenceSourceAuthorityEvaluationInput {
  const required = REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS[operation];
  const assertions = required.map((facet) =>
    rights(`rights.${facet}`, facet, options.statuses?.[facet] ?? "permitted")
  );
  const decision = accessDecision(operation, assertions);
  return {
    schemaVersion: 1,
    effectiveAt: NOW,
    accessDecisionRef: recordRef(decision),
    accessDecisions: [decision],
    rightsAssertions: assertions,
    receipt: authorityReceipt(decision, assertions, required),
    verifyServerReceipt: verifier,
  };
}

function rights(
  id: string,
  facet: ReferenceAuthorityFacet,
  status: ReferenceRightsAssertion["status"],
  options: {
    version?: number;
    parent?: ReferenceRightsAssertion;
    assertedAt?: string;
    evidenceRefs?: ReferenceRecordRef[];
  } = {}
): ReferenceRightsAssertion {
  return withReferenceRecordDigest({
    recordKind: "rights_assertion",
    id,
    version: options.version ?? 1,
    ...(options.parent
      ? {
          parentVersionRef: {
            ...recordRef(options.parent),
            version: options.parent.version,
          },
        }
      : {}),
    subjectRef: SUBJECT_REF,
    subjectKind: "digital_asset",
    rightsKind: facet,
    status,
    claimant: { kind: "owner", claimantRef: ref(`claimant.${id}`, "d") },
    evidenceRefs:
      options.evidenceRefs ?? (status === "unknown" ? [] : [ref(`evidence.${id}`, "e")]),
    assertedAt: options.assertedAt ?? EARLIER,
  }) as ReferenceRightsAssertion;
}

function accessDecision(
  operation: ReferenceAccessOperation,
  assertions: ReferenceRightsAssertion[]
): ReferenceAccessDecision {
  return withReferenceRecordDigest({
    recordKind: "access_decision",
    id: `access.${operation}`,
    version: 1,
    outcome: "allow",
    operation,
    sourceRefs: [SUBJECT_REF],
    derivativeRefs: [],
    destination: destination(operation),
    purpose: `Exercise exact ${operation} authority`,
    policyRef: POLICY_REF,
    rightsAssertionRefs: assertions.map(recordRef),
    authorityRefs: [AUTHORITY_REF],
    rationale: "Server-verified exact current authority closure",
    decidedAt: EARLIER,
  }) as ReferenceAccessDecision;
}

function destination(operation: ReferenceAccessOperation): ReferenceAccessDecision["destination"] {
  if (operation.startsWith("provider_")) return { kind: "provider", id: "provider.test" };
  if (
    ["pack_citation", "pack_excerpt", "fixture_inclusion", "repository_inclusion"].includes(
      operation
    )
  ) {
    return { kind: "repository", id: "repository.test" };
  }
  if (operation === "export") return { kind: "export", id: "export.test" };
  if (operation === "redistribution") return { kind: "recipient", id: "recipient.test" };
  return { kind: "local_runtime" };
}

function authorityReceipt(
  decision: ReferenceAccessDecision,
  assertions: ReferenceRightsAssertion[],
  requiredFacets: readonly ReferenceAuthorityFacet[]
): ReferenceAuthorityVerificationReceipt {
  return signedReceipt({
    recordKind: "reference_authority_verification_receipt",
    schemaVersion: 1,
    id: `authority-receipt.${decision.id}`,
    accessDecisionRef: recordRef(decision),
    currentRightsAssertionRefs: assertions.map(recordRef),
    authoritySubjectRefs: [SUBJECT_REF],
    verifiedAuthorityRefs: [...decision.authorityRefs],
    requiredFacets: [...requiredFacets],
    verifierRef: ref("verifier.reference-authority", "f"),
    verifierPolicyRef: ref("verifier-policy.reference-authority", "1"),
    verifiedAt: EARLIER,
    proof: {
      kind: "server_signature",
      algorithm: "hmac-sha256",
      keyId: "test-authority-key",
      signature: "pending",
    },
  });
}

function signedReceipt(
  unsigned: Omit<ReferenceAuthorityVerificationReceipt, "digest">
): ReferenceAuthorityVerificationReceipt {
  const placeholder = { ...unsigned, digest: "0".repeat(64) };
  const signature = createHmac("sha256", SECRET)
    .update(referenceAuthorityReceiptSigningPayload(placeholder))
    .digest("base64url");
  const core = { ...unsigned, proof: { ...unsigned.proof, signature } };
  return { ...core, digest: referenceSourceDigest(core) };
}

function verifier(input: {
  receipt: ReferenceAuthorityVerificationReceipt;
  signingPayload: string;
}): boolean {
  const expected = createHmac("sha256", SECRET).update(input.signingPayload).digest("base64url");
  return input.receipt.proof.signature === expected;
}

function ref(id: string, fill: string): ReferenceRecordRef {
  return { id, digest: fill.repeat(64) };
}

function recordRef(record: { id: string; digest: string }): ReferenceRecordRef {
  return { id: record.id, digest: record.digest };
}

function withoutVerifier(input: ReferenceSourceAuthorityEvaluationInput) {
  const { verifyServerReceipt: _verify, ...data } = input;
  return data;
}

function withoutDigest(receipt: ReferenceAuthorityVerificationReceipt) {
  const { digest: _digest, ...core } = receipt;
  return core;
}
