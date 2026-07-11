import { describe, expect, it } from "vitest";
import { guidedStartMarkup, midiFrequency, targetConfiguration } from "./guided-start.js";

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
    expect(targetConfiguration("target.classical-guitar")).toEqual({
      id: "target.classical-guitar",
      instrumentId: "classical-guitar-6",
      role: "solo",
      tuningId: "standard",
      notationLayouts: ["standard-notation"],
      deliverables: ["pdf", "audio-preview"],
    });
  });
});
