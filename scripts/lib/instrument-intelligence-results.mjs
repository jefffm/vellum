import { isDeepStrictEqual } from "node:util";

export const PRODUCT_ACCEPTANCE_STATES = Object.freeze(["pass", "fail", "blocked", "incomplete"]);

export const RESULT_DISPOSITIONS = Object.freeze([
  "unlock",
  "adjudicate",
  "repair_dispatch",
  "retry",
  "successor",
  "provisional_stop",
]);

export const REMEDIATION_OBLIGATION_SCHEMA_ID = "vellum.remediation-obligation.v1";
export const REMEDIATION_LEDGER_SCHEMA_ID = "vellum.remediation-obligation-ledger.v1";

/**
 * Closed reason-code vocabulary shared by remediation invalidation contracts
 * and execution-generation state edges.
 */
export const STATE_EDGE_REASON_CODES = Object.freeze([
  "definition_changed",
  "evidence_stale",
  "qualification_failure",
  "review_finding",
  "rights_change",
  "repair_rerun",
  "decision_superseded",
  "governed_reassessment",
]);

export const INVALIDATION_SCOPE_CODES = Object.freeze([
  "issue",
  "evidence",
  "requirements",
  "machine_closure",
  "release_closure",
  "provisional_stop",
]);
const INVALIDATION_SCOPES = new Set(INVALIDATION_SCOPE_CODES);
const STATE_EDGE_REASON_CODE_SET = new Set(STATE_EDGE_REASON_CODES);
const ATTEMPT_OUTCOMES = new Set(PRODUCT_ACCEPTANCE_STATES);
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{2,127}$/;
const CLAUSE_ID_PATTERN = /^II-CLAUSE-\d{4}$/;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function outcome(productAcceptance, disposition, applicability = "applicable") {
  return {
    applicability,
    dispatchPolicy: disposition === "repair_dispatch" ? "required" : "forbidden",
    disposition,
    productAcceptance,
  };
}

const reviewOutcomes = {
  pass: outcome("pass", "adjudicate"),
  fail: outcome("fail", "adjudicate"),
  blocked: outcome("blocked", "adjudicate"),
  incomplete: outcome("incomplete", "adjudicate"),
};

/**
 * Closed result-code and downstream-disposition contract for every late-wave
 * attempt, decision, applicability check, and closure adjudication.
 *
 * `productAcceptance` is deliberately not issue completion. In particular,
 * T102 only records that all decisions exist, and T107 only decides whether a
 * separate lyric review applies; neither creates a product-acceptance pass.
 */
export const TRACER_RESULT_CONTRACTS = deepFreeze({
  63: { pre_hitl_ready: outcome("pass", "unlock") },
  64: {
    curation_sufficient: outcome("pass", "adjudicate"),
    curation_insufficient: outcome("fail", "adjudicate"),
    curation_declined: outcome("blocked", "adjudicate"),
  },
  65: reviewOutcomes,
  66: reviewOutcomes,
  67: reviewOutcomes,
  68: reviewOutcomes,
  69: {
    review_round_passed: outcome("pass", "unlock"),
    review_round_failed: outcome("fail", "repair_dispatch"),
    review_round_blocked: outcome("blocked", "successor"),
    review_round_incomplete: outcome("incomplete", "successor"),
    review_round_applicability_invalid: outcome("fail", "repair_dispatch"),
  },
  81: { review_package_ready: outcome("pass", "unlock") },
  82: {
    truth_sufficient: outcome("pass", "adjudicate"),
    truth_insufficient: outcome("fail", "adjudicate"),
    truth_blocked: outcome("blocked", "adjudicate"),
    truth_incomplete: outcome("incomplete", "adjudicate"),
  },
  83: {
    attempt_pass: outcome("pass", "adjudicate"),
    attempt_fail: outcome("fail", "adjudicate"),
    attempt_blocked: outcome("blocked", "adjudicate"),
    attempt_incomplete: outcome("incomplete", "adjudicate"),
  },
  84: {
    qualification_passed_no_open_repairs: outcome("pass", "unlock"),
    qualification_failed_repair_dispatched: outcome("fail", "repair_dispatch"),
    qualification_blocked: outcome("blocked", "retry"),
    qualification_incomplete: outcome("incomplete", "retry"),
    qualification_invalid_fixture_replacement_required: outcome("incomplete", "retry"),
  },
  85: {
    machine_complete: outcome("pass", "unlock"),
    machine_closure_failed_repair_dispatched: outcome("fail", "repair_dispatch"),
    machine_closure_blocked: outcome("blocked", "retry"),
    machine_closure_incomplete: outcome("incomplete", "retry"),
  },
  86: {
    provisional_stop_current: outcome("blocked", "provisional_stop"),
    provisional_stop_resumed: outcome("pass", "unlock"),
  },
  87: {
    release_complete: outcome("pass", "unlock"),
    release_closure_failed_repair_dispatched: outcome("fail", "repair_dispatch"),
    release_closure_blocked: outcome("blocked", "retry"),
    release_closure_incomplete: outcome("incomplete", "retry"),
  },
  88: reviewOutcomes,
  89: reviewOutcomes,
  90: reviewOutcomes,
  91: reviewOutcomes,
  92: reviewOutcomes,
  93: reviewOutcomes,
  94: reviewOutcomes,
  95: reviewOutcomes,
  100: reviewOutcomes,
  101: reviewOutcomes,
  102: { maintainer_decisions_finalized: outcome("incomplete", "adjudicate") },
  103: {
    freeze_complete: outcome("pass", "unlock"),
    truth_verification_failed_repair_dispatched: outcome("fail", "repair_dispatch"),
    truth_verification_blocked: outcome("blocked", "retry"),
    truth_verification_incomplete: outcome("incomplete", "retry"),
    successor_truth_review_required: outcome("incomplete", "successor"),
  },
  104: reviewOutcomes,
  105: {
    activation_approved: outcome("pass", "adjudicate"),
    activation_rejected: outcome("fail", "adjudicate"),
    activation_changes_requested: outcome("incomplete", "adjudicate"),
    activation_invalid: outcome("blocked", "adjudicate"),
  },
  106: {
    precommit_ready: outcome("pass", "unlock"),
    precommit_failed_repair_dispatched: outcome("fail", "repair_dispatch"),
    precommit_blocked: outcome("blocked", "retry"),
    precommit_incomplete: outcome("incomplete", "retry"),
    successor_decision_required: outcome("incomplete", "successor"),
  },
  107: {
    lyrics_applicable: outcome("incomplete", "unlock", "applicable"),
    lyrics_not_applicable: outcome("incomplete", "adjudicate", "not_applicable"),
    lyrics_applicability_blocked: outcome("blocked", "adjudicate", "not_claimed"),
    lyrics_applicability_incomplete: outcome("incomplete", "adjudicate", "not_claimed"),
  },
});

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, expected, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${context} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!isDeepStrictEqual(actual, wanted)) {
    fail(`${context} keys must be exactly ${wanted.join(", ")}`);
  }
}

function positiveInteger(value, context) {
  if (!Number.isInteger(value) || value < 1) fail(`${context} must be a positive integer`);
}

function digest(value, context) {
  if (!DIGEST_PATTERN.test(value ?? "")) fail(`${context} must be a SHA-256 digest`);
}

function sortedUnique(values, context, predicate = () => true) {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    new Set(values).size !== values.length ||
    !isDeepStrictEqual(values, [...values].sort()) ||
    values.some((value) => !predicate(value))
  ) {
    fail(`${context} must be a nonempty sorted unique closed set`);
  }
}

function generationReference(value, context) {
  exactKeys(value, ["generation", "tracerId"], context);
  positiveInteger(value.tracerId, `${context}.tracerId`);
  positiveInteger(value.generation, `${context}.generation`);
}

export function resultContractFor(tracerId, resultCode) {
  const tracerContract = TRACER_RESULT_CONTRACTS[tracerId];
  if (!tracerContract) fail(`T${tracerId} has no closed result contract`);
  const resultContract = tracerContract[resultCode];
  if (!resultContract) fail(`T${tracerId} has no result code ${String(resultCode)}`);
  return resultContract;
}

export function validateResultDisposition(receipt) {
  exactKeys(
    receipt,
    [
      "applicability",
      "dispatchCount",
      "disposition",
      "productAcceptance",
      "resultCode",
      "tracerId",
    ],
    "result receipt"
  );
  positiveInteger(receipt.tracerId, "result receipt.tracerId");
  if (!Number.isInteger(receipt.dispatchCount) || receipt.dispatchCount < 0) {
    fail("result receipt.dispatchCount must be a nonnegative integer");
  }
  const contract = resultContractFor(receipt.tracerId, receipt.resultCode);
  for (const key of ["applicability", "disposition", "productAcceptance"]) {
    if (receipt[key] !== contract[key]) {
      fail(`T${receipt.tracerId} ${receipt.resultCode} has contradictory ${key}`);
    }
  }
  if (contract.dispatchPolicy === "required" && receipt.dispatchCount === 0) {
    fail(`T${receipt.tracerId} ${receipt.resultCode} requires a remediation dispatch`);
  }
  if (contract.dispatchPolicy === "forbidden" && receipt.dispatchCount !== 0) {
    fail(`T${receipt.tracerId} ${receipt.resultCode} forbids remediation dispatches`);
  }
  if (
    (receipt.productAcceptance === "pass" ||
      receipt.disposition === "retry" ||
      receipt.disposition === "successor") &&
    receipt.dispatchCount !== 0
  ) {
    fail("pass, retry, and successor outcomes cannot carry remediation dispatches");
  }
  return contract;
}

function validateObligationSource(source) {
  exactKeys(source, ["generation", "resultCode", "tracerId"], "obligation.source");
  positiveInteger(source.tracerId, "obligation.source.tracerId");
  positiveInteger(source.generation, "obligation.source.generation");
  const contract = resultContractFor(source.tracerId, source.resultCode);
  if (contract.disposition !== "repair_dispatch") {
    fail("remediation obligation source must be a repair-dispatch result");
  }
}

function validateInvalidation(edge, source, context) {
  exactKeys(edge, ["reasonCode", "scopes", "source", "target"], context);
  generationReference(edge.source, `${context}.source`);
  generationReference(edge.target, `${context}.target`);
  if (edge.source.tracerId !== source.tracerId || edge.source.generation !== source.generation) {
    fail(`${context}.source must be the exact dispatcher generation`);
  }
  if (!STATE_EDGE_REASON_CODE_SET.has(edge.reasonCode)) {
    fail(`${context}.reasonCode must be a closed state-edge reason code`);
  }
  sortedUnique(edge.scopes, `${context}.scopes`, (scope) => INVALIDATION_SCOPES.has(scope));
}

export function validateRemediationObligation(obligation, expected = {}) {
  exactKeys(
    obligation,
    [
      "affectedClauseIds",
      "closureTargets",
      "expectedAllocation",
      "findingId",
      "inheritedCommitment",
      "invalidatesMachineComplete",
      "invalidationScopes",
      "invalidations",
      "obligationId",
      "rejoinAt",
      "repairContract",
      "repairDefinitionDigest",
      "schemaId",
      "source",
      "transfersFrom",
    ],
    "remediation obligation"
  );
  if (obligation.schemaId !== REMEDIATION_OBLIGATION_SCHEMA_ID) {
    fail("remediation obligation has the wrong schemaId");
  }
  for (const [key, value] of [
    ["obligationId", obligation.obligationId],
    ["findingId", obligation.findingId],
  ]) {
    if (!IDENTIFIER_PATTERN.test(value ?? "")) fail(`remediation obligation.${key} is invalid`);
  }
  if (
    obligation.transfersFrom !== null &&
    !IDENTIFIER_PATTERN.test(obligation.transfersFrom ?? "")
  ) {
    fail("remediation obligation.transfersFrom is invalid");
  }
  validateObligationSource(obligation.source);
  exactKeys(
    obligation.expectedAllocation,
    ["registryHead", "tracerId"],
    "obligation.expectedAllocation"
  );
  positiveInteger(obligation.expectedAllocation.tracerId, "expected allocation tracerId");
  digest(obligation.expectedAllocation.registryHead, "expected allocation registryHead");
  if (
    expected.expectedNextTracerId !== undefined &&
    obligation.expectedAllocation.tracerId !== expected.expectedNextTracerId
  ) {
    fail("remediation obligation does not reserve the exact next tracer ID");
  }
  if (
    expected.registryHead !== undefined &&
    obligation.expectedAllocation.registryHead !== expected.registryHead
  ) {
    fail("remediation obligation does not bind the current registry head");
  }
  digest(obligation.repairDefinitionDigest, "repairDefinitionDigest");
  exactKeys(obligation.repairContract, ["completionSemantics", "type"], "repairContract");
  if (
    obligation.repairContract.type !== "AFK" ||
    obligation.repairContract.completionSemantics !== "implementation-pass"
  ) {
    fail("repairContract must be AFK implementation-pass");
  }
  sortedUnique(obligation.affectedClauseIds, "affectedClauseIds", (id) =>
    CLAUSE_ID_PATTERN.test(id)
  );
  exactKeys(
    obligation.inheritedCommitment,
    ["regressionLedgerHead", "reserveCursorCommitment"],
    "inheritedCommitment"
  );
  digest(obligation.inheritedCommitment.regressionLedgerHead, "regressionLedgerHead");
  digest(obligation.inheritedCommitment.reserveCursorCommitment, "reserveCursorCommitment");
  if (!Array.isArray(obligation.invalidations) || obligation.invalidations.length === 0) {
    fail("remediation obligation requires actual invalidation edges");
  }
  const invalidationTargets = new Set();
  obligation.invalidations.forEach((edge, index) => {
    const context = `invalidations[${index}]`;
    validateInvalidation(edge, obligation.source, context);
    const targetKey = `${edge.target.tracerId}:${edge.target.generation}`;
    if (invalidationTargets.has(targetKey)) {
      fail(`${context}.target duplicates an existing invalidation target`);
    }
    invalidationTargets.add(targetKey);
  });
  const derivedScopes = [
    ...new Set(obligation.invalidations.flatMap((edge) => edge.scopes)),
  ].sort();
  sortedUnique(obligation.invalidationScopes, "invalidationScopes", (scope) =>
    INVALIDATION_SCOPES.has(scope)
  );
  if (!isDeepStrictEqual(obligation.invalidationScopes, derivedScopes)) {
    fail("invalidationScopes must be derived from the actual invalidation edges");
  }
  if (!obligation.invalidationScopes.includes("release_closure")) {
    fail("every remediation obligation must invalidate release closure");
  }
  const derivedMachineImpact = derivedScopes.includes("machine_closure");
  if (obligation.invalidatesMachineComplete !== derivedMachineImpact) {
    fail("invalidatesMachineComplete must be derived from actual invalidation scopes");
  }
  generationReference(obligation.rejoinAt, "rejoinAt");
  if ([85, 87, obligation.expectedAllocation.tracerId].includes(obligation.rejoinAt.tracerId)) {
    fail("rejoinAt must name a different non-closure tracer");
  }
  if (!Array.isArray(obligation.closureTargets) || obligation.closureTargets.length === 0) {
    fail("remediation obligation requires closure targets");
  }
  obligation.closureTargets.forEach((target, index) =>
    generationReference(target, `closureTargets[${index}]`)
  );
  const closureIds = obligation.closureTargets.map((target) => target.tracerId);
  if (
    new Set(closureIds).size !== closureIds.length ||
    !isDeepStrictEqual(
      closureIds,
      [...closureIds].sort((left, right) => left - right)
    ) ||
    closureIds.some((id) => ![85, 87].includes(id)) ||
    !closureIds.includes(87) ||
    closureIds.includes(85) !== derivedMachineImpact
  ) {
    fail("closureTargets must include T87 and T85 exactly for Machine-impacting scope");
  }
  return obligation;
}

const TRANSFER_SEMANTIC_KEYS = [
  "affectedClauseIds",
  "closureTargets",
  "findingId",
  "inheritedCommitment",
  "invalidatesMachineComplete",
  "invalidationScopes",
  "invalidations",
  "rejoinAt",
  "source",
];

function transferPayload(obligation) {
  return Object.fromEntries(TRANSFER_SEMANTIC_KEYS.map((key) => [key, obligation[key]]));
}

function appendOnlyPrefix(previous, current, context) {
  if (previous.length > current.length) fail(`${context} cannot shrink`);
  previous.forEach((entry, index) => {
    if (!isDeepStrictEqual(entry, current[index])) fail(`${context} must be append-only`);
  });
}

/** Validate immutable obligation contracts and their append-only lifecycle. */
export function validateRemediationObligationLedger(ledger, options = {}) {
  exactKeys(ledger, ["events", "obligations", "schemaId"], "remediation ledger");
  if (ledger.schemaId !== REMEDIATION_LEDGER_SCHEMA_ID)
    fail("remediation ledger schemaId is invalid");
  if (!Array.isArray(ledger.obligations) || !Array.isArray(ledger.events)) {
    fail("remediation ledger obligations/events must be arrays");
  }
  if (options.previousLedger) {
    appendOnlyPrefix(options.previousLedger.obligations, ledger.obligations, "obligations");
    appendOnlyPrefix(options.previousLedger.events, ledger.events, "events");
  }

  const obligations = new Map();
  const obligationIndexes = new Map();
  ledger.obligations.forEach((obligation, index) => {
    validateRemediationObligation(obligation, {
      expectedNextTracerId:
        options.initialNextTracerId === undefined ? undefined : options.initialNextTracerId + index,
      registryHead: index === 0 ? options.initialRegistryHead : undefined,
    });
    if (obligations.has(obligation.obligationId)) fail("duplicate remediation obligation ID");
    if (
      index > 0 &&
      obligation.expectedAllocation.tracerId !==
        ledger.obligations[index - 1].expectedAllocation.tracerId + 1
    ) {
      fail("remediation obligation allocations must use contiguous append-only IDs");
    }
    obligations.set(obligation.obligationId, obligation);
    obligationIndexes.set(obligation.obligationId, index);
  });

  const transferSuccessors = new Map();
  for (const [obligationId, obligation] of obligations) {
    if (obligation.transfersFrom === null) continue;
    const source = obligations.get(obligation.transfersFrom);
    if (
      !source ||
      obligation.transfersFrom === obligationId ||
      obligationIndexes.get(obligation.transfersFrom) >= obligationIndexes.get(obligationId)
    ) {
      fail("a transferred obligation must name an earlier registered source contract");
    }
    if (transferSuccessors.has(obligation.transfersFrom)) {
      fail("an obligation can have only one immutable transfer successor");
    }
    transferSuccessors.set(obligation.transfersFrom, obligationId);
  }

  const registered = new Map();
  const attempts = new Map();
  const discharged = new Set();
  const transferred = new Map();
  const tombstoned = new Set();
  const terminalTransitions = new Map();
  for (const [index, event] of ledger.events.entries()) {
    if (event?.sequence !== index + 1) fail("remediation event sequence must be contiguous");
    const obligation = obligations.get(event?.obligationId);
    if (!obligation) fail("remediation event references an unknown obligation");

    if (event.type === "registered") {
      exactKeys(
        event,
        [
          "definitionDigest",
          "obligationId",
          "registryHeadAfter",
          "registryHeadBefore",
          "sequence",
          "tracerId",
          "type",
        ],
        "registered event"
      );
      if (registered.has(event.obligationId)) fail("an obligation can be registered only once");
      positiveInteger(event.tracerId, "registered event tracerId");
      digest(event.definitionDigest, "registered event definitionDigest");
      digest(event.registryHeadBefore, "registered event registryHeadBefore");
      digest(event.registryHeadAfter, "registered event registryHeadAfter");
      if (
        event.tracerId !== obligation.expectedAllocation.tracerId ||
        event.definitionDigest !== obligation.repairDefinitionDigest ||
        event.registryHeadBefore !== obligation.expectedAllocation.registryHead ||
        event.registryHeadAfter === event.registryHeadBefore
      ) {
        fail("registered event does not consume its exact allocation contract");
      }
      const prior = ledger.obligations[ledger.obligations.indexOf(obligation) - 1];
      if (prior) {
        const priorRegistration = registered.get(prior.obligationId);
        if (
          !priorRegistration ||
          event.registryHeadBefore !== priorRegistration.registryHeadAfter
        ) {
          fail("registered obligations must form one registry-head chain");
        }
      }
      registered.set(event.obligationId, event);
    } else if (event.type === "attempted") {
      exactKeys(
        event,
        ["obligationId", "outcome", "repair", "sequence", "type"],
        "attempted event"
      );
      generationReference(event.repair, "attempted event repair");
      if (
        !registered.has(event.obligationId) ||
        tombstoned.has(event.obligationId) ||
        transferred.has(event.obligationId) ||
        discharged.has(event.obligationId) ||
        (obligation.transfersFrom !== null &&
          transferred.get(obligation.transfersFrom) !== event.obligationId) ||
        event.repair.tracerId !== obligation.expectedAllocation.tracerId ||
        !ATTEMPT_OUTCOMES.has(event.outcome)
      ) {
        fail("attempt does not consume a live registered obligation");
      }
      const priorAttempts = attempts.get(event.obligationId) ?? [];
      if (
        priorAttempts.length > 0 &&
        event.repair.generation <= priorAttempts.at(-1).repair.generation
      ) {
        fail("repair retries must append increasing generations to the same obligation");
      }
      priorAttempts.push(event);
      attempts.set(event.obligationId, priorAttempts);
    } else if (event.type === "discharged") {
      exactKeys(
        event,
        ["closures", "obligationId", "repair", "sequence", "type"],
        "discharged event"
      );
      generationReference(event.repair, "discharged event repair");
      if (!Array.isArray(event.closures)) fail("discharged event closures must be an array");
      event.closures.forEach((target, targetIndex) =>
        generationReference(target, `discharged event closures[${targetIndex}]`)
      );
      const passingAttempt = (attempts.get(event.obligationId) ?? []).some(
        (attempt) => attempt.outcome === "pass" && isDeepStrictEqual(attempt.repair, event.repair)
      );
      const closureIds = event.closures.map((target) => target.tracerId);
      if (
        !passingAttempt ||
        discharged.has(event.obligationId) ||
        transferred.has(event.obligationId) ||
        tombstoned.has(event.obligationId) ||
        terminalTransitions.has(event.obligationId) ||
        !isDeepStrictEqual(
          closureIds,
          obligation.closureTargets.map((target) => target.tracerId)
        ) ||
        event.closures.some((target, targetIndex) => {
          const reserved = obligation.closureTargets[targetIndex];
          return target.generation < reserved.generation;
        })
      ) {
        fail("discharge must bind a passing repair and every reserved closure target");
      }
      discharged.add(event.obligationId);
      terminalTransitions.set(event.obligationId, event);
    } else if (event.type === "transferred") {
      exactKeys(
        event,
        ["obligationId", "reasonCode", "sequence", "toObligationId", "type"],
        "transferred event"
      );
      const target = obligations.get(event.toObligationId);
      if (
        !target ||
        !IDENTIFIER_PATTERN.test(event.reasonCode ?? "") ||
        !registered.has(event.obligationId) ||
        discharged.has(event.obligationId) ||
        transferred.has(event.obligationId) ||
        tombstoned.has(event.obligationId) ||
        terminalTransitions.has(event.obligationId) ||
        (obligation.transfersFrom !== null &&
          transferred.get(obligation.transfersFrom) !== event.obligationId) ||
        !registered.has(event.toObligationId) ||
        discharged.has(event.toObligationId) ||
        transferred.has(event.toObligationId) ||
        tombstoned.has(event.toObligationId) ||
        terminalTransitions.has(event.toObligationId) ||
        (attempts.get(event.toObligationId) ?? []).length !== 0 ||
        target.transfersFrom !== event.obligationId ||
        transferSuccessors.get(event.obligationId) !== event.toObligationId ||
        !isDeepStrictEqual(transferPayload(obligation), transferPayload(target))
      ) {
        fail("transfer must preserve the unresolved obligation in a registered successor");
      }
      transferred.set(event.obligationId, event.toObligationId);
      terminalTransitions.set(event.obligationId, event);
    } else if (event.type === "tombstoned") {
      exactKeys(
        event,
        ["obligationId", "sequence", "tracerId", "transferToObligationId", "type"],
        "tombstoned event"
      );
      const transferTarget = transferred.get(event.obligationId) ?? null;
      if (
        !registered.has(event.obligationId) ||
        tombstoned.has(event.obligationId) ||
        event.tracerId !== obligation.expectedAllocation.tracerId ||
        (discharged.has(event.obligationId)
          ? event.transferToObligationId !== null
          : transferTarget === null || event.transferToObligationId !== transferTarget)
      ) {
        fail("tombstone cannot erase an unresolved remediation obligation");
      }
      tombstoned.add(event.obligationId);
    } else {
      fail(`unknown remediation event type ${String(event.type)}`);
    }
  }

  for (const obligation of obligations.values()) {
    if (
      obligation.transfersFrom !== null &&
      transferred.get(obligation.transfersFrom) !== obligation.obligationId
    ) {
      fail("transferred obligation lacks its append-only transfer event");
    }
  }

  const unresolved = new Set();
  for (const obligationId of obligations.keys()) {
    let terminal = obligationId;
    const seen = new Set();
    while (transferred.has(terminal)) {
      if (seen.has(terminal)) fail("remediation obligation transfer cycle");
      seen.add(terminal);
      terminal = transferred.get(terminal);
    }
    if (!discharged.has(terminal)) unresolved.add(terminal);
  }
  return { unresolvedObligationIds: [...unresolved].sort() };
}
