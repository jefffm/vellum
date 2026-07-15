import { describe, expect, it } from "vitest";
import {
  REMEDIATION_LEDGER_SCHEMA_ID,
  REMEDIATION_OBLIGATION_SCHEMA_ID,
  STATE_EDGE_REASON_CODES,
  TRACER_RESULT_CONTRACTS,
  validateRemediationObligation,
  validateRemediationObligationLedger,
  validateResultDisposition,
} from "../../scripts/lib/instrument-intelligence-results.mjs";

const hash = (character: string) => character.repeat(64);

function obligation(overrides: Record<string, unknown> = {}) {
  const source = {
    tracerId: 87,
    generation: 1,
    resultCode: "release_closure_failed_repair_dispatched",
  };
  return {
    schemaId: REMEDIATION_OBLIGATION_SCHEMA_ID,
    obligationId: "obligation_release_one",
    findingId: "finding_release_one",
    transfersFrom: null,
    source,
    expectedAllocation: { tracerId: 108, registryHead: hash("a") },
    repairDefinitionDigest: hash("d"),
    repairContract: { type: "AFK", completionSemantics: "implementation-pass" },
    affectedClauseIds: ["II-CLAUSE-0001"],
    inheritedCommitment: {
      regressionLedgerHead: hash("e"),
      reserveCursorCommitment: hash("f"),
    },
    invalidations: [
      {
        source: { tracerId: 87, generation: 1 },
        target: { tracerId: 69, generation: 1 },
        reasonCode: "review_finding",
        scopes: ["evidence", "release_closure"],
      },
    ],
    invalidationScopes: ["evidence", "release_closure"],
    invalidatesMachineComplete: false,
    rejoinAt: { tracerId: 69, generation: 2 },
    closureTargets: [{ tracerId: 87, generation: 2 }],
    ...overrides,
  };
}

function registration(
  obligationId = "obligation_release_one",
  tracerId = 108,
  before = hash("a"),
  after = hash("b"),
  definitionDigest = hash("d"),
  sequence = 1
) {
  return {
    sequence,
    type: "registered",
    obligationId,
    tracerId,
    definitionDigest,
    registryHeadBefore: before,
    registryHeadAfter: after,
  };
}

describe("closed tracer result/disposition contract", () => {
  it("covers every late-flow tracer named by T01", () => {
    expect(Object.keys(TRACER_RESULT_CONTRACTS).map(Number)).toEqual([
      63, 64, 65, 66, 67, 68, 69, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 100,
      101, 102, 103, 104, 105, 106, 107,
    ]);
  });

  it("accepts every exact code only with its correlated state and disposition", () => {
    for (const [tracerId, results] of Object.entries(TRACER_RESULT_CONTRACTS)) {
      for (const [resultCode, contract] of Object.entries(results)) {
        expect(
          validateResultDisposition({
            tracerId: Number(tracerId),
            resultCode,
            productAcceptance: contract.productAcceptance,
            applicability: contract.applicability,
            disposition: contract.disposition,
            dispatchCount: contract.dispatchPolicy === "required" ? 1 : 0,
          })
        ).toBe(contract);
      }
    }
  });

  it("assigns an explicit closed applicability value to every result code", () => {
    const applicabilityValues = Object.values(TRACER_RESULT_CONTRACTS).flatMap((results) =>
      Object.values(results).map((contract) => contract.applicability)
    );
    expect(new Set(applicabilityValues)).toEqual(
      new Set(["applicable", "not_applicable", "not_claimed"])
    );
    expect(applicabilityValues.every((value) => typeof value === "string")).toBe(true);
  });

  it.each([
    [85, "machine_complete", "pass", "unlock"],
    [85, "machine_closure_blocked", "blocked", "retry"],
    [87, "release_closure_incomplete", "incomplete", "retry"],
    [103, "successor_truth_review_required", "incomplete", "successor"],
  ])("forbids a dispatch for T%i %s", (tracerId, resultCode, acceptance, disposition) => {
    expect(() =>
      validateResultDisposition({
        tracerId,
        resultCode,
        productAcceptance: acceptance,
        applicability: "applicable",
        disposition,
        dispatchCount: 1,
      })
    ).toThrow(/forbids remediation dispatches/);
  });

  it("requires a nonempty dispatch for a repair-dispatched failure", () => {
    expect(() =>
      validateResultDisposition({
        tracerId: 87,
        resultCode: "release_closure_failed_repair_dispatched",
        productAcceptance: "fail",
        applicability: "applicable",
        disposition: "repair_dispatch",
        dispatchCount: 0,
      })
    ).toThrow(/requires a remediation dispatch/);
    expect(() =>
      validateResultDisposition({
        tracerId: 87,
        resultCode: "release_closure_failed_repair_dispatched",
        productAcceptance: "fail",
        applicability: "applicable",
        disposition: "repair_dispatch",
        dispatchCount: 2,
      })
    ).not.toThrow();
  });

  it("keeps applicability distinct from acceptance and rejects unknown result codes", () => {
    expect(
      validateResultDisposition({
        tracerId: 107,
        resultCode: "lyrics_not_applicable",
        productAcceptance: "incomplete",
        applicability: "not_applicable",
        disposition: "adjudicate",
        dispatchCount: 0,
      }).productAcceptance
    ).toBe("incomplete");
    expect(() =>
      validateResultDisposition({
        tracerId: 69,
        resultCode: "review_round_passed_typo",
        productAcceptance: "pass",
        applicability: "applicable",
        disposition: "unlock",
        dispatchCount: 0,
      })
    ).toThrow(/no result code/);
  });

  it("rejects omitted, null, or contradictory applicability instead of treating it as neutral", () => {
    for (const applicability of [undefined, null, "not_claimed"]) {
      expect(() =>
        validateResultDisposition({
          tracerId: 85,
          resultCode: "machine_complete",
          productAcceptance: "pass",
          applicability,
          disposition: "unlock",
          dispatchCount: 0,
        })
      ).toThrow(/contradictory applicability/);
    }
  });
});

describe("append-only remediation obligations", () => {
  it("accepts release-only invalidation without revoking Machine Complete", () => {
    expect(
      validateRemediationObligation(obligation(), {
        expectedNextTracerId: 108,
        registryHead: hash("a"),
      }).invalidatesMachineComplete
    ).toBe(false);
  });

  it("derives Machine impact and closure targets from actual edges", () => {
    expect(() =>
      validateRemediationObligation(
        obligation({
          invalidatesMachineComplete: true,
          closureTargets: [
            { tracerId: 85, generation: 2 },
            { tracerId: 87, generation: 2 },
          ],
        })
      )
    ).toThrow(/derived from actual invalidation scopes/);

    expect(
      validateRemediationObligation(
        obligation({
          invalidations: [
            {
              source: { tracerId: 87, generation: 1 },
              target: { tracerId: 69, generation: 1 },
              reasonCode: "review_finding",
              scopes: ["evidence", "machine_closure", "release_closure"],
            },
          ],
          invalidationScopes: ["evidence", "machine_closure", "release_closure"],
          invalidatesMachineComplete: true,
          closureTargets: [
            { tracerId: 85, generation: 2 },
            { tracerId: 87, generation: 2 },
          ],
        })
      ).invalidatesMachineComplete
    ).toBe(true);
  });

  it("requires the exact next ID/head and a repair-dispatch source", () => {
    expect(() =>
      validateRemediationObligation(obligation(), { expectedNextTracerId: 109 })
    ).toThrow(/exact next tracer ID/);
    expect(() =>
      validateRemediationObligation(
        obligation({ source: { tracerId: 87, generation: 1, resultCode: "release_complete" } })
      )
    ).toThrow(/repair-dispatch result/);
  });

  it("accepts only the closed execution-state reason vocabulary", () => {
    expect(STATE_EDGE_REASON_CODES).toEqual([
      "definition_changed",
      "evidence_stale",
      "qualification_failure",
      "review_finding",
      "rights_change",
      "repair_rerun",
      "decision_superseded",
      "governed_reassessment",
    ]);

    for (const reasonCode of STATE_EDGE_REASON_CODES) {
      const candidate = obligation();
      candidate.invalidations[0].reasonCode = reasonCode;
      expect(validateRemediationObligation(candidate)).toBe(candidate);
    }

    for (const reasonCode of [undefined, null, "free_form_reason", "REVIEW_FINDING"]) {
      const candidate = obligation();
      (candidate.invalidations[0] as { reasonCode: unknown }).reasonCode = reasonCode;
      expect(() => validateRemediationObligation(candidate)).toThrow(
        /reasonCode must be a closed state-edge reason code/
      );
    }

    const omitted = obligation();
    delete (omitted.invalidations[0] as { reasonCode?: unknown }).reasonCode;
    expect(() => validateRemediationObligation(omitted)).toThrow(/keys must be exactly/);
  });

  it("rejects duplicate invalidation targets even when reason or scope differs", () => {
    const first = obligation().invalidations[0];
    expect(() =>
      validateRemediationObligation(
        obligation({
          invalidations: [
            first,
            {
              source: { tracerId: 87, generation: 1 },
              target: { tracerId: 69, generation: 1 },
              reasonCode: "rights_change",
              scopes: ["issue", "release_closure"],
            },
          ],
          invalidationScopes: ["evidence", "issue", "release_closure"],
        })
      )
    ).toThrow(/duplicates an existing invalidation target/);
  });

  it("preserves exact dispatcher-generation binding on every invalidation edge", () => {
    for (const source of [
      { tracerId: 85, generation: 1 },
      { tracerId: 87, generation: 2 },
    ]) {
      const candidate = obligation();
      candidate.invalidations[0].source = source;
      expect(() => validateRemediationObligation(candidate)).toThrow(
        /source must be the exact dispatcher generation/
      );
    }
  });

  it("requires a one-to-one registration and preserves retries until discharge", () => {
    const openLedger = {
      schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
      obligations: [obligation()],
      events: [
        registration(),
        {
          sequence: 2,
          type: "attempted",
          obligationId: "obligation_release_one",
          repair: { tracerId: 108, generation: 1 },
          outcome: "blocked",
        },
        {
          sequence: 3,
          type: "attempted",
          obligationId: "obligation_release_one",
          repair: { tracerId: 108, generation: 2 },
          outcome: "pass",
        },
      ],
    };
    expect(
      validateRemediationObligationLedger(openLedger, {
        initialNextTracerId: 108,
        initialRegistryHead: hash("a"),
      }).unresolvedObligationIds
    ).toEqual(["obligation_release_one"]);

    const closedLedger = structuredClone(openLedger);
    closedLedger.events.push({
      sequence: 4,
      type: "discharged",
      obligationId: "obligation_release_one",
      repair: { tracerId: 108, generation: 2 },
      closures: [{ tracerId: 87, generation: 2 }],
    });
    expect(
      validateRemediationObligationLedger(closedLedger, { previousLedger: openLedger })
        .unresolvedObligationIds
    ).toEqual([]);
  });

  it("keeps a pre-registered reservation unresolved and rejects attempts after discharge", () => {
    expect(
      validateRemediationObligationLedger({
        schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
        obligations: [obligation()],
        events: [],
      }).unresolvedObligationIds
    ).toEqual(["obligation_release_one"]);

    const illegallyRetried = {
      schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
      obligations: [obligation()],
      events: [
        registration(),
        {
          sequence: 2,
          type: "attempted",
          obligationId: "obligation_release_one",
          repair: { tracerId: 108, generation: 1 },
          outcome: "pass",
        },
        {
          sequence: 3,
          type: "discharged",
          obligationId: "obligation_release_one",
          repair: { tracerId: 108, generation: 1 },
          closures: [{ tracerId: 87, generation: 2 }],
        },
        {
          sequence: 4,
          type: "attempted",
          obligationId: "obligation_release_one",
          repair: { tracerId: 108, generation: 2 },
          outcome: "blocked",
        },
      ],
    };
    expect(() => validateRemediationObligationLedger(illegallyRetried)).toThrow(
      /live registered obligation/
    );
  });

  it("rejects mutation of the append-only prefix", () => {
    const previous = {
      schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
      obligations: [obligation()],
      events: [registration()],
    };
    const changed = structuredClone(previous);
    changed.obligations[0].affectedClauseIds = ["II-CLAUSE-0002"];
    expect(() =>
      validateRemediationObligationLedger(changed, { previousLedger: previous })
    ).toThrow(/obligations must be append-only/);
  });

  it("forbids tombstoning an unresolved repair without an equivalent transfer", () => {
    expect(() =>
      validateRemediationObligationLedger({
        schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
        obligations: [obligation()],
        events: [
          registration(),
          {
            sequence: 2,
            type: "tombstoned",
            obligationId: "obligation_release_one",
            tracerId: 108,
            transferToObligationId: null,
          },
        ],
      })
    ).toThrow(/cannot erase an unresolved/);
  });

  it("allows an equivalent registered transfer while keeping the successor unresolved", () => {
    const successor = obligation({
      obligationId: "obligation_release_two",
      transfersFrom: "obligation_release_one",
      expectedAllocation: { tracerId: 109, registryHead: hash("b") },
      repairDefinitionDigest: hash("c"),
    });
    const ledger = {
      schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
      obligations: [obligation(), successor],
      events: [
        registration(),
        registration("obligation_release_two", 109, hash("b"), hash("c"), hash("c"), 2),
        {
          sequence: 3,
          type: "transferred",
          obligationId: "obligation_release_one",
          toObligationId: "obligation_release_two",
          reasonCode: "definition_superseded",
        },
        {
          sequence: 4,
          type: "tombstoned",
          obligationId: "obligation_release_one",
          tracerId: 108,
          transferToObligationId: "obligation_release_two",
        },
      ],
    };
    expect(validateRemediationObligationLedger(ledger).unresolvedObligationIds).toEqual([
      "obligation_release_two",
    ]);

    const weakened = structuredClone(ledger);
    weakened.obligations[1].affectedClauseIds = ["II-CLAUSE-0002"];
    expect(() => validateRemediationObligationLedger(weakened)).toThrow(/must preserve/);
  });

  it("keeps a transfer successor inactive until its registered source transitions", () => {
    const successor = obligation({
      obligationId: "obligation_release_two",
      transfersFrom: "obligation_release_one",
      expectedAllocation: { tracerId: 109, registryHead: hash("b") },
      repairDefinitionDigest: hash("c"),
    });
    const attemptedBeforeTransfer = {
      schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
      obligations: [obligation(), successor],
      events: [
        registration(),
        registration("obligation_release_two", 109, hash("b"), hash("c"), hash("c"), 2),
        {
          sequence: 3,
          type: "attempted",
          obligationId: "obligation_release_two",
          repair: { tracerId: 109, generation: 1 },
          outcome: "pass",
        },
      ],
    };
    expect(() => validateRemediationObligationLedger(attemptedBeforeTransfer)).toThrow(
      /live registered obligation/
    );

    const unregisteredTransfer = structuredClone(attemptedBeforeTransfer);
    unregisteredTransfer.events = [
      {
        sequence: 1,
        type: "transferred",
        obligationId: "obligation_release_one",
        toObligationId: "obligation_release_two",
        reasonCode: "definition_superseded",
      },
    ];
    expect(() => validateRemediationObligationLedger(unregisteredTransfer)).toThrow(
      /registered successor/
    );

    const secondSuccessor = obligation({
      obligationId: "obligation_release_three",
      transfersFrom: "obligation_release_two",
      expectedAllocation: { tracerId: 110, registryHead: hash("c") },
      repairDefinitionDigest: hash("1"),
    });
    const transferBeforeSourceActivation = {
      schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
      obligations: [obligation(), successor, secondSuccessor],
      events: [
        registration(),
        registration("obligation_release_two", 109, hash("b"), hash("c"), hash("c"), 2),
        registration("obligation_release_three", 110, hash("c"), hash("2"), hash("1"), 3),
        {
          sequence: 4,
          type: "transferred",
          obligationId: "obligation_release_two",
          toObligationId: "obligation_release_three",
          reasonCode: "definition_superseded",
        },
      ],
    };
    expect(() => validateRemediationObligationLedger(transferBeforeSourceActivation)).toThrow(
      /registered successor/
    );
  });

  it("enforces a unique forward successor and mutually exclusive terminal transitions", () => {
    const successor = obligation({
      obligationId: "obligation_release_two",
      transfersFrom: "obligation_release_one",
      expectedAllocation: { tracerId: 109, registryHead: hash("b") },
      repairDefinitionDigest: hash("c"),
    });
    const duplicateSuccessor = obligation({
      obligationId: "obligation_release_three",
      transfersFrom: "obligation_release_one",
      expectedAllocation: { tracerId: 110, registryHead: hash("c") },
      repairDefinitionDigest: hash("1"),
    });
    expect(() =>
      validateRemediationObligationLedger({
        schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
        obligations: [obligation(), successor, duplicateSuccessor],
        events: [],
      })
    ).toThrow(/only one immutable transfer successor/);

    const transferAfterDischarge = {
      schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
      obligations: [obligation(), successor],
      events: [
        registration(),
        registration("obligation_release_two", 109, hash("b"), hash("c"), hash("c"), 2),
        {
          sequence: 3,
          type: "attempted",
          obligationId: "obligation_release_one",
          repair: { tracerId: 108, generation: 1 },
          outcome: "pass",
        },
        {
          sequence: 4,
          type: "discharged",
          obligationId: "obligation_release_one",
          repair: { tracerId: 108, generation: 1 },
          closures: [{ tracerId: 87, generation: 2 }],
        },
        {
          sequence: 5,
          type: "transferred",
          obligationId: "obligation_release_one",
          toObligationId: "obligation_release_two",
          reasonCode: "definition_superseded",
        },
      ],
    };
    expect(() => validateRemediationObligationLedger(transferAfterDischarge)).toThrow(
      /registered successor/
    );

    const dischargeAfterTransfer = structuredClone(transferAfterDischarge);
    dischargeAfterTransfer.events = [
      ...transferAfterDischarge.events.slice(0, 3),
      {
        sequence: 4,
        type: "transferred",
        obligationId: "obligation_release_one",
        toObligationId: "obligation_release_two",
        reasonCode: "definition_superseded",
      },
      {
        sequence: 5,
        type: "discharged",
        obligationId: "obligation_release_one",
        repair: { tracerId: 108, generation: 1 },
        closures: [{ tracerId: 87, generation: 2 }],
      },
    ];
    expect(() => validateRemediationObligationLedger(dischargeAfterTransfer)).toThrow(
      /discharge must bind/
    );

    const attemptedAfterTransfer = structuredClone(transferAfterDischarge);
    attemptedAfterTransfer.events = [
      ...transferAfterDischarge.events.slice(0, 2),
      {
        sequence: 3,
        type: "transferred",
        obligationId: "obligation_release_one",
        toObligationId: "obligation_release_two",
        reasonCode: "definition_superseded",
      },
      {
        sequence: 4,
        type: "attempted",
        obligationId: "obligation_release_one",
        repair: { tracerId: 108, generation: 1 },
        outcome: "blocked",
      },
    ];
    expect(() => validateRemediationObligationLedger(attemptedAfterTransfer)).toThrow(
      /live registered obligation/
    );
  });

  it("treats previously recorded lifecycle transitions as immutable", () => {
    const previous = {
      schemaId: REMEDIATION_LEDGER_SCHEMA_ID,
      obligations: [obligation()],
      events: [
        registration(),
        {
          sequence: 2,
          type: "attempted",
          obligationId: "obligation_release_one",
          repair: { tracerId: 108, generation: 1 },
          outcome: "blocked",
        },
      ],
    };
    const rewritten = structuredClone(previous);
    rewritten.events[1].outcome = "pass";
    expect(() =>
      validateRemediationObligationLedger(rewritten, { previousLedger: previous })
    ).toThrow(/events must be append-only/);
  });
});
