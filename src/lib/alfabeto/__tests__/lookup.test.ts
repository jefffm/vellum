import { describe, expect, it } from "vitest";
import {
  alfabetoLookup,
  chordNameToPitchClasses,
  lookupAlfabetoChart,
  parseChordName,
} from "../lookup.js";
import { SYNTHETIC_ALFABETO_CHART } from "./synthetic-chart.js";

describe("parseChordName", () => {
  it("parses strict and alias formats", () => {
    expect(parseChordName("G major")).toEqual({ root: 7, quality: "major" });
    expect(parseChordName("C minor")).toEqual({ root: 0, quality: "minor" });
    expect(parseChordName("Bb")).toEqual({ root: 10, quality: "major" });
    expect(parseChordName("F#m")).toEqual({ root: 6, quality: "minor" });
  });

  it("handles whitespace and invalid input", () => {
    expect(parseChordName("  G  major  ")).toEqual({ root: 7, quality: "major" });
    expect(parseChordName("")).toBeNull();
    expect(parseChordName("xyz")).toBeNull();
  });
});

describe("chordNameToPitchClasses", () => {
  it("computes major and minor triads", () => {
    expect([...chordNameToPitchClasses("G major")!].sort((a, b) => a - b)).toEqual([2, 7, 11]);
    expect([...chordNameToPitchClasses("C minor")!].sort((a, b) => a - b)).toEqual([0, 3, 7]);
  });

  it("returns null for non-triadic names", () => {
    expect(chordNameToPitchClasses("Dm add4")).toBeNull();
  });
});

describe("production alfabetoLookup quarantine", () => {
  it("fails closed when the legacy default is omitted", () => {
    const result = alfabetoLookup({ chordName: "G major" });

    expect(result).toMatchObject({
      status: "review_required",
      chartId: "tyler-universal",
      matches: [],
      reviewRequired: {
        code: "tracked_source_review_required",
        artifactId: "tracked.alfabeto-tyler-universal",
      },
    });
  });

  it("fails closed for either explicit quarantined locator", () => {
    const results = [
      alfabetoLookup({ chordName: "G major", chartId: "tyler-universal" }),
      alfabetoLookup({ chordName: "G major", chartId: "foscarini" }),
    ];

    expect(results.map((result) => result.status)).toEqual(["review_required", "review_required"]);
    expect(results.map((result) => result.matches)).toEqual([[], []]);
  });
});

describe("lookupAlfabetoChart synthetic algorithm", () => {
  it("finds exact and superset matches in ranked order", () => {
    const result = lookupAlfabetoChart(SYNTHETIC_ALFABETO_CHART, {
      chordName: "G major",
      maxFret: 12,
    });

    expect(result.status).toBe("available");
    expect(result.matches[0]).toMatchObject({ letter: "Σ", source: "standard" });
    expect(result.matches.find((match) => match.letter === "Υ")).toMatchObject({
      source: "superset",
    });
  });

  it("finds barré variants from the invented base shape", () => {
    const result = lookupAlfabetoChart(SYNTHETIC_ALFABETO_CHART, {
      chordName: "A major",
      maxFret: 12,
    });

    expect(result.matches).toContainEqual(
      expect.objectContaining({ letter: "Σ", source: "barre", barreAt: 2 })
    );
  });

  it("supports pitch classes and suppresses barré variants", () => {
    const result = lookupAlfabetoChart(SYNTHETIC_ALFABETO_CHART, {
      pitchClasses: [4, 7, 11],
      includeBarreVariants: false,
    });

    expect(result.matches).toEqual([
      expect.objectContaining({ letter: "Τ", chord: "E minor", source: "standard" }),
    ]);
  });

  it("respects max fret and returns an ordinary empty result for invalid musical input", () => {
    const bounded = lookupAlfabetoChart(SYNTHETIC_ALFABETO_CHART, {
      chordName: "A major",
      maxFret: 8,
    });
    const invalid = lookupAlfabetoChart(SYNTHETIC_ALFABETO_CHART, {
      chordName: "not a chord",
    });

    expect(bounded.matches).toEqual([]);
    expect(invalid).toMatchObject({
      status: "available",
      chartId: "test.synthetic-alfabeto.v1",
      matches: [],
    });
  });

  it("returns five positions for every synthetic match", () => {
    const result = lookupAlfabetoChart(SYNTHETIC_ALFABETO_CHART, {
      chordName: "G major",
      maxFret: 12,
    });

    for (const match of result.matches) {
      expect(match.positions).toHaveLength(5);
    }
  });
});
