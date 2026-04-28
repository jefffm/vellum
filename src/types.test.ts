import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  CompileParamsSchema,
  CompileResultSchema,
  InstrumentProfileSchema,
  TabPositionSchema,
  TabulateParamsSchema,
  VoicingsParamsSchema,
  VoicingSchema,
  ViolationSchema,
  LintViolationSchema,
  AlfabetoLookupParamsSchema,
  AnalysisResultSchema,
  TheoryParamsSchema,
} from "./types.js";

describe("TypeBox schema validation", () => {
  it("validates TabPosition", () => {
    expect(Value.Check(TabPositionSchema, { course: 1, fret: 0, quality: "open" })).toBe(true);
    expect(Value.Check(TabPositionSchema, { course: 1, fret: 3, quality: "low_fret" })).toBe(true);
    expect(Value.Check(TabPositionSchema, { course: 7, fret: 0, quality: "diapason" })).toBe(true);
  });

  it("rejects invalid TabPosition", () => {
    expect(Value.Check(TabPositionSchema, { course: 0, fret: 0, quality: "open" })).toBe(false);
    expect(Value.Check(TabPositionSchema, { course: 1, fret: -1, quality: "open" })).toBe(false);
    expect(Value.Check(TabPositionSchema, { course: 1, fret: 0, quality: "invalid" })).toBe(false);
    expect(Value.Check(TabPositionSchema, {})).toBe(false);
  });

  it("validates Voicing", () => {
    expect(
      Value.Check(VoicingSchema, {
        positions: [{ course: 1, fret: 0, quality: "open" }],
        stretch: 0,
        campanella_score: 1.0,
        open_strings: 1,
      })
    ).toBe(true);
  });

  it("validates CompileParams", () => {
    expect(Value.Check(CompileParamsSchema, { source: '\\version "2.24.0"' })).toBe(true);
    expect(Value.Check(CompileParamsSchema, { source: '\\version "2.24.0"', format: "svg" })).toBe(
      true
    );
    expect(Value.Check(CompileParamsSchema, { source: '\\version "2.24.0"', format: "pdf" })).toBe(
      true
    );
    expect(Value.Check(CompileParamsSchema, { source: '\\version "2.24.0"', format: "both" })).toBe(
      true
    );
  });

  it("rejects empty CompileParams source", () => {
    expect(Value.Check(CompileParamsSchema, { source: "" })).toBe(false);
    expect(Value.Check(CompileParamsSchema, {})).toBe(false);
  });

  it("validates CompileResult", () => {
    expect(Value.Check(CompileResultSchema, { errors: [] })).toBe(true);
    expect(
      Value.Check(CompileResultSchema, {
        svg: "<svg></svg>",
        errors: [],
        barCount: 4,
        voiceCount: 2,
      })
    ).toBe(true);
  });

  it("validates Violation types", () => {
    for (const type of ["stretch", "same_course", "rh_pattern", "out_of_range"] as const) {
      expect(Value.Check(ViolationSchema, { bar: 1, type, description: `${type} violation` })).toBe(
        true
      );
    }
  });

  it("validates LintViolation", () => {
    expect(
      Value.Check(LintViolationSchema, {
        bar: 1,
        beat: 1.0,
        type: "parallel_fifths",
        description: "Parallel fifths between soprano and bass",
        voices: ["soprano", "bass"],
      })
    ).toBe(true);
  });

  it("validates TabulateParams", () => {
    expect(Value.Check(TabulateParamsSchema, { pitch: "F4", instrument: "baroque-lute-13" })).toBe(
      true
    );
  });

  it("validates VoicingsParams", () => {
    expect(
      Value.Check(VoicingsParamsSchema, {
        notes: ["D3", "A3", "D4", "F4"],
        instrument: "baroque-lute-13",
        max_stretch: 4,
      })
    ).toBe(true);
  });

  it("validates AnalysisResult", () => {
    expect(
      Value.Check(AnalysisResultSchema, {
        key: "D minor",
        timeSignature: "4/4",
        voices: [{ name: "soprano", lowest: "C4", highest: "A5" }],
        chords: [{ bar: 1, beat: 1, pitches: ["D4", "F4", "A4"], romanNumeral: "i" }],
      })
    ).toBe(true);
  });

  it("validates AlfabetoLookupParams", () => {
    expect(
      Value.Check(AlfabetoLookupParamsSchema, {
        chordName: "G major",
        chartId: "tyler-universal",
        maxFret: 8,
        includeBarreVariants: true,
      })
    ).toBe(true);
    expect(
      Value.Check(AlfabetoLookupParamsSchema, {
        pitchClasses: [7, 11, 2],
        chartId: "foscarini",
      })
    ).toBe(true);
    expect(Value.Check(AlfabetoLookupParamsSchema, { pitchClasses: [99] })).toBe(false);
    expect(Value.Check(AlfabetoLookupParamsSchema, { chartId: "unknown" })).toBe(false);
  });

  it("validates TheoryParams operations", () => {
    for (const operation of [
      "interval",
      "transpose",
      "chord_detect",
      "chord_notes",
      "scale_notes",
      "scale_chords",
      "roman_parse",
      "enharmonic",
    ] as const) {
      expect(Value.Check(TheoryParamsSchema, { operation, args: {} })).toBe(true);
    }
  });

  it("validates InstrumentProfile — minimal", () => {
    expect(
      Value.Check(InstrumentProfileSchema, {
        id: "test",
        name: "Test Instrument",
        constraints: ["test constraint"],
        notation: "standard",
      })
    ).toBe(true);
  });

  it("validates InstrumentProfile — full baroque lute shape", () => {
    expect(
      Value.Check(InstrumentProfileSchema, {
        id: "baroque-lute-13",
        name: "13-Course Baroque Lute (d-minor)",
        courses: 13,
        fretted_courses: 6,
        open_courses: 7,
        tuning: [
          { course: 1, pitch: "f'", note: "F4" },
          { course: 2, pitch: "d'", note: "D4" },
        ],
        frets: 8,
        range: { lowest: "A1", highest: "C5" },
        diapason_schemes: {
          d_minor: ["G", "F", "Eb", "D", "C", "Bb", "A"],
        },
        constraints: ["Diapasons open only"],
        notation: "french-letter",
      })
    ).toBe(true);
  });
});
