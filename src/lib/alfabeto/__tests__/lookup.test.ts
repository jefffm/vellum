import { describe, expect, it } from "vitest";
import { alfabetoLookup, chordNameToPitchClasses, parseChordName } from "../lookup.js";

describe("parseChordName", () => {
  it("parses strict format", () => {
    expect(parseChordName("G major")).toEqual({ root: 7, quality: "major" });
    expect(parseChordName("C minor")).toEqual({ root: 0, quality: "minor" });
    expect(parseChordName("Bb major")).toEqual({ root: 10, quality: "major" });
    expect(parseChordName("F# minor")).toEqual({ root: 6, quality: "minor" });
  });

  it("parses alias format", () => {
    expect(parseChordName("Gm")).toEqual({ root: 7, quality: "minor" });
    expect(parseChordName("Bb")).toEqual({ root: 10, quality: "major" });
    expect(parseChordName("Dm")).toEqual({ root: 2, quality: "minor" });
    expect(parseChordName("Am")).toEqual({ root: 9, quality: "minor" });
  });

  it("handles whitespace", () => {
    expect(parseChordName("  G  major  ")).toEqual({ root: 7, quality: "major" });
  });

  it("returns null for invalid input", () => {
    expect(parseChordName("")).toBeNull();
    expect(parseChordName("xyz")).toBeNull();
  });
});

describe("chordNameToPitchClasses", () => {
  it("G major → {G=7, B=11, D=2}", () => {
    const pcs = chordNameToPitchClasses("G major");
    expect(pcs).not.toBeNull();
    expect([...pcs!].sort((a, b) => a - b)).toEqual([2, 7, 11]);
  });

  it("C minor → {C=0, Eb=3, G=7}", () => {
    const pcs = chordNameToPitchClasses("C minor");
    expect(pcs).not.toBeNull();
    expect([...pcs!].sort((a, b) => a - b)).toEqual([0, 3, 7]);
  });

  it("returns null for non-triadic names", () => {
    expect(chordNameToPitchClasses("Dm add4")).toBeNull();
  });
});

describe("alfabetoLookup", () => {
  it("finds G major → A (standard)", () => {
    const result = alfabetoLookup({ chordName: "G major" });

    expect(result.chartId).toBe("tyler-universal");

    const standard = result.matches.filter((m) => m.source === "standard");
    expect(standard.length).toBeGreaterThanOrEqual(1);
    expect(standard[0].letter).toBe("A");
    expect(standard[0].chord).toBe("G major");
  });

  it("finds C major → B (standard)", () => {
    const result = alfabetoLookup({ chordName: "C major" });
    const standard = result.matches.filter((m) => m.source === "standard");
    const letters = standard.map((m) => m.letter);

    expect(letters).toContain("B");
    expect(letters).toContain("Z");
  });

  it("finds E minor → + (cross) and 9 (standard)", () => {
    const result = alfabetoLookup({ chordName: "E minor" });
    const standard = result.matches.filter((m) => m.source === "standard");
    const letters = standard.map((m) => m.letter);

    expect(letters).toContain("+");
    expect(letters).toContain("9");
  });

  it("finds A major via barré: A barred at 2", () => {
    const result = alfabetoLookup({ chordName: "A major" });
    const barre = result.matches.filter((m) => m.source === "barre");

    const fromA = barre.find((m) => m.baseShape === "A" && m.barreAt === 2);
    expect(fromA).toBeDefined();
  });

  it("includes both standard and barré for A major (I is standard)", () => {
    const result = alfabetoLookup({ chordName: "A major" });
    const standard = result.matches.filter((m) => m.source === "standard");

    expect(standard.map((m) => m.letter)).toContain("I");
  });

  it("ranking: standard matches come before barré matches", () => {
    const result = alfabetoLookup({ chordName: "G major" });

    if (result.matches.length >= 2) {
      const firstBarre = result.matches.findIndex((m) => m.source === "barre");
      const lastStandard = result.matches
        .map((m, i) => (m.source === "standard" ? i : -1))
        .filter((i) => i >= 0)
        .pop();

      if (firstBarre >= 0 && lastStandard !== undefined) {
        expect(lastStandard).toBeLessThan(firstBarre);
      }
    }
  });

  it("respects maxFret", () => {
    const result = alfabetoLookup({ chordName: "G major", maxFret: 3 });
    const barre = result.matches.filter((m) => m.source === "barre");

    for (const match of barre) {
      for (const pos of match.positions) {
        expect(pos.fret).toBeLessThanOrEqual(3);
      }
    }
  });

  it("excludes barré when includeBarreVariants is false", () => {
    const result = alfabetoLookup({
      chordName: "G major",
      includeBarreVariants: false,
    });

    expect(result.matches.every((m) => m.source === "standard")).toBe(true);
  });

  it("supports pitch class lookup", () => {
    // G=7, B=11, D=2 → G major
    const result = alfabetoLookup({ pitchClasses: [7, 11, 2] });
    const standard = result.matches.filter((m) => m.source === "standard");

    expect(standard.map((m) => m.letter)).toContain("A");
  });

  it("uses Foscarini chart when specified", () => {
    const result = alfabetoLookup({
      chordName: "Eb minor",
      chartId: "foscarini",
    });

    // M† is Foscarini-only
    const standard = result.matches.filter((m) => m.source === "standard");
    const letters = standard.map((m) => m.letter);

    expect(letters).toContain("M\u2020");
  });

  it("returns empty for unrecognized chord", () => {
    const result = alfabetoLookup({ chordName: "zzz" });
    expect(result.matches).toHaveLength(0);
  });

  it("each match has 5 positions (one per course)", () => {
    const result = alfabetoLookup({ chordName: "G major" });

    for (const match of result.matches) {
      expect(match.positions).toHaveLength(5);

      for (const pos of match.positions) {
        expect(pos.course).toBeGreaterThanOrEqual(1);
        expect(pos.course).toBeLessThanOrEqual(5);
        expect(pos.fret).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
