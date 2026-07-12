/**
 * Engrave tool input/output schemas.
 *
 * Uses TypeBox (the project's schema library) to define the JSON schema
 * for the engrave tool's structured musical input and result types.
 */

import { type Static, Type } from "@sinclair/typebox";
import { AlfabetoChartIdSchema } from "../types.js";

// === Event types (discriminated union) ===

const OrnamentSchema = Type.Union([
  Type.Literal("trill"),
  Type.Literal("mordent"),
  Type.Literal("turn"),
  Type.Literal("prall"),
]);

const EventIdentityProperties = {
  event_id: Type.Optional(Type.String({ minLength: 1 })),
  measure_id: Type.Optional(Type.String({ minLength: 1 })),
  tuplet_start: Type.Optional(
    Type.Object({
      actual_notes: Type.Integer({ minimum: 2 }),
      normal_notes: Type.Integer({ minimum: 1 }),
    })
  ),
  tuplet_end: Type.Optional(Type.Boolean()),
};

export const PositionNoteSchema = Type.Object({
  ...EventIdentityProperties,
  type: Type.Literal("note"),
  input: Type.Literal("position"),
  course: Type.Integer({ minimum: 1 }),
  fret: Type.Integer({ minimum: 0 }),
  duration: Type.String({ minLength: 1 }),
  tie: Type.Optional(Type.Boolean()),
  slur_start: Type.Optional(Type.Boolean()),
  slur_end: Type.Optional(Type.Boolean()),
  ornament: Type.Optional(OrnamentSchema),
});

export type PositionNote = Static<typeof PositionNoteSchema>;

export const PitchNoteSchema = Type.Object({
  ...EventIdentityProperties,
  type: Type.Literal("note"),
  input: Type.Literal("pitch"),
  pitch: Type.String({ minLength: 1 }),
  duration: Type.String({ minLength: 1 }),
  tie: Type.Optional(Type.Boolean()),
  slur_start: Type.Optional(Type.Boolean()),
  slur_end: Type.Optional(Type.Boolean()),
  ornament: Type.Optional(OrnamentSchema),
});

export type PitchNote = Static<typeof PitchNoteSchema>;

/** A chord position entry — either course/fret or pitch. */
const ChordPositionSchema = Type.Union([
  Type.Object({
    input: Type.Literal("position"),
    course: Type.Integer({ minimum: 1 }),
    fret: Type.Integer({ minimum: 0 }),
  }),
  Type.Object({
    input: Type.Literal("pitch"),
    pitch: Type.String({ minLength: 1 }),
  }),
]);

export const ChordEventSchema = Type.Object({
  ...EventIdentityProperties,
  type: Type.Literal("chord"),
  positions: Type.Array(ChordPositionSchema, { minItems: 2 }),
  duration: Type.String({ minLength: 1 }),
  tie: Type.Optional(Type.Boolean()),
});

export type ChordEvent = Static<typeof ChordEventSchema>;

export const RestEventSchema = Type.Object({
  ...EventIdentityProperties,
  type: Type.Literal("rest"),
  duration: Type.String({ minLength: 1 }),
  spacer: Type.Optional(Type.Boolean()),
});

export type RestEvent = Static<typeof RestEventSchema>;

export const AlfabetoEventSchema = Type.Object({
  ...EventIdentityProperties,
  type: Type.Literal("alfabeto"),
  duration: Type.String({ minLength: 1 }),
  chordName: Type.Optional(
    Type.String({
      minLength: 1,
      description: 'Chord name to resolve through alfabetoLookup, e.g. "G major", "Dm".',
    })
  ),
  pitchClasses: Type.Optional(
    Type.Array(Type.Integer({ minimum: 0, maximum: 11 }), {
      minItems: 1,
      description: "MIDI pitch classes (0-11) to resolve through alfabetoLookup.",
    })
  ),
  letter: Type.Optional(
    Type.String({
      minLength: 1,
      description: "Optional alfabeto symbol to select a specific chart shape/match.",
    })
  ),
  chartId: Type.Optional(AlfabetoChartIdSchema),
  maxFret: Type.Optional(Type.Integer({ minimum: 1, maximum: 12 })),
  includeBarreVariants: Type.Optional(Type.Boolean()),
  tie: Type.Optional(Type.Boolean()),
});

export type AlfabetoEvent = Static<typeof AlfabetoEventSchema>;

export const AlfabetoChordEventSchema = Type.Object({
  ...EventIdentityProperties,
  type: Type.Literal("alfabeto_chord"),
  chord_name: Type.String({
    minLength: 1,
    description: 'Chord name to resolve through alfabetoLookup, e.g. "G major", "Dm".',
  }),
  duration: Type.String({ minLength: 1 }),
  chart_id: Type.Optional(AlfabetoChartIdSchema),
  prefer: Type.Optional(
    Type.String({
      minLength: 1,
      description: 'Optional preferred alfabeto letter when multiple matches exist, e.g. "A".',
    })
  ),
  tie: Type.Optional(Type.Boolean()),
});

export type AlfabetoChordEvent = Static<typeof AlfabetoChordEventSchema>;

export const EventSchema = Type.Union([
  PositionNoteSchema,
  PitchNoteSchema,
  ChordEventSchema,
  RestEventSchema,
  AlfabetoEventSchema,
  AlfabetoChordEventSchema,
]);

export type EngraveMusicEvent = Static<typeof EventSchema>;

// === Key signature ===

export const KeySchema = Type.Object({
  tonic: Type.String({ minLength: 1 }),
  mode: Type.String({ minLength: 1 }),
});

export type EngraveKey = Static<typeof KeySchema>;

// === Bar ===

export const EngraveBarSchema = Type.Object({
  events: Type.Array(EventSchema, { minItems: 1 }),
  key: Type.Optional(KeySchema),
  time: Type.Optional(Type.String({ minLength: 1 })),
});

export type EngraveBar = Static<typeof EngraveBarSchema>;

// === Melody (for voice-and-tab template) ===

const MelodyNoteSchema = Type.Object({
  type: Type.Literal("note"),
  pitch: Type.String({ minLength: 1 }),
  duration: Type.String({ minLength: 1 }),
  lyric: Type.Optional(Type.String()),
});

const MelodyRestSchema = Type.Object({
  type: Type.Literal("rest"),
  duration: Type.String({ minLength: 1 }),
});

const MelodyEventSchema = Type.Union([MelodyNoteSchema, MelodyRestSchema]);

export type MelodyEvent = Static<typeof MelodyEventSchema>;

const MelodyBarSchema = Type.Object({
  events: Type.Array(MelodyEventSchema, { minItems: 1 }),
});

export const MelodySchema = Type.Object({
  bars: Type.Array(MelodyBarSchema, { minItems: 1 }),
});

export type Melody = Static<typeof MelodySchema>;

// === Top-level params ===

export const EngraveParamsSchema = Type.Object({
  instrument: Type.String({ minLength: 1 }),
  template: Type.String({ minLength: 1 }),
  title: Type.Optional(Type.String()),
  composer: Type.Optional(Type.String()),
  key: Type.Optional(KeySchema),
  time: Type.Optional(Type.String({ minLength: 1 })),
  tempo: Type.Optional(Type.Integer({ minimum: 1 })),
  pickup: Type.Optional(Type.String({ minLength: 1 })),
  diapason_scheme: Type.Optional(Type.String()),
  instrument_instance_digest: Type.Optional(Type.String({ pattern: "^[a-f0-9]{64}$" })),
  stringing: Type.Optional(Type.String({ minLength: 1 })),

  bars: Type.Array(EngraveBarSchema, { minItems: 1 }),

  melody: Type.Optional(MelodySchema),
});

export type EngraveParams = Static<typeof EngraveParamsSchema>;

// === Result ===

export const EngraveResultSchema = Type.Object({
  source: Type.String(),
  warnings: Type.Array(Type.String()),
});

export type EngraveResult = Static<typeof EngraveResultSchema>;
