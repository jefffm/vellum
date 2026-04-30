import { describe, expect, it } from "vitest";
import {
  addDurations,
  compareDurations,
  durationFromQuarters,
  durationsEqual,
  expectedDurationForTimeSignature,
  formatDuration,
  parseLilyPondDuration,
  parseTimeSignature,
  subtractDurations,
  sumDurations,
  validateKeySignature,
  validateMeasureDuration,
  validateMeasureDurations,
} from "./music-utils.js";

describe("parseTimeSignature", () => {
  it("parses common time signatures", () => {
    expect(parseTimeSignature("4/4")).toEqual({ numerator: 4, denominator: 4 });
    expect(parseTimeSignature("3/4")).toEqual({ numerator: 3, denominator: 4 });
    expect(parseTimeSignature("6/8")).toEqual({ numerator: 6, denominator: 8 });
    expect(parseTimeSignature("2/2")).toEqual({ numerator: 2, denominator: 2 });
    expect(parseTimeSignature("12/8")).toEqual({ numerator: 12, denominator: 8 });
  });

  it("rejects non-N/N formats", () => {
    expect(() => parseTimeSignature("waltz")).toThrow(/invalid time signature/i);
    expect(() => parseTimeSignature("4")).toThrow(/invalid time signature/i);
    expect(() => parseTimeSignature("4/4/4")).toThrow(/invalid time signature/i);
    expect(() => parseTimeSignature("")).toThrow(/invalid time signature/i);
  });

  it("rejects zero or negative values", () => {
    expect(() => parseTimeSignature("0/4")).toThrow(/invalid time signature/i);
    expect(() => parseTimeSignature("4/0")).toThrow(/invalid time signature/i);
    expect(() => parseTimeSignature("-1/4")).toThrow(/invalid time signature/i);
  });

  it("rejects non-power-of-2 denominators", () => {
    expect(() => parseTimeSignature("3/5")).toThrow(/power of 2/i);
    expect(() => parseTimeSignature("4/3")).toThrow(/power of 2/i);
    expect(() => parseTimeSignature("6/6")).toThrow(/power of 2/i);
  });

  it("accepts power-of-2 denominators", () => {
    expect(parseTimeSignature("1/1")).toEqual({ numerator: 1, denominator: 1 });
    expect(parseTimeSignature("7/16")).toEqual({ numerator: 7, denominator: 16 });
    expect(parseTimeSignature("5/32")).toEqual({ numerator: 5, denominator: 32 });
  });
});

describe("rational duration utilities", () => {
  it("reduces and compares rational quarter-note durations without floats", () => {
    expect(durationFromQuarters(2, 4)).toEqual({ quarters: { numerator: 1, denominator: 2 } });
    expect(addDurations(durationFromQuarters(1, 3), durationFromQuarters(1, 6))).toEqual({
      quarters: { numerator: 1, denominator: 2 },
    });
    expect(subtractDurations(durationFromQuarters(3, 2), durationFromQuarters(1, 2))).toEqual({
      quarters: { numerator: 1, denominator: 1 },
    });
    expect(compareDurations(durationFromQuarters(1), durationFromQuarters(3, 2))).toBe(-1);
    expect(durationsEqual(durationFromQuarters(2, 2), durationFromQuarters(1))).toBe(true);
    expect(formatDuration(durationFromQuarters(7, 4))).toBe("7/4");
  });

  it("parses ordinary LilyPond duration values as quarter-note units", () => {
    expect(parseLilyPondDuration("1")).toEqual({
      quarters: { numerator: 4, denominator: 1 },
      sourceToken: "1",
    });
    expect(parseLilyPondDuration("2").quarters).toEqual({ numerator: 2, denominator: 1 });
    expect(parseLilyPondDuration("4").quarters).toEqual({ numerator: 1, denominator: 1 });
    expect(parseLilyPondDuration("8").quarters).toEqual({ numerator: 1, denominator: 2 });
    expect(parseLilyPondDuration("16").quarters).toEqual({ numerator: 1, denominator: 4 });
    expect(parseLilyPondDuration("64").quarters).toEqual({ numerator: 1, denominator: 16 });
  });

  it("parses dotted LilyPond durations", () => {
    expect(parseLilyPondDuration("4.").quarters).toEqual({ numerator: 3, denominator: 2 });
    expect(parseLilyPondDuration("8.").quarters).toEqual({ numerator: 3, denominator: 4 });
    expect(parseLilyPondDuration("4..").quarters).toEqual({ numerator: 7, denominator: 4 });
  });

  it("rejects invalid LilyPond duration tokens and unsupported tuplets", () => {
    expect(() => parseLilyPondDuration("0")).toThrow(/invalid lilypond duration denominator/i);
    expect(() => parseLilyPondDuration("3")).toThrow(/invalid lilypond duration denominator/i);
    expect(() => parseLilyPondDuration("4*2/3")).toThrow(/invalid lilypond duration/i);
    expect(() => parseLilyPondDuration("quarter")).toThrow(/invalid lilypond duration/i);
  });

  it("derives expected measure duration from time signatures", () => {
    expect(expectedDurationForTimeSignature("4/4").quarters).toEqual({
      numerator: 4,
      denominator: 1,
    });
    expect(expectedDurationForTimeSignature("3/4").quarters).toEqual({
      numerator: 3,
      denominator: 1,
    });
    expect(expectedDurationForTimeSignature("6/8").quarters).toEqual({
      numerator: 3,
      denominator: 1,
    });
  });

  it("validates ordinary bars with notes, ties, and rests by written duration", () => {
    expect(
      validateMeasureDuration({
        measureId: "m1",
        voiceId: "soprano",
        timeSignature: "4/4",
        durations: ["4", "4", "2"],
      })
    ).toEqual([]);

    expect(
      validateMeasureDuration({
        measureId: "m2",
        voiceId: "alto",
        timeSignature: "4/4",
        durations: ["2.", "4"],
      })
    ).toEqual([]);
  });

  it("validates pickup measures either by explicit pickup duration or bounded partial length", () => {
    expect(
      validateMeasureDuration({
        measureId: "pickup",
        voiceId: "lead",
        isPickup: true,
        pickupDuration: "4",
        durations: ["8", "8"],
      })
    ).toEqual([]);

    expect(
      validateMeasureDuration({
        measureId: "pickup2",
        isPickup: true,
        timeSignature: "4/4",
        durations: ["4"],
      })
    ).toEqual([]);

    const diagnostics = validateMeasureDuration({
      measureId: "pickup3",
      isPickup: true,
      timeSignature: "3/4",
      durations: ["1"],
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("pickup_duration_overflow");
  });

  it("supports explicit measure-duration overrides for alternative endings", () => {
    expect(
      validateMeasureDuration({
        measureId: "ending-1",
        context: "alternative 1",
        measureDurationOverride: "2",
        durations: ["4", "4"],
      })
    ).toEqual([]);
  });

  it("reports mismatched voices with stable diagnostics", () => {
    const diagnostics = validateMeasureDurations([
      { measureId: "m1", voiceId: "soprano", timeSignature: "3/4", durations: ["4", "4", "4"] },
      { measureId: "m1", voiceId: "bass", timeSignature: "3/4", durations: ["2"] },
    ]);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      severity: "error",
      code: "measure_duration_mismatch",
      measureId: "m1",
      voiceId: "bass",
      expected: { quarters: { numerator: 3, denominator: 1 } },
      actual: { quarters: { numerator: 2, denominator: 1 } },
      difference: { quarters: { numerator: -1, denominator: 1 } },
    });
    expect(diagnostics[0].message).toContain("Measure m1 voice bass duration is 2 quarter(s)");
    expect(diagnostics[0].message).toContain("short by 1 quarter(s)");
  });

  it("sums mixed rational and LilyPond duration inputs", () => {
    expect(sumDurations([durationFromQuarters(1, 2), "8", "4"]).quarters).toEqual({
      numerator: 2,
      denominator: 1,
    });
  });
});

describe("validateKeySignature", () => {
  it("accepts standard major/minor keys", () => {
    expect(() => validateKeySignature("c", "major")).not.toThrow();
    expect(() => validateKeySignature("d", "minor")).not.toThrow();
    expect(() => validateKeySignature("ees", "minor")).not.toThrow();
    expect(() => validateKeySignature("fis", "major")).not.toThrow();
  });

  it("accepts church modes", () => {
    expect(() => validateKeySignature("d", "dorian")).not.toThrow();
    expect(() => validateKeySignature("e", "phrygian")).not.toThrow();
    expect(() => validateKeySignature("f", "lydian")).not.toThrow();
    expect(() => validateKeySignature("g", "mixolydian")).not.toThrow();
  });

  it("rejects invalid tonics", () => {
    expect(() => validateKeySignature("xyz", "major")).toThrow(/invalid key tonic/i);
    expect(() => validateKeySignature("C", "major")).toThrow(/invalid key tonic/i);
    expect(() => validateKeySignature("h", "minor")).toThrow(/invalid key tonic/i);
  });

  it("rejects invalid modes", () => {
    expect(() => validateKeySignature("c", "banana")).toThrow(/invalid key mode/i);
    expect(() => validateKeySignature("d", "Major")).toThrow(/invalid key mode/i);
    expect(() => validateKeySignature("e", "")).toThrow(/invalid key mode/i);
  });
});
