import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  type EngraveBar,
  type EngraveParams,
  EngraveParamsSchema,
} from "../../lib/engrave-schema.js";
import {
  ENGRAVE_INSTRUMENT_IDS,
  ENGRAVE_TEMPLATE_IDS,
  type EngraveTemplateId,
  INSTRUMENT_LY_VARS,
} from "../../lib/instrument-registry.js";
import { engrave, EngraveValidationError } from "./engrave.js";

function baseBars(): EngraveBar[] {
  return [
    {
      events: [
        { type: "note", input: "position", course: 1, fret: 0, duration: "4" },
        { type: "note", input: "position", course: 2, fret: 0, duration: "4" },
        { type: "rest", duration: "4" },
        {
          type: "chord",
          positions: [
            { input: "position", course: 1, fret: 0 },
            { input: "position", course: 2, fret: 1 },
          ],
          duration: "4",
        },
      ],
    },
    {
      time: "3/4",
      events: [
        { type: "note", input: "position", course: 3, fret: 0, duration: "4" },
        { type: "note", input: "position", course: 4, fret: 2, duration: "4" },
        { type: "rest", duration: "4" },
      ],
    },
  ];
}

function melodyForBars(bars: EngraveBar[]): EngraveParams["melody"] {
  return {
    bars: bars.map((bar, barIndex) => ({
      events: bar.events.map((_, eventIndex) => ({
        type: "note" as const,
        pitch: ["C4", "D4", "E4", "F4"][eventIndex % 4],
        duration: "4",
        lyric: barIndex === 0 && eventIndex < 2 ? ["La", "la"][eventIndex] : undefined,
      })),
    })),
  };
}

function params(
  template: EngraveTemplateId,
  instrument: string,
  overrides: Partial<EngraveParams> = {}
): EngraveParams {
  const bars = overrides.bars ?? baseBars();

  return {
    instrument,
    template,
    title: "Integration Test",
    composer: "Vellum",
    key: { tonic: "d", mode: "minor" },
    time: "4/4",
    tempo: 72,
    pickup: "4",
    bars,
    ...(template === "voice-and-tab" ? { melody: melodyForBars(bars) } : {}),
    ...overrides,
  };
}

function expectCommonStructure(source: string, instrument: string): void {
  const vars = INSTRUMENT_LY_VARS[instrument];

  expect(source).toContain('\\version "2.24.0"');
  expect(source).toContain(`\\include "${vars.include}"`);
  expect(source).toContain("\\score");
  expect(source).toContain("\\layout");
  expect(source).toContain("\\midi");
  expect(source).toContain(`tablatureFormat = \\${vars.tabFormat}`);
  expect(source).toContain(`stringTunings = \\${vars.stringTunings}`);

  if (vars.diapasons) {
    expect(source).toContain(`additionalBassStrings = \\${vars.diapasons}`);
  } else {
    expect(source).not.toContain("additionalBassStrings");
  }
}

function expectTemplateStructure(source: string, template: EngraveTemplateId): void {
  switch (template) {
    case "solo-tab":
      expect(source).toContain("\\new TabStaff");
      expect(source).toContain("\\new Staff");
      expect(source).toContain('\\remove "Staff_symbol_engraver"');
      break;
    case "french-tab":
      expect(source).toContain("\\new RhythmicStaff");
      expect(source).toContain("\\new TabStaff");
      expect(source).toContain("\\autoBeamOff");
      break;
    case "tab-and-staff":
      expect(source).toContain("\\new Staff");
      expect(source).toContain("\\new TabStaff");
      expect(source).toContain('\\clef "treble_8"');
      break;
    case "voice-and-tab":
      expect(source).toContain('\\new Staff = "voice"');
      expect(source).toContain("\\new Lyrics \\lyricsto");
      expect(source).toContain("\\new TabStaff");
      expect(source).toContain("melody =");
      expect(source).toContain("lyricsText = \\lyricmode");
      break;
  }
}

describe("engrave integration — golden structural output", () => {
  const cases: Array<[EngraveTemplateId, string]> = [
    ["solo-tab", "baroque-lute-13"],
    ["french-tab", "baroque-lute-13"],
    ["tab-and-staff", "classical-guitar-6"],
    ["voice-and-tab", "classical-guitar-6"],
  ];

  it.each(cases)(
    "generates structurally complete LilyPond for %s on %s",
    (template, instrument) => {
      const first = engrave(params(template, instrument));
      const second = engrave(params(template, instrument));

      expect(first.source).toBe(second.source);
      expect(first.warnings).toEqual(second.warnings);
      expectCommonStructure(first.source, instrument);
      expectTemplateStructure(first.source, template);
      expect(first.source).toContain("\\key d \\minor");
      expect(first.source).toContain("\\time 4/4");
      expect(first.source).toContain("\\time 3/4");
      expect(first.source).toContain("\\partial 4");
    }
  );
});

describe("engrave integration — error handling", () => {
  it("rejects missing required fields during schema validation", () => {
    const body = { template: "solo-tab" };
    const errors = [...Value.Errors(EngraveParamsSchema, body)];

    expect(Value.Check(EngraveParamsSchema, body)).toBe(false);
    expect(errors.map((error) => error.path)).toEqual(
      expect.arrayContaining(["/instrument", "/bars"])
    );
    expect(() => Value.Decode(EngraveParamsSchema, body)).toThrow(/expected schema/i);
  });

  it("reports unknown instruments with the valid ID list", () => {
    expect(() => engrave(params("solo-tab", "nonexistent"))).toThrow(/Unknown instrument/);
    expect(() => engrave(params("solo-tab", "nonexistent"))).toThrow(/classical-guitar-6/);
  });

  it("rejects an empty bars array with a clear validation error", () => {
    expect(() => engrave(params("solo-tab", "classical-guitar-6", { bars: [] }))).toThrow(
      EngraveValidationError
    );
    expect(() => engrave(params("solo-tab", "classical-guitar-6", { bars: [] }))).toThrow(
      /at least one bar/i
    );
  });

  it("rejects empty bar event arrays with a clear validation error", () => {
    expect(() =>
      engrave(
        params("solo-tab", "classical-guitar-6", {
          bars: [{ events: [] }],
        })
      )
    ).toThrow(/at least one event/i);
  });

  it("rejects invalid pitch values with a clear validation error", () => {
    expect(() =>
      engrave(
        params("solo-tab", "classical-guitar-6", {
          bars: [
            {
              events: [{ type: "note", input: "pitch", pitch: "XY9", duration: "4" }],
            },
          ],
        })
      )
    ).toThrow(/Invalid pitch.*Expected scientific notation/i);
  });
});

describe("engrave integration — cross-instrument template matrix", () => {
  it.each(
    ENGRAVE_INSTRUMENT_IDS.flatMap((instrument) =>
      ENGRAVE_TEMPLATE_IDS.map((template) => [instrument, template] as const)
    )
  )("generates %s with %s without throwing", (instrument, template) => {
    const result = engrave(params(template, instrument));

    expect(result.source).toContain(`\\include "${INSTRUMENT_LY_VARS[instrument].include}"`);
    expectCommonStructure(result.source, instrument);
    expectTemplateStructure(result.source, template);
  });
});
