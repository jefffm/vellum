import { describe, expect, it } from "vitest";
import type { EngraveBar, EngraveParams } from "../../lib/engrave-schema.js";
import {
  type ResolvedInstrument,
  buildHiddenMidiStaff,
  buildTabStaffWithBlock,
  engrave,
  eventsToLeaves,
  eventsToRhythmLeaves,
  resolveInstrument,
  validateEvents,
  EngraveValidationError,
} from "./engrave.js";
import { InstrumentModel } from "../../lib/instrument-model.js";
import { loadProfile } from "../profiles.js";

// Helper: minimal valid params
function minimalParams(overrides?: Partial<EngraveParams>): EngraveParams {
  return {
    instrument: "classical-guitar-6",
    template: "solo-tab",
    bars: [
      {
        events: [
          { type: "note", input: "position", course: 1, fret: 0, duration: "4" },
          { type: "note", input: "position", course: 2, fret: 1, duration: "4" },
          { type: "note", input: "position", course: 3, fret: 0, duration: "4" },
          { type: "note", input: "position", course: 4, fret: 2, duration: "4" },
        ],
      },
    ],
    ...overrides,
  };
}

function loadModel(id: string): InstrumentModel {
  return InstrumentModel.fromProfile(loadProfile(id));
}

describe("engrave — step 1: resolveInstrument", () => {
  it("resolves a valid instrument and template", () => {
    const params = minimalParams();
    const resolved = resolveInstrument(params);
    expect(resolved.vars.include).toBe("instruments/classical-guitar-6.ily");
    expect(resolved.templateId).toBe("solo-tab");
    expect(resolved.model).toBeInstanceOf(InstrumentModel);
  });

  it("resolves all 5 instruments", () => {
    const ids = [
      "baroque-lute-13",
      "theorbo-14",
      "renaissance-lute-6",
      "baroque-guitar-5",
      "classical-guitar-6",
    ];

    for (const id of ids) {
      const resolved = resolveInstrument(minimalParams({ instrument: id }));
      expect(resolved.vars.include).toContain(id);
    }
  });

  it("throws on unknown instrument", () => {
    expect(() => resolveInstrument(minimalParams({ instrument: "ukulele-4" }))).toThrow(
      /unknown instrument/i
    );
  });

  it("throws on unknown template", () => {
    expect(() => resolveInstrument(minimalParams({ template: "jazz-combo" }))).toThrow(
      /unknown template/i
    );
  });

  it("validates all 4 v1 templates", () => {
    for (const tmpl of ["solo-tab", "french-tab", "tab-and-staff", "voice-and-tab"]) {
      if (tmpl === "voice-and-tab") {
        // needs melody
        const params = minimalParams({
          template: tmpl,
          melody: {
            bars: [
              {
                events: [
                  { type: "note", pitch: "C4", duration: "4" },
                  { type: "note", pitch: "D4", duration: "4" },
                  { type: "note", pitch: "E4", duration: "4" },
                  { type: "note", pitch: "F4", duration: "4" },
                ],
              },
            ],
          },
        });
        expect(() => resolveInstrument(params)).not.toThrow();
      } else {
        expect(() => resolveInstrument(minimalParams({ template: tmpl }))).not.toThrow();
      }
    }
  });

  it("requires melody for voice-and-tab", () => {
    expect(() => resolveInstrument(minimalParams({ template: "voice-and-tab" }))).toThrow(
      /melody/i
    );
  });

  it("requires matching bar counts for voice-and-tab", () => {
    const params = minimalParams({
      template: "voice-and-tab",
      melody: {
        bars: [
          { events: [{ type: "note", pitch: "C4", duration: "1" }] },
          { events: [{ type: "note", pitch: "D4", duration: "1" }] },
        ],
      },
    });
    expect(() => resolveInstrument(params)).toThrow(/bar count/i);
  });
});

describe("engrave — step 2: validateEvents", () => {
  const guitarModel = loadModel("classical-guitar-6");
  const luteModel = loadModel("baroque-lute-13");

  it("accepts valid position-mode events", () => {
    const bars: EngraveBar[] = [
      {
        events: [
          { type: "note", input: "position", course: 1, fret: 0, duration: "4" },
          { type: "note", input: "position", course: 3, fret: 5, duration: "8" },
        ],
      },
    ];
    expect(() => validateEvents(bars, guitarModel)).not.toThrow();
  });

  it("rejects course out of range", () => {
    const bars: EngraveBar[] = [
      {
        events: [{ type: "note", input: "position", course: 10, fret: 0, duration: "4" }],
      },
    ];
    expect(() => validateEvents(bars, guitarModel)).toThrow(EngraveValidationError);
  });

  it("rejects fret out of range", () => {
    const bars: EngraveBar[] = [
      {
        events: [{ type: "note", input: "position", course: 1, fret: 99, duration: "4" }],
      },
    ];
    expect(() => validateEvents(bars, guitarModel)).toThrow(EngraveValidationError);
  });

  it("rejects fret > 0 on diapason course", () => {
    // baroque-lute-13 has courses 8-13 as diapasons
    const bars: EngraveBar[] = [
      {
        events: [{ type: "note", input: "position", course: 10, fret: 2, duration: "4" }],
      },
    ];
    expect(() => validateEvents(bars, luteModel)).toThrow(/diapason/i);
  });

  it("accepts fret 0 on diapason course", () => {
    const bars: EngraveBar[] = [
      {
        events: [{ type: "note", input: "position", course: 10, fret: 0, duration: "4" }],
      },
    ];
    expect(() => validateEvents(bars, luteModel)).not.toThrow();
  });

  it("accepts valid pitch-mode events", () => {
    const bars: EngraveBar[] = [
      {
        events: [
          { type: "note", input: "pitch", pitch: "C4", duration: "4" },
          { type: "note", input: "pitch", pitch: "Eb3", duration: "4" },
        ],
      },
    ];
    expect(() => validateEvents(bars, guitarModel)).not.toThrow();
  });

  it("rejects invalid pitch string", () => {
    const bars: EngraveBar[] = [
      {
        events: [{ type: "note", input: "pitch", pitch: "XY9", duration: "4" }],
      },
    ];
    expect(() => validateEvents(bars, guitarModel)).toThrow(EngraveValidationError);
  });

  it("rejects invalid duration", () => {
    const bars: EngraveBar[] = [
      {
        events: [{ type: "note", input: "position", course: 1, fret: 0, duration: "foo" }],
      },
    ];
    expect(() => validateEvents(bars, guitarModel)).toThrow(/duration/i);
  });

  it("accepts valid durations with dots", () => {
    const bars: EngraveBar[] = [
      {
        events: [
          { type: "note", input: "position", course: 1, fret: 0, duration: "4." },
          { type: "note", input: "position", course: 1, fret: 0, duration: "2.." },
        ],
      },
    ];
    expect(() => validateEvents(bars, guitarModel)).not.toThrow();
  });

  it("validates chord position entries", () => {
    const bars: EngraveBar[] = [
      {
        events: [
          {
            type: "chord",
            positions: [
              { input: "position", course: 1, fret: 0 },
              { input: "position", course: 99, fret: 0 }, // out of range
            ],
            duration: "4",
          },
        ],
      },
    ];
    expect(() => validateEvents(bars, guitarModel)).toThrow(EngraveValidationError);
  });

  it("warns on excessive stretch", () => {
    const bars: EngraveBar[] = [
      {
        events: [
          { type: "note", input: "position", course: 1, fret: 1, duration: "4" },
          { type: "note", input: "position", course: 2, fret: 9, duration: "4" },
        ],
      },
    ];
    const { warnings } = validateEvents(bars, guitarModel);
    expect(warnings.some((w) => w.includes("stretch"))).toBe(true);
  });

  it("accepts rests", () => {
    const bars: EngraveBar[] = [
      {
        events: [{ type: "rest", duration: "4" }],
      },
    ];
    expect(() => validateEvents(bars, guitarModel)).not.toThrow();
  });
});

describe("engrave — step 3: eventsToLeaves", () => {
  const model = loadModel("classical-guitar-6");

  it("converts position-mode notes to LyNote leaves", () => {
    const params = minimalParams({ time: "4/4" });
    const leaves = eventsToLeaves(params.bars, params, model);
    expect(leaves).toHaveLength(4);
    expect(leaves[0].type).toBe("note");

    if (leaves[0].type === "note") {
      expect(leaves[0].duration).toBe("4");
      // Course 1, fret 0 on guitar = E4 → "e'"
      expect(leaves[0].pitch).toBeTruthy();
    }
  });

  it("attaches time signature to first leaf", () => {
    const params = minimalParams({ time: "4/4" });
    const leaves = eventsToLeaves(params.bars, params, model);
    const timeSig = leaves[0].indicators.find((i) => i.kind === "time_signature");
    expect(timeSig).toBeDefined();
  });

  it("attaches key signature to first leaf", () => {
    const params = minimalParams({ key: { tonic: "d", mode: "minor" } });
    const leaves = eventsToLeaves(params.bars, params, model);
    const keySig = leaves[0].indicators.find((i) => i.kind === "key_signature");
    expect(keySig).toBeDefined();
  });

  it("attaches pickup to first leaf", () => {
    const params = minimalParams({ pickup: "4" });
    const leaves = eventsToLeaves(params.bars, params, model);
    const partial = leaves[0].indicators.find((i) => i.kind === "partial");
    expect(partial).toBeDefined();
  });

  it("attaches bar checks to last event of each bar", () => {
    const params = minimalParams();
    const leaves = eventsToLeaves(params.bars, params, model);
    const lastLeaf = leaves[leaves.length - 1];
    const barCheck = lastLeaf.indicators.find((i) => i.kind === "bar_check");
    expect(barCheck).toBeDefined();
  });

  it("attaches per-bar time override", () => {
    const params = minimalParams({
      bars: [
        {
          events: [{ type: "note", input: "position", course: 1, fret: 0, duration: "4" }],
        },
        {
          events: [{ type: "note", input: "position", course: 1, fret: 0, duration: "4" }],
          time: "3/4",
        },
      ],
    });
    const leaves = eventsToLeaves(params.bars, params, model);
    // Second bar's first leaf should have time_signature
    const timeSig = leaves[1].indicators.find((i) => i.kind === "time_signature");
    expect(timeSig).toBeDefined();
  });

  it("converts pitch-mode notes", () => {
    const params: EngraveParams = {
      instrument: "classical-guitar-6",
      template: "solo-tab",
      bars: [
        {
          events: [
            { type: "note", input: "pitch", pitch: "C4", duration: "4" },
            { type: "note", input: "pitch", pitch: "Eb3", duration: "4" },
          ],
        },
      ],
    };
    const leaves = eventsToLeaves(params.bars, params, model);
    expect(leaves[0].type).toBe("note");

    if (leaves[0].type === "note") {
      expect(leaves[0].pitch).toBe("c'");
    }

    if (leaves[1].type === "note") {
      expect(leaves[1].pitch).toBe("ees");
    }
  });

  it("converts chords", () => {
    const params: EngraveParams = {
      instrument: "classical-guitar-6",
      template: "solo-tab",
      bars: [
        {
          events: [
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
      ],
    };
    const leaves = eventsToLeaves(params.bars, params, model);
    expect(leaves[0].type).toBe("chord");
  });

  it("converts rests", () => {
    const params: EngraveParams = {
      instrument: "classical-guitar-6",
      template: "solo-tab",
      bars: [
        {
          events: [{ type: "rest", duration: "2" }],
        },
      ],
    };
    const leaves = eventsToLeaves(params.bars, params, model);
    expect(leaves[0].type).toBe("rest");
  });

  it("attaches tie indicator", () => {
    const params: EngraveParams = {
      instrument: "classical-guitar-6",
      template: "solo-tab",
      bars: [
        {
          events: [
            { type: "note", input: "position", course: 1, fret: 0, duration: "4", tie: true },
          ],
        },
      ],
    };
    const leaves = eventsToLeaves(params.bars, params, model);
    const tie = leaves[0].indicators.find((i) => i.kind === "tie");
    expect(tie).toBeDefined();
  });

  it("attaches ornament indicator", () => {
    const params: EngraveParams = {
      instrument: "classical-guitar-6",
      template: "solo-tab",
      bars: [
        {
          events: [
            {
              type: "note",
              input: "position",
              course: 1,
              fret: 0,
              duration: "4",
              ornament: "trill",
            },
          ],
        },
      ],
    };
    const leaves = eventsToLeaves(params.bars, params, model);
    const ornament = leaves[0].indicators.find((i) => i.kind === "ornament");
    expect(ornament).toBeDefined();
  });
});

describe("engrave — step 3: eventsToRhythmLeaves", () => {
  it("produces rhythm-only leaves", () => {
    const bars: EngraveBar[] = [
      {
        events: [
          { type: "note", input: "position", course: 1, fret: 0, duration: "4" },
          { type: "rest", duration: "4" },
        ],
      },
    ];
    const leaves = eventsToRhythmLeaves(bars);
    expect(leaves).toHaveLength(2);

    // First leaf: note → dummy note c'
    expect(leaves[0].type).toBe("note");

    // Second leaf: rest → spacer rest
    expect(leaves[1].type).toBe("rest");

    if (leaves[1].type === "rest") {
      expect(leaves[1].spacer).toBe(true);
    }
  });

  it("adds bar checks to last event", () => {
    const bars: EngraveBar[] = [
      {
        events: [{ type: "note", input: "position", course: 1, fret: 0, duration: "4" }],
      },
    ];
    const leaves = eventsToRhythmLeaves(bars);
    const barCheck = leaves[0].indicators.find((i) => i.kind === "bar_check");
    expect(barCheck).toBeDefined();
  });
});

describe("engrave — step 4: buildTabStaffWithBlock", () => {
  it("builds correct withBlock for guitar (no diapasons)", () => {
    const vars = {
      include: "instruments/classical-guitar-6.ily",
      stringTunings: "classicalGuitarStringTunings",
      tabFormat: "classicalGuitarTabFormat",
    };
    const block = buildTabStaffWithBlock(vars);
    expect(block).toEqual([
      "tablatureFormat = \\classicalGuitarTabFormat",
      "stringTunings = \\classicalGuitarStringTunings",
    ]);
  });

  it("builds correct withBlock for lute (with diapasons)", () => {
    const vars = {
      include: "instruments/baroque-lute-13.ily",
      stringTunings: "luteStringTunings",
      tabFormat: "luteTabFormat",
      diapasons: "luteDiapasons",
    };
    const block = buildTabStaffWithBlock(vars);
    expect(block).toEqual([
      "tablatureFormat = \\luteTabFormat",
      "stringTunings = \\luteStringTunings",
      "additionalBassStrings = \\luteDiapasons",
    ]);
  });
});

describe("engrave — step 5: buildHiddenMidiStaff", () => {
  it("builds a hidden staff with transparent overrides", () => {
    const leaves = [
      { type: "note" as const, pitch: "c'", duration: "4", indicators: [] },
      { type: "note" as const, pitch: "d'", duration: "4", indicators: [] },
    ];
    const staff = buildHiddenMidiStaff(leaves);
    expect(staff.context).toBe("Staff");
    expect(staff.withBlock).toBeDefined();
    expect(staff.withBlock!.length).toBeGreaterThanOrEqual(5);
    // Check for key entries
    expect(staff.withBlock!.some((e: string) => e.includes("\\remove"))).toBe(true);
    expect(staff.withBlock!.some((e: string) => e.includes("transparent"))).toBe(true);
  });
});

describe("engrave — full pipeline", () => {
  it("produces valid LilyPond for solo-tab", () => {
    const params = minimalParams({ time: "4/4", tempo: 72 });
    const result = engrave(params);
    expect(result.source).toContain('\\version "2.24.0"');
    expect(result.source).toContain('\\include "instruments/classical-guitar-6.ily"');
    expect(result.source).toContain("\\new TabStaff");
    expect(result.source).toContain("\\layout { }");
    expect(result.source).toContain("\\midi");
    expect(result.source).toContain("\\time 4/4");
  });

  it("produces valid LilyPond for french-tab", () => {
    const params = minimalParams({
      instrument: "baroque-lute-13",
      template: "french-tab",
      tempo: 60,
      bars: [
        {
          events: [
            { type: "note", input: "position", course: 1, fret: 0, duration: "4" },
            { type: "note", input: "position", course: 2, fret: 3, duration: "4" },
            { type: "note", input: "position", course: 3, fret: 0, duration: "4" },
            { type: "rest", duration: "4" },
          ],
        },
      ],
    });
    const result = engrave(params);
    expect(result.source).toContain("\\new RhythmicStaff");
    expect(result.source).toContain("\\new TabStaff");
    expect(result.source).toContain("additionalBassStrings");
    expect(result.source).toContain("\\autoBeamOff");
  });

  it("produces valid LilyPond for tab-and-staff", () => {
    const params = minimalParams({ template: "tab-and-staff" });
    const result = engrave(params);
    expect(result.source).toContain("\\new Staff");
    expect(result.source).toContain("\\new TabStaff");
    expect(result.source).toContain('\\clef "treble_8"');
  });

  it("produces valid LilyPond for voice-and-tab", () => {
    const params: EngraveParams = {
      instrument: "classical-guitar-6",
      template: "voice-and-tab",
      time: "4/4",
      bars: [
        {
          events: [
            { type: "note", input: "position", course: 1, fret: 0, duration: "4" },
            { type: "note", input: "position", course: 2, fret: 1, duration: "4" },
            { type: "note", input: "position", course: 3, fret: 0, duration: "4" },
            { type: "note", input: "position", course: 4, fret: 2, duration: "4" },
          ],
        },
      ],
      melody: {
        bars: [
          {
            events: [
              { type: "note", pitch: "C4", duration: "4", lyric: "Sing" },
              { type: "note", pitch: "D4", duration: "4", lyric: "now" },
              { type: "note", pitch: "E4", duration: "4", lyric: "a" },
              { type: "note", pitch: "F4", duration: "4", lyric: "song" },
            ],
          },
        ],
      },
    };
    const result = engrave(params);
    expect(result.source).toContain("\\new Lyrics \\lyricsto");
    expect(result.source).toContain("\\new TabStaff");
    expect(result.source).toContain("lyricsText = \\lyricmode");
    expect(result.source).toContain("melody =");
  });

  it("includes header when title/composer provided", () => {
    const params = minimalParams({ title: "Flow My Tears", composer: "John Dowland" });
    const result = engrave(params);
    expect(result.source).toContain('title = "Flow My Tears"');
    expect(result.source).toContain('composer = "John Dowland"');
  });

  it("includes hidden MIDI staff for solo-tab", () => {
    const params = minimalParams();
    const result = engrave(params);
    // Should have two Staff contexts — TabStaff and hidden Staff
    const staffMatches = result.source.match(/\\new Staff/g);
    expect(staffMatches).toBeDefined();
    expect(staffMatches!.length).toBeGreaterThanOrEqual(1);
    expect(result.source).toContain('\\remove "Staff_symbol_engraver"');
  });

  it("is deterministic", () => {
    const params = minimalParams({ time: "4/4", tempo: 72 });
    const result1 = engrave(params);
    const result2 = engrave(params);
    expect(result1.source).toBe(result2.source);
    expect(result1.warnings).toEqual(result2.warnings);
  });

  it("returns warnings for stretch violations", () => {
    const params: EngraveParams = {
      instrument: "classical-guitar-6",
      template: "solo-tab",
      bars: [
        {
          events: [
            { type: "note", input: "position", course: 1, fret: 1, duration: "4" },
            { type: "note", input: "position", course: 1, fret: 12, duration: "4" },
          ],
        },
      ],
    };
    const result = engrave(params);
    expect(result.warnings.some((w) => w.includes("stretch"))).toBe(true);
  });

  it("handles pitch-mode events end-to-end", () => {
    const params: EngraveParams = {
      instrument: "classical-guitar-6",
      template: "solo-tab",
      bars: [
        {
          events: [
            { type: "note", input: "pitch", pitch: "E4", duration: "4" },
            { type: "note", input: "pitch", pitch: "G4", duration: "4" },
            { type: "note", input: "pitch", pitch: "B3", duration: "4" },
            { type: "note", input: "pitch", pitch: "E3", duration: "4" },
          ],
        },
      ],
    };
    const result = engrave(params);
    expect(result.source).toContain("e'");
    expect(result.source).toContain("g'");
  });

  it("works with all 5 instruments", () => {
    const instruments = [
      "baroque-lute-13",
      "theorbo-14",
      "renaissance-lute-6",
      "baroque-guitar-5",
      "classical-guitar-6",
    ];

    for (const instrument of instruments) {
      const model = loadModel(instrument);
      // Use fret 0 on course 1 (universally valid)
      const params: EngraveParams = {
        instrument,
        template: "solo-tab",
        bars: [
          {
            events: [
              { type: "note", input: "position", course: 1, fret: 0, duration: "4" },
              { type: "rest", duration: "4." },
            ],
          },
        ],
      };
      const result = engrave(params);
      expect(result.source).toContain(`\\include "instruments/${instrument}.ily"`);
      expect(result.source).toContain("\\new TabStaff");
    }
  });
});
