import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ReferenceAssetAcquisitionSchema,
  ReferenceDigitalAssetSchema,
  ReferenceProvenanceSubstitutionSchema,
  ReferenceSourceIdentityAssertionSchema,
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
      origin: { sourceKind: "upload" },
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
  });
});
