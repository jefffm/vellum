import { describe, expect, it } from "vitest";
import {
  guidedStartMarkup,
  midiFrequency,
  sourceFocusUrl,
  targetConfiguration,
} from "./guided-start.js";

describe("audio preview synthesis", () => {
  it("maps MIDI pitches to equal-tempered oscillator frequencies", () => {
    expect(midiFrequency(69)).toBe(440);
    expect(midiFrequency(60)).toBeCloseTo(261.626, 3);
  });
});

describe("Guided Start output choices", () => {
  it("offers classical guitar standard notation as an independently selectable sibling", () => {
    const markup = guidedStartMarkup();
    expect(markup).toContain('value="target.classical-guitar"');
    expect(markup).toContain("Standard notation");
    expect(markup).toContain("standard EADGBE tuning");
    expect(markup).toContain("data-score-review");
    expect(markup).toContain("Source facsimile");
    expect(markup).toContain("data-review-source-image");
    expect(markup).toContain("data-review-source-highlight");
    expect(markup).toContain("Recognized notation");
    expect(markup).toContain("Cancel this run");
    expect(targetConfiguration("target.classical-guitar")).toEqual({
      id: "target.classical-guitar",
      instrumentId: "classical-guitar-6",
      role: "solo",
      tuningId: "standard",
      notationLayouts: ["standard-notation"],
      deliverables: ["pdf", "audio-preview"],
    });
  });

  it("focuses the native PDF viewer on the exact uncertainty region", () => {
    expect(
      sourceFocusUrl("/api/source.pdf", {
        page: 1,
        x: 121.6,
        y: 151.2,
        width: 24,
        height: 28,
      })
    ).toBe("/api/source.pdf#page=1&zoom=180,122,151");
  });

  it("offers an explicitly profiled continuo realization for figured-bass sources", () => {
    const markup = guidedStartMarkup();
    expect(markup).toContain('value="target.piano-continuo"');
    expect(markup).toContain("For figured-bass sources");
    expect(targetConfiguration("target.piano-continuo")).toEqual({
      id: "target.piano-continuo",
      instrumentId: "piano",
      role: "ensemble",
      realizationProfileId: "continuo.italian-baroque",
      notationLayouts: ["continuo-score"],
      deliverables: ["pdf", "audio-preview"],
    });
  });

  it("offers six-course Renaissance lute with French tablature", () => {
    expect(guidedStartMarkup()).toContain('value="target.renaissance-lute"');
    expect(targetConfiguration("target.renaissance-lute")).toEqual({
      id: "target.renaissance-lute",
      instrumentId: "renaissance-lute-6",
      role: "solo",
      tuningId: "renaissance-g",
      notationLayouts: ["french-letter-tablature"],
      deliverables: ["pdf", "audio-preview"],
    });
  });
});
