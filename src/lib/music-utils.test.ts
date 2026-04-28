import { describe, expect, it } from "vitest";
import { parseTimeSignature, validateKeySignature } from "./music-utils.js";

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
