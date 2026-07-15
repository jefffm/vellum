import { describe, expect, it } from "vitest";
import { barrePitchClasses, barreTranspose, shapePitchClasses } from "../barre-transpose.js";
import { SYNTHETIC_SHAPES } from "./synthetic-chart.js";

describe("barreTranspose with invented shapes", () => {
  it("transposes positions and the declared chord root", () => {
    const result = barreTranspose(SYNTHETIC_SHAPES.sigma, 2, 12);

    expect(result).toMatchObject({
      letter: "Σ",
      chord: "A major",
      barreAt: 2,
      source: "barre",
      baseShape: "Σ",
    });
    expect(result?.positions.map((position) => position.fret)).toEqual([5, 2, 9, 2, 4]);
  });

  it("rejects non-positive and out-of-bounds transpositions", () => {
    expect(barreTranspose(SYNTHETIC_SHAPES.sigma, 0, 12)).toBeNull();
    expect(barreTranspose(SYNTHETIC_SHAPES.sigma, -1, 12)).toBeNull();
    expect(barreTranspose(SYNTHETIC_SHAPES.pi, 3, 12)).toBeNull();
  });

  it("transposes roots deterministically through the canonical spelling table", () => {
    expect(barreTranspose(SYNTHETIC_SHAPES.tau, 1, 12)?.chord).toBe("F minor");
  });
});

describe("synthetic pitch-class helpers", () => {
  it("computes the invented base shape's pitch classes", () => {
    expect([...shapePitchClasses(SYNTHETIC_SHAPES.sigma)].sort((a, b) => a - b)).toEqual([
      2, 7, 11,
    ]);
  });

  it("transposes every sounding pitch class by the barré distance", () => {
    expect([...barrePitchClasses(SYNTHETIC_SHAPES.sigma, 2)].sort((a, b) => a - b)).toEqual([
      1, 4, 9,
    ]);
  });
});
