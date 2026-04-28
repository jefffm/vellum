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
});
