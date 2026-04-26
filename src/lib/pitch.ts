import { Note } from "tonal";

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
