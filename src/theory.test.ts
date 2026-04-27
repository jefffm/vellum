import { describe, expect, it } from "vitest";
import { runTheoryOperation } from "./theory.js";

describe("runTheoryOperation", () => {
  it("computes intervals", () => {
    expect(runTheoryOperation({ operation: "interval", args: { from: "C4", to: "G4" } })).toBe(
      "P5"
    );
  });

  it("transposes notes", () => {
    expect(
      runTheoryOperation({ operation: "transpose", args: { note: "C4", interval: "P5" } })
    ).toBe("G4");
    expect(
      runTheoryOperation({ operation: "transpose", args: { note: "F#4", interval: "m3" } })
    ).toBe("A4");
  });

  it("detects chords", () => {
    expect(
      runTheoryOperation({ operation: "chord_detect", args: { notes: ["C", "E", "G"] } })
    ).toContain("CM");
  });

  it("spells chord notes", () => {
    expect(runTheoryOperation({ operation: "chord_notes", args: { chord: "Dm" } })).toEqual([
      "D",
      "F",
      "A",
    ]);
  });

  it("spells scale notes", () => {
    expect(runTheoryOperation({ operation: "scale_notes", args: { scale: "A minor" } })).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
    ]);
  });

  it("returns diatonic scale chords", () => {
    expect(runTheoryOperation({ operation: "scale_chords", args: { key: "A minor" } })).toEqual([
      "Am",
      "Bdim",
      "C",
      "Dm",
      "Em",
      "F",
      "G",
    ]);
  });

  it("parses Roman numerals in key", () => {
    expect(
      runTheoryOperation({ operation: "roman_parse", args: { key: "C", roman: "V" } })
    ).toEqual({
      roman: "V",
      key: "C",
      chord: "G",
      interval: "P5",
      chordType: "",
    });
  });

  it("finds enharmonic spellings", () => {
    expect(runTheoryOperation({ operation: "enharmonic", args: { note: "C#4" } })).toBe("Db4");
  });
});
