import { Type, type Static } from "@sinclair/typebox";

const EditionIdSchema = Type.String({ pattern: "^edition\\.[a-f0-9-]{16,}$" });
const SourceIdSchema = Type.String({ pattern: "^source\\.[a-f0-9-]{16,}$" });
const BatchIdSchema = Type.String({ pattern: "^correction-batch\\.[a-f0-9-]{16,}$" });
const InterpretationIdSchema = Type.String({ pattern: "^tab-interpretation\\.[a-f0-9-]{16,}$" });
const AcceptanceIdSchema = Type.String({ pattern: "^edition-acceptance\\.[a-f0-9-]{16,}$" });
const SelectionIdSchema = Type.String({ pattern: "^passage-selection\\.[a-f0-9-]{16,}$" });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const MeiIdSchema = Type.String({ pattern: "^[A-Za-z_][A-Za-z0-9_.:-]*$" });
const IsoDateSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

const InitialReviewMetricsSchema = Type.Object(
  {
    untouched: Type.Integer({ minimum: 0 }),
    reviewed: Type.Integer({ minimum: 0 }),
    corrected: Type.Integer({ minimum: 0 }),
    regrouped: Type.Integer({ minimum: 0 }),
    propagated: Type.Integer({ minimum: 0 }),
    rejected: Type.Integer({ minimum: 0 }),
    unresolved: Type.Integer({ minimum: 0 }),
    keyboardActions: Type.Integer({ minimum: 0 }),
    elapsedReviewSeconds: Type.Optional(Type.Integer({ minimum: 1 })),
    ownerJudgment: Type.Optional(
      Type.Object(
        {
          materiallyReducedRepetitiveEntry: Type.Literal(true),
          allEvidenceDimensionsEfficientlyRecordable: Type.Literal(true),
        },
        { additionalProperties: false }
      )
    ),
  },
  { additionalProperties: false }
);

export const FacsimileRegionSchema = Type.Object(
  {
    page: Type.Integer({ minimum: 1 }),
    x: Type.Number({ minimum: 0, maximum: 1 }),
    y: Type.Number({ minimum: 0, maximum: 1 }),
    width: Type.Number({ exclusiveMinimum: 0, maximum: 1 }),
    height: Type.Number({ exclusiveMinimum: 0, maximum: 1 }),
  },
  { additionalProperties: false }
);

export const DiplomaticTokenSchema = Type.Object(
  {
    id: MeiIdSchema,
    kind: Type.Union([
      Type.Literal("tablature"),
      Type.Literal("rhythm"),
      Type.Literal("strum"),
      Type.Literal("pince"),
      Type.Literal("barline"),
      Type.Literal("ornament"),
      Type.Literal("text"),
      Type.Literal("other"),
    ]),
    region: FacsimileRegionSchema,
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    alternatives: Type.Array(Type.String({ minLength: 1 })),
    critical: Type.Boolean(),
  },
  { additionalProperties: false }
);

export const MeiAttributeChangeSchema = Type.Object(
  {
    tokenId: MeiIdSchema,
    attribute: Type.Union([
      Type.Literal("tab.course"),
      Type.Literal("tab.fret"),
      Type.Literal("dur"),
      Type.Literal("dots"),
      Type.Literal("strum.direction"),
    ]),
    expectedValue: Type.Optional(Type.String()),
    replacementValue: Type.Optional(Type.String()),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

const TokenReviewStateSchema = Type.Object(
  {
    critical: Type.Boolean(),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    alternatives: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false }
);

export const TokenReviewResolutionSchema = Type.Object(
  {
    tokenId: MeiIdSchema,
    expectedState: TokenReviewStateSchema,
    replacementState: TokenReviewStateSchema,
    rationale: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false }
);

export const PassageSelectionSchema = Type.Object(
  {
    id: SelectionIdSchema,
    editionId: EditionIdSchema,
    editionVersion: Type.Integer({ minimum: 1 }),
    mode: Type.Union([Type.Literal("contiguous"), Type.Literal("noncontiguous")]),
    roleFilter: Type.Union([
      Type.Literal("all"),
      Type.Literal("treble_courses"),
      Type.Literal("middle_course"),
      Type.Literal("bass_courses"),
      Type.Literal("rhythm"),
    ]),
    meiIds: Type.Array(MeiIdSchema, { minItems: 1, uniqueItems: true }),
  },
  { additionalProperties: false }
);

export const SelectionContextEnvelopeSchema = Type.Object(
  {
    kind: Type.Literal("vellum_mei_selection_context_v1"),
    selection: PassageSelectionSchema,
    sourcePage: Type.Integer({ minimum: 1 }),
    meter: Type.Object(
      { count: Type.Integer({ minimum: 1 }), unit: Type.Integer({ minimum: 1 }) },
      { additionalProperties: false }
    ),
    tuning: Type.Array(
      Type.Object(
        {
          course: Type.Integer({ minimum: 1, maximum: 13 }),
          pname: Type.String({ minLength: 1 }),
          octave: Type.Integer(),
        },
        { additionalProperties: false }
      )
    ),
    selectedObjects: Type.Array(
      Type.Object(
        {
          id: MeiIdSchema,
          kind: DiplomaticTokenSchema.properties.kind,
          measureId: Type.Optional(MeiIdSchema),
          measureNumber: Type.Optional(Type.Integer({ minimum: 1 })),
          course: Type.Optional(Type.Integer({ minimum: 1, maximum: 13 })),
          fret: Type.Optional(Type.Integer({ minimum: 0, maximum: 12 })),
          dur: Type.Optional(Type.Integer({ minimum: 1 })),
          dots: Type.Optional(Type.Integer({ minimum: 0, maximum: 3 })),
          strumDirection: Type.Optional(Type.Union([Type.Literal("up"), Type.Literal("down")])),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    neighborIds: Type.Array(MeiIdSchema, { uniqueItems: true }),
    facsimileIncluded: Type.Literal(false),
  },
  { additionalProperties: false }
);

const ModelSuggestionDecisionSchema = Type.Object(
  {
    suggestionId: Type.String({ minLength: 1, maxLength: 120 }),
    decision: Type.Union([
      Type.Literal("approved"),
      Type.Literal("rejected"),
      Type.Literal("revised"),
    ]),
    finalChange: Type.Optional(MeiAttributeChangeSchema),
    rationale: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false }
);

export const ModelCorrectionProvenanceSchema = Type.Object(
  {
    modelActionId: Type.String({ pattern: "^model-action\\.[a-f0-9-]{16,}$" }),
    publicationId: Type.String({ pattern: "^model-publication\\.[a-f0-9-]{16,}$" }),
    resultCommitId: Type.String({ pattern: "^result-commit\\.[a-f0-9-]{16,}$" }),
    selectionContext: SelectionContextEnvelopeSchema,
    selectionContextDigest: DigestSchema,
    proposalDigest: DigestSchema,
    proposalLayer: Type.Union([
      Type.Literal("transcription"),
      Type.Literal("interpretation"),
      Type.Literal("emendation"),
    ]),
    decisions: Type.Array(ModelSuggestionDecisionSchema, { minItems: 1 }),
  },
  { additionalProperties: false }
);

export const CorrectionBatchCommandSchema = Type.Object(
  {
    id: BatchIdSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    layer: Type.Literal("transcription"),
    changes: Type.Array(MeiAttributeChangeSchema),
    reviewResolutions: Type.Optional(
      Type.Array(TokenReviewResolutionSchema, { minItems: 1, uniqueItems: true })
    ),
    modelProvenance: Type.Optional(ModelCorrectionProvenanceSchema),
  },
  { additionalProperties: false }
);

export const CorrectionBatchRecordSchema = Type.Object(
  {
    id: BatchIdSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    layer: Type.Literal("transcription"),
    changes: Type.Array(MeiAttributeChangeSchema),
    reviewResolutions: Type.Optional(
      Type.Array(TokenReviewResolutionSchema, { minItems: 1, uniqueItems: true })
    ),
    modelProvenance: Type.Optional(ModelCorrectionProvenanceSchema),
    committedAt: IsoDateSchema,
    inverseOfBatchId: Type.Optional(BatchIdSchema),
  },
  { additionalProperties: false }
);

export const MeiEditionVersionSchema = Type.Object(
  {
    editionId: EditionIdSchema,
    version: Type.Integer({ minimum: 1 }),
    parentVersion: Type.Optional(Type.Integer({ minimum: 1 })),
    sourceArtifactId: SourceIdSchema,
    sourcePage: Type.Integer({ minimum: 1 }),
    title: Type.String({ minLength: 1 }),
    mei: Type.String({ minLength: 1 }),
    tokens: Type.Array(DiplomaticTokenSchema, { minItems: 1 }),
    extraction: Type.Object(
      {
        backendId: Type.String({ minLength: 1 }),
        backendVersion: Type.String({ minLength: 1 }),
        diagnostics: Type.Array(Type.String({ minLength: 1 })),
        recognitionRunId: Type.Optional(
          Type.String({ pattern: "^tab-recognition\\.[a-f0-9-]{16,}$" })
        ),
        initialReviewBatch: Type.Optional(
          Type.Object(
            {
              name: Type.String({ minLength: 1, maxLength: 120 }),
              draftDigest: DigestSchema,
              confirmedEvents: Type.Integer({ minimum: 0 }),
              ambiguousEvents: Type.Integer({ minimum: 0 }),
              reviewMetrics: InitialReviewMetricsSchema,
            },
            { additionalProperties: false }
          )
        ),
      },
      { additionalProperties: false }
    ),
    correctionBatch: Type.Optional(CorrectionBatchRecordSchema),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const CreateMeiEditionCommandSchema = Type.Object(
  {
    sourceArtifactId: SourceIdSchema,
    sourcePage: Type.Integer({ minimum: 1 }),
    title: Type.String({ minLength: 1 }),
    mei: Type.String({ minLength: 1 }),
    tokens: Type.Array(DiplomaticTokenSchema, { minItems: 1 }),
    extraction: Type.Object(
      {
        backendId: Type.String({ minLength: 1 }),
        backendVersion: Type.String({ minLength: 1 }),
        diagnostics: Type.Array(Type.String({ minLength: 1 })),
        recognitionRunId: Type.Optional(
          Type.String({ pattern: "^tab-recognition\\.[a-f0-9-]{16,}$" })
        ),
        initialReviewBatch: Type.Optional(
          Type.Object(
            {
              name: Type.String({ minLength: 1, maxLength: 120 }),
              draftDigest: DigestSchema,
              confirmedEvents: Type.Integer({ minimum: 0 }),
              ambiguousEvents: Type.Integer({ minimum: 0 }),
              reviewMetrics: InitialReviewMetricsSchema,
            },
            { additionalProperties: false }
          )
        ),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
);

export const CourseTuningSchema = Type.Object(
  {
    course: Type.Integer({ minimum: 1, maximum: 13 }),
    openMidis: Type.Array(Type.Integer({ minimum: 0, maximum: 127 }), {
      minItems: 1,
      maxItems: 2,
    }),
  },
  { additionalProperties: false }
);

const RepeatSectionSchema = Type.Object(
  {
    startMeasure: Type.Integer({ minimum: 1 }),
    endMeasure: Type.Integer({ minimum: 1 }),
    totalPasses: Type.Integer({ minimum: 1, maximum: 4 }),
    pickupMeasureId: Type.Optional(MeiIdSchema),
    closingMeasureId: Type.Optional(MeiIdSchema),
    petiteReprise: Type.Optional(
      Type.Object(
        {
          startEventId: MeiIdSchema,
          endEventId: MeiIdSchema,
          totalPasses: Type.Integer({ minimum: 2, maximum: 4 }),
        },
        { additionalProperties: false }
      )
    ),
  },
  { additionalProperties: false }
);

const StrumNotesSchema = Type.Array(
  Type.Object(
    {
      course: Type.Integer({ minimum: 1, maximum: 13 }),
      fret: Type.Integer({ minimum: 0, maximum: 24 }),
    },
    { additionalProperties: false }
  ),
  { minItems: 1 }
);

const CurrentStrumRealizationSchema = Type.Object(
  {
    strumId: MeiIdSchema,
    direction: Type.Union([Type.Literal("up"), Type.Literal("down")]),
    notes: StrumNotesSchema,
    spreadMilliseconds: Type.Integer({ minimum: 0, maximum: 250 }),
  },
  { additionalProperties: false }
);

const LegacyStrumRealizationSchema = Type.Object(
  {
    strumId: MeiIdSchema,
    notes: StrumNotesSchema,
    spreadMilliseconds: Type.Integer({ minimum: 0, maximum: 250 }),
  },
  { additionalProperties: false }
);

const StrumRealizationSchema = Type.Union([
  CurrentStrumRealizationSchema,
  LegacyStrumRealizationSchema,
]);

const EventRhythmReadingSchema = Type.Object(
  {
    eventId: MeiIdSchema,
    duration: Type.Union([
      Type.Literal(1),
      Type.Literal(2),
      Type.Literal(4),
      Type.Literal(8),
      Type.Literal(16),
      Type.Literal(32),
      Type.Literal(64),
    ]),
    dots: Type.Integer({ minimum: 0, maximum: 3 }),
  },
  { additionalProperties: false }
);

export const TablatureInterpretationSchema = Type.Object(
  {
    id: InterpretationIdSchema,
    editionId: EditionIdSchema,
    editionVersion: Type.Integer({ minimum: 1 }),
    version: Type.Integer({ minimum: 1 }),
    parentInterpretationId: Type.Optional(InterpretationIdSchema),
    tempo: Type.Integer({ minimum: 30, maximum: 240 }),
    courseTunings: Type.Array(CourseTuningSchema, { minItems: 1, maxItems: 13 }),
    eventRhythms: Type.Optional(Type.Array(EventRhythmReadingSchema, { minItems: 1 })),
    repeatSections: Type.Array(RepeatSectionSchema, { minItems: 1 }),
    strumRealizations: Type.Array(StrumRealizationSchema),
    rationale: Type.String({ minLength: 1, maxLength: 500 }),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const CreateTablatureInterpretationCommandSchema = Type.Object(
  {
    expectedEditionVersion: Type.Integer({ minimum: 1 }),
    parentInterpretationId: Type.Optional(InterpretationIdSchema),
    tempo: Type.Integer({ minimum: 30, maximum: 240 }),
    courseTunings: Type.Array(CourseTuningSchema, { minItems: 1, maxItems: 13 }),
    eventRhythms: Type.Array(EventRhythmReadingSchema, { minItems: 1 }),
    repeatSections: Type.Array(RepeatSectionSchema, { minItems: 1 }),
    strumRealizations: Type.Array(CurrentStrumRealizationSchema),
    rationale: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false }
);

const AcceptancePurposeSchema = Type.Union([
  Type.Literal("literal_playback"),
  Type.Literal("analysis"),
  Type.Literal("reading_edition"),
  Type.Literal("idiom_evidence"),
]);

export const EditionAcceptanceDecisionSchema = Type.Object(
  {
    id: AcceptanceIdSchema,
    version: Type.Integer({ minimum: 1 }),
    editionId: EditionIdSchema,
    editionVersion: Type.Integer({ minimum: 1 }),
    scope: Type.Union([Type.Literal("transcription"), Type.Literal("interpretation")]),
    interpretationId: Type.Optional(InterpretationIdSchema),
    interpretationVersion: Type.Optional(Type.Integer({ minimum: 1 })),
    decision: Type.Union([Type.Literal("accepted"), Type.Literal("rejected")]),
    purposes: Type.Array(AcceptancePurposeSchema, { uniqueItems: true }),
    evidence: Type.String({ minLength: 1, maxLength: 1000 }),
    decidedAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const CreateEditionAcceptanceDecisionCommandSchema = Type.Object(
  {
    expectedEditionVersion: Type.Integer({ minimum: 1 }),
    expectedPriorDecisionId: Type.Optional(AcceptanceIdSchema),
    scope: Type.Union([Type.Literal("transcription"), Type.Literal("interpretation")]),
    interpretationId: Type.Optional(InterpretationIdSchema),
    decision: Type.Union([Type.Literal("accepted"), Type.Literal("rejected")]),
    purposes: Type.Array(AcceptancePurposeSchema, { uniqueItems: true }),
    evidence: Type.String({ minLength: 1, maxLength: 1000 }),
  },
  { additionalProperties: false }
);

export type FacsimileRegion = Static<typeof FacsimileRegionSchema>;
export type DiplomaticToken = Static<typeof DiplomaticTokenSchema>;
export type MeiAttributeChange = Static<typeof MeiAttributeChangeSchema>;
export type TokenReviewResolution = Static<typeof TokenReviewResolutionSchema>;
export type PassageSelection = Static<typeof PassageSelectionSchema>;
export type SelectionContextEnvelope = Static<typeof SelectionContextEnvelopeSchema>;
export type ModelCorrectionProvenance = Static<typeof ModelCorrectionProvenanceSchema>;
export type CorrectionBatchCommand = Static<typeof CorrectionBatchCommandSchema>;
export type CorrectionBatchRecord = Static<typeof CorrectionBatchRecordSchema>;
export type MeiEditionVersion = Static<typeof MeiEditionVersionSchema>;
export type CreateMeiEditionCommand = Static<typeof CreateMeiEditionCommandSchema>;
export type CourseTuning = Static<typeof CourseTuningSchema>;
export type TablatureInterpretation = Static<typeof TablatureInterpretationSchema>;
export type CreateTablatureInterpretationCommand = Static<
  typeof CreateTablatureInterpretationCommandSchema
>;
export type EditionAcceptanceDecision = Static<typeof EditionAcceptanceDecisionSchema>;
export type CreateEditionAcceptanceDecisionCommand = Static<
  typeof CreateEditionAcceptanceDecisionCommandSchema
>;
