import { describe, expect, it } from "vitest";
import {
  MIDI_MAP,
  PITCH_TO_LILYPOND,
  midiToNote,
  noteToMidi,
  parsePitch,
  scientificToLilyPond,
  semitonesBetween,
  transposeNote,
} from "./pitch.js";

describe("pitch utilities", () => {
  it("converts note names to MIDI numbers", () => {
    expect(noteToMidi("C4")).toBe(60);
    expect(noteToMidi("A4")).toBe(69);
    expect(noteToMidi("F4")).toBe(65);
    expect(noteToMidi("A1")).toBe(33);
  });

  it("converts MIDI numbers to normalized note names", () => {
    expect(midiToNote(60)).toBe("C4");
    expect(midiToNote(63)).toBe("Eb4");
  });

  it("handles enharmonic sharps and flats", () => {
    expect(noteToMidi("Eb4")).toBe(63);
    expect(noteToMidi("D#4")).toBe(63);
    expect(noteToMidi("Gb3")).toBe(noteToMidi("F#3"));
  });

  it("computes semitone distances", () => {
    expect(semitonesBetween("C4", "E4")).toBe(4);
    expect(semitonesBetween("E4", "C4")).toBe(-4);
  });

  it("transposes notes by semitone offsets", () => {
    expect(transposeNote("C4", 7)).toBe("G4");
    expect(transposeNote("D4", -2)).toBe("C4");
  });

  it("parses structured pitch components", () => {
    expect(parsePitch("Eb4")).toEqual({ letter: "E", accidental: "b", octave: 4 });
    expect(parsePitch("F#3")).toEqual({ letter: "F", accidental: "#", octave: 3 });
    expect(parsePitch("c♯-1")).toEqual({ letter: "C", accidental: "#", octave: -1 });
  });

  it("exposes standard pitch-class MIDI mappings", () => {
    expect(MIDI_MAP.C).toBe(0);
    expect(MIDI_MAP["C#"]).toBe(1);
    expect(MIDI_MAP.Db).toBe(1);
    expect(MIDI_MAP.B).toBe(11);
  });

  it("verifies baroque lute tuning MIDI values", () => {
    expect(["F4", "D4", "A3", "F3", "D3", "A2"].map(noteToMidi)).toEqual([65, 62, 57, 53, 50, 45]);
  });

  it("verifies baroque guitar tuning MIDI values", () => {
    expect(["E4", "B3", "G3", "D4", "A3"].map(noteToMidi)).toEqual([64, 59, 55, 62, 57]);
  });

  it("round-trips standard natural notes", () => {
    for (const note of ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]) {
      expect(midiToNote(noteToMidi(note))).toBe(note);
    }
  });

  it("throws on invalid input", () => {
    expect(() => noteToMidi("not-a-note")).toThrow(/invalid pitch/i);
    expect(() => midiToNote(128)).toThrow(/invalid midi/i);
    expect(() => parsePitch("H4")).toThrow(/invalid pitch/i);
  });
});

describe("PITCH_TO_LILYPOND", () => {
  it("maps all 17 standard pitch classes", () => {
    expect(Object.keys(PITCH_TO_LILYPOND)).toHaveLength(17);
  });

  it("maps naturals to lowercase", () => {
    expect(PITCH_TO_LILYPOND.C).toBe("c");
    expect(PITCH_TO_LILYPOND.D).toBe("d");
    expect(PITCH_TO_LILYPOND.G).toBe("g");
    expect(PITCH_TO_LILYPOND.B).toBe("b");
  });

  it("maps sharps to -is suffix", () => {
    expect(PITCH_TO_LILYPOND["C#"]).toBe("cis");
    expect(PITCH_TO_LILYPOND["F#"]).toBe("fis");
    expect(PITCH_TO_LILYPOND["G#"]).toBe("gis");
  });

  it("maps flats to -es suffix with E/A exceptions", () => {
    expect(PITCH_TO_LILYPOND.Eb).toBe("ees");
    expect(PITCH_TO_LILYPOND.Ab).toBe("aes");
    expect(PITCH_TO_LILYPOND.Bb).toBe("bes");
    expect(PITCH_TO_LILYPOND.Db).toBe("des");
    expect(PITCH_TO_LILYPOND.Gb).toBe("ges");
  });
});

describe("scientificToLilyPond", () => {
  it("converts notes in the unmarked octave (octave 3)", () => {
    expect(scientificToLilyPond("C3")).toBe("c");
    expect(scientificToLilyPond("D3")).toBe("d");
    expect(scientificToLilyPond("G3")).toBe("g");
    expect(scientificToLilyPond("B3")).toBe("b");
  });

  it("adds ticks for octaves above 3", () => {
    expect(scientificToLilyPond("C4")).toBe("c'");
    expect(scientificToLilyPond("G4")).toBe("g'");
    expect(scientificToLilyPond("A4")).toBe("a'");
    expect(scientificToLilyPond("C5")).toBe("c''");
    expect(scientificToLilyPond("D6")).toBe("d'''");
    expect(scientificToLilyPond("E7")).toBe("e''''");
  });

  it("adds commas for octaves below 3", () => {
    expect(scientificToLilyPond("A2")).toBe("a,");
    expect(scientificToLilyPond("C2")).toBe("c,");
    expect(scientificToLilyPond("A1")).toBe("a,,");
    expect(scientificToLilyPond("C1")).toBe("c,,");
    expect(scientificToLilyPond("C0")).toBe("c,,,");
  });

  it("handles sharps", () => {
    expect(scientificToLilyPond("F#3")).toBe("fis");
    expect(scientificToLilyPond("C#4")).toBe("cis'");
    expect(scientificToLilyPond("G#5")).toBe("gis''");
    expect(scientificToLilyPond("F#5")).toBe("fis''");
  });

  it("handles flats", () => {
    expect(scientificToLilyPond("Eb3")).toBe("ees");
    expect(scientificToLilyPond("Bb1")).toBe("bes,,");
    expect(scientificToLilyPond("Ab4")).toBe("aes'");
    expect(scientificToLilyPond("Db3")).toBe("des");
    expect(scientificToLilyPond("Gb2")).toBe("ges,");
  });

  it("preserves enharmonic spelling", () => {
    // D# vs Eb — same MIDI note, different LilyPond output
    expect(scientificToLilyPond("D#3")).toBe("dis");
    expect(scientificToLilyPond("Eb3")).toBe("ees");
    // A# vs Bb
    expect(scientificToLilyPond("A#2")).toBe("ais,");
    expect(scientificToLilyPond("Bb2")).toBe("bes,");
  });

  it("handles baroque lute range pitches", () => {
    // Baroque lute fretted courses: F4, D4, A3, F3, D3, A2
    expect(scientificToLilyPond("F4")).toBe("f'");
    expect(scientificToLilyPond("D4")).toBe("d'");
    expect(scientificToLilyPond("A3")).toBe("a");
    expect(scientificToLilyPond("F3")).toBe("f");
    expect(scientificToLilyPond("D3")).toBe("d");
    expect(scientificToLilyPond("A2")).toBe("a,");
  });

  it("handles theorbo diapason range", () => {
    // Theorbo bass strings go very low
    expect(scientificToLilyPond("G1")).toBe("g,,");
    expect(scientificToLilyPond("A0")).toBe("a,,,");
  });

  it("throws on invalid pitch input", () => {
    expect(() => scientificToLilyPond("XY9")).toThrow(/invalid pitch/i);
    expect(() => scientificToLilyPond("")).toThrow(/invalid pitch/i);
  });

  it("handles double-sharps (## notation)", () => {
    expect(scientificToLilyPond("C##4")).toBe("cisis'");
    expect(scientificToLilyPond("F##5")).toBe("fisis''");
    expect(scientificToLilyPond("G##3")).toBe("gisis");
  });

  it("handles double-flats (bb notation)", () => {
    expect(scientificToLilyPond("Ebb3")).toBe("eeses");
    expect(scientificToLilyPond("Bbb2")).toBe("beses,");
    expect(scientificToLilyPond("Abb4")).toBe("aeses'");
  });

  it("handles x notation for double-sharp", () => {
    expect(scientificToLilyPond("Fx4")).toBe("fisis'");
    expect(scientificToLilyPond("Cx5")).toBe("cisis''");
    expect(scientificToLilyPond("Gx3")).toBe("gisis");
  });
});

describe("parsePitch — strict accidental validation", () => {
  it("accepts valid single accidentals", () => {
    expect(() => parsePitch("C#4")).not.toThrow();
    expect(() => parsePitch("Eb3")).not.toThrow();
    expect(() => parsePitch("D4")).not.toThrow();
  });

  it("accepts valid double accidentals", () => {
    expect(() => parsePitch("C##4")).not.toThrow();
    expect(() => parsePitch("Ebb3")).not.toThrow();
    expect(() => parsePitch("Cx4")).not.toThrow();
  });

  it("rejects mixed sharp+flat accidentals", () => {
    expect(() => parsePitch("C#b4")).toThrow(/invalid pitch/i);
    expect(() => parsePitch("Cb#4")).toThrow(/invalid pitch/i);
  });

  it("rejects triple accidentals", () => {
    expect(() => parsePitch("C###4")).toThrow(/invalid pitch/i);
    expect(() => parsePitch("Cbbb4")).toThrow(/invalid pitch/i);
  });

  it("normalizes x to ## in parsed output", () => {
    const parsed = parsePitch("Fx4");
    expect(parsed.accidental).toBe("##");
  });
});
