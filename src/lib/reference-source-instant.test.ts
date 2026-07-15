import { describe, expect, it } from "vitest";

import {
  ReferenceSourceInstantError,
  assertReferenceSourceInstantsStrictlyIncreasing,
  compareReferenceSourceInstants,
  decodeReferenceSourceInstant,
  formatReferenceSourceInstant,
  isReferenceSourceInstant,
  isReferenceSourceInstantBefore,
  parseReferenceSourceInstant,
} from "./reference-source-instant.js";

describe("reference-source canonical instants", () => {
  it.each([
    "0000-01-01T00:00:00.000Z",
    "1970-01-01T00:00:00.000Z",
    "2024-02-29T23:59:59.999Z",
    "9999-12-31T23:59:59.999Z",
  ])("accepts the valid canonical instant %s", (value) => {
    expect(decodeReferenceSourceInstant(value)).toBe(value);
    expect(isReferenceSourceInstant(value)).toBe(true);
    expect(Number.isFinite(parseReferenceSourceInstant(value))).toBe(true);
  });

  it.each([
    "2026-07-15T12:00:00Z",
    "2026-07-15T12:00:00.0Z",
    "2026-07-15T12:00:00.00Z",
    "2026-07-15T12:00:00.0000Z",
    "2026-07-15t12:00:00.000Z",
    "2026-07-15T12:00:00.000z",
    "2026-07-15T12:00:00.000+00:00",
    "2026-07-15T08:00:00.000-04:00",
    " 2026-07-15T12:00:00.000Z",
    "2026-07-15T12:00:00.000Z ",
    "+002026-07-15T12:00:00.000Z",
  ])("rejects the noncanonical spelling %s", (value) => {
    expect(() => decodeReferenceSourceInstant(value)).toThrow(ReferenceSourceInstantError);
    expect(isReferenceSourceInstant(value)).toBe(false);
  });

  it.each([
    "2023-02-29T00:00:00.000Z",
    "2024-02-30T00:00:00.000Z",
    "2026-04-31T00:00:00.000Z",
    "2026-00-01T00:00:00.000Z",
    "2026-13-01T00:00:00.000Z",
    "2026-01-00T00:00:00.000Z",
    "2026-01-01T24:00:00.000Z",
    "2026-01-01T00:60:00.000Z",
    "2026-01-01T00:00:60.000Z",
  ])("rejects the impossible or non-finite calendar instant %s", (value) => {
    expect(() => parseReferenceSourceInstant(value)).toThrow(
      expect.objectContaining({ code: "invalid_instant" })
    );
  });

  it("does not coerce arbitrary values while validating", () => {
    const hostile = {
      toString() {
        throw new Error("must not be called");
      },
    };
    for (const value of [undefined, null, 0, Number.NaN, {}, [], hostile]) {
      expect(isReferenceSourceInstant(value)).toBe(false);
      expect(() => decodeReferenceSourceInstant(value)).toThrow(ReferenceSourceInstantError);
    }
  });

  it("parses exact finite epoch milliseconds", () => {
    expect(parseReferenceSourceInstant("1970-01-01T00:00:00.000Z")).toBe(0);
    expect(parseReferenceSourceInstant("1970-01-01T00:00:00.001Z")).toBe(1);
    expect(parseReferenceSourceInstant("1969-12-31T23:59:59.999Z")).toBe(-1);
  });

  it("formats finite values canonically without retaining mutable Date identity", () => {
    const source = new Date("2026-07-15T12:00:00.123Z");
    expect(formatReferenceSourceInstant(source)).toBe("2026-07-15T12:00:00.123Z");
    source.setUTCFullYear(2030);
    expect(formatReferenceSourceInstant(0)).toBe("1970-01-01T00:00:00.000Z");
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    new Date(Number.NaN),
    Date.UTC(10_000, 0, 1),
  ])("rejects an unrepresentable formatted value", (value) => {
    expect(() => formatReferenceSourceInstant(value)).toThrow(ReferenceSourceInstantError);
  });

  it("compares validated instants without lexical or timezone ambiguity", () => {
    const first = "2026-07-15T12:00:00.001Z";
    const second = "2026-07-15T12:00:00.010Z";
    expect(compareReferenceSourceInstants(first, second)).toBe(-1);
    expect(compareReferenceSourceInstants(second, first)).toBe(1);
    expect(compareReferenceSourceInstants(first, first)).toBe(0);
    expect(isReferenceSourceInstantBefore(first, second)).toBe(true);
    expect(isReferenceSourceInstantBefore(second, first)).toBe(false);
  });

  it("requires successor timelines to increase strictly", () => {
    expect(() =>
      assertReferenceSourceInstantsStrictlyIncreasing([
        "2026-07-15T12:00:00.000Z",
        "2026-07-15T12:00:00.001Z",
        "2026-07-15T12:00:01.000Z",
      ])
    ).not.toThrow();

    expect(() =>
      assertReferenceSourceInstantsStrictlyIncreasing(
        ["2026-07-15T12:00:00.000Z", "2026-07-15T12:00:00.000Z"],
        "Acquisition lineage"
      )
    ).toThrow(
      expect.objectContaining({
        code: "not_strictly_increasing",
        message: "Acquisition lineage must be strictly increasing at index 1",
      })
    );
    expect(() =>
      assertReferenceSourceInstantsStrictlyIncreasing([
        "2026-07-15T12:00:00.001Z",
        "2026-07-15T12:00:00.000Z",
      ])
    ).toThrow(expect.objectContaining({ code: "not_strictly_increasing" }));
  });

  it("validates every element even when no ordering comparison is needed", () => {
    expect(() => assertReferenceSourceInstantsStrictlyIncreasing([])).not.toThrow();
    expect(() => assertReferenceSourceInstantsStrictlyIncreasing(["not-an-instant"])).toThrow(
      expect.objectContaining({ code: "invalid_instant" })
    );
  });
});
