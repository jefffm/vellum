import { Type, type Static } from "@sinclair/typebox";

const RecognitionIdSchema = Type.String({ pattern: "^tab-recognition\\.[a-f0-9-]{16,}$" });
const SourceIdSchema = Type.String({ pattern: "^source\\.[a-f0-9-]{16,}$" });
const IsoDateSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

const HistoricalTabSpatialRulesSchema = Type.Object(
  {
    courseAlignmentToleranceGap: Type.Number({ exclusiveMinimum: 0 }),
    minimumGlyphWidthGap: Type.Number({ exclusiveMinimum: 0 }),
    maximumGlyphWidthGap: Type.Number({ exclusiveMinimum: 0 }),
    minimumGlyphHeightGap: Type.Number({ exclusiveMinimum: 0 }),
    maximumGlyphHeightGap: Type.Number({ exclusiveMinimum: 0 }),
    shapeDistanceThreshold: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false }
);

const PixelBoundsSchema = Type.Object(
  {
    left: Type.Integer({ minimum: 0 }),
    top: Type.Integer({ minimum: 0 }),
    right: Type.Integer({ minimum: 0 }),
    bottom: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false }
);

const ImageRegionSchema = Type.Object(
  {
    x: Type.Number({ minimum: 0, maximum: 1 }),
    y: Type.Number({ minimum: 0, maximum: 1 }),
    width: Type.Number({ exclusiveMinimum: 0, maximum: 1 }),
    height: Type.Number({ exclusiveMinimum: 0, maximum: 1 }),
  },
  { additionalProperties: false }
);

export const HistoricalTabGlyphSchema = Type.Object(
  {
    id: Type.String({ pattern: "^system-\\d+-glyph-\\d+$" }),
    region: ImageRegionSchema,
    pixelBounds: PixelBoundsSchema,
    area: Type.Integer({ minimum: 1 }),
    fingerprint: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    shapeFingerprint: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    shapeCode: Type.String({ pattern: "^[a-f0-9]{36}$" }),
    clusterEligible: Type.Boolean(),
    clusterId: Type.String({ pattern: "^cluster-\\d+$" }),
    courseCandidate: Type.Optional(Type.Integer({ minimum: 1, maximum: 13 })),
  },
  { additionalProperties: false }
);

export const HistoricalTabEventCandidateSchema = Type.Object(
  {
    id: Type.String({ pattern: "^system-\\d+-event-\\d+$" }),
    region: ImageRegionSchema,
    anchorX: Type.Number({ minimum: 0, maximum: 1 }),
    glyphIds: Type.Array(Type.String({ pattern: "^system-\\d+-glyph-\\d+$" }), {
      uniqueItems: true,
    }),
    verticalCandidateIds: Type.Array(Type.String({ pattern: "^system-\\d+-vertical-\\d+$" }), {
      uniqueItems: true,
    }),
    reviewState: Type.Literal("unreviewed"),
  },
  { additionalProperties: false }
);

const HistoricalTabVerticalCandidateSchema = Type.Object(
  {
    id: Type.String({ pattern: "^system-\\d+-vertical-\\d+$" }),
    region: ImageRegionSchema,
    coverage: Type.Number({ minimum: 0, maximum: 1 }),
    classification: Type.Union([
      Type.Literal("barline-like"),
      Type.Literal("unresolved-vertical-mark"),
    ]),
  },
  { additionalProperties: false }
);

const HistoricalTabSystemSchema = Type.Object(
  {
    id: Type.String({ pattern: "^system-\\d+$" }),
    region: ImageRegionSchema,
    staffLines: Type.Array(Type.Number({ minimum: 0, maximum: 1 }), {
      minItems: 5,
      maxItems: 5,
    }),
    staffPixelLines: Type.Array(Type.Integer({ minimum: 0 }), { minItems: 5, maxItems: 5 }),
    barlines: Type.Array(HistoricalTabVerticalCandidateSchema),
    events: Type.Array(HistoricalTabEventCandidateSchema, { minItems: 1 }),
  },
  { additionalProperties: false }
);

const HistoricalTabClusterSchema = Type.Object(
  {
    id: Type.String({ pattern: "^cluster-\\d+$" }),
    kind: Type.Union([Type.Literal("fret-letter"), Type.Literal("other")]),
    signature: Type.String({ pattern: "^(?:fret|raw):[a-f0-9]{64}$" }),
    shapeCode: Type.Union([Type.Null(), Type.String({ pattern: "^[a-f0-9]{36}$" })]),
    glyphIds: Type.Array(Type.String({ pattern: "^system-\\d+-glyph-\\d+$" }), {
      minItems: 1,
      uniqueItems: true,
    }),
    label: Type.Union([Type.Null(), Type.String({ pattern: "^[a-z]$" })]),
  },
  { additionalProperties: false }
);

export const HistoricalTabRecognitionRunSchema = Type.Object(
  {
    id: RecognitionIdSchema,
    sourceArtifactId: SourceIdSchema,
    sourcePage: Type.Integer({ minimum: 1 }),
    schemaVersion: Type.Literal(1),
    backend: Type.Object(
      {
        id: Type.Literal("vellum.printed-tab-geometry"),
        version: Type.String({ minLength: 1 }),
        configuration: Type.Record(Type.String(), Type.Unknown()),
      },
      { additionalProperties: false }
    ),
    profile: Type.Object(
      {
        id: Type.String({ minLength: 1 }),
        version: Type.Integer({ minimum: 1 }),
        courseCount: Type.Integer({ minimum: 1, maximum: 13 }),
        notationType: Type.String({ minLength: 1 }),
        vocabulary: Type.Array(Type.String({ pattern: "^[a-z]$" }), {
          minItems: 1,
          uniqueItems: true,
        }),
        spatialRules: HistoricalTabSpatialRulesSchema,
      },
      { additionalProperties: false }
    ),
    image: Type.Object(
      {
        width: Type.Integer({ minimum: 1 }),
        height: Type.Integer({ minimum: 1 }),
        threshold: Type.Integer({ minimum: 0, maximum: 255 }),
      },
      { additionalProperties: false }
    ),
    systems: Type.Array(HistoricalTabSystemSchema, { minItems: 1 }),
    glyphs: Type.Array(HistoricalTabGlyphSchema, { minItems: 1 }),
    clusters: Type.Array(HistoricalTabClusterSchema, { minItems: 1 }),
    hypotheses: Type.Array(
      Type.Object(
        {
          id: Type.String({ pattern: "^hypothesis-\\d+$" }),
          kind: Type.Literal("fret-cluster-label"),
          clusterId: Type.String({ pattern: "^cluster-\\d+$" }),
          proposedLabel: Type.String({ pattern: "^[a-z]$" }),
          profileId: Type.String({ pattern: "^tab-profile\\.[a-f0-9-]{16,}$" }),
          authority: Type.Literal("proposal"),
        },
        { additionalProperties: false }
      )
    ),
    diagnostics: Type.Array(Type.String({ minLength: 1 })),
    pageImageSha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const CreateHistoricalTabRecognitionCommandSchema = Type.Object(
  {
    sourceArtifactId: SourceIdSchema,
    sourcePage: Type.Integer({ minimum: 1 }),
    courseCount: Type.Literal(5),
    recognitionProfileId: Type.Optional(Type.String({ pattern: "^tab-profile\\.[a-f0-9-]{16,}$" })),
  },
  { additionalProperties: false }
);

export const HistoricalTabRecognitionProfileSchema = Type.Object(
  {
    id: Type.String({ pattern: "^tab-profile\\.[a-f0-9-]{16,}$" }),
    version: Type.Integer({ minimum: 1 }),
    parentProfileId: Type.Optional(Type.String({ pattern: "^tab-profile\\.[a-f0-9-]{16,}$" })),
    notationType: Type.String({ minLength: 1 }),
    courseCount: Type.Integer({ minimum: 1, maximum: 13 }),
    vocabulary: Type.Array(Type.String({ pattern: "^[a-z]$" }), {
      minItems: 1,
      uniqueItems: true,
    }),
    spatialRules: HistoricalTabSpatialRulesSchema,
    labels: Type.Array(
      Type.Object(
        {
          signature: Type.String({ pattern: "^fret:[a-f0-9]{64}$" }),
          shapeCode: Type.String({ pattern: "^[a-f0-9]{36}$" }),
          label: Type.String({ pattern: "^[a-z]$" }),
          evidenceEventIds: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
            uniqueItems: true,
          }),
        },
        { additionalProperties: false }
      ),
      { uniqueItems: true }
    ),
    diagnostics: Type.Array(Type.String({ minLength: 1 })),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

const ReviewedEventSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 240 }),
    sourceEventIds: Type.Array(Type.String({ pattern: "^system-\\d+-event-\\d+$" }), {
      minItems: 1,
      uniqueItems: true,
    }),
    region: ImageRegionSchema,
    courses: Type.Array(Type.Union([Type.Null(), Type.String({ pattern: "^[a-z]$" })]), {
      minItems: 1,
      maxItems: 13,
    }),
    rhythmGlyph: Type.Union([
      Type.Literal("unread"),
      Type.Literal("absent"),
      Type.Literal("stem"),
      Type.Literal("flag-1"),
      Type.Literal("flag-2"),
      Type.Literal("flag-3"),
    ]),
    dots: Type.Integer({ minimum: 0, maximum: 2 }),
    ornaments: Type.String({ maxLength: 240 }),
    marks: Type.String({ maxLength: 240 }),
    verticalMark: Type.Union([
      Type.Literal("unread"),
      Type.Literal("none"),
      Type.Literal("barline"),
      Type.Literal("double-barline"),
      Type.Literal("repeat-start"),
      Type.Literal("repeat-end"),
      Type.Literal("gesture"),
      Type.Literal("other"),
    ]),
    state: Type.Union([Type.Literal("confirmed"), Type.Literal("ambiguous")]),
  },
  { additionalProperties: false }
);

export const PublishHistoricalTabDraftCommandSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 200 }),
    batchName: Type.String({ minLength: 1, maxLength: 120 }),
    events: Type.Array(ReviewedEventSchema, { minItems: 1 }),
    reviewMetrics: Type.Object(
      {
        untouched: Type.Integer({ minimum: 0 }),
        reviewed: Type.Integer({ minimum: 0 }),
        corrected: Type.Integer({ minimum: 0 }),
        regrouped: Type.Integer({ minimum: 0 }),
        propagated: Type.Integer({ minimum: 0 }),
        rejected: Type.Integer({ minimum: 0 }),
        unresolved: Type.Integer({ minimum: 0 }),
        keyboardActions: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
);

export type HistoricalTabRecognitionRun = Static<typeof HistoricalTabRecognitionRunSchema>;
export type CreateHistoricalTabRecognitionCommand = Static<
  typeof CreateHistoricalTabRecognitionCommandSchema
>;
export type PublishHistoricalTabDraftCommand = Static<
  typeof PublishHistoricalTabDraftCommandSchema
>;
export type HistoricalTabRecognitionProfile = Static<typeof HistoricalTabRecognitionProfileSchema>;
