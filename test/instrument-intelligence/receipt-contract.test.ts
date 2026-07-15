import {
  createHash,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTHORITY_DOMAINS,
  AUTHORITY_SNAPSHOT_SCHEMA_ID,
  AUTHORITY_TARGETS,
  CLAIM_SCOPE_DIMENSIONS,
  EVIDENCE_RECEIPT_SCHEMA_ID,
  HUMAN_REVIEW_ROLES,
  PUBLIC_REVIEW_RECEIPT_SCHEMA_ID,
  START_RECEIPT_SCHEMA_ID,
  authorityReceiptGrantsAuthority,
  compileCanonicalPredicateWitness,
  digestAuthorityPayload,
  digestClaimScope,
  validateAuthoritySnapshot,
  validateClauseClaims,
  validateEvidenceReceipt,
  validateGateReceipt,
  validateHumanReviewAuthorityReceipt,
  validateMediaSanitization,
  validateOwnerDecisionAuthorityReceipt,
  validatePrivacyReceipt,
  validatePublicReviewReceipt,
  validateStartReceipt,
  validateToolchainReceipt,
} from "../../scripts/lib/instrument-intelligence-receipts.mjs";

const sha = (character: string) => character.repeat(64);
const commit = (character: string) => character.repeat(40);
const evidenceSchema = JSON.parse(
  readFileSync(
    new URL("../../schemas/instrument-intelligence/evidence.v2.schema.json", import.meta.url),
    "utf8"
  )
);

const reviewerKeys = generateKeyPairSync("ed25519");
const ownerKeys = generateKeyPairSync("ed25519");
const verifierKeys = generateKeyPairSync("ed25519");
const privateKeys = new Map([
  ["reviewer-credential-1", reviewerKeys.privateKey],
  ["owner-credential-1", ownerKeys.privateKey],
  ["authority-verifier-credential", verifierKeys.privateKey],
]);
const publicKeys = new Map([
  ["reviewer-credential-1", reviewerKeys.publicKey],
  ["owner-credential-1", ownerKeys.publicKey],
  ["authority-verifier-credential", verifierKeys.publicKey],
]);
const trustedSignatureOptions = {
  expectedVerifierPolicyDigest: sha("8"),
  verifySignature: ({
    algorithm,
    credentialId,
    signature,
    signedPayloadDigest,
  }: {
    algorithm: string;
    credentialId: string;
    signature: string;
    signedPayloadDigest: string;
  }) => {
    const publicKey = publicKeys.get(credentialId);
    if (!publicKey) return null;
    if (algorithm !== "ed25519") return false;
    return cryptoVerify(
      null,
      Buffer.from(signedPayloadDigest, "hex"),
      publicKey,
      Buffer.from(signature, "base64url")
    );
  },
};

function authoritySnapshot(): any {
  const pathDigests = [
    { path: "CONTEXT.md", sha256: sha("1") },
    { path: "SPEC.md", sha256: sha("2") },
  ];
  return {
    schemaId: AUTHORITY_SNAPSHOT_SCHEMA_ID,
    authoritySetDigest: createHash("sha256").update(JSON.stringify(pathDigests)).digest("hex"),
    pathDigests,
  };
}

function startReceipt(): any {
  return {
    schemaId: START_RECEIPT_SCHEMA_ID,
    start: {
      tracerId: "T01",
      generation: 1,
      startedAt: "2026-07-15T12:00:01.000Z",
    },
    definition: {
      path: ".scratch/instrument-intelligence/issues/01-governing-contract-baseline-guard.md",
      sha256: sha("3"),
      gateMatrixDigest: sha("4"),
      completionSemantics: "implementation-pass",
    },
    authoritySnapshot: authoritySnapshot(),
    registry: {
      generation: 1,
      baseWaveHighestId: 107,
      registryHead: sha("5"),
      tombstoneSetDigest: sha("6"),
    },
    predecessors: [],
    predicateWitnesses: [],
    publication: {
      remote: "origin",
      remoteIdentity: "github.com/jefffm/vellum",
      branch: "refs/heads/main",
      repository: {
        nodeId: "R_kgDOSNEx6w",
        databaseId: 1221669355,
        nameWithOwner: "jefffm/vellum",
      },
      checkpoint: {
        bootstrapAnchor: {
          ref: "refs/vellum/instrument-intelligence/bootstrap-anchor",
          object: commit("7"),
        },
        trustPolicy: {
          ref: "refs/vellum/instrument-intelligence/trust-policy",
          object: commit("8"),
        },
        trustedMain: {
          ref: "refs/vellum/instrument-intelligence/trusted-main",
          object: commit("9"),
        },
      },
      fetchedHead: commit("9"),
      graphQlHead: commit("9"),
      remoteProtectionAssumed: false,
      observedAt: "2026-07-15T12:00:00.000Z",
    },
    execution: {
      baseCommit: commit("9"),
      productTreeDigest: sha("a"),
      generationSystem: { id: "vellum-verifier", version: "6.0.0", digest: sha("b") },
      subjects: [
        { kind: "component", id: "receipt-validator", version: "1.0.0", digest: sha("c") },
        { kind: "package", id: "vellum", version: "0.1.0", digest: sha("d") },
        { kind: "system", id: "instrument-intelligence", version: "6", digest: sha("e") },
      ],
    },
  };
}

function evidenceReceipt(): any {
  return {
    schemaId: EVIDENCE_RECEIPT_SCHEMA_ID,
    startReceipt: startReceipt(),
    finishedAt: "2026-07-15T12:01:00.000Z",
    outcome: {
      issueCompletion: "complete",
      productAcceptance: "pass",
      applicability: "applicable",
      comparison: "not_required",
      freshness: "current",
      compatibility: "compatible",
      authorityValidity: "valid",
      supersedes: [],
      invalidates: [],
      resultDisposition: {
        code: "contract_guard_passed",
        disposition: "unlock",
        dispatchArtifactIds: [],
      },
    },
    gates: [
      {
        gateId: "t01-focused",
        group: "focused",
        command: "npm test -- test/instrument-intelligence/receipt-contract.test.ts",
        commandDigest: createHash("sha256")
          .update("npm test -- test/instrument-intelligence/receipt-contract.test.ts")
          .digest("hex"),
        profile: "nix",
        status: "pass",
        counts: { passed: 12, failed: 0, skipped: 0, blocked: 0, incomplete: 0 },
        reportArtifactId: "focused-report",
      },
    ],
    toolchains: [
      {
        component: "node",
        applicability: "present",
        version: "22.16.0",
        executableDigest: sha("0"),
      },
    ],
    artifacts: [
      {
        artifactId: "focused-report",
        schemaId: "vellum.test-report.v1",
        mediaType: "application/json",
        publicPath: ".scratch/instrument-intelligence/evidence/T01/focused-report.json",
        sha256: sha("1"),
        classification: "rights_approved_public",
        requirementIds: ["II-EXEC-001"],
        sanitizationId: null,
      },
    ],
    claims: [
      {
        clauseId: "II-CLAUSE-0001",
        requirementId: "II-EXEC-001",
        clauseDigest: sha("2"),
        contributor: { subjectId: "t01-agent", role: "evidence_contributor" },
        evidenceArtifactIds: ["focused-report"],
      },
    ],
    privacy: { caseCommitments: [], aggregates: [], redactions: [] },
    mediaSanitization: [],
  };
}

function exactSubjects(): any {
  return {
    outputs: [{ id: "baroque-guitar-output", digest: sha("e") }],
    package: { id: "review-package-t81", digest: sha("d") },
    system: { id: "generation-system", digest: sha("c") },
  };
}

function claimScope(
  authorityDomain = "physical_playability",
  targets = ["baroque_guitar"],
  dimensions = ["mechanical_playability"]
): any {
  const core = {
    authorityDomain,
    dimensions,
    scopeId: `${authorityDomain}-scope`,
    targets,
  };
  return { ...core, digest: digestClaimScope(core) };
}

function signature(credentialId: string, payload: unknown, _character?: string): any {
  const signedPayloadDigest = digestAuthorityPayload(payload);
  const privateKey = privateKeys.get(credentialId);
  if (!privateKey) throw new Error(`missing test signing key for ${credentialId}`);
  return {
    algorithm: "ed25519",
    credentialId,
    signature: cryptoSign(null, Buffer.from(signedPayloadDigest, "hex"), privateKey).toString(
      "base64url"
    ),
    signedPayloadDigest,
  };
}

function verifiedAuthority(statement: any): any {
  const scopeDigests = statement.claimScopes.map((scope: any) => scope.digest).sort();
  return {
    authorization: {
      authorizedClaimScopeDigests: scopeDigests,
      evaluatedClaimScopeDigests: scopeDigests,
      intersectionClaimScopeDigests: scopeDigests,
      status: "authorized",
    },
    credential: {
      credentialId: statement.reviewer.credential.credentialId,
      credentialType: statement.reviewer.credential.credentialType,
      subjectId: statement.reviewer.subjectId,
    },
    independence: {
      conflictPolicyDigest: sha("6"),
      conflicts: [],
      status: "independent",
    },
    result: "verified",
    reviewerStatementDigest: digestAuthorityPayload(statement),
    signatureStatus: "valid",
    validity: {
      credentialExpiresAt: "2027-07-15T00:00:00.000Z",
      credentialIssuedAt: "2026-01-01T00:00:00.000Z",
      evaluatedAt: "2026-07-15T12:00:05.000Z",
      freshness: "current",
      revocation: {
        checkedAt: "2026-07-15T12:00:05.000Z",
        sourceDigest: sha("7"),
        status: "clear",
      },
    },
    verificationId: "authority-verification-1",
    verifier: {
      credentialId: "authority-verifier-credential",
      credentialType: "x509",
      policyDigest: sha("8"),
      role: "authority_verifier",
      subjectId: "independent-authority-verifier",
    },
  };
}

function humanReviewAuthorityReceipt(): any {
  const statement = {
    authorityReceiptId: "baroque-guitar-player-review-1",
    claimScopes: [claimScope()],
    issuedAt: "2026-07-15T12:00:00.000Z",
    review: {
      findingCodes: ["none"],
      productAcceptance: "pass",
      resultCode: "pass",
    },
    reviewer: {
      credential: {
        credentialId: "reviewer-credential-1",
        credentialType: "specialist_registry",
      },
      role: "baroque_guitar_target_player",
      subjectId: "opaque-reviewer-1",
    },
    subjects: exactSubjects(),
  };
  const authorityVerification = verifiedAuthority(statement);
  return {
    authorityVerification,
    receiptKind: "human_review",
    reviewerSignature: signature(statement.reviewer.credential.credentialId, statement, "A"),
    schemaId: PUBLIC_REVIEW_RECEIPT_SCHEMA_ID,
    statement,
    verifierSignature: signature(
      authorityVerification.verifier.credentialId,
      authorityVerification,
      "B"
    ),
  };
}

function ownerDecisionAuthorityReceipt(): any {
  const ownerScope = claimScope(
    "provisional_control",
    ["cross_target"],
    ["release_state", "review_state"]
  );
  const statement = {
    authorityReceiptId: "owner-provisional-stop-1",
    claimScopes: [ownerScope],
    decision: {
      action: "stop",
      machineClosure: {
        artifactDigest: sha("1"),
        generation: 1,
        receiptCommit: commit("1"),
        tracerId: "T85",
      },
      priorDecision: null,
      productAcceptance: "blocked",
      reasonCodes: ["review_deferred"],
      releaseCompleteRevocation: null,
      releaseCompleteState: "not_complete",
      resultCode: "provisional_stop_current",
      reviewPackage: {
        artifactDigest: sha("2"),
        generation: 1,
        receiptCommit: commit("2"),
        tracerId: "T81",
      },
      reviewSnapshotDigest: sha("3"),
      reviewState: "deferred",
    },
    issuedAt: "2026-07-15T12:00:00.000Z",
    reviewer: {
      credential: { credentialId: "owner-credential-1", credentialType: "owner_local" },
      role: "owner",
      subjectId: "installation-owner",
    },
    subjects: exactSubjects(),
  };
  const authorityVerification = verifiedAuthority(statement);
  return {
    authorityVerification,
    receiptKind: "owner_provisional_decision",
    reviewerSignature: signature(statement.reviewer.credential.credentialId, statement, "C"),
    schemaId: PUBLIC_REVIEW_RECEIPT_SCHEMA_ID,
    statement,
    verifierSignature: signature(
      authorityVerification.verifier.credentialId,
      authorityVerification,
      "D"
    ),
  };
}

function resignAuthorityReceipt(receipt: any): void {
  receipt.authorityVerification.reviewerStatementDigest = digestAuthorityPayload(receipt.statement);
  receipt.authorityVerification.credential = {
    credentialId: receipt.statement.reviewer.credential.credentialId,
    credentialType: receipt.statement.reviewer.credential.credentialType,
    subjectId: receipt.statement.reviewer.subjectId,
  };
  receipt.reviewerSignature = signature(
    receipt.statement.reviewer.credential.credentialId,
    receipt.statement
  );
  receipt.verifierSignature = signature(
    receipt.authorityVerification.verifier.credentialId,
    receipt.authorityVerification
  );
}

describe("Instrument Intelligence closed receipt contracts", () => {
  it("accepts one fully closed start/evidence receipt", () => {
    expect(validateStartReceipt(startReceipt())).toEqual(startReceipt());
    expect(validateEvidenceReceipt(evidenceReceipt())).toEqual(evidenceReceipt());
  });

  it("rejects unknown keys recursively", () => {
    const root = structuredClone(evidenceReceipt()) as Record<string, unknown>;
    root.notes = "free text is not evidence";
    expect(() => validateEvidenceReceipt(root)).toThrow(/unknown: notes/);

    const nested = structuredClone(evidenceReceipt());
    Object.assign(nested.gates[0].counts, { diagnostics: 1 });
    expect(() => validateEvidenceReceipt(nested)).toThrow(/unknown: diagnostics/);
  });

  it("binds repair dispatches to a sorted, unique, nonempty artifact collection", () => {
    const receipt = evidenceReceipt();
    receipt.outcome.resultDisposition = {
      code: "contract_guard_failed",
      disposition: "repair_dispatch",
      dispatchArtifactIds: ["dispatch-a", "dispatch-b"],
    };
    for (const suffix of ["a", "b"]) {
      receipt.artifacts.push({
        artifactId: `dispatch-${suffix}`,
        schemaId: "vellum.remediation-dispatch.v1",
        mediaType: "application/json",
        publicPath: `.scratch/instrument-intelligence/evidence/T01/dispatch-${suffix}.json`,
        sha256: sha(suffix === "a" ? "3" : "4"),
        classification: "rights_approved_public",
        requirementIds: ["II-EXEC-001"],
        sanitizationId: null,
      });
    }
    expect(() => validateEvidenceReceipt(receipt)).not.toThrow();

    const empty = structuredClone(receipt);
    empty.outcome.resultDisposition.dispatchArtifactIds = [];
    expect(() => validateEvidenceReceipt(empty)).toThrow(/at least one artifact/);

    const unsorted = structuredClone(receipt);
    unsorted.outcome.resultDisposition.dispatchArtifactIds = ["dispatch-b", "dispatch-a"];
    expect(() => validateEvidenceReceipt(unsorted)).toThrow(/sorted and unique/);

    const duplicate = structuredClone(receipt);
    duplicate.outcome.resultDisposition.dispatchArtifactIds = ["dispatch-a", "dispatch-a"];
    expect(() => validateEvidenceReceipt(duplicate)).toThrow(/sorted and unique/);

    const unknown = structuredClone(receipt);
    unknown.outcome.resultDisposition.dispatchArtifactIds = ["dispatch-a", "dispatch-c"];
    expect(() => validateEvidenceReceipt(unknown)).toThrow(/unknown remediation dispatch/);

    const nonRepair = structuredClone(receipt);
    nonRepair.outcome.resultDisposition.disposition = "unlock";
    expect(() => validateEvidenceReceipt(nonRepair)).toThrow(/empty without a repair dispatch/);
  });

  it("carries only closed, unique generation state edges in the evidence outcome", () => {
    const receipt = evidenceReceipt();
    receipt.outcome.supersedes = [
      { reasonCode: "repair_rerun", target: { tracerId: 1, generation: 1 } },
    ];
    receipt.outcome.invalidates = [
      {
        reasonCode: "review_finding",
        scopes: ["evidence", "release_closure"],
        target: { tracerId: 69, generation: 1 },
      },
    ];
    expect(() => validateEvidenceReceipt(receipt)).not.toThrow();

    const unknownReason = structuredClone(receipt);
    unknownReason.outcome.invalidates[0].reasonCode = "because_i_said_so";
    expect(() => validateEvidenceReceipt(unknownReason)).toThrow(/must be one of/);

    const duplicateTarget = structuredClone(receipt);
    duplicateTarget.outcome.invalidates[0].target = { tracerId: 1, generation: 1 };
    expect(() => validateEvidenceReceipt(duplicateTarget)).toThrow(/same generation twice/);

    const unsortedScopes = structuredClone(receipt);
    unsortedScopes.outcome.invalidates[0].scopes = ["release_closure", "evidence"];
    expect(() => validateEvidenceReceipt(unsortedScopes)).toThrow(/sorted and unique/);
  });

  it("binds the authority set and pinned publication tuple", () => {
    const authority = authoritySnapshot();
    authority.pathDigests[0].sha256 = sha("9");
    expect(() => validateAuthoritySnapshot(authority)).toThrow(/does not bind/);

    const mismatchedHead = startReceipt();
    mismatchedHead.publication.graphQlHead = commit("6");
    expect(() => validateStartReceipt(mismatchedHead)).toThrow(/must be equal/);

    const claimedProtection = startReceipt();
    claimedProtection.publication.remoteProtectionAssumed = true;
    expect(() => validateStartReceipt(claimedProtection)).toThrow(/literal false/);
  });

  it("binds an actually satisfied OR branch to exact predecessor receipt commits", () => {
    const receipt = startReceipt();
    receipt.predecessors = [{ tracerId: "T02", generation: 3, receiptCommit: commit("a") }];
    const term = {
      sourceTracerId: "T02",
      generationSelector: "current",
      sourceGeneration: 3,
      sourceReceiptCommit: commit("a"),
      field: "productAcceptance",
      operator: "equals",
      expected: { type: "token", value: "pass" },
      observed: { type: "token", value: "pass" },
    };
    receipt.predicateWitnesses = [
      {
        predicateId: "result-predicate",
        predicateDigest: sha("d"),
        mode: "any",
        branches: [{ branchId: "pass", satisfied: true, terms: [term] }],
        satisfiedBranchIds: ["pass"],
      },
    ];
    expect(() => validateStartReceipt(receipt)).not.toThrow();
    receipt.predicateWitnesses[0].branches[0].terms[0].sourceReceiptCommit = commit("b");
    expect(() => validateStartReceipt(receipt)).toThrow(/exact declared predecessor/);
  });

  it("represents latest-or-absent without fabricating a predecessor generation", () => {
    const receipt = startReceipt();
    receipt.predicateWitnesses = [
      {
        predicateId: "result-predicate",
        predicateDigest: sha("e"),
        mode: "any",
        branches: [
          {
            branchId: "absence-branch",
            satisfied: true,
            terms: [
              {
                sourceTracerId: "T86",
                generationSelector: "latest_or_absent",
                sourceGeneration: null,
                sourceReceiptCommit: null,
                field: "resultCode",
                operator: "not_equals",
                expected: { type: "token", value: "provisional_stop_current" },
                observed: { type: "absent", value: null },
              },
            ],
          },
        ],
        satisfiedBranchIds: ["absence-branch"],
      },
    ];
    expect(() => validateStartReceipt(receipt)).not.toThrow();

    receipt.predicateWitnesses[0].branches[0].terms[0].generationSelector = "current";
    expect(() => validateStartReceipt(receipt)).toThrow(/satisfied flag contradicts/);
  });

  it("canonically chooses one satisfied OR branch without flattening alternatives", () => {
    const predicate = {
      all: [
        {
          sourceTracer: 85,
          generation: "current",
          field: "resultCode",
          operator: "eq",
          expected: "machine_complete",
        },
        {
          any: [
            {
              sourceTracer: 107,
              generation: "current",
              field: "resultCode",
              operator: "in",
              expected: ["lyrics_not_applicable", "lyrics_applicable"],
            },
            {
              sourceTracer: 86,
              generation: "latest_or_absent",
              field: "resultCode",
              operator: "not_in",
              expected: ["provisional_stop_current"],
            },
          ],
        },
      ],
    };
    const sources = new Map([
      [
        "85:resultCode",
        {
          observed: "machine_complete",
          sourceGeneration: 2,
          sourceReceiptCommit: commit("8"),
          usable: true,
        },
      ],
      [
        "107:resultCode",
        {
          observed: "lyrics_applicable",
          sourceGeneration: 1,
          sourceReceiptCommit: commit("9"),
          usable: true,
        },
      ],
      [
        "86:resultCode",
        {
          observed: undefined,
          sourceGeneration: null,
          sourceReceiptCommit: null,
          usable: true,
        },
      ],
    ]);
    const witness = compileCanonicalPredicateWitness(predicate, ({ sourceTracer, field }) =>
      structuredClone(sources.get(`${sourceTracer}:${field}`))
    );
    expect(witness.predicateId).toBe("result-predicate");
    expect(witness.branches).toHaveLength(1);
    expect(witness.branches[0].terms.map(({ sourceTracerId }) => sourceTracerId)).toEqual([
      "T85",
      "T107",
    ]);
    expect(witness.satisfiedBranchIds).toEqual([witness.branches[0].branchId]);

    sources.get("107:resultCode")!.usable = false;
    const absenceWitness = compileCanonicalPredicateWitness(predicate, ({ sourceTracer, field }) =>
      structuredClone(sources.get(`${sourceTracer}:${field}`))
    );
    expect(absenceWitness.branches[0].terms.map(({ sourceTracerId }) => sourceTracerId)).toEqual([
      "T85",
      "T86",
    ]);
    expect(absenceWitness.branches[0].terms[1].observed).toEqual({
      type: "absent",
      value: null,
    });
  });

  it("requires command-bound gate count proof and bounded toolchain N/A", () => {
    const gate = evidenceReceipt().gates[0];
    gate.command = "npm test -- substituted-suite.test.ts";
    expect(() => validateGateReceipt(gate)).toThrow(/exact logical command/);
    gate.command = "npm test -- test/instrument-intelligence/receipt-contract.test.ts";
    gate.counts.failed = 1;
    expect(() => validateGateReceipt(gate)).toThrow(/status contradicts/);
    expect(() =>
      validateToolchainReceipt({
        component: "lilypond",
        applicability: "not_applicable",
        reasonCode: "profile_not_required",
      })
    ).not.toThrow();
    expect(() =>
      validateToolchainReceipt({
        component: "lilypond",
        applicability: "not_applicable",
        reasonCode: "not needed because I said so",
      })
    ).toThrow(/must be one of/);
  });

  it("forbids closure verifiers from contributing clause evidence", () => {
    const claims = structuredClone(evidenceReceipt().claims);
    claims[0].contributor.role = "closure_verifier";
    expect(() => validateClauseClaims(claims)).toThrow(/must be one of/);
  });

  it("separates non-resolving HMAC case commitments from safe aggregate outcomes", () => {
    const commitments = ["1", "2", "3"].map((suffix) => ({
      caseId: `case_${suffix.repeat(32)}`,
      coverageClass: "cross_target_holdout",
      vaultCommitment: `hmac-sha256:v1:vault1:${"A".repeat(43)}`,
      requirementIds: ["II-EVAL-001"],
    }));
    const privacy: any = {
      caseCommitments: commitments,
      aggregates: [
        {
          aggregateId: "cross-target-summary",
          coverageClass: "cross_target_holdout",
          minimumCardinality: 3,
          observedCardinality: 3,
          status: "pass",
          requirementIds: ["II-EVAL-001"],
        },
      ],
      redactions: [],
    };
    expect(() => validatePrivacyReceipt(privacy)).not.toThrow();
    Object.assign(privacy.caseCommitments[0], { outcome: "pass" });
    expect(() => validatePrivacyReceipt(privacy)).toThrow(/unknown: outcome/);
    privacy.caseCommitments[0].outcome = undefined;
    delete privacy.caseCommitments[0].outcome;
    privacy.caseCommitments[0].coverageClass = "invented_free_form_class";
    expect(() => validatePrivacyReceipt(privacy)).toThrow(/must be one of/);
    privacy.caseCommitments[0].coverageClass = "cross_target_holdout";
    privacy.aggregates[0].minimumCardinality = 2;
    expect(() => validatePrivacyReceipt(privacy)).toThrow(/at least three/);
  });

  it("requires exact media-specific sanitization and rejects private paths", () => {
    const receipt = evidenceReceipt();
    receipt.artifacts.push({
      artifactId: "score-pdf",
      schemaId: "vellum.public-musical-artifact.v1",
      mediaType: "application/pdf",
      publicPath: ".scratch/instrument-intelligence/evidence/T01/score.pdf",
      sha256: sha("3"),
      classification: "rights_approved_public",
      requirementIds: ["II-SRC-002"],
      sanitizationId: "score-pdf-sanitization",
    });
    receipt.mediaSanitization.push({
      sanitizationId: "score-pdf-sanitization",
      artifactId: "score-pdf",
      profile: "pdf-v1",
      checks: [
        "attachments_removed",
        "embedded_files_removed",
        "links_reviewed",
        "metadata_removed",
      ],
      status: "pass",
    });
    expect(() =>
      validateMediaSanitization(receipt.mediaSanitization, { artifacts: receipt.artifacts })
    ).not.toThrow();
    receipt.mediaSanitization[0].checks.pop();
    expect(() =>
      validateMediaSanitization(receipt.mediaSanitization, { artifacts: receipt.artifacts })
    ).toThrow(/exact media-specific/);
    receipt.artifacts[1].publicPath = "/Users/jeff/private/score.pdf";
    expect(() => validateEvidenceReceipt(receipt)).toThrow(/repository-relative public path/);
  });

  it("accepts a reviewer-signed, independently verified exact-subject authority receipt", () => {
    const receipt = humanReviewAuthorityReceipt();
    expect(
      validateHumanReviewAuthorityReceipt(receipt, {
        ...trustedSignatureOptions,
        requireGrant: true,
      })
    ).toEqual(receipt);
    expect(validatePublicReviewReceipt(receipt, trustedSignatureOptions)).toEqual(receipt);
    expect(authorityReceiptGrantsAuthority(receipt, trustedSignatureOptions)).toBe(true);
    expect(() =>
      validatePublicReviewReceipt(receipt, {
        ...trustedSignatureOptions,
        expectedVerifierPolicyDigest: sha("9"),
      })
    ).toThrow(/repository-pinned/);
    expect(() =>
      validateHumanReviewAuthorityReceipt(receipt, {
        ...trustedSignatureOptions,
        expectedSubjects: {
          ...exactSubjects(),
          package: { id: "review-package-t81", digest: sha("9") },
        },
      })
    ).toThrow(/expected package\/output\/system/);
  });

  it("keeps the external public-review JSON Schema aligned with the executable contract", () => {
    expect(evidenceSchema.$defs.humanReviewRole.enum).toEqual(HUMAN_REVIEW_ROLES);
    expect(evidenceSchema.$defs.authorityDomain.enum).toEqual(AUTHORITY_DOMAINS);
    expect(evidenceSchema.$defs.authorityTarget.enum).toEqual(AUTHORITY_TARGETS);
    expect(evidenceSchema.$defs.claimScopeDimension.enum).toEqual(CLAIM_SCOPE_DIMENSIONS);
    expect(evidenceSchema.$defs.publicReviewReceipt.$anchor).toBe("publicReviewReceipt");
    expect(evidenceSchema.$defs.publicReviewReceipt.oneOf).toEqual([
      { $ref: "#/$defs/humanReviewAuthorityReceipt" },
      { $ref: "#/$defs/ownerDecisionAuthorityReceipt" },
    ]);
  });

  it("binds both signatures to closed payloads and matching credential identities", () => {
    const missingTrustResolver = humanReviewAuthorityReceipt();
    expect(() => validatePublicReviewReceipt(missingTrustResolver)).toThrow(/repository-pinned/);
    expect(() =>
      validatePublicReviewReceipt(missingTrustResolver, {
        expectedVerifierPolicyDigest: sha("8"),
      })
    ).toThrow(/trusted cryptographic verification/);

    const forgedReviewerSignature = humanReviewAuthorityReceipt();
    forgedReviewerSignature.reviewerSignature.signature = `${
      forgedReviewerSignature.reviewerSignature.signature[0] === "A" ? "B" : "A"
    }${forgedReviewerSignature.reviewerSignature.signature.slice(1)}`;
    expect(() =>
      validatePublicReviewReceipt(forgedReviewerSignature, trustedSignatureOptions)
    ).toThrow(/trusted cryptographic verification/);

    const forgedVerifierSignature = humanReviewAuthorityReceipt();
    forgedVerifierSignature.verifierSignature.signature = `${
      forgedVerifierSignature.verifierSignature.signature[0] === "A" ? "B" : "A"
    }${forgedVerifierSignature.verifierSignature.signature.slice(1)}`;
    expect(() =>
      validatePublicReviewReceipt(forgedVerifierSignature, trustedSignatureOptions)
    ).toThrow(/trusted cryptographic verification/);

    const statementTamper = humanReviewAuthorityReceipt();
    statementTamper.statement.subjects.outputs[0].digest = sha("9");
    expect(() => validatePublicReviewReceipt(statementTamper, trustedSignatureOptions)).toThrow(
      /exact closed payload/
    );

    const credentialSubstitution = humanReviewAuthorityReceipt();
    credentialSubstitution.reviewerSignature.credentialId = "substituted-credential";
    expect(() =>
      validatePublicReviewReceipt(credentialSubstitution, trustedSignatureOptions)
    ).toThrow(/signing subject credential/);

    const verifierTamper = humanReviewAuthorityReceipt();
    verifierTamper.authorityVerification.verifier.policyDigest = sha("9");
    expect(() => validatePublicReviewReceipt(verifierTamper, trustedSignatureOptions)).toThrow(
      /repository-pinned|exact closed payload/
    );
  });

  it("rejects role escalation, scope escalation, and self-verification", () => {
    const wrongDomain = humanReviewAuthorityReceipt();
    wrongDomain.statement.claimScopes[0] = claimScope(
      "metadata_rights",
      ["source_material"],
      ["metadata", "rights"]
    );
    const changedScopeDigests = [wrongDomain.statement.claimScopes[0].digest];
    wrongDomain.authorityVerification.authorization = {
      authorizedClaimScopeDigests: changedScopeDigests,
      evaluatedClaimScopeDigests: changedScopeDigests,
      intersectionClaimScopeDigests: changedScopeDigests,
      status: "authorized",
    };
    resignAuthorityReceipt(wrongDomain);
    expect(() => validatePublicReviewReceipt(wrongDomain, trustedSignatureOptions)).toThrow(
      /cannot claim metadata_rights/
    );

    const wrongTarget = humanReviewAuthorityReceipt();
    wrongTarget.statement.claimScopes[0] = claimScope(
      "physical_playability",
      ["classical_guitar"],
      ["mechanical_playability"]
    );
    const wrongTargetDigests = [wrongTarget.statement.claimScopes[0].digest];
    wrongTarget.authorityVerification.authorization = {
      authorizedClaimScopeDigests: wrongTargetDigests,
      evaluatedClaimScopeDigests: wrongTargetDigests,
      intersectionClaimScopeDigests: wrongTargetDigests,
      status: "authorized",
    };
    resignAuthorityReceipt(wrongTarget);
    expect(() => validatePublicReviewReceipt(wrongTarget, trustedSignatureOptions)).toThrow(
      /cannot claim one or more target scopes/
    );

    const scopeEscalation = humanReviewAuthorityReceipt();
    scopeEscalation.authorityVerification.authorization.authorizedClaimScopeDigests.push(sha("f"));
    scopeEscalation.authorityVerification.authorization.authorizedClaimScopeDigests.sort();
    resignAuthorityReceipt(scopeEscalation);
    expect(() => validatePublicReviewReceipt(scopeEscalation, trustedSignatureOptions)).toThrow(
      /must be empty unless|Claim Scope/
    );

    const selfVerified = humanReviewAuthorityReceipt();
    selfVerified.authorityVerification.verifier.subjectId =
      selfVerified.statement.reviewer.subjectId;
    resignAuthorityReceipt(selfVerified);
    expect(() => validatePublicReviewReceipt(selfVerified, trustedSignatureOptions)).toThrow(
      /independent/
    );
  });

  it("retains non-authorizing revoked, expired, and conflicted review records without authority scope", () => {
    const revoked = humanReviewAuthorityReceipt();
    revoked.statement.review = {
      findingCodes: ["authority_unverified"],
      productAcceptance: "blocked",
      resultCode: "blocked",
    };
    revoked.authorityVerification.result = "revoked";
    revoked.authorityVerification.validity.revocation.status = "revoked";
    revoked.authorityVerification.authorization.authorizedClaimScopeDigests = [];
    resignAuthorityReceipt(revoked);
    expect(() => validatePublicReviewReceipt(revoked, trustedSignatureOptions)).not.toThrow();
    expect(authorityReceiptGrantsAuthority(revoked, trustedSignatureOptions)).toBe(false);
    expect(() =>
      validateHumanReviewAuthorityReceipt(revoked, {
        ...trustedSignatureOptions,
        requireGrant: true,
      })
    ).toThrow(/does not grant/);

    const expired = humanReviewAuthorityReceipt();
    expired.statement.review = {
      findingCodes: ["authority_unverified"],
      productAcceptance: "incomplete",
      resultCode: "incomplete",
    };
    expired.authorityVerification.result = "expired";
    expired.authorityVerification.validity.evaluatedAt = "2028-07-15T12:00:05.000Z";
    expired.authorityVerification.validity.freshness = "expired";
    expired.authorityVerification.validity.revocation.checkedAt = "2028-07-15T12:00:05.000Z";
    expired.authorityVerification.authorization.authorizedClaimScopeDigests = [];
    resignAuthorityReceipt(expired);
    expect(() => validatePublicReviewReceipt(expired, trustedSignatureOptions)).not.toThrow();

    const conflicted = humanReviewAuthorityReceipt();
    conflicted.statement.review = {
      findingCodes: ["independence_failure"],
      productAcceptance: "fail",
      resultCode: "fail",
    };
    conflicted.authorityVerification.result = "conflicted";
    conflicted.authorityVerification.independence = {
      conflictPolicyDigest: sha("6"),
      conflicts: [{ kind: "implemented_subject", role: "generation_system_developer" }],
      status: "conflicted",
    };
    conflicted.authorityVerification.authorization.authorizedClaimScopeDigests = [];
    resignAuthorityReceipt(conflicted);
    expect(() => validatePublicReviewReceipt(conflicted, trustedSignatureOptions)).not.toThrow();
  });

  it("forbids a non-authorizing review from publishing a passing human result", () => {
    const receipt = humanReviewAuthorityReceipt();
    receipt.authorityVerification.result = "revoked";
    receipt.authorityVerification.validity.revocation.status = "revoked";
    receipt.authorityVerification.authorization.authorizedClaimScopeDigests = [];
    resignAuthorityReceipt(receipt);
    expect(() => validatePublicReviewReceipt(receipt, trustedSignatureOptions)).toThrow(
      /passing human review requires/
    );
  });

  it("distinguishes an authorized Owner stop from its exact authorized resume successor", () => {
    const stop = ownerDecisionAuthorityReceipt();
    expect(validateOwnerDecisionAuthorityReceipt(stop, trustedSignatureOptions)).toEqual(stop);
    expect(() => validateHumanReviewAuthorityReceipt(stop, trustedSignatureOptions)).toThrow(
      /human_review/
    );

    const resume = structuredClone(stop);
    resume.statement.authorityReceiptId = "owner-provisional-resume-1";
    resume.statement.decision = {
      ...resume.statement.decision,
      action: "resume",
      priorDecision: {
        decisionDigest: digestAuthorityPayload(stop.statement.decision),
        generation: 1,
        receiptCommit: commit("3"),
        tracerId: "T86",
      },
      productAcceptance: "pass",
      reasonCodes: ["review_resumed"],
      resultCode: "provisional_stop_resumed",
      reviewState: "resumed",
    };
    resignAuthorityReceipt(resume);
    expect(validateOwnerDecisionAuthorityReceipt(resume, trustedSignatureOptions)).toEqual(resume);

    resume.statement.decision.priorDecision = null;
    resignAuthorityReceipt(resume);
    expect(() => validateOwnerDecisionAuthorityReceipt(resume, trustedSignatureOptions)).toThrow(
      /passing successor/
    );
  });

  it("requires a typed revocation before a stop can downgrade current Release Complete", () => {
    const receipt = ownerDecisionAuthorityReceipt();
    receipt.statement.decision.releaseCompleteState = "current";
    resignAuthorityReceipt(receipt);
    expect(() => validateOwnerDecisionAuthorityReceipt(receipt, trustedSignatureOptions)).toThrow(
      /typed revocation/
    );

    receipt.statement.decision.reasonCodes = ["release_complete_revoked", "review_deferred"];
    receipt.statement.decision.releaseCompleteRevocation = {
      digest: sha("a"),
      transitionId: "release-complete-revocation-1",
    };
    resignAuthorityReceipt(receipt);
    expect(() =>
      validateOwnerDecisionAuthorityReceipt(receipt, trustedSignatureOptions)
    ).not.toThrow();
  });

  it.each([
    ["curator", "heldout_curation", ["case_curation", "coverage_design", "reserve_control"]],
    ["truth_reviewer", "truth_commitment", ["review_state", "truth_commitment"]],
  ])("represents the %s HITL authority lane", (role, authorityDomain, dimensions) => {
    const receipt = humanReviewAuthorityReceipt();
    receipt.statement.reviewer.role = role;
    receipt.statement.claimScopes = [
      claimScope(authorityDomain, ["cross_target", "source_material"], dimensions),
    ];
    receipt.authorityVerification = verifiedAuthority(receipt.statement);
    resignAuthorityReceipt(receipt);
    expect(() =>
      validateHumanReviewAuthorityReceipt(receipt, trustedSignatureOptions)
    ).not.toThrow();
  });

  it("rejects free text, private paths, and unknown receipt variants", () => {
    const freeText = humanReviewAuthorityReceipt();
    Object.assign(freeText.statement.review, { rationale: "private reviewer notes" });
    resignAuthorityReceipt(freeText);
    expect(() => validatePublicReviewReceipt(freeText, trustedSignatureOptions)).toThrow(
      /unknown: rationale/
    );

    const privateIdentity = humanReviewAuthorityReceipt();
    privateIdentity.statement.subjects.package.id = "/Users/jeff/private/package";
    resignAuthorityReceipt(privateIdentity);
    expect(() => validatePublicReviewReceipt(privateIdentity, trustedSignatureOptions)).toThrow(
      /invalid format/
    );

    const invented = humanReviewAuthorityReceipt();
    invented.receiptKind = "generic_signed_decision";
    expect(() => validatePublicReviewReceipt(invented, trustedSignatureOptions)).toThrow(
      /must distinguish/
    );
  });
});
