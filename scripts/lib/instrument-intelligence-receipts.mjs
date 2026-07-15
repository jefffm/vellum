import { createHash } from "node:crypto";
import {
  INVALIDATION_SCOPE_CODES,
  STATE_EDGE_REASON_CODES,
} from "./instrument-intelligence-results.mjs";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const GIT_OBJECT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const TRACER_PATTERN = /^T(?:0[1-9]|[1-9][0-9]*)$/;
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const LOWER_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const REQUIREMENT_PATTERN = /^II-[A-Z0-9]+-[A-Z0-9]+$/;
const CLAUSE_PATTERN = /^II-CLAUSE-\d{4}$/;
const HMAC_COMMITMENT_PATTERN = /^hmac-sha256:v1:[a-z0-9][a-z0-9_-]{0,31}:[A-Za-z0-9_-]{43}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43,1024}$/;

export const AUTHORITY_SNAPSHOT_SCHEMA_ID = "vellum.instrument-intelligence.authority-snapshot.v1";
export const START_RECEIPT_SCHEMA_ID = "vellum.instrument-intelligence.start-receipt.v1";
export const EVIDENCE_RECEIPT_SCHEMA_ID = "vellum.instrument-intelligence.evidence.v2";
export const PUBLIC_REVIEW_RECEIPT_SCHEMA_ID = "vellum.public-review-receipt.v1";

export const HUMAN_REVIEW_ROLES = Object.freeze([
  "baroque_guitar_historical_idiom_reviewer",
  "baroque_guitar_target_player",
  "baroque_lute_historical_idiom_reviewer",
  "baroque_lute_target_player",
  "classical_guitar_idiom_reviewer",
  "classical_guitar_target_player",
  "continuo_reviewer",
  "curator",
  "engraving_playback_editor",
  "historical_claim_pack_profile_reviewer",
  "imitative_intabulation_reviewer",
  "lyric_underlay_reviewer",
  "maintainer_nonhistorical_reviewer",
  "metadata_rights_reviewer",
  "owner_usefulness_reviewer",
  "source_structure_fidelity_reviewer",
  "transcription_extraction_reviewer",
  "truth_reviewer",
]);

export const AUTHORITY_DOMAINS = Object.freeze([
  "continuo_realization",
  "engraving_playback",
  "historical_claim_pack_profile",
  "heldout_curation",
  "historical_idiom",
  "instrumental_idiom",
  "lyric_underlay",
  "maintainer_nonhistorical_activation",
  "metadata_rights",
  "owner_usefulness",
  "physical_playability",
  "provisional_control",
  "source_structure_fidelity",
  "transcription_extraction",
  "truth_commitment",
]);

export const AUTHORITY_TARGETS = Object.freeze([
  "baroque_guitar",
  "baroque_lute",
  "classical_guitar",
  "cross_target",
  "harpsichord_continuo",
  "knowledge_library",
  "six_course_lute",
  "source_material",
]);

export const CLAIM_SCOPE_DIMENSIONS = Object.freeze([
  "case_curation",
  "continuo_realization",
  "coverage_design",
  "cross_target_usefulness",
  "editorial_default",
  "extraction",
  "harmonic_fidelity",
  "historical_practice",
  "imitative_counterpoint",
  "knowledge_claim",
  "lyric_underlay",
  "mechanical_playability",
  "metadata",
  "notation",
  "ornament_fidelity",
  "pack_profile",
  "playback",
  "relationship_fidelity",
  "reserve_control",
  "release_state",
  "review_state",
  "rights",
  "software_default",
  "source_transcription",
  "spanner_fidelity",
  "target_idiom",
  "transposition_fidelity",
  "truth_commitment",
  "voice_fidelity",
]);

export const PINNED_PUBLICATION_IDENTITY = Object.freeze({
  remote: "origin",
  remoteIdentity: "github.com/jefffm/vellum",
  branch: "refs/heads/main",
  repositoryNodeId: "R_kgDOSNEx6w",
  repositoryDatabaseId: 1221669355,
  repositoryNameWithOwner: "jefffm/vellum",
  bootstrapAnchorRef: "refs/vellum/instrument-intelligence/bootstrap-anchor",
  trustPolicyRef: "refs/vellum/instrument-intelligence/trust-policy",
  trustedMainRef: "refs/vellum/instrument-intelligence/trusted-main",
});

const COMPLETION_SEMANTICS = new Set([
  "implementation-pass",
  "attempt-finalized",
  "decision-recorded",
  "closure-pass-required",
]);
const PREDICATE_FIELDS = new Set([
  "issueCompletion",
  "productAcceptance",
  "applicability",
  "comparison",
  "freshness",
  "compatibility",
  "authorityValidity",
  "resultCode",
]);
const GATE_GROUPS = new Set(["focused", "base", "conditional"]);
const GATE_STATUSES = new Set(["pass", "fail", "blocked", "incomplete"]);
const EXECUTION_PROFILES = new Set([
  "host",
  "nix",
  "nix_nested_podman",
  "host_audiveris",
  "host_browser",
]);
const TOOLCHAIN_NA_REASONS = new Set([
  "gate_not_selected",
  "profile_not_required",
  "component_not_used",
]);
const ARTIFACT_SCHEMA_IDS = new Set([
  "vellum.sanitized-gate-log.v1",
  "vellum.test-report.v1",
  "vellum.public-musical-artifact.v1",
  "vellum.public-review-receipt.v1",
  "vellum.review-role-package.v1",
  "vellum.remediation-dispatch.v1",
  "vellum.redaction-receipt.v1",
]);
const MEDIA_TYPES = new Set([
  "application/json",
  "application/pdf",
  "application/vnd.recordare.musicxml+xml",
  "audio/midi",
  "audio/wav",
  "image/png",
  "image/svg+xml",
]);
const CONTRIBUTOR_ROLES = new Set(["evidence_contributor"]);
export const PUBLIC_COVERAGE_CLASSES = Object.freeze([
  "baroque_guitar_capability",
  "baroque_lute_capability",
  "classical_guitar_capability",
  "cross_target_holdout",
  "cross_target_parity",
  "historical_idiom",
  "mechanical_playability",
  "notation_rendering",
  "playback_alignment",
  "rights_privacy",
  "source_import_omr",
  "voice_coherence",
  "workflow_ux",
]);
const PUBLIC_COVERAGE_CLASS_SET = new Set(PUBLIC_COVERAGE_CLASSES);
const PRIVATE_FIELD_CLASSES = new Set([
  "heldout_identity_or_asset",
  "truth_or_expected_observation",
  "forbidden_outcome_or_mutation",
  "invalidation_or_reserve_state",
  "per_attempt_diagnostic",
  "owner_private_source_identity_path_metadata_or_content",
]);
const RESULT_DISPOSITIONS = new Set([
  "unlock",
  "adjudicate",
  "repair_dispatch",
  "retry",
  "successor",
  "provisional_stop",
]);
const INVALIDATION_SCOPE_SET = new Set(INVALIDATION_SCOPE_CODES);
const STATE_EDGE_REASON_CODE_SET = new Set(STATE_EDGE_REASON_CODES);
const HUMAN_REVIEW_ROLE_SET = new Set(HUMAN_REVIEW_ROLES);
const AUTHORITY_DOMAIN_SET = new Set(AUTHORITY_DOMAINS);
const AUTHORITY_TARGET_SET = new Set(AUTHORITY_TARGETS);
const CLAIM_SCOPE_DIMENSION_SET = new Set(CLAIM_SCOPE_DIMENSIONS);
const CREDENTIAL_TYPES = new Set([
  "institutional_registry",
  "openpgp",
  "owner_local",
  "specialist_registry",
  "ssh",
  "webauthn",
  "x509",
]);
const SIGNATURE_ALGORITHMS = new Set([
  "ed25519",
  "openpgp_ed25519",
  "ssh_ed25519",
  "webauthn_es256",
  "x509_es256",
]);
const REVIEW_FINDING_CODES = new Set([
  "authority_unverified",
  "credential_failure",
  "harmonic_fidelity_failure",
  "historical_support_failure",
  "idiom_failure",
  "independence_failure",
  "insufficient_evidence",
  "none",
  "notation_failure",
  "playability_failure",
  "playback_failure",
  "review_blocked",
  "review_incomplete",
  "rights_failure",
  "scope_failure",
  "stale_subject",
  "transcription_failure",
  "underlay_failure",
  "usefulness_failure",
  "voice_fidelity_failure",
]);
const OWNER_DECISION_REASON_CODES = new Set([
  "authority_stale",
  "owner_requested_pause",
  "package_stale",
  "release_complete_revoked",
  "review_blocked",
  "review_deferred",
  "review_failed",
  "review_incomplete",
  "review_resumed",
]);
const CONFLICT_ROLES = new Set([
  ...HUMAN_REVIEW_ROLES,
  "authority_verifier",
  "curator",
  "evaluator_calibrator",
  "evaluator_implementer",
  "generation_system_developer",
  "pack_author",
  "run_operator",
  "truth_reviewer",
]);
const CONFLICT_KINDS = new Set([
  "authored_subject",
  "calibrated_evaluator",
  "curated_case",
  "evaluated_subject",
  "financial_interest",
  "implemented_subject",
  "same_subject",
  "supervisory_relationship",
]);
const HUMAN_ROLE_DOMAINS = Object.freeze({
  baroque_guitar_historical_idiom_reviewer: new Set(["historical_idiom"]),
  baroque_guitar_target_player: new Set(["physical_playability"]),
  baroque_lute_historical_idiom_reviewer: new Set(["historical_idiom"]),
  baroque_lute_target_player: new Set(["physical_playability"]),
  classical_guitar_idiom_reviewer: new Set(["instrumental_idiom"]),
  classical_guitar_target_player: new Set(["physical_playability"]),
  continuo_reviewer: new Set(["continuo_realization"]),
  curator: new Set(["heldout_curation"]),
  engraving_playback_editor: new Set(["engraving_playback"]),
  historical_claim_pack_profile_reviewer: new Set(["historical_claim_pack_profile"]),
  imitative_intabulation_reviewer: new Set(["instrumental_idiom"]),
  lyric_underlay_reviewer: new Set(["lyric_underlay"]),
  maintainer_nonhistorical_reviewer: new Set(["maintainer_nonhistorical_activation"]),
  metadata_rights_reviewer: new Set(["metadata_rights"]),
  owner_usefulness_reviewer: new Set(["owner_usefulness"]),
  source_structure_fidelity_reviewer: new Set(["source_structure_fidelity"]),
  transcription_extraction_reviewer: new Set(["transcription_extraction"]),
  truth_reviewer: new Set(["truth_commitment"]),
});
const HUMAN_ROLE_TARGETS = Object.freeze({
  baroque_guitar_historical_idiom_reviewer: new Set(["baroque_guitar"]),
  baroque_guitar_target_player: new Set(["baroque_guitar"]),
  baroque_lute_historical_idiom_reviewer: new Set(["baroque_lute"]),
  baroque_lute_target_player: new Set(["baroque_lute"]),
  classical_guitar_idiom_reviewer: new Set(["classical_guitar"]),
  classical_guitar_target_player: new Set(["classical_guitar"]),
  continuo_reviewer: new Set(["harpsichord_continuo"]),
  curator: new Set(["cross_target", "source_material"]),
  engraving_playback_editor: new Set([
    "baroque_guitar",
    "baroque_lute",
    "classical_guitar",
    "cross_target",
    "harpsichord_continuo",
    "six_course_lute",
  ]),
  historical_claim_pack_profile_reviewer: new Set(["knowledge_library"]),
  imitative_intabulation_reviewer: new Set(["six_course_lute"]),
  lyric_underlay_reviewer: new Set(["cross_target", "source_material"]),
  maintainer_nonhistorical_reviewer: new Set(["cross_target", "knowledge_library"]),
  metadata_rights_reviewer: new Set(["cross_target", "knowledge_library", "source_material"]),
  owner_usefulness_reviewer: new Set(["cross_target"]),
  source_structure_fidelity_reviewer: new Set([
    "baroque_guitar",
    "baroque_lute",
    "classical_guitar",
    "cross_target",
    "harpsichord_continuo",
    "six_course_lute",
    "source_material",
  ]),
  transcription_extraction_reviewer: new Set(["source_material"]),
  truth_reviewer: new Set(["cross_target", "source_material"]),
});
const DOMAIN_DIMENSIONS = Object.freeze({
  continuo_realization: new Set([
    "continuo_realization",
    "harmonic_fidelity",
    "relationship_fidelity",
    "voice_fidelity",
  ]),
  engraving_playback: new Set(["notation", "playback", "spanner_fidelity"]),
  historical_claim_pack_profile: new Set([
    "historical_practice",
    "knowledge_claim",
    "pack_profile",
  ]),
  heldout_curation: new Set(["case_curation", "coverage_design", "reserve_control"]),
  historical_idiom: new Set(["historical_practice", "target_idiom"]),
  instrumental_idiom: new Set([
    "harmonic_fidelity",
    "imitative_counterpoint",
    "mechanical_playability",
    "relationship_fidelity",
    "target_idiom",
    "voice_fidelity",
  ]),
  lyric_underlay: new Set(["lyric_underlay"]),
  maintainer_nonhistorical_activation: new Set(["editorial_default", "software_default"]),
  metadata_rights: new Set(["metadata", "rights"]),
  owner_usefulness: new Set(["cross_target_usefulness"]),
  physical_playability: new Set(["mechanical_playability"]),
  provisional_control: new Set(["release_state", "review_state"]),
  source_structure_fidelity: new Set([
    "harmonic_fidelity",
    "ornament_fidelity",
    "relationship_fidelity",
    "spanner_fidelity",
    "transposition_fidelity",
    "voice_fidelity",
  ]),
  transcription_extraction: new Set(["extraction", "source_transcription"]),
  truth_commitment: new Set(["review_state", "truth_commitment"]),
});
const MEDIA_PROFILES = Object.freeze({
  "application/pdf": Object.freeze({
    profile: "pdf-v1",
    checks: Object.freeze([
      "attachments_removed",
      "embedded_files_removed",
      "links_reviewed",
      "metadata_removed",
    ]),
  }),
  "application/vnd.recordare.musicxml+xml": Object.freeze({
    profile: "musicxml-v1",
    checks: Object.freeze([
      "creator_metadata_removed",
      "external_references_removed",
      "text_content_reviewed",
    ]),
  }),
  "audio/midi": Object.freeze({
    profile: "midi-v1",
    checks: Object.freeze(["metadata_removed", "sysex_removed", "track_names_reviewed"]),
  }),
  "audio/wav": Object.freeze({
    profile: "audio-v1",
    checks: Object.freeze(["embedded_tags_removed", "metadata_removed"]),
  }),
  "image/png": Object.freeze({
    profile: "raster-image-v1",
    checks: Object.freeze(["metadata_removed", "pixel_content_reviewed"]),
  }),
  "image/svg+xml": Object.freeze({
    profile: "svg-v1",
    checks: Object.freeze([
      "external_references_removed",
      "metadata_removed",
      "scripts_removed",
      "text_content_reviewed",
    ]),
  }),
});

function fail(context, message) {
  throw new Error(`${context}: ${message}`);
}

function plainObject(value, context) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(context, "must be an object");
  }
  return value;
}

function exactObject(value, keys, context) {
  plainObject(value, context);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const missing = expected.filter((key) => !actual.includes(key));
    const unknown = actual.filter((key) => !expected.includes(key));
    fail(
      context,
      `must have exact keys (missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"})`
    );
  }
  return value;
}

function oneOfExactObjects(value, variants, context) {
  const matches = variants.filter(({ keys }) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
  });
  if (matches.length !== 1) fail(context, "does not match exactly one closed variant");
  return matches[0];
}

function array(value, context, { min = 0, uniqueBy } = {}) {
  if (!Array.isArray(value) || value.length < min) {
    fail(context, `must be an array with at least ${min} item(s)`);
  }
  if (uniqueBy) {
    const identities = value.map(uniqueBy);
    if (new Set(identities).size !== identities.length) fail(context, "contains duplicates");
  }
  return value;
}

function stringMatching(value, pattern, context) {
  if (typeof value !== "string" || !pattern.test(value)) fail(context, "has an invalid format");
  return value;
}

function token(value, context) {
  return stringMatching(value, IDENTIFIER_PATTERN, context);
}

function lowerToken(value, context) {
  return stringMatching(value, LOWER_IDENTIFIER_PATTERN, context);
}

function digest(value, context) {
  return stringMatching(value, SHA256_PATTERN, context);
}

function gitObject(value, context) {
  return stringMatching(value, GIT_OBJECT_PATTERN, context);
}

function tracerId(value, context) {
  return stringMatching(value, TRACER_PATTERN, context);
}

function positiveInteger(value, context) {
  if (!Number.isInteger(value) || value < 1) fail(context, "must be a positive integer");
  return value;
}

function nonnegativeInteger(value, context) {
  if (!Number.isInteger(value) || value < 0) fail(context, "must be a nonnegative integer");
  return value;
}

function enumValue(value, values, context) {
  if (!values.has(value)) fail(context, `must be one of: ${[...values].join(", ")}`);
  return value;
}

function isoInstant(value, context) {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    fail(context, "must be a canonical UTC instant");
  }
  return value;
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

export function digestAuthorityPayload(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalPath(value, context, { evidenceTracer } = {}) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 240 ||
    value.startsWith("/") ||
    value.startsWith("~") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.split("/").some((segment) => segment === "" || segment === "." || segment === "..") ||
    /^(?:file|https?):/i.test(value) ||
    /(?:^|\/)(?:Users|Volumes|home|private|vault|heldout|reserve)(?:\/|$)/i.test(value)
  ) {
    fail(context, "must be a canonical repository-relative public path");
  }
  if (
    evidenceTracer &&
    !value.startsWith(`.scratch/instrument-intelligence/evidence/${evidenceTracer}/`)
  ) {
    fail(context, `must remain under the public evidence directory for ${evidenceTracer}`);
  }
  return value;
}

function sortedUnique(values, context) {
  if (
    new Set(values).size !== values.length ||
    JSON.stringify(values) !== JSON.stringify([...values].sort())
  ) {
    fail(context, "must be sorted and unique");
  }
}

function typedScalar(value, context) {
  exactObject(value, ["type", "value"], context);
  enumValue(
    value.type,
    new Set(["token", "integer", "boolean", "null", "absent"]),
    `${context}.type`
  );
  if (value.type === "token") token(value.value, `${context}.value`);
  if (value.type === "integer" && !Number.isInteger(value.value)) {
    fail(`${context}.value`, "must be an integer");
  }
  if (value.type === "boolean" && typeof value.value !== "boolean") {
    fail(`${context}.value`, "must be a boolean");
  }
  if (value.type === "null" && value.value !== null) fail(`${context}.value`, "must be null");
  if (value.type === "absent" && value.value !== null) {
    fail(`${context}.value`, "must be null for an absent source");
  }
  return value;
}

function sameTypedScalar(left, right) {
  return left.type === right.type && left.value === right.value;
}

function validatePredecessor(value, context) {
  exactObject(value, ["generation", "receiptCommit", "tracerId"], context);
  tracerId(value.tracerId, `${context}.tracerId`);
  positiveInteger(value.generation, `${context}.generation`);
  gitObject(value.receiptCommit, `${context}.receiptCommit`);
  return value;
}

function validatePredicateWitness(value, predecessorsByKey, context) {
  exactObject(
    value,
    ["branches", "mode", "predicateDigest", "predicateId", "satisfiedBranchIds"],
    context
  );
  token(value.predicateId, `${context}.predicateId`);
  digest(value.predicateDigest, `${context}.predicateDigest`);
  enumValue(value.mode, new Set(["all", "any"]), `${context}.mode`);
  array(value.branches, `${context}.branches`, { min: 1, uniqueBy: (branch) => branch?.branchId });
  for (const [branchIndex, branch] of value.branches.entries()) {
    const branchContext = `${context}.branches[${branchIndex}]`;
    exactObject(branch, ["branchId", "satisfied", "terms"], branchContext);
    token(branch.branchId, `${branchContext}.branchId`);
    if (typeof branch.satisfied !== "boolean") {
      fail(`${branchContext}.satisfied`, "must be a boolean");
    }
    array(branch.terms, `${branchContext}.terms`, { min: 1 });
    const termResults = [];
    for (const [termIndex, term] of branch.terms.entries()) {
      const termContext = `${branchContext}.terms[${termIndex}]`;
      exactObject(
        term,
        [
          "expected",
          "field",
          "generationSelector",
          "observed",
          "operator",
          "sourceGeneration",
          "sourceReceiptCommit",
          "sourceTracerId",
        ],
        termContext
      );
      tracerId(term.sourceTracerId, `${termContext}.sourceTracerId`);
      enumValue(
        term.generationSelector,
        new Set(["current", "latest_or_absent"]),
        `${termContext}.generationSelector`
      );
      enumValue(term.field, PREDICATE_FIELDS, `${termContext}.field`);
      enumValue(term.operator, new Set(["equals", "not_equals"]), `${termContext}.operator`);
      typedScalar(term.expected, `${termContext}.expected`);
      typedScalar(term.observed, `${termContext}.observed`);
      const sourceIsAbsent = term.observed.type === "absent";
      if (sourceIsAbsent) {
        if (term.sourceGeneration !== null || term.sourceReceiptCommit !== null) {
          fail(termContext, "an absent source cannot name a generation or receipt commit");
        }
      } else {
        positiveInteger(term.sourceGeneration, `${termContext}.sourceGeneration`);
        gitObject(term.sourceReceiptCommit, `${termContext}.sourceReceiptCommit`);
        const predecessor = predecessorsByKey.get(
          `${term.sourceTracerId}:${term.sourceGeneration}`
        );
        if (!predecessor || predecessor.receiptCommit !== term.sourceReceiptCommit) {
          fail(termContext, "does not bind an exact declared predecessor receipt commit");
        }
      }
      const equals = sameTypedScalar(term.expected, term.observed);
      termResults.push(
        sourceIsAbsent && term.generationSelector === "current"
          ? false
          : (term.operator === "equals") === equals
      );
    }
    if (branch.satisfied !== termResults.every(Boolean)) {
      fail(branchContext, "satisfied flag contradicts its typed conjunctive terms");
    }
  }
  array(value.satisfiedBranchIds, `${context}.satisfiedBranchIds`, { min: 1 });
  sortedUnique(value.satisfiedBranchIds, `${context}.satisfiedBranchIds`);
  const branchIds = value.branches.map(({ branchId }) => branchId);
  const branchSet = new Set(branchIds);
  if (value.satisfiedBranchIds.some((branchId) => !branchSet.has(branchId))) {
    fail(`${context}.satisfiedBranchIds`, "references an undeclared branch");
  }
  const actuallySatisfiedBranchIds = value.branches
    .filter(({ satisfied }) => satisfied)
    .map(({ branchId }) => branchId)
    .sort();
  if (JSON.stringify(value.satisfiedBranchIds) !== JSON.stringify(actuallySatisfiedBranchIds)) {
    fail(`${context}.satisfiedBranchIds`, "does not exactly identify the satisfied branches");
  }
  if (
    value.mode === "all" &&
    JSON.stringify([...value.satisfiedBranchIds].sort()) !== JSON.stringify([...branchIds].sort())
  ) {
    fail(context, "an all-mode predicate must witness every branch");
  }
  return value;
}

function predicateScalar(value, context) {
  if (value === undefined) return { type: "absent", value: null };
  if (value === null) return { type: "null", value: null };
  if (typeof value === "string") {
    token(value, context);
    return { type: "token", value };
  }
  if (typeof value === "boolean") return { type: "boolean", value };
  if (Number.isInteger(value)) return { type: "integer", value };
  fail(context, "must be a bounded scalar predicate value");
}

function predicateLeafBranches(node, context) {
  plainObject(node, context);
  exactObject(node, ["expected", "field", "generation", "operator", "sourceTracer"], context);
  positiveInteger(node.sourceTracer, `${context}.sourceTracer`);
  enumValue(node.generation, new Set(["current", "latest_or_absent"]), `${context}.generation`);
  enumValue(node.field, PREDICATE_FIELDS, `${context}.field`);
  enumValue(node.operator, new Set(["eq", "neq", "in", "not_in"]), `${context}.operator`);
  const base = {
    sourceTracer: node.sourceTracer,
    generation: node.generation,
    field: node.field,
  };
  if (node.operator === "in" || node.operator === "not_in") {
    array(node.expected, `${context}.expected`, { min: 1 });
    const expected = node.expected.map((value, index) => {
      predicateScalar(value, `${context}.expected[${index}]`);
      return value;
    });
    if (node.operator === "in") {
      return expected.map((value) => [{ ...base, operator: "equals", expected: value }]);
    }
    return [expected.map((value) => ({ ...base, operator: "not_equals", expected: value }))];
  }
  if (Array.isArray(node.expected) || node.expected === undefined) {
    fail(`${context}.expected`, "must be one scalar value for eq/neq");
  }
  predicateScalar(node.expected, `${context}.expected`);
  return [
    [
      {
        ...base,
        operator: node.operator === "eq" ? "equals" : "not_equals",
        expected: node.expected,
      },
    ],
  ];
}

function predicateDnfBranches(node, context, depth = 0) {
  if (depth > 16) fail(context, "exceeds the maximum predicate nesting depth");
  plainObject(node, context);
  const keys = Object.keys(node);
  if (keys.length === 1 && (keys[0] === "all" || keys[0] === "any")) {
    const mode = keys[0];
    array(node[mode], `${context}.${mode}`, { min: 1 });
    const children = node[mode].map((child, index) =>
      predicateDnfBranches(child, `${context}.${mode}[${index}]`, depth + 1)
    );
    const branches =
      mode === "any"
        ? children.flat()
        : children.reduce(
            (accumulated, childBranches) =>
              accumulated.flatMap((existing) =>
                childBranches.map((childBranch) => [...existing, ...childBranch])
              ),
            [[]]
          );
    if (branches.length > 256 || branches.some((branch) => branch.length > 256)) {
      fail(context, "expands beyond the bounded predicate witness limit");
    }
    return branches;
  }
  return predicateLeafBranches(node, context);
}

/**
 * Compile one canonical, minimal, actually-satisfied DNF branch from an issue
 * result predicate. The resolver supplies the source state as of the exact
 * start base; it is responsible for active/fresh/compatible/authority checks
 * and for resolving the first receipt-manifest commit for a present source.
 */
export function compileCanonicalPredicateWitness(
  predicate,
  resolveSource,
  context = "resultPredicate"
) {
  if (typeof resolveSource !== "function") fail(context, "requires an exact source resolver");
  const predicateDigest = createHash("sha256").update(canonicalJson(predicate)).digest("hex");
  const branches = predicateDnfBranches(predicate, context);
  for (const [branchIndex, branch] of branches.entries()) {
    const terms = [];
    let satisfied = true;
    for (const [termIndex, term] of branch.entries()) {
      const termContext = `${context}.branch[${branchIndex}].term[${termIndex}]`;
      const resolved = resolveSource({
        sourceTracer: term.sourceTracer,
        generation: term.generation,
        field: term.field,
      });
      exactObject(
        resolved,
        ["observed", "sourceGeneration", "sourceReceiptCommit", "usable"],
        `${termContext}.resolved`
      );
      if (typeof resolved.usable !== "boolean") {
        fail(`${termContext}.resolved.usable`, "must be a boolean");
      }
      const observed = predicateScalar(resolved.observed, `${termContext}.observed`);
      if (resolved.sourceGeneration === null) {
        if (resolved.sourceReceiptCommit !== null || observed.type !== "absent") {
          fail(`${termContext}.resolved`, "has a contradictory absent source binding");
        }
      } else {
        positiveInteger(resolved.sourceGeneration, `${termContext}.resolved.sourceGeneration`);
        gitObject(resolved.sourceReceiptCommit, `${termContext}.resolved.sourceReceiptCommit`);
        if (observed.type === "absent") {
          fail(`${termContext}.resolved`, "a present source must expose its bounded field");
        }
      }
      const expected = predicateScalar(term.expected, `${termContext}.expected`);
      const equals = sameTypedScalar(expected, observed);
      const termSatisfied = resolved.usable && (term.operator === "equals" ? equals : !equals);
      satisfied &&= termSatisfied;
      terms.push({
        sourceTracerId: `T${String(term.sourceTracer).padStart(2, "0")}`,
        generationSelector: term.generation,
        sourceGeneration: resolved.sourceGeneration,
        sourceReceiptCommit: resolved.sourceReceiptCommit,
        field: term.field,
        operator: term.operator,
        expected,
        observed,
      });
    }
    if (!satisfied) continue;
    const branchId = `branch-${String(branchIndex + 1).padStart(3, "0")}-${createHash("sha256")
      .update(canonicalJson(branch))
      .digest("hex")
      .slice(0, 16)}`;
    return {
      predicateId: "result-predicate",
      predicateDigest,
      mode: "any",
      branches: [{ branchId, satisfied: true, terms }],
      satisfiedBranchIds: [branchId],
    };
  }
  fail(context, "has no actually satisfied witness branch at the exact start base");
}

export function validateAuthoritySnapshot(value, context = "authoritySnapshot") {
  exactObject(value, ["authoritySetDigest", "pathDigests", "schemaId"], context);
  if (value.schemaId !== AUTHORITY_SNAPSHOT_SCHEMA_ID) {
    fail(`${context}.schemaId`, `must equal ${AUTHORITY_SNAPSHOT_SCHEMA_ID}`);
  }
  digest(value.authoritySetDigest, `${context}.authoritySetDigest`);
  array(value.pathDigests, `${context}.pathDigests`, {
    min: 1,
    uniqueBy: (entry) => entry?.path,
  });
  for (const [index, entry] of value.pathDigests.entries()) {
    const entryContext = `${context}.pathDigests[${index}]`;
    exactObject(entry, ["path", "sha256"], entryContext);
    canonicalPath(entry.path, `${entryContext}.path`);
    digest(entry.sha256, `${entryContext}.sha256`);
  }
  sortedUnique(
    value.pathDigests.map(({ path }) => path),
    `${context}.pathDigests paths`
  );
  const expectedSetDigest = createHash("sha256")
    .update(
      JSON.stringify(
        value.pathDigests.map(({ path: governedPath, sha256 }) => ({ path: governedPath, sha256 }))
      )
    )
    .digest("hex");
  if (value.authoritySetDigest !== expectedSetDigest) {
    fail(`${context}.authoritySetDigest`, "does not bind the exact sorted authority path set");
  }
  return value;
}

export function validateStartReceipt(value, context = "startReceipt") {
  exactObject(
    value,
    [
      "authoritySnapshot",
      "definition",
      "execution",
      "predicateWitnesses",
      "predecessors",
      "publication",
      "registry",
      "schemaId",
      "start",
    ],
    context
  );
  if (value.schemaId !== START_RECEIPT_SCHEMA_ID) {
    fail(`${context}.schemaId`, `must equal ${START_RECEIPT_SCHEMA_ID}`);
  }

  exactObject(value.start, ["generation", "startedAt", "tracerId"], `${context}.start`);
  tracerId(value.start.tracerId, `${context}.start.tracerId`);
  positiveInteger(value.start.generation, `${context}.start.generation`);
  isoInstant(value.start.startedAt, `${context}.start.startedAt`);

  exactObject(
    value.definition,
    ["completionSemantics", "gateMatrixDigest", "path", "sha256"],
    `${context}.definition`
  );
  canonicalPath(value.definition.path, `${context}.definition.path`);
  if (!value.definition.path.startsWith(".scratch/instrument-intelligence/issues/")) {
    fail(`${context}.definition.path`, "must identify the governed tracer definition");
  }
  const definitionId = value.definition.path.match(/\/([0-9]+)-[^/]+\.md$/)?.[1];
  if (!definitionId || Number(definitionId) !== Number(value.start.tracerId.slice(1))) {
    fail(`${context}.definition.path`, "does not match the start tracer identity");
  }
  digest(value.definition.sha256, `${context}.definition.sha256`);
  digest(value.definition.gateMatrixDigest, `${context}.definition.gateMatrixDigest`);
  enumValue(
    value.definition.completionSemantics,
    COMPLETION_SEMANTICS,
    `${context}.definition.completionSemantics`
  );
  validateAuthoritySnapshot(value.authoritySnapshot, `${context}.authoritySnapshot`);

  exactObject(
    value.registry,
    ["baseWaveHighestId", "generation", "registryHead", "tombstoneSetDigest"],
    `${context}.registry`
  );
  positiveInteger(value.registry.generation, `${context}.registry.generation`);
  positiveInteger(value.registry.baseWaveHighestId, `${context}.registry.baseWaveHighestId`);
  digest(value.registry.registryHead, `${context}.registry.registryHead`);
  digest(value.registry.tombstoneSetDigest, `${context}.registry.tombstoneSetDigest`);

  array(value.predecessors, `${context}.predecessors`, {
    uniqueBy: (entry) => `${entry?.tracerId}:${entry?.generation}`,
  });
  const predecessorsByKey = new Map();
  for (const [index, predecessor] of value.predecessors.entries()) {
    validatePredecessor(predecessor, `${context}.predecessors[${index}]`);
    predecessorsByKey.set(`${predecessor.tracerId}:${predecessor.generation}`, predecessor);
  }
  array(value.predicateWitnesses, `${context}.predicateWitnesses`, {
    uniqueBy: (entry) => entry?.predicateId,
  });
  for (const [index, witness] of value.predicateWitnesses.entries()) {
    validatePredicateWitness(witness, predecessorsByKey, `${context}.predicateWitnesses[${index}]`);
  }

  const publicationContext = `${context}.publication`;
  exactObject(
    value.publication,
    [
      "branch",
      "checkpoint",
      "fetchedHead",
      "graphQlHead",
      "observedAt",
      "remote",
      "remoteIdentity",
      "remoteProtectionAssumed",
      "repository",
    ],
    publicationContext
  );
  for (const key of ["remote", "remoteIdentity", "branch"]) {
    if (value.publication[key] !== PINNED_PUBLICATION_IDENTITY[key]) {
      fail(`${publicationContext}.${key}`, "does not match the pinned publication identity");
    }
  }
  if (value.publication.remoteProtectionAssumed !== false) {
    fail(`${publicationContext}.remoteProtectionAssumed`, "must be literal false");
  }
  gitObject(value.publication.fetchedHead, `${publicationContext}.fetchedHead`);
  gitObject(value.publication.graphQlHead, `${publicationContext}.graphQlHead`);
  if (value.publication.fetchedHead !== value.publication.graphQlHead) {
    fail(publicationContext, "fetched and independently GraphQL-attested heads must be equal");
  }
  isoInstant(value.publication.observedAt, `${publicationContext}.observedAt`);
  if (Date.parse(value.publication.observedAt) > Date.parse(value.start.startedAt)) {
    fail(publicationContext, "publication observation cannot postdate the execution start");
  }

  exactObject(
    value.publication.repository,
    ["databaseId", "nameWithOwner", "nodeId"],
    `${publicationContext}.repository`
  );
  for (const [key, expected] of [
    ["nodeId", PINNED_PUBLICATION_IDENTITY.repositoryNodeId],
    ["databaseId", PINNED_PUBLICATION_IDENTITY.repositoryDatabaseId],
    ["nameWithOwner", PINNED_PUBLICATION_IDENTITY.repositoryNameWithOwner],
  ]) {
    if (value.publication.repository[key] !== expected) {
      fail(`${publicationContext}.repository.${key}`, "does not match the pinned repository");
    }
  }

  exactObject(
    value.publication.checkpoint,
    ["bootstrapAnchor", "trustPolicy", "trustedMain"],
    `${publicationContext}.checkpoint`
  );
  const checkpointSpecs = [
    ["bootstrapAnchor", PINNED_PUBLICATION_IDENTITY.bootstrapAnchorRef],
    ["trustPolicy", PINNED_PUBLICATION_IDENTITY.trustPolicyRef],
    ["trustedMain", PINNED_PUBLICATION_IDENTITY.trustedMainRef],
  ];
  for (const [name, expectedRef] of checkpointSpecs) {
    const checkpointContext = `${publicationContext}.checkpoint.${name}`;
    const checkpoint = value.publication.checkpoint[name];
    exactObject(checkpoint, ["object", "ref"], checkpointContext);
    if (checkpoint.ref !== expectedRef) fail(`${checkpointContext}.ref`, "is not the pinned ref");
    gitObject(checkpoint.object, `${checkpointContext}.object`);
  }
  if (value.publication.checkpoint.trustedMain.object !== value.publication.fetchedHead) {
    fail(publicationContext, "trusted-main must equal the equal fetched/GraphQL start head");
  }

  exactObject(
    value.execution,
    ["baseCommit", "generationSystem", "productTreeDigest", "subjects"],
    `${context}.execution`
  );
  gitObject(value.execution.baseCommit, `${context}.execution.baseCommit`);
  if (value.execution.baseCommit !== value.publication.fetchedHead) {
    fail(`${context}.execution.baseCommit`, "must be the exact trusted publication tip");
  }
  digest(value.execution.productTreeDigest, `${context}.execution.productTreeDigest`);
  exactObject(
    value.execution.generationSystem,
    ["digest", "id", "version"],
    `${context}.execution.generationSystem`
  );
  token(value.execution.generationSystem.id, `${context}.execution.generationSystem.id`);
  token(value.execution.generationSystem.version, `${context}.execution.generationSystem.version`);
  digest(value.execution.generationSystem.digest, `${context}.execution.generationSystem.digest`);
  array(value.execution.subjects, `${context}.execution.subjects`, {
    min: 3,
    uniqueBy: (subject) => `${subject?.kind}:${subject?.id}`,
  });
  const subjectKinds = new Set();
  for (const [index, subject] of value.execution.subjects.entries()) {
    const subjectContext = `${context}.execution.subjects[${index}]`;
    exactObject(subject, ["digest", "id", "kind", "version"], subjectContext);
    enumValue(
      subject.kind,
      new Set(["system", "package", "component", "artifact", "profile"]),
      `${subjectContext}.kind`
    );
    subjectKinds.add(subject.kind);
    token(subject.id, `${subjectContext}.id`);
    token(subject.version, `${subjectContext}.version`);
    digest(subject.digest, `${subjectContext}.digest`);
  }
  for (const requiredKind of ["system", "package", "component"]) {
    if (!subjectKinds.has(requiredKind)) {
      fail(`${context}.execution.subjects`, `must include a ${requiredKind} subject`);
    }
  }
  return value;
}

export function validateGateReceipt(value, context = "gateReceipt") {
  exactObject(
    value,
    [
      "command",
      "commandDigest",
      "counts",
      "gateId",
      "group",
      "profile",
      "reportArtifactId",
      "status",
    ],
    context
  );
  lowerToken(value.gateId, `${context}.gateId`);
  enumValue(value.group, GATE_GROUPS, `${context}.group`);
  digest(value.commandDigest, `${context}.commandDigest`);
  if (
    typeof value.command !== "string" ||
    value.command.length < 1 ||
    value.command.length > 512 ||
    /[\r\n\0]/.test(value.command) ||
    /\/(?:Users|Volumes|home|private|vault|heldout|reserve)\//i.test(value.command)
  ) {
    fail(`${context}.command`, "must be one bounded logical command");
  }
  const expectedCommandDigest = createHash("sha256").update(value.command).digest("hex");
  if (value.commandDigest !== expectedCommandDigest) {
    fail(`${context}.commandDigest`, "does not bind the exact logical command");
  }
  enumValue(value.profile, EXECUTION_PROFILES, `${context}.profile`);
  enumValue(value.status, GATE_STATUSES, `${context}.status`);
  lowerToken(value.reportArtifactId, `${context}.reportArtifactId`);
  exactObject(
    value.counts,
    ["blocked", "failed", "incomplete", "passed", "skipped"],
    `${context}.counts`
  );
  for (const key of ["passed", "failed", "skipped", "blocked", "incomplete"]) {
    nonnegativeInteger(value.counts[key], `${context}.counts.${key}`);
  }
  const validStatusCounts =
    (value.status === "pass" &&
      value.counts.passed >= 1 &&
      value.counts.failed === 0 &&
      value.counts.blocked === 0 &&
      value.counts.incomplete === 0) ||
    (value.status === "fail" && value.counts.failed >= 1) ||
    (value.status === "blocked" && value.counts.blocked >= 1) ||
    (value.status === "incomplete" && value.counts.incomplete >= 1);
  if (!validStatusCounts) fail(context, "status contradicts its bounded count proof");
  return value;
}

export function validateToolchainReceipt(value, context = "toolchainReceipt") {
  const variant = oneOfExactObjects(
    value,
    [
      {
        keys: ["applicability", "component", "executableDigest", "version"],
        applicability: "present",
      },
      { keys: ["applicability", "component", "reasonCode"], applicability: "not_applicable" },
    ],
    context
  );
  if (value.applicability !== variant.applicability) {
    fail(`${context}.applicability`, "does not match its closed variant");
  }
  lowerToken(value.component, `${context}.component`);
  if (value.applicability === "present") {
    token(value.version, `${context}.version`);
    digest(value.executableDigest, `${context}.executableDigest`);
  } else {
    enumValue(value.reasonCode, TOOLCHAIN_NA_REASONS, `${context}.reasonCode`);
  }
  return value;
}

export function validateArtifactReceipt(value, options = {}) {
  const { context = "artifactReceipt", evidenceTracer } = options;
  exactObject(
    value,
    [
      "artifactId",
      "classification",
      "mediaType",
      "publicPath",
      "requirementIds",
      "sanitizationId",
      "schemaId",
      "sha256",
    ],
    context
  );
  lowerToken(value.artifactId, `${context}.artifactId`);
  enumValue(value.schemaId, ARTIFACT_SCHEMA_IDS, `${context}.schemaId`);
  enumValue(value.mediaType, MEDIA_TYPES, `${context}.mediaType`);
  canonicalPath(value.publicPath, `${context}.publicPath`, { evidenceTracer });
  digest(value.sha256, `${context}.sha256`);
  if (value.classification !== "rights_approved_public") {
    fail(`${context}.classification`, "must be rights_approved_public");
  }
  array(value.requirementIds, `${context}.requirementIds`, { min: 1 });
  for (const [index, requirementId] of value.requirementIds.entries()) {
    stringMatching(requirementId, REQUIREMENT_PATTERN, `${context}.requirementIds[${index}]`);
  }
  sortedUnique(value.requirementIds, `${context}.requirementIds`);
  const needsMediaSanitization = value.mediaType !== "application/json";
  if (needsMediaSanitization) lowerToken(value.sanitizationId, `${context}.sanitizationId`);
  else if (value.sanitizationId !== null) {
    fail(`${context}.sanitizationId`, "must be null for typed JSON receipts");
  }
  if (
    value.schemaId === "vellum.public-musical-artifact.v1" &&
    value.mediaType === "application/json"
  ) {
    fail(context, "a public musical artifact cannot be an untyped JSON payload");
  }
  if (
    value.schemaId !== "vellum.public-musical-artifact.v1" &&
    value.mediaType !== "application/json"
  ) {
    fail(context, "typed receipt artifacts must use application/json");
  }
  return value;
}

export function validateClauseClaims(value, options = {}) {
  const { context = "clauseClaims", artifactIds = null } = options;
  array(value, context, {
    uniqueBy: (claim) => `${claim?.clauseId}:${claim?.contributor?.subjectId}`,
  });
  for (const [index, claim] of value.entries()) {
    const claimContext = `${context}[${index}]`;
    exactObject(
      claim,
      ["clauseDigest", "clauseId", "contributor", "evidenceArtifactIds", "requirementId"],
      claimContext
    );
    stringMatching(claim.clauseId, CLAUSE_PATTERN, `${claimContext}.clauseId`);
    stringMatching(claim.requirementId, REQUIREMENT_PATTERN, `${claimContext}.requirementId`);
    digest(claim.clauseDigest, `${claimContext}.clauseDigest`);
    exactObject(claim.contributor, ["role", "subjectId"], `${claimContext}.contributor`);
    enumValue(claim.contributor.role, CONTRIBUTOR_ROLES, `${claimContext}.contributor.role`);
    if (claim.contributor.role !== "evidence_contributor") {
      fail(
        `${claimContext}.contributor.role`,
        "clause evidence must be contributed independently of its implementation owner"
      );
    }
    token(claim.contributor.subjectId, `${claimContext}.contributor.subjectId`);
    array(claim.evidenceArtifactIds, `${claimContext}.evidenceArtifactIds`, { min: 1 });
    sortedUnique(claim.evidenceArtifactIds, `${claimContext}.evidenceArtifactIds`);
    for (const [artifactIndex, artifactId] of claim.evidenceArtifactIds.entries()) {
      lowerToken(artifactId, `${claimContext}.evidenceArtifactIds[${artifactIndex}]`);
      if (artifactIds && !artifactIds.has(artifactId)) {
        fail(claimContext, `references unknown evidence artifact ${artifactId}`);
      }
    }
  }
  return value;
}

export function validatePrivacyReceipt(value, options = {}) {
  const { context = "privacy", artifactIds = null } = options;
  exactObject(value, ["aggregates", "caseCommitments", "redactions"], context);
  array(value.caseCommitments, `${context}.caseCommitments`, {
    uniqueBy: (entry) => entry?.caseId,
  });
  const commitmentCounts = new Map();
  for (const [index, commitment] of value.caseCommitments.entries()) {
    const commitmentContext = `${context}.caseCommitments[${index}]`;
    exactObject(
      commitment,
      ["caseId", "coverageClass", "requirementIds", "vaultCommitment"],
      commitmentContext
    );
    stringMatching(commitment.caseId, /^case_[a-f0-9]{32,64}$/, `${commitmentContext}.caseId`);
    enumValue(
      commitment.coverageClass,
      PUBLIC_COVERAGE_CLASS_SET,
      `${commitmentContext}.coverageClass`
    );
    stringMatching(
      commitment.vaultCommitment,
      HMAC_COMMITMENT_PATTERN,
      `${commitmentContext}.vaultCommitment`
    );
    array(commitment.requirementIds, `${commitmentContext}.requirementIds`, { min: 1 });
    for (const [requirementIndex, requirementId] of commitment.requirementIds.entries()) {
      stringMatching(
        requirementId,
        REQUIREMENT_PATTERN,
        `${commitmentContext}.requirementIds[${requirementIndex}]`
      );
    }
    sortedUnique(commitment.requirementIds, `${commitmentContext}.requirementIds`);
    commitmentCounts.set(
      commitment.coverageClass,
      (commitmentCounts.get(commitment.coverageClass) ?? 0) + 1
    );
  }

  array(value.aggregates, `${context}.aggregates`, {
    uniqueBy: (entry) => entry?.coverageClass,
  });
  const aggregateByClass = new Map();
  for (const [index, aggregate] of value.aggregates.entries()) {
    const aggregateContext = `${context}.aggregates[${index}]`;
    exactObject(
      aggregate,
      [
        "aggregateId",
        "coverageClass",
        "minimumCardinality",
        "observedCardinality",
        "requirementIds",
        "status",
      ],
      aggregateContext
    );
    lowerToken(aggregate.aggregateId, `${aggregateContext}.aggregateId`);
    enumValue(
      aggregate.coverageClass,
      PUBLIC_COVERAGE_CLASS_SET,
      `${aggregateContext}.coverageClass`
    );
    if (!Number.isInteger(aggregate.minimumCardinality) || aggregate.minimumCardinality < 3) {
      fail(`${aggregateContext}.minimumCardinality`, "must preserve at least three cases");
    }
    nonnegativeInteger(aggregate.observedCardinality, `${aggregateContext}.observedCardinality`);
    enumValue(aggregate.status, GATE_STATUSES, `${aggregateContext}.status`);
    array(aggregate.requirementIds, `${aggregateContext}.requirementIds`, { min: 1 });
    for (const [requirementIndex, requirementId] of aggregate.requirementIds.entries()) {
      stringMatching(
        requirementId,
        REQUIREMENT_PATTERN,
        `${aggregateContext}.requirementIds[${requirementIndex}]`
      );
    }
    sortedUnique(aggregate.requirementIds, `${aggregateContext}.requirementIds`);
    if (
      aggregate.status === "pass" &&
      aggregate.observedCardinality < aggregate.minimumCardinality
    ) {
      fail(aggregateContext, "a passing aggregate does not meet its precommitted minimum");
    }
    aggregateByClass.set(aggregate.coverageClass, aggregate);
  }
  for (const [coverageClass, count] of commitmentCounts) {
    const aggregate = aggregateByClass.get(coverageClass);
    if (!aggregate) fail(context, `case commitments for ${coverageClass} lack an aggregate`);
    if (count < aggregate.minimumCardinality) {
      fail(context, `case commitments for ${coverageClass} expose a sub-minimum cohort`);
    }
    if (aggregate.observedCardinality < count) {
      fail(context, `aggregate ${coverageClass} undercounts its public commitments`);
    }
  }

  array(value.redactions, `${context}.redactions`, {
    uniqueBy: (entry) => entry?.fieldClass,
  });
  for (const [index, redaction] of value.redactions.entries()) {
    const redactionContext = `${context}.redactions[${index}]`;
    exactObject(redaction, ["fieldClass", "receiptArtifactId", "status"], redactionContext);
    enumValue(redaction.fieldClass, PRIVATE_FIELD_CLASSES, `${redactionContext}.fieldClass`);
    if (redaction.status !== "withheld") {
      fail(`${redactionContext}.status`, "must be literal withheld");
    }
    lowerToken(redaction.receiptArtifactId, `${redactionContext}.receiptArtifactId`);
    if (artifactIds && !artifactIds.has(redaction.receiptArtifactId)) {
      fail(redactionContext, "references an unknown redaction artifact");
    }
  }
  return value;
}

export function validateMediaSanitization(value, options = {}) {
  const { context = "mediaSanitization", artifacts = [] } = options;
  array(value, context, { uniqueBy: (entry) => entry?.sanitizationId });
  const artifactsById = new Map(artifacts.map((artifact) => [artifact.artifactId, artifact]));
  const sanitizedArtifactIds = new Set();
  for (const [index, receipt] of value.entries()) {
    const receiptContext = `${context}[${index}]`;
    exactObject(
      receipt,
      ["artifactId", "checks", "profile", "sanitizationId", "status"],
      receiptContext
    );
    lowerToken(receipt.sanitizationId, `${receiptContext}.sanitizationId`);
    lowerToken(receipt.artifactId, `${receiptContext}.artifactId`);
    if (receipt.status !== "pass") fail(`${receiptContext}.status`, "must be literal pass");
    if (sanitizedArtifactIds.has(receipt.artifactId)) {
      fail(receiptContext, "duplicates sanitization for one artifact");
    }
    sanitizedArtifactIds.add(receipt.artifactId);
    const artifact = artifactsById.get(receipt.artifactId);
    if (!artifact) fail(receiptContext, "references an unknown public artifact");
    const expected = MEDIA_PROFILES[artifact.mediaType];
    if (!expected) fail(receiptContext, "cannot sanitize a typed JSON receipt as musical media");
    if (artifact.sanitizationId !== receipt.sanitizationId) {
      fail(receiptContext, "does not match the artifact sanitization binding");
    }
    if (receipt.profile !== expected.profile) {
      fail(`${receiptContext}.profile`, `must use ${expected.profile} for ${artifact.mediaType}`);
    }
    if (JSON.stringify(receipt.checks) !== JSON.stringify(expected.checks)) {
      fail(receiptContext, "does not contain the exact media-specific sanitization checks");
    }
  }
  for (const artifact of artifacts) {
    if (artifact.mediaType === "application/json") continue;
    if (!sanitizedArtifactIds.has(artifact.artifactId)) {
      fail(context, `public media artifact ${artifact.artifactId} lacks sanitization`);
    }
  }
  return value;
}

function validateExactDigestRef(value, context) {
  exactObject(value, ["digest", "id"], context);
  lowerToken(value.id, `${context}.id`);
  digest(value.digest, `${context}.digest`);
  return value;
}

function validateAuthoritySubjects(value, context) {
  exactObject(value, ["outputs", "package", "system"], context);
  validateExactDigestRef(value.package, `${context}.package`);
  validateExactDigestRef(value.system, `${context}.system`);
  array(value.outputs, `${context}.outputs`, { min: 1, uniqueBy: (entry) => entry?.id });
  for (const [index, output] of value.outputs.entries()) {
    validateExactDigestRef(output, `${context}.outputs[${index}]`);
  }
  sortedUnique(
    value.outputs.map(({ id }) => id),
    `${context}.outputs ids`
  );
  return value;
}

function claimScopeCore(value) {
  return {
    authorityDomain: value.authorityDomain,
    dimensions: value.dimensions,
    scopeId: value.scopeId,
    targets: value.targets,
  };
}

export function digestClaimScope(value) {
  return digestAuthorityPayload(claimScopeCore(value));
}

function validateClaimScope(value, context) {
  exactObject(value, ["authorityDomain", "digest", "dimensions", "scopeId", "targets"], context);
  lowerToken(value.scopeId, `${context}.scopeId`);
  enumValue(value.authorityDomain, AUTHORITY_DOMAIN_SET, `${context}.authorityDomain`);
  array(value.targets, `${context}.targets`, { min: 1 });
  sortedUnique(value.targets, `${context}.targets`);
  for (const [index, target] of value.targets.entries()) {
    enumValue(target, AUTHORITY_TARGET_SET, `${context}.targets[${index}]`);
  }
  array(value.dimensions, `${context}.dimensions`, { min: 1 });
  sortedUnique(value.dimensions, `${context}.dimensions`);
  for (const [index, dimension] of value.dimensions.entries()) {
    enumValue(dimension, CLAIM_SCOPE_DIMENSION_SET, `${context}.dimensions[${index}]`);
  }
  digest(value.digest, `${context}.digest`);
  if (value.digest !== digestClaimScope(value)) {
    fail(`${context}.digest`, "does not bind the exact typed Claim Scope");
  }
  return value;
}

function validateClaimScopes(value, context) {
  array(value, context, { min: 1, uniqueBy: (scope) => scope?.scopeId });
  for (const [index, scope] of value.entries()) validateClaimScope(scope, `${context}[${index}]`);
  sortedUnique(
    value.map(({ scopeId }) => scopeId),
    `${context} scope IDs`
  );
  return value;
}

function validateReviewer(value, expectedKind, context) {
  exactObject(value, ["credential", "role", "subjectId"], context);
  lowerToken(value.subjectId, `${context}.subjectId`);
  if (expectedKind === "owner_provisional_decision") {
    if (value.role !== "owner") fail(`${context}.role`, "must be owner for a provisional decision");
  } else {
    enumValue(value.role, HUMAN_REVIEW_ROLE_SET, `${context}.role`);
  }
  exactObject(value.credential, ["credentialId", "credentialType"], `${context}.credential`);
  lowerToken(value.credential.credentialId, `${context}.credential.credentialId`);
  enumValue(
    value.credential.credentialType,
    CREDENTIAL_TYPES,
    `${context}.credential.credentialType`
  );
  return value;
}

function validateSignatureEnvelope(value, expectedCredentialId, signedPayload, context) {
  exactObject(value, ["algorithm", "credentialId", "signature", "signedPayloadDigest"], context);
  enumValue(value.algorithm, SIGNATURE_ALGORITHMS, `${context}.algorithm`);
  lowerToken(value.credentialId, `${context}.credentialId`);
  if (value.credentialId !== expectedCredentialId) {
    fail(`${context}.credentialId`, "does not match the signing subject credential");
  }
  digest(value.signedPayloadDigest, `${context}.signedPayloadDigest`);
  const expectedPayloadDigest = digestAuthorityPayload(signedPayload);
  if (value.signedPayloadDigest !== expectedPayloadDigest) {
    fail(`${context}.signedPayloadDigest`, "does not bind the exact closed payload");
  }
  stringMatching(value.signature, BASE64URL_PATTERN, `${context}.signature`);
  return value;
}

function verifyCryptographicSignature(envelope, signer, signerKind, verifySignature, context) {
  if (typeof verifySignature !== "function") return null;
  const result = verifySignature({
    algorithm: envelope.algorithm,
    credentialId: signer.credentialId,
    credentialType: signer.credentialType,
    signature: envelope.signature,
    signedPayloadDigest: envelope.signedPayloadDigest,
    signerKind,
    subjectId: signer.subjectId,
    verifierPolicyDigest: signerKind === "authority_verifier" ? signer.policyDigest : null,
  });
  if (result !== true && result !== false && result !== null) {
    fail(context, "trusted signature verifier must return true, false, or null");
  }
  return result;
}

function validateConflict(value, context) {
  exactObject(value, ["kind", "role"], context);
  enumValue(value.role, CONFLICT_ROLES, `${context}.role`);
  enumValue(value.kind, CONFLICT_KINDS, `${context}.kind`);
  return value;
}

function validateAuthorityVerification(value, statement, context) {
  exactObject(
    value,
    [
      "authorization",
      "credential",
      "independence",
      "result",
      "reviewerStatementDigest",
      "signatureStatus",
      "validity",
      "verificationId",
      "verifier",
    ],
    context
  );
  lowerToken(value.verificationId, `${context}.verificationId`);
  digest(value.reviewerStatementDigest, `${context}.reviewerStatementDigest`);
  const expectedStatementDigest = digestAuthorityPayload(statement);
  if (value.reviewerStatementDigest !== expectedStatementDigest) {
    fail(`${context}.reviewerStatementDigest`, "does not bind the exact reviewer statement");
  }
  enumValue(
    value.signatureStatus,
    new Set(["invalid", "unverified", "valid"]),
    `${context}.signatureStatus`
  );

  exactObject(
    value.credential,
    ["credentialId", "credentialType", "subjectId"],
    `${context}.credential`
  );
  lowerToken(value.credential.subjectId, `${context}.credential.subjectId`);
  lowerToken(value.credential.credentialId, `${context}.credential.credentialId`);
  enumValue(
    value.credential.credentialType,
    CREDENTIAL_TYPES,
    `${context}.credential.credentialType`
  );
  for (const key of ["subjectId", "credentialId", "credentialType"]) {
    const statementValue =
      key === "subjectId" ? statement.reviewer.subjectId : statement.reviewer.credential[key];
    if (value.credential[key] !== statementValue) {
      fail(`${context}.credential.${key}`, "does not match the signed reviewer identity");
    }
  }

  exactObject(
    value.verifier,
    ["credentialId", "credentialType", "policyDigest", "role", "subjectId"],
    `${context}.verifier`
  );
  lowerToken(value.verifier.subjectId, `${context}.verifier.subjectId`);
  if (value.verifier.role !== "authority_verifier") {
    fail(`${context}.verifier.role`, "must be authority_verifier");
  }
  lowerToken(value.verifier.credentialId, `${context}.verifier.credentialId`);
  enumValue(value.verifier.credentialType, CREDENTIAL_TYPES, `${context}.verifier.credentialType`);
  digest(value.verifier.policyDigest, `${context}.verifier.policyDigest`);
  if (value.verifier.subjectId === statement.reviewer.subjectId) {
    fail(`${context}.verifier.subjectId`, "must be independent from the reviewed subject");
  }

  const evaluatedScopeDigests = statement.claimScopes
    .map(({ digest: scopeDigest }) => scopeDigest)
    .sort();
  exactObject(
    value.authorization,
    [
      "authorizedClaimScopeDigests",
      "evaluatedClaimScopeDigests",
      "intersectionClaimScopeDigests",
      "status",
    ],
    `${context}.authorization`
  );
  for (const key of [
    "authorizedClaimScopeDigests",
    "evaluatedClaimScopeDigests",
    "intersectionClaimScopeDigests",
  ]) {
    array(value.authorization[key], `${context}.authorization.${key}`);
    sortedUnique(value.authorization[key], `${context}.authorization.${key}`);
    for (const [index, scopeDigest] of value.authorization[key].entries()) {
      digest(scopeDigest, `${context}.authorization.${key}[${index}]`);
    }
  }
  if (
    JSON.stringify(value.authorization.evaluatedClaimScopeDigests) !==
    JSON.stringify(evaluatedScopeDigests)
  ) {
    fail(`${context}.authorization`, "does not evaluate the exact signed Claim Scope set");
  }
  if (
    value.authorization.intersectionClaimScopeDigests.some(
      (scopeDigest) => !evaluatedScopeDigests.includes(scopeDigest)
    )
  ) {
    fail(`${context}.authorization`, "contains a scope outside the signed Claim Scope set");
  }
  enumValue(
    value.authorization.status,
    new Set(["authorized", "out_of_scope", "unverified"]),
    `${context}.authorization.status`
  );
  if (
    value.authorization.status === "authorized" &&
    JSON.stringify(value.authorization.intersectionClaimScopeDigests) !==
      JSON.stringify(evaluatedScopeDigests)
  ) {
    fail(`${context}.authorization`, "authorized scope must cover every evaluated Claim Scope");
  }
  if (
    value.authorization.status === "out_of_scope" &&
    value.authorization.intersectionClaimScopeDigests.length >= evaluatedScopeDigests.length
  ) {
    fail(`${context}.authorization`, "out_of_scope must have a strict scope shortfall");
  }
  if (
    value.authorization.status === "unverified" &&
    value.authorization.intersectionClaimScopeDigests.length !== 0
  ) {
    fail(`${context}.authorization`, "unverified scope cannot carry a scope intersection");
  }

  exactObject(
    value.independence,
    ["conflictPolicyDigest", "conflicts", "status"],
    `${context}.independence`
  );
  digest(value.independence.conflictPolicyDigest, `${context}.independence.conflictPolicyDigest`);
  array(value.independence.conflicts, `${context}.independence.conflicts`, {
    uniqueBy: (conflict) => `${conflict?.role}:${conflict?.kind}`,
  });
  for (const [index, conflict] of value.independence.conflicts.entries()) {
    validateConflict(conflict, `${context}.independence.conflicts[${index}]`);
  }
  sortedUnique(
    value.independence.conflicts.map(({ kind, role }) => `${role}:${kind}`),
    `${context}.independence.conflicts`
  );
  enumValue(
    value.independence.status,
    new Set(["conflicted", "independent", "unverified"]),
    `${context}.independence.status`
  );
  if (value.independence.status === "independent" && value.independence.conflicts.length !== 0) {
    fail(`${context}.independence`, "independent status requires an empty conflict set");
  }
  if (value.independence.status === "conflicted" && value.independence.conflicts.length === 0) {
    fail(`${context}.independence`, "conflicted status requires a typed conflict");
  }
  if (value.independence.status === "unverified" && value.independence.conflicts.length !== 0) {
    fail(`${context}.independence`, "unverified independence cannot assert conflict findings");
  }

  exactObject(
    value.validity,
    ["credentialExpiresAt", "credentialIssuedAt", "evaluatedAt", "freshness", "revocation"],
    `${context}.validity`
  );
  for (const key of ["credentialExpiresAt", "credentialIssuedAt", "evaluatedAt"]) {
    isoInstant(value.validity[key], `${context}.validity.${key}`);
  }
  const credentialIssuedAt = Date.parse(value.validity.credentialIssuedAt);
  const credentialExpiresAt = Date.parse(value.validity.credentialExpiresAt);
  const evaluatedAt = Date.parse(value.validity.evaluatedAt);
  const statementIssuedAt = Date.parse(statement.issuedAt);
  if (credentialIssuedAt >= credentialExpiresAt) {
    fail(`${context}.validity`, "credential expiry must follow credential issuance");
  }
  if (statementIssuedAt < credentialIssuedAt || statementIssuedAt >= credentialExpiresAt) {
    fail(`${context}.validity`, "reviewer signed outside the credential validity interval");
  }
  if (evaluatedAt < statementIssuedAt) {
    fail(`${context}.validity.evaluatedAt`, "cannot predate the signed statement");
  }
  enumValue(
    value.validity.freshness,
    new Set(["current", "expired"]),
    `${context}.validity.freshness`
  );
  const expectedFreshness = evaluatedAt >= credentialExpiresAt ? "expired" : "current";
  if (value.validity.freshness !== expectedFreshness) {
    fail(`${context}.validity.freshness`, "contradicts the credential validity interval");
  }
  exactObject(
    value.validity.revocation,
    ["checkedAt", "sourceDigest", "status"],
    `${context}.validity.revocation`
  );
  isoInstant(value.validity.revocation.checkedAt, `${context}.validity.revocation.checkedAt`);
  if (Date.parse(value.validity.revocation.checkedAt) > evaluatedAt) {
    fail(`${context}.validity.revocation.checkedAt`, "cannot postdate authority evaluation");
  }
  digest(value.validity.revocation.sourceDigest, `${context}.validity.revocation.sourceDigest`);
  enumValue(
    value.validity.revocation.status,
    new Set(["clear", "revoked", "unknown"]),
    `${context}.validity.revocation.status`
  );

  enumValue(
    value.result,
    new Set([
      "conflicted",
      "expired",
      "invalid_signature",
      "out_of_scope",
      "revoked",
      "unverified",
      "verified",
    ]),
    `${context}.result`
  );
  const revocationIsFresh = value.validity.revocation.checkedAt === value.validity.evaluatedAt;
  const expectedResult =
    value.signatureStatus === "invalid"
      ? "invalid_signature"
      : value.validity.revocation.status === "revoked"
        ? "revoked"
        : value.validity.freshness === "expired"
          ? "expired"
          : value.authorization.status === "out_of_scope"
            ? "out_of_scope"
            : value.independence.status === "conflicted"
              ? "conflicted"
              : value.signatureStatus === "valid" &&
                  value.validity.freshness === "current" &&
                  value.validity.revocation.status === "clear" &&
                  revocationIsFresh &&
                  value.authorization.status === "authorized" &&
                  value.independence.status === "independent"
                ? "verified"
                : "unverified";
  if (value.result !== expectedResult) {
    fail(`${context}.result`, `must be ${expectedResult} for the bounded authority evidence`);
  }
  const expectedAuthorizedScopes = value.result === "verified" ? evaluatedScopeDigests : [];
  if (
    JSON.stringify(value.authorization.authorizedClaimScopeDigests) !==
    JSON.stringify(expectedAuthorizedScopes)
  ) {
    fail(
      `${context}.authorization.authorizedClaimScopeDigests`,
      "must be empty unless the complete verification grants current authority"
    );
  }
  return value;
}

function validateHumanReviewResult(value, context) {
  exactObject(value, ["findingCodes", "productAcceptance", "resultCode"], context);
  enumValue(value.productAcceptance, GATE_STATUSES, `${context}.productAcceptance`);
  enumValue(value.resultCode, GATE_STATUSES, `${context}.resultCode`);
  if (value.resultCode !== value.productAcceptance) {
    fail(context, "resultCode must equal its four-state product acceptance");
  }
  array(value.findingCodes, `${context}.findingCodes`, { min: 1 });
  sortedUnique(value.findingCodes, `${context}.findingCodes`);
  for (const [index, findingCode] of value.findingCodes.entries()) {
    enumValue(findingCode, REVIEW_FINDING_CODES, `${context}.findingCodes[${index}]`);
  }
  if (
    (value.productAcceptance === "pass" &&
      JSON.stringify(value.findingCodes) !== JSON.stringify(["none"])) ||
    (value.productAcceptance !== "pass" && value.findingCodes.includes("none"))
  ) {
    fail(context, "only pass may use the sole finding code none");
  }
  return value;
}

function validateGenerationBinding(value, expectedTracerId, context) {
  exactObject(value, ["artifactDigest", "generation", "receiptCommit", "tracerId"], context);
  if (value.tracerId !== expectedTracerId) {
    fail(`${context}.tracerId`, `must be ${expectedTracerId}`);
  }
  positiveInteger(value.generation, `${context}.generation`);
  gitObject(value.receiptCommit, `${context}.receiptCommit`);
  digest(value.artifactDigest, `${context}.artifactDigest`);
  return value;
}

function validatePriorOwnerDecision(value, context) {
  exactObject(value, ["decisionDigest", "generation", "receiptCommit", "tracerId"], context);
  if (value.tracerId !== "T86") fail(`${context}.tracerId`, "must be T86");
  positiveInteger(value.generation, `${context}.generation`);
  gitObject(value.receiptCommit, `${context}.receiptCommit`);
  digest(value.decisionDigest, `${context}.decisionDigest`);
  return value;
}

function validateOwnerDecision(value, context) {
  exactObject(
    value,
    [
      "action",
      "machineClosure",
      "priorDecision",
      "productAcceptance",
      "reasonCodes",
      "releaseCompleteRevocation",
      "releaseCompleteState",
      "resultCode",
      "reviewPackage",
      "reviewSnapshotDigest",
      "reviewState",
    ],
    context
  );
  enumValue(value.action, new Set(["stop", "resume"]), `${context}.action`);
  validateGenerationBinding(value.machineClosure, "T85", `${context}.machineClosure`);
  validateGenerationBinding(value.reviewPackage, "T81", `${context}.reviewPackage`);
  digest(value.reviewSnapshotDigest, `${context}.reviewSnapshotDigest`);
  if (value.priorDecision !== null) {
    validatePriorOwnerDecision(value.priorDecision, `${context}.priorDecision`);
  }
  array(value.reasonCodes, `${context}.reasonCodes`, { min: 1 });
  sortedUnique(value.reasonCodes, `${context}.reasonCodes`);
  for (const [index, reasonCode] of value.reasonCodes.entries()) {
    enumValue(reasonCode, OWNER_DECISION_REASON_CODES, `${context}.reasonCodes[${index}]`);
  }
  enumValue(
    value.releaseCompleteState,
    new Set(["current", "not_complete"]),
    `${context}.releaseCompleteState`
  );
  if (value.releaseCompleteRevocation !== null) {
    exactObject(
      value.releaseCompleteRevocation,
      ["digest", "transitionId"],
      `${context}.releaseCompleteRevocation`
    );
    lowerToken(
      value.releaseCompleteRevocation.transitionId,
      `${context}.releaseCompleteRevocation.transitionId`
    );
    digest(value.releaseCompleteRevocation.digest, `${context}.releaseCompleteRevocation.digest`);
  }

  if (value.action === "stop") {
    if (
      value.resultCode !== "provisional_stop_current" ||
      value.productAcceptance !== "blocked" ||
      !new Set(["blocked", "deferred", "failed", "incomplete"]).has(value.reviewState)
    ) {
      fail(context, "stop must be an explicitly nonpassing provisional_stop_current decision");
    }
    const requiredReasonByState = {
      blocked: "review_blocked",
      deferred: "review_deferred",
      failed: "review_failed",
      incomplete: "review_incomplete",
    };
    if (!value.reasonCodes.includes(requiredReasonByState[value.reviewState])) {
      fail(context, "stop reason codes do not bind the declared review state");
    }
    if (value.releaseCompleteState === "current") {
      if (
        value.releaseCompleteRevocation === null ||
        !value.reasonCodes.includes("release_complete_revoked")
      ) {
        fail(context, "stopping a current Release Complete state requires a typed revocation");
      }
    } else if (value.releaseCompleteRevocation !== null) {
      fail(context, "a non-complete release cannot carry a Release Complete revocation");
    }
  } else {
    if (
      value.resultCode !== "provisional_stop_resumed" ||
      value.productAcceptance !== "pass" ||
      value.reviewState !== "resumed" ||
      JSON.stringify(value.reasonCodes) !== JSON.stringify(["review_resumed"]) ||
      value.priorDecision === null
    ) {
      fail(context, "resume must be a passing successor of one exact provisional stop");
    }
    if (value.releaseCompleteState !== "not_complete" || value.releaseCompleteRevocation !== null) {
      fail(context, "resume cannot fabricate or revoke Release Complete state");
    }
  }
  return value;
}

function validateAuthorityReceiptRoot(value, expectedKind, context, options) {
  exactObject(
    value,
    [
      "authorityVerification",
      "receiptKind",
      "reviewerSignature",
      "schemaId",
      "statement",
      "verifierSignature",
    ],
    context
  );
  if (value.schemaId !== PUBLIC_REVIEW_RECEIPT_SCHEMA_ID) {
    fail(`${context}.schemaId`, `must equal ${PUBLIC_REVIEW_RECEIPT_SCHEMA_ID}`);
  }
  if (value.receiptKind !== expectedKind) {
    fail(`${context}.receiptKind`, `must equal ${expectedKind}`);
  }
  exactObject(
    value.statement,
    [
      "authorityReceiptId",
      "claimScopes",
      "issuedAt",
      expectedKind === "human_review" ? "review" : "decision",
      "reviewer",
      "subjects",
    ],
    `${context}.statement`
  );
  lowerToken(value.statement.authorityReceiptId, `${context}.statement.authorityReceiptId`);
  isoInstant(value.statement.issuedAt, `${context}.statement.issuedAt`);
  validateReviewer(value.statement.reviewer, expectedKind, `${context}.statement.reviewer`);
  validateAuthoritySubjects(value.statement.subjects, `${context}.statement.subjects`);
  validateClaimScopes(value.statement.claimScopes, `${context}.statement.claimScopes`);

  validateSignatureEnvelope(
    value.reviewerSignature,
    value.statement.reviewer.credential.credentialId,
    value.statement,
    `${context}.reviewerSignature`
  );
  validateAuthorityVerification(
    value.authorityVerification,
    value.statement,
    `${context}.authorityVerification`
  );
  if (
    !SHA256_PATTERN.test(options.expectedVerifierPolicyDigest ?? "") ||
    value.authorityVerification.verifier.policyDigest !== options.expectedVerifierPolicyDigest
  ) {
    fail(
      `${context}.authorityVerification.verifier.policyDigest`,
      "must match the repository-pinned trusted verifier policy"
    );
  }
  const reviewerSignatureResult = verifyCryptographicSignature(
    value.reviewerSignature,
    {
      ...value.statement.reviewer.credential,
      subjectId: value.statement.reviewer.subjectId,
    },
    "reviewer",
    options.verifySignature,
    `${context}.reviewerSignature`
  );
  const expectedSignatureStatus =
    reviewerSignatureResult === true
      ? "valid"
      : reviewerSignatureResult === false
        ? "invalid"
        : "unverified";
  if (value.authorityVerification.signatureStatus !== expectedSignatureStatus) {
    fail(
      `${context}.authorityVerification.signatureStatus`,
      "does not match trusted cryptographic verification of the reviewer signature"
    );
  }
  validateSignatureEnvelope(
    value.verifierSignature,
    value.authorityVerification.verifier.credentialId,
    value.authorityVerification,
    `${context}.verifierSignature`
  );
  const verifierSignatureResult = verifyCryptographicSignature(
    value.verifierSignature,
    value.authorityVerification.verifier,
    "authority_verifier",
    options.verifySignature,
    `${context}.verifierSignature`
  );
  if (verifierSignatureResult !== true) {
    fail(
      `${context}.verifierSignature`,
      "must pass trusted cryptographic verification under the pinned verifier policy"
    );
  }
  return value;
}

export function validateHumanReviewAuthorityReceipt(value, options = {}) {
  const {
    context = "humanReviewAuthorityReceipt",
    expectedSubjects,
    requireGrant = false,
  } = options;
  validateAuthorityReceiptRoot(value, "human_review", context, options);
  validateHumanReviewResult(value.statement.review, `${context}.statement.review`);
  const allowedDomains = HUMAN_ROLE_DOMAINS[value.statement.reviewer.role];
  const allowedTargets = HUMAN_ROLE_TARGETS[value.statement.reviewer.role];
  for (const scope of value.statement.claimScopes) {
    if (!allowedDomains?.has(scope.authorityDomain)) {
      fail(
        `${context}.statement.claimScopes`,
        `${value.statement.reviewer.role} cannot claim ${scope.authorityDomain} authority`
      );
    }
    if (scope.targets.some((target) => !allowedTargets?.has(target))) {
      fail(
        `${context}.statement.claimScopes`,
        `${value.statement.reviewer.role} cannot claim one or more target scopes`
      );
    }
    const allowedDimensions = DOMAIN_DIMENSIONS[scope.authorityDomain];
    if (scope.dimensions.some((dimension) => !allowedDimensions?.has(dimension))) {
      fail(
        `${context}.statement.claimScopes`,
        `${scope.authorityDomain} cannot claim one or more dimensions`
      );
    }
  }
  if (
    value.statement.review.productAcceptance === "pass" &&
    value.authorityVerification.result !== "verified"
  ) {
    fail(context, "a passing human review requires current verified authority");
  }
  if (requireGrant && value.authorityVerification.result !== "verified") {
    fail(context, "does not grant current verified reviewer authority");
  }
  if (
    expectedSubjects !== undefined &&
    canonicalJson(value.statement.subjects) !== canonicalJson(expectedSubjects)
  ) {
    fail(`${context}.statement.subjects`, "does not bind the expected package/output/system");
  }
  return value;
}

export function validateOwnerDecisionAuthorityReceipt(value, options = {}) {
  const { context = "ownerDecisionAuthorityReceipt", expectedSubjects } = options;
  validateAuthorityReceiptRoot(value, "owner_provisional_decision", context, options);
  validateOwnerDecision(value.statement.decision, `${context}.statement.decision`);
  for (const scope of value.statement.claimScopes) {
    if (
      scope.authorityDomain !== "provisional_control" ||
      JSON.stringify(scope.targets) !== JSON.stringify(["cross_target"]) ||
      JSON.stringify(scope.dimensions) !== JSON.stringify(["release_state", "review_state"])
    ) {
      fail(
        `${context}.statement.claimScopes`,
        "Owner provisional authority is limited to cross-target provisional control"
      );
    }
  }
  if (value.authorityVerification.result !== "verified") {
    fail(context, "an Owner stop/resume decision requires current verified Owner authority");
  }
  if (
    expectedSubjects !== undefined &&
    canonicalJson(value.statement.subjects) !== canonicalJson(expectedSubjects)
  ) {
    fail(`${context}.statement.subjects`, "does not bind the expected package/output/system");
  }
  return value;
}

export function validatePublicReviewReceipt(value, options = {}) {
  plainObject(value, options.context ?? "publicReviewReceipt");
  if (value.receiptKind === "human_review") {
    return validateHumanReviewAuthorityReceipt(value, options);
  }
  if (value.receiptKind === "owner_provisional_decision") {
    return validateOwnerDecisionAuthorityReceipt(value, options);
  }
  fail(
    `${options.context ?? "publicReviewReceipt"}.receiptKind`,
    "must distinguish human_review from owner_provisional_decision"
  );
}

export function authorityReceiptGrantsAuthority(value, options = {}) {
  validatePublicReviewReceipt(value, options);
  return value.authorityVerification.result === "verified";
}

export const validateAuthorityArtifactPayload = validatePublicReviewReceipt;

function validateGenerationReference(value, context) {
  exactObject(value, ["generation", "tracerId"], context);
  positiveInteger(value.tracerId, `${context}.tracerId`);
  positiveInteger(value.generation, `${context}.generation`);
  return value;
}

function validateOutcomeStateEdges(value, context) {
  array(value.supersedes, `${context}.supersedes`, {
    uniqueBy: (edge) => `${edge?.target?.tracerId}:${edge?.target?.generation}`,
  });
  for (const [index, edge] of value.supersedes.entries()) {
    const edgeContext = `${context}.supersedes[${index}]`;
    exactObject(edge, ["reasonCode", "target"], edgeContext);
    enumValue(edge.reasonCode, STATE_EDGE_REASON_CODE_SET, `${edgeContext}.reasonCode`);
    validateGenerationReference(edge.target, `${edgeContext}.target`);
  }
  array(value.invalidates, `${context}.invalidates`, {
    uniqueBy: (edge) => `${edge?.target?.tracerId}:${edge?.target?.generation}`,
  });
  for (const [index, edge] of value.invalidates.entries()) {
    const edgeContext = `${context}.invalidates[${index}]`;
    exactObject(edge, ["reasonCode", "scopes", "target"], edgeContext);
    enumValue(edge.reasonCode, STATE_EDGE_REASON_CODE_SET, `${edgeContext}.reasonCode`);
    validateGenerationReference(edge.target, `${edgeContext}.target`);
    array(edge.scopes, `${edgeContext}.scopes`, { min: 1 });
    sortedUnique(edge.scopes, `${edgeContext}.scopes`);
    for (const [scopeIndex, scope] of edge.scopes.entries()) {
      enumValue(scope, INVALIDATION_SCOPE_SET, `${edgeContext}.scopes[${scopeIndex}]`);
    }
  }
  const allTargets = [...value.supersedes, ...value.invalidates].map(
    ({ target }) => `${target.tracerId}:${target.generation}`
  );
  if (new Set(allTargets).size !== allTargets.length) {
    fail(context, "cannot supersede and invalidate the same generation twice");
  }
}

function validateOutcome(value, artifactIds, context) {
  exactObject(
    value,
    [
      "applicability",
      "authorityValidity",
      "comparison",
      "compatibility",
      "freshness",
      "issueCompletion",
      "invalidates",
      "productAcceptance",
      "resultDisposition",
      "supersedes",
    ],
    context
  );
  enumValue(
    value.issueCompletion,
    new Set(["open", "in_progress", "complete", "invalidated", "superseded"]),
    `${context}.issueCompletion`
  );
  validateOutcomeStateEdges(value, context);
  enumValue(
    value.productAcceptance,
    new Set(["pass", "fail", "blocked", "incomplete"]),
    `${context}.productAcceptance`
  );
  enumValue(
    value.applicability,
    new Set(["applicable", "not_applicable", "not_claimed"]),
    `${context}.applicability`
  );
  enumValue(
    value.comparison,
    new Set(["comparable", "incomparable", "not_required", "unknown"]),
    `${context}.comparison`
  );
  enumValue(value.freshness, new Set(["current", "stale", "unknown"]), `${context}.freshness`);
  enumValue(
    value.compatibility,
    new Set(["compatible", "incompatible", "unknown"]),
    `${context}.compatibility`
  );
  enumValue(
    value.authorityValidity,
    new Set(["valid", "invalid", "not_required", "unknown"]),
    `${context}.authorityValidity`
  );
  exactObject(
    value.resultDisposition,
    ["code", "dispatchArtifactIds", "disposition"],
    `${context}.resultDisposition`
  );
  token(value.resultDisposition.code, `${context}.resultDisposition.code`);
  enumValue(
    value.resultDisposition.disposition,
    RESULT_DISPOSITIONS,
    `${context}.resultDisposition.disposition`
  );
  array(
    value.resultDisposition.dispatchArtifactIds,
    `${context}.resultDisposition.dispatchArtifactIds`
  );
  sortedUnique(
    value.resultDisposition.dispatchArtifactIds,
    `${context}.resultDisposition.dispatchArtifactIds`
  );
  for (const artifactId of value.resultDisposition.dispatchArtifactIds) {
    lowerToken(artifactId, `${context}.resultDisposition.dispatchArtifactIds[]`);
    if (artifactIds && !artifactIds.has(artifactId)) {
      fail(`${context}.resultDisposition`, "references an unknown remediation dispatch artifact");
    }
  }
  if (value.resultDisposition.disposition === "repair_dispatch") {
    if (value.resultDisposition.dispatchArtifactIds.length === 0) {
      fail(
        `${context}.resultDisposition.dispatchArtifactIds`,
        "must contain at least one artifact for a repair dispatch"
      );
    }
  } else if (value.resultDisposition.dispatchArtifactIds.length !== 0) {
    fail(
      `${context}.resultDisposition.dispatchArtifactIds`,
      "must be empty without a repair dispatch"
    );
  }
  return value;
}

export function validateEvidenceReceipt(value, context = "evidenceReceipt") {
  exactObject(
    value,
    [
      "artifacts",
      "claims",
      "finishedAt",
      "gates",
      "mediaSanitization",
      "outcome",
      "privacy",
      "schemaId",
      "startReceipt",
      "toolchains",
    ],
    context
  );
  if (value.schemaId !== EVIDENCE_RECEIPT_SCHEMA_ID) {
    fail(`${context}.schemaId`, `must equal ${EVIDENCE_RECEIPT_SCHEMA_ID}`);
  }
  validateStartReceipt(value.startReceipt, `${context}.startReceipt`);
  isoInstant(value.finishedAt, `${context}.finishedAt`);
  if (Date.parse(value.finishedAt) < Date.parse(value.startReceipt.start.startedAt)) {
    fail(`${context}.finishedAt`, "cannot predate the start receipt");
  }

  array(value.artifacts, `${context}.artifacts`, {
    uniqueBy: (artifact) => artifact?.artifactId,
  });
  for (const [index, artifact] of value.artifacts.entries()) {
    validateArtifactReceipt(artifact, {
      context: `${context}.artifacts[${index}]`,
      evidenceTracer: value.startReceipt.start.tracerId,
    });
  }
  const artifactIds = new Set(value.artifacts.map(({ artifactId }) => artifactId));

  array(value.gates, `${context}.gates`, {
    min: 1,
    uniqueBy: (gate) => gate?.gateId,
  });
  for (const [index, gate] of value.gates.entries()) {
    validateGateReceipt(gate, `${context}.gates[${index}]`);
    if (!artifactIds.has(gate.reportArtifactId)) {
      fail(`${context}.gates[${index}]`, "references an unknown gate-report artifact");
    }
  }

  array(value.toolchains, `${context}.toolchains`, {
    min: 1,
    uniqueBy: (toolchain) => toolchain?.component,
  });
  for (const [index, toolchain] of value.toolchains.entries()) {
    validateToolchainReceipt(toolchain, `${context}.toolchains[${index}]`);
  }

  validateClauseClaims(value.claims, { context: `${context}.claims`, artifactIds });
  validatePrivacyReceipt(value.privacy, { context: `${context}.privacy`, artifactIds });
  validateMediaSanitization(value.mediaSanitization, {
    context: `${context}.mediaSanitization`,
    artifacts: value.artifacts,
  });
  validateOutcome(value.outcome, artifactIds, `${context}.outcome`);

  const reportArtifactIds = new Set(value.gates.map(({ reportArtifactId }) => reportArtifactId));
  for (const artifactId of reportArtifactIds) {
    const artifact = value.artifacts.find((entry) => entry.artifactId === artifactId);
    if (
      artifact.schemaId !== "vellum.test-report.v1" &&
      artifact.schemaId !== "vellum.sanitized-gate-log.v1"
    ) {
      fail(context, `gate artifact ${artifactId} is not a typed gate report`);
    }
  }
  if (
    value.outcome.issueCompletion === "complete" &&
    value.gates.some(({ status }) => status !== "pass")
  ) {
    fail(context, "a complete outcome cannot contain a nonpassing gate");
  }
  return value;
}

export const assertAuthoritySnapshot = validateAuthoritySnapshot;
export const assertStartReceipt = validateStartReceipt;
export const assertEvidenceReceipt = validateEvidenceReceipt;
export const assertGateReceipt = validateGateReceipt;
export const assertToolchainReceipt = validateToolchainReceipt;
export const assertArtifactReceipt = validateArtifactReceipt;
export const assertClauseClaims = validateClauseClaims;
export const assertPrivacyReceipt = validatePrivacyReceipt;
export const assertMediaSanitization = validateMediaSanitization;
export const assertPublicReviewReceipt = validatePublicReviewReceipt;
export const assertHumanReviewAuthorityReceipt = validateHumanReviewAuthorityReceipt;
export const assertOwnerDecisionAuthorityReceipt = validateOwnerDecisionAuthorityReceipt;
