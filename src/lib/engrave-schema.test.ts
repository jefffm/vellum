import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  type ChordEvent,
  type EngraveBar,
  type EngraveParams,
  type EngraveResult,
  type PitchNote,
  type PositionNote,
  type RestEvent,
  AlfabetoChordEventSchema,
  AlfabetoEventSchema,
  ChordEventSchema,
  EngraveBarSchema,
  EngraveParamsSchema,
  EngraveResultSchema,
  EventSchema,
  PitchNoteSchema,
  PositionNoteSchema,
  RestEventSchema,
} from "./engrave-schema.js";

describe("engrave-schema — event types", () => {
  describe("PositionNoteSchema", () => {
    it("accepts a valid position note", () => {
      const note: PositionNote = {
        type: "note",
        input: "position",
        course: 1,
        fret: 3,
        duration: "4",
      };
      expect(Value.Check(PositionNoteSchema, note)).toBe(true);
    });

    it("accepts optional tie/slur/ornament fields", () => {
      const note: PositionNote = {
        type: "note",
        input: "position",
        course: 3,
        fret: 0,
        duration: "8",
        tie: true,
        slur_start: true,
        ornament: "trill",
      };
      expect(Value.Check(PositionNoteSchema, note)).toBe(true);
    });

    it("rejects course < 1", () => {
      const note = {
        type: "note",
        input: "position",
        course: 0,
        fret: 0,
        duration: "4",
      };
      expect(Value.Check(PositionNoteSchema, note)).toBe(false);
    });

    it("rejects fret < 0", () => {
      const note = {
        type: "note",
        input: "position",
        course: 1,
        fret: -1,
        duration: "4",
      };
      expect(Value.Check(PositionNoteSchema, note)).toBe(false);
    });

    it("rejects empty duration", () => {
      const note = {
        type: "note",
        input: "position",
        course: 1,
        fret: 0,
        duration: "",
      };
      expect(Value.Check(PositionNoteSchema, note)).toBe(false);
    });
  });

  describe("PitchNoteSchema", () => {
    it("accepts a valid pitch note", () => {
      const note: PitchNote = {
        type: "note",
        input: "pitch",
        pitch: "G4",
        duration: "4",
      };
      expect(Value.Check(PitchNoteSchema, note)).toBe(true);
    });

    it("accepts optional ornament", () => {
      const note: PitchNote = {
        type: "note",
        input: "pitch",
        pitch: "Eb3",
        duration: "2.",
        ornament: "mordent",
      };
      expect(Value.Check(PitchNoteSchema, note)).toBe(true);
    });

    it("rejects empty pitch", () => {
      const note = {
        type: "note",
        input: "pitch",
        pitch: "",
        duration: "4",
      };
      expect(Value.Check(PitchNoteSchema, note)).toBe(false);
    });
  });

  describe("ChordEventSchema", () => {
    it("accepts a chord with position entries", () => {
      const chord: ChordEvent = {
        type: "chord",
        positions: [
          { input: "position", course: 1, fret: 0 },
          { input: "position", course: 3, fret: 2 },
        ],
        duration: "4",
      };
      expect(Value.Check(ChordEventSchema, chord)).toBe(true);
    });

    it("accepts mixed position and pitch entries", () => {
      const chord: ChordEvent = {
        type: "chord",
        positions: [
          { input: "position", course: 1, fret: 3 },
          { input: "pitch", pitch: "A3" },
        ],
        duration: "2",
      };
      expect(Value.Check(ChordEventSchema, chord)).toBe(true);
    });

    it("rejects fewer than 2 positions", () => {
      const chord = {
        type: "chord",
        positions: [{ input: "position", course: 1, fret: 0 }],
        duration: "4",
      };
      expect(Value.Check(ChordEventSchema, chord)).toBe(false);
    });

    it("accepts optional tie", () => {
      const chord: ChordEvent = {
        type: "chord",
        positions: [
          { input: "position", course: 1, fret: 0 },
          { input: "position", course: 2, fret: 0 },
        ],
        duration: "4",
        tie: true,
      };
      expect(Value.Check(ChordEventSchema, chord)).toBe(true);
    });
  });

  describe("AlfabetoEventSchema", () => {
    it("accepts a chord-name alfabeto event", () => {
      const event = {
        type: "alfabeto",
        chordName: "G major",
        duration: "4",
        chartId: "tyler-universal",
      };
      expect(Value.Check(AlfabetoEventSchema, event)).toBe(true);
    });

    it("accepts a direct alfabeto letter event", () => {
      const event = {
        type: "alfabeto",
        letter: "A",
        duration: "2",
        chartId: "foscarini",
      };
      expect(Value.Check(AlfabetoEventSchema, event)).toBe(true);
    });

    it("rejects invalid pitch classes", () => {
      const event = {
        type: "alfabeto",
        pitchClasses: [7, 11, 99],
        duration: "4",
      };
      expect(Value.Check(AlfabetoEventSchema, event)).toBe(false);
    });
  });

  describe("AlfabetoChordEventSchema", () => {
    it("accepts a snake_case alfabeto chord event", () => {
      const event = {
        type: "alfabeto_chord",
        chord_name: "G major",
        duration: "4",
        chart_id: "tyler-universal",
        prefer: "A",
      };
      expect(Value.Check(AlfabetoChordEventSchema, event)).toBe(true);
    });

    it("rejects alfabeto chord events without chord_name", () => {
      const event = {
        type: "alfabeto_chord",
        duration: "4",
      };
      expect(Value.Check(AlfabetoChordEventSchema, event)).toBe(false);
    });
  });

  describe("RestEventSchema", () => {
    it("accepts a regular rest", () => {
      const rest: RestEvent = { type: "rest", duration: "4" };
      expect(Value.Check(RestEventSchema, rest)).toBe(true);
    });

    it("accepts a spacer rest", () => {
      const rest: RestEvent = { type: "rest", duration: "2", spacer: true };
      expect(Value.Check(RestEventSchema, rest)).toBe(true);
    });
  });

  describe("EventSchema (discriminated union)", () => {
    it("accepts all event types", () => {
      const positionNote = { type: "note", input: "position", course: 1, fret: 0, duration: "4" };
      const pitchNote = { type: "note", input: "pitch", pitch: "C4", duration: "4" };
      const chord = {
        type: "chord",
        positions: [
          { input: "position", course: 1, fret: 0 },
          { input: "position", course: 2, fret: 0 },
        ],
        duration: "4",
      };
      const rest = { type: "rest", duration: "4" };
      const alfabeto = { type: "alfabeto", chordName: "G major", duration: "4" };
      const alfabetoChord = { type: "alfabeto_chord", chord_name: "G major", duration: "4" };

      expect(Value.Check(EventSchema, positionNote)).toBe(true);
      expect(Value.Check(EventSchema, pitchNote)).toBe(true);
      expect(Value.Check(EventSchema, chord)).toBe(true);
      expect(Value.Check(EventSchema, rest)).toBe(true);
      expect(Value.Check(EventSchema, alfabeto)).toBe(true);
      expect(Value.Check(EventSchema, alfabetoChord)).toBe(true);
    });
  });
});

describe("engrave-schema — bar and params", () => {
  describe("EngraveBarSchema", () => {
    it("accepts a bar with events", () => {
      const bar: EngraveBar = {
        events: [{ type: "note", input: "position", course: 1, fret: 3, duration: "4" }],
      };
      expect(Value.Check(EngraveBarSchema, bar)).toBe(true);
    });

    it("rejects empty events array", () => {
      const bar = { events: [] };
      expect(Value.Check(EngraveBarSchema, bar)).toBe(false);
    });

    it("accepts per-bar key override", () => {
      const bar: EngraveBar = {
        events: [{ type: "rest", duration: "1" }],
        key: { tonic: "g", mode: "major" },
      };
      expect(Value.Check(EngraveBarSchema, bar)).toBe(true);
    });

    it("accepts per-bar time override", () => {
      const bar: EngraveBar = {
        events: [{ type: "rest", duration: "2." }],
        time: "3/4",
      };
      expect(Value.Check(EngraveBarSchema, bar)).toBe(true);
    });
  });

  describe("EngraveParamsSchema", () => {
    const minimalParams: EngraveParams = {
      instrument: "baroque-lute-13",
      template: "solo-tab",
      bars: [
        {
          events: [{ type: "note", input: "position", course: 1, fret: 3, duration: "4" }],
        },
      ],
    };

    it("accepts minimal valid params", () => {
      expect(Value.Check(EngraveParamsSchema, minimalParams)).toBe(true);
    });

    it("accepts full params with all optional fields", () => {
      const params: EngraveParams = {
        instrument: "baroque-lute-13",
        template: "solo-tab",
        title: "Flow My Tears",
        composer: "John Dowland",
        key: { tonic: "d", mode: "minor" },
        time: "4/4",
        tempo: 72,
        pickup: "4",
        diapason_scheme: "d_minor",
        bars: [
          {
            events: [
              { type: "note", input: "position", course: 1, fret: 3, duration: "4" },
              { type: "rest", duration: "4" },
            ],
          },
        ],
      };
      expect(Value.Check(EngraveParamsSchema, params)).toBe(true);
    });

    it("accepts params with melody (voice-and-tab)", () => {
      const params: EngraveParams = {
        instrument: "theorbo-14",
        template: "voice-and-tab",
        bars: [
          {
            events: [
              { type: "note", input: "position", course: 1, fret: 0, duration: "2" },
              { type: "note", input: "position", course: 2, fret: 0, duration: "2" },
            ],
          },
        ],
        melody: {
          bars: [
            {
              events: [
                { type: "note", pitch: "C5", duration: "2", lyric: "Flow" },
                { type: "note", pitch: "A4", duration: "2", lyric: "my" },
              ],
            },
          ],
        },
      };
      expect(Value.Check(EngraveParamsSchema, params)).toBe(true);
    });

    it("rejects empty instrument", () => {
      const params = { ...minimalParams, instrument: "" };
      expect(Value.Check(EngraveParamsSchema, params)).toBe(false);
    });

    it("rejects empty template", () => {
      const params = { ...minimalParams, template: "" };
      expect(Value.Check(EngraveParamsSchema, params)).toBe(false);
    });

    it("rejects empty bars array", () => {
      const params = { ...minimalParams, bars: [] };
      expect(Value.Check(EngraveParamsSchema, params)).toBe(false);
    });

    it("rejects tempo < 1", () => {
      const params = { ...minimalParams, tempo: 0 };
      expect(Value.Check(EngraveParamsSchema, params)).toBe(false);
    });
  });
});

describe("engrave-schema — result", () => {
  it("accepts a valid result", () => {
    const result: EngraveResult = {
      source: '\\version "2.24.0"\n\\score { }',
      warnings: [],
    };
    expect(Value.Check(EngraveResultSchema, result)).toBe(true);
  });

  it("accepts result with warnings", () => {
    const result: EngraveResult = {
      source: '\\version "2.24.0"\n\\score { }',
      warnings: ["Stretch of 8 frets in bar 3 exceeds recommended 5-fret maximum"],
    };
    expect(Value.Check(EngraveResultSchema, result)).toBe(true);
  });
});
