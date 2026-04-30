import { describe, expect, it } from "vitest";
import type { EngraveParams } from "../../lib/engrave-schema.js";
import { engrave, EngraveValidationError } from "./engrave.js";

function manualChordEvent(frets: [number, number, number, number, number], duration: string) {
  return {
    type: "chord" as const,
    positions: frets.map((fret, index) => ({
      input: "position" as const,
      course: index + 1,
      fret,
    })),
    duration,
  };
}

function tabChordFragments(source: string): string[] {
  return (
    source.match(/<[^<>\n]*\\1[^<>\n]*\\2[^<>\n]*\\3[^<>\n]*\\4[^<>\n]*\\5[^<>\n]*>\d+\.?/g) ?? []
  );
}

function expectedTabChord(
  frets: [number, number, number, number, number],
  duration: string
): string {
  const source = engrave({
    instrument: "baroque-guitar-5",
    template: "french-tab",
    bars: [{ events: [manualChordEvent(frets, duration)] }],
  }).source;

  const [fragment] = tabChordFragments(source);
  expect(fragment).toBeDefined();
  return fragment!;
}

function alfabetoParams(overrides: Partial<EngraveParams> = {}): EngraveParams {
  return {
    instrument: "baroque-guitar-5",
    template: "french-tab",
    title: "Alfabeto Test",
    time: "4/4",
    bars: [
      {
        events: [
          { type: "alfabeto", chordName: "G major", duration: "4" },
          { type: "alfabeto", chordName: "C major", letter: "B", duration: "4" },
          { type: "rest", duration: "2" },
        ],
      },
    ],
    ...overrides,
  };
}

describe("alfabeto engrave integration", () => {
  it("renders baroque guitar alfabeto events as annotated five-course chords", () => {
    const result = engrave(alfabetoParams());

    expect(result.warnings).toEqual([]);
    expect(result.source).toContain('\\include "instruments/baroque-guitar-5.ily"');
    expect(result.source).toContain("\\new RhythmicStaff");
    expect(result.source).toContain("\\new TabStaff");
    expect(result.source).toContain('^\\markup { "A" }');
    expect(result.source).toContain('^\\markup { "B" }');
    expect(result.source).toMatch(
      /<[^>]*\\1[^>]*\\2[^>]*\\3[^>]*\\4[^>]*\\5[^>]*>4 \^\\markup \{ "A" \}/
    );
  });

  it("supports direct alfabeto letters without requiring the caller to restate the chord", () => {
    const result = engrave(
      alfabetoParams({
        bars: [{ events: [{ type: "alfabeto", letter: "A", duration: "1" }] }],
      })
    );

    expect(result.source).toContain('^\\markup { "A" }');
    expect(result.source).toMatch(/<[^>]*\\1[^>]*\\2[^>]*\\3[^>]*\\4[^>]*\\5[^>]*>1/);
  });

  it("rejects alfabeto events for non-baroque-guitar instruments", () => {
    expect(() =>
      engrave(
        alfabetoParams({
          instrument: "classical-guitar-6",
          template: "solo-tab",
        })
      )
    ).toThrow(EngraveValidationError);
  });

  it("resolves barré transposition for chords not in the base chart", () => {
    const result = engrave(
      alfabetoParams({
        bars: [
          {
            events: [
              {
                type: "alfabeto",
                chordName: "C# minor",
                includeBarreVariants: true,
                duration: "1",
              },
            ],
          },
        ],
      })
    );

    // C# minor should resolve via barré transposition (e.g. K barred at fret 3)
    expect(result.warnings).toEqual([]);
    expect(result.source).toContain("^\\markup");
    // Should produce a 5-course chord
    expect(result.source).toMatch(/<[^>]*\\1[^>]*\\2[^>]*\\3[^>]*\\4[^>]*\\5[^>]*>/);
  });

  it("renders alfabeto events using the Foscarini chart", () => {
    const result = engrave(
      alfabetoParams({
        bars: [
          {
            events: [
              {
                type: "alfabeto",
                letter: "A",
                chartId: "foscarini",
                duration: "2",
              },
              {
                type: "alfabeto",
                chordName: "G major",
                chartId: "foscarini",
                duration: "2",
              },
            ],
          },
        ],
      })
    );

    expect(result.warnings).toEqual([]);
    expect(result.source).toContain('^\\markup { "A" }');
    // Both events should produce 5-course chords
    const chordMatches = result.source.match(
      /<[^<>\n]*\\1[^<>\n]*\\2[^<>\n]*\\3[^<>\n]*\\4[^<>\n]*\\5[^<>\n]*>/g
    );
    expect(chordMatches).not.toBeNull();
    expect(chordMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("engraves a G-C-D-Am progression via alfabeto_chord events", () => {
    const result = engrave(
      alfabetoParams({
        bars: [
          {
            events: [
              { type: "alfabeto_chord", chord_name: "G major", duration: "2" },
              { type: "alfabeto_chord", chord_name: "C major", duration: "2" },
            ],
          },
          {
            events: [
              { type: "alfabeto_chord", chord_name: "D major", duration: "2" },
              { type: "alfabeto_chord", chord_name: "A minor", duration: "2" },
            ],
          },
        ],
      })
    );

    expect(result.warnings).toEqual([]);
    expect(result.source).toContain(expectedTabChord([3, 3, 0, 0, 2], "2"));
    expect(result.source).toContain(expectedTabChord([0, 1, 0, 2, 3], "2"));
    expect(result.source).toContain(expectedTabChord([2, 3, 2, 0, 0], "2"));
    expect(result.source).toContain(expectedTabChord([0, 1, 2, 2, 0], "2"));
  });

  it("engraves alfabeto_chord barré fallback for C# minor", () => {
    const result = engrave(
      alfabetoParams({
        bars: [
          {
            events: [
              { type: "alfabeto_chord", chord_name: "C# minor", prefer: "K", duration: "1" },
            ],
          },
        ],
      })
    );

    expect(result.warnings).toEqual([]);
    expect(result.source).toContain(expectedTabChord([4, 5, 6, 6, 4], "1"));
  });

  it("handles mixed alfabeto_chord, note, chord, and rest events in the same bar", () => {
    const result = engrave(
      alfabetoParams({
        bars: [
          {
            events: [
              { type: "note", input: "position", course: 1, fret: 0, duration: "4" },
              { type: "alfabeto_chord", chord_name: "C major", duration: "4" },
              manualChordEvent([3, 3, 0, 0, 2], "4"),
              { type: "rest", duration: "4" },
            ],
          },
        ],
      })
    );

    expect(result.warnings).toEqual([]);
    expect(result.source).toContain("\\1");
    expect(result.source).toContain(expectedTabChord([0, 1, 0, 2, 3], "4"));
    expect(result.source).toContain(expectedTabChord([3, 3, 0, 0, 2], "4"));
    expect(result.source).toContain("r4");
  });

  it("selects Foscarini shapes for alfabeto_chord events", () => {
    const result = engrave(
      alfabetoParams({
        bars: [
          {
            events: [
              {
                type: "alfabeto_chord",
                chord_name: "Eb minor",
                chart_id: "foscarini",
                prefer: "M†",
                duration: "2",
              },
            ],
          },
        ],
      })
    );

    expect(result.warnings).toEqual([]);
    expect(result.source).toContain(expectedTabChord([2, 4, 3, 1, 1], "2"));
  });
});
