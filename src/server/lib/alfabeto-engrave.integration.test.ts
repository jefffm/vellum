import { describe, expect, it } from "vitest";
import type { EngraveParams } from "../../lib/engrave-schema.js";
import { engrave, EngraveValidationError } from "./engrave.js";

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
    const chordMatches = result.source.match(/<[^>]*\\1[^>]*\\2[^>]*\\3[^>]*\\4[^>]*\\5[^>]*>/g);
    expect(chordMatches).not.toBeNull();
    expect(chordMatches!.length).toBeGreaterThanOrEqual(2);
  });
});
