import { describe, expect, it } from "vitest";
import { TYLER_UNIVERSAL } from "../charts/tyler-universal.js";
import { FOSCARINI } from "../charts/foscarini.js";
import { noteToMidi } from "../../pitch.js";
import type { AlfabetoShapeEntry } from "../types.js";

/**
 * Baroque guitar open-string MIDI values (c1–c5).
 */
const OPEN_MIDI = [
  noteToMidi("E4"), // c1
  noteToMidi("B3"), // c2
  noteToMidi("G3"), // c3
  noteToMidi("D4"), // c4
  noteToMidi("A3"), // c5
];

/**
 * Compute the sorted unique pitch classes (0–11) for a shape.
 */
function pitchClasses(shape: AlfabetoShapeEntry): number[] {
  const classes = new Set<number>();

  for (let i = 0; i < 5; i++) {
    classes.add((OPEN_MIDI[i] + shape.frets[i]) % 12);
  }

  return [...classes].sort((a, b) => a - b);
}

/**
 * Parse a chord name like "G major" into expected pitch classes.
 */
function expectedPitchClasses(chord: string): number[] {
  const ROOT_MAP: Record<string, number> = {
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

  const match = chord.match(/^([A-G][#b]?)\s+(major|minor)/);

  if (!match) return [];

  const root = ROOT_MAP[match[1]];

  if (root === undefined) return [];

  if (match[2] === "major") {
    return [root, (root + 4) % 12, (root + 7) % 12].sort((a, b) => a - b);
  }

  return [root, (root + 3) % 12, (root + 7) % 12].sort((a, b) => a - b);
}

describe("pitch validation — Tyler Universal", () => {
  // Only validate standard triads (major/minor). Skip non-triadic chords.
  const triadicShapes = TYLER_UNIVERSAL.shapes.filter((s) =>
    /^[A-G][#b]?\s+(major|minor)$/.test(s.chord)
  );

  it.each(triadicShapes.map((s) => [s.letter, s.chord, s]))(
    "%s (%s) produces correct pitch classes",
    (_letter, _chord, shape) => {
      const actual = pitchClasses(shape as AlfabetoShapeEntry);
      const expected = expectedPitchClasses((shape as AlfabetoShapeEntry).chord);
      expect(actual).toEqual(expected);
    }
  );

  it("has 27 shapes total (cross + 15 standard + 8 extended + 3 special)", () => {
    expect(TYLER_UNIVERSAL.shapes).toHaveLength(27);
  });
});

describe("pitch validation — Foscarini", () => {
  it("Foscarini L differs from Tyler L", () => {
    const tylerL = TYLER_UNIVERSAL.shapes.find((s) => s.letter === "L")!;
    const foscariniL = FOSCARINI.shapes.find((s) => s.letter === "L")!;

    expect(tylerL.frets[1]).toBe(4); // Tyler c2=4 (Eb4)
    expect(foscariniL.frets[1]).toBe(3); // Foscarini c2=3 (D4)
  });

  it("Foscarini has M† (Eb minor)", () => {
    const mDagger = FOSCARINI.shapes.find((s) => s.letter === "M\u2020");
    expect(mDagger).toBeDefined();
    expect(mDagger!.chord).toBe("Eb minor");
  });

  it("Foscarini has B· (Dm add4)", () => {
    const bDot = FOSCARINI.shapes.find((s) => s.letter === "B\u00B7");
    expect(bDot).toBeDefined();
    expect(bDot!.chord).toBe("Dm add4");
  });

  it("all triadic Foscarini shapes produce correct pitch classes", () => {
    // Foscarini's L is labelled "C minor" but has an added 9th (D) on c2,
    // so it produces 4 pitch classes instead of 3. Skip it here.
    const triadic = FOSCARINI.shapes.filter(
      (s) => /^[A-G][#b]?\s+(major|minor)$/.test(s.chord) && s.letter !== "L"
    );

    for (const shape of triadic) {
      const actual = pitchClasses(shape);
      const expected = expectedPitchClasses(shape.chord);
      expect(actual).toEqual(expected);
    }
  });

  it("Foscarini L produces C minor + D (the 9th)", () => {
    const l = FOSCARINI.shapes.find((s) => s.letter === "L")!;
    const pcs = pitchClasses(l);
    // C=0, D=2, Eb=3, G=7
    expect(pcs).toEqual([0, 2, 3, 7]);
  });
});

describe("specific shape verifications", () => {
  it("+ (cross) = E minor: E4 B3 G3 E4 B3", () => {
    const cross = TYLER_UNIVERSAL.shapes.find((s) => s.letter === "+")!;
    expect(cross.frets).toEqual([0, 0, 0, 2, 2]);

    const midi = cross.frets.map((f, i) => OPEN_MIDI[i] + f);
    // E4=64, B3=59, G3=55, E4=64, B3=59
    expect(midi).toEqual([64, 59, 55, 64, 59]);
  });

  it("A = G major: G4 D4 G3 D4 B3", () => {
    const a = TYLER_UNIVERSAL.shapes.find((s) => s.letter === "A")!;

    const midi = a.frets.map((f, i) => OPEN_MIDI[i] + f);
    // G4=67, D4=62, G3=55, D4=62, B3=59
    expect(midi).toEqual([67, 62, 55, 62, 59]);
  });

  it("B = C major (not C minor)", () => {
    const b = TYLER_UNIVERSAL.shapes.find((s) => s.letter === "B")!;
    expect(b.chord).toBe("C major");

    const classes = pitchClasses(b);
    // C=0, E=4, G=7
    expect(classes).toEqual([0, 4, 7]);
  });

  it("L = C minor: G4 Eb4 G3 Eb4 C4", () => {
    const l = TYLER_UNIVERSAL.shapes.find((s) => s.letter === "L")!;
    expect(l.chord).toBe("C minor");

    const midi = l.frets.map((f, i) => OPEN_MIDI[i] + f);
    // G4=67, Eb4=63, G3=55, Eb4=63, C4=60
    expect(midi).toEqual([67, 63, 55, 63, 60]);
  });
});
