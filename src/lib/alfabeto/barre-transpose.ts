import type { TabPosition } from "../../types.js";
import type { AlfabetoMatch, AlfabetoShapeEntry } from "./types.js";
import { noteToMidi } from "../pitch.js";

/**
 * Baroque guitar open-string MIDI values, indexed by course (1-based).
 * c1=E4, c2=B3, c3=G3, c4=D4 (re-entrant), c5=A3 (re-entrant).
 */
const OPEN_MIDI: readonly number[] = [
  0, // index 0 unused (courses are 1-based)
  noteToMidi("E4"), // c1 = 64
  noteToMidi("B3"), // c2 = 59
  noteToMidi("G3"), // c3 = 55
  noteToMidi("D4"), // c4 = 62
  noteToMidi("A3"), // c5 = 57
];

function qualityForFret(fret: number): TabPosition["quality"] {
  if (fret === 0) return "open";
  return fret <= 3 ? "low_fret" : "high_fret";
}

/**
 * Convert a shape entry to TabPosition[] at its base fret positions.
 */
export function shapeToPositions(shape: AlfabetoShapeEntry): TabPosition[] {
  return shape.frets.map((fret, index) => ({
    course: index + 1,
    fret,
    quality: qualityForFret(fret),
  }));
}

/**
 * Compute the set of MIDI pitch classes (0–11) produced by a shape.
 */
export function shapePitchClasses(shape: AlfabetoShapeEntry): Set<number> {
  const classes = new Set<number>();

  for (let i = 0; i < 5; i++) {
    classes.add((OPEN_MIDI[i + 1] + shape.frets[i]) % 12);
  }

  return classes;
}

/**
 * Transpose a shape entry by moving every fret up by `semitones`.
 * Returns a new match with the transposed positions and updated chord name.
 */
export function barreTranspose(
  shape: AlfabetoShapeEntry,
  semitones: number,
  maxFret: number
): AlfabetoMatch | null {
  if (semitones <= 0) return null;

  const transposedFrets = shape.frets.map((f) => f + semitones);

  if (transposedFrets.some((f) => f > maxFret)) return null;

  const positions: TabPosition[] = transposedFrets.map((fret, index) => ({
    course: index + 1,
    fret,
    quality: qualityForFret(fret),
  }));

  // Compute the new chord name by transposing the root
  const transposedChord = transposeChordName(shape.chord, semitones);

  return {
    letter: shape.letter,
    chord: transposedChord,
    positions,
    source: "barre",
    barreAt: semitones,
    baseShape: shape.letter,
  };
}

/**
 * Compute pitch classes for a barré-transposed shape.
 */
export function barrePitchClasses(shape: AlfabetoShapeEntry, semitones: number): Set<number> {
  const classes = new Set<number>();

  for (let i = 0; i < 5; i++) {
    classes.add((OPEN_MIDI[i + 1] + shape.frets[i] + semitones) % 12);
  }

  return classes;
}

// --- Chord name transposition helpers ---

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

const ROOT_TO_SEMITONE: Record<string, number> = {
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
};

const CHORD_ROOT_PATTERN = /^([A-G][#b]?)\s*(.*)/;

/**
 * Transpose a chord name (e.g. "G major") up by N semitones.
 * Returns e.g. "A major" for N=2.
 */
function transposeChordName(chordName: string, semitones: number): string {
  const match = chordName.match(CHORD_ROOT_PATTERN);

  if (!match) return chordName;

  const [, root, quality] = match;
  const rootSemitone = ROOT_TO_SEMITONE[root];

  if (rootSemitone === undefined) return chordName;

  const newRoot = NOTE_NAMES[(((rootSemitone + semitones) % 12) + 12) % 12];

  return quality ? `${newRoot} ${quality}` : newRoot;
}
