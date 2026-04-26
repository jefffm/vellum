import { describe, expect, it } from "vitest";
import {
  MIDI_MAP,
  midiToNote,
  noteToMidi,
  parsePitch,
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
