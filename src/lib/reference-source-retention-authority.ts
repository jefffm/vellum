import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import {
  ReferenceRecordRefSchema,
  canonicalReferenceJson,
  verifyReferenceRecordDigest,
  type ReferenceRecordRef,
} from "./reference-source-domain.js";
import {
  compareReferenceSourceInstants,
  isReferenceSourceInstant,
} from "./reference-source-instant.js";

const Strict = { additionalProperties: false } as const;
const IdSchema = Type.String({ minLength: 1 });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
});

export const ReferenceSourceRetentionOutcomeSchema = Type.Union([
  Type.Literal("retain"),
  Type.Literal("release"),
]);
export type ReferenceSourceRetentionOutcome = Static<typeof ReferenceSourceRetentionOutcomeSchema>;

const ReferenceSourceRetentionAuthorityTuple = {
  observedSnapshotRef: ReferenceRecordRefSchema,
  roleBindingRef: ReferenceRecordRefSchema,
  digitalAssetRef: ReferenceRecordRefSchema,
  acquisitionRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
  accessDecisionRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
  retentionPolicyRef: ReferenceRecordRefSchema,
};

const ReferenceSourceRetentionAuthorityRefs = {
  authorityProofRef: ReferenceRecordRefSchema,
  signingKeyRef: ReferenceRecordRefSchema,
  verifierRef: ReferenceRecordRefSchema,
};

const ReferenceSourceRetentionServerProofSchema = Type.Object(
  {
    kind: Type.Literal("server_signature"),
    algorithm: Type.Union([Type.Literal("ed25519"), Type.Literal("hmac-sha256")]),
    signature: Type.String({ pattern: "^[A-Za-z0-9_-]+$" }),
  },
  Strict
);

/**
 * Server-authenticated authority over one exact role-binding retention tuple.
 * The receipt is bounded in time and binds the authority proof, signing key,
 * and verifier identities rather than accepting them as ambient configuration.
 */
export const ReferenceSourceRetentionAuthorityReceiptSchema = Type.Object(
  {
    recordKind: Type.Literal("reference_retention_authority_receipt"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    ...ReferenceSourceRetentionAuthorityTuple,
    outcome: ReferenceSourceRetentionOutcomeSchema,
    verifiedAt: IsoTimestampSchema,
    validUntil: IsoTimestampSchema,
    ...ReferenceSourceRetentionAuthorityRefs,
    proof: ReferenceSourceRetentionServerProofSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceSourceRetentionAuthorityReceipt = Static<
  typeof ReferenceSourceRetentionAuthorityReceiptSchema
>;

export const ReferenceSourceRetentionAuthorityEvaluationDataSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    effectiveAt: IsoTimestampSchema,
    ...ReferenceSourceRetentionAuthorityTuple,
    ...ReferenceSourceRetentionAuthorityRefs,
    receipt: ReferenceSourceRetentionAuthorityReceiptSchema,
  },
  Strict
);
export type ReferenceSourceRetentionAuthorityEvaluationData = Static<
  typeof ReferenceSourceRetentionAuthorityEvaluationDataSchema
>;

export type ReferenceSourceRetentionAuthorityReceiptVerifier = (input: {
  receipt: ReferenceSourceRetentionAuthorityReceipt;
  signingPayload: string;
}) => boolean;

export type ReferenceSourceRetentionAuthorityFindingCode =
  | "duplicate_acquisition_ref"
  | "duplicate_access_decision_ref"
  | "receipt_scope_mismatch"
  | "receipt_authority_mismatch"
  | "receipt_digest_invalid"
  | "receipt_signature_invalid"
  | "receipt_not_current";

export type ReferenceSourceRetentionAuthorityFinding = {
  code: ReferenceSourceRetentionAuthorityFindingCode;
  detail: string;
  refs: ReferenceRecordRef[];
};

type ReferenceSourceRetentionAuthorityEvaluationCommon = {
  schemaVersion: 1;
  effectiveAt: string;
  roleBindingRef: ReferenceRecordRef;
  receiptRef: ReferenceRecordRef;
  findings: ReferenceSourceRetentionAuthorityFinding[];
};

/**
 * A blocked evaluation always resolves to `retain`, making an omitted status
 * check conservative. `release` is observable only on an exact authenticated
 * allow result.
 */
export type ReferenceSourceRetentionAuthorityEvaluation =
  | (ReferenceSourceRetentionAuthorityEvaluationCommon & {
      status: "allow";
      outcome: ReferenceSourceRetentionOutcome;
      findings: [];
    })
  | (ReferenceSourceRetentionAuthorityEvaluationCommon & {
      status: "blocked";
      outcome: "retain";
      findings: ReferenceSourceRetentionAuthorityFinding[];
    });

export type ReferenceSourceRetentionAuthorityEvaluationInput =
  ReferenceSourceRetentionAuthorityEvaluationData & {
    verifyServerReceipt: ReferenceSourceRetentionAuthorityReceiptVerifier;
  };

/**
 * Authenticate one exact role-binding retention-policy decision. Caller-owned
 * values are closed-schema decoded before any authority check. The separately
 * supplied verifier must authenticate the receipt over the canonical payload;
 * receipt-shaped JSON and opaque authority references never suffice.
 */
export function evaluateReferenceSourceRetentionAuthority(
  input: ReferenceSourceRetentionAuthorityEvaluationInput
): ReferenceSourceRetentionAuthorityEvaluation {
  const { verifyServerReceipt, ...data } = input;
  if (!Value.Check(ReferenceSourceRetentionAuthorityEvaluationDataSchema, data)) {
    throw new TypeError(
      "Reference-source retention-authority input does not match the closed schema"
    );
  }
  if (typeof verifyServerReceipt !== "function" || !isReferenceSourceInstant(data.effectiveAt)) {
    throw new TypeError(
      "Reference-source retention-authority evaluation requires a valid time and verifier"
    );
  }

  const findings: ReferenceSourceRetentionAuthorityFinding[] = [];
  validateUniqueRefs(
    data.acquisitionRefs,
    "duplicate_acquisition_ref",
    "Caller-derived acquisition scope contains duplicate references.",
    findings
  );
  validateUniqueRefs(
    data.accessDecisionRefs,
    "duplicate_access_decision_ref",
    "Caller-derived access-decision scope contains duplicate references.",
    findings
  );
  validateUniqueRefs(
    data.receipt.acquisitionRefs,
    "duplicate_acquisition_ref",
    "Retention receipt contains duplicate acquisition references.",
    findings
  );
  validateUniqueRefs(
    data.receipt.accessDecisionRefs,
    "duplicate_access_decision_ref",
    "Retention receipt contains duplicate access-decision references.",
    findings
  );

  validateExactScope(data, findings);
  validateAuthorityRefs(data, findings);
  validateReceiptIntegrity(data, verifyServerReceipt, findings);

  const receiptRef = recordRef(data.receipt);
  if (findings.length > 0) {
    return {
      schemaVersion: 1,
      status: "blocked",
      outcome: "retain",
      effectiveAt: data.effectiveAt,
      roleBindingRef: structuredClone(data.roleBindingRef),
      receiptRef,
      findings: sortFindings(findings),
    };
  }

  return {
    schemaVersion: 1,
    status: "allow",
    outcome: data.receipt.outcome,
    effectiveAt: data.effectiveAt,
    roleBindingRef: structuredClone(data.roleBindingRef),
    receiptRef,
    findings: [],
  };
}

/** Canonical bytes authenticated by the independently supplied verifier. */
export function referenceSourceRetentionAuthorityReceiptSigningPayload(
  receipt: ReferenceSourceRetentionAuthorityReceipt
): string {
  const { digest: _digest, proof, ...core } = receipt;
  const { signature: _signature, ...proofCore } = proof;
  return canonicalReferenceJson({ ...core, proof: proofCore });
}

function validateExactScope(
  data: ReferenceSourceRetentionAuthorityEvaluationData,
  findings: ReferenceSourceRetentionAuthorityFinding[]
): void {
  const receipt = data.receipt;
  const singletonPairs: Array<{
    expected: ReferenceRecordRef;
    actual: ReferenceRecordRef;
  }> = [
    { expected: data.observedSnapshotRef, actual: receipt.observedSnapshotRef },
    { expected: data.roleBindingRef, actual: receipt.roleBindingRef },
    { expected: data.digitalAssetRef, actual: receipt.digitalAssetRef },
    { expected: data.retentionPolicyRef, actual: receipt.retentionPolicyRef },
  ];
  if (
    singletonPairs.some(({ expected, actual }) => !refsEqual(expected, actual)) ||
    !sameExactRefSet(data.acquisitionRefs, receipt.acquisitionRefs) ||
    !sameExactRefSet(data.accessDecisionRefs, receipt.accessDecisionRefs)
  ) {
    addFinding(
      findings,
      "receipt_scope_mismatch",
      "Retention receipt does not equal the exact caller-derived role-binding tuple.",
      [
        data.observedSnapshotRef,
        receipt.observedSnapshotRef,
        data.roleBindingRef,
        receipt.roleBindingRef,
        data.digitalAssetRef,
        receipt.digitalAssetRef,
        ...data.acquisitionRefs,
        ...receipt.acquisitionRefs,
        ...data.accessDecisionRefs,
        ...receipt.accessDecisionRefs,
        data.retentionPolicyRef,
        receipt.retentionPolicyRef,
      ]
    );
  }
}

function validateAuthorityRefs(
  data: ReferenceSourceRetentionAuthorityEvaluationData,
  findings: ReferenceSourceRetentionAuthorityFinding[]
): void {
  const receipt = data.receipt;
  if (
    !refsEqual(data.authorityProofRef, receipt.authorityProofRef) ||
    !refsEqual(data.signingKeyRef, receipt.signingKeyRef) ||
    !refsEqual(data.verifierRef, receipt.verifierRef)
  ) {
    addFinding(
      findings,
      "receipt_authority_mismatch",
      "Retention receipt does not bind the expected proof, signing key, and verifier references.",
      [
        data.authorityProofRef,
        receipt.authorityProofRef,
        data.signingKeyRef,
        receipt.signingKeyRef,
        data.verifierRef,
        receipt.verifierRef,
      ]
    );
  }
}

function validateReceiptIntegrity(
  data: ReferenceSourceRetentionAuthorityEvaluationData,
  verifyServerReceipt: ReferenceSourceRetentionAuthorityReceiptVerifier,
  findings: ReferenceSourceRetentionAuthorityFinding[]
): void {
  const receipt = data.receipt;
  if (!verifyReferenceRecordDigest(receipt)) {
    addFinding(
      findings,
      "receipt_digest_invalid",
      "Retention-authority receipt digest is invalid.",
      [recordRef(receipt)]
    );
  }

  let signatureValid = false;
  try {
    signatureValid = verifyServerReceipt({
      receipt: structuredClone(receipt),
      signingPayload: referenceSourceRetentionAuthorityReceiptSigningPayload(receipt),
    });
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    addFinding(
      findings,
      "receipt_signature_invalid",
      "Retention-authority receipt was not authenticated by the trusted server verifier.",
      [recordRef(receipt)]
    );
  }

  if (
    !isReferenceSourceInstant(receipt.verifiedAt) ||
    !isReferenceSourceInstant(receipt.validUntil) ||
    (isReferenceSourceInstant(receipt.verifiedAt) &&
      compareReferenceSourceInstants(receipt.verifiedAt, data.effectiveAt) > 0) ||
    (isReferenceSourceInstant(receipt.validUntil) &&
      compareReferenceSourceInstants(receipt.validUntil, data.effectiveAt) <= 0)
  ) {
    addFinding(
      findings,
      "receipt_not_current",
      "Retention-authority receipt is future-dated, expired, or has an invalid validity boundary.",
      [recordRef(receipt)]
    );
  }
}

function validateUniqueRefs(
  refs: ReferenceRecordRef[],
  code: "duplicate_acquisition_ref" | "duplicate_access_decision_ref",
  detail: string,
  findings: ReferenceSourceRetentionAuthorityFinding[]
): void {
  if (new Set(refs.map(refKey)).size !== refs.length) {
    addFinding(findings, code, detail, refs);
  }
}

function addFinding(
  findings: ReferenceSourceRetentionAuthorityFinding[],
  code: ReferenceSourceRetentionAuthorityFindingCode,
  detail: string,
  refs: ReferenceRecordRef[]
): void {
  findings.push({ code, detail, refs: uniqueRefs(refs) });
}

function sortFindings(
  findings: ReferenceSourceRetentionAuthorityFinding[]
): ReferenceSourceRetentionAuthorityFinding[] {
  return [...findings].sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.detail.localeCompare(right.detail) ||
      compareRefArrays(left.refs, right.refs)
  );
}

function recordRef(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function refKey(ref: ReferenceRecordRef): string {
  return `${ref.id}\u0000${ref.digest}`;
}

function refsEqual(left: ReferenceRecordRef, right: ReferenceRecordRef): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function sameExactRefSet(left: ReferenceRecordRef[], right: ReferenceRecordRef[]): boolean {
  const leftKeys = new Set(left.map(refKey));
  const rightKeys = new Set(right.map(refKey));
  return (
    leftKeys.size === left.length &&
    rightKeys.size === right.length &&
    leftKeys.size === rightKeys.size &&
    [...leftKeys].every((key) => rightKeys.has(key))
  );
}

function uniqueRefs(refs: ReferenceRecordRef[]): ReferenceRecordRef[] {
  return [...new Map(refs.map((ref) => [refKey(ref), structuredClone(ref)])).values()].sort(
    compareRefs
  );
}

function compareRefs(left: ReferenceRecordRef, right: ReferenceRecordRef): number {
  return left.id.localeCompare(right.id) || left.digest.localeCompare(right.digest);
}

function compareRefArrays(left: ReferenceRecordRef[], right: ReferenceRecordRef[]): number {
  const leftKey = left.map(refKey).join("\u0001");
  const rightKey = right.map(refKey).join("\u0001");
  return leftKey.localeCompare(rightKey);
}
