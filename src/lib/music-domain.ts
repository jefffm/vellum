import { Static, Type } from "@sinclair/typebox";

const IdSchema = Type.String({ pattern: "^[a-z0-9][a-z0-9._:-]*$", minLength: 1 });
const IsoDateSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

export const RationalSchema = Type.Object(
  {
    numerator: Type.Integer(),
    denominator: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false }
);

export type Rational = Static<typeof RationalSchema>;

export const SourceRegionSchema = Type.Object(
  {
    coordinateSpace: Type.Optional(
      Type.Union([Type.Literal("source_document"), Type.Literal("omr_raster")])
    ),
    page: Type.Integer({ minimum: 1 }),
    x: Type.Number({ minimum: 0 }),
    y: Type.Number({ minimum: 0 }),
    width: Type.Number({ exclusiveMinimum: 0 }),
    height: Type.Number({ exclusiveMinimum: 0 }),
  },
  { additionalProperties: false }
);

export type SourceRegion = Static<typeof SourceRegionSchema>;

export const SourceProvenanceSchema = Type.Object(
  {
    license: Type.String({ minLength: 1 }),
    sourceUrl: Type.Optional(Type.String({ minLength: 1 })),
    catalogUrl: Type.Optional(Type.String({ minLength: 1 })),
    attribution: Type.Optional(Type.String({ minLength: 1 })),
    notes: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false }
);

export const SourceArtifactSchema = Type.Object(
  {
    id: IdSchema,
    kind: Type.Union([
      Type.Literal("pdf"),
      Type.Literal("image"),
      Type.Literal("musicxml"),
      Type.Literal("lilypond"),
    ]),
    filename: Type.String({ minLength: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    byteLength: Type.Integer({ minimum: 1 }),
    storedPath: Type.String({ minLength: 1 }),
    provenance: SourceProvenanceSchema,
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type SourceArtifact = Static<typeof SourceArtifactSchema>;

export const TargetConfigurationSchema = Type.Object(
  {
    id: IdSchema,
    instrumentId: Type.String({ minLength: 1 }),
    role: Type.Union([
      Type.Literal("solo"),
      Type.Literal("accompaniment"),
      Type.Literal("ensemble"),
    ]),
    tuningId: Type.Optional(Type.String({ minLength: 1 })),
    stringing: Type.Optional(Type.String({ minLength: 1 })),
    realizationProfileId: Type.Optional(Type.String({ minLength: 1 })),
    notationLayouts: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    deliverables: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  },
  { additionalProperties: false }
);

export type TargetConfiguration = Static<typeof TargetConfigurationSchema>;

export const ArrangementBriefSchema = Type.Object(
  {
    targetConfigurations: Type.Array(TargetConfigurationSchema),
    instruction: Type.Optional(Type.String()),
  },
  { additionalProperties: false }
);

export const ArrangementWorkspaceSchema = Type.Object(
  {
    schemaVersion: Type.Integer({ minimum: 3 }),
    id: IdSchema,
    title: Type.String({ minLength: 1 }),
    brief: ArrangementBriefSchema,
    sourceArtifactIds: Type.Array(IdSchema),
    omrRunIds: Type.Array(IdSchema),
    scoreTranscriptionIds: Type.Array(IdSchema),
    normalizedScoreIds: Type.Array(IdSchema),
    analysisRecordIds: Type.Array(IdSchema),
    arrangementScoreIds: Type.Array(IdSchema),
    modelActionIds: Type.Array(IdSchema),
    arrangementBranchIds: Type.Array(IdSchema),
    arrangementSearchIds: Type.Array(IdSchema),
    arrangementCandidateIds: Type.Array(IdSchema),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type ArrangementWorkspace = Static<typeof ArrangementWorkspaceSchema>;

export const CreateWorkspaceSchema = Type.Object(
  {
    title: Type.String({ minLength: 1 }),
    brief: Type.Optional(ArrangementBriefSchema),
  },
  { additionalProperties: false }
);

export type CreateWorkspace = Static<typeof CreateWorkspaceSchema>;

export const ModelActionInputVersionSchema = Type.Object(
  {
    recordType: Type.String({ minLength: 1 }),
    recordId: IdSchema,
    version: Type.Integer({ minimum: 1 }),
    sha256: Type.Optional(Type.String({ pattern: "^[a-f0-9]{64}$" })),
  },
  { additionalProperties: false }
);

export const ModelActionAttemptSchema = Type.Object(
  {
    id: IdSchema,
    number: Type.Integer({ minimum: 1 }),
    mode: Type.Union([
      Type.Literal("initial"),
      Type.Literal("current_version"),
      Type.Literal("original_snapshot_branch"),
    ]),
    status: Type.Union([
      Type.Literal("running"),
      Type.Literal("interrupted"),
      Type.Literal("completed"),
      Type.Literal("cancelled"),
    ]),
    inputVersions: Type.Array(ModelActionInputVersionSchema, { minItems: 1 }),
    inputDifferenceSummary: Type.Optional(Type.String({ minLength: 1 })),
    arrangementBranchId: Type.Optional(IdSchema),
    completedLocalToolResults: Type.Array(
      Type.Object(
        {
          toolName: Type.String({ minLength: 1 }),
          resultReference: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false }
      )
    ),
    partialProgressSummary: Type.Optional(Type.String({ minLength: 1 })),
    diagnosticPartialOutput: Type.Optional(Type.String({ minLength: 1 })),
    interruptionReason: Type.Optional(Type.String({ minLength: 1 })),
    lastConfirmedBoundary: Type.String({ minLength: 1 }),
    canonicalResultReference: Type.Optional(Type.String({ minLength: 1 })),
    startedAt: IsoDateSchema,
    finishedAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);

export const ModelActionSchema = Type.Object(
  {
    id: IdSchema,
    kind: Type.String({ minLength: 1 }),
    intent: Type.String({ minLength: 1 }),
    idempotencyKey: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    status: Type.Union([
      Type.Literal("running"),
      Type.Literal("interrupted"),
      Type.Literal("completed"),
      Type.Literal("cancelled"),
    ]),
    originalInputVersions: Type.Array(ModelActionInputVersionSchema, { minItems: 1 }),
    attempts: Type.Array(ModelActionAttemptSchema, { minItems: 1 }),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type ModelActionInputVersion = Static<typeof ModelActionInputVersionSchema>;
export type ModelActionAttempt = Static<typeof ModelActionAttemptSchema>;
export type ModelAction = Static<typeof ModelActionSchema>;

export const ArrangementBranchSchema = Type.Object(
  {
    id: IdSchema,
    label: Type.String({ minLength: 1 }),
    rootInputVersions: Type.Array(ModelActionInputVersionSchema, { minItems: 1 }),
    createdByModelActionId: Type.Optional(IdSchema),
    createdByAttemptId: Type.Optional(IdSchema),
    createdFromCandidateId: Type.Optional(IdSchema),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type ArrangementBranch = Static<typeof ArrangementBranchSchema>;

export const UploadSourceArtifactSchema = Type.Object(
  {
    filename: Type.String({ minLength: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    contentBase64: Type.String({ minLength: 1 }),
    provenance: SourceProvenanceSchema,
  },
  { additionalProperties: false }
);

export type UploadSourceArtifact = Static<typeof UploadSourceArtifactSchema>;

export const OmrBackendRecordSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    version: Type.String({ minLength: 1 }),
    configuration: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false }
);

export const OmrDiagnosticSchema = Type.Object(
  {
    severity: Type.Union([Type.Literal("info"), Type.Literal("warning"), Type.Literal("error")]),
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    region: Type.Optional(SourceRegionSchema),
  },
  { additionalProperties: false }
);

export const OmrPageMappingSchema = Type.Object(
  {
    sourcePage: Type.Integer({ minimum: 1 }),
    recognizedPage: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false }
);

export const OmrRunSchema = Type.Object(
  {
    id: IdSchema,
    sourceArtifactId: IdSchema,
    backend: OmrBackendRecordSchema,
    status: Type.Union([
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("failed"),
    ]),
    nativeArtifactPaths: Type.Array(Type.String({ minLength: 1 })),
    interchangeArtifactPaths: Type.Array(Type.String({ minLength: 1 })),
    pageMappings: Type.Array(OmrPageMappingSchema),
    diagnostics: Type.Array(OmrDiagnosticSchema),
    logPath: Type.Optional(Type.String({ minLength: 1 })),
    createdAt: IsoDateSchema,
    completedAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);

export type OmrRun = Static<typeof OmrRunSchema>;

export const ScorePartSchema = Type.Object(
  {
    id: IdSchema,
    name: Type.String({ minLength: 1 }),
    role: Type.Optional(
      Type.Union([
        Type.Literal("soprano"),
        Type.Literal("alto"),
        Type.Literal("tenor"),
        Type.Literal("bass"),
        Type.Literal("principal_voice"),
        Type.Literal("continuo_foundation"),
        Type.Literal("other"),
      ])
    ),
  },
  { additionalProperties: false }
);

export type ScorePart = Static<typeof ScorePartSchema>;

export const ScoreMeasureSchema = Type.Object(
  {
    id: IdSchema,
    index: Type.Integer({ minimum: 0 }),
    displayNumber: Type.String({ minLength: 1 }),
    duration: RationalSchema,
  },
  { additionalProperties: false }
);

export type ScoreMeasure = Static<typeof ScoreMeasureSchema>;

const ScoreEventBaseProperties = {
  id: IdSchema,
  partId: IdSchema,
  measureId: IdSchema,
  onset: RationalSchema,
  duration: RationalSchema,
  confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  sourceRegion: Type.Optional(SourceRegionSchema),
};

export const NoteEventSchema = Type.Object(
  {
    ...ScoreEventBaseProperties,
    type: Type.Literal("note"),
    pitch: Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" }),
    tie: Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("stop")])),
  },
  { additionalProperties: false }
);

export const RestEventSchema = Type.Object(
  {
    ...ScoreEventBaseProperties,
    type: Type.Literal("rest"),
  },
  { additionalProperties: false }
);

export const FiguredBassTokenSchema = Type.Object(
  {
    interval: Type.Integer({ minimum: 2, maximum: 13 }),
    accidental: Type.Optional(
      Type.Union([Type.Literal("#"), Type.Literal("b"), Type.Literal("natural")])
    ),
  },
  { additionalProperties: false }
);

export const FiguredBassEventSchema = Type.Object(
  {
    ...ScoreEventBaseProperties,
    type: Type.Literal("figured_bass"),
    bassEventId: IdSchema,
    figures: Type.Array(FiguredBassTokenSchema, { minItems: 1 }),
  },
  { additionalProperties: false }
);

export const ScoreEventSchema = Type.Union([
  NoteEventSchema,
  RestEventSchema,
  FiguredBassEventSchema,
]);

export type ScoreEvent = Static<typeof ScoreEventSchema>;

export const TranscriptionUncertaintySchema = Type.Object(
  {
    id: IdSchema,
    eventIds: Type.Array(IdSchema),
    critical: Type.Boolean(),
    category: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    alternatives: Type.Array(Type.String({ minLength: 1 })),
    region: Type.Optional(SourceRegionSchema),
    resolved: Type.Boolean(),
  },
  { additionalProperties: false }
);

export type TranscriptionUncertainty = Static<typeof TranscriptionUncertaintySchema>;

export const TranscriptionCorrectionRecordSchema = Type.Object(
  {
    uncertaintyId: IdSchema,
    eventIds: Type.Array(IdSchema, { minItems: 1 }),
    rationale: Type.String({ minLength: 1 }),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const ScoreTranscriptionSchema = Type.Object(
  {
    id: IdSchema,
    sourceArtifactId: IdSchema,
    omrRunId: IdSchema,
    version: Type.Integer({ minimum: 1 }),
    parentId: Type.Optional(IdSchema),
    status: Type.Union([
      Type.Literal("needs_review"),
      Type.Literal("reviewed"),
      Type.Literal("best_effort"),
    ]),
    title: Type.Optional(Type.String({ minLength: 1 })),
    key: Type.Optional(Type.String({ minLength: 1 })),
    timeSignature: Type.Optional(Type.String({ pattern: "^\\d+/\\d+$" })),
    parts: Type.Array(ScorePartSchema, { minItems: 1 }),
    measures: Type.Array(ScoreMeasureSchema, { minItems: 1 }),
    events: Type.Array(ScoreEventSchema, { minItems: 1 }),
    uncertainties: Type.Array(TranscriptionUncertaintySchema),
    corrections: Type.Optional(Type.Array(TranscriptionCorrectionRecordSchema)),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type ScoreTranscription = Static<typeof ScoreTranscriptionSchema>;

export const RecognizedScoreSchema = Type.Object(
  {
    title: Type.Optional(Type.String({ minLength: 1 })),
    key: Type.Optional(Type.String({ minLength: 1 })),
    timeSignature: Type.Optional(Type.String({ pattern: "^\\d+/\\d+$" })),
    parts: Type.Array(ScorePartSchema, { minItems: 1 }),
    measures: Type.Array(ScoreMeasureSchema, { minItems: 1 }),
    events: Type.Array(ScoreEventSchema, { minItems: 1 }),
    uncertainties: Type.Array(TranscriptionUncertaintySchema),
  },
  { additionalProperties: false }
);

export type RecognizedScore = Static<typeof RecognizedScoreSchema>;

export const TranscriptionEventEditSchema = Type.Object(
  {
    eventId: IdSchema,
    pitch: Type.Optional(Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" })),
  },
  { additionalProperties: false }
);

export const TranscriptionCorrectionSchema = Type.Object(
  {
    uncertaintyId: IdSchema,
    eventEdits: Type.Array(TranscriptionEventEditSchema, { minItems: 1 }),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export type TranscriptionCorrection = Static<typeof TranscriptionCorrectionSchema>;

export const NormalizedScoreSchema = Type.Object(
  {
    id: IdSchema,
    scoreTranscriptionId: IdSchema,
    version: Type.Integer({ minimum: 1 }),
    title: Type.Optional(Type.String({ minLength: 1 })),
    key: Type.Optional(Type.String({ minLength: 1 })),
    timeSignature: Type.Optional(Type.String({ pattern: "^\\d+/\\d+$" })),
    parts: Type.Array(ScorePartSchema, { minItems: 1 }),
    measures: Type.Array(ScoreMeasureSchema, { minItems: 1 }),
    events: Type.Array(ScoreEventSchema, { minItems: 1 }),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type NormalizedScore = Static<typeof NormalizedScoreSchema>;

export const PreservationTargetSchema = Type.Object(
  {
    id: IdSchema,
    kind: Type.Union([
      Type.Literal("principal_voice"),
      Type.Literal("continuo_foundation"),
      Type.Literal("voice"),
      Type.Literal("relationship"),
    ]),
    partId: Type.Optional(IdSchema),
    eventIds: Type.Array(IdSchema),
    relationshipType: Type.Optional(
      Type.Union([
        Type.Literal("principal_sequence"),
        Type.Literal("phrase_contour"),
        Type.Literal("ordered_entries"),
        Type.Literal("cadential_goal"),
        Type.Literal("prepared_suspension"),
      ])
    ),
    eventGroups: Type.Optional(Type.Array(Type.Array(IdSchema, { minItems: 1 }), { minItems: 1 })),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export type PreservationTarget = Static<typeof PreservationTargetSchema>;

export const AnalysisClaimSchema = Type.Object(
  {
    id: IdSchema,
    kind: Type.String({ minLength: 1 }),
    subjectIds: Type.Array(IdSchema),
    statement: Type.String({ minLength: 1 }),
    basis: Type.Union([
      Type.Literal("observation"),
      Type.Literal("inference"),
      Type.Literal("user_correction"),
    ]),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
  },
  { additionalProperties: false }
);

export const AnalysisRecordSchema = Type.Object(
  {
    id: IdSchema,
    normalizedScoreId: IdSchema,
    version: Type.Integer({ minimum: 1 }),
    texture: Type.String({ minLength: 1 }),
    principalVoicePartId: Type.Optional(IdSchema),
    validationProfileId: Type.Optional(Type.String({ minLength: 1 })),
    contrapuntalTechniques: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    claims: Type.Array(AnalysisClaimSchema),
    preservationTargets: Type.Array(PreservationTargetSchema, { minItems: 1 }),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type AnalysisRecord = Static<typeof AnalysisRecordSchema>;

export const ArrangementPositionSchema = Type.Object(
  {
    course: Type.Integer({ minimum: 1 }),
    fret: Type.Integer({ minimum: 0 }),
    pitch: Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" }),
    quality: Type.Union([
      Type.Literal("open"),
      Type.Literal("low_fret"),
      Type.Literal("high_fret"),
      Type.Literal("diapason"),
    ]),
  },
  { additionalProperties: false }
);

export type ArrangementPosition = Static<typeof ArrangementPositionSchema>;

export const ArrangementEventSchema = Type.Object(
  {
    id: IdSchema,
    type: Type.Union([Type.Literal("note"), Type.Literal("chord"), Type.Literal("rest")]),
    measureId: IdSchema,
    onset: RationalSchema,
    duration: RationalSchema,
    pitches: Type.Array(Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" })),
    positions: Type.Array(ArrangementPositionSchema),
    sourceEventIds: Type.Array(IdSchema),
    principalVoiceSourceEventId: Type.Optional(IdSchema),
    role: Type.Optional(
      Type.Union([
        Type.Literal("principal_voice"),
        Type.Literal("continuo_foundation"),
        Type.Literal("realization"),
        Type.Literal("accompaniment"),
        Type.Literal("source_voice"),
      ])
    ),
    voiceId: Type.Optional(IdSchema),
  },
  { additionalProperties: false }
);

export type ArrangementEvent = Static<typeof ArrangementEventSchema>;

export const TransformationEntrySchema = Type.Object(
  {
    sourceEventId: Type.Optional(IdSchema),
    arrangementEventIds: Type.Array(IdSchema),
    classification: Type.Union([
      Type.Literal("retained"),
      Type.Literal("transposed"),
      Type.Literal("octave_relocated"),
      Type.Literal("revoiced"),
      Type.Literal("omitted"),
      Type.Literal("generated"),
    ]),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const PreservationAuditFindingSchema = Type.Object(
  {
    targetId: IdSchema,
    sourceEventId: Type.Optional(IdSchema),
    arrangementEventId: Type.Optional(IdSchema),
    severity: Type.Union([Type.Literal("hard"), Type.Literal("soft"), Type.Literal("observation")]),
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const PreservationAuditSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("pass"),
      Type.Literal("pass_with_exceptions"),
      Type.Literal("fail"),
    ]),
    targetIds: Type.Array(IdSchema, { minItems: 1 }),
    findings: Type.Array(PreservationAuditFindingSchema),
  },
  { additionalProperties: false }
);

export type PreservationAudit = Static<typeof PreservationAuditSchema>;

export const ArrangementCandidateSchema = Type.Object(
  {
    id: IdSchema,
    strategy: Type.String({ minLength: 1 }),
    status: Type.Union([
      Type.Literal("rejected"),
      Type.Literal("survived"),
      Type.Literal("selected"),
    ]),
    events: Type.Array(ArrangementEventSchema, { minItems: 1 }),
    audit: PreservationAuditSchema,
    metrics: Type.Object(
      {
        sourcePitchClassCoverage: Type.Number({ minimum: 0, maximum: 1 }),
        averageFret: Type.Number({ minimum: 0 }),
        openStringCount: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false }
    ),
    arrangementSearchId: Type.Optional(IdSchema),
    derivationChoices: Type.Optional(
      Type.Array(
        Type.Object(
          {
            dimension: Type.String({ minLength: 1 }),
            value: Type.String({ minLength: 1 }),
            rationale: Type.String({ minLength: 1 }),
          },
          { additionalProperties: false }
        )
      )
    ),
    evaluation: Type.Optional(
      Type.Object(
        {
          hardConstraintResults: Type.Array(
            Type.Object(
              {
                category: Type.Union([
                  Type.Literal("preservation"),
                  Type.Literal("instrument"),
                  Type.Literal("figured_bass"),
                  Type.Literal("validation"),
                ]),
                status: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
                evidenceIds: Type.Array(IdSchema),
                rationale: Type.String({ minLength: 1 }),
              },
              { additionalProperties: false }
            )
          ),
          scores: Type.Object(
            {
              historicalProfile: Type.Number({ minimum: 0, maximum: 1 }),
              idiom: Type.Number({ minimum: 0, maximum: 1 }),
              playability: Type.Number({ minimum: 0, maximum: 1 }),
              voiceLeading: Type.Number({ minimum: 0, maximum: 1 }),
              notationClarity: Type.Number({ minimum: 0, maximum: 1 }),
              softPreferences: Type.Number({ minimum: 0, maximum: 1 }),
            },
            { additionalProperties: false }
          ),
          weightedTotal: Type.Number({ minimum: 0, maximum: 1 }),
          rationale: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false }
      )
    ),
    rank: Type.Optional(Type.Integer({ minimum: 1 })),
    rejectionReason: Type.Optional(Type.String({ minLength: 1 })),
    createdAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);

export type ArrangementCandidate = Static<typeof ArrangementCandidateSchema>;

export const ArrangementSearchSchema = Type.Object(
  {
    id: IdSchema,
    normalizedScoreId: IdSchema,
    analysisRecordId: IdSchema,
    targetConfiguration: TargetConfigurationSchema,
    preservationPolicy: Type.Union([
      Type.Literal("faithful_reduction"),
      Type.Literal("idiomatic_adaptation"),
      Type.Literal("free_paraphrase"),
    ]),
    branchId: Type.Optional(IdSchema),
    status: Type.Union([
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("failed"),
    ]),
    candidateIds: Type.Array(IdSchema),
    selectedCandidateId: Type.Optional(IdSchema),
    selectedArrangementScoreId: Type.Optional(IdSchema),
    rankingWeights: Type.Object(
      {
        historicalProfile: Type.Number({ minimum: 0, maximum: 1 }),
        idiom: Type.Number({ minimum: 0, maximum: 1 }),
        playability: Type.Number({ minimum: 0, maximum: 1 }),
        voiceLeading: Type.Number({ minimum: 0, maximum: 1 }),
        notationClarity: Type.Number({ minimum: 0, maximum: 1 }),
        softPreferences: Type.Number({ minimum: 0, maximum: 1 }),
      },
      { additionalProperties: false }
    ),
    createdAt: IsoDateSchema,
    completedAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);

export type ArrangementSearch = Static<typeof ArrangementSearchSchema>;

export const ArrangementScoreSchema = Type.Object(
  {
    id: IdSchema,
    version: Type.Optional(Type.Integer({ minimum: 1 })),
    arrangementSearchId: Type.Optional(IdSchema),
    branchId: Type.Optional(IdSchema),
    analysisRecordId: IdSchema,
    selectedCandidateId: IdSchema,
    targetConfiguration: TargetConfigurationSchema,
    transpositionPlan: Type.Object(
      {
        sourceKey: Type.Optional(Type.String({ minLength: 1 })),
        targetKey: Type.Optional(Type.String({ minLength: 1 })),
        semitones: Type.Integer({ minimum: -24, maximum: 24 }),
        rationale: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false }
    ),
    preservationPolicy: Type.Union([
      Type.Literal("faithful_reduction"),
      Type.Literal("idiomatic_adaptation"),
      Type.Literal("free_paraphrase"),
    ]),
    events: Type.Array(ArrangementEventSchema, { minItems: 1 }),
    transformationReport: Type.Array(TransformationEntrySchema),
    preservationAudit: PreservationAuditSchema,
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type ArrangementScore = Static<typeof ArrangementScoreSchema>;

export function rational(numerator: number, denominator = 1): Rational {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new Error(`Invalid rational ${numerator}/${denominator}`);
  }

  const divisor = greatestCommonDivisor(Math.abs(numerator), denominator);
  const sign = numerator < 0 ? -1 : 1;

  return {
    numerator: sign * (Math.abs(numerator) / divisor),
    denominator: denominator / divisor,
  };
}

export function addRational(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator
  );
}

export function compareRational(left: Rational, right: Rational): number {
  return left.numerator * right.denominator - right.numerator * left.denominator;
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left;
  let b = right;

  while (b !== 0) {
    [a, b] = [b, a % b];
  }

  return a === 0 ? 1 : a;
}
