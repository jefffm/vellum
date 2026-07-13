import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  ConstraintSpecificationSchema,
  EvaluatorConclusionSchema,
  SearchAdapterDeclarationSchema,
  SearchCheckpointSchema,
  SearchOutcomeSchema,
  assertCheckpointCompatible,
  decodeCapabilityDeclaration,
  decodeConstraintSpecification,
  decodeEvaluatorConclusion,
  decodeSearchOutcome,
  decodeSearchAdapterDeclaration,
  searchOutcomeDescription,
  type SearchExecutionIdentity,
} from "./constraint-search.js";

const digest = (character: string) => character.repeat(64);

const executionIdentity: SearchExecutionIdentity = {
  digest: digest("a"),
  adapter: { id: "adapter.plucked-string", version: "1.0.0", digest: digest("b") },
  compiler: { id: "compiler.constraints", version: "1.0.0", digest: digest("c") },
  evaluators: [{ id: "evaluator.mechanics", version: "1.0.0", digest: digest("d") }],
  profiles: [],
  capabilities: [{ id: "capability.positions", version: "1", digest: digest("2") }],
  knowledgePacks: [],
  dependencies: [{ id: "dependency.search", version: "1", digest: digest("3") }],
  arrangementPlanId: "plan.1",
  performanceBriefId: "performance-brief.1",
  targetConfigurationId: "target.1",
  constraintDigests: [digest("e")],
  attemptConfigurationDigest: digest("f"),
  orderingDigest: digest("4"),
  pruningDigest: digest("5"),
  seed: 0,
};

const constraint = {
  id: "constraint.principal-voice",
  schemaVersion: 1,
  evaluatorId: "evaluator.preservation",
  evaluatorVersion: "1.0.0",
  scope: {
    kind: "voice" as const,
    targetConfigurationId: "target.1",
    subjectIds: ["voice.soprano"],
  },
  parameters: { minimumCoverage: 1, allowOctaveDisplacement: false },
  provenance: {
    kind: "preservation_target" as const,
    sourceRecordId: "preservation-target.1",
    evidenceIds: ["analysis.1"],
    observationDigest: digest("1"),
  },
  enforcement: {
    rejection: "reject" as const,
    comparisonPriority: 0,
    exceptionPolicy: "policy_exception_required" as const,
    confirmationPolicy: "none" as const,
    rationale: "The designated Principal Voice must remain recognizable.",
    evaluationPhase: "both" as const,
  },
  applicability: {
    status: "applicable" as const,
    rationale: "The Analysis identifies a Principal Voice.",
    requiredCapabilityIds: ["capability.polyphonic-voice-duration"],
  },
  compilerIdentity: {
    id: "compiler.constraints",
    version: "1.0.0",
    digest: digest("c"),
  },
};

describe("constraint and search protocol", () => {
  it("round-trips versioned, scoped, provenance-bearing constraints as JSON data", () => {
    expect(decodeConstraintSpecification(JSON.parse(JSON.stringify(constraint)))).toEqual(
      constraint
    );
    expect(Value.Check(ConstraintSpecificationSchema, constraint)).toBe(true);
    expect(() =>
      decodeConstraintSpecification({
        ...constraint,
        parameters: { executable: () => true },
      })
    ).toThrow(/JSON-serializable/);
  });

  it("keeps observation identity stable when policy changes enforcement", () => {
    const adapted = {
      ...constraint,
      enforcement: {
        ...constraint.enforcement,
        rejection: "retain_with_penalty" as const,
        comparisonPriority: 3,
      },
    };
    expect(decodeConstraintSpecification(adapted).provenance.observationDigest).toBe(
      constraint.provenance.observationDigest
    );
  });

  it("represents evaluator epistemics as independent dimensions", () => {
    const conclusion = {
      constraintId: constraint.id,
      modeledProperty: "principal voice pitch-class and contour preservation",
      result: "pass",
      completeness: "bounded",
      evidenceBasis: ["source_derived", "analytical"],
      authority: "system_derived",
      presentation: "audited",
      evidenceIds: ["audit.1"],
      rationale: "All modeled source events were compared.",
    };
    expect(decodeEvaluatorConclusion(conclusion)).toEqual(conclusion);
    expect(() => decodeEvaluatorConclusion({ ...conclusion, presentation: "certified" })).toThrow(
      /requires complete evidence/
    );
  });

  it.each([
    {
      kind: "candidate_found",
      executionIdentity,
      diagnosticEvidenceIds: ["diagnostic.1"],
      candidateIds: ["candidate.1"],
      selectedCandidateId: "candidate.1",
    },
    {
      kind: "search_exhausted",
      executionIdentity,
      diagnosticEvidenceIds: ["frontier.1"],
      reason: "Configured state budget was reached",
    },
    {
      kind: "blocked_by_uncertainty",
      executionIdentity,
      diagnosticEvidenceIds: [],
      uncertaintyIds: ["uncertainty.1"],
      reason: "Principal Voice identity is unresolved",
    },
    {
      kind: "cancelled",
      executionIdentity,
      diagnosticEvidenceIds: [],
      reason: "Owner cancelled the attempt",
    },
    {
      kind: "failed",
      executionIdentity,
      diagnosticEvidenceIds: [],
      errorCode: "adapter_failure",
      message: "Adapter terminated unexpectedly",
      retryable: true,
    },
  ])("round-trips the $kind Search Outcome", (outcome) => {
    expect(decodeSearchOutcome(outcome)).toEqual(outcome);
  });

  it("allows impossible wording only for certified exhaustive infeasibility", () => {
    const exhaustive = {
      kind: "exhaustively_infeasible" as const,
      executionIdentity,
      diagnosticEvidenceIds: ["rejections.1"],
      certificate: {
        schemaVersion: 1,
        executionIdentity,
        finiteModeledUniverse: "All assignments over two events and three positions",
        completeSuccessorRule: "Enumerate every position for each event in score order",
        evaluatedConstraintIds: [constraint.id],
        omittedDimensions: ["subjective comfort"],
        pruningRules: ["Reject only proven hard constraint failures"],
        stateMergingRationale: "No state merging is performed",
        stateMergingEvidenceIds: ["differential-test.1"],
      },
    };
    expect(decodeSearchOutcome(exhaustive)).toEqual(exhaustive);
    expect(searchOutcomeDescription(exhaustive)).toMatch(/^Impossible/);
    expect(
      searchOutcomeDescription({
        kind: "search_exhausted",
        executionIdentity,
        diagnosticEvidenceIds: [],
        reason: "Heuristic frontier limit reached",
      })
    ).not.toMatch(/impossible/i);
  });

  it("rejects certificates and checkpoints from another exact execution", () => {
    const otherIdentity = { ...executionIdentity, digest: digest("9") };
    const checkpoint = {
      schemaVersion: 1,
      executionIdentity,
      expandedStates: 4,
      frontier: [{ stateId: "state.4" }],
      adapterState: { previousCourse: 3 },
      createdAt: "2026-07-12T20:00:00.000Z",
    };
    expect(Value.Check(SearchCheckpointSchema, checkpoint)).toBe(true);
    expect(() => assertCheckpointCompatible(checkpoint, otherIdentity)).toThrow(/incompatible/);
    expect(() =>
      assertCheckpointCompatible(checkpoint, {
        ...executionIdentity,
        adapter: { ...executionIdentity.adapter, version: "tampered-without-digest-change" },
      })
    ).toThrow(/incompatible/);
    expect(() =>
      decodeSearchOutcome({
        kind: "cancelled",
        executionIdentity: otherIdentity,
        diagnosticEvidenceIds: [],
        reason: "cancelled",
        checkpoint,
      })
    ).toThrow(/does not match/);
  });

  it("declares adapter applicability and state identity without a universal musical state", () => {
    const base = {
      identity: { id: "adapter.baroque-guitar", version: "1", digest: digest("8") },
      supportedInstrumentProfileIds: ["baroque-guitar-5"],
      supportedTextures: ["homophony"],
      supportedPlanKinds: ["sectional_reduction"],
      performanceBriefApplicability: ["solo plucked-string performance"],
      stateSchemaId: "state.baroque-guitar",
      stateSchemaVersion: 1,
      equivalenceRelation: "Same event index, sounding pitches, held courses, and occupied fingers",
      dominanceRelation: "No worse hard evidence and strictly lower transition cost",
      stateMerging: {
        kind: "sufficient_relation" as const,
        rationale: "Equivalent states retain every future-relevant property.",
        evidenceIds: [
          "evidence.exhaustive-small-space",
          "evidence.property",
          "evidence.adversarial",
        ],
      },
      completenessClaim: "bounded_only",
    };
    expect(Value.Check(SearchAdapterDeclarationSchema, base)).toBe(true);
    expect(
      Value.Check(SearchAdapterDeclarationSchema, {
        ...base,
        identity: { id: "adapter.continuo", version: "1", digest: digest("7") },
        stateSchemaId: "state.continuo-realization",
        supportedInstrumentProfileIds: ["piano"],
        supportedTextures: ["continuo"],
        supportedPlanKinds: ["continuo_realization"],
      })
    ).toBe(true);
    expect(decodeSearchAdapterDeclaration(base)).toEqual(base);
    expect(() =>
      decodeSearchAdapterDeclaration({
        ...base,
        stateMerging: { kind: "heuristic", rationale: "Approximate beam key", evidenceIds: [] },
        completenessClaim: "exhaustive_when_certified",
      })
    ).toThrow(/Heuristic state merging/);
  });

  it("requires capabilities to declare data, evaluators, evidence vocabulary, and compatibility", () => {
    const capability = {
      identity: { id: "capability.positions", version: "1", digest: digest("2") },
      dataSchemaId: "schema.positions",
      dataSchemaVersion: 1,
      evaluatorIdentities: [{ id: "evaluator.mechanics", version: "1.0.0", digest: digest("d") }],
      evidenceVocabulary: ["course_collision", "hand_span"],
      compatibleCapabilityIds: ["capability.french-tab"],
      incompatibleCapabilityIds: ["capability.keyboard-only"],
    };
    expect(decodeCapabilityDeclaration(capability)).toEqual(capability);
    expect(() =>
      decodeCapabilityDeclaration({
        ...capability,
        incompatibleCapabilityIds: ["capability.french-tab"],
      })
    ).toThrow(/contradicts/);
  });

  it("does not accept an uncertified exhaustive outcome", () => {
    expect(
      Value.Check(SearchOutcomeSchema, {
        kind: "exhaustively_infeasible",
        executionIdentity,
        diagnosticEvidenceIds: [],
      })
    ).toBe(false);
  });
});
