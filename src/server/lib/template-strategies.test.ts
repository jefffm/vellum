import { describe, expect, it } from "vitest";
import type { EngraveParams } from "../../lib/engrave-schema.js";
import type { InstrumentLyVars, EngraveTemplateId } from "../../lib/instrument-registry.js";
import type { LyContainer, LyLeaf } from "../../lib/ly-tree.js";
import {
  buildFrenchTab,
  buildSoloTab,
  buildTabAndStaff,
  buildVoiceAndTab,
  dispatchTemplate,
} from "./template-strategies.js";

const guitarVars: InstrumentLyVars = {
  include: "instruments/classical-guitar-6.ily",
  stringTunings: "classicalGuitarStringTunings",
  tabFormat: "classicalGuitarTabFormat",
};

const luteVars: InstrumentLyVars = {
  include: "instruments/baroque-lute-13.ily",
  stringTunings: "luteStringTunings",
  tabFormat: "luteTabFormat",
  diapasons: "luteDiapasons",
};

function note(duration = "4"): LyLeaf {
  return { type: "note", pitch: "c'", duration, indicators: [] };
}

function params(overrides: Partial<EngraveParams> = {}): EngraveParams {
  return {
    instrument: "classical-guitar-6",
    template: "solo-tab",
    bars: [
      {
        events: [{ type: "note", input: "pitch", pitch: "C4", duration: "4" }],
      },
    ],
    ...overrides,
  };
}

function contextNames(children: (LyLeaf | LyContainer)[]): string[] {
  return children.map((child) => (child.type === "container" ? child.context : child.type));
}

function firstVoice(container: LyContainer): LyContainer {
  const child = container.children[0];
  if (!child || child.type !== "container") {
    throw new Error("Expected first child to be a voice container");
  }
  return child;
}

describe("template strategies", () => {
  describe("buildSoloTab", () => {
    it("builds a TabStaff plus hidden MIDI staff", () => {
      const result = buildSoloTab([note()], guitarVars, params());

      expect(contextNames(result.scoreChildren)).toEqual(["TabStaff", "Staff"]);
      expect(result.variables).toBeUndefined();
      expect(result.warnings).toBeUndefined();

      const tabStaff = result.scoreChildren[0] as LyContainer;
      expect(tabStaff.withBlock).toEqual([
        "tablatureFormat = \\classicalGuitarTabFormat",
        "stringTunings = \\classicalGuitarStringTunings",
      ]);

      const midiStaff = result.scoreChildren[1] as LyContainer;
      expect(midiStaff.withBlock).toContain('\\remove "Staff_symbol_engraver"');
      expect(midiStaff.withBlock).toContain("\\override NoteHead.transparent = ##t");
    });

    it("includes diapason settings in the tab staff withBlock", () => {
      const result = buildSoloTab([note()], luteVars, params({ instrument: "baroque-lute-13" }));
      const tabStaff = result.scoreChildren[0] as LyContainer;

      expect(tabStaff.withBlock).toContain("additionalBassStrings = \\luteDiapasons");
    });
  });

  describe("buildFrenchTab", () => {
    it("builds RhythmicStaff, TabStaff, and hidden MIDI staff", () => {
      const result = buildFrenchTab([note()], luteVars, params({ template: "french-tab" }));

      expect(contextNames(result.scoreChildren)).toEqual(["RhythmicStaff", "TabStaff", "Staff"]);

      const rhythmStaff = result.scoreChildren[0] as LyContainer;
      expect(rhythmStaff.withBlock).toContain("\\override StaffSymbol.line-count = 0");
      expect(rhythmStaff.indicators).toContainEqual({
        kind: "literal",
        text: "\\autoBeamOff",
        site: "before",
      });
    });

    it("turns rests into spacer rests and preserves bar checks for a single bar", () => {
      const result = buildFrenchTab(
        [note("2")],
        guitarVars,
        params({
          template: "french-tab",
          bars: [{ events: [{ type: "rest", duration: "2" }] }],
        })
      );
      const rhythmStaff = result.scoreChildren[0] as LyContainer;
      const rhythmVoice = firstVoice(rhythmStaff);
      const rhythmLeaf = rhythmVoice.children[0] as LyLeaf;

      expect(rhythmLeaf.type).toBe("rest");
      if (rhythmLeaf.type === "rest") {
        expect(rhythmLeaf.spacer).toBe(true);
      }
      expect(rhythmLeaf.indicators).toContainEqual({ kind: "bar_check" });
    });
  });

  describe("buildTabAndStaff", () => {
    it("builds notation staff with treble_8 clef and tab staff", () => {
      const result = buildTabAndStaff([note()], guitarVars, params({ template: "tab-and-staff" }));

      expect(contextNames(result.scoreChildren)).toEqual(["Staff", "TabStaff"]);
      const notationStaff = result.scoreChildren[0] as LyContainer;
      expect(notationStaff.indicators).toContainEqual({
        kind: "literal",
        text: '\\clef "treble_8"',
        site: "before",
      });
    });

    it("does not add a hidden MIDI staff", () => {
      const result = buildTabAndStaff([note()], guitarVars, params({ template: "tab-and-staff" }));

      expect(result.scoreChildren).toHaveLength(2);
      expect(contextNames(result.scoreChildren)).not.toEqual(
        expect.arrayContaining(["RhythmicStaff"])
      );
    });
  });

  describe("buildVoiceAndTab", () => {
    it("creates melody, lyricsText, and lute variables with score references", () => {
      const result = buildVoiceAndTab(
        [note()],
        guitarVars,
        params({
          template: "voice-and-tab",
          melody: {
            bars: [
              {
                events: [{ type: "note", pitch: "C4", duration: "4", lyric: "Sing" }],
              },
            ],
          },
        })
      );

      expect(result.variables?.map((variable) => variable.name)).toEqual([
        "melody",
        "lyricsText",
        "lute",
      ]);
      expect(contextNames(result.scoreChildren)).toEqual(["Staff", "Lyrics", "TabStaff"]);

      const voiceStaff = result.scoreChildren[0] as LyContainer;
      expect(firstVoice(voiceStaff).indicators).toContainEqual({
        kind: "literal",
        text: "\\melody",
        site: "before",
      });

      const lyrics = result.scoreChildren[1] as LyContainer;
      expect(lyrics.indicators).toContainEqual({
        kind: "literal",
        text: "\\lyricsText",
        site: "before",
      });

      const tabStaff = result.scoreChildren[2] as LyContainer;
      expect(firstVoice(tabStaff).indicators).toContainEqual({
        kind: "literal",
        text: "\\lute",
        site: "before",
      });
    });

    it("omits lyrics variable and Lyrics context when the melody has no lyrics", () => {
      const result = buildVoiceAndTab(
        [note()],
        guitarVars,
        params({
          template: "voice-and-tab",
          melody: {
            bars: [{ events: [{ type: "note", pitch: "C4", duration: "4" }] }],
          },
        })
      );

      expect(result.variables?.map((variable) => variable.name)).toEqual(["melody", "lute"]);
      expect(contextNames(result.scoreChildren)).toEqual(["Staff", "TabStaff"]);
    });
  });

  describe("dispatchTemplate", () => {
    it("dispatches every known template ID", () => {
      const cases: Array<[EngraveTemplateId, string[]]> = [
        ["solo-tab", ["TabStaff", "Staff"]],
        ["french-tab", ["RhythmicStaff", "TabStaff", "Staff"]],
        ["tab-and-staff", ["Staff", "TabStaff"]],
        ["voice-and-tab", ["Staff", "Lyrics", "TabStaff"]],
      ];

      for (const [templateId, expectedContexts] of cases) {
        const result = dispatchTemplate(
          templateId,
          [note()],
          guitarVars,
          params({
            template: templateId,
            melody: {
              bars: [
                {
                  events: [{ type: "note", pitch: "C4", duration: "4", lyric: "Hi" }],
                },
              ],
            },
          })
        );

        expect(contextNames(result.scoreChildren)).toEqual(expectedContexts);
      }
    });

    it("throws for unknown template IDs", () => {
      expect(() =>
        dispatchTemplate("unknown-template" as EngraveTemplateId, [note()], guitarVars, params())
      ).toThrow(/unknown template strategy/i);
    });
  });
});
