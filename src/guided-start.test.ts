import { describe, expect, it } from "vitest";
import { midiFrequency } from "./guided-start.js";

describe("audio preview synthesis", () => {
  it("maps MIDI pitches to equal-tempered oscillator frequencies", () => {
    expect(midiFrequency(69)).toBe(440);
    expect(midiFrequency(60)).toBeCloseTo(261.626, 3);
  });
});
