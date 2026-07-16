import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";

import {
  ReferenceAccessDecisionSchema,
  ReferenceRecordRefSchema,
  ReferenceRightsAssertionSchema,
  canonicalReferenceJson,
  referenceSourceDigest,
  verifyReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAccessOperation,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
} from "./reference-source-domain.js";
import { isReferenceSourceInstant } from "./reference-source-instant.js";

const Strict = { additionalProperties: false } as const;
const IdSchema = Type.String({ minLength: 1 });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
});

export const ReferenceAuthorityFacetSchema = Type.Union([
  Type.Literal("underlying_work_status"),
  Type.Literal("manifestation_editorial"),
  Type.Literal("translation"),
  Type.Literal("exemplar_restriction"),
  Type.Literal("scan_provider_terms"),
  Type.Literal("owner_private_access"),
  Type.Literal("local_extraction"),
  Type.Literal("named_provider_processing"),
  Type.Literal("pack_citation_excerpt"),
  Type.Literal("export_redistribution"),
  Type.Literal("attribution"),
]);
export type ReferenceAuthorityFacet = Static<typeof ReferenceAuthorityFacetSchema>;

export const ReferenceAuthoritySubjectFacetRequirementSchema = Type.Object(
  {
    subjectRef: ReferenceRecordRefSchema,
    facet: ReferenceAuthorityFacetSchema,
  },
  Strict
);
export type ReferenceAuthoritySubjectFacetRequirement = Static<
  typeof ReferenceAuthoritySubjectFacetRequirementSchema
>;

/**
 * Required rights facets are conjunctive. A facet can be discharged only by a
 * current affirmative assertion or an explicit, evidence-backed
 * `not_applicable` assertion. Keeping the complete matrix here prevents a
 * caller from weakening a provider, repository, or export decision by choosing
 * one convenient rights category.
 */
assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
export const REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS = Object.freeze({
  underlying_work_use: ["underlying_work_status"],
  manifestation_use: ["underlying_work_status", "manifestation_editorial"],
  exemplar_access: ["exemplar_restriction"],
  scan_provider_use: ["scan_provider_terms", "attribution"],
  owner_private_study: ["owner_private_access"],
  local_extraction: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "owner_private_access",
    "local_extraction",
  ],
  provider_ocr: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "owner_private_access",
    "named_provider_processing",
    "attribution",
  ],
  provider_omr: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "owner_private_access",
    "named_provider_processing",
    "attribution",
  ],
  provider_translation: [
    "underlying_work_status",
    "manifestation_editorial",
    "translation",
    "exemplar_restriction",
    "scan_provider_terms",
    "owner_private_access",
    "named_provider_processing",
    "attribution",
  ],
  provider_model_processing: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "owner_private_access",
    "named_provider_processing",
    "attribution",
  ],
  pack_citation: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "pack_citation_excerpt",
    "attribution",
  ],
  pack_excerpt: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "pack_citation_excerpt",
    "export_redistribution",
    "attribution",
  ],
  fixture_inclusion: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "pack_citation_excerpt",
    "export_redistribution",
    "attribution",
  ],
  repository_inclusion: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "pack_citation_excerpt",
    "export_redistribution",
    "attribution",
  ],
  export: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "export_redistribution",
    "attribution",
  ],
  redistribution: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "export_redistribution",
    "attribution",
  ],
  report: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "export_redistribution",
    "attribution",
  ],
  log: [
    "underlying_work_status",
    "manifestation_editorial",
    "exemplar_restriction",
    "scan_provider_terms",
    "export_redistribution",
    "attribution",
  ],
} satisfies Record<ReferenceAccessOperation, readonly ReferenceAuthorityFacet[]>);

const ReferenceAuthorityServerProofSchema = Type.Object(
  {
    kind: Type.Literal("server_signature"),
    algorithm: Type.Union([Type.Literal("ed25519"), Type.Literal("hmac-sha256")]),
    keyId: Type.String({ minLength: 1 }),
    signature: Type.String({ pattern: "^[A-Za-z0-9_-]+$" }),
  },
  Strict
);

export const ReferenceAuthorityVerificationReceiptSchema = Type.Object(
  {
    recordKind: Type.Literal("reference_authority_verification_receipt"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    observedSnapshotRef: ReferenceRecordRefSchema,
    accessDecisionRef: ReferenceRecordRefSchema,
    accessDecisionFirstObservedRevision: Type.Integer({ minimum: 1 }),
    reviewedProvenanceSubstitutionRefs: Type.Array(ReferenceRecordRefSchema),
    currentRightsAssertionRefs: Type.Array(ReferenceRecordRefSchema),
    rightsAssertionObservations: Type.Array(
      Type.Object(
        {
          rightsAssertionRef: ReferenceRecordRefSchema,
          firstObservedRevision: Type.Integer({ minimum: 1 }),
        },
        Strict
      )
    ),
    authoritySubjectRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    verifiedAuthorityRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    requiredFacets: Type.Array(ReferenceAuthorityFacetSchema, { minItems: 1 }),
    requiredSubjectFacets: Type.Array(ReferenceAuthoritySubjectFacetRequirementSchema, {
      minItems: 1,
    }),
    notApplicableFacets: Type.Optional(
      Type.Array(
        Type.Object(
          {
            subjectRef: ReferenceRecordRefSchema,
            facet: ReferenceAuthorityFacetSchema,
            rationale: Type.String({ minLength: 1 }),
            evidenceRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
          },
          Strict
        )
      )
    ),
    verifierRef: ReferenceRecordRefSchema,
    verifierPolicyRef: ReferenceRecordRefSchema,
    verifiedAt: IsoTimestampSchema,
    validUntil: Type.Optional(IsoTimestampSchema),
    proof: ReferenceAuthorityServerProofSchema,
    digest: DigestSchema,
  },
  Strict
);
export type ReferenceAuthorityVerificationReceipt = Static<
  typeof ReferenceAuthorityVerificationReceiptSchema
>;

export const ReferenceSourceAuthorityEvaluationDataSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    effectiveAt: IsoTimestampSchema,
    accessDecisionRef: ReferenceRecordRefSchema,
    authoritySubjectRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    requiredSubjectFacets: Type.Array(ReferenceAuthoritySubjectFacetRequirementSchema, {
      minItems: 1,
    }),
    accessDecisions: Type.Array(ReferenceAccessDecisionSchema, { minItems: 1 }),
    rightsAssertions: Type.Array(ReferenceRightsAssertionSchema),
    receipt: ReferenceAuthorityVerificationReceiptSchema,
  },
  Strict
);
export type ReferenceSourceAuthorityEvaluationData = Static<
  typeof ReferenceSourceAuthorityEvaluationDataSchema
>;

export type ReferenceAuthorityReceiptVerifier = (input: {
  receipt: ReferenceAuthorityVerificationReceipt;
  signingPayload: string;
}) => boolean;

export type ReferenceAuthorityFindingCode =
  | "access_decision_not_found"
  | "access_decision_not_current"
  | "access_decision_digest_invalid"
  | "access_decision_denied"
  | "access_decision_review_required"
  | "access_decision_expired"
  | "rights_assertion_digest_invalid"
  | "rights_assertion_time_invalid"
  | "rights_assertion_evidence_missing"
  | "rights_assertion_scope_missing"
  | "facet_missing"
  | "facet_restricted"
  | "facet_conflicting"
  | "facet_unknown"
  | "facet_applicability_conflict"
  | "receipt_digest_invalid"
  | "receipt_signature_invalid"
  | "receipt_not_current"
  | "receipt_decision_mismatch"
  | "receipt_rights_mismatch"
  | "receipt_authority_mismatch"
  | "receipt_scope_mismatch"
  | "receipt_facets_mismatch"
  | "subject_facet_requirements_invalid"
  | "receipt_subject_facets_mismatch";

export type ReferenceAuthorityFinding = {
  code: ReferenceAuthorityFindingCode;
  detail: string;
  facet?: ReferenceAuthorityFacet;
  refs: ReferenceRecordRef[];
};

export type ReferenceSourceAuthorityEvaluation = {
  schemaVersion: 1;
  status: "allow" | "deny" | "review_required";
  effectiveAt: string;
  accessDecisionRef: ReferenceRecordRef;
  operation: ReferenceAccessOperation | "unresolved";
  requiredFacets: ReferenceAuthorityFacet[];
  currentRightsAssertionRefs: ReferenceRecordRef[];
  findings: ReferenceAuthorityFinding[];
};

export type ReferenceSourceAuthorityEvaluationInput = ReferenceSourceAuthorityEvaluationData & {
  verifyServerReceipt: ReferenceAuthorityReceiptVerifier;
};

/**
 * Evaluate current authority without treating claimant-controlled authority
 * refs, assertion status, or a receipt-shaped JSON object as proof. The server
 * verifier must authenticate the receipt over the returned signing payload.
 */
export function evaluateReferenceSourceAuthority(
  input: ReferenceSourceAuthorityEvaluationInput
): ReferenceSourceAuthorityEvaluation {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  const { verifyServerReceipt, ...data } = input;
  if (!Value.Check(ReferenceSourceAuthorityEvaluationDataSchema, data)) {
    throw new TypeError("Reference-source authority input does not match the closed schema");
  }
  if (typeof verifyServerReceipt !== "function" || !isSemanticIsoTimestamp(data.effectiveAt)) {
    throw new TypeError("Reference-source authority evaluation requires a valid time and verifier");
  }

  const findings: ReferenceAuthorityFinding[] = [];
  const decisions = [...data.accessDecisions].sort(compareVersionedRecords);
  for (const decision of decisions) {
    if (!verifyReferenceRecordDigest(decision)) {
      finding(findings, "access_decision_digest_invalid", "Access Decision digest is invalid.", [
        recordRef(decision),
      ]);
    }
  }
  const decision = decisions.find((candidate) => refsEqual(candidate, data.accessDecisionRef));
  if (!decision) {
    finding(
      findings,
      "access_decision_not_found",
      "The exact Access Decision is absent from the authority closure.",
      [data.accessDecisionRef]
    );
    return result(data, "unresolved", [], [], findings);
  }

  const requiredFacets = [
    ...REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS[decision.operation],
  ].sort();
  validateDecisionCurrent(decision, decisions, data.effectiveAt, findings);

  const scopeRefs = [...data.authoritySubjectRefs].sort(compareRefs);
  const requiredSubjectFacets = [...data.requiredSubjectFacets].sort(compareSubjectFacets);
  const decisionRefs = uniqueRefs([...decision.sourceRefs, ...decision.derivativeRefs]);
  if (!decisionRefs.every((ref) => containsRef(scopeRefs, ref))) {
    finding(
      findings,
      "receipt_scope_mismatch",
      "The caller-derived authority-subject closure does not cover every exact source and derivative ref.",
      [...scopeRefs, ...decisionRefs]
    );
  }
  validateRequiredSubjectFacets(requiredSubjectFacets, scopeRefs, requiredFacets, findings);
  const currentAssertions = currentApplicableAssertions(
    data.rightsAssertions,
    requiredSubjectFacets,
    data.effectiveAt,
    findings
  );
  const currentAssertionRefs = currentAssertions.map(recordRef).sort(compareRefs);

  validateReceipt(
    data.receipt,
    decision,
    scopeRefs,
    requiredFacets,
    requiredSubjectFacets,
    currentAssertionRefs,
    data.effectiveAt,
    verifyServerReceipt,
    findings
  );
  validateDecisionAssertionClosure(decision, currentAssertionRefs, findings);
  evaluateFacets(
    requiredSubjectFacets,
    currentAssertions,
    data.receipt.notApplicableFacets ?? [],
    data.effectiveAt,
    findings
  );

  if (decision.outcome === "deny") {
    finding(
      findings,
      "access_decision_denied",
      "The current Access Decision denies the operation.",
      [recordRef(decision)]
    );
  } else if (decision.outcome === "review_required") {
    finding(
      findings,
      "access_decision_review_required",
      "The current Access Decision requires review.",
      [recordRef(decision)]
    );
  }

  return result(
    data,
    decision.operation,
    requiredFacets,
    currentAssertionRefs,
    sortFindings(findings)
  );
}

export function referenceAuthorityReceiptSigningPayload(
  receipt: ReferenceAuthorityVerificationReceipt
): string {
  assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
  const { digest: _digest, proof, ...core } = receipt;
  const { signature: _signature, ...proofCore } = proof;
  return canonicalReferenceJson({ ...core, proof: proofCore });
}

function validateDecisionCurrent(
  decision: ReferenceAccessDecision,
  decisions: ReferenceAccessDecision[],
  effectiveAt: string,
  findings: ReferenceAuthorityFinding[]
): void {
  if (!isSemanticIsoTimestamp(decision.decidedAt)) {
    finding(
      findings,
      "access_decision_not_current",
      "The Access Decision has an invalid decision time.",
      [recordRef(decision)]
    );
    return;
  }
  const current = decisions
    .filter(
      (candidate) =>
        candidate.id === decision.id &&
        isSemanticIsoTimestamp(candidate.decidedAt) &&
        Date.parse(candidate.decidedAt) <= Date.parse(effectiveAt)
    )
    .sort(compareVersionedRecords)
    .at(-1);
  if (!current || !refsEqual(current, decision)) {
    finding(
      findings,
      "access_decision_not_current",
      "The receipt targets a superseded or future Access Decision.",
      [recordRef(decision)]
    );
  }
  if (
    decision.validUntil !== undefined &&
    (!isSemanticIsoTimestamp(decision.validUntil) ||
      Date.parse(decision.validUntil) <= Date.parse(effectiveAt))
  ) {
    finding(
      findings,
      "access_decision_expired",
      "The Access Decision is expired or has an invalid validity boundary.",
      [recordRef(decision)]
    );
  }
}

function currentApplicableAssertions(
  assertions: ReferenceRightsAssertion[],
  requiredSubjectFacets: ReferenceAuthoritySubjectFacetRequirement[],
  effectiveAt: string,
  findings: ReferenceAuthorityFinding[]
): ReferenceRightsAssertion[] {
  const currentById = new Map<string, ReferenceRightsAssertion>();
  for (const assertion of assertions) {
    if (!verifyReferenceRecordDigest(assertion)) {
      finding(
        findings,
        "rights_assertion_digest_invalid",
        "A Rights Assertion digest is invalid.",
        [recordRef(assertion)],
        assertion.rightsKind
      );
      continue;
    }
    if (!isSemanticIsoTimestamp(assertion.assertedAt)) {
      finding(
        findings,
        "rights_assertion_time_invalid",
        "A Rights Assertion has an invalid assertion time.",
        [recordRef(assertion)],
        assertion.rightsKind
      );
      continue;
    }
    if (Date.parse(assertion.assertedAt) > Date.parse(effectiveAt)) continue;
    const current = currentById.get(assertion.id);
    if (!current || compareVersionedRecords(current, assertion) < 0) {
      currentById.set(assertion.id, assertion);
    }
  }

  return [...currentById.values()]
    .filter((assertion) =>
      requiredSubjectFacets.some(
        (requirement) =>
          requirement.facet === assertion.rightsKind &&
          refsEqual(requirement.subjectRef, assertion.subjectRef)
      )
    )
    .sort(compareVersionedRecords);
}

function validateRequiredSubjectFacets(
  requirements: ReferenceAuthoritySubjectFacetRequirement[],
  authoritySubjectRefs: ReferenceRecordRef[],
  requiredFacets: ReferenceAuthorityFacet[],
  findings: ReferenceAuthorityFinding[]
): void {
  const keys = requirements.map(subjectFacetKey);
  const duplicate = new Set(keys).size !== keys.length;
  const outOfScope = requirements.some(
    (requirement) =>
      !containsRef(authoritySubjectRefs, requirement.subjectRef) ||
      !requiredFacets.includes(requirement.facet)
  );
  const coveredFacets = [...new Set(requirements.map(({ facet }) => facet))];
  const incompleteMatrix = !sameStringSet(coveredFacets, requiredFacets);

  if (duplicate || outOfScope || incompleteMatrix) {
    finding(
      findings,
      "subject_facet_requirements_invalid",
      "Caller-derived subject-facet requirements must be duplicate-free, stay inside the exact authority scope and operation matrix, and cover every required operation facet.",
      requirements.map(({ subjectRef }) => subjectRef)
    );
  }
}

function validateReceipt(
  receipt: ReferenceAuthorityVerificationReceipt,
  decision: ReferenceAccessDecision,
  authoritySubjectRefs: ReferenceRecordRef[],
  requiredFacets: ReferenceAuthorityFacet[],
  requiredSubjectFacets: ReferenceAuthoritySubjectFacetRequirement[],
  currentAssertionRefs: ReferenceRecordRef[],
  effectiveAt: string,
  verifyServerReceipt: ReferenceAuthorityReceiptVerifier,
  findings: ReferenceAuthorityFinding[]
): void {
  const { digest, ...core } = receipt;
  if (referenceSourceDigest(core) !== digest) {
    finding(findings, "receipt_digest_invalid", "Authority receipt digest is invalid.", [
      recordRef(receipt),
    ]);
  }
  let signatureValid = false;
  try {
    signatureValid = verifyServerReceipt({
      receipt,
      signingPayload: referenceAuthorityReceiptSigningPayload(receipt),
    });
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    finding(
      findings,
      "receipt_signature_invalid",
      "Authority receipt was not authenticated by the trusted server verifier.",
      [recordRef(receipt)]
    );
  }
  if (!refsEqual(receipt.accessDecisionRef, decision)) {
    finding(
      findings,
      "receipt_decision_mismatch",
      "Authority receipt is bound to another Access Decision.",
      [receipt.accessDecisionRef, recordRef(decision)]
    );
  }
  if (!sameRefSet(receipt.authoritySubjectRefs, authoritySubjectRefs)) {
    finding(
      findings,
      "receipt_scope_mismatch",
      "Authority receipt scope does not equal the exact caller-derived authority-subject closure.",
      [...receipt.authoritySubjectRefs, ...authoritySubjectRefs]
    );
  }
  if (!sameRefSet(receipt.currentRightsAssertionRefs, currentAssertionRefs)) {
    finding(
      findings,
      "receipt_rights_mismatch",
      "Authority receipt is not bound to the exact current applicable Rights Assertion closure.",
      [...receipt.currentRightsAssertionRefs, ...currentAssertionRefs]
    );
  }
  if (
    decision.authorityRefs.length === 0 ||
    !sameRefSet(receipt.verifiedAuthorityRefs, decision.authorityRefs)
  ) {
    finding(
      findings,
      "receipt_authority_mismatch",
      "Opaque authority refs cannot authorize use without exact server verification.",
      [...receipt.verifiedAuthorityRefs, ...decision.authorityRefs]
    );
  }
  if (!sameStringSet(receipt.requiredFacets, requiredFacets)) {
    finding(
      findings,
      "receipt_facets_mismatch",
      "Authority receipt does not bind the operation's complete conjunctive facet set.",
      [recordRef(receipt)]
    );
  }
  if (!sameSubjectFacetSet(receipt.requiredSubjectFacets, requiredSubjectFacets)) {
    finding(
      findings,
      "receipt_subject_facets_mismatch",
      "Authority receipt does not bind the exact duplicate-free caller-derived subject-facet requirements.",
      [
        recordRef(receipt),
        ...receipt.requiredSubjectFacets.map(({ subjectRef }) => subjectRef),
        ...requiredSubjectFacets.map(({ subjectRef }) => subjectRef),
      ]
    );
  }
  const notApplicable = receipt.notApplicableFacets ?? [];
  const notApplicableKeys = notApplicable.map(subjectFacetKey);
  if (
    new Set(notApplicableKeys).size !== notApplicableKeys.length ||
    notApplicable.some(
      (entry) =>
        !requiredSubjectFacets.some(
          (requirement) =>
            requirement.facet === entry.facet && refsEqual(requirement.subjectRef, entry.subjectRef)
        )
    )
  ) {
    finding(
      findings,
      "facet_applicability_conflict",
      "Authority receipt has duplicate or out-of-scope subject-bound not-applicable facet resolutions.",
      [recordRef(receipt)]
    );
  }
  if (
    !isSemanticIsoTimestamp(receipt.verifiedAt) ||
    Date.parse(receipt.verifiedAt) > Date.parse(effectiveAt) ||
    (receipt.validUntil !== undefined &&
      (!isSemanticIsoTimestamp(receipt.validUntil) ||
        Date.parse(receipt.validUntil) <= Date.parse(effectiveAt)))
  ) {
    finding(
      findings,
      "receipt_not_current",
      "Authority receipt is future-dated, expired, or has an invalid validity boundary.",
      [recordRef(receipt)]
    );
  }
}

function validateDecisionAssertionClosure(
  decision: ReferenceAccessDecision,
  currentAssertionRefs: ReferenceRecordRef[],
  findings: ReferenceAuthorityFinding[]
): void {
  if (!sameRefSet(decision.rightsAssertionRefs, currentAssertionRefs)) {
    finding(
      findings,
      "rights_assertion_scope_missing",
      "Access Decision omits or adds a current applicable Rights Assertion.",
      [...decision.rightsAssertionRefs, ...currentAssertionRefs]
    );
  }
}

function evaluateFacets(
  requirements: ReferenceAuthoritySubjectFacetRequirement[],
  assertions: ReferenceRightsAssertion[],
  notApplicableFacets: Array<{
    subjectRef: ReferenceRecordRef;
    facet: ReferenceAuthorityFacet;
    rationale: string;
    evidenceRefs: ReferenceRecordRef[];
  }>,
  effectiveAt: string,
  findings: ReferenceAuthorityFinding[]
): void {
  for (const { subjectRef, facet } of requirements) {
    const candidates = assertions.filter(
      (assertion) => assertion.rightsKind === facet && refsEqual(assertion.subjectRef, subjectRef)
    );
    const receiptNotApplicable = notApplicableFacets.filter(
      (entry) => entry.facet === facet && refsEqual(entry.subjectRef, subjectRef)
    );
    if (candidates.length > 0 && receiptNotApplicable.length > 0) {
      finding(
        findings,
        "facet_applicability_conflict",
        `Required authority facet ${facet} for subject ${subjectRef.id} is both asserted and marked not applicable.`,
        [subjectRef, ...candidates.map(recordRef)],
        facet
      );
      continue;
    }
    if (candidates.length === 0) {
      if (receiptNotApplicable.length === 1 && receiptNotApplicable[0]!.evidenceRefs.length > 0) {
        continue;
      }
      finding(
        findings,
        "facet_missing",
        `Required authority facet ${facet} is missing for subject ${subjectRef.id}.`,
        [subjectRef],
        facet
      );
      continue;
    }
    const usable = candidates.filter((assertion) => {
      const boundariesValid =
        (!assertion.validFrom ||
          (isSemanticIsoTimestamp(assertion.validFrom) &&
            Date.parse(assertion.validFrom) <= Date.parse(effectiveAt))) &&
        (!assertion.validUntil ||
          (isSemanticIsoTimestamp(assertion.validUntil) &&
            Date.parse(assertion.validUntil) > Date.parse(effectiveAt)));
      if (!boundariesValid) {
        finding(
          findings,
          "rights_assertion_time_invalid",
          `Rights Assertion for ${facet} on subject ${subjectRef.id} is outside its valid interval or has an invalid boundary.`,
          [subjectRef, recordRef(assertion)],
          facet
        );
      }
      if (assertion.status !== "unknown" && assertion.evidenceRefs.length === 0) {
        finding(
          findings,
          "rights_assertion_evidence_missing",
          `Rights Assertion for ${facet} on subject ${subjectRef.id} is not evidence-bearing.`,
          [subjectRef, recordRef(assertion)],
          facet
        );
        return false;
      }
      return boundariesValid;
    });
    if (usable.some((assertion) => assertion.status === "restricted")) {
      finding(
        findings,
        "facet_restricted",
        `Required authority facet ${facet} is restricted for subject ${subjectRef.id}.`,
        [
          subjectRef,
          ...usable.filter((assertion) => assertion.status === "restricted").map(recordRef),
        ],
        facet
      );
      continue;
    }
    if (usable.some((assertion) => assertion.status === "conflicting")) {
      finding(
        findings,
        "facet_conflicting",
        `Required authority facet ${facet} is conflicting for subject ${subjectRef.id}.`,
        [
          subjectRef,
          ...usable.filter((assertion) => assertion.status === "conflicting").map(recordRef),
        ],
        facet
      );
      continue;
    }
    if (usable.some((assertion) => assertion.status === "unknown")) {
      finding(
        findings,
        "facet_unknown",
        `Required authority facet ${facet} is unknown for subject ${subjectRef.id}.`,
        [
          subjectRef,
          ...usable.filter((assertion) => assertion.status === "unknown").map(recordRef),
        ],
        facet
      );
      continue;
    }
    const affirmative = usable.some((assertion) =>
      ["public_domain", "licensed", "permitted"].includes(assertion.status)
    );
    const notApplicable = usable.some((assertion) => assertion.status === "not_applicable");
    if (affirmative && notApplicable) {
      finding(
        findings,
        "facet_applicability_conflict",
        `Required authority facet ${facet} for subject ${subjectRef.id} is both applicable and not applicable.`,
        [subjectRef, ...usable.map(recordRef)],
        facet
      );
    } else if (!affirmative && !notApplicable) {
      finding(
        findings,
        "facet_unknown",
        `Required authority facet ${facet} for subject ${subjectRef.id} has no affirmative or evidence-backed not-applicable result.`,
        [subjectRef, ...usable.map(recordRef)],
        facet
      );
    }
  }
}

function result(
  data: ReferenceSourceAuthorityEvaluationData,
  operation: ReferenceAccessOperation | "unresolved",
  requiredFacets: ReferenceAuthorityFacet[],
  currentRightsAssertionRefs: ReferenceRecordRef[],
  findings: ReferenceAuthorityFinding[]
): ReferenceSourceAuthorityEvaluation {
  const denied = findings.some(
    (item) => item.code === "access_decision_denied" || item.code === "facet_restricted"
  );
  return {
    schemaVersion: 1,
    status: denied ? "deny" : findings.length === 0 ? "allow" : "review_required",
    effectiveAt: data.effectiveAt,
    accessDecisionRef: data.accessDecisionRef,
    operation,
    requiredFacets,
    currentRightsAssertionRefs,
    findings: sortFindings(findings),
  };
}

function finding(
  findings: ReferenceAuthorityFinding[],
  code: ReferenceAuthorityFindingCode,
  detail: string,
  refs: ReferenceRecordRef[],
  facet?: ReferenceAuthorityFacet
): void {
  findings.push({ code, detail, refs: uniqueRefs(refs), ...(facet ? { facet } : {}) });
}

function sortFindings(findings: ReferenceAuthorityFinding[]): ReferenceAuthorityFinding[] {
  return [...findings]
    .sort(
      (left, right) =>
        findingPrecedence(left) - findingPrecedence(right) ||
        left.code.localeCompare(right.code) ||
        (left.facet ?? "").localeCompare(right.facet ?? "") ||
        left.detail.localeCompare(right.detail)
    )
    .filter((item, index, sorted) => {
      const prior = sorted[index - 1];
      return (
        !prior ||
        item.code !== prior.code ||
        item.facet !== prior.facet ||
        item.detail !== prior.detail ||
        !sameRefSet(item.refs, prior.refs)
      );
    });
}

function findingPrecedence(finding: ReferenceAuthorityFinding): number {
  if (finding.code === "access_decision_denied" || finding.code === "facet_restricted") return 0;
  if (finding.code === "facet_conflicting" || finding.code === "facet_applicability_conflict") {
    return 1;
  }
  if (finding.code === "facet_unknown" || finding.code === "facet_missing") return 2;
  return 3;
}

function isSemanticIsoTimestamp(value: string): boolean {
  return isReferenceSourceInstant(value);
}

function recordRef(record: { id: string; digest: string }): ReferenceRecordRef {
  return { id: record.id, digest: record.digest };
}

function refKey(ref: ReferenceRecordRef): string {
  return `${ref.id}\u0000${ref.digest}`;
}

function refsEqual(left: ReferenceRecordRef, right: ReferenceRecordRef): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function containsRef(refs: ReferenceRecordRef[], target: ReferenceRecordRef): boolean {
  return refs.some((ref) => refsEqual(ref, target));
}

function uniqueRefs(refs: ReferenceRecordRef[]): ReferenceRecordRef[] {
  return [...new Map(refs.map((ref) => [refKey(ref), ref])).values()].sort(compareRefs);
}

function sameRefSet(left: ReferenceRecordRef[], right: ReferenceRecordRef[]): boolean {
  const leftKeys = new Set(left.map(refKey));
  const rightKeys = new Set(right.map(refKey));
  return (
    leftKeys.size === left.length &&
    rightKeys.size === right.length &&
    leftKeys.size === rightKeys.size &&
    [...leftKeys].every((key) => rightKeys.has(key))
  );
}

function sameStringSet(left: string[], right: string[]): boolean {
  return (
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.length === right.length &&
    left.every((value) => right.includes(value))
  );
}

function subjectFacetKey(requirement: ReferenceAuthoritySubjectFacetRequirement): string {
  return `${refKey(requirement.subjectRef)}\u0000${requirement.facet}`;
}

function sameSubjectFacetSet(
  left: ReferenceAuthoritySubjectFacetRequirement[],
  right: ReferenceAuthoritySubjectFacetRequirement[]
): boolean {
  const leftKeys = new Set(left.map(subjectFacetKey));
  const rightKeys = new Set(right.map(subjectFacetKey));
  return (
    leftKeys.size === left.length &&
    rightKeys.size === right.length &&
    leftKeys.size === rightKeys.size &&
    [...leftKeys].every((key) => rightKeys.has(key))
  );
}

function compareSubjectFacets(
  left: ReferenceAuthoritySubjectFacetRequirement,
  right: ReferenceAuthoritySubjectFacetRequirement
): number {
  return compareRefs(left.subjectRef, right.subjectRef) || left.facet.localeCompare(right.facet);
}

function compareRefs(left: ReferenceRecordRef, right: ReferenceRecordRef): number {
  return left.id.localeCompare(right.id) || left.digest.localeCompare(right.digest);
}

function compareVersionedRecords(
  left: { id: string; version: number; digest: string },
  right: { id: string; version: number; digest: string }
): number {
  return (
    left.id.localeCompare(right.id) ||
    left.version - right.version ||
    left.digest.localeCompare(right.digest)
  );
}
