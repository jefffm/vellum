import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { referenceSourceDigest } from "./reference-source-domain.js";

import {
  buildKnowledgeApplicabilityPredicate,
  buildKnowledgeCandidate,
  buildKnowledgeComponentBinding,
  buildKnowledgeComponentMapping,
  buildKnowledgeConstraintDerivation,
  buildKnowledgeEvidenceEdge,
  buildKnowledgePackDraft,
  buildKnowledgePackRelease,
  buildKnowledgeProfile,
  buildKnowledgeReleaseDependency,
  buildKnowledgeSystemIdentitySnapshot,
  buildKnowledgeTestPolicy,
  computeSystemTestOnlyAttestationDigest,
  KnowledgeDependencyRelationSchema,
  KnowledgeEvidenceRoleSchema,
  KnowledgeExternalEvidenceRefSchema,
  knowledgeRef,
  validateKnowledgeCandidate,
  validateKnowledgeDraftGraph,
  validateKnowledgePackDraft,
  validateKnowledgePackRelease,
  validateKnowledgeProfile,
  validateKnowledgeReleaseGraph,
  validateSystemTestOnlyAttestation,
  validateSystemTestOnlyAttestationStructure,
} from "./reviewed-knowledge-contract.js";

const HEX_A = "a".repeat(64);
const HEX_B = "b".repeat(64);
const HEX_C = "c".repeat(64);

const ref = (id: string, digest = HEX_A) => ({ id, digest });
const knowledgeDigest = (domain: string, payload: unknown) =>
  referenceSourceDigest({
    digestDomain: `vellum.reviewed-knowledge.${domain}.v1`,
    payload,
  });

const EMPTY_GRAPH_CONTEXT = { schemaVersion: 1 as const, drafts: [], releases: [] };
const SOURCE_SEGMENT_REF = {
  recordKind: "source_segment_version" as const,
  ...ref("source-segment.mace.page-75.v1", HEX_A),
};
const CITED_EXTRACTION_REF = {
  recordKind: "cited_extraction_version" as const,
  ...ref("cited-extraction.mace.page-75.v1", HEX_B),
};
const MAPPING_PROPOSAL_REF = {
  recordKind: "extraction_proposal" as const,
  ...ref("mapping-proposal.mace.diapasons.v1", HEX_C),
};
const COURSE_13_PROPOSAL_REF = {
  recordKind: "extraction_proposal" as const,
  ...ref("research-proposal.mace.course-13.v1", HEX_A),
};

const MACE_MAPPINGS = [
  { course: 7, sign: "a" },
  { course: 8, sign: "/a" },
  { course: 9, sign: "//a" },
  { course: 10, sign: "///a" },
  { course: 11, sign: "4" },
  { course: 12, sign: "5" },
] as const;

type Candidate = ReturnType<typeof buildKnowledgeCandidate>;
type EvidenceEdge = ReturnType<typeof buildKnowledgeEvidenceEdge>;
type Derivation = ReturnType<typeof buildKnowledgeConstraintDerivation>;
type ComponentMapping = ReturnType<typeof buildKnowledgeComponentMapping>;

function withoutDigest<T extends { readonly digest: string }>(value: T): Omit<T, "digest"> {
  const { digest: _digest, ...core } = value;
  return core;
}

function componentMappingBuildCore(value: ComponentMapping) {
  const { parameters, ...core } = withoutDigest(value);
  return { ...core, parameters: withoutDigest(parameters) };
}

function versionedRef(candidate: Candidate) {
  return {
    ...knowledgeRef(candidate),
    familyId: candidate.familyId,
    version: candidate.version,
  };
}

function buildMaceProfile(input: {
  mappingCandidate: Candidate;
  researchQuestion: Candidate;
  evidenceEdges: EvidenceEdge[];
  derivation: Derivation;
  componentMapping: ComponentMapping;
}) {
  const refsForRole = (role: EvidenceEdge["role"]) =>
    input.evidenceEdges.filter((edge) => edge.role === role).map(knowledgeRef);
  return buildKnowledgeProfile({
    recordKind: "knowledge_profile",
    schemaVersion: 1,
    id: `profile.release.mace-twelve-course.v${input.mappingCandidate.version}`,
    authorityLane: "historical_practice",
    domains: ["notation", "instrument_technique"],
    gatingPredicateRefs: input.mappingCandidate.gatingPredicateRefs,
    informationalPredicateRefs: input.researchQuestion.informationalPredicateRefs,
    assertionRefs: [knowledgeRef(input.mappingCandidate)],
    openQuestionRefs: [knowledgeRef(input.researchQuestion)],
    evidenceEdgeRefs: input.evidenceEdges.map(knowledgeRef),
    evidenceRoleIndex: {
      support: refsForRole("support"),
      qualification: refsForRole("qualification"),
      contradiction: refsForRole("contradiction"),
      supersession: refsForRole("supersession"),
      example: refsForRole("example"),
      counterexample: refsForRole("counterexample"),
      derivation: refsForRole("derivation"),
      unresolved_ambiguity: refsForRole("unresolved_ambiguity"),
    },
    derivationRefs: [knowledgeRef(input.derivation)],
    componentMappingRefs: [knowledgeRef(input.componentMapping)],
    outcomes: {
      permitted: ["render_cited_courses_7_12"],
      preferred: ["preserve_source_sign_identity"],
      discouraged: ["present_editorial_course_13_as_historical"],
      prohibited: ["infer_course_13_sign_by_sequence"],
    },
    expectedObservables: ["courses_7_12_render_with_cited_signs"],
    limitations: ["twelve_course_source_only"],
    unevaluatedDimensions: ["course_13_historical_sign"],
    observedAbsences: [
      {
        role: "counterexample",
        observation: "none_observed",
        scope: "cited_mace_segment_only",
      },
    ],
    coverageLimitations: ["single_cited_segment", "absence_does_not_establish_nonexistence"],
    defaultActivation: "inactive",
  });
}

function completeKnowledgeGraph(
  options: {
    version?: number;
    parents?: Readonly<{ mappingCandidate: Candidate; researchQuestion: Candidate }>;
    retainedParentCandidates?: Candidate[];
    retainedSupersessionEdges?: EvidenceEdge[];
    resourcePolicyDigest?: string;
  } = {}
) {
  const version = options.version ?? 1;
  const mappingPredicate = buildKnowledgeApplicabilityPredicate({
    recordKind: "knowledge_applicability_predicate",
    schemaVersion: 1,
    id: "predicate.release.mace-mapping",
    authorityLane: "historical_practice",
    expression: {
      kind: "mace_twelve_course_notation_scope",
      sourceProfile: "mace-musicks-monument-1676",
      instrumentFamily: "baroque_lute",
      notationSystem: "french_tablature",
      sourceCourseCount: 12,
      firstCoveredCourse: 7,
      lastCoveredCourse: 12,
      course13Disposition: "excluded_unresolved",
    },
    requiredContextFields: [
      "source_profile",
      "source_course_count",
      "notation_system",
      "instrument_family",
    ],
    unknownPolicy: "preserve_unknown",
  });
  const researchPredicate = buildKnowledgeApplicabilityPredicate({
    recordKind: "knowledge_applicability_predicate",
    schemaVersion: 1,
    id: "predicate.release.course-13",
    authorityLane: "historical_practice",
    expression: {
      kind: "course_thirteen_notation_research_scope",
      instrumentFamily: "baroque_lute",
      notationSystem: "french_tablature",
      course: 13,
      historicalSignState: "unresolved",
      inferencePolicy: "no_sequence_extrapolation",
      activationDisposition: "research_only",
    },
    requiredContextFields: ["notation_system", "historical_sign_state", "instrument_family"],
    unknownPolicy: "review_required",
  });
  const mappingCandidate = buildKnowledgeCandidate({
    recordKind: "knowledge_candidate",
    schemaVersion: 1,
    id: `candidate.release.mace-mapping.v${version}`,
    familyId: "candidate-family.release.mace-mapping",
    version,
    parentVersionRef: options.parents ? versionedRef(options.parents.mappingCandidate) : null,
    nodeKind: "assertion",
    authorityLane: "historical_practice",
    domains: ["notation", "instrument_technique"],
    epistemicForm: "descriptive_observation",
    sourceSegmentRefs: [SOURCE_SEGMENT_REF],
    citedExtractionRefs: [CITED_EXTRACTION_REF],
    sourceProposalRefs: [MAPPING_PROPOSAL_REF],
    gatingPredicateRefs: [knowledgeRef(mappingPredicate)],
    informationalPredicateRefs: [],
    proposition: {
      kind: "mace_twelve_course_diapason_mapping",
      sourceProfile: "mace-musicks-monument-1676",
      sourceCourseCount: 12,
      courseMappings: MACE_MAPPINGS,
      numericSymbolsHaveSlashes: false,
      course13Inference: "forbidden",
    },
    reviewState: "proposed",
    activationAllowed: false,
  });
  const researchQuestion = buildKnowledgeCandidate({
    recordKind: "knowledge_candidate",
    schemaVersion: 1,
    id: `candidate.release.course-13-question.v${version}`,
    familyId: "candidate-family.release.course-13-question",
    version,
    parentVersionRef: options.parents ? versionedRef(options.parents.researchQuestion) : null,
    nodeKind: "research_question",
    authorityLane: "historical_practice",
    domains: ["notation"],
    epistemicForm: "unresolved_question",
    sourceSegmentRefs: [SOURCE_SEGMENT_REF],
    citedExtractionRefs: [CITED_EXTRACTION_REF],
    sourceProposalRefs: [COURSE_13_PROPOSAL_REF],
    gatingPredicateRefs: [],
    informationalPredicateRefs: [knowledgeRef(researchPredicate)],
    proposition: {
      kind: "course_thirteen_notation_question",
      course: 13,
      state: "unresolved",
      proposedSign: null,
      forbiddenInference: "sequence_extrapolation",
      activationDisposition: "research_only",
    },
    reviewState: "proposed",
    activationAllowed: false,
  });
  const citedEdge = (input: {
    id: string;
    role: "support" | "qualification" | "example" | "unresolved_ambiguity";
    target: Candidate;
    predicateRef: ReturnType<typeof knowledgeRef>;
    use: "gating" | "informational";
    rationaleCode:
      | "source_directly_supports_mapping"
      | "scope_limited_to_twelve_courses"
      | "source_exemplifies_mapping"
      | "source_does_not_establish_course_13";
  }) =>
    buildKnowledgeEvidenceEdge({
      recordKind: "knowledge_evidence_edge",
      schemaVersion: 1,
      id: input.id,
      authorityLane: "historical_practice",
      source: {
        ref: CITED_EXTRACTION_REF,
        kind: "cited_extraction",
        authorityLane: "historical_practice",
      },
      target: {
        ref: knowledgeRef(input.target),
        nodeKind: input.target.nodeKind,
        authorityLane: "historical_practice",
      },
      role: input.role,
      predicateBinding: { predicateRef: input.predicateRef, use: input.use },
      rationaleCode: input.rationaleCode,
    });
  const support = citedEdge({
    id: `evidence.release.v${version}.support`,
    role: "support",
    target: mappingCandidate,
    predicateRef: knowledgeRef(mappingPredicate),
    use: "gating",
    rationaleCode: "source_directly_supports_mapping",
  });
  const qualification = citedEdge({
    id: `evidence.release.v${version}.qualification`,
    role: "qualification",
    target: mappingCandidate,
    predicateRef: knowledgeRef(mappingPredicate),
    use: "gating",
    rationaleCode: "scope_limited_to_twelve_courses",
  });
  const example = citedEdge({
    id: `evidence.release.v${version}.example`,
    role: "example",
    target: mappingCandidate,
    predicateRef: knowledgeRef(mappingPredicate),
    use: "gating",
    rationaleCode: "source_exemplifies_mapping",
  });
  const unresolved = citedEdge({
    id: `evidence.release.v${version}.unresolved`,
    role: "unresolved_ambiguity",
    target: researchQuestion,
    predicateRef: knowledgeRef(researchPredicate),
    use: "informational",
    rationaleCode: "source_does_not_establish_course_13",
  });
  const derivation = buildKnowledgeConstraintDerivation({
    recordKind: "knowledge_constraint_derivation",
    schemaVersion: 1,
    id: `derivation.release.mace-mapping.v${version}`,
    authorityLane: "historical_practice",
    inputs: [
      {
        ref: knowledgeRef(mappingCandidate),
        kind: "candidate",
        authorityLane: "historical_practice",
      },
      { ref: knowledgeRef(support), kind: "evidence_edge", authorityLane: "historical_practice" },
    ],
    gatingPredicateRefs: [knowledgeRef(mappingPredicate)],
    inferenceRule: "preserve_exact_cited_mapping_without_extrapolation",
    force: "descriptive",
    consequence: {
      kind: "twelve_course_notation_mapping",
      courseMappings: MACE_MAPPINGS,
      course13Consequence: "none_unresolved",
    },
    limitations: ["twelve_course_source_only", "course_13_unresolved"],
    reviewState: "proposed",
  });
  const derivationEdge = buildKnowledgeEvidenceEdge({
    recordKind: "knowledge_evidence_edge",
    schemaVersion: 1,
    id: `evidence.release.v${version}.derivation`,
    authorityLane: "historical_practice",
    source: {
      ref: knowledgeRef(derivation),
      kind: "constraint_derivation",
      authorityLane: "historical_practice",
    },
    target: {
      ref: knowledgeRef(mappingCandidate),
      nodeKind: "assertion",
      authorityLane: "historical_practice",
    },
    role: "derivation",
    predicateBinding: { predicateRef: knowledgeRef(mappingPredicate), use: "gating" },
    rationaleCode: "constraint_derived_from_evidence",
  });
  const currentSupersessionEdges = options.parents
    ? [
        buildKnowledgeEvidenceEdge({
          recordKind: "knowledge_evidence_edge",
          schemaVersion: 1,
          id: `evidence.release.v${version}.supersede-mapping`,
          authorityLane: "historical_practice",
          source: {
            ref: knowledgeRef(mappingCandidate),
            kind: "candidate",
            authorityLane: "historical_practice",
          },
          target: {
            ref: knowledgeRef(options.parents.mappingCandidate),
            nodeKind: "assertion",
            authorityLane: "historical_practice",
          },
          role: "supersession",
          predicateBinding: { predicateRef: knowledgeRef(mappingPredicate), use: "gating" },
          rationaleCode: "later_candidate_supersedes_prior",
        }),
        buildKnowledgeEvidenceEdge({
          recordKind: "knowledge_evidence_edge",
          schemaVersion: 1,
          id: `evidence.release.v${version}.supersede-question`,
          authorityLane: "historical_practice",
          source: {
            ref: knowledgeRef(researchQuestion),
            kind: "candidate",
            authorityLane: "historical_practice",
          },
          target: {
            ref: knowledgeRef(options.parents.researchQuestion),
            nodeKind: "research_question",
            authorityLane: "historical_practice",
          },
          role: "supersession",
          predicateBinding: {
            predicateRef: knowledgeRef(researchPredicate),
            use: "informational",
          },
          rationaleCode: "later_candidate_supersedes_prior",
        }),
      ]
    : [];
  const supersessionEdges = [
    ...currentSupersessionEdges,
    ...(options.retainedSupersessionEdges ?? []),
  ];
  const evidenceEdges = [
    support,
    qualification,
    example,
    unresolved,
    derivationEdge,
    ...supersessionEdges,
  ];
  const component = buildKnowledgeComponentBinding({
    recordKind: "knowledge_component_binding",
    schemaVersion: 1,
    id: `component-binding.release.french-tab-renderer.v${version}`,
    authorityLane: "historical_practice",
    componentRef: ref("component.release.french-tab-renderer", HEX_A),
    artifactRef: ref("artifact.release.french-tab-renderer.v1", HEX_B),
    interfaceRef: ref("interface.release.notation-mapping.v1", HEX_A),
    parameterSchemaRef: ref("parameter-schema.release.mace-signs.v1", HEX_B),
    unitSchemaRef: ref("unit-schema.release.course-and-sign.v1", HEX_A),
    compatibility: {
      contractRef: ref("compatibility.release.notation-mapping.v1", HEX_B),
      minimumInterfaceVersion: 1,
      maximumInterfaceVersion: 1,
    },
    resourcePolicyRef: ref(
      "resource-policy.release.deterministic-small.v1",
      options.resourcePolicyDigest ?? HEX_A
    ),
    replay: {
      state: "available",
      environmentRef: ref("environment.release.vellum-pinned.v1", HEX_B),
      artifactRef: ref("artifact.release.french-tab-renderer.v1", HEX_B),
    },
    dependencyRefs: [],
  });
  const componentMapping = buildKnowledgeComponentMapping({
    recordKind: "knowledge_component_mapping",
    schemaVersion: 1,
    id: `component-mapping.release.mace-signs.v${version}`,
    authorityLane: "historical_practice",
    mappingKind: "notation_component_mapping",
    componentBindingRef: knowledgeRef(component),
    gatingPredicateRefs: [knowledgeRef(mappingPredicate)],
    derivationRefs: [knowledgeRef(derivation)],
    parameters: {
      parameterSchemaRef: ref("parameter-schema.release.mace-signs.v1", HEX_B),
      unitSchemaRef: ref("unit-schema.release.course-and-sign.v1", HEX_A),
      values: {
        sourceCourseCount: 12,
        courseMappings: MACE_MAPPINGS,
        numericSymbolsHaveSlashes: false,
        course13Policy: "unresolved_no_mapping",
      },
    },
    expectedObservable: "courses_7_12_render_with_cited_signs",
    executionDisposition: "declarative_registry_binding",
  });
  const profile = buildMaceProfile({
    mappingCandidate,
    researchQuestion,
    evidenceEdges,
    derivation,
    componentMapping,
  });
  const candidates = [
    mappingCandidate,
    researchQuestion,
    ...(options.parents
      ? (options.retainedParentCandidates ?? [
          options.parents.mappingCandidate,
          options.parents.researchQuestion,
        ])
      : []),
  ];
  const citedEvidenceRefs = [
    ...new Map(
      [
        ...candidates.flatMap((candidate) => candidate.sourceSegmentRefs),
        ...candidates.flatMap((candidate) => candidate.citedExtractionRefs),
        ...candidates.flatMap((candidate) => candidate.sourceProposalRefs),
        ...evidenceEdges.flatMap((edge) =>
          edge.source.kind === "cited_extraction" ? [edge.source.ref] : []
        ),
      ].map((reference) => [`${reference.id}:${reference.digest}`, reference])
    ).values(),
  ];
  const content = {
    citedEvidenceRefs,
    candidates,
    applicabilityPredicates: [mappingPredicate, researchPredicate],
    evidenceEdges,
    constraintDerivations: [derivation],
    componentClosure: [component],
    componentMappings: [componentMapping],
    profiles: [profile],
  };
  return {
    content,
    mappingPredicate,
    researchPredicate,
    mappingCandidate,
    researchQuestion,
    support,
    derivation,
    componentMapping,
    profile,
    evidenceEdges,
    supersessionEdges,
  };
}

type KnowledgeGraph = ReturnType<typeof completeKnowledgeGraph>;

function buildDraft(
  graph: KnowledgeGraph,
  options: {
    revision?: number;
    predecessorRef?: ReturnType<typeof knowledgeRef> | null;
    directDependencyRelations?: Array<{
      targetRef: ReturnType<typeof knowledgeRef>;
      role: "same_lane_authority" | "evidence_only" | "counterevidence" | "conflict_context";
    }>;
    context?: unknown;
  } = {}
) {
  const revision = options.revision ?? 1;
  return buildKnowledgePackDraft(
    {
      recordKind: "knowledge_pack_draft",
      schemaVersion: 1,
      id: `draft.mace-signs.${revision}`,
      packId: "pack.mace-signs",
      revision,
      authorityLane: "historical_practice",
      domains: ["notation", "instrument_technique"],
      predecessorRef: options.predecessorRef ?? null,
      directDependencyRelations: options.directDependencyRelations ?? [],
      ...graph.content,
    },
    options.context ?? EMPTY_GRAPH_CONTEXT
  );
}

function initialBundle(graph = completeKnowledgeGraph()) {
  const draft = buildDraft(graph);
  const release = buildKnowledgePackRelease({
    recordKind: "knowledge_pack_release",
    schemaVersion: 1,
    id: "release.mace-signs.1",
    sequence: 1,
    draft,
  });
  return { graph, draft, release };
}

function successorBundle(first = initialBundle()) {
  const graph = completeKnowledgeGraph({
    version: 2,
    parents: first.graph,
    resourcePolicyDigest: HEX_B,
  });
  const dependencyContext = {
    schemaVersion: 1 as const,
    drafts: [first.draft],
    releases: [first.release],
  };
  const draft = buildDraft(graph, {
    revision: 2,
    predecessorRef: knowledgeRef(first.release),
    directDependencyRelations: [
      { targetRef: knowledgeRef(first.release), role: "same_lane_authority" },
    ],
    context: dependencyContext,
  });
  const release = buildKnowledgePackRelease(
    {
      recordKind: "knowledge_pack_release",
      schemaVersion: 1,
      id: "release.mace-signs.2",
      sequence: 2,
      draft,
    },
    dependencyContext
  );
  return { first, graph, draft, release, dependencyContext };
}

function contentWithEdges(
  graph: KnowledgeGraph,
  evidenceEdges: EvidenceEdge[],
  candidates: Candidate[] = graph.content.candidates
) {
  const profile = buildMaceProfile({
    mappingCandidate: graph.mappingCandidate,
    researchQuestion: graph.researchQuestion,
    evidenceEdges,
    derivation: graph.derivation,
    componentMapping: graph.componentMapping,
  });
  return { ...graph.content, candidates, evidenceEdges, profiles: [profile] };
}

function contentWithAdditionalDerivation(
  graph: KnowledgeGraph,
  evidenceInput: EvidenceEdge,
  options: {
    evidenceEdges?: EvidenceEdge[];
    candidateInput?: Candidate;
    candidates?: Candidate[];
  } = {}
) {
  const evidenceEdges = options.evidenceEdges ?? graph.evidenceEdges;
  const candidateInput = options.candidateInput ?? graph.mappingCandidate;
  const derivation = buildKnowledgeConstraintDerivation({
    ...withoutDigest(graph.derivation),
    id: `derivation.release.000-adversarial-${evidenceInput.role}`,
    inputs: [
      {
        ref: knowledgeRef(candidateInput),
        kind: "candidate",
        authorityLane: "historical_practice",
      },
      {
        ref: knowledgeRef(evidenceInput),
        kind: "evidence_edge",
        authorityLane: "historical_practice",
      },
    ],
  });
  const componentMapping = buildKnowledgeComponentMapping({
    ...componentMappingBuildCore(graph.componentMapping),
    id: `component-mapping.release.adversarial-${evidenceInput.role}`,
    derivationRefs: [knowledgeRef(graph.derivation), knowledgeRef(derivation)],
  });
  const baseProfile = buildMaceProfile({
    mappingCandidate: graph.mappingCandidate,
    researchQuestion: graph.researchQuestion,
    evidenceEdges,
    derivation: graph.derivation,
    componentMapping,
  });
  const profile = buildKnowledgeProfile({
    ...withoutDigest(baseProfile),
    derivationRefs: [knowledgeRef(graph.derivation), knowledgeRef(derivation)],
  });
  return {
    ...graph.content,
    candidates: options.candidates ?? graph.content.candidates,
    evidenceEdges,
    constraintDerivations: [graph.derivation, derivation],
    componentMappings: [componentMapping],
    profiles: [profile],
  };
}

function mintAttestation(input: {
  release: ReturnType<typeof buildKnowledgePackRelease>;
  draft: ReturnType<typeof buildKnowledgePackDraft>;
  systemRef: ReturnType<typeof knowledgeRef>;
  policyRef: ReturnType<typeof knowledgeRef>;
  issuedAt: string;
}) {
  const core = {
    recordKind: "release_attestation" as const,
    schemaVersion: 1 as const,
    id: `attestation.test-only.${input.release.id}`,
    kind: "test_only" as const,
    releaseRef: knowledgeRef(input.release),
    issuer: { kind: "vellum_system" as const, systemRef: input.systemRef },
    testPolicyRef: input.policyRef,
    permittedUses: ["isolated_evaluation", "provisional_research"] as const,
    authorityDisposition: "test_only_no_authority" as const,
    authorityClaims: {
      activation: false as const,
      human: false as const,
      historical: false as const,
      modernPedagogy: false as const,
      editorial: false as const,
      software: false as const,
      ownerLocal: false as const,
      ergonomic: false as const,
      performer: false as const,
      specialist: false as const,
    },
    evidenceRefs: [knowledgeRef(input.draft)],
    issuedAt: input.issuedAt,
  };
  return validateSystemTestOnlyAttestationStructure({
    ...core,
    digest: computeSystemTestOnlyAttestationDigest(core),
  });
}

describe("reviewed knowledge contract", () => {
  it("binds the exact T11 seed into a closed, truthful, inactive Mace release", () => {
    const { graph, draft, release } = initialBundle();
    const releaseContext = { schemaVersion: 1, drafts: [draft], releases: [] };

    expect(validateKnowledgePackDraft(draft)).toEqual(draft);
    expect(validateKnowledgePackRelease(release)).toEqual(release);
    expect(validateKnowledgeDraftGraph(draft, EMPTY_GRAPH_CONTEXT)).toEqual(draft);
    expect(validateKnowledgeReleaseGraph(release, releaseContext)).toEqual(release);
    expect(release.citedEvidenceRefs).toHaveLength(4);
    expect(release.citedEvidenceRefs).toEqual(
      expect.arrayContaining([
        SOURCE_SEGMENT_REF,
        CITED_EXTRACTION_REF,
        MAPPING_PROPOSAL_REF,
        COURSE_13_PROPOSAL_REF,
      ])
    );
    expect(release.profiles[0]!.evidenceRoleIndex.counterexample).toEqual([]);
    expect(release.profiles[0]!.observedAbsences).toEqual([
      {
        role: "counterexample",
        observation: "none_observed",
        scope: "cited_mace_segment_only",
      },
    ]);
    expect(release.evidenceEdges.map(({ role }) => role)).not.toContain("contradiction");
    expect(release.evidenceEdges.map(({ role }) => role)).not.toContain("counterexample");
    expect(graph.mappingCandidate.proposition).toMatchObject({
      courseMappings: MACE_MAPPINGS,
      numericSymbolsHaveSlashes: false,
      course13Inference: "forbidden",
    });
    expect(release.profiles[0]!.defaultActivation).toBe("inactive");
  });

  it("derives dependency descriptors from full release bytes and binds every source draft", () => {
    const successor = successorBundle();
    const releaseContext = {
      schemaVersion: 1,
      drafts: [successor.draft, successor.first.draft],
      releases: [successor.first.release],
    };

    expect(validateKnowledgeDraftGraph(successor.draft, successor.dependencyContext)).toEqual(
      successor.draft
    );
    expect(validateKnowledgeReleaseGraph(successor.release, releaseContext)).toEqual(
      successor.release
    );
    expect(successor.draft.dependencyClosure).toEqual([
      buildKnowledgeReleaseDependency(successor.first.release),
    ]);
    expect(successor.release.merkleRoot).not.toBe(successor.first.release.merkleRoot);
    expect(() =>
      buildKnowledgePackDraft({
        ...withoutDigest(successor.draft),
        dependencyClosure: successor.draft.dependencyClosure,
      })
    ).toThrow(/closed-schema|dependencyClosure/i);

    const alternate = initialBundle(completeKnowledgeGraph({ resourcePolicyDigest: HEX_C }));
    expect(() =>
      validateKnowledgeReleaseGraph(successor.release, {
        schemaVersion: 1,
        drafts: [successor.draft, alternate.draft],
        releases: [alternate.release],
      })
    ).toThrow(/exact|missing|source draft|dependency/i);
    expect(() =>
      validateKnowledgeReleaseGraph(successor.release, {
        schemaVersion: 1,
        drafts: [successor.draft],
        releases: [successor.first.release],
      })
    ).toThrow(/source draft|missing/i);
    expect(() =>
      validateKnowledgeReleaseGraph(successor.release, {
        ...releaseContext,
        releases: [successor.first.release, alternate.release],
      })
    ).toThrow(/duplicate|identity|extra/i);
  });

  it("canonicalizes every nested set before digesting and rejects self-digested noncanonical bytes", () => {
    const graph = completeKnowledgeGraph();
    const base = withoutDigest(graph.mappingCandidate);
    const reorderedCore = {
      ...base,
      domains: ["notation", "instrument_technique"],
      sourceSegmentRefs: [
        { recordKind: "source_segment_version" as const, ...ref("segment.z", HEX_B) },
        { recordKind: "source_segment_version" as const, ...ref("segment.A", HEX_A) },
      ],
      sourceProposalRefs: [
        { recordKind: "extraction_proposal" as const, ...ref("proposal.z", HEX_B) },
        { recordKind: "extraction_proposal" as const, ...ref("proposal.A", HEX_A) },
      ],
    };
    const first = buildKnowledgeCandidate(reorderedCore);
    const second = buildKnowledgeCandidate({
      ...reorderedCore,
      domains: [...reorderedCore.domains].reverse(),
      sourceSegmentRefs: [...reorderedCore.sourceSegmentRefs].reverse(),
      sourceProposalRefs: [...reorderedCore.sourceProposalRefs].reverse(),
    });
    expect(first).toEqual(second);
    expect(first.sourceSegmentRefs.map(({ id }) => id)).toEqual(["segment.A", "segment.z"]);

    const canonicalCore = withoutDigest(first);
    const noncanonicalCore = {
      ...canonicalCore,
      sourceSegmentRefs: [...canonicalCore.sourceSegmentRefs].reverse(),
    };
    expect(() =>
      validateKnowledgeCandidate({
        ...noncanonicalCore,
        digest: knowledgeDigest("candidate", noncanonicalCore),
      })
    ).toThrow(/canonical order/i);

    const profileCore = withoutDigest(graph.profile);
    const noncanonicalProfileCore = {
      ...profileCore,
      evidenceEdgeRefs: [...profileCore.evidenceEdgeRefs].reverse(),
    };
    expect(() =>
      validateKnowledgeProfile({
        ...noncanonicalProfileCore,
        digest: knowledgeDigest("profile", noncanonicalProfileCore),
      })
    ).toThrow(/canonical order/i);
  });

  it("binds external citation kinds in candidates, closure equality, and Merkle inputs", () => {
    const graph = completeKnowledgeGraph();
    expect(
      Value.Check(KnowledgeExternalEvidenceRefSchema, {
        recordKind: "release_attestation",
        id: SOURCE_SEGMENT_REF.id,
        digest: SOURCE_SEGMENT_REF.digest,
      })
    ).toBe(false);
    expect(() =>
      buildKnowledgeCandidate({
        ...withoutDigest(graph.mappingCandidate),
        sourceSegmentRefs: [knowledgeRef(SOURCE_SEGMENT_REF)],
      })
    ).toThrow(/closed-schema/i);

    const wrongKindClosure = graph.content.citedEvidenceRefs.map((reference) =>
      reference.recordKind === "source_segment_version"
        ? { ...reference, recordKind: "cited_extraction_version" as const }
        : reference
    );
    expect(() =>
      buildDraft({
        ...graph,
        content: { ...graph.content, citedEvidenceRefs: wrongKindClosure },
      })
    ).toThrow(/cited-evidence closure/i);
  });

  it("enforces candidate-edge-derivation-mapping-profile predicate coherence", () => {
    const graph = completeKnowledgeGraph();
    const invalidExample = buildKnowledgeEvidenceEdge({
      ...withoutDigest(graph.evidenceEdges.find(({ role }) => role === "example")!),
      id: "evidence.release.invalid-example-predicate",
      predicateBinding: {
        predicateRef: knowledgeRef(graph.researchPredicate),
        use: "gating",
      },
    });
    const predicateMismatchEdges = graph.evidenceEdges.map((edge) =>
      edge.role === "example" ? invalidExample : edge
    );
    expect(() =>
      buildDraft({
        ...graph,
        content: contentWithEdges(graph, predicateMismatchEdges),
      })
    ).toThrow(/predicate|authority use/i);

    const otherAssertion = buildKnowledgeCandidate({
      ...withoutDigest(graph.mappingCandidate),
      id: "candidate.release.other-mapping.v1",
      familyId: "candidate-family.release.other-mapping",
    });
    const invalidDerivationEdge = buildKnowledgeEvidenceEdge({
      ...withoutDigest(graph.evidenceEdges.find(({ role }) => role === "derivation")!),
      id: "evidence.release.invalid-derivation-target",
      target: {
        ref: knowledgeRef(otherAssertion),
        nodeKind: "assertion",
        authorityLane: "historical_practice",
      },
    });
    const targetMismatchEdges = graph.evidenceEdges.map((edge) =>
      edge.role === "derivation" ? invalidDerivationEdge : edge
    );
    expect(() =>
      buildDraft({
        ...graph,
        content: contentWithEdges(graph, targetMismatchEdges, [
          ...graph.content.candidates,
          otherAssertion,
        ]),
      })
    ).toThrow(/exact assertion input|derivation/i);

    expect(graph.derivation.gatingPredicateRefs).toEqual([knowledgeRef(graph.mappingPredicate)]);
    expect(graph.componentMapping.gatingPredicateRefs).toEqual([
      knowledgeRef(graph.mappingPredicate),
    ]);
    expect(graph.profile.gatingPredicateRefs).toEqual([knowledgeRef(graph.mappingPredicate)]);
    expect(graph.profile.informationalPredicateRefs).toEqual([
      knowledgeRef(graph.researchPredicate),
    ]);
  });

  it.each(["example", "derivation", "unresolved_ambiguity"] as const)(
    "rejects %s evidence as a constraint-derivation premise",
    (role) => {
      const graph = completeKnowledgeGraph();
      const evidence = graph.evidenceEdges.find((edge) => edge.role === role)!;
      expect(() =>
        buildDraft({ ...graph, content: contentWithAdditionalDerivation(graph, evidence) })
      ).toThrow(/only support or qualification evidence/i);
    }
  );

  it("rejects contradiction and lineage-supersession premises while accepting qualification", () => {
    const graph = completeKnowledgeGraph();
    const contradiction = buildKnowledgeEvidenceEdge({
      ...withoutDigest(graph.evidenceEdges.find(({ role }) => role === "example")!),
      id: "evidence.release.adversarial-contradiction",
      role: "contradiction",
      rationaleCode: "source_conflicts_with_mapping",
    });
    const contradictionEdges = [...graph.evidenceEdges, contradiction];
    expect(() =>
      buildDraft({
        ...graph,
        content: contentWithAdditionalDerivation(graph, contradiction, {
          evidenceEdges: contradictionEdges,
        }),
      })
    ).toThrow(/only support or qualification evidence/i);

    const qualification = graph.evidenceEdges.find(({ role }) => role === "qualification")!;
    expect(
      buildDraft({ ...graph, content: contentWithAdditionalDerivation(graph, qualification) })
        .constraintDerivations
    ).toHaveLength(2);

    const successor = successorBundle();
    const supersession = successor.graph.supersessionEdges.find(
      ({ target }) => target.nodeKind === "assertion"
    )!;
    expect(() =>
      buildDraft(
        {
          ...successor.graph,
          content: contentWithAdditionalDerivation(successor.graph, supersession),
        },
        {
          revision: 2,
          predecessorRef: knowledgeRef(successor.first.release),
          directDependencyRelations: [
            { targetRef: knowledgeRef(successor.first.release), role: "same_lane_authority" },
          ],
          context: successor.dependencyContext,
        }
      )
    ).toThrow(/only support or qualification evidence/i);
  });

  it("requires derivations to consume a current non-rejected assertion", () => {
    const graph = completeKnowledgeGraph();
    const rejected = buildKnowledgeCandidate({
      ...withoutDigest(graph.mappingCandidate),
      id: "candidate.release.rejected-mapping.v1",
      familyId: "candidate-family.release.rejected-mapping",
      reviewState: "rejected",
    });
    const rejectedSupport = buildKnowledgeEvidenceEdge({
      ...withoutDigest(graph.support),
      id: "evidence.release.rejected-mapping-support",
      target: {
        ref: knowledgeRef(rejected),
        nodeKind: "assertion",
        authorityLane: "historical_practice",
      },
    });
    expect(() =>
      buildDraft({
        ...graph,
        content: contentWithAdditionalDerivation(graph, rejectedSupport, {
          candidateInput: rejected,
          candidates: [...graph.content.candidates, rejected],
          evidenceEdges: [...graph.evidenceEdges, rejectedSupport],
        }),
      })
    ).toThrow(/current non-rejected assertion/i);
  });

  it("binds profile evidence, derivations, and mappings to the exact current profile graph", () => {
    const graph = completeKnowledgeGraph();
    const otherAssertion = buildKnowledgeCandidate({
      ...withoutDigest(graph.mappingCandidate),
      id: "candidate.release.profile-other-assertion.v1",
      familyId: "candidate-family.release.profile-other-assertion",
    });
    const offProfileExample = buildKnowledgeEvidenceEdge({
      ...withoutDigest(graph.evidenceEdges.find(({ role }) => role === "example")!),
      id: "evidence.release.profile-off-assertion",
      target: {
        ref: knowledgeRef(otherAssertion),
        nodeKind: "assertion",
        authorityLane: "historical_practice",
      },
    });
    const offProfileEdges = graph.evidenceEdges.map((edge) =>
      edge.role === "example" ? offProfileExample : edge
    );
    expect(() =>
      buildDraft({
        ...graph,
        content: contentWithEdges(graph, offProfileEdges, [
          ...graph.content.candidates,
          otherAssertion,
        ]),
      })
    ).toThrow(/authoritative evidence.*current profile assertion/i);

    const otherQuestion = buildKnowledgeCandidate({
      ...withoutDigest(graph.researchQuestion),
      id: "candidate.release.profile-other-question.v1",
      familyId: "candidate-family.release.profile-other-question",
    });
    const offProfileUnresolved = buildKnowledgeEvidenceEdge({
      ...withoutDigest(graph.evidenceEdges.find(({ role }) => role === "unresolved_ambiguity")!),
      id: "evidence.release.profile-off-question",
      target: {
        ref: knowledgeRef(otherQuestion),
        nodeKind: "research_question",
        authorityLane: "historical_practice",
      },
    });
    const offQuestionEdges = graph.evidenceEdges.map((edge) =>
      edge.role === "unresolved_ambiguity" ? offProfileUnresolved : edge
    );
    expect(() =>
      buildDraft({
        ...graph,
        content: contentWithEdges(graph, offQuestionEdges, [
          ...graph.content.candidates,
          otherQuestion,
        ]),
      })
    ).toThrow(/informational evidence.*current open question/i);

    const otherDerivation = buildKnowledgeConstraintDerivation({
      ...withoutDigest(graph.derivation),
      id: "derivation.release.profile-other.v1",
    });
    const otherMapping = buildKnowledgeComponentMapping({
      ...componentMappingBuildCore(graph.componentMapping),
      id: "component-mapping.release.profile-other.v1",
      derivationRefs: [knowledgeRef(otherDerivation)],
    });
    const mismatchedProfile = buildMaceProfile({
      mappingCandidate: graph.mappingCandidate,
      researchQuestion: graph.researchQuestion,
      evidenceEdges: graph.evidenceEdges,
      derivation: graph.derivation,
      componentMapping: otherMapping,
    });
    expect(() =>
      buildDraft({
        ...graph,
        content: {
          ...graph.content,
          constraintDerivations: [graph.derivation, otherDerivation],
          componentMappings: [otherMapping],
          profiles: [mismatchedProfile],
        },
      })
    ).toThrow(/profile derivation closure/i);
  });

  it("does not let a profile present a retained supersession target as current", () => {
    const successor = successorBundle();
    const staleProfile = buildMaceProfile({
      mappingCandidate: successor.first.graph.mappingCandidate,
      researchQuestion: successor.graph.researchQuestion,
      evidenceEdges: successor.graph.evidenceEdges,
      derivation: successor.graph.derivation,
      componentMapping: successor.graph.componentMapping,
    });
    expect(() =>
      buildDraft(
        {
          ...successor.graph,
          content: { ...successor.graph.content, profiles: [staleProfile] },
        },
        {
          revision: 2,
          predecessorRef: knowledgeRef(successor.first.release),
          directDependencyRelations: [
            { targetRef: knowledgeRef(successor.first.release), role: "same_lane_authority" },
          ],
          context: successor.dependencyContext,
        }
      )
    ).toThrow(/current non-rejected assertions/i);
  });

  it("requires exact role indexes, pairwise outcome buckets, and truthful absence coverage", () => {
    const graph = completeKnowledgeGraph();
    const profileCore = withoutDigest(graph.profile);
    const wrongIndex = buildKnowledgeProfile({
      ...profileCore,
      evidenceRoleIndex: { ...profileCore.evidenceRoleIndex, support: [] },
    });
    expect(() =>
      buildDraft({ ...graph, content: { ...graph.content, profiles: [wrongIndex] } })
    ).toThrow(/support index|role edges/i);

    expect(() =>
      buildKnowledgeProfile({
        ...profileCore,
        outcomes: {
          ...profileCore.outcomes,
          prohibited: ["render_cited_courses_7_12"],
        },
      })
    ).toThrow(/closed-schema|prohibited/i);

    const fabricatedCounterexample = buildKnowledgeEvidenceEdge({
      recordKind: "knowledge_evidence_edge",
      schemaVersion: 1,
      id: "evidence.release.fabricated-counterexample",
      authorityLane: "historical_practice",
      source: {
        ref: CITED_EXTRACTION_REF,
        kind: "cited_extraction",
        authorityLane: "historical_practice",
      },
      target: {
        ref: knowledgeRef(graph.mappingCandidate),
        nodeKind: "assertion",
        authorityLane: "historical_practice",
      },
      role: "counterexample",
      predicateBinding: { predicateRef: knowledgeRef(graph.mappingPredicate), use: "gating" },
      rationaleCode: "source_is_counterexample",
    });
    expect(() =>
      buildMaceProfile({
        mappingCandidate: graph.mappingCandidate,
        researchQuestion: graph.researchQuestion,
        evidenceEdges: [...graph.evidenceEdges, fabricatedCounterexample],
        derivation: graph.derivation,
        componentMapping: graph.componentMapping,
      })
    ).toThrow(/does not support a factual counterexample/i);
  });

  it("represents exact assertion and research-question supersession without making parents current", () => {
    const successor = successorBundle();
    const profile = successor.graph.profile;

    expect(successor.release.candidates).toHaveLength(4);
    expect(successor.graph.supersessionEdges).toHaveLength(2);
    expect(
      successor.graph.supersessionEdges.find(({ target }) => target.nodeKind === "assertion")!
    ).toMatchObject({ predicateBinding: { use: "gating" } });
    expect(
      successor.graph.supersessionEdges.find(
        ({ target }) => target.nodeKind === "research_question"
      )!
    ).toMatchObject({ predicateBinding: { use: "informational" } });
    expect(profile.assertionRefs).toEqual([knowledgeRef(successor.graph.mappingCandidate)]);
    expect(profile.openQuestionRefs).toEqual([knowledgeRef(successor.graph.researchQuestion)]);
    expect(profile.assertionRefs).not.toContainEqual(
      knowledgeRef(successor.first.graph.mappingCandidate)
    );
    expect(profile.openQuestionRefs).not.toContainEqual(
      knowledgeRef(successor.first.graph.researchQuestion)
    );
  });

  it("retains one contiguous candidate chain and rejects dropped roots or branched family versions", () => {
    const second = successorBundle();
    const thirdGraph = completeKnowledgeGraph({
      version: 3,
      parents: second.graph,
      retainedParentCandidates: second.graph.content.candidates,
      retainedSupersessionEdges: second.graph.supersessionEdges,
      resourcePolicyDigest: HEX_C,
    });
    expect(
      buildDraft(thirdGraph)
        .candidates.map(({ version }) => version)
        .sort((left, right) => left - right)
    ).toEqual([1, 1, 2, 2, 3, 3]);

    const rootRefs = new Set(
      thirdGraph.content.candidates
        .filter(({ version }) => version === 1)
        .map((candidate) => `${candidate.id}:${candidate.digest}`)
    );
    const droppedRootCandidates = thirdGraph.content.candidates.filter(
      ({ version }) => version !== 1
    );
    const droppedRootEdges = thirdGraph.evidenceEdges.filter(
      ({ target }) => !rootRefs.has(`${target.ref.id}:${target.ref.digest}`)
    );
    expect(() =>
      buildDraft({
        ...thirdGraph,
        content: contentWithEdges(thirdGraph, droppedRootEdges, droppedRootCandidates),
      })
    ).toThrow(/chain|predecessor|candidate closure|prior version/i);

    const branchedCandidate = buildKnowledgeCandidate({
      ...withoutDigest(second.graph.mappingCandidate),
      id: "candidate.release.mace-mapping.branch.v2",
    });
    const mappingSupersession = second.graph.supersessionEdges.find(
      ({ target }) => target.nodeKind === "assertion"
    )!;
    const branchEdge = buildKnowledgeEvidenceEdge({
      ...withoutDigest(mappingSupersession),
      id: "evidence.release.v2.supersede-mapping.branch",
      source: {
        ref: knowledgeRef(branchedCandidate),
        kind: "candidate",
        authorityLane: "historical_practice",
      },
    });
    expect(() =>
      buildDraft({
        ...second.graph,
        content: contentWithEdges(
          second.graph,
          [...second.graph.evidenceEdges, branchEdge],
          [...second.graph.content.candidates, branchedCandidate]
        ),
      })
    ).toThrow(/family\/version identity|unique/i);
  });

  it("rejects missing, duplicate, backward, and unrelated supersession edges", () => {
    const successor = successorBundle();
    const graph = successor.graph;
    const questionSupersession = graph.supersessionEdges.find(
      ({ target }) => target.nodeKind === "research_question"
    )!;
    const mappingSupersession = graph.supersessionEdges.find(
      ({ target }) => target.nodeKind === "assertion"
    )!;
    const missingEdges = graph.evidenceEdges.filter(
      (edge) => !knowledgeRef(edge).id.includes("supersede-question")
    );
    expect(() =>
      buildDraft(
        { ...graph, content: contentWithEdges(graph, missingEdges) },
        {
          revision: 2,
          predecessorRef: knowledgeRef(successor.first.release),
          directDependencyRelations: [
            { targetRef: knowledgeRef(successor.first.release), role: "same_lane_authority" },
          ],
          context: successor.dependencyContext,
        }
      )
    ).toThrow(/exactly one exact supersession/i);

    const duplicate = buildKnowledgeEvidenceEdge({
      ...withoutDigest(questionSupersession),
      id: "evidence.release.v2.supersede-question.duplicate",
    });
    expect(() =>
      buildDraft(
        { ...graph, content: contentWithEdges(graph, [...graph.evidenceEdges, duplicate]) },
        {
          revision: 2,
          predecessorRef: knowledgeRef(successor.first.release),
          directDependencyRelations: [
            { targetRef: knowledgeRef(successor.first.release), role: "same_lane_authority" },
          ],
          context: successor.dependencyContext,
        }
      )
    ).toThrow(/exactly one exact supersession/i);

    const backward = buildKnowledgeEvidenceEdge({
      ...withoutDigest(mappingSupersession),
      id: "evidence.release.v2.supersede-mapping.backward",
      source: {
        ref: knowledgeRef(successor.first.graph.mappingCandidate),
        kind: "candidate",
        authorityLane: "historical_practice",
      },
      target: {
        ref: knowledgeRef(graph.mappingCandidate),
        nodeKind: "assertion",
        authorityLane: "historical_practice",
      },
    });
    const backwardEdges = graph.evidenceEdges.map((edge) =>
      edge.id === mappingSupersession.id ? backward : edge
    );
    expect(() =>
      buildDraft(
        { ...graph, content: contentWithEdges(graph, backwardEdges) },
        {
          revision: 2,
          predecessorRef: knowledgeRef(successor.first.release),
          directDependencyRelations: [
            { targetRef: knowledgeRef(successor.first.release), role: "same_lane_authority" },
          ],
          context: successor.dependencyContext,
        }
      )
    ).toThrow(/supersession|prior version/i);

    const unrelatedParent = buildKnowledgeCandidate({
      ...withoutDigest(successor.first.graph.mappingCandidate),
      id: "candidate.release.unrelated-mapping.v1",
      familyId: "candidate-family.release.unrelated-mapping",
    });
    const unrelated = buildKnowledgeEvidenceEdge({
      ...withoutDigest(mappingSupersession),
      id: "evidence.release.v2.supersede-mapping.unrelated",
      target: {
        ref: knowledgeRef(unrelatedParent),
        nodeKind: "assertion",
        authorityLane: "historical_practice",
      },
    });
    const unrelatedEdges = graph.evidenceEdges.map((edge) =>
      edge.id === mappingSupersession.id ? unrelated : edge
    );
    expect(() =>
      buildDraft(
        {
          ...graph,
          content: contentWithEdges(graph, unrelatedEdges, [
            ...graph.content.candidates,
            unrelatedParent,
          ]),
        },
        {
          revision: 2,
          predecessorRef: knowledgeRef(successor.first.release),
          directDependencyRelations: [
            { targetRef: knowledgeRef(successor.first.release), role: "same_lane_authority" },
          ],
          context: successor.dependencyContext,
        }
      )
    ).toThrow(/supersession|parent/i);
  });

  it("separates dependency authority roles and reserves same-lane authority for predecessors", () => {
    expect(
      Value.Check(KnowledgeDependencyRelationSchema, {
        targetRef: ref("release.editorial.context", HEX_B),
        role: "conflict_context",
      })
    ).toBe(true);
    expect(
      Value.Check(KnowledgeDependencyRelationSchema, {
        targetRef: ref("release.editorial.context", HEX_B),
        role: "same_lane_authority",
        authorityLane: "editorial_convention",
      })
    ).toBe(false);

    const first = initialBundle();
    const graph = completeKnowledgeGraph({ version: 2, parents: first.graph });
    const context = { schemaVersion: 1, drafts: [first.draft], releases: [first.release] };
    expect(() =>
      buildDraft(graph, {
        revision: 2,
        predecessorRef: knowledgeRef(first.release),
        directDependencyRelations: [
          { targetRef: knowledgeRef(first.release), role: "evidence_only" },
        ],
        context,
      })
    ).toThrow(/predecessor|same-lane/i);
  });

  it("validates test-only attestations against exact release, system, policy, and server time", () => {
    const bundle = initialBundle();
    const systemIdentity = buildKnowledgeSystemIdentitySnapshot({
      recordKind: "knowledge_system_identity_snapshot",
      schemaVersion: 1,
      id: "system-identity.vellum-server.v1",
      systemKind: "vellum_server",
      buildRef: ref("build.vellum.v1", HEX_A),
      environmentRef: ref("environment.vellum.test.v1", HEX_B),
    });
    const testPolicy = buildKnowledgeTestPolicy({
      recordKind: "knowledge_test_policy",
      schemaVersion: 1,
      id: "test-policy.instrument-intelligence.v1",
      permittedUses: ["isolated_evaluation", "provisional_research"],
      activationAuthority: false,
      humanAuthority: false,
    });
    const issuedAt = "2026-07-16T12:00:00.000Z";
    const attestation = mintAttestation({
      release: bundle.release,
      draft: bundle.draft,
      systemRef: knowledgeRef(systemIdentity),
      policyRef: knowledgeRef(testPolicy),
      issuedAt,
    });
    const context = {
      release: bundle.release,
      releaseGraphContext: { schemaVersion: 1, drafts: [bundle.draft], releases: [] },
      systemIdentity,
      testPolicy,
      expectedIssuedAt: issuedAt,
    };

    expect(validateSystemTestOnlyAttestationStructure(attestation)).toEqual(attestation);
    expect(validateSystemTestOnlyAttestation(attestation, context)).toEqual(attestation);
    expect(Object.values(attestation.authorityClaims).every((claim) => claim === false)).toBe(true);

    const otherSystem = buildKnowledgeSystemIdentitySnapshot({
      ...withoutDigest(systemIdentity),
      id: "system-identity.vellum-server.v2",
      buildRef: ref("build.vellum.v2", HEX_C),
    });
    expect(() =>
      validateSystemTestOnlyAttestation(attestation, { ...context, systemIdentity: otherSystem })
    ).toThrow(/system identity/i);

    const otherPolicy = buildKnowledgeTestPolicy({
      ...withoutDigest(testPolicy),
      id: "test-policy.instrument-intelligence.v2",
    });
    expect(() =>
      validateSystemTestOnlyAttestation(attestation, { ...context, testPolicy: otherPolicy })
    ).toThrow(/test policy/i);

    const otherBundle = initialBundle(completeKnowledgeGraph({ resourcePolicyDigest: HEX_C }));
    expect(() =>
      validateSystemTestOnlyAttestation(attestation, {
        ...context,
        release: otherBundle.release,
        releaseGraphContext: {
          schemaVersion: 1,
          drafts: [otherBundle.draft],
          releases: [],
        },
      })
    ).toThrow(/exact release/i);

    expect(() =>
      validateSystemTestOnlyAttestation(attestation, {
        ...context,
        expectedIssuedAt: "2026-07-16T12:00:01.000Z",
      })
    ).toThrow(/issue time|server context/i);

    for (const evidenceRefs of [
      [],
      [knowledgeRef(bundle.draft), ref("draft.unrelated", HEX_C)],
      [ref("draft.unrelated", HEX_C)],
    ]) {
      const { digest: _digest, ...attestationCore } = attestation;
      const forgedCore = { ...attestationCore, evidenceRefs };
      const forged = validateSystemTestOnlyAttestationStructure({
        ...forgedCore,
        digest: computeSystemTestOnlyAttestationDigest(forgedCore),
      });
      expect(() => validateSystemTestOnlyAttestation(forged, context)).toThrow(
        /evidence.*exact source draft/i
      );
    }
  });

  it("fails closed on unknown fields, authority widening, executable payloads, and bad digests", () => {
    const graph = completeKnowledgeGraph();
    expect(() =>
      buildKnowledgeCandidate({
        ...withoutDigest(graph.mappingCandidate),
        activationAllowed: true,
      })
    ).toThrow(/closed-schema/i);
    expect(() =>
      buildKnowledgeCandidate({
        ...withoutDigest(graph.mappingCandidate),
        hiddenAuthority: "historical",
      })
    ).toThrow(/closed-schema/i);
    expect(() =>
      buildKnowledgeComponentBinding({
        ...withoutDigest(graph.content.componentClosure[0]!),
        resourcePolicyRef: ref("../../private-policy", HEX_A),
      })
    ).toThrow(/path|payload|closed-schema/i);
    expect(() =>
      validateKnowledgePackRelease({ ...initialBundle().release, digest: HEX_A })
    ).toThrow(/digest/i);

    const roles = [
      "support",
      "qualification",
      "contradiction",
      "supersession",
      "example",
      "counterexample",
      "derivation",
      "unresolved_ambiguity",
    ];
    expect(roles.every((role) => Value.Check(KnowledgeEvidenceRoleSchema, role))).toBe(true);
  });
});
