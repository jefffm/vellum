import { Static, Type } from "@sinclair/typebox";

const Pitch = Type.String({ minLength: 1 });
const InstrumentId = Type.String({ minLength: 1 });

export const TabPositionSchema = Type.Object({
  course: Type.Integer({ minimum: 1 }),
  fret: Type.Integer({ minimum: 0 }),
  quality: Type.Union([
    Type.Literal("open"),
    Type.Literal("low_fret"),
    Type.Literal("high_fret"),
    Type.Literal("diapason"),
  ]),
});

export type TabPosition = Static<typeof TabPositionSchema>;

export const VoicingSchema = Type.Object({
  positions: Type.Array(TabPositionSchema),
  stretch: Type.Number({ minimum: 0 }),
  campanella_score: Type.Number({ minimum: 0 }),
  open_strings: Type.Integer({ minimum: 0 }),
});

export type Voicing = Static<typeof VoicingSchema>;

export const CompileErrorSchema = Type.Object({
  bar: Type.Integer({ minimum: 0 }),
  beat: Type.Number({ minimum: 0 }),
  line: Type.Integer({ minimum: 0 }),
  type: Type.String({ minLength: 1 }),
  message: Type.String({ minLength: 1 }),
});

export type CompileError = Static<typeof CompileErrorSchema>;

export const CompileResultSchema = Type.Object({
  svg: Type.Optional(Type.String()),
  pdf: Type.Optional(Type.String()),
  midi: Type.Optional(Type.String()),
  errors: Type.Array(CompileErrorSchema),
  barCount: Type.Optional(Type.Integer({ minimum: 0 })),
  voiceCount: Type.Optional(Type.Integer({ minimum: 0 })),
});

export type CompileResult = Static<typeof CompileResultSchema>;

export const ViolationSchema = Type.Object({
  bar: Type.Integer({ minimum: 0 }),
  type: Type.Union([
    Type.Literal("stretch"),
    Type.Literal("same_course"),
    Type.Literal("rh_pattern"),
    Type.Literal("out_of_range"),
  ]),
  description: Type.String({ minLength: 1 }),
});

export type Violation = Static<typeof ViolationSchema>;

export const PlayabilityResultSchema = Type.Object({
  violations: Type.Array(ViolationSchema),
  difficulty: Type.Union([
    Type.Literal("beginner"),
    Type.Literal("intermediate"),
    Type.Literal("advanced"),
  ]),
  flagged_bars: Type.Array(Type.Integer({ minimum: 0 })),
});

export type PlayabilityResult = Static<typeof PlayabilityResultSchema>;

export const LintViolationSchema = Type.Object({
  bar: Type.Integer({ minimum: 0 }),
  beat: Type.Number({ minimum: 0 }),
  type: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  voices: Type.Array(Type.String()),
});

export type LintViolation = Static<typeof LintViolationSchema>;

export const VoiceRangeSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  lowest: Pitch,
  highest: Pitch,
});

export type VoiceRange = Static<typeof VoiceRangeSchema>;

export const ChordAnalysisSchema = Type.Object({
  bar: Type.Integer({ minimum: 0 }),
  beat: Type.Number({ minimum: 0 }),
  pitches: Type.Array(Pitch),
  chord: Type.Optional(Type.String()),
  romanNumeral: Type.Optional(Type.String()),
});

export type ChordAnalysis = Static<typeof ChordAnalysisSchema>;

export const AnalysisResultSchema = Type.Object({
  key: Type.String({ minLength: 1 }),
  timeSignature: Type.String({ minLength: 1 }),
  voices: Type.Array(VoiceRangeSchema),
  chords: Type.Array(ChordAnalysisSchema),
});

export type AnalysisResult = Static<typeof AnalysisResultSchema>;

export const TuningEntrySchema = Type.Intersect([
  Type.Object({
    pitch: Pitch,
    note: Pitch,
  }),
  Type.Partial(
    Type.Object({
      course: Type.Integer({ minimum: 1 }),
      string: Type.Integer({ minimum: 1 }),
      re_entrant: Type.Boolean(),
    })
  ),
]);

export type TuningEntry = Static<typeof TuningEntrySchema>;

export const StringingVariantSchema = Type.Object({
  course4: Type.String({ minLength: 1 }),
  course5: Type.String({ minLength: 1 }),
  origin: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
});

export type StringingVariant = Static<typeof StringingVariantSchema>;

export const StringingSchema = Type.Object({
  default: Type.Union([Type.Literal("french"), Type.Literal("italian"), Type.Literal("mixed")]),
  variants: Type.Object({
    french: StringingVariantSchema,
    italian: StringingVariantSchema,
    mixed: StringingVariantSchema,
  }),
});

export type Stringing = Static<typeof StringingSchema>;

export const InstrumentProfileSchema = Type.Intersect([
  Type.Object({
    id: InstrumentId,
    name: Type.String({ minLength: 1 }),
    tuning: Type.Optional(Type.Array(TuningEntrySchema)),
    frets: Type.Optional(Type.Integer({ minimum: 0 })),
    constraints: Type.Array(Type.String({ minLength: 1 })),
    notation: Type.String({ minLength: 1 }),
  }),
  Type.Partial(
    Type.Object({
      type: Type.String(),
      courses: Type.Integer({ minimum: 1 }),
      strings: Type.Integer({ minimum: 1 }),
      staves: Type.Integer({ minimum: 1 }),
      fretted_courses: Type.Integer({ minimum: 0 }),
      open_courses: Type.Integer({ minimum: 0 }),
      fretted_strings: Type.Integer({ minimum: 0 }),
      open_strings: Type.Integer({ minimum: 0 }),
      diapason_schemes: Type.Record(Type.String(), Type.Array(Pitch)),
      stringing: StringingSchema,
      range: Type.Object({
        lowest: Pitch,
        highest: Pitch,
      }),
      clef: Type.String(),
    })
  ),
]);

export type InstrumentProfile = Static<typeof InstrumentProfileSchema>;

export const ArrangementMetadataSchema = Type.Record(Type.String(), Type.Any());

export type ArrangementMetadata = Static<typeof ArrangementMetadataSchema>;

export const CreateArrangementSchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  instrument: Type.String({ minLength: 1 }),
  lySource: Type.String({ minLength: 1 }),
  metadata: Type.Optional(ArrangementMetadataSchema),
});

export type CreateArrangement = Static<typeof CreateArrangementSchema>;

export const ArrangementSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  instrument: Type.String(),
  lySource: Type.String(),
  metadata: Type.Optional(ArrangementMetadataSchema),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export type Arrangement = Static<typeof ArrangementSchema>;

export const ArrangementSummarySchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  instrument: Type.String(),
  createdAt: Type.String(),
});

export type ArrangementSummary = Static<typeof ArrangementSummarySchema>;

export const CompileParamsSchema = Type.Object({
  source: Type.String({ minLength: 1, description: "LilyPond source code" }),
  format: Type.Optional(
    Type.Union([Type.Literal("svg"), Type.Literal("pdf"), Type.Literal("both")], { default: "svg" })
  ),
});

export type CompileParams = Static<typeof CompileParamsSchema>;

export const TabulateParamsSchema = Type.Object({
  pitch: Pitch,
  instrument: InstrumentId,
});

export type TabulateParams = Static<typeof TabulateParamsSchema>;

export const VoicingsParamsSchema = Type.Object({
  notes: Type.Array(Pitch, { minItems: 1 }),
  instrument: InstrumentId,
  max_stretch: Type.Optional(Type.Number({ minimum: 0 })),
});

export type VoicingsParams = Static<typeof VoicingsParamsSchema>;

export const PassageNoteSchema = Type.Object({
  pitch: Pitch,
  duration: Type.Optional(Type.String()),
  position: Type.Optional(TabPositionSchema),
  voice: Type.Optional(Type.String()),
});

export type PassageNote = Static<typeof PassageNoteSchema>;

export const BarSchema = Type.Object({
  bar: Type.Integer({ minimum: 1 }),
  notes: Type.Array(PassageNoteSchema),
});

export type Bar = Static<typeof BarSchema>;

export const CheckPlayabilityParamsSchema = Type.Object({
  bars: Type.Array(BarSchema),
  instrument: InstrumentId,
});

export type CheckPlayabilityParams = Static<typeof CheckPlayabilityParamsSchema>;

export const TransposeParamsSchema = Type.Object({
  source: Type.String({ minLength: 1 }),
  interval: Type.String({ minLength: 1 }),
  instrument: InstrumentId,
});

export type TransposeParams = Static<typeof TransposeParamsSchema>;

export const DiapasonsParamsSchema = Type.Object({
  key: Type.String({ minLength: 1 }),
  instrument: Type.Optional(Type.String({ default: "baroque-lute-13" })),
});

export type DiapasonsParams = Static<typeof DiapasonsParamsSchema>;

export const FretboardParamsSchema = Type.Object({
  positions: Type.Array(TabPositionSchema),
  instrument: InstrumentId,
});

export type FretboardParams = Static<typeof FretboardParamsSchema>;

export const ChordifyParamsSchema = Type.Object({
  source: Type.String(),
});

export type ChordifyParams = Static<typeof ChordifyParamsSchema>;

export const AnalyzeParamsSchema = Type.Object({
  source: Type.String({
    description: "MusicXML source as string, or base64-encoded MusicXML file",
  }),
  format: Type.Optional(
    Type.Union([Type.Literal("musicxml"), Type.Literal("lilypond")], { default: "musicxml" })
  ),
});

export type AnalyzeParams = Static<typeof AnalyzeParamsSchema>;

export const LintParamsSchema = Type.Object({
  source: Type.String({ description: "LilyPond or MusicXML passage to check" }),
  format: Type.Optional(
    Type.Union([Type.Literal("lilypond"), Type.Literal("musicxml")], { default: "lilypond" })
  ),
  rules: Type.Optional(
    Type.Array(
      Type.Union([
        Type.Literal("parallel_fifths"),
        Type.Literal("parallel_octaves"),
        Type.Literal("voice_crossing"),
        Type.Literal("spacing"),
        Type.Literal("direct_octaves"),
        Type.Literal("unresolved_leading_tone"),
        Type.Literal("all"),
      ]),
      { default: ["all"] }
    )
  ),
});

export type LintParams = Static<typeof LintParamsSchema>;

export const TheoryParamsSchema = Type.Object({
  operation: Type.Union([
    Type.Literal("interval"),
    Type.Literal("transpose"),
    Type.Literal("chord_detect"),
    Type.Literal("chord_notes"),
    Type.Literal("scale_notes"),
    Type.Literal("scale_chords"),
    Type.Literal("roman_parse"),
    Type.Literal("enharmonic"),
  ]),
  args: Type.Record(Type.String(), Type.Any(), {
    description: "Operation-specific arguments.",
  }),
});

export type TheoryParams = Static<typeof TheoryParamsSchema>;

export const AlfabetoChartIdSchema = Type.Union([
  Type.Literal("tyler-universal"),
  Type.Literal("foscarini"),
]);

export type AlfabetoChartId = Static<typeof AlfabetoChartIdSchema>;

export const AlfabetoLookupParamsSchema = Type.Object({
  chord_name: Type.Optional(
    Type.String({
      minLength: 1,
      description: 'Chord name to look up, e.g. "G major", "Dm", "Bb".',
    })
  ),
  pitch_classes: Type.Optional(
    Type.Array(Type.Integer({ minimum: 0, maximum: 11 }), {
      minItems: 1,
      description: "MIDI pitch classes (0-11) to match instead of chord_name.",
    })
  ),
  chart_id: Type.Optional(AlfabetoChartIdSchema),
  max_fret: Type.Optional(Type.Integer({ minimum: 1, maximum: 12 })),
  include_barre: Type.Optional(Type.Boolean()),
  // Backward-compatible camelCase aliases for existing callers. Prefer snake_case
  // at external tool boundaries.
  chordName: Type.Optional(Type.String({ minLength: 1 })),
  pitchClasses: Type.Optional(
    Type.Array(Type.Integer({ minimum: 0, maximum: 11 }), { minItems: 1 })
  ),
  chartId: Type.Optional(AlfabetoChartIdSchema),
  maxFret: Type.Optional(Type.Integer({ minimum: 1, maximum: 12 })),
  includeBarreVariants: Type.Optional(Type.Boolean()),
});

export type AlfabetoLookupParams = Static<typeof AlfabetoLookupParamsSchema>;

export const ValidateParamsSchema = Type.Object({
  source: Type.String({ minLength: 1, description: "LilyPond source to validate" }),
});

export type ValidateParams = Static<typeof ValidateParamsSchema>;

export const ValidateResultSchema = Type.Object({
  valid: Type.Boolean(),
  errors: Type.Array(CompileErrorSchema),
});

export type ValidateResult = Static<typeof ValidateResultSchema>;
