import { Type, type Static } from "@sinclair/typebox";

const Strict = { additionalProperties: false } as const;
const OpaqueIdSchema = Type.String({
  pattern: "^owner-reference-[A-Za-z0-9][A-Za-z0-9._-]{0,238}$",
});
const OpaqueCommitmentSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const REFERENCE_PAGE_ATLAS_CITED_SEGMENT_LINEAGE_MAX_VERSIONS = 32;

/**
 * A keyed, non-resolving Workbench projection. `digest` is an HMAC
 * commitment, never a source/content digest. Raw asset, acquisition, path,
 * provider-object, and parser identities are intentionally absent here.
 */
export const ReferencePageAtlasOpaqueHmacRefSchema = Type.Object(
  { id: OpaqueIdSchema, digest: OpaqueCommitmentSchema },
  Strict
);
export type ReferencePageAtlasOpaqueHmacRef = Static<typeof ReferencePageAtlasOpaqueHmacRefSchema>;

export const ReferencePageAtlasProfileSchema = Type.Union([
  Type.Literal("generic_paged_source"),
  Type.Literal("mace-musicks-monument-1676"),
]);
export type ReferencePageAtlasProfile = Static<typeof ReferencePageAtlasProfileSchema>;

const WorkbenchScopeSchema = {
  workbenchSnapshotRef: ReferencePageAtlasOpaqueHmacRefSchema,
  workbenchCardRef: ReferencePageAtlasOpaqueHmacRefSchema,
} as const;

const OperationScopeSchema = {
  ...WorkbenchScopeSchema,
  operationRef: ReferencePageAtlasOpaqueHmacRefSchema,
} as const;

export const ReferencePageAtlasStartRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    action: Type.Literal("start"),
    ...WorkbenchScopeSchema,
    purpose: Type.String({ minLength: 1, maxLength: 512, pattern: "\\S" }),
    authorization: Type.Literal("owner_attested_local_extraction"),
    operationKey: Type.String({
      pattern: "^owner-page-atlas\\.v1\\.[A-Za-z0-9_-]{21}[AQgw]$",
    }),
    profile: ReferencePageAtlasProfileSchema,
    profileSelection: Type.Literal("owner_selected"),
  },
  Strict
);
export type ReferencePageAtlasStartRequest = Static<typeof ReferencePageAtlasStartRequestSchema>;

export const ReferencePageAtlasReadRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    action: Type.Literal("read"),
    ...OperationScopeSchema,
  },
  Strict
);
export type ReferencePageAtlasReadRequest = Static<typeof ReferencePageAtlasReadRequestSchema>;

export const ReferencePageAtlasPreviewRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    action: Type.Literal("preview"),
    ...OperationScopeSchema,
    projectionRef: ReferencePageAtlasOpaqueHmacRefSchema,
    segmentRef: ReferencePageAtlasOpaqueHmacRefSchema,
  },
  Strict
);
export type ReferencePageAtlasPreviewRequest = Static<
  typeof ReferencePageAtlasPreviewRequestSchema
>;

export const ReferencePageAtlasResumeRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    action: Type.Literal("resume"),
    ...OperationScopeSchema,
    expectedProjectionRef: ReferencePageAtlasOpaqueHmacRefSchema,
  },
  Strict
);
export type ReferencePageAtlasResumeRequest = Static<typeof ReferencePageAtlasResumeRequestSchema>;

export const ReferencePageAtlasCancelRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    action: Type.Literal("cancel"),
    ...OperationScopeSchema,
    expectedProjectionRef: ReferencePageAtlasOpaqueHmacRefSchema,
    reason: Type.Literal("owner_requested"),
  },
  Strict
);
export type ReferencePageAtlasCancelRequest = Static<typeof ReferencePageAtlasCancelRequestSchema>;

export const ReferencePageAtlasCorrectMappingRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    action: Type.Literal("correct_mapping"),
    ...OperationScopeSchema,
    expectedProjectionRef: ReferencePageAtlasOpaqueHmacRefSchema,
    correction: Type.Object(
      {
        scanPageNumber: Type.Integer({ minimum: 1 }),
        printedLocator: Type.String({ minLength: 1, maxLength: 64, pattern: "\\S" }),
        reason: Type.String({ minLength: 1, maxLength: 512, pattern: "\\S" }),
      },
      Strict
    ),
  },
  Strict
);
export type ReferencePageAtlasCorrectMappingRequest = Static<
  typeof ReferencePageAtlasCorrectMappingRequestSchema
>;

export const ReferencePageAtlasOperationRequestSchema = Type.Union([
  ReferencePageAtlasStartRequestSchema,
  ReferencePageAtlasReadRequestSchema,
  ReferencePageAtlasResumeRequestSchema,
  ReferencePageAtlasCancelRequestSchema,
  ReferencePageAtlasCorrectMappingRequestSchema,
]);
export type ReferencePageAtlasOperationRequest = Static<
  typeof ReferencePageAtlasOperationRequestSchema
>;

/**
 * Bounded browser-local retry state. Purpose, snapshot, source, content,
 * parser/provider diagnostics, and derivative identity are deliberately absent.
 * Pending profile separation is carried by the fixed storage slot name.
 */
export const ReferencePageAtlasPendingRetryStateSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    state: Type.Literal("pending"),
    cardRef: ReferencePageAtlasOpaqueHmacRefSchema,
    operationKey: Type.String({
      pattern: "^owner-page-atlas\\.v1\\.[A-Za-z0-9_-]{21}[AQgw]$",
    }),
  },
  Strict
);
export type ReferencePageAtlasPendingRetryState = Static<
  typeof ReferencePageAtlasPendingRetryStateSchema
>;

export const ReferencePageAtlasStartedRetryStateSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    state: Type.Literal("started"),
    cardRef: ReferencePageAtlasOpaqueHmacRefSchema,
    operationRef: ReferencePageAtlasOpaqueHmacRefSchema,
    profile: ReferencePageAtlasProfileSchema,
  },
  Strict
);
export type ReferencePageAtlasStartedRetryState = Static<
  typeof ReferencePageAtlasStartedRetryStateSchema
>;

export const ReferencePageAtlasBrowserRetryStateSchema = Type.Union([
  ReferencePageAtlasPendingRetryStateSchema,
  ReferencePageAtlasStartedRetryStateSchema,
]);
export type ReferencePageAtlasBrowserRetryState = Static<
  typeof ReferencePageAtlasBrowserRetryStateSchema
>;

export const ReferencePageAtlasPrintedLocatorSchema = Type.Union([
  Type.Object(
    {
      state: Type.Literal("known"),
      value: Type.String({ minLength: 1, maxLength: 64, pattern: "\\S" }),
    },
    Strict
  ),
  Type.Object({ state: Type.Literal("unresolved") }, Strict),
]);
export type ReferencePageAtlasPrintedLocator = Static<
  typeof ReferencePageAtlasPrintedLocatorSchema
>;

const NormalizedRegionSchema = Type.Object(
  {
    x: Type.Number({ minimum: 0, maximum: 1 }),
    y: Type.Number({ minimum: 0, maximum: 1 }),
    width: Type.Number({ exclusiveMinimum: 0, maximum: 1 }),
    height: Type.Number({ exclusiveMinimum: 0, maximum: 1 }),
  },
  Strict
);

export const ReferencePageAtlasAnchorSchema = Type.Object(
  {
    anchorRef: ReferencePageAtlasOpaqueHmacRefSchema,
    kind: Type.Union([Type.Literal("image"), Type.Literal("text"), Type.Literal("notation")]),
    region: NormalizedRegionSchema,
    reviewState: Type.Union([
      Type.Literal("unresolved"),
      Type.Literal("candidate"),
      Type.Literal("reviewed"),
    ]),
    contentState: Type.Literal("withheld_local_only"),
  },
  Strict
);
export type ReferencePageAtlasAnchor = Static<typeof ReferencePageAtlasAnchorSchema>;

const MappingStateSchema = Type.Union([
  Type.Literal("unresolved"),
  Type.Literal("candidate"),
  Type.Literal("reviewed"),
  Type.Literal("corrected"),
]);

export const ReferencePageAtlasTargetSchema = Type.Object(
  {
    targetRef: ReferencePageAtlasOpaqueHmacRefSchema,
    scanPageNumber: Type.Integer({ minimum: 1 }),
    printedLocator: ReferencePageAtlasPrintedLocatorSchema,
    mappingState: MappingStateSchema,
    canvas: Type.Union([
      Type.Object(
        {
          coordinateSystem: Type.Literal("normalized-top-left.v1"),
          widthPixels: Type.Integer({ minimum: 1, maximum: 200_000 }),
          heightPixels: Type.Integer({ minimum: 1, maximum: 200_000 }),
          rotationDegrees: Type.Union([
            Type.Literal(0),
            Type.Literal(90),
            Type.Literal(180),
            Type.Literal(270),
          ]),
        },
        Strict
      ),
      Type.Null(),
    ]),
    pageState: Type.Object(
      {
        enumeration: Type.Union([Type.Literal("not_enumerated"), Type.Literal("enumerated")]),
        rasterization: Type.Union([
          Type.Literal("not_rasterized"),
          Type.Literal("observed_not_persisted"),
          Type.Literal("immutable_derivative_available"),
        ]),
        contentExtraction: Type.Union([
          Type.Literal("not_extracted"),
          Type.Literal("candidate_extracted"),
        ]),
        mappingReview: Type.Union([
          Type.Literal("not_reviewed"),
          Type.Literal("owner_corrected"),
          Type.Literal("owner_reviewed"),
        ]),
      },
      Strict
    ),
  },
  Strict
);
export type ReferencePageAtlasTarget = Static<typeof ReferencePageAtlasTargetSchema>;

export const ReferencePageAtlasCitedSegmentVersionSchema = Type.Object(
  {
    segmentRef: ReferencePageAtlasOpaqueHmacRefSchema,
    version: Type.Integer({ minimum: 1 }),
    parentSegmentRef: Type.Union([ReferencePageAtlasOpaqueHmacRefSchema, Type.Null()]),
    successorSegmentRef: Type.Union([ReferencePageAtlasOpaqueHmacRefSchema, Type.Null()]),
    pageAtlasRef: ReferencePageAtlasOpaqueHmacRefSchema,
    scanPageNumber: Type.Integer({ minimum: 1 }),
    printedLocator: ReferencePageAtlasPrintedLocatorSchema,
    mappingState: MappingStateSchema,
    citationState: Type.Literal("immutable"),
    authorityState: Type.Literal("non_authoritative"),
    previewState: Type.Union([
      Type.Literal("regeneration_unavailable"),
      Type.Literal("immutable_derivative_available"),
    ]),
    anchors: Type.Array(ReferencePageAtlasAnchorSchema, { minItems: 1, maxItems: 16 }),
  },
  Strict
);
export type ReferencePageAtlasCitedSegmentVersion = Static<
  typeof ReferencePageAtlasCitedSegmentVersionSchema
>;

export const ReferencePageAtlasCitedSegmentLineageSchema = Type.Object(
  {
    currentSegmentRef: Type.Union([ReferencePageAtlasOpaqueHmacRefSchema, Type.Null()]),
    versions: Type.Array(ReferencePageAtlasCitedSegmentVersionSchema, {
      maxItems: REFERENCE_PAGE_ATLAS_CITED_SEGMENT_LINEAGE_MAX_VERSIONS,
    }),
  },
  Strict
);
export type ReferencePageAtlasCitedSegmentLineage = Static<
  typeof ReferencePageAtlasCitedSegmentLineageSchema
>;

export const ReferencePageAtlasConfidenceAssessmentSchema = Type.Union([
  Type.Object(
    {
      state: Type.Literal("unknown"),
      reason: Type.Union([
        Type.Literal("not_assessed"),
        Type.Literal("source_unavailable"),
        Type.Literal("profile_not_applicable"),
      ]),
    },
    Strict
  ),
  Type.Object(
    {
      state: Type.Literal("assessed"),
      value: Type.Number({ minimum: 0, maximum: 1 }),
      basis: Type.Union([
        Type.Literal("local_parser"),
        Type.Literal("typed_extraction"),
        Type.Literal("owner_review"),
        Type.Literal("mixed"),
      ]),
    },
    Strict
  ),
]);
export type ReferencePageAtlasConfidenceAssessment = Static<
  typeof ReferencePageAtlasConfidenceAssessmentSchema
>;

export const ReferencePageAtlasConfidenceDimensionsSchema = Type.Object(
  {
    sourceIdentity: ReferencePageAtlasConfidenceAssessmentSchema,
    pageMapping: ReferencePageAtlasConfidenceAssessmentSchema,
    extraction: ReferencePageAtlasConfidenceAssessmentSchema,
    interpretation: ReferencePageAtlasConfidenceAssessmentSchema,
    applicability: ReferencePageAtlasConfidenceAssessmentSchema,
  },
  Strict
);
export type ReferencePageAtlasConfidenceDimensions = Static<
  typeof ReferencePageAtlasConfidenceDimensionsSchema
>;

const MaceCourseMappingSchema = Type.Tuple([
  Type.Object({ course: Type.Literal(7), sign: Type.Literal("a") }, Strict),
  Type.Object({ course: Type.Literal(8), sign: Type.Literal("/a") }, Strict),
  Type.Object({ course: Type.Literal(9), sign: Type.Literal("//a") }, Strict),
  Type.Object({ course: Type.Literal(10), sign: Type.Literal("///a") }, Strict),
  Type.Object({ course: Type.Literal(11), sign: Type.Literal("4") }, Strict),
  Type.Object({ course: Type.Literal(12), sign: Type.Literal("5") }, Strict),
]);

export const ReferencePageAtlasStagedKnowledgeSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("none"),
      reason: Type.Union([
        Type.Literal("not_extracted"),
        Type.Literal("reextraction_required"),
        Type.Literal("generic_profile_has_no_seed"),
        Type.Literal("source_unavailable"),
      ]),
    },
    Strict
  ),
  Type.Object(
    {
      kind: Type.Literal("mace_twelve_course_diapason_notation"),
      candidateRef: ReferencePageAtlasOpaqueHmacRefSchema,
      reviewState: Type.Literal("staged"),
      authorityState: Type.Literal("non_authoritative"),
      profileScope: Type.Literal("mace-musicks-monument-1676"),
      courseMappings: MaceCourseMappingSchema,
      course13Question: Type.Object(
        {
          questionRef: ReferencePageAtlasOpaqueHmacRefSchema,
          course: Type.Literal(13),
          status: Type.Literal("open"),
          historicalSignState: Type.Literal("unresolved"),
          proposedSign: Type.Null(),
          authorityState: Type.Literal("non_authoritative"),
          question: Type.Literal(
            "Which directly applicable historical source establishes the thirteenth-course sign?"
          ),
        },
        Strict
      ),
    },
    Strict
  ),
]);
export type ReferencePageAtlasStagedKnowledge = Static<
  typeof ReferencePageAtlasStagedKnowledgeSchema
>;

const AtlasCoverageSchema = Type.Object(
  {
    enumeratedPages: Type.Integer({ minimum: 0 }),
    rasterObservedPages: Type.Integer({ minimum: 0 }),
    contentCandidatePages: Type.Integer({ minimum: 0 }),
    mappingReviewedPages: Type.Integer({ minimum: 0 }),
    totalPages: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    remainingPages: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    percentComplete: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
    completeness: Type.Union([Type.Literal("partial"), Type.Literal("complete")]),
  },
  Strict
);

const AtlasStopSchema = Type.Union([
  Type.Null(),
  Type.Object(
    {
      reason: Type.Union([
        Type.Literal("interrupted"),
        Type.Literal("resource_limit"),
        Type.Literal("parser_failure"),
        Type.Literal("owner_cancelled"),
      ]),
      diagnostics: Type.Literal("redacted"),
    },
    Strict
  ),
]);

export const ReferencePageAtlasProjectionSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    projectionRef: ReferencePageAtlasOpaqueHmacRefSchema,
    ...OperationScopeSchema,
    profile: ReferencePageAtlasProfileSchema,
    profileSelection: Type.Literal("owner_selected"),
    publicationState: Type.Literal("staging_only"),
    authorityState: Type.Literal("non_authoritative"),
    boundary: Type.Object(
      {
        processing: Type.Literal("local_only"),
        authorization: Type.Literal("owner_attested_local_extraction"),
        network: Type.Literal("disabled"),
        providerEgress: Type.Literal("deny"),
        fixtureInclusion: Type.Literal("deny"),
        repositoryInclusion: Type.Literal("deny"),
        export: Type.Literal("deny"),
        redistribution: Type.Literal("deny"),
      },
      Strict
    ),
    atlas: Type.Object(
      {
        atlasRef: ReferencePageAtlasOpaqueHmacRefSchema,
        version: Type.Integer({ minimum: 1 }),
        parentAtlasRef: Type.Union([ReferencePageAtlasOpaqueHmacRefSchema, Type.Null()]),
        state: Type.Union([
          Type.Literal("queued"),
          Type.Literal("running"),
          Type.Literal("paused"),
          Type.Literal("complete"),
          Type.Literal("cancelled"),
          Type.Literal("failed"),
        ]),
        coverage: AtlasCoverageSchema,
        checkpointRef: Type.Union([ReferencePageAtlasOpaqueHmacRefSchema, Type.Null()]),
        stop: AtlasStopSchema,
      },
      Strict
    ),
    target: ReferencePageAtlasTargetSchema,
    citedSegmentLineage: ReferencePageAtlasCitedSegmentLineageSchema,
    confidence: ReferencePageAtlasConfidenceDimensionsSchema,
    stagedKnowledge: ReferencePageAtlasStagedKnowledgeSchema,
  },
  Strict
);
export type ReferencePageAtlasProjection = Static<typeof ReferencePageAtlasProjectionSchema>;
