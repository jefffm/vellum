import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS,
  referenceAuthorityReceiptSigningPayload,
  type ReferenceAuthoritySubjectFacetRequirement,
  type ReferenceAuthorityVerificationReceipt,
} from "./reference-source-authority.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceRecordRef,
} from "./reference-source-domain.js";
import {
  buildTypedKnowledgeAuthorityVerification,
  validateTypedKnowledgeAuthorityVerification,
  verifyPersistedTypedKnowledgeAuthorityReceipt,
  type BuildTypedKnowledgeAuthorityVerificationInput,
  type TypedKnowledgeAuthoritySourceRef,
  type TypedKnowledgeAuthorityVerification,
} from "./typed-knowledge-authority-verification.js";

const EVALUATED_AT = "2026-07-16T16:00:00.000Z";
const SECRET = new Uint8Array(32).fill(0x2a);

describe("typed Knowledge pack-citation authority verification contract", () => {
  it("builds and validates one canonical, recursively immutable commitment", () => {
    const record = canonicalRecord();

    expect(validateTypedKnowledgeAuthorityVerification(record)).toEqual(record);
    expect(record.id).toBe(`authority-verification.pack-citation.${record.releaseRef.digest}`);
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.sourceRefs)).toBe(true);
    expect(Object.isFrozen(record.decisionCommitment)).toBe(true);
    expect(Object.isFrozen(record.receipt.proof)).toBe(true);
    expect(() => {
      (record.receipt.proof as { signature: string }).signature = "mutated";
    }).toThrow();
    expect(verifyPersistedTypedKnowledgeAuthorityReceipt(record, verifySignature)).toBe(true);
  });

  it("rejects unknown top-level and nested fields", () => {
    const record = canonicalRecord();
    expect(() =>
      validateTypedKnowledgeAuthorityVerification({ ...record, unknownAuthority: true })
    ).toThrow();
    expect(() =>
      validateTypedKnowledgeAuthorityVerification(
        redigestRecord({
          ...record,
          decisionCommitment: { ...record.decisionCommitment, rawRationale: "must not persist" },
        })
      )
    ).toThrow();
  });

  it.each([
    {
      label: "source kind closure",
      mutate: (record: MutableAuthorityRecord) => {
        record.sourceRefs[0]!.recordKind = "digital_asset";
      },
    },
    {
      label: "source order",
      mutate: (record: MutableAuthorityRecord) => {
        record.sourceRefs.reverse();
      },
    },
    {
      label: "authority subject scope",
      mutate: (record: MutableAuthorityRecord) => {
        record.authoritySubjectRefs.pop();
      },
    },
    {
      label: "required facet closure",
      mutate: (record: MutableAuthorityRecord) => {
        record.requiredFacets.reverse();
      },
    },
    {
      label: "subject facet closure",
      mutate: (record: MutableAuthorityRecord) => {
        record.requiredSubjectFacets[0]!.facet = "pack_citation_excerpt";
      },
    },
  ])("rejects a mismatched or noncanonical $label", ({ mutate }) => {
    const changed = mutableRecord(canonicalRecord());
    mutate(changed);
    expect(() => validateTypedKnowledgeAuthorityVerification(redigestRecord(changed))).toThrow();
  });

  it.each(["release", "receipt_decision", "receipt_assertions"] as const)(
    "rejects a mismatched %s binding",
    (fault) => {
      const changed = mutableRecord(canonicalRecord());
      if (fault === "release") {
        changed.releaseRef = ref("release.other");
      } else if (fault === "receipt_decision") {
        changed.receipt.accessDecisionRef = ref("decision.other");
        changed.receipt = redigestReceipt(changed.receipt);
      } else {
        changed.receipt.currentRightsAssertionRefs = [ref("rights.other")];
        changed.receipt = redigestReceipt(changed.receipt);
      }
      expect(() => validateTypedKnowledgeAuthorityVerification(redigestRecord(changed))).toThrow();
    }
  );

  it.each(["2026-07-16T15:59:59.999Z", "2026-07-16T16:00:00.001Z"])(
    "rejects a receipt minted outside the exact evaluation instant: %s",
    (verifiedAt) => {
      const changed = mutableRecord(canonicalRecord());
      changed.receipt.verifiedAt = verifiedAt;
      changed.receipt = redigestReceipt(changed.receipt);
      expect(() => validateTypedKnowledgeAuthorityVerification(redigestRecord(changed))).toThrow(
        /exact evaluation instant/
      );
    }
  );

  it("rejects invalid record and nested receipt digests", () => {
    const record = canonicalRecord();
    expect(() =>
      validateTypedKnowledgeAuthorityVerification({ ...record, digest: "0".repeat(64) })
    ).toThrow(/digest/);

    const changed = mutableRecord(record);
    changed.receipt.digest = "0".repeat(64);
    expect(() => validateTypedKnowledgeAuthorityVerification(redigestRecord(changed))).toThrow(
      /receipt digest/
    );
  });

  it("fails closed when the pinned verifier rejects or throws", () => {
    const record = canonicalRecord();
    expect(verifyPersistedTypedKnowledgeAuthorityReceipt(record, () => false)).toBe(false);
    expect(
      verifyPersistedTypedKnowledgeAuthorityReceipt(record, () => {
        throw new Error("wrong key");
      })
    ).toBe(false);
  });
});

type MutableAuthorityRecord = ReturnType<typeof mutableRecord>;

function canonicalRecord(): TypedKnowledgeAuthorityVerification {
  const sourceRefs = [
    typedRef("asset_acquisition", "acquisition.mace"),
    typedRef("digital_asset", "asset.mace"),
    typedRef("exemplar", "exemplar.mace"),
    typedRef("source_manifestation", "manifestation.mace"),
    typedRef("work", "work.mace"),
  ];
  const derivativeRefs = [
    { recordKind: "cited_extraction_version" as const, ...ref("cited-extraction.mace") },
    { recordKind: "extraction_proposal" as const, ...ref("extraction-proposal.mapping") },
    { recordKind: "extraction_proposal" as const, ...ref("extraction-proposal.question") },
    { recordKind: "source_segment_version" as const, ...ref("source-segment.mace") },
  ];
  const authoritySubjectRefs = [...sourceRefs, ...derivativeRefs]
    .map(({ id, digest }) => ({ id, digest }))
    .sort(compareRefs);
  const sourceFacet = {
    asset_acquisition: "attribution",
    digital_asset: "scan_provider_terms",
    exemplar: "exemplar_restriction",
    source_manifestation: "manifestation_editorial",
    work: "underlying_work_status",
  } as const;
  const requiredSubjectFacets: ReferenceAuthoritySubjectFacetRequirement[] = [
    ...sourceRefs.map((source) => ({
      subjectRef: { id: source.id, digest: source.digest },
      facet: sourceFacet[source.recordKind],
    })),
    ...derivativeRefs.map((derivative) => ({
      subjectRef: { id: derivative.id, digest: derivative.digest },
      facet: "pack_citation_excerpt" as const,
    })),
  ].sort(compareSubjectFacets);
  const accessDecisionRef = ref("access-decision.pack-citation");
  const rightsAssertionRefs = [ref("rights.1"), ref("rights.2")].sort(compareRefs);
  const authorityRefs = [ref("authority.pack-citation")];
  const receipt = signedReceipt({
    recordKind: "reference_authority_verification_receipt",
    schemaVersion: 1,
    id: "receipt.pack-citation",
    observedSnapshotRef: ref("snapshot.reference-source"),
    accessDecisionRef,
    accessDecisionFirstObservedRevision: 1,
    reviewedProvenanceSubstitutionRefs: [],
    currentRightsAssertionRefs: rightsAssertionRefs,
    rightsAssertionObservations: rightsAssertionRefs.map((rightsAssertionRef) => ({
      rightsAssertionRef,
      firstObservedRevision: 1,
    })),
    authoritySubjectRefs,
    verifiedAuthorityRefs: authorityRefs,
    requiredFacets: [...REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.pack_citation],
    requiredSubjectFacets,
    verifierRef: ref("verifier.pack-citation"),
    verifierPolicyRef: ref("verifier-policy.pack-citation"),
    verifiedAt: EVALUATED_AT,
    proof: {
      kind: "server_signature",
      algorithm: "hmac-sha256",
      keyId: "key.pack-citation",
      signature: "pending",
    },
  });
  const input: BuildTypedKnowledgeAuthorityVerificationInput = {
    releaseRef: ref("knowledge-pack-release.mace.r1"),
    operation: "pack_citation",
    evaluatedAt: EVALUATED_AT,
    observedSnapshotRef: receipt.observedSnapshotRef,
    sourceRefs,
    derivativeRefs,
    authoritySubjectRefs,
    requiredFacets: [...REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.pack_citation].sort(
      compareCodePoints
    ),
    requiredSubjectFacets,
    destination: { kind: "repository", id: "vellum.reviewed-knowledge-library" },
    purpose: "Publish the exact cited Mace extraction as an inactive typed Knowledge Pack release",
    accessPolicyRef: ref("policy.pack-citation"),
    verifierRef: receipt.verifierRef,
    verifierPolicyRef: receipt.verifierPolicyRef,
    decisionCommitment: {
      accessDecisionRef,
      outcome: "allow",
      rightsAssertionRefs,
      authorityRefs,
      decidedAt: EVALUATED_AT,
      rationaleCode: "exact_pack_citation_scope_verified",
    },
    receipt,
  };
  return buildTypedKnowledgeAuthorityVerification(input);
}

function signedReceipt(
  core: Omit<ReferenceAuthorityVerificationReceipt, "digest">
): ReferenceAuthorityVerificationReceipt {
  const placeholder = withReferenceRecordDigest(core) as ReferenceAuthorityVerificationReceipt;
  const signature = createHmac("sha256", SECRET)
    .update(referenceAuthorityReceiptSigningPayload(placeholder))
    .digest("base64url");
  return withReferenceRecordDigest({
    ...core,
    proof: { ...core.proof, signature },
  }) as ReferenceAuthorityVerificationReceipt;
}

function verifySignature({
  receipt,
  signingPayload,
}: {
  receipt: ReferenceAuthorityVerificationReceipt;
  signingPayload: string;
}): boolean {
  return (
    receipt.proof.signature ===
    createHmac("sha256", SECRET).update(signingPayload).digest("base64url")
  );
}

function redigestReceipt(
  receipt: ReferenceAuthorityVerificationReceipt
): ReferenceAuthorityVerificationReceipt {
  const { digest: _digest, ...core } = receipt;
  return { ...core, digest: referenceSourceDigest(core) };
}

function redigestRecord(value: Record<string, unknown>): Record<string, unknown> {
  const { digest: _digest, ...core } = value;
  return { ...core, digest: referenceSourceDigest(core) };
}

function mutableRecord(value: TypedKnowledgeAuthorityVerification) {
  return structuredClone(value) as unknown as {
    releaseRef: ReferenceRecordRef;
    sourceRefs: Array<TypedKnowledgeAuthoritySourceRef & { recordKind: string }>;
    derivativeRefs: Array<{ recordKind: string; id: string; digest: string }>;
    authoritySubjectRefs: ReferenceRecordRef[];
    requiredFacets: string[];
    requiredSubjectFacets: Array<ReferenceAuthoritySubjectFacetRequirement>;
    decisionCommitment: {
      accessDecisionRef: ReferenceRecordRef;
      rightsAssertionRefs: ReferenceRecordRef[];
      authorityRefs: ReferenceRecordRef[];
      [key: string]: unknown;
    };
    receipt: ReferenceAuthorityVerificationReceipt;
    [key: string]: unknown;
  };
}

function ref(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ fixtureRef: id }) };
}

function typedRef(
  recordKind: TypedKnowledgeAuthoritySourceRef["recordKind"],
  id: string
): TypedKnowledgeAuthoritySourceRef {
  return { recordKind, ...ref(id) };
}

function compareRefs(left: ReferenceRecordRef, right: ReferenceRecordRef): number {
  return compareCodePoints(left.id, right.id) || compareCodePoints(left.digest, right.digest);
}

function compareSubjectFacets(
  left: ReferenceAuthoritySubjectFacetRequirement,
  right: ReferenceAuthoritySubjectFacetRequirement
): number {
  return (
    compareRefs(left.subjectRef, right.subjectRef) || compareCodePoints(left.facet, right.facet)
  );
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
