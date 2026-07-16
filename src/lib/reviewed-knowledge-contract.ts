import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import { canonicalReferenceJson, referenceSourceDigest } from "./reference-source-domain.js";

const Strict = { additionalProperties: false } as const;
const IdSchema = Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$" });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const VersionSchema = Type.Integer({ minimum: 1, maximum: 1_000_000 });
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
});

assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
export const KnowledgeRecordRefSchema = Type.Object({ id: IdSchema, digest: DigestSchema }, Strict);
export type KnowledgeRecordRef = Static<typeof KnowledgeRecordRefSchema>;

export const KnowledgeVersionedRecordRefSchema = Type.Object(
  { id: IdSchema, familyId: IdSchema, version: VersionSchema, digest: DigestSchema },
  Strict
);
export type KnowledgeVersionedRecordRef = Static<typeof KnowledgeVersionedRecordRefSchema>;

export const KnowledgeSourceSegmentVersionRefSchema = Type.Object(
  {
    recordKind: Type.Literal("source_segment_version"),
    id: IdSchema,
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgeSourceSegmentVersionRef = Static<
  typeof KnowledgeSourceSegmentVersionRefSchema
>;

export const KnowledgeCitedExtractionVersionRefSchema = Type.Object(
  {
    recordKind: Type.Literal("cited_extraction_version"),
    id: IdSchema,
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgeCitedExtractionVersionRef = Static<
  typeof KnowledgeCitedExtractionVersionRefSchema
>;

export const KnowledgeExtractionProposalRefSchema = Type.Object(
  {
    recordKind: Type.Literal("extraction_proposal"),
    id: IdSchema,
    digest: DigestSchema,
  },
  Strict
);
export type KnowledgeExtractionProposalRef = Static<typeof KnowledgeExtractionProposalRefSchema>;

export const KnowledgeExternalEvidenceRefSchema = Type.Union([
  KnowledgeSourceSegmentVersionRefSchema,
  KnowledgeCitedExtractionVersionRefSchema,
  KnowledgeExtractionProposalRefSchema,
]);
export type KnowledgeExternalEvidenceRef = Static<typeof KnowledgeExternalEvidenceRefSchema>;

export const KnowledgeAuthorityLaneSchema = Type.Union([
  Type.Literal("historical_practice"),
  Type.Literal("modern_pedagogy"),
  Type.Literal("editorial_convention"),
  Type.Literal("software_heuristic"),
  Type.Literal("owner_local_reviewed_guidance"),
]);
export type KnowledgeAuthorityLane = Static<typeof KnowledgeAuthorityLaneSchema>;

export const KnowledgeDomainSchema = Type.Union([
  Type.Literal("analysis_counterpoint"),
  Type.Literal("continuo_figured_bass"),
  Type.Literal("instrument_technique"),
  Type.Literal("notation"),
  Type.Literal("playback"),
  Type.Literal("ergonomics"),
  Type.Literal("evaluation_guidance"),
]);
export type KnowledgeDomain = Static<typeof KnowledgeDomainSchema>;

const MaceCourseMappingsSchema = Type.Tuple([
  Type.Object({ course: Type.Literal(7), sign: Type.Literal("a") }, Strict),
  Type.Object({ course: Type.Literal(8), sign: Type.Literal("/a") }, Strict),
  Type.Object({ course: Type.Literal(9), sign: Type.Literal("//a") }, Strict),
  Type.Object({ course: Type.Literal(10), sign: Type.Literal("///a") }, Strict),
  Type.Object({ course: Type.Literal(11), sign: Type.Literal("4") }, Strict),
  Type.Object({ course: Type.Literal(12), sign: Type.Literal("5") }, Strict),
]);

const MaceApplicabilityExpressionSchema = Type.Object(
  {
    kind: Type.Literal("mace_twelve_course_notation_scope"),
    sourceProfile: Type.Literal("mace-musicks-monument-1676"),
    instrumentFamily: Type.Literal("baroque_lute"),
    notationSystem: Type.Literal("french_tablature"),
    sourceCourseCount: Type.Literal(12),
    firstCoveredCourse: Type.Literal(7),
    lastCoveredCourse: Type.Literal(12),
    course13Disposition: Type.Literal("excluded_unresolved"),
  },
  Strict
);

const Course13ResearchApplicabilityExpressionSchema = Type.Object(
  {
    kind: Type.Literal("course_thirteen_notation_research_scope"),
    instrumentFamily: Type.Literal("baroque_lute"),
    notationSystem: Type.Literal("french_tablature"),
    course: Type.Literal(13),
    historicalSignState: Type.Literal("unresolved"),
    inferencePolicy: Type.Literal("no_sequence_extrapolation"),
    activationDisposition: Type.Literal("research_only"),
  },
  Strict
);

const KnowledgeApplicabilityPredicateCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_applicability_predicate"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    authorityLane: KnowledgeAuthorityLaneSchema,
    expression: Type.Union([
      MaceApplicabilityExpressionSchema,
      Course13ResearchApplicabilityExpressionSchema,
    ]),
    requiredContextFields: Type.Array(
      Type.Union([
        Type.Literal("source_profile"),
        Type.Literal("instrument_family"),
        Type.Literal("notation_system"),
        Type.Literal("source_course_count"),
        Type.Literal("historical_sign_state"),
      ]),
      { minItems: 1, maxItems: 8, uniqueItems: true }
    ),
    unknownPolicy: Type.Union([Type.Literal("preserve_unknown"), Type.Literal("review_required")]),
  },
  Strict
);

export const KnowledgeApplicabilityPredicateSchema = Type.Object(
  { ...KnowledgeApplicabilityPredicateCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgeApplicabilityPredicate = Static<typeof KnowledgeApplicabilityPredicateSchema>;

const MaceMappingPropositionSchema = Type.Object(
  {
    kind: Type.Literal("mace_twelve_course_diapason_mapping"),
    sourceProfile: Type.Literal("mace-musicks-monument-1676"),
    sourceCourseCount: Type.Literal(12),
    courseMappings: MaceCourseMappingsSchema,
    numericSymbolsHaveSlashes: Type.Literal(false),
    course13Inference: Type.Literal("forbidden"),
  },
  Strict
);

const Course13ResearchQuestionPropositionSchema = Type.Object(
  {
    kind: Type.Literal("course_thirteen_notation_question"),
    course: Type.Literal(13),
    state: Type.Literal("unresolved"),
    proposedSign: Type.Null(),
    forbiddenInference: Type.Literal("sequence_extrapolation"),
    activationDisposition: Type.Literal("research_only"),
  },
  Strict
);

const KnowledgeCandidateCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_candidate"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    familyId: IdSchema,
    version: VersionSchema,
    parentVersionRef: Type.Union([KnowledgeVersionedRecordRefSchema, Type.Null()]),
    nodeKind: Type.Union([Type.Literal("assertion"), Type.Literal("research_question")]),
    authorityLane: KnowledgeAuthorityLaneSchema,
    domains: Type.Array(KnowledgeDomainSchema, {
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
    }),
    epistemicForm: Type.Union([
      Type.Literal("descriptive_observation"),
      Type.Literal("unresolved_question"),
    ]),
    sourceSegmentRefs: Type.Array(KnowledgeSourceSegmentVersionRefSchema, {
      minItems: 1,
      maxItems: 64,
      uniqueItems: true,
    }),
    citedExtractionRefs: Type.Array(KnowledgeCitedExtractionVersionRefSchema, {
      minItems: 1,
      maxItems: 64,
      uniqueItems: true,
    }),
    sourceProposalRefs: Type.Array(KnowledgeExtractionProposalRefSchema, {
      minItems: 1,
      maxItems: 64,
      uniqueItems: true,
    }),
    gatingPredicateRefs: Type.Array(KnowledgeRecordRefSchema, {
      maxItems: 16,
      uniqueItems: true,
    }),
    informationalPredicateRefs: Type.Array(KnowledgeRecordRefSchema, {
      maxItems: 16,
      uniqueItems: true,
    }),
    proposition: Type.Union([
      MaceMappingPropositionSchema,
      Course13ResearchQuestionPropositionSchema,
    ]),
    reviewState: Type.Union([
      Type.Literal("proposed"),
      Type.Literal("reviewed"),
      Type.Literal("rejected"),
      Type.Literal("superseded"),
    ]),
    activationAllowed: Type.Literal(false),
  },
  Strict
);

export const KnowledgeCandidateSchema = Type.Object(
  { ...KnowledgeCandidateCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgeCandidate = Static<typeof KnowledgeCandidateSchema>;

export const KnowledgeEvidenceRoleSchema = Type.Union([
  Type.Literal("support"),
  Type.Literal("qualification"),
  Type.Literal("contradiction"),
  Type.Literal("supersession"),
  Type.Literal("example"),
  Type.Literal("counterexample"),
  Type.Literal("derivation"),
  Type.Literal("unresolved_ambiguity"),
]);
export type KnowledgeEvidenceRole = Static<typeof KnowledgeEvidenceRoleSchema>;

const KnowledgeEvidenceSourceSchema = Type.Union([
  Type.Object(
    {
      ref: KnowledgeCitedExtractionVersionRefSchema,
      kind: Type.Literal("cited_extraction"),
      authorityLane: KnowledgeAuthorityLaneSchema,
    },
    Strict
  ),
  Type.Object(
    {
      ref: KnowledgeRecordRefSchema,
      kind: Type.Literal("candidate"),
      authorityLane: KnowledgeAuthorityLaneSchema,
    },
    Strict
  ),
  Type.Object(
    {
      ref: KnowledgeRecordRefSchema,
      kind: Type.Literal("constraint_derivation"),
      authorityLane: KnowledgeAuthorityLaneSchema,
    },
    Strict
  ),
]);

const KnowledgeEvidenceTargetSchema = Type.Object(
  {
    ref: KnowledgeRecordRefSchema,
    nodeKind: Type.Union([Type.Literal("assertion"), Type.Literal("research_question")]),
    authorityLane: KnowledgeAuthorityLaneSchema,
  },
  Strict
);

const KnowledgeEvidenceEdgeCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_evidence_edge"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    authorityLane: KnowledgeAuthorityLaneSchema,
    source: KnowledgeEvidenceSourceSchema,
    target: KnowledgeEvidenceTargetSchema,
    role: KnowledgeEvidenceRoleSchema,
    predicateBinding: Type.Object(
      {
        predicateRef: KnowledgeRecordRefSchema,
        use: Type.Union([Type.Literal("gating"), Type.Literal("informational")]),
      },
      Strict
    ),
    rationaleCode: Type.Union([
      Type.Literal("source_directly_supports_mapping"),
      Type.Literal("scope_limited_to_twelve_courses"),
      Type.Literal("source_conflicts_with_mapping"),
      Type.Literal("later_candidate_supersedes_prior"),
      Type.Literal("source_exemplifies_mapping"),
      Type.Literal("source_is_counterexample"),
      Type.Literal("constraint_derived_from_evidence"),
      Type.Literal("source_does_not_establish_course_13"),
    ]),
  },
  Strict
);

export const KnowledgeEvidenceEdgeSchema = Type.Object(
  { ...KnowledgeEvidenceEdgeCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgeEvidenceEdge = Static<typeof KnowledgeEvidenceEdgeSchema>;

const KnowledgeDerivationInputSchema = Type.Object(
  {
    ref: KnowledgeRecordRefSchema,
    kind: Type.Union([Type.Literal("candidate"), Type.Literal("evidence_edge")]),
    authorityLane: KnowledgeAuthorityLaneSchema,
  },
  Strict
);

const KnowledgeConstraintDerivationCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_constraint_derivation"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    authorityLane: KnowledgeAuthorityLaneSchema,
    inputs: Type.Array(KnowledgeDerivationInputSchema, {
      minItems: 2,
      maxItems: 64,
      uniqueItems: true,
    }),
    gatingPredicateRefs: Type.Array(KnowledgeRecordRefSchema, {
      minItems: 1,
      maxItems: 16,
      uniqueItems: true,
    }),
    inferenceRule: Type.Literal("preserve_exact_cited_mapping_without_extrapolation"),
    force: Type.Literal("descriptive"),
    consequence: Type.Object(
      {
        kind: Type.Literal("twelve_course_notation_mapping"),
        courseMappings: MaceCourseMappingsSchema,
        course13Consequence: Type.Literal("none_unresolved"),
      },
      Strict
    ),
    limitations: Type.Array(
      Type.Union([Type.Literal("twelve_course_source_only"), Type.Literal("course_13_unresolved")]),
      { minItems: 2, maxItems: 2, uniqueItems: true }
    ),
    reviewState: Type.Literal("proposed"),
  },
  Strict
);

export const KnowledgeConstraintDerivationSchema = Type.Object(
  { ...KnowledgeConstraintDerivationCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgeConstraintDerivation = Static<typeof KnowledgeConstraintDerivationSchema>;

const KnowledgeComponentReplaySchema = Type.Union([
  Type.Object(
    {
      state: Type.Literal("available"),
      environmentRef: KnowledgeRecordRefSchema,
      artifactRef: KnowledgeRecordRefSchema,
    },
    Strict
  ),
  Type.Object(
    {
      state: Type.Literal("inspection_only"),
      reason: Type.Literal("executable_semantics_unavailable"),
    },
    Strict
  ),
]);

const KnowledgeComponentBindingCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_component_binding"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    authorityLane: KnowledgeAuthorityLaneSchema,
    componentRef: KnowledgeRecordRefSchema,
    artifactRef: KnowledgeRecordRefSchema,
    interfaceRef: KnowledgeRecordRefSchema,
    parameterSchemaRef: KnowledgeRecordRefSchema,
    unitSchemaRef: KnowledgeRecordRefSchema,
    compatibility: Type.Object(
      {
        contractRef: KnowledgeRecordRefSchema,
        minimumInterfaceVersion: VersionSchema,
        maximumInterfaceVersion: VersionSchema,
      },
      Strict
    ),
    resourcePolicyRef: KnowledgeRecordRefSchema,
    replay: KnowledgeComponentReplaySchema,
    dependencyRefs: Type.Array(KnowledgeRecordRefSchema, {
      maxItems: 32,
      uniqueItems: true,
    }),
  },
  Strict
);

export const KnowledgeComponentBindingSchema = Type.Object(
  { ...KnowledgeComponentBindingCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgeComponentBinding = Static<typeof KnowledgeComponentBindingSchema>;

const KnowledgeMappingParametersCoreSchema = Type.Object(
  {
    parameterSchemaRef: KnowledgeRecordRefSchema,
    unitSchemaRef: KnowledgeRecordRefSchema,
    values: Type.Object(
      {
        sourceCourseCount: Type.Literal(12),
        courseMappings: MaceCourseMappingsSchema,
        numericSymbolsHaveSlashes: Type.Literal(false),
        course13Policy: Type.Literal("unresolved_no_mapping"),
      },
      Strict
    ),
  },
  Strict
);

export const KnowledgeMappingParametersSchema = Type.Object(
  { ...KnowledgeMappingParametersCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgeMappingParameters = Static<typeof KnowledgeMappingParametersSchema>;

const KnowledgeComponentMappingBuildCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_component_mapping"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    authorityLane: KnowledgeAuthorityLaneSchema,
    mappingKind: Type.Literal("notation_component_mapping"),
    componentBindingRef: KnowledgeRecordRefSchema,
    gatingPredicateRefs: Type.Array(KnowledgeRecordRefSchema, {
      minItems: 1,
      maxItems: 16,
      uniqueItems: true,
    }),
    derivationRefs: Type.Array(KnowledgeRecordRefSchema, {
      minItems: 1,
      maxItems: 32,
      uniqueItems: true,
    }),
    parameters: KnowledgeMappingParametersCoreSchema,
    expectedObservable: Type.Literal("courses_7_12_render_with_cited_signs"),
    executionDisposition: Type.Literal("declarative_registry_binding"),
  },
  Strict
);

const KnowledgeComponentMappingCoreSchema = Type.Object(
  {
    ...KnowledgeComponentMappingBuildCoreSchema.properties,
    parameters: KnowledgeMappingParametersSchema,
  },
  Strict
);

export const KnowledgeComponentMappingSchema = Type.Object(
  { ...KnowledgeComponentMappingCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgeComponentMapping = Static<typeof KnowledgeComponentMappingSchema>;

export const KnowledgeOutcomeCodeSchema = Type.Union([
  Type.Literal("render_cited_courses_7_12"),
  Type.Literal("preserve_source_sign_identity"),
  Type.Literal("present_editorial_course_13_as_historical"),
  Type.Literal("infer_course_13_sign_by_sequence"),
]);
export type KnowledgeOutcomeCode = Static<typeof KnowledgeOutcomeCodeSchema>;

const KnowledgeEvidenceRoleIndexSchema = Type.Object(
  {
    support: Type.Array(KnowledgeRecordRefSchema, { maxItems: 64, uniqueItems: true }),
    qualification: Type.Array(KnowledgeRecordRefSchema, { maxItems: 64, uniqueItems: true }),
    contradiction: Type.Array(KnowledgeRecordRefSchema, { maxItems: 64, uniqueItems: true }),
    supersession: Type.Array(KnowledgeRecordRefSchema, { maxItems: 64, uniqueItems: true }),
    example: Type.Array(KnowledgeRecordRefSchema, { maxItems: 64, uniqueItems: true }),
    counterexample: Type.Array(KnowledgeRecordRefSchema, { maxItems: 64, uniqueItems: true }),
    derivation: Type.Array(KnowledgeRecordRefSchema, { maxItems: 64, uniqueItems: true }),
    unresolved_ambiguity: Type.Array(KnowledgeRecordRefSchema, {
      maxItems: 64,
      uniqueItems: true,
    }),
  },
  Strict
);

const KnowledgeProfileCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_profile"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    authorityLane: KnowledgeAuthorityLaneSchema,
    domains: Type.Array(KnowledgeDomainSchema, {
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
    }),
    gatingPredicateRefs: Type.Array(KnowledgeRecordRefSchema, {
      minItems: 1,
      maxItems: 16,
      uniqueItems: true,
    }),
    informationalPredicateRefs: Type.Array(KnowledgeRecordRefSchema, {
      minItems: 1,
      maxItems: 16,
      uniqueItems: true,
    }),
    assertionRefs: Type.Array(KnowledgeRecordRefSchema, {
      minItems: 1,
      maxItems: 64,
      uniqueItems: true,
    }),
    openQuestionRefs: Type.Array(KnowledgeRecordRefSchema, {
      maxItems: 64,
      uniqueItems: true,
    }),
    evidenceEdgeRefs: Type.Array(KnowledgeRecordRefSchema, {
      minItems: 1,
      maxItems: 256,
      uniqueItems: true,
    }),
    evidenceRoleIndex: KnowledgeEvidenceRoleIndexSchema,
    derivationRefs: Type.Array(KnowledgeRecordRefSchema, {
      minItems: 1,
      maxItems: 64,
      uniqueItems: true,
    }),
    componentMappingRefs: Type.Array(KnowledgeRecordRefSchema, {
      minItems: 1,
      maxItems: 64,
      uniqueItems: true,
    }),
    outcomes: Type.Object(
      {
        permitted: Type.Tuple([Type.Literal("render_cited_courses_7_12")]),
        preferred: Type.Tuple([Type.Literal("preserve_source_sign_identity")]),
        discouraged: Type.Tuple([Type.Literal("present_editorial_course_13_as_historical")]),
        prohibited: Type.Tuple([Type.Literal("infer_course_13_sign_by_sequence")]),
      },
      Strict
    ),
    expectedObservables: Type.Array(Type.Literal("courses_7_12_render_with_cited_signs"), {
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
    }),
    limitations: Type.Array(Type.Literal("twelve_course_source_only"), {
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
    }),
    unevaluatedDimensions: Type.Array(Type.Literal("course_13_historical_sign"), {
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
    }),
    observedAbsences: Type.Tuple([
      Type.Object(
        {
          role: Type.Literal("counterexample"),
          observation: Type.Literal("none_observed"),
          scope: Type.Literal("cited_mace_segment_only"),
        },
        Strict
      ),
    ]),
    coverageLimitations: Type.Tuple([
      Type.Literal("single_cited_segment"),
      Type.Literal("absence_does_not_establish_nonexistence"),
    ]),
    defaultActivation: Type.Literal("inactive"),
  },
  Strict
);

export const KnowledgeProfileSchema = Type.Object(
  { ...KnowledgeProfileCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgeProfile = Static<typeof KnowledgeProfileSchema>;

export const KnowledgeDependencyRoleSchema = Type.Union([
  Type.Literal("same_lane_authority"),
  Type.Literal("evidence_only"),
  Type.Literal("counterevidence"),
  Type.Literal("conflict_context"),
]);
export type KnowledgeDependencyRole = Static<typeof KnowledgeDependencyRoleSchema>;

export const KnowledgeDependencyRelationSchema = Type.Object(
  {
    targetRef: KnowledgeRecordRefSchema,
    role: KnowledgeDependencyRoleSchema,
  },
  Strict
);
export type KnowledgeDependencyRelation = Static<typeof KnowledgeDependencyRelationSchema>;

const KnowledgeReleaseDependencyCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_release_dependency"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    releaseRef: KnowledgeRecordRefSchema,
    packId: IdSchema,
    sequence: VersionSchema,
    predecessorRef: Type.Union([KnowledgeRecordRefSchema, Type.Null()]),
    authorityLane: KnowledgeAuthorityLaneSchema,
    directDependencyRelations: Type.Array(KnowledgeDependencyRelationSchema, {
      maxItems: 64,
      uniqueItems: true,
    }),
    releaseContentMerkleRoot: DigestSchema,
    releaseMerkleRoot: DigestSchema,
  },
  Strict
);

export const KnowledgeReleaseDependencySchema = Type.Object(
  { ...KnowledgeReleaseDependencyCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgeReleaseDependency = Static<typeof KnowledgeReleaseDependencySchema>;

const KnowledgePackContentWithoutClosureProperties = {
  citedEvidenceRefs: Type.Array(KnowledgeExternalEvidenceRefSchema, {
    minItems: 1,
    maxItems: 256,
    uniqueItems: true,
  }),
  candidates: Type.Array(KnowledgeCandidateSchema, { minItems: 2, maxItems: 64 }),
  applicabilityPredicates: Type.Array(KnowledgeApplicabilityPredicateSchema, {
    minItems: 2,
    maxItems: 64,
  }),
  evidenceEdges: Type.Array(KnowledgeEvidenceEdgeSchema, { minItems: 1, maxItems: 256 }),
  constraintDerivations: Type.Array(KnowledgeConstraintDerivationSchema, {
    minItems: 1,
    maxItems: 64,
  }),
  componentClosure: Type.Array(KnowledgeComponentBindingSchema, {
    minItems: 1,
    maxItems: 64,
  }),
  componentMappings: Type.Array(KnowledgeComponentMappingSchema, {
    minItems: 1,
    maxItems: 64,
  }),
  profiles: Type.Array(KnowledgeProfileSchema, { minItems: 1, maxItems: 32 }),
  predecessorRef: Type.Union([KnowledgeRecordRefSchema, Type.Null()]),
  directDependencyRelations: Type.Array(KnowledgeDependencyRelationSchema, {
    maxItems: 64,
    uniqueItems: true,
  }),
} as const;

const KnowledgePackContentProperties = {
  ...KnowledgePackContentWithoutClosureProperties,
  dependencyClosure: Type.Array(KnowledgeReleaseDependencySchema, { maxItems: 64 }),
} as const;

const KnowledgePackDraftBuildCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_pack_draft"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    packId: IdSchema,
    revision: Type.Integer({ minimum: 1, maximum: 1_000_000 }),
    authorityLane: KnowledgeAuthorityLaneSchema,
    domains: Type.Array(KnowledgeDomainSchema, {
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
    }),
    ...KnowledgePackContentWithoutClosureProperties,
  },
  Strict
);

const KnowledgePackDraftCanonicalCoreSchema = Type.Object(
  {
    ...KnowledgePackDraftBuildCoreSchema.properties,
    dependencyClosure: Type.Array(KnowledgeReleaseDependencySchema, { maxItems: 64 }),
  },
  Strict
);

const KnowledgePackDraftCoreSchema = Type.Object(
  {
    ...KnowledgePackDraftCanonicalCoreSchema.properties,
    contentMerkleRoot: DigestSchema,
    closureMerkleRoot: DigestSchema,
  },
  Strict
);

export const KnowledgePackDraftSchema = Type.Object(
  { ...KnowledgePackDraftCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgePackDraft = Static<typeof KnowledgePackDraftSchema>;

const KnowledgePackReleaseBuildInputSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_pack_release"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    sequence: VersionSchema,
    draft: KnowledgePackDraftSchema,
  },
  Strict
);

const KnowledgePackReleaseCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_pack_release"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    packId: IdSchema,
    sequence: VersionSchema,
    sourceDraftRef: KnowledgeRecordRefSchema,
    authorityLane: KnowledgeAuthorityLaneSchema,
    domains: Type.Array(KnowledgeDomainSchema, {
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
    }),
    ...KnowledgePackContentProperties,
    digestAlgorithm: Type.Literal("sha256"),
    contentMerkleRoot: DigestSchema,
    merkleRoot: DigestSchema,
  },
  Strict
);

export const KnowledgePackReleaseSchema = Type.Object(
  { ...KnowledgePackReleaseCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgePackRelease = Static<typeof KnowledgePackReleaseSchema>;

export const KnowledgeReleaseGraphContextSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    drafts: Type.Array(KnowledgePackDraftSchema, { maxItems: 128 }),
    releases: Type.Array(KnowledgePackReleaseSchema, { maxItems: 128 }),
  },
  Strict
);
export type KnowledgeReleaseGraphContext = Static<typeof KnowledgeReleaseGraphContextSchema>;

const KnowledgeSystemIdentitySnapshotCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_system_identity_snapshot"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    systemKind: Type.Literal("vellum_server"),
    buildRef: KnowledgeRecordRefSchema,
    environmentRef: KnowledgeRecordRefSchema,
  },
  Strict
);

export const KnowledgeSystemIdentitySnapshotSchema = Type.Object(
  { ...KnowledgeSystemIdentitySnapshotCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgeSystemIdentitySnapshot = Static<typeof KnowledgeSystemIdentitySnapshotSchema>;

const KnowledgeTestPolicyCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("knowledge_test_policy"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    permittedUses: Type.Tuple([
      Type.Literal("isolated_evaluation"),
      Type.Literal("provisional_research"),
    ]),
    activationAuthority: Type.Literal(false),
    humanAuthority: Type.Literal(false),
  },
  Strict
);

export const KnowledgeTestPolicySchema = Type.Object(
  { ...KnowledgeTestPolicyCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type KnowledgeTestPolicy = Static<typeof KnowledgeTestPolicySchema>;

const SystemTestOnlyAttestationCoreSchema = Type.Object(
  {
    recordKind: Type.Literal("release_attestation"),
    schemaVersion: Type.Literal(1),
    id: IdSchema,
    kind: Type.Literal("test_only"),
    releaseRef: KnowledgeRecordRefSchema,
    issuer: Type.Object(
      {
        kind: Type.Literal("vellum_system"),
        systemRef: KnowledgeRecordRefSchema,
      },
      Strict
    ),
    testPolicyRef: KnowledgeRecordRefSchema,
    permittedUses: Type.Array(
      Type.Union([Type.Literal("isolated_evaluation"), Type.Literal("provisional_research")]),
      { minItems: 1, maxItems: 2, uniqueItems: true }
    ),
    authorityDisposition: Type.Literal("test_only_no_authority"),
    authorityClaims: Type.Object(
      {
        activation: Type.Literal(false),
        human: Type.Literal(false),
        historical: Type.Literal(false),
        modernPedagogy: Type.Literal(false),
        editorial: Type.Literal(false),
        software: Type.Literal(false),
        ownerLocal: Type.Literal(false),
        ergonomic: Type.Literal(false),
        performer: Type.Literal(false),
        specialist: Type.Literal(false),
      },
      Strict
    ),
    evidenceRefs: Type.Array(KnowledgeRecordRefSchema, {
      maxItems: 64,
      uniqueItems: true,
    }),
    issuedAt: IsoTimestampSchema,
  },
  Strict
);

export const SystemTestOnlyAttestationSchema = Type.Object(
  { ...SystemTestOnlyAttestationCoreSchema.properties, digest: DigestSchema },
  Strict
);
export type SystemTestOnlyAttestation = Static<typeof SystemTestOnlyAttestationSchema>;

const SystemTestOnlyAttestationValidationContextSchema = Type.Object(
  {
    release: KnowledgePackReleaseSchema,
    releaseGraphContext: KnowledgeReleaseGraphContextSchema,
    systemIdentity: KnowledgeSystemIdentitySnapshotSchema,
    testPolicy: KnowledgeTestPolicySchema,
    expectedIssuedAt: IsoTimestampSchema,
  },
  Strict
);

export function buildKnowledgeApplicabilityPredicate(
  value: unknown
): KnowledgeApplicabilityPredicate {
  const decoded = decodeStrict(
    KnowledgeApplicabilityPredicateCoreSchema,
    value,
    "Knowledge applicability predicate"
  );
  const core = canonicalizePredicateCore(decoded);
  assertDeclarativePayload(core);
  assertPredicateSemantics(core);
  return buildDigestedRecord(
    KnowledgeApplicabilityPredicateSchema,
    "applicability-predicate",
    core
  );
}

export function validateKnowledgeApplicabilityPredicate(
  value: unknown
): KnowledgeApplicabilityPredicate {
  const predicate = decodeStrict(
    KnowledgeApplicabilityPredicateSchema,
    value,
    "Knowledge applicability predicate"
  );
  assertDeclarativePayload(predicate);
  assertCanonicalRecordCore(predicate, canonicalizePredicateCore, "applicability predicate");
  assertRecordDigest("applicability-predicate", predicate);
  assertPredicateSemantics(predicate);
  return deepFreeze(predicate);
}

export function buildKnowledgeCandidate(value: unknown): KnowledgeCandidate {
  const decoded = decodeStrict(KnowledgeCandidateCoreSchema, value, "Knowledge candidate");
  const core = canonicalizeCandidateCore(decoded);
  assertDeclarativePayload(core);
  assertCandidateSemantics(core);
  return buildDigestedRecord(KnowledgeCandidateSchema, "candidate", core);
}

export function validateKnowledgeCandidate(value: unknown): KnowledgeCandidate {
  const candidate = decodeStrict(KnowledgeCandidateSchema, value, "Knowledge candidate");
  assertDeclarativePayload(candidate);
  assertCanonicalRecordCore(candidate, canonicalizeCandidateCore, "candidate");
  assertRecordDigest("candidate", candidate);
  assertCandidateSemantics(candidate);
  return deepFreeze(candidate);
}

export function buildKnowledgeEvidenceEdge(value: unknown): KnowledgeEvidenceEdge {
  const core = decodeStrict(KnowledgeEvidenceEdgeCoreSchema, value, "Knowledge evidence edge");
  assertDeclarativePayload(core);
  assertEvidenceEdgeSemantics(core);
  return buildDigestedRecord(KnowledgeEvidenceEdgeSchema, "evidence-edge", core);
}

export function validateKnowledgeEvidenceEdge(value: unknown): KnowledgeEvidenceEdge {
  const edge = decodeStrict(KnowledgeEvidenceEdgeSchema, value, "Knowledge evidence edge");
  assertDeclarativePayload(edge);
  assertRecordDigest("evidence-edge", edge);
  assertEvidenceEdgeSemantics(edge);
  return deepFreeze(edge);
}

export function buildKnowledgeConstraintDerivation(value: unknown): KnowledgeConstraintDerivation {
  const decoded = decodeStrict(
    KnowledgeConstraintDerivationCoreSchema,
    value,
    "Knowledge constraint derivation"
  );
  const core = canonicalizeDerivationCore(decoded);
  assertDeclarativePayload(core);
  assertDerivationSemantics(core);
  return buildDigestedRecord(KnowledgeConstraintDerivationSchema, "constraint-derivation", core);
}

export function validateKnowledgeConstraintDerivation(
  value: unknown
): KnowledgeConstraintDerivation {
  const derivation = decodeStrict(
    KnowledgeConstraintDerivationSchema,
    value,
    "Knowledge constraint derivation"
  );
  assertDeclarativePayload(derivation);
  assertCanonicalRecordCore(derivation, canonicalizeDerivationCore, "constraint derivation");
  assertRecordDigest("constraint-derivation", derivation);
  assertDerivationSemantics(derivation);
  return deepFreeze(derivation);
}

export function buildKnowledgeComponentBinding(value: unknown): KnowledgeComponentBinding {
  const decoded = decodeStrict(
    KnowledgeComponentBindingCoreSchema,
    value,
    "Knowledge component binding"
  );
  const core = canonicalizeComponentBindingCore(decoded);
  assertDeclarativePayload(core);
  assertComponentBindingSemantics(core);
  return buildDigestedRecord(KnowledgeComponentBindingSchema, "component-binding", core);
}

export function validateKnowledgeComponentBinding(value: unknown): KnowledgeComponentBinding {
  const binding = decodeStrict(
    KnowledgeComponentBindingSchema,
    value,
    "Knowledge component binding"
  );
  assertDeclarativePayload(binding);
  assertCanonicalRecordCore(binding, canonicalizeComponentBindingCore, "component binding");
  assertRecordDigest("component-binding", binding);
  assertComponentBindingSemantics(binding);
  return deepFreeze(binding);
}

export function buildKnowledgeComponentMapping(value: unknown): KnowledgeComponentMapping {
  const decoded = decodeStrict(
    KnowledgeComponentMappingBuildCoreSchema,
    value,
    "Knowledge component mapping"
  );
  const buildCore = canonicalizeComponentMappingBuildCore(decoded);
  assertDeclarativePayload(buildCore);
  const parameters = buildDigestedRecord(
    KnowledgeMappingParametersSchema,
    "mapping-parameters",
    buildCore.parameters
  );
  const core = { ...buildCore, parameters };
  assertComponentMappingSemantics(core);
  return buildDigestedRecord(KnowledgeComponentMappingSchema, "component-mapping", core);
}

export function validateKnowledgeComponentMapping(value: unknown): KnowledgeComponentMapping {
  const mapping = decodeStrict(
    KnowledgeComponentMappingSchema,
    value,
    "Knowledge component mapping"
  );
  assertDeclarativePayload(mapping);
  assertCanonicalRecordCore(mapping, canonicalizeComponentMappingCore, "component mapping");
  assertRecordDigest("mapping-parameters", mapping.parameters);
  assertRecordDigest("component-mapping", mapping);
  assertComponentMappingSemantics(mapping);
  return deepFreeze(mapping);
}

export function buildKnowledgeProfile(value: unknown): KnowledgeProfile {
  const decoded = decodeStrict(KnowledgeProfileCoreSchema, value, "Knowledge profile");
  const core = canonicalizeProfileCore(decoded);
  assertDeclarativePayload(core);
  assertProfileSemantics(core);
  return buildDigestedRecord(KnowledgeProfileSchema, "profile", core);
}

export function validateKnowledgeProfile(value: unknown): KnowledgeProfile {
  const profile = decodeStrict(KnowledgeProfileSchema, value, "Knowledge profile");
  assertDeclarativePayload(profile);
  assertCanonicalRecordCore(profile, canonicalizeProfileCore, "profile");
  assertRecordDigest("profile", profile);
  assertProfileSemantics(profile);
  return deepFreeze(profile);
}

export function buildKnowledgePackDraft(
  value: unknown,
  contextValue: unknown = emptyKnowledgeReleaseGraphContext()
): KnowledgePackDraft {
  const decoded = decodeStrict(KnowledgePackDraftBuildCoreSchema, value, "Knowledge Pack Draft");
  assertDeclarativePayload(decoded);
  const context = decodeKnowledgeReleaseGraphContext(contextValue);
  const dependencyClosure = deriveDependencyClosureFromContext(
    decoded.directDependencyRelations,
    context,
    decoded.authorityLane
  );
  const canonical = canonicalizeDraftCore({ ...decoded, dependencyClosure });
  const contentMerkleRoot = knowledgeContentMerkleRoot(canonical);
  const core = {
    ...canonical,
    contentMerkleRoot,
    closureMerkleRoot: knowledgeClosureMerkleRoot(canonical, contentMerkleRoot),
  };
  assertReleaseSequence(decoded.revision, core);
  return buildDigestedRecord(KnowledgePackDraftSchema, "pack-draft", core);
}

export function validateKnowledgePackDraft(value: unknown): KnowledgePackDraft {
  const draft = decodeStrict(KnowledgePackDraftSchema, value, "Knowledge Pack Draft");
  assertDeclarativePayload(draft);
  const { contentMerkleRoot, closureMerkleRoot, digest: _digest, ...buildCore } = draft;
  const canonical = canonicalizeDraftCore(buildCore);
  if (canonicalReferenceJson(canonical) !== canonicalReferenceJson(buildCore)) {
    throw new Error("Knowledge Pack Draft graph is not in deterministic canonical order");
  }
  if (contentMerkleRoot !== knowledgeContentMerkleRoot(canonical)) {
    throw new Error("Knowledge Pack Draft has a forged or stale content Merkle root");
  }
  if (closureMerkleRoot !== knowledgeClosureMerkleRoot(canonical, contentMerkleRoot)) {
    throw new Error("Knowledge Pack Draft has a forged or stale closure Merkle root");
  }
  assertReleaseSequence(draft.revision, draft);
  assertRecordDigest("pack-draft", draft);
  return deepFreeze(draft);
}

export function buildKnowledgePackRelease(
  value: unknown,
  contextValue: unknown = emptyKnowledgeReleaseGraphContext()
): KnowledgePackRelease {
  const input = decodeStrict(
    KnowledgePackReleaseBuildInputSchema,
    value,
    "Knowledge Pack Release build input"
  );
  const draft = validateKnowledgeDraftGraph(input.draft, contextValue);
  assertReleaseSequence(input.sequence, draft);
  const core = {
    recordKind: "knowledge_pack_release" as const,
    schemaVersion: 1 as const,
    id: input.id,
    packId: draft.packId,
    sequence: input.sequence,
    sourceDraftRef: knowledgeRef(draft),
    authorityLane: draft.authorityLane,
    domains: draft.domains,
    candidates: draft.candidates,
    citedEvidenceRefs: draft.citedEvidenceRefs,
    applicabilityPredicates: draft.applicabilityPredicates,
    evidenceEdges: draft.evidenceEdges,
    constraintDerivations: draft.constraintDerivations,
    componentClosure: draft.componentClosure,
    componentMappings: draft.componentMappings,
    profiles: draft.profiles,
    predecessorRef: draft.predecessorRef,
    directDependencyRelations: draft.directDependencyRelations,
    dependencyClosure: draft.dependencyClosure,
    digestAlgorithm: "sha256" as const,
    contentMerkleRoot: draft.contentMerkleRoot,
    merkleRoot: draft.closureMerkleRoot,
  };
  return buildDigestedRecord(KnowledgePackReleaseSchema, "pack-release", core);
}

export function validateKnowledgePackRelease(value: unknown): KnowledgePackRelease {
  const release = decodeStrict(KnowledgePackReleaseSchema, value, "Knowledge Pack Release");
  assertDeclarativePayload(release);
  const canonical = canonicalizeReleaseContent(release);
  assertCanonicalReleaseContent(release, canonical);
  assertReleaseSequence(release.sequence, release);
  const contentMerkleRoot = knowledgeContentMerkleRoot(canonical);
  if (release.contentMerkleRoot !== contentMerkleRoot) {
    throw new Error("Knowledge Pack Release has a forged or stale content Merkle root");
  }
  const merkleRoot = knowledgeClosureMerkleRoot(canonical, contentMerkleRoot);
  if (release.merkleRoot !== merkleRoot) {
    throw new Error("Knowledge Pack Release has a forged or stale Merkle root");
  }
  assertRecordDigest("pack-release", release);
  return deepFreeze(release);
}

export function validateKnowledgeDraftGraph(
  value: unknown,
  contextValue: unknown
): KnowledgePackDraft {
  const draft = validateKnowledgePackDraft(value);
  const context = decodeKnowledgeReleaseGraphContext(contextValue);
  const expectedClosure = deriveDependencyClosureFromContext(
    draft.directDependencyRelations,
    context,
    draft.authorityLane
  );
  if (canonicalReferenceJson(draft.dependencyClosure) !== canonicalReferenceJson(expectedClosure)) {
    throw new Error("Knowledge Pack Draft dependency descriptors do not match exact release bytes");
  }
  return draft;
}

export function validateKnowledgeReleaseGraph(
  value: unknown,
  contextValue: unknown
): KnowledgePackRelease {
  const release = validateKnowledgePackRelease(value);
  const context = decodeKnowledgeReleaseGraphContext(contextValue);
  const matchingDrafts = context.drafts.filter((draft) =>
    refsEqual(knowledgeRef(draft), release.sourceDraftRef)
  );
  if (matchingDrafts.length !== 1) {
    throw new Error("Knowledge Pack Release requires its one exact source draft");
  }
  const sourceDraft = validateKnowledgePackDraft(matchingDrafts[0]);
  const dependencyContext = decodeKnowledgeReleaseGraphContext({
    schemaVersion: 1,
    drafts: context.drafts.filter(
      (draft) => !refsEqual(knowledgeRef(draft), release.sourceDraftRef)
    ),
    releases: context.releases,
  });
  validateKnowledgeDraftGraph(sourceDraft, dependencyContext);
  assertReleaseMatchesDraft(release, sourceDraft);
  return release;
}

function assertReleaseMatchesDraft(release: KnowledgePackRelease, draft: KnowledgePackDraft): void {
  if (
    release.sequence !== draft.revision ||
    !refsEqual(release.sourceDraftRef, knowledgeRef(draft)) ||
    release.packId !== draft.packId ||
    release.authorityLane !== draft.authorityLane ||
    release.contentMerkleRoot !== draft.contentMerkleRoot ||
    release.merkleRoot !== draft.closureMerkleRoot
  ) {
    throw new Error("Knowledge Pack Release does not exactly bind its source draft");
  }
  const releaseContent = canonicalizeReleaseContent(release);
  const draftContent = canonicalizeKnowledgeContent(draft);
  if (canonicalReferenceJson(releaseContent) !== canonicalReferenceJson(draftContent)) {
    throw new Error("Knowledge Pack Release content differs from its exact source draft");
  }
}

export function buildKnowledgeReleaseDependency(releaseValue: unknown): KnowledgeReleaseDependency {
  const release = validateKnowledgePackRelease(releaseValue);
  const core = {
    recordKind: "knowledge_release_dependency" as const,
    schemaVersion: 1 as const,
    id: release.id,
    releaseRef: knowledgeRef(release),
    packId: release.packId,
    sequence: release.sequence,
    predecessorRef: release.predecessorRef,
    authorityLane: release.authorityLane,
    directDependencyRelations: release.directDependencyRelations,
    releaseContentMerkleRoot: release.contentMerkleRoot,
    releaseMerkleRoot: release.merkleRoot,
  };
  return buildDigestedRecord(KnowledgeReleaseDependencySchema, "release-dependency", core);
}

export function validateKnowledgeReleaseDependency(value: unknown): KnowledgeReleaseDependency {
  const dependency = decodeStrict(
    KnowledgeReleaseDependencySchema,
    value,
    "Knowledge release dependency"
  );
  assertDeclarativePayload(dependency);
  assertCanonicalRecordCore(dependency, canonicalizeReleaseDependencyCore, "release dependency");
  assertRecordDigest("release-dependency", dependency);
  if (dependency.id !== dependency.releaseRef.id) {
    throw new Error("Release dependency identity must match its exact release reference");
  }
  assertDependencySequence(dependency.sequence, dependency);
  return deepFreeze(dependency);
}

export function validateSystemTestOnlyAttestationStructure(
  value: unknown
): SystemTestOnlyAttestation {
  const attestation = decodeStrict(
    SystemTestOnlyAttestationSchema,
    value,
    "System test-only attestation"
  );
  assertDeclarativePayload(attestation);
  assertCanonicalRecordCore(
    attestation,
    canonicalizeSystemTestOnlyAttestationCore,
    "system test-only attestation"
  );
  assertRecordDigest("system-test-only-attestation", attestation);
  return deepFreeze(attestation);
}

export function computeSystemTestOnlyAttestationDigest(value: unknown): string {
  const decoded = decodeStrict(
    SystemTestOnlyAttestationCoreSchema,
    value,
    "System test-only attestation core"
  );
  const canonical = canonicalizeSystemTestOnlyAttestationCore(decoded);
  assertDeclarativePayload(canonical);
  return knowledgeDigest("system-test-only-attestation", canonical);
}

export function buildKnowledgeSystemIdentitySnapshot(
  value: unknown
): KnowledgeSystemIdentitySnapshot {
  const core = decodeStrict(
    KnowledgeSystemIdentitySnapshotCoreSchema,
    value,
    "Knowledge system identity snapshot"
  );
  assertDeclarativePayload(core);
  return buildDigestedRecord(
    KnowledgeSystemIdentitySnapshotSchema,
    "system-identity-snapshot",
    core
  );
}

export function validateKnowledgeSystemIdentitySnapshot(
  value: unknown
): KnowledgeSystemIdentitySnapshot {
  const snapshot = decodeStrict(
    KnowledgeSystemIdentitySnapshotSchema,
    value,
    "Knowledge system identity snapshot"
  );
  assertDeclarativePayload(snapshot);
  assertRecordDigest("system-identity-snapshot", snapshot);
  return deepFreeze(snapshot);
}

export function buildKnowledgeTestPolicy(value: unknown): KnowledgeTestPolicy {
  const core = decodeStrict(KnowledgeTestPolicyCoreSchema, value, "Knowledge test policy");
  assertDeclarativePayload(core);
  return buildDigestedRecord(KnowledgeTestPolicySchema, "test-policy", core);
}

export function validateKnowledgeTestPolicy(value: unknown): KnowledgeTestPolicy {
  const policy = decodeStrict(KnowledgeTestPolicySchema, value, "Knowledge test policy");
  assertDeclarativePayload(policy);
  assertRecordDigest("test-policy", policy);
  return deepFreeze(policy);
}

export function validateSystemTestOnlyAttestation(
  value: unknown,
  contextValue: unknown
): SystemTestOnlyAttestation {
  const attestation = validateSystemTestOnlyAttestationStructure(value);
  const context = decodeStrict(
    SystemTestOnlyAttestationValidationContextSchema,
    contextValue,
    "System test-only attestation validation context"
  );
  const release = validateKnowledgeReleaseGraph(context.release, context.releaseGraphContext);
  const systemIdentity = validateKnowledgeSystemIdentitySnapshot(context.systemIdentity);
  const testPolicy = validateKnowledgeTestPolicy(context.testPolicy);
  if (!refsEqual(attestation.releaseRef, knowledgeRef(release))) {
    throw new Error("System test-only attestation does not bind the exact release bytes");
  }
  if (!refsEqual(attestation.issuer.systemRef, knowledgeRef(systemIdentity))) {
    throw new Error("System test-only attestation issuer does not bind the exact system identity");
  }
  if (!refsEqual(attestation.testPolicyRef, knowledgeRef(testPolicy))) {
    throw new Error("System test-only attestation does not bind the exact test policy");
  }
  if (
    attestation.evidenceRefs.length !== 1 ||
    !refsEqual(attestation.evidenceRefs[0]!, release.sourceDraftRef)
  ) {
    throw new Error(
      "System test-only attestation evidence must equal the exact source draft reference"
    );
  }
  if (!sameStringSet(attestation.permittedUses, testPolicy.permittedUses)) {
    throw new Error(
      "System test-only attestation uses do not exactly match the pinned test policy"
    );
  }
  if (attestation.issuedAt !== context.expectedIssuedAt) {
    throw new Error("System test-only attestation issue time is not bound to server context");
  }
  return attestation;
}

export function knowledgeRef(value: {
  readonly id: string;
  readonly digest: string;
}): KnowledgeRecordRef {
  return deepFreeze(
    decodeStrict(
      KnowledgeRecordRefSchema,
      { id: value.id, digest: value.digest },
      "Knowledge record reference"
    )
  );
}

function canonicalizePredicateCore(
  value: unknown
): Static<typeof KnowledgeApplicabilityPredicateCoreSchema> {
  const core = decodeStrict(
    KnowledgeApplicabilityPredicateCoreSchema,
    value,
    "Knowledge applicability predicate core"
  );
  return decodeStrict(
    KnowledgeApplicabilityPredicateCoreSchema,
    { ...core, requiredContextFields: sortStrings(core.requiredContextFields) },
    "Canonical Knowledge applicability predicate core"
  );
}

function canonicalizeCandidateCore(value: unknown): Static<typeof KnowledgeCandidateCoreSchema> {
  const core = decodeStrict(KnowledgeCandidateCoreSchema, value, "Knowledge candidate core");
  return decodeStrict(
    KnowledgeCandidateCoreSchema,
    {
      ...core,
      domains: sortStrings(core.domains),
      sourceSegmentRefs: sortRefs(core.sourceSegmentRefs),
      citedExtractionRefs: sortRefs(core.citedExtractionRefs),
      sourceProposalRefs: sortRefs(core.sourceProposalRefs),
      gatingPredicateRefs: sortRefs(core.gatingPredicateRefs),
      informationalPredicateRefs: sortRefs(core.informationalPredicateRefs),
    },
    "Canonical Knowledge candidate core"
  );
}

function canonicalizeDerivationCore(
  value: unknown
): Static<typeof KnowledgeConstraintDerivationCoreSchema> {
  const core = decodeStrict(
    KnowledgeConstraintDerivationCoreSchema,
    value,
    "Knowledge constraint derivation core"
  );
  return decodeStrict(
    KnowledgeConstraintDerivationCoreSchema,
    {
      ...core,
      inputs: sortByCanonical(core.inputs),
      gatingPredicateRefs: sortRefs(core.gatingPredicateRefs),
      limitations: sortStrings(core.limitations),
    },
    "Canonical Knowledge constraint derivation core"
  );
}

function canonicalizeComponentBindingCore(
  value: unknown
): Static<typeof KnowledgeComponentBindingCoreSchema> {
  const core = decodeStrict(
    KnowledgeComponentBindingCoreSchema,
    value,
    "Knowledge component binding core"
  );
  return decodeStrict(
    KnowledgeComponentBindingCoreSchema,
    { ...core, dependencyRefs: sortRefs(core.dependencyRefs) },
    "Canonical Knowledge component binding core"
  );
}

function canonicalizeComponentMappingBuildCore(
  value: unknown
): Static<typeof KnowledgeComponentMappingBuildCoreSchema> {
  const core = decodeStrict(
    KnowledgeComponentMappingBuildCoreSchema,
    value,
    "Knowledge component mapping build core"
  );
  return decodeStrict(
    KnowledgeComponentMappingBuildCoreSchema,
    {
      ...core,
      gatingPredicateRefs: sortRefs(core.gatingPredicateRefs),
      derivationRefs: sortRefs(core.derivationRefs),
    },
    "Canonical Knowledge component mapping build core"
  );
}

function canonicalizeComponentMappingCore(
  value: unknown
): Static<typeof KnowledgeComponentMappingCoreSchema> {
  const core = decodeStrict(
    KnowledgeComponentMappingCoreSchema,
    value,
    "Knowledge component mapping core"
  );
  return decodeStrict(
    KnowledgeComponentMappingCoreSchema,
    {
      ...core,
      gatingPredicateRefs: sortRefs(core.gatingPredicateRefs),
      derivationRefs: sortRefs(core.derivationRefs),
    },
    "Canonical Knowledge component mapping core"
  );
}

function canonicalizeEvidenceRoleIndex(
  value: Static<typeof KnowledgeEvidenceRoleIndexSchema>
): Static<typeof KnowledgeEvidenceRoleIndexSchema> {
  return {
    support: sortRefs(value.support),
    qualification: sortRefs(value.qualification),
    contradiction: sortRefs(value.contradiction),
    supersession: sortRefs(value.supersession),
    example: sortRefs(value.example),
    counterexample: sortRefs(value.counterexample),
    derivation: sortRefs(value.derivation),
    unresolved_ambiguity: sortRefs(value.unresolved_ambiguity),
  };
}

function canonicalizeProfileCore(value: unknown): Static<typeof KnowledgeProfileCoreSchema> {
  const core = decodeStrict(KnowledgeProfileCoreSchema, value, "Knowledge profile core");
  return decodeStrict(
    KnowledgeProfileCoreSchema,
    {
      ...core,
      domains: sortStrings(core.domains),
      gatingPredicateRefs: sortRefs(core.gatingPredicateRefs),
      informationalPredicateRefs: sortRefs(core.informationalPredicateRefs),
      assertionRefs: sortRefs(core.assertionRefs),
      openQuestionRefs: sortRefs(core.openQuestionRefs),
      evidenceEdgeRefs: sortRefs(core.evidenceEdgeRefs),
      evidenceRoleIndex: canonicalizeEvidenceRoleIndex(core.evidenceRoleIndex),
      derivationRefs: sortRefs(core.derivationRefs),
      componentMappingRefs: sortRefs(core.componentMappingRefs),
      expectedObservables: sortStrings(core.expectedObservables),
      limitations: sortStrings(core.limitations),
      unevaluatedDimensions: sortStrings(core.unevaluatedDimensions),
    },
    "Canonical Knowledge profile core"
  );
}

function canonicalizeReleaseDependencyCore(
  value: unknown
): Static<typeof KnowledgeReleaseDependencyCoreSchema> {
  const core = decodeStrict(
    KnowledgeReleaseDependencyCoreSchema,
    value,
    "Knowledge release dependency core"
  );
  return decodeStrict(
    KnowledgeReleaseDependencyCoreSchema,
    {
      ...core,
      directDependencyRelations: sortByCanonical(core.directDependencyRelations),
    },
    "Canonical Knowledge release dependency core"
  );
}

function canonicalizeSystemTestOnlyAttestationCore(
  value: unknown
): Static<typeof SystemTestOnlyAttestationCoreSchema> {
  const core = decodeStrict(
    SystemTestOnlyAttestationCoreSchema,
    value,
    "System test-only attestation core"
  );
  return decodeStrict(
    SystemTestOnlyAttestationCoreSchema,
    {
      ...core,
      permittedUses: sortStrings(core.permittedUses),
      evidenceRefs: sortRefs(core.evidenceRefs),
    },
    "Canonical System test-only attestation core"
  );
}

function assertCanonicalRecordCore(
  record: Record<string, unknown> & { readonly digest: string },
  canonicalize: (value: unknown) => unknown,
  label: string
): void {
  const { digest: _digest, ...core } = record;
  if (canonicalReferenceJson(core) !== canonicalReferenceJson(canonicalize(core))) {
    throw new Error(`${label} is not in deterministic canonical order`);
  }
}

function assertPredicateSemantics(
  predicate: Static<typeof KnowledgeApplicabilityPredicateCoreSchema>
): void {
  if (predicate.authorityLane !== "historical_practice") {
    throw new Error("Mace applicability predicates must remain in historical_practice");
  }
  const expected =
    predicate.expression.kind === "mace_twelve_course_notation_scope"
      ? ["instrument_family", "notation_system", "source_course_count", "source_profile"]
      : ["historical_sign_state", "instrument_family", "notation_system"];
  if (!sameStringSet(predicate.requiredContextFields, expected)) {
    throw new Error("Applicability predicate context fields do not exactly match its scope");
  }
}

function assertCandidateSemantics(candidate: Static<typeof KnowledgeCandidateCoreSchema>): void {
  if (candidate.version === 1 && candidate.parentVersionRef !== null) {
    throw new Error("Initial Knowledge Candidate versions cannot name a predecessor");
  }
  if (
    candidate.version > 1 &&
    (candidate.parentVersionRef === null ||
      candidate.parentVersionRef.familyId !== candidate.familyId ||
      candidate.parentVersionRef.id === candidate.id ||
      candidate.parentVersionRef.version !== candidate.version - 1)
  ) {
    throw new Error("Knowledge Candidate successors require their exact preceding version");
  }
  if (candidate.authorityLane !== "historical_practice") {
    throw new Error("The Mace candidates cannot mix or widen authority lanes");
  }
  if (candidate.proposition.kind === "mace_twelve_course_diapason_mapping") {
    if (
      candidate.nodeKind !== "assertion" ||
      candidate.epistemicForm !== "descriptive_observation" ||
      !sameStringSet(candidate.domains, ["instrument_technique", "notation"]) ||
      candidate.gatingPredicateRefs.length !== 1 ||
      candidate.informationalPredicateRefs.length !== 0
    ) {
      throw new Error("The Mace mapping assertion has incompatible candidate axes");
    }
    return;
  }
  if (
    candidate.nodeKind !== "research_question" ||
    candidate.epistemicForm !== "unresolved_question" ||
    !sameStringSet(candidate.domains, ["notation"]) ||
    candidate.gatingPredicateRefs.length !== 0 ||
    candidate.informationalPredicateRefs.length !== 1
  ) {
    throw new Error("The course-13 question has incompatible candidate axes");
  }
}

function assertEvidenceEdgeSemantics(edge: Static<typeof KnowledgeEvidenceEdgeCoreSchema>): void {
  if (
    edge.authorityLane !== "historical_practice" ||
    edge.source.authorityLane !== edge.authorityLane ||
    edge.target.authorityLane !== edge.authorityLane
  ) {
    throw new Error("Knowledge evidence edges cannot mix authority lanes");
  }
  if (refsEqual(edge.source.ref, edge.target.ref)) {
    throw new Error("Knowledge evidence edges cannot be self-referential");
  }
  const rules = {
    support: ["cited_extraction", "assertion", "source_directly_supports_mapping"],
    qualification: ["cited_extraction", "assertion", "scope_limited_to_twelve_courses"],
    contradiction: ["cited_extraction", "assertion", "source_conflicts_with_mapping"],
    supersession: ["candidate", null, "later_candidate_supersedes_prior"],
    example: ["cited_extraction", "assertion", "source_exemplifies_mapping"],
    counterexample: ["cited_extraction", "assertion", "source_is_counterexample"],
    derivation: ["constraint_derivation", "assertion", "constraint_derived_from_evidence"],
    unresolved_ambiguity: [
      "cited_extraction",
      "research_question",
      "source_does_not_establish_course_13",
    ],
  } as const;
  const [sourceKind, targetKind, rationaleCode] = rules[edge.role];
  if (
    edge.source.kind !== sourceKind ||
    (targetKind !== null && edge.target.nodeKind !== targetKind) ||
    edge.rationaleCode !== rationaleCode
  ) {
    throw new Error(`Evidence role ${edge.role} has incoherent source, target, or rationale`);
  }
  const expectedPredicateUse =
    edge.role === "unresolved_ambiguity" ||
    (edge.role === "supersession" && edge.target.nodeKind === "research_question")
      ? "informational"
      : "gating";
  if (edge.predicateBinding.use !== expectedPredicateUse) {
    throw new Error(`Evidence role ${edge.role} has incoherent predicate authority use`);
  }
}

function assertDerivationSemantics(
  derivation: Static<typeof KnowledgeConstraintDerivationCoreSchema>
): void {
  if (
    derivation.authorityLane !== "historical_practice" ||
    derivation.inputs.some(({ authorityLane }) => authorityLane !== derivation.authorityLane)
  ) {
    throw new Error("Constraint derivations require a single matching authority lane");
  }
  if (
    !sameStringSet(derivation.limitations, ["course_13_unresolved", "twelve_course_source_only"])
  ) {
    throw new Error("Mace derivations must preserve the twelve-course and course-13 limits");
  }
}

function assertComponentBindingSemantics(
  binding: Static<typeof KnowledgeComponentBindingCoreSchema>
): void {
  if (binding.authorityLane !== "historical_practice") {
    throw new Error("The Mace component binding cannot mix authority lanes");
  }
  if (
    binding.compatibility.minimumInterfaceVersion > binding.compatibility.maximumInterfaceVersion
  ) {
    throw new Error("Component compatibility range is inverted");
  }
  if (
    binding.replay.state === "available" &&
    !refsEqual(binding.artifactRef, binding.replay.artifactRef)
  ) {
    throw new Error("Replay must bind the exact registered artifact");
  }
  if (binding.dependencyRefs.some((dependencyRef) => dependencyRef.id === binding.id)) {
    throw new Error("Component bindings cannot depend on themselves");
  }
}

function assertComponentMappingSemantics(
  mapping: Static<typeof KnowledgeComponentMappingCoreSchema>
): void {
  if (mapping.authorityLane !== "historical_practice") {
    throw new Error("The Mace component mapping cannot mix authority lanes");
  }
  if (mapping.parameters.values.course13Policy !== "unresolved_no_mapping") {
    throw new Error("Component mappings cannot infer a course-13 historical sign");
  }
}

function assertProfileSemantics(profile: Static<typeof KnowledgeProfileCoreSchema>): void {
  if (
    profile.authorityLane !== "historical_practice" ||
    !sameStringSet(profile.domains, ["instrument_technique", "notation"])
  ) {
    throw new Error("The Mace profile has mixed or incompatible authority axes");
  }
  if (
    !profile.outcomes.prohibited.includes("infer_course_13_sign_by_sequence") ||
    !profile.unevaluatedDimensions.includes("course_13_historical_sign")
  ) {
    throw new Error("The Mace profile widens unresolved course-13 scope");
  }
  const outcomeBuckets = [
    ...profile.outcomes.permitted,
    ...profile.outcomes.preferred,
    ...profile.outcomes.discouraged,
    ...profile.outcomes.prohibited,
  ];
  if (new Set(outcomeBuckets).size !== outcomeBuckets.length) {
    throw new Error("Knowledge profile outcome buckets must be pairwise disjoint");
  }
  if (profile.evidenceRoleIndex.counterexample.length !== 0) {
    throw new Error("The cited Mace segment does not support a factual counterexample edge");
  }
}

function emptyKnowledgeReleaseGraphContext(): KnowledgeReleaseGraphContext {
  return { schemaVersion: 1, drafts: [], releases: [] };
}

function decodeKnowledgeReleaseGraphContext(value: unknown): KnowledgeReleaseGraphContext {
  const context = decodeStrict(
    KnowledgeReleaseGraphContextSchema,
    value,
    "Knowledge release graph context"
  );
  assertUniqueRecordIdentities(context.drafts);
  assertUniqueRecordIdentities(context.releases);
  return context;
}

function deriveDependencyClosureFromContext(
  directDependencyRelations: readonly KnowledgeDependencyRelation[],
  context: KnowledgeReleaseGraphContext,
  rootAuthorityLane: KnowledgeAuthorityLane
): KnowledgeReleaseDependency[] {
  assertUniqueDependencyTargets(directDependencyRelations);
  const releaseByRef = new Map<string, KnowledgePackRelease>();
  const draftByRef = new Map<string, KnowledgePackDraft>();
  for (const releaseValue of context.releases) {
    const release = validateKnowledgePackRelease(releaseValue);
    const key = refKey(release);
    if (releaseByRef.has(key)) throw new Error("Duplicate exact release in graph context");
    releaseByRef.set(key, release);
  }
  for (const draftValue of context.drafts) {
    const draft = validateKnowledgePackDraft(draftValue);
    const key = refKey(draft);
    if (draftByRef.has(key)) throw new Error("Duplicate exact draft in graph context");
    draftByRef.set(key, draft);
  }

  const visitedReleases = new Set<string>();
  const requiredDrafts = new Set<string>();
  const visiting = new Set<string>();
  const visit = (
    relation: KnowledgeDependencyRelation,
    parentAuthorityLane: KnowledgeAuthorityLane
  ): void => {
    const key = refKey(relation.targetRef);
    const release = requireRef(releaseByRef, relation.targetRef, "full dependency release");
    if (relation.role === "same_lane_authority" && release.authorityLane !== parentAuthorityLane) {
      throw new Error("Cross-lane dependency can only be evidence or conflict context");
    }
    if (visitedReleases.has(key)) return;
    if (visiting.has(key)) throw new Error("Full release dependency graph contains a cycle");
    visiting.add(key);
    const draft = requireRef(draftByRef, release.sourceDraftRef, "dependency source draft");
    requiredDrafts.add(refKey(draft));
    assertReleaseMatchesDraft(release, draft);
    assertUniqueDependencyTargets(release.directDependencyRelations);
    for (const childRelation of release.directDependencyRelations) {
      visit(childRelation, release.authorityLane);
    }
    visiting.delete(key);
    visitedReleases.add(key);
  };

  for (const relation of directDependencyRelations) {
    visit(relation, rootAuthorityLane);
  }

  if (
    visitedReleases.size !== releaseByRef.size ||
    [...releaseByRef.keys()].some((key) => !visitedReleases.has(key))
  ) {
    throw new Error("Knowledge release graph context contains an unreachable extra release");
  }
  if (
    requiredDrafts.size !== draftByRef.size ||
    [...draftByRef.keys()].some((key) => !requiredDrafts.has(key))
  ) {
    throw new Error("Knowledge release graph context contains a missing or extra source draft");
  }

  const expectedClosure = expectedDescriptorClosure(directDependencyRelations, releaseByRef);
  for (const release of releaseByRef.values()) {
    const expectedNestedClosure = expectedDescriptorClosure(
      release.directDependencyRelations,
      releaseByRef
    );
    if (
      canonicalReferenceJson(release.dependencyClosure) !==
      canonicalReferenceJson(expectedNestedClosure)
    ) {
      throw new Error("Release dependency descriptor differs from exact resolved release bytes");
    }
    const sourceDraft = requireRef(draftByRef, release.sourceDraftRef, "dependency source draft");
    if (
      canonicalReferenceJson(sourceDraft.dependencyClosure) !==
      canonicalReferenceJson(expectedNestedClosure)
    ) {
      throw new Error(
        "Source draft dependency descriptor differs from exact resolved release bytes"
      );
    }
  }
  return expectedClosure;
}

function expectedDescriptorClosure(
  directDependencyRelations: readonly KnowledgeDependencyRelation[],
  releaseByRef: ReadonlyMap<string, KnowledgePackRelease>
): KnowledgeReleaseDependency[] {
  const records: KnowledgeReleaseDependency[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (reference: KnowledgeRecordRef): void => {
    const key = refKey(reference);
    if (visited.has(key)) return;
    if (visiting.has(key)) throw new Error("Full release dependency graph contains a cycle");
    const release = requireRef(releaseByRef, reference, "full dependency release");
    visiting.add(key);
    for (const relation of release.directDependencyRelations) visit(relation.targetRef);
    visiting.delete(key);
    visited.add(key);
    records.push(buildKnowledgeReleaseDependency(release));
  };
  for (const relation of directDependencyRelations) visit(relation.targetRef);
  return canonicalDependencyClosure(records, [...directDependencyRelations]);
}

type KnowledgeContentInput = Pick<
  Static<typeof KnowledgePackDraftCanonicalCoreSchema>,
  | "packId"
  | "authorityLane"
  | "domains"
  | "citedEvidenceRefs"
  | "candidates"
  | "applicabilityPredicates"
  | "evidenceEdges"
  | "constraintDerivations"
  | "componentClosure"
  | "componentMappings"
  | "profiles"
  | "predecessorRef"
  | "directDependencyRelations"
  | "dependencyClosure"
>;

function canonicalizeDraftCore(
  core: Static<typeof KnowledgePackDraftCanonicalCoreSchema>
): Static<typeof KnowledgePackDraftCanonicalCoreSchema> {
  const content = canonicalizeKnowledgeContent(core);
  return decodeStrict(
    KnowledgePackDraftCanonicalCoreSchema,
    { ...core, ...content },
    "Canonical Knowledge Pack Draft"
  );
}

function canonicalizeReleaseContent(release: KnowledgePackRelease): KnowledgeContentInput {
  return canonicalizeKnowledgeContent(release);
}

function canonicalizeKnowledgeContent(value: KnowledgeContentInput): KnowledgeContentInput {
  const candidates = sortRecords(value.candidates.map(validateKnowledgeCandidate));
  const applicabilityPredicates = sortRecords(
    value.applicabilityPredicates.map(validateKnowledgeApplicabilityPredicate)
  );
  const evidenceEdges = sortRecords(value.evidenceEdges.map(validateKnowledgeEvidenceEdge));
  const constraintDerivations = sortRecords(
    value.constraintDerivations.map(validateKnowledgeConstraintDerivation)
  );
  const componentMappings = sortRecords(
    value.componentMappings.map(validateKnowledgeComponentMapping)
  );
  const profiles = sortRecords(value.profiles.map(validateKnowledgeProfile));
  const componentClosure = canonicalComponentClosure(
    value.componentClosure.map(validateKnowledgeComponentBinding),
    componentMappings
  );
  const dependencyClosure = canonicalDependencyClosure(
    value.dependencyClosure.map(validateKnowledgeReleaseDependency),
    value.directDependencyRelations
  );
  const canonical = {
    packId: value.packId,
    authorityLane: value.authorityLane,
    domains: sortStrings(value.domains),
    citedEvidenceRefs: sortExternalRefs(value.citedEvidenceRefs),
    candidates,
    applicabilityPredicates,
    evidenceEdges,
    constraintDerivations,
    componentClosure,
    componentMappings,
    profiles,
    predecessorRef: value.predecessorRef,
    directDependencyRelations: sortByCanonical(value.directDependencyRelations),
    dependencyClosure,
  } satisfies KnowledgeContentInput;
  assertKnowledgeGraphSemantics(canonical);
  return canonical;
}

function assertCanonicalReleaseContent(
  release: KnowledgePackRelease,
  canonical: KnowledgeContentInput
): void {
  const current: KnowledgeContentInput = {
    packId: release.packId,
    authorityLane: release.authorityLane,
    domains: release.domains,
    citedEvidenceRefs: release.citedEvidenceRefs,
    candidates: release.candidates,
    applicabilityPredicates: release.applicabilityPredicates,
    evidenceEdges: release.evidenceEdges,
    constraintDerivations: release.constraintDerivations,
    componentClosure: release.componentClosure,
    componentMappings: release.componentMappings,
    profiles: release.profiles,
    predecessorRef: release.predecessorRef,
    directDependencyRelations: release.directDependencyRelations,
    dependencyClosure: release.dependencyClosure,
  };
  if (canonicalReferenceJson(current) !== canonicalReferenceJson(canonical)) {
    throw new Error("Knowledge Pack Release graph is not in deterministic canonical order");
  }
}

function assertKnowledgeGraphSemantics(content: KnowledgeContentInput): void {
  if (
    content.authorityLane !== "historical_practice" ||
    !sameStringSet(content.domains, ["instrument_technique", "notation"])
  ) {
    throw new Error("Mace Knowledge Packs cannot mix or widen authority lanes and domains");
  }
  const laneRecords = [
    ...content.candidates,
    ...content.applicabilityPredicates,
    ...content.evidenceEdges,
    ...content.constraintDerivations,
    ...content.componentClosure,
    ...content.componentMappings,
    ...content.profiles,
  ];
  if (laneRecords.some(({ authorityLane }) => authorityLane !== content.authorityLane)) {
    throw new Error("Knowledge Pack closure contains a mixed authority lane");
  }
  assertUniqueRecordIdentities(laneRecords);
  assertNoAttestationInClosure(content);

  const candidateByRef = mapByRef(content.candidates);
  const predicateByRef = mapByRef(content.applicabilityPredicates);
  const edgeByRef = mapByRef(content.evidenceEdges);
  const derivationByRef = mapByRef(content.constraintDerivations);
  const bindingByRef = mapByRef(content.componentClosure);
  const mappingByRef = mapByRef(content.componentMappings);
  const familyVersions = new Map<string, Set<number>>();
  for (const candidate of content.candidates) {
    const versions = familyVersions.get(candidate.familyId) ?? new Set<number>();
    if (versions.has(candidate.version)) {
      throw new Error("Knowledge Candidate family/version identity must be unique");
    }
    versions.add(candidate.version);
    familyVersions.set(candidate.familyId, versions);
  }
  for (const versions of familyVersions.values()) {
    const ordered = [...versions].sort((left, right) => left - right);
    if (ordered.some((version, index) => version !== index + 1)) {
      throw new Error(
        "Knowledge Candidate family must retain one contiguous root-to-current chain"
      );
    }
  }

  const expectedCandidateRefs = content.profiles
    .flatMap((profile) => [...profile.assertionRefs, ...profile.openQuestionRefs])
    .concat(
      content.evidenceEdges.flatMap(({ source, target }) => [
        ...(source.kind === "candidate" ? [source.ref] : []),
        target.ref,
      ]),
      content.constraintDerivations.flatMap(({ inputs }) =>
        inputs.flatMap((input) => (input.kind === "candidate" ? [input.ref] : []))
      ),
      content.candidates.flatMap(({ parentVersionRef }) =>
        parentVersionRef === null ? [] : [knowledgeRef(parentVersionRef)]
      )
    );
  assertExactRecordClosure(content.candidates, expectedCandidateRefs, "candidate");
  const expectedPredicateRefs = [
    ...content.profiles.flatMap(({ gatingPredicateRefs, informationalPredicateRefs }) => [
      ...gatingPredicateRefs,
      ...informationalPredicateRefs,
    ]),
    ...content.candidates.flatMap(({ gatingPredicateRefs, informationalPredicateRefs }) => [
      ...gatingPredicateRefs,
      ...informationalPredicateRefs,
    ]),
    ...content.evidenceEdges.map(({ predicateBinding }) => predicateBinding.predicateRef),
    ...content.constraintDerivations.flatMap(({ gatingPredicateRefs }) => gatingPredicateRefs),
    ...content.componentMappings.flatMap(({ gatingPredicateRefs }) => gatingPredicateRefs),
  ];
  assertExactRecordClosure(
    content.applicabilityPredicates,
    expectedPredicateRefs,
    "applicability predicate"
  );
  assertExactRecordClosure(
    content.evidenceEdges,
    content.profiles.flatMap(({ evidenceEdgeRefs }) => evidenceEdgeRefs),
    "evidence edge"
  );
  assertExactRecordClosure(
    content.constraintDerivations,
    [
      ...content.profiles.flatMap(({ derivationRefs }) => derivationRefs),
      ...content.componentMappings.flatMap(({ derivationRefs }) => derivationRefs),
    ],
    "constraint derivation"
  );
  assertExactRecordClosure(
    content.componentMappings,
    content.profiles.flatMap(({ componentMappingRefs }) => componentMappingRefs),
    "component mapping"
  );

  const exactCitations = uniqueExternalRefs([
    ...content.candidates.flatMap(({ sourceSegmentRefs }) => sourceSegmentRefs),
    ...content.candidates.flatMap(({ citedExtractionRefs }) => citedExtractionRefs),
    ...content.candidates.flatMap(({ sourceProposalRefs }) => sourceProposalRefs),
    ...content.evidenceEdges.flatMap(({ source }) =>
      source.kind === "cited_extraction" ? [source.ref] : []
    ),
  ]);
  if (!sameExternalRefSet(content.citedEvidenceRefs, exactCitations)) {
    throw new Error("Knowledge Pack cited-evidence closure is missing or contains extra refs");
  }

  for (const candidate of content.candidates) {
    const predicateRefs = [
      ...candidate.gatingPredicateRefs,
      ...candidate.informationalPredicateRefs,
    ];
    for (const predicateRef of predicateRefs) {
      const predicate = requireRef(predicateByRef, predicateRef, "candidate predicate");
      if (
        candidate.proposition.kind === "mace_twelve_course_diapason_mapping" &&
        predicate.expression.kind !== "mace_twelve_course_notation_scope"
      ) {
        throw new Error("Mace mapping candidate widens its applicability predicate");
      }
      if (
        candidate.proposition.kind === "course_thirteen_notation_question" &&
        predicate.expression.kind !== "course_thirteen_notation_research_scope"
      ) {
        throw new Error("Course-13 question must remain research-only and unresolved");
      }
    }
    if (candidate.version > 1) {
      const parentRef = candidate.parentVersionRef!;
      const parent = requireRef(candidateByRef, parentRef, "candidate predecessor");
      if (
        parent.id !== parentRef.id ||
        parent.familyId !== candidate.familyId ||
        parent.familyId !== parentRef.familyId ||
        parent.version !== candidate.version - 1 ||
        parent.version !== parentRef.version ||
        parent.digest !== parentRef.digest ||
        parent.nodeKind !== candidate.nodeKind
      ) {
        throw new Error("Knowledge Candidate parent does not resolve to the exact prior version");
      }
      const supersessionEdges = content.evidenceEdges.filter(
        (edge) =>
          edge.role === "supersession" &&
          edge.source.kind === "candidate" &&
          refsEqual(edge.source.ref, knowledgeRef(candidate)) &&
          refsEqual(edge.target.ref, knowledgeRef(parent))
      );
      if (supersessionEdges.length !== 1) {
        throw new Error(
          "Knowledge Candidate successor requires exactly one exact supersession edge"
        );
      }
    }
  }

  for (const edge of content.evidenceEdges) {
    const target = requireRef(candidateByRef, edge.target.ref, "evidence target");
    if (
      target.nodeKind !== edge.target.nodeKind ||
      target.authorityLane !== edge.target.authorityLane
    ) {
      throw new Error("Evidence target axes disagree with the referenced candidate");
    }
    requireRef(predicateByRef, edge.predicateBinding.predicateRef, "evidence predicate");
    const targetPredicateRefs =
      edge.predicateBinding.use === "gating"
        ? target.gatingPredicateRefs
        : target.informationalPredicateRefs;
    if (
      !targetPredicateRefs.some((reference) =>
        refsEqual(reference, edge.predicateBinding.predicateRef)
      )
    ) {
      throw new Error(
        "Evidence predicate binding does not match the target candidate authority use"
      );
    }
    if (
      edge.source.kind === "cited_extraction" &&
      !target.citedExtractionRefs.some((reference) => refsEqual(reference, edge.source.ref))
    ) {
      throw new Error("Cited evidence edge source is not an exact extraction cited by its target");
    }
    if (edge.source.kind === "candidate") {
      const source = requireRef(candidateByRef, edge.source.ref, "evidence source candidate");
      if (
        source.nodeKind !== target.nodeKind ||
        source.familyId !== target.familyId ||
        source.version !== target.version + 1 ||
        source.parentVersionRef === null ||
        source.parentVersionRef.id !== target.id ||
        source.parentVersionRef.familyId !== target.familyId ||
        source.parentVersionRef.version !== target.version ||
        source.parentVersionRef.digest !== target.digest
      ) {
        throw new Error("Supersession evidence must bind the exact preceding candidate version");
      }
    }
    if (edge.source.kind === "constraint_derivation") {
      const derivation = requireRef(derivationByRef, edge.source.ref, "evidence source derivation");
      if (
        !derivation.inputs.some(
          (input) => input.kind === "candidate" && refsEqual(input.ref, edge.target.ref)
        ) ||
        !derivation.gatingPredicateRefs.some((predicateRef) =>
          refsEqual(predicateRef, edge.predicateBinding.predicateRef)
        )
      ) {
        throw new Error("Derivation evidence target must be an exact assertion input");
      }
    }
  }

  for (const derivation of content.constraintDerivations) {
    const candidateInputRefs = derivation.inputs.flatMap((input) =>
      input.kind === "candidate" ? [input.ref] : []
    );
    const evidenceInputs = derivation.inputs.filter(
      (input): input is Extract<(typeof derivation.inputs)[number], { kind: "evidence_edge" }> =>
        input.kind === "evidence_edge"
    );
    if (candidateInputRefs.length === 0 || evidenceInputs.length === 0) {
      throw new Error(
        "Constraint derivation requires a current assertion and supporting or qualifying evidence"
      );
    }
    for (const input of derivation.inputs) {
      if (input.kind === "candidate") {
        const candidate = requireRef(candidateByRef, input.ref, "derivation candidate");
        const maximumVersion = Math.max(...familyVersions.get(candidate.familyId)!);
        if (
          candidate.nodeKind !== "assertion" ||
          candidate.reviewState === "rejected" ||
          candidate.reviewState === "superseded" ||
          candidate.version !== maximumVersion
        ) {
          throw new Error(
            "A course-mapping derivation requires a current non-rejected assertion input"
          );
        }
      } else {
        const edge = requireRef(edgeByRef, input.ref, "derivation evidence edge");
        if (edge.role !== "support" && edge.role !== "qualification") {
          throw new Error(
            "A constraint derivation may consume only support or qualification evidence"
          );
        }
        if (!candidateInputRefs.some((candidateRef) => refsEqual(candidateRef, edge.target.ref))) {
          throw new Error("Derivation evidence must target one of its exact candidate inputs");
        }
      }
    }
    derivation.gatingPredicateRefs.forEach((predicateRef) =>
      requireRef(predicateByRef, predicateRef, "derivation predicate")
    );
    const exactDerivationPredicates = uniqueRefs(
      derivation.inputs.flatMap((input) => {
        if (input.kind === "candidate") {
          return requireRef(candidateByRef, input.ref, "derivation candidate").gatingPredicateRefs;
        }
        const edge = requireRef(edgeByRef, input.ref, "derivation evidence edge");
        return edge.predicateBinding.use === "gating" ? [edge.predicateBinding.predicateRef] : [];
      })
    );
    if (!sameRefSet(derivation.gatingPredicateRefs, exactDerivationPredicates)) {
      throw new Error("Derivation gating predicates do not equal its authoritative inputs");
    }
  }

  for (const mapping of content.componentMappings) {
    const binding = requireRef(bindingByRef, mapping.componentBindingRef, "component binding");
    if (
      !refsEqual(mapping.parameters.parameterSchemaRef, binding.parameterSchemaRef) ||
      !refsEqual(mapping.parameters.unitSchemaRef, binding.unitSchemaRef)
    ) {
      throw new Error(
        "Component mapping parameter or unit binding does not match the registry binding"
      );
    }
    mapping.derivationRefs.forEach((derivationRef) =>
      requireRef(derivationByRef, derivationRef, "component derivation")
    );
    mapping.gatingPredicateRefs.forEach((predicateRef) =>
      requireRef(predicateByRef, predicateRef, "component predicate")
    );
    const exactMappingPredicates = uniqueRefs(
      mapping.derivationRefs.flatMap(
        (derivationRef) =>
          requireRef(derivationByRef, derivationRef, "component derivation").gatingPredicateRefs
      )
    );
    if (!sameRefSet(mapping.gatingPredicateRefs, exactMappingPredicates)) {
      throw new Error("Component mapping gating predicates do not equal its derivations");
    }
  }

  for (const profile of content.profiles) {
    if (profile.openQuestionRefs.length === 0) {
      throw new Error("Mace release profile must retain its open course-13 question");
    }
    const supersededTargetRefs = content.evidenceEdges
      .filter(({ role }) => role === "supersession")
      .map(({ target }) => target.ref);
    profile.assertionRefs.forEach((candidateRef) => {
      const candidate = requireRef(candidateByRef, candidateRef, "profile assertion");
      const maximumVersion = Math.max(...familyVersions.get(candidate.familyId)!);
      if (
        candidate.nodeKind !== "assertion" ||
        candidate.reviewState === "rejected" ||
        candidate.reviewState === "superseded" ||
        candidate.version !== maximumVersion ||
        supersededTargetRefs.some((targetRef) => refsEqual(targetRef, candidateRef))
      ) {
        throw new Error("Profile assertion refs must resolve to current non-rejected assertions");
      }
    });
    profile.openQuestionRefs.forEach((candidateRef) => {
      const candidate = requireRef(candidateByRef, candidateRef, "profile open question");
      const maximumVersion = Math.max(...familyVersions.get(candidate.familyId)!);
      if (
        candidate.nodeKind !== "research_question" ||
        candidate.reviewState === "rejected" ||
        candidate.reviewState === "superseded" ||
        candidate.version !== maximumVersion ||
        supersededTargetRefs.some((targetRef) => refsEqual(targetRef, candidateRef))
      ) {
        throw new Error(
          "Profile open-question refs must remain current non-rejected research questions"
        );
      }
    });
    for (const role of KNOWLEDGE_EVIDENCE_ROLES) {
      const expectedRoleRefs = profile.evidenceEdgeRefs.filter(
        (edgeRef) => requireRef(edgeByRef, edgeRef, `${role} edge`).role === role
      );
      if (!sameRefSet(profile.evidenceRoleIndex[role], expectedRoleRefs)) {
        throw new Error(`Profile ${role} index does not exactly equal retained role edges`);
      }
    }
    for (const edgeRef of profile.evidenceEdgeRefs) {
      const edge = requireRef(edgeByRef, edgeRef, "profile evidence edge");
      if (edge.role === "supersession") continue;
      const expectedTargets =
        edge.predicateBinding.use === "gating" ? profile.assertionRefs : profile.openQuestionRefs;
      if (!expectedTargets.some((candidateRef) => refsEqual(candidateRef, edge.target.ref))) {
        throw new Error(
          edge.predicateBinding.use === "gating"
            ? "Profile authoritative evidence must target a current profile assertion"
            : "Profile informational evidence must target a current open question"
        );
      }
      if (
        edge.source.kind === "constraint_derivation" &&
        !profile.derivationRefs.some((derivationRef) => refsEqual(derivationRef, edge.source.ref))
      ) {
        throw new Error("Profile derivation evidence must name one of its exact derivations");
      }
    }
    profile.derivationRefs.forEach((derivationRef) => {
      const derivation = requireRef(derivationByRef, derivationRef, "profile derivation");
      const derivationAssertions = derivation.inputs.flatMap((input) =>
        input.kind === "candidate" ? [input.ref] : []
      );
      if (
        derivationAssertions.length === 0 ||
        derivationAssertions.some(
          (candidateRef) =>
            !profile.assertionRefs.some((assertionRef) => refsEqual(assertionRef, candidateRef))
        )
      ) {
        throw new Error("Profile derivations must consume only its current assertion refs");
      }
    });
    const profileMappings = profile.componentMappingRefs.map((mappingRef) =>
      requireRef(mappingByRef, mappingRef, "profile component mapping")
    );
    const mappedDerivationRefs = uniqueRefs(
      profileMappings.flatMap(({ derivationRefs }) => derivationRefs)
    );
    if (!sameRefSet(profile.derivationRefs, mappedDerivationRefs)) {
      throw new Error("Profile mappings must bind exactly the profile derivation closure");
    }
    const exactProfileGating = uniqueRefs([
      ...profile.assertionRefs.flatMap(
        (candidateRef) =>
          requireRef(candidateByRef, candidateRef, "profile assertion").gatingPredicateRefs
      ),
      ...profile.derivationRefs.flatMap(
        (derivationRef) =>
          requireRef(derivationByRef, derivationRef, "profile derivation").gatingPredicateRefs
      ),
      ...profile.componentMappingRefs.flatMap(
        (mappingRef) => requireRef(mappingByRef, mappingRef, "profile mapping").gatingPredicateRefs
      ),
      ...profile.evidenceEdgeRefs.flatMap((edgeRef) => {
        const edge = requireRef(edgeByRef, edgeRef, "profile evidence edge");
        return edge.predicateBinding.use === "gating" ? [edge.predicateBinding.predicateRef] : [];
      }),
    ]);
    const exactProfileInformational = uniqueRefs([
      ...profile.openQuestionRefs.flatMap(
        (candidateRef) =>
          requireRef(candidateByRef, candidateRef, "profile open question")
            .informationalPredicateRefs
      ),
      ...profile.evidenceEdgeRefs.flatMap((edgeRef) => {
        const edge = requireRef(edgeByRef, edgeRef, "profile evidence edge");
        return edge.predicateBinding.use === "informational"
          ? [edge.predicateBinding.predicateRef]
          : [];
      }),
    ]);
    if (!sameRefSet(profile.gatingPredicateRefs, exactProfileGating)) {
      throw new Error("Profile gating predicates do not equal its retained authoritative graph");
    }
    if (!sameRefSet(profile.informationalPredicateRefs, exactProfileInformational)) {
      throw new Error("Profile informational predicates do not equal its retained research graph");
    }
    const researchPredicates = content.applicabilityPredicates
      .filter(({ expression }) => expression.kind === "course_thirteen_notation_research_scope")
      .map(knowledgeRef);
    if (
      profile.gatingPredicateRefs.some((reference) =>
        researchPredicates.some((research) => refsEqual(reference, research))
      )
    ) {
      throw new Error("Course-13 research predicate cannot gate the courses 7-12 profile");
    }
  }
}

const KNOWLEDGE_EVIDENCE_ROLES = [
  "support",
  "qualification",
  "contradiction",
  "supersession",
  "example",
  "counterexample",
  "derivation",
  "unresolved_ambiguity",
] as const satisfies readonly KnowledgeEvidenceRole[];

function canonicalComponentClosure(
  bindings: KnowledgeComponentBinding[],
  mappings: KnowledgeComponentMapping[]
): KnowledgeComponentBinding[] {
  const byRef = mapByRef(bindings);
  const ordered: KnowledgeComponentBinding[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (reference: KnowledgeRecordRef): void => {
    const key = refKey(reference);
    if (visited.has(key)) return;
    if (visiting.has(key)) throw new Error("Component dependency closure contains a cycle");
    const binding = requireRef(byRef, reference, "component dependency");
    visiting.add(key);
    for (const dependencyRef of sortRefs(binding.dependencyRefs)) visit(dependencyRef);
    visiting.delete(key);
    visited.add(key);
    ordered.push(binding);
  };
  for (const root of sortRefs(mappings.map(({ componentBindingRef }) => componentBindingRef))) {
    visit(root);
  }
  if (visited.size !== bindings.length) {
    throw new Error("Component dependency closure contains an unreachable extra binding");
  }
  return ordered;
}

function canonicalDependencyClosure(
  dependencies: KnowledgeReleaseDependency[],
  directDependencyRelations: KnowledgeDependencyRelation[]
): KnowledgeReleaseDependency[] {
  const byReleaseRef = new Map<string, KnowledgeReleaseDependency>();
  const ids = new Set<string>();
  for (const dependency of dependencies) {
    const key = refKey(dependency.releaseRef);
    if (byReleaseRef.has(key) || ids.has(dependency.releaseRef.id)) {
      throw new Error("Release dependency closure contains duplicate release identity");
    }
    byReleaseRef.set(key, dependency);
    ids.add(dependency.releaseRef.id);
  }
  const ordered: KnowledgeReleaseDependency[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (reference: KnowledgeRecordRef): void => {
    const key = refKey(reference);
    if (visited.has(key)) return;
    if (visiting.has(key)) throw new Error("Release dependency closure contains a cycle");
    const dependency = requireRef(byReleaseRef, reference, "release dependency");
    visiting.add(key);
    for (const { targetRef: childRef } of sortByCanonical(dependency.directDependencyRelations)) {
      const child = requireRef(byReleaseRef, childRef, "transitive release dependency");
      const relation = dependency.directDependencyRelations.find(({ targetRef }) =>
        refsEqual(targetRef, childRef)
      )!;
      if (
        relation.role === "same_lane_authority" &&
        child.authorityLane !== dependency.authorityLane
      ) {
        throw new Error("Cross-lane dependencies cannot claim same-lane authority");
      }
      if (child.packId === dependency.packId && child.sequence >= dependency.sequence) {
        throw new Error("Release dependency closure contains a same-pack forward dependency");
      }
      visit(childRef);
    }
    visiting.delete(key);
    visited.add(key);
    ordered.push(dependency);
  };
  assertUniqueDependencyTargets(directDependencyRelations);
  for (const { targetRef } of sortByCanonical(directDependencyRelations)) visit(targetRef);
  if (visited.size !== dependencies.length) {
    throw new Error("Release dependency closure contains an unreachable extra release");
  }
  return ordered;
}

function assertReleaseSequence(
  sequence: number,
  value: Pick<
    KnowledgePackDraft | KnowledgePackRelease,
    | "packId"
    | "authorityLane"
    | "predecessorRef"
    | "directDependencyRelations"
    | "dependencyClosure"
    | "contentMerkleRoot"
  >
): void {
  assertDependencySequence(sequence, value);
  for (const relation of value.directDependencyRelations) {
    const dependency = value.dependencyClosure.find(({ releaseRef }) =>
      refsEqual(releaseRef, relation.targetRef)
    );
    if (!dependency) throw new Error("Direct dependency relation is absent from closure");
    if (
      relation.role === "same_lane_authority" &&
      dependency.authorityLane !== value.authorityLane
    ) {
      throw new Error("Cross-lane dependencies cannot claim same-lane authority");
    }
  }
  if (sequence === 1) {
    if (value.dependencyClosure.some(({ packId }) => packId === value.packId)) {
      throw new Error("An initial release cannot depend forward on its own pack");
    }
    return;
  }
  const predecessorRef = value.predecessorRef!;
  const predecessor = value.dependencyClosure.find(({ releaseRef }) =>
    refsEqual(releaseRef, predecessorRef)
  );
  if (
    !predecessor ||
    predecessor.packId !== value.packId ||
    predecessor.sequence !== sequence - 1 ||
    predecessor.authorityLane !== value.authorityLane
  ) {
    throw new Error("Release predecessor must be the exact prior same-lane pack release");
  }
  const predecessorRelation = value.directDependencyRelations.find(({ targetRef }) =>
    refsEqual(targetRef, predecessorRef)
  );
  if (predecessorRelation?.role !== "same_lane_authority") {
    throw new Error("Release predecessor requires an exact same-lane-authority relation");
  }
  if (predecessor.releaseContentMerkleRoot === value.contentMerkleRoot) {
    throw new Error("A successor release requires an actual content change");
  }
}

function assertDependencySequence(
  sequence: number,
  value: {
    predecessorRef: KnowledgeRecordRef | null;
    directDependencyRelations: KnowledgeDependencyRelation[];
  }
): void {
  if (sequence === 1 && value.predecessorRef !== null) {
    throw new Error("An initial release cannot name a predecessor");
  }
  if (
    sequence > 1 &&
    (value.predecessorRef === null ||
      !value.directDependencyRelations.some(
        ({ targetRef, role }) =>
          refsEqual(targetRef, value.predecessorRef!) && role === "same_lane_authority"
      ))
  ) {
    throw new Error("A successor release must include its predecessor as a direct dependency");
  }
}

function knowledgeContentMerkleRoot(content: KnowledgeContentInput): string {
  const leaves = [
    ...content.citedEvidenceRefs.map((reference) => ({
      recordKind: reference.recordKind,
      id: reference.id,
      digest: reference.digest,
    })),
    ...content.candidates,
    ...content.applicabilityPredicates,
    ...content.evidenceEdges,
    ...content.constraintDerivations,
    ...content.componentClosure,
    ...content.componentMappings,
    ...content.profiles,
  ].map(({ recordKind, id, digest }) => ({ recordKind, id, digest }));
  return merkleRoot(leaves, "content");
}

function knowledgeClosureMerkleRoot(
  content: KnowledgeContentInput,
  contentMerkleRoot: string
): string {
  const lineageDigest = knowledgeDigest("release-lineage", {
    packId: content.packId,
    authorityLane: content.authorityLane,
    domains: content.domains,
    predecessorRef: content.predecessorRef,
    directDependencyRelations: content.directDependencyRelations,
  });
  const leaves = [
    { recordKind: "knowledge_content_root", id: content.packId, digest: contentMerkleRoot },
    { recordKind: "knowledge_release_lineage", id: content.packId, digest: lineageDigest },
    ...content.dependencyClosure.map(({ id, digest }) => ({
      recordKind: "knowledge_release_dependency",
      id,
      digest,
    })),
  ];
  return merkleRoot(leaves, "closure");
}

function merkleRoot(
  records: Array<{ readonly recordKind: string; readonly id: string; readonly digest: string }>,
  treeDomain: string
): string {
  if (records.length === 0 || records.length > 1024) {
    throw new Error("Reviewed Knowledge Merkle input is empty or exceeds its bound");
  }
  const descriptors = records
    .map((record) => ({
      recordKind: record.recordKind,
      id: record.id,
      digest: record.digest,
    }))
    .sort(compareCanonical);
  const unique = new Set(descriptors.map(canonicalReferenceJson));
  if (unique.size !== descriptors.length) {
    throw new Error("Reviewed Knowledge Merkle input contains duplicate leaves");
  }
  let level = descriptors.map((descriptor) =>
    knowledgeDigest(`merkle-${treeDomain}-leaf`, descriptor)
  );
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      next.push(
        knowledgeDigest(`merkle-${treeDomain}-branch`, {
          left: level[index]!,
          right: level[index + 1] ?? level[index]!,
        })
      );
    }
    level = next;
  }
  return knowledgeDigest(`merkle-${treeDomain}-root`, {
    leafCount: descriptors.length,
    treeDigest: level[0]!,
  });
}

function assertNoAttestationInClosure(content: KnowledgeContentInput): void {
  const records: unknown[] = [
    ...content.candidates,
    ...content.applicabilityPredicates,
    ...content.evidenceEdges,
    ...content.constraintDerivations,
    ...content.componentClosure,
    ...content.componentMappings,
    ...content.profiles,
    ...content.dependencyClosure,
  ];
  if (
    records.some((record) => isPlainObject(record) && record.recordKind === "release_attestation")
  ) {
    throw new Error("Release attestations are external and cannot enter release closure");
  }
}

function assertExactRecordClosure<T extends { readonly id: string; readonly digest: string }>(
  records: readonly T[],
  expectedRefs: readonly KnowledgeRecordRef[],
  label: string
): void {
  if (!sameRefSet(records.map(knowledgeRef), uniqueRefs(expectedRefs))) {
    throw new Error(`Knowledge Pack ${label} closure is missing or contains extras`);
  }
}

function assertUniqueRecordIdentities(
  records: ReadonlyArray<{ readonly id: string; readonly digest: string }>
): void {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`Duplicate Knowledge record id: ${record.id}`);
    ids.add(record.id);
  }
}

function mapByRef<T extends { readonly id: string; readonly digest: string }>(
  records: readonly T[]
): Map<string, T> {
  const result = new Map<string, T>();
  for (const record of records) result.set(refKey(record), record);
  return result;
}

function requireRef<T>(
  records: ReadonlyMap<string, T>,
  reference: KnowledgeRecordRef,
  label: string
): T {
  const record = records.get(refKey(reference));
  if (!record) throw new Error(`Missing exact ${label}: ${reference.id}`);
  return record;
}

function refKey(reference: { readonly id: string; readonly digest: string }): string {
  return `${reference.id}\u0000${reference.digest}`;
}

function uniqueRefs(refs: readonly KnowledgeRecordRef[]): KnowledgeRecordRef[] {
  return [...new Map(refs.map((reference) => [refKey(reference), reference])).values()];
}

function externalRefKey(reference: KnowledgeExternalEvidenceRef): string {
  return `${reference.recordKind}\u0000${reference.id}\u0000${reference.digest}`;
}

function uniqueExternalRefs(
  refs: readonly KnowledgeExternalEvidenceRef[]
): KnowledgeExternalEvidenceRef[] {
  return [...new Map(refs.map((reference) => [externalRefKey(reference), reference])).values()];
}

function assertUniqueDependencyTargets(relations: readonly KnowledgeDependencyRelation[]): void {
  const targets = new Set<string>();
  for (const relation of relations) {
    const key = refKey(relation.targetRef);
    if (targets.has(key)) {
      throw new Error("Dependency relations cannot assign multiple roles to one exact release");
    }
    targets.add(key);
  }
}

function sameRefSet(
  left: readonly KnowledgeRecordRef[],
  right: readonly KnowledgeRecordRef[]
): boolean {
  return (
    canonicalReferenceJson(sortRefs(uniqueRefs(left))) ===
    canonicalReferenceJson(sortRefs(uniqueRefs(right)))
  );
}

function sameExternalRefSet(
  left: readonly KnowledgeExternalEvidenceRef[],
  right: readonly KnowledgeExternalEvidenceRef[]
): boolean {
  return (
    canonicalReferenceJson(sortExternalRefs(uniqueExternalRefs(left))) ===
    canonicalReferenceJson(sortExternalRefs(uniqueExternalRefs(right)))
  );
}

function sortRefs<T extends KnowledgeRecordRef>(refs: readonly T[]): T[] {
  return [...refs].sort(compareCanonical);
}

function sortExternalRefs<T extends KnowledgeExternalEvidenceRef>(refs: readonly T[]): T[] {
  return [...refs].sort(compareCanonical);
}

function sortRecords<T extends { readonly id: string; readonly digest: string }>(
  records: readonly T[]
): T[] {
  return [...records].sort(compareCanonical);
}

function sortStrings<T extends string>(values: readonly T[]): T[] {
  return [...values].sort(compareCanonical);
}

function sortByCanonical<T>(values: readonly T[]): T[] {
  return [...values].sort(compareCanonical);
}

function compareCanonical(left: unknown, right: unknown): number {
  const leftJson = canonicalReferenceJson(left);
  const rightJson = canonicalReferenceJson(right);
  return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
}

function buildDigestedRecord<TSchemaValue extends TSchema>(
  schema: TSchemaValue,
  recordDomain: string,
  core: Record<string, unknown>
): Static<TSchemaValue> {
  const record = {
    ...structuredClone(core),
    digest: knowledgeDigest(recordDomain, core),
  };
  return deepFreeze(decodeStrict(schema, record, `Digested ${recordDomain} record`));
}

function assertRecordDigest(recordDomain: string, value: Record<string, unknown>): void {
  const { digest, ...core } = value;
  if (digest !== knowledgeDigest(recordDomain, core)) {
    throw new Error(`Forged or stale ${recordDomain} digest`);
  }
}

function knowledgeDigest(recordDomain: string, value: unknown): string {
  return referenceSourceDigest({
    digestDomain: `vellum.reviewed-knowledge.${recordDomain}.v1`,
    payload: value,
  });
}

function decodeStrict<TSchemaValue extends TSchema>(
  schema: TSchemaValue,
  value: unknown,
  label: string
): Static<TSchemaValue> {
  try {
    return Value.Decode(schema, structuredClone(value));
  } catch (error) {
    const detail = [...Value.Errors(schema, value)]
      .slice(0, 4)
      .map(({ path, message }) => `${path || "/"}: ${message}`)
      .join("; ");
    throw new Error(`${label} failed closed-schema decoding${detail ? `: ${detail}` : ""}`, {
      cause: error,
    });
  }
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    canonicalReferenceJson(sortStrings(left)) === canonicalReferenceJson(sortStrings(right))
  );
}

function refsEqual(left: KnowledgeRecordRef, right: KnowledgeRecordRef): boolean {
  return left.id === right.id && left.digest === right.digest;
}

const FORBIDDEN_DECLARATIVE_PAYLOADS: readonly RegExp[] = [
  /\b[a-z][a-z0-9+.-]*:\/\//iu,
  /(?:^|\s)(?:\/Users\/|\/home\/|\/etc\/|\/var\/|\/tmp\/|~\/|\.\.?\/|[A-Za-z]:\\)/u,
  /\b(?:api[_ -]?key|password|secret|bearer\s+[A-Za-z0-9._~-]+|sk-[A-Za-z0-9]{8,})\b/iu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\bignore\s+(?:all\s+)?(?:previous|prior)\s+instructions\b/iu,
  /\b(?:system prompt|developer message|you are (?:an? )?(?:ai|chatgpt))\b/iu,
  /<\s*(?:system|assistant|developer)\b|\[INST\]/iu,
  /<script\b|javascript:|#!\s*\/|=>|\b(?:eval|exec|spawn|require|import)\s*\(|\bfunction\s+[A-Za-z_$]/iu,
];

function assertDeclarativePayload(value: unknown): void {
  const visit = (current: unknown): void => {
    if (typeof current === "string") {
      if (FORBIDDEN_DECLARATIVE_PAYLOADS.some((pattern) => pattern.test(current))) {
        throw new Error(
          "Reviewed Knowledge payload contains executable, prompt, path, URL, or credential data"
        );
      }
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (isPlainObject(current)) Object.values(current).forEach(visit);
  };
  visit(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
