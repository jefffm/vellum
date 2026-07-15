import { createHmac } from "node:crypto";

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ReferenceSourceRetentionAuthorityEvaluationDataSchema,
  ReferenceSourceRetentionAuthorityReceiptSchema,
  evaluateReferenceSourceRetentionAuthority,
  referenceSourceRetentionAuthorityReceiptSigningPayload,
  type ReferenceSourceRetentionAuthorityEvaluationInput,
  type ReferenceSourceRetentionAuthorityReceipt,
} from "./reference-source-retention-authority.js";
import { referenceSourceDigest, type ReferenceRecordRef } from "./reference-source-domain.js";

const NOW = "2026-07-15T16:00:00.000Z";
const EARLIER = "2026-07-15T15:00:00.000Z";
const LATER = "2026-07-15T17:00:00.000Z";
const SECRET = "retention-authority-test-key";

const OBSERVED_SNAPSHOT_REF = ref("snapshot.staging", "1");
const ROLE_BINDING_REF = ref("binding.owner-reference", "2");
const DIGITAL_ASSET_REF = ref("asset.shared", "3");
const ACQUISITION_REFS = [ref("acquisition.first", "4"), ref("acquisition.second", "5")];
const ACCESS_DECISION_REFS = [ref("access.local", "6"), ref("access.export", "7")];
const RETENTION_POLICY_REF = ref("policy.owner-reference", "8");
const AUTHORITY_PROOF_REF = ref("proof.owner-retention", "9");
const SIGNING_KEY_REF = ref("key.retention-authority", "a");
const VERIFIER_REF = ref("verifier.retention-authority", "b");

describe("reference-source retention authority", () => {
  it.each(["retain", "release"] as const)(
    "allows an exact current server-authenticated %s outcome",
    (outcome) => {
      const input = completeInput(outcome);
      const before = structuredClone(withoutVerifier(input));

      const result = evaluateReferenceSourceRetentionAuthority(input);

      expect(result).toEqual({
        schemaVersion: 1,
        status: "allow",
        outcome,
        effectiveAt: NOW,
        roleBindingRef: ROLE_BINDING_REF,
        receiptRef: recordRef(input.receipt),
        findings: [],
      });
      expect(withoutVerifier(input)).toEqual(before);
    }
  );

  it("treats exact acquisition and decision scopes as order-insensitive sets", () => {
    const receipt = signedReceipt({
      acquisitionRefs: [...ACQUISITION_REFS].reverse(),
      accessDecisionRefs: [...ACCESS_DECISION_REFS].reverse(),
    });

    expect(
      evaluateReferenceSourceRetentionAuthority({
        ...completeInput("release"),
        receipt,
      })
    ).toMatchObject({ status: "allow", outcome: "release", findings: [] });
  });

  it.each([
    ["observed snapshot", { observedSnapshotRef: ref("snapshot.other", "c") }],
    ["role binding", { roleBindingRef: ref("binding.other", "d") }],
    ["digital asset", { digitalAssetRef: ref("asset.other", "e") }],
    ["retention policy", { retentionPolicyRef: ref("policy.other", "f") }],
    ["acquisition closure", { acquisitionRefs: [ACQUISITION_REFS[0]!] }],
    ["access-decision closure", { accessDecisionRefs: [ACCESS_DECISION_REFS[0]!] }],
  ] satisfies Array<[string, Parameters<typeof signedReceipt>[0]]>)(
    "blocks a validly signed receipt for another %s",
    (_label, changes) => {
      const result = evaluateReferenceSourceRetentionAuthority({
        ...completeInput("release"),
        receipt: signedReceipt(changes),
      });

      expect(result).toMatchObject({ status: "blocked", outcome: "retain" });
      expect(result.findings).toContainEqual(
        expect.objectContaining({ code: "receipt_scope_mismatch" })
      );
    }
  );

  it.each([
    ["authority proof", { authorityProofRef: ref("proof.other", "1") }],
    ["signing key", { signingKeyRef: ref("key.other", "2") }],
    ["verifier", { verifierRef: ref("verifier.other", "3") }],
  ] as const)("blocks a receipt bound to another %s ref", (_label, changes) => {
    const result = evaluateReferenceSourceRetentionAuthority({
      ...completeInput("release"),
      ...changes,
    });

    expect(result).toMatchObject({ status: "blocked", outcome: "retain" });
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "receipt_authority_mismatch" })
    );
  });

  it("rejects duplicate tuple members in either the caller closure or receipt", () => {
    const callerDuplicate = evaluateReferenceSourceRetentionAuthority({
      ...completeInput("release"),
      acquisitionRefs: [ACQUISITION_REFS[0]!, ACQUISITION_REFS[0]!],
    });
    expect(callerDuplicate).toMatchObject({ status: "blocked", outcome: "retain" });
    expect(callerDuplicate.findings).toContainEqual(
      expect.objectContaining({ code: "duplicate_acquisition_ref" })
    );

    const receiptDuplicate = evaluateReferenceSourceRetentionAuthority({
      ...completeInput("release"),
      receipt: signedReceipt({
        accessDecisionRefs: [ACCESS_DECISION_REFS[0]!, ACCESS_DECISION_REFS[0]!],
      }),
    });
    expect(receiptDuplicate).toMatchObject({ status: "blocked", outcome: "retain" });
    expect(receiptDuplicate.findings).toContainEqual(
      expect.objectContaining({ code: "duplicate_access_decision_ref" })
    );
  });

  it.each([
    ["future-dated", { verifiedAt: LATER }],
    ["expired", { validUntil: NOW }],
    ["semantically invalid", { verifiedAt: "2026-02-30T15:00:00.000Z" }],
    ["invalid validity boundary", { validUntil: "2026-99-99T17:00:00.000Z" }],
  ] as const)("blocks a %s receipt", (_label, changes) => {
    const result = evaluateReferenceSourceRetentionAuthority({
      ...completeInput("release"),
      receipt: signedReceipt(changes),
    });

    expect(result).toMatchObject({ status: "blocked", outcome: "retain" });
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "receipt_not_current" })
    );
  });

  it("blocks digest tampering even when a permissive verifier is supplied", () => {
    const input = completeInput("release");
    const result = evaluateReferenceSourceRetentionAuthority({
      ...input,
      receipt: {
        ...input.receipt,
        outcome: "retain",
      },
      verifyServerReceipt: () => true,
    });

    expect(result).toMatchObject({ status: "blocked", outcome: "retain" });
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "receipt_digest_invalid" })
    );
  });

  it("blocks a receipt-shaped object unless the independent verifier authenticates it", () => {
    const input = completeInput("release");
    for (const verifyServerReceipt of [
      () => false,
      () => {
        throw new Error("verifier unavailable");
      },
    ]) {
      const result = evaluateReferenceSourceRetentionAuthority({
        ...input,
        verifyServerReceipt,
      });
      expect(result).toMatchObject({ status: "blocked", outcome: "retain" });
      expect(result.findings).toContainEqual(
        expect.objectContaining({ code: "receipt_signature_invalid" })
      );
    }
  });

  it("does not expose the evaluated receipt to verifier mutation", () => {
    const input = completeInput("retain");
    const result = evaluateReferenceSourceRetentionAuthority({
      ...input,
      verifyServerReceipt: ({ receipt }) => {
        receipt.outcome = "release";
        return true;
      },
    });

    expect(result).toMatchObject({ status: "allow", outcome: "retain" });
    expect(input.receipt.outcome).toBe("retain");
  });

  it("binds every authority and tuple field in the canonical signing payload", () => {
    const original = signedReceipt();
    const changed = signedReceipt({ roleBindingRef: ref("binding.changed", "4") });

    expect(referenceSourceRetentionAuthorityReceiptSigningPayload(original)).not.toBe(
      referenceSourceRetentionAuthorityReceiptSigningPayload(changed)
    );
    expect(verifiesReceipt(original)).toBe(true);
    expect(
      verifiesReceipt({
        ...original,
        authorityProofRef: ref("proof.changed", "5"),
      })
    ).toBe(false);
  });

  it("closed-schema rejects unknown fields and malformed or noncanonical input", () => {
    const input = completeInput("release");
    expect(
      Value.Check(ReferenceSourceRetentionAuthorityReceiptSchema, {
        ...input.receipt,
        ambientAuthority: true,
      })
    ).toBe(false);
    expect(
      Value.Check(ReferenceSourceRetentionAuthorityEvaluationDataSchema, {
        ...withoutVerifier(input),
        ambientAuthority: true,
      })
    ).toBe(false);

    expect(() =>
      evaluateReferenceSourceRetentionAuthority({
        ...input,
        ambientAuthority: true,
      } as ReferenceSourceRetentionAuthorityEvaluationInput & {
        ambientAuthority: boolean;
      })
    ).toThrow(/closed schema/);
    expect(() =>
      evaluateReferenceSourceRetentionAuthority({
        ...input,
        effectiveAt: "2026-02-30T16:00:00.000Z",
      })
    ).toThrow(/valid time and verifier/);
    expect(() =>
      evaluateReferenceSourceRetentionAuthority({
        ...input,
        verifyServerReceipt: undefined,
      } as unknown as ReferenceSourceRetentionAuthorityEvaluationInput)
    ).toThrow(/valid time and verifier/);
  });
});

function completeInput(
  outcome: "retain" | "release"
): ReferenceSourceRetentionAuthorityEvaluationInput {
  const receipt = signedReceipt({ outcome });
  return {
    schemaVersion: 1,
    effectiveAt: NOW,
    observedSnapshotRef: OBSERVED_SNAPSHOT_REF,
    roleBindingRef: ROLE_BINDING_REF,
    digitalAssetRef: DIGITAL_ASSET_REF,
    acquisitionRefs: ACQUISITION_REFS,
    accessDecisionRefs: ACCESS_DECISION_REFS,
    retentionPolicyRef: RETENTION_POLICY_REF,
    authorityProofRef: AUTHORITY_PROOF_REF,
    signingKeyRef: SIGNING_KEY_REF,
    verifierRef: VERIFIER_REF,
    receipt,
    verifyServerReceipt: ({ receipt: candidate, signingPayload }) =>
      candidate.proof.signature === signature(signingPayload),
  };
}

function signedReceipt(
  changes: Partial<
    Omit<ReferenceSourceRetentionAuthorityReceipt, "recordKind" | "schemaVersion" | "id" | "digest">
  > = {}
): ReferenceSourceRetentionAuthorityReceipt {
  const core = {
    recordKind: "reference_retention_authority_receipt" as const,
    schemaVersion: 1 as const,
    id: "retention-authority.receipt.1",
    observedSnapshotRef: OBSERVED_SNAPSHOT_REF,
    roleBindingRef: ROLE_BINDING_REF,
    digitalAssetRef: DIGITAL_ASSET_REF,
    acquisitionRefs: ACQUISITION_REFS,
    accessDecisionRefs: ACCESS_DECISION_REFS,
    retentionPolicyRef: RETENTION_POLICY_REF,
    outcome: "release" as const,
    verifiedAt: EARLIER,
    validUntil: LATER,
    authorityProofRef: AUTHORITY_PROOF_REF,
    signingKeyRef: SIGNING_KEY_REF,
    verifierRef: VERIFIER_REF,
    proof: {
      kind: "server_signature" as const,
      algorithm: "hmac-sha256" as const,
      signature: "pending",
    },
    ...structuredClone(changes),
  };
  const draft = {
    ...core,
    digest: "0".repeat(64),
  } satisfies ReferenceSourceRetentionAuthorityReceipt;
  const signedCore = {
    ...core,
    proof: {
      ...core.proof,
      signature: signature(referenceSourceRetentionAuthorityReceiptSigningPayload(draft)),
    },
  };
  return {
    ...signedCore,
    digest: referenceSourceDigest(signedCore),
  };
}

function verifiesReceipt(receipt: ReferenceSourceRetentionAuthorityReceipt): boolean {
  return (
    receipt.proof.signature ===
    signature(referenceSourceRetentionAuthorityReceiptSigningPayload(receipt))
  );
}

function signature(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function ref(id: string, digit: string): ReferenceRecordRef {
  return { id, digest: digit.repeat(64) };
}

function recordRef(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function withoutVerifier(
  input: ReferenceSourceRetentionAuthorityEvaluationInput
): Omit<ReferenceSourceRetentionAuthorityEvaluationInput, "verifyServerReceipt"> {
  const { verifyServerReceipt: _verifyServerReceipt, ...data } = input;
  return data;
}
