import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ReferenceAssetAcquisitionSchema,
  ReferenceAssetRoleBindingSchema,
  ReferenceDigitalAssetSchema,
  ReferenceEvaluationSourceBindingCommitmentSchema,
  ReferenceExtractionProposalSchema,
  ReferenceProvenanceSubstitutionSchema,
  ReferenceSourceIdentityAssertionSchema,
  ReferenceSourceStagingOperationSchema,
  ReferenceSourceStagingSnapshotSchema,
  canonicalReferenceJson,
  verifyReferenceRecordDigest,
  withReferenceRecordDigest,
} from "./reference-source-domain.js";

const HEX_A = "a".repeat(64);
const HEX_B = "b".repeat(64);
const HEX_C = "c".repeat(64);
const NOW = "2026-07-15T12:00:00.000Z";

const ref = (id: string, digest = HEX_A) => ({ id, digest });

function identityAssertion(
  overrides: Record<string, unknown> = {}
): Readonly<Record<string, unknown> & { digest: string }> {
  return withReferenceRecordDigest({
    recordKind: "identity_assertion",
    id: "identity.title.1",
    version: 1,
    subjectRef: ref("work.1"),
    subjectKind: "work",
    property: "preferred_title",
    assertedValue: { kind: "unknown", reason: "Import has no reviewed title" },
    claimant: { kind: "importer", claimantRef: ref("importer.local") },
    evidenceRefs: [],
    confidence: { kind: "unknown" },
    completeness: "incomplete",
    composition: "atomic",
    componentAssertionRefs: [],
    assertionState: "candidate",
    predecessorAssertionRefs: [],
    successorRelationship: "initial",
    conflictAssertionRefs: [],
    assertedAt: NOW,
    ...overrides,
  });
}

describe("reference-source domain", () => {
  it("creates deterministic deeply immutable records and detects tampering", () => {
    const first = withReferenceRecordDigest({
      recordKind: "digital_asset",
      id: "asset.1",
      sha256: HEX_A,
      mediaType: "application/pdf",
      byteLength: 42,
    });
    const reordered = withReferenceRecordDigest({
      byteLength: 42,
      mediaType: "application/pdf",
      sha256: HEX_A,
      id: "asset.1",
      recordKind: "digital_asset",
    });

    expect(first.digest).toBe(reordered.digest);
    expect(canonicalReferenceJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(Object.isFrozen(first)).toBe(true);
    expect(verifyReferenceRecordDigest(first)).toBe(true);
    expect(verifyReferenceRecordDigest({ ...first, byteLength: 43 })).toBe(false);
  });

  it("uses the same bounded identifier contract as the Workbench", () => {
    const asset = withReferenceRecordDigest({
      recordKind: "digital_asset",
      id: "asset.safe-1",
      sha256: HEX_A,
      mediaType: "application/pdf",
      byteLength: 42,
    });

    expect(Value.Check(ReferenceDigitalAssetSchema, asset)).toBe(true);
    for (const id of ["asset with spaces", "asset:colon", "éditions.asset", "../asset"]) {
      expect(Value.Check(ReferenceDigitalAssetSchema, { ...asset, id })).toBe(false);
    }
    expect(
      Value.Check(ReferenceDigitalAssetSchema, { ...asset, id: `asset.${"a".repeat(251)}` })
    ).toBe(false);
  });

  it("requires explicit unknown or evidence-based assessed identity confidence", () => {
    const unknown = identityAssertion();
    const assessed = identityAssertion({
      id: "identity.title.2",
      assertedValue: { kind: "text", value: "A reviewed title" },
      confidence: {
        kind: "assessed",
        value: 0.72,
        basis: "Compared against the holding catalog",
        evidenceRefs: [ref("catalog.assertion")],
      },
      completeness: "complete",
    });

    expect(Value.Check(ReferenceSourceIdentityAssertionSchema, unknown)).toBe(true);
    expect(Value.Check(ReferenceSourceIdentityAssertionSchema, assessed)).toBe(true);
    expect(
      Value.Check(ReferenceSourceIdentityAssertionSchema, {
        ...assessed,
        confidence: { kind: "assessed", value: 1, evidenceRefs: [] },
      })
    ).toBe(false);
    const { confidence: _confidence, ...missingConfidence } = unknown;
    expect(Value.Check(ReferenceSourceIdentityAssertionSchema, missingConfidence)).toBe(false);
  });

  it("represents incomplete, composite, conflicting, and corrected identity immutably", () => {
    const original = identityAssertion();
    const correction = identityAssertion({
      id: "identity.title.2",
      version: 2,
      parentVersionRef: { id: original.id, version: 1, digest: original.digest },
      assertedValue: { kind: "text", value: "Corrected title" },
      completeness: "complete",
      composition: "composite",
      componentAssertionRefs: [ref("identity.component.1"), ref("identity.component.2")],
      assertionState: "disputed",
      predecessorAssertionRefs: [ref(String(original.id), original.digest)],
      successorRelationship: "correction",
      conflictAssertionRefs: [ref("identity.conflict")],
    });

    expect(Value.Check(ReferenceSourceIdentityAssertionSchema, original)).toBe(true);
    expect(Value.Check(ReferenceSourceIdentityAssertionSchema, correction)).toBe(true);
    expect(original).not.toHaveProperty("parentVersionRef");
    expect(original).not.toHaveProperty("conflictAssertionRefs.0");
  });

  it("deduplicates bytes without collapsing distinct acquisition provenance", () => {
    const asset = withReferenceRecordDigest({
      recordKind: "digital_asset",
      id: "asset.shared",
      sha256: HEX_A,
      mediaType: "application/pdf",
      byteLength: 42,
    });
    const acquisitionCore = {
      recordKind: "asset_acquisition",
      digitalAssetRef: ref(asset.id, asset.digest),
      representedExemplarRefs: [],
      origin: {
        sourceKind: "upload",
        ownerActionRef: ref("owner-action.source-upload"),
      },
      acquiredAt: NOW,
      rightsAssertionRefs: [],
      processingPolicyRef: ref("processing.local"),
    } as const;
    const first = withReferenceRecordDigest({ id: "acquisition.1", ...acquisitionCore });
    const second = withReferenceRecordDigest({ id: "acquisition.2", ...acquisitionCore });

    expect(Value.Check(ReferenceDigitalAssetSchema, asset)).toBe(true);
    expect(Value.Check(ReferenceAssetAcquisitionSchema, first)).toBe(true);
    expect(Value.Check(ReferenceAssetAcquisitionSchema, second)).toBe(true);
    expect(first.digitalAssetRef).toEqual(second.digitalAssetRef);
    expect(first.digest).not.toBe(second.digest);
    expect(
      Value.Check(ReferenceDigitalAssetSchema, {
        ...asset,
        storedPath: "/private/source.pdf",
      })
    ).toBe(false);
    expect(
      Value.Check(ReferenceDigitalAssetSchema, {
        ...asset,
        retrievalUri: "https://example.invalid/private.pdf",
      })
    ).toBe(false);
    expect(
      Value.Check(ReferenceAssetAcquisitionSchema, {
        ...first,
        origin: { sourceKind: "upload" },
      })
    ).toBe(false);
    expect(
      Value.Check(ReferenceAssetAcquisitionSchema, {
        ...first,
        origin: {
          sourceKind: "stable_url",
          providerRef: ref("provider.catalog"),
          providerObjectId: "object-1",
          redactedRetrievalUri: "https://example.invalid/private.pdf",
        },
      })
    ).toBe(false);
    expect(
      Value.Check(ReferenceAssetAcquisitionSchema, {
        ...first,
        origin: {
          sourceKind: "stable_url",
          providerRef: ref("provider.catalog"),
          providerObjectId: "object-1",
          redactedRetrievalUri: "urn:vellum:redacted-retrieval:provider-object-1",
        },
      })
    ).toBe(true);
  });

  it("binds provenance substitution to exact paths, authority, decision, and scope", () => {
    const substitution = withReferenceRecordDigest({
      recordKind: "provenance_substitution",
      id: "substitution.1",
      from: {
        acquisitionRef: ref("acquisition.restricted", HEX_A),
        derivationRef: ref("derivation.old", HEX_B),
      },
      to: {
        acquisitionRef: ref("acquisition.permitted", HEX_B),
        derivationRef: ref("derivation.reviewed", HEX_C),
      },
      scope: {
        operation: "pack_citation",
        sourceAndDerivativeRefs: [ref("candidate.1")],
        destination: { kind: "local_runtime" },
        purpose: "Reviewed local knowledge candidate",
        policyRef: ref("rights.policy.1"),
      },
      accessDecisionRef: ref("access.1"),
      authority: {
        kind: "rights_reviewer",
        authorityRef: ref("reviewer.1"),
        evidenceRefs: [ref("decision.evidence.1")],
      },
      rationale: "The reviewer authorized this exact replacement provenance path",
      decidedAt: NOW,
    });

    expect(Value.Check(ReferenceProvenanceSubstitutionSchema, substitution)).toBe(true);
    expect(
      Value.Check(ReferenceProvenanceSubstitutionSchema, {
        ...substitution,
        workRef: ref("same.work"),
      })
    ).toBe(false);
    expect(
      Value.Check(ReferenceProvenanceSubstitutionSchema, {
        ...substitution,
        title: "Matching title does not transfer rights",
      })
    ).toBe(false);
    expect(
      Value.Check(ReferenceProvenanceSubstitutionSchema, {
        ...substitution,
        sha256: HEX_A,
      })
    ).toBe(false);
  });

  it("keeps the exact twelve-course diapason reading and course-thirteen question nonauthoritative", () => {
    const common = {
      recordKind: "extraction_proposal",
      version: 1,
      citedExtractionRef: ref("extraction.mace-page-75"),
      scope: {
        instrument: "baroque_lute",
        notationSystem: "french_tablature",
        sourceCourseCount: 12,
      },
      reviewState: "proposed",
      authorityState: "nonauthoritative",
      activationAllowed: false,
      releaseRefs: [],
      attestationRefs: [],
      createdAt: NOW,
    } as const;
    const mapping = withReferenceRecordDigest({
      ...common,
      id: "proposal.mace-twelve-course",
      proposal: {
        kind: "twelve_course_diapason_mapping",
        courses: [7, 8, 9, 10, 11, 12],
        symbols: ["a", "/a", "//a", "///a", "4", "5"],
        numericSymbolsHaveSlashes: false,
      },
    });
    const question = withReferenceRecordDigest({
      ...common,
      id: "proposal.mace-course-thirteen-question",
      proposal: {
        kind: "course_thirteen_notation_question",
        course: 13,
        state: "unresolved",
        forbiddenInference: "sequence_extrapolation",
      },
    });

    expect(Value.Check(ReferenceExtractionProposalSchema, mapping)).toBe(true);
    expect(Value.Check(ReferenceExtractionProposalSchema, question)).toBe(true);
    expect(
      Value.Check(ReferenceExtractionProposalSchema, {
        ...mapping,
        proposal: { ...mapping.proposal, symbols: ["a", "/a", "//a", "///a", "/4", "/5"] },
      })
    ).toBe(false);
    expect(
      Value.Check(ReferenceExtractionProposalSchema, {
        ...question,
        proposal: { ...question.proposal, answer: "6" },
      })
    ).toBe(false);
    expect(
      Value.Check(ReferenceExtractionProposalSchema, {
        ...mapping,
        activationAllowed: true,
      })
    ).toBe(false);
  });

  it("admits only staging-only snapshots", () => {
    const snapshot = withReferenceRecordDigest({
      schemaVersion: 1,
      id: "snapshot.1",
      revision: 0,
      publicationState: "staging_only",
      createdAt: NOW,
      records: [identityAssertion()],
    });

    expect(Value.Check(ReferenceSourceStagingSnapshotSchema, snapshot)).toBe(true);
    expect(
      Value.Check(ReferenceSourceStagingSnapshotSchema, {
        ...snapshot,
        publicationState: "canonical",
      })
    ).toBe(false);

    const clientInvalidation = withReferenceRecordDigest({
      recordKind: "invalidation",
      id: "invalidation.forged",
      triggerRef: ref("rights.1"),
      invalidatedRef: ref("binding.1"),
      dependencyEdgeRefs: [ref("edge.1")],
      dependencyPath: [ref("rights.1"), ref("binding.1")],
      scope: "rights",
      reason: "client must not mint this",
      invalidatedAt: NOW,
    });
    expect(
      Value.Check(ReferenceSourceStagingOperationSchema, {
        type: "append_record",
        record: clientInvalidation,
      })
    ).toBe(false);
  });

  it("represents evaluation bindings without disclosing a hidden Vault reference", () => {
    const commitment = withReferenceRecordDigest({
      recordKind: "evaluation_source_binding_commitment",
      id: "evaluation-binding.1",
      evaluationContext: {
        kind: "vault_commitment",
        algorithm: "hmac-sha256",
        keyId: "vault-key.local-1",
        commitment: HEX_C,
      },
      createdAt: NOW,
    });

    expect(Value.Check(ReferenceEvaluationSourceBindingCommitmentSchema, commitment)).toBe(true);
    expect(Value.Check(ReferenceAssetRoleBindingSchema, commitment)).toBe(false);
    expect(commitment).not.toHaveProperty("digitalAssetRef");
    expect(commitment).not.toHaveProperty("acquisitionRefs");
    expect(commitment).not.toHaveProperty("accessDecisionRefs");
    expect(
      Value.Check(ReferenceEvaluationSourceBindingCommitmentSchema, {
        ...commitment,
        digitalAssetRef: ref("asset.private"),
        acquisitionRefs: [ref("acquisition.private")],
        accessDecisionRefs: [ref("access.private")],
        evaluationVaultRef: ref("private-vault.case"),
      })
    ).toBe(false);
  });
});
