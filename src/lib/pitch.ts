import { Note } from "tonal";

/**
 * Map from scientific pitch-class names (e.g. "C", "Eb", "F#") to LilyPond
 * note names (e.g. "c", "ees", "fis"). Shared between pitch utilities and
 * the diapasons tool.
 */
export const PITCH_TO_LILYPOND: Record<string, string> = {
  C: "c",
  "C#": "cis",
  Db: "des",
  D: "d",
  "D#": "dis",
  Eb: "ees",
  E: "e",
  F: "f",
  "F#": "fis",
  Gb: "ges",
  G: "g",
  "G#": "gis",
  Ab: "aes",
  A: "a",
  "A#": "ais",
  Bb: "bes",
  B: "b",
};

export const MIDI_MAP = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
} as const;

export type ParsedPitch = {
  letter: string;
  accidental: string;
  octave: number;
};

const PITCH_PATTERN = /^([A-Ga-g])([#bx♯♭]*|b{0,2})(-?\d+)$/;

export function parsePitch(note: string): ParsedPitch {
  const match = note.trim().match(PITCH_PATTERN);

  if (!match) {
    throw new Error(`Invalid pitch: ${note}`);
  }

  const [, letter, accidental = "", octaveText] = match;

  return {
    letter: letter.toUpperCase(),
    accidental: accidental.replaceAll("♯", "#").replaceAll("♭", "b"),
    octave: Number(octaveText),
  };
}

export function noteToMidi(note: string): number {
  const midi = Note.midi(note);

  if (midi === null) {
    throw new Error(`Invalid pitch: ${note}`);
  }

  return midi;
}

export function midiToNote(midi: number): string {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new Error(`Invalid MIDI note: ${midi}`);
  }

  const note = Note.fromMidi(midi);

  if (!note) {
    throw new Error(`Invalid MIDI note: ${midi}`);
  }

  return note;
}

export function semitonesBetween(a: string, b: string): number {
  return noteToMidi(b) - noteToMidi(a);
}

export function transposeNote(note: string, semitones: number): string {
  if (!Number.isInteger(semitones)) {
    throw new Error(`Semitones must be an integer: ${semitones}`);
  }

  return midiToNote(noteToMidi(note) + semitones);
}

/**
 * Convert an accidental string (e.g. "#", "b", "##", "bb") to LilyPond
 * accidental suffix (e.g. "is", "es", "isis", "eses").
 */
function accidentalToLy(acc: string): string {
  return acc.replace(/#/g, "is").replace(/b/g, "es");
}

/**
 * Convert a numeric octave to LilyPond octave marks.
 *
 * LilyPond uses octave 3 as the unmarked octave:
 *   C3 = c (no mark)
 *   C4 = c'    (one tick up)
 *   C5 = c''   (two ticks up)
 *   C2 = c,    (one comma down)
 *   C1 = c,,   (two commas down)
 */
function octaveToLyMark(octave: number): string {
  const offset = octave - 3;

  if (offset > 0) return "'".repeat(offset);
  if (offset < 0) return ",".repeat(-offset);

  return "";
}

/**
 * Convert scientific pitch notation to LilyPond absolute pitch.
 *
 * Examples:
 *   "C4"  → "c'"        "A2"  → "a,"       "Eb3" → "ees"
 *   "F#5" → "fis''"     "Bb1" → "bes,,"    "D6"  → "d'''"
 *   "G4"  → "g'"        "A1"  → "a,,"
 *
 * Enharmonic spelling is preserved from the input: if the caller provides
 * "Eb3" the output is "ees"; if "D#3" the output is "dis".
 */
export function scientificToLilyPond(note: string): string {
  const parsed = parsePitch(note);
  const pitchClass = parsed.letter + parsed.accidental;
  const lyName =
    PITCH_TO_LILYPOND[pitchClass] ??
    parsed.letter.toLowerCase() + accidentalToLy(parsed.accidental);

  return lyName + octaveToLyMark(parsed.octave);
}
