import { describe, expect, it } from "vitest";
import { shapePitchClasses, shapeToPositions } from "../barre-transpose.js";
import { SYNTHETIC_ALFABETO_CHART } from "./synthetic-chart.js";

describe("synthetic chart validation", () => {
  it("contains only invented, internally valid five-course entries", () => {
    expect(SYNTHETIC_ALFABETO_CHART.source).toContain("Invented test data");

    for (const shape of SYNTHETIC_ALFABETO_CHART.shapes) {
      expect(shape.frets).toHaveLength(5);
      expect(shape.frets.every((fret) => Number.isInteger(fret) && fret >= 0)).toBe(true);
      expect(shapeToPositions(shape).map((position) => position.course)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("keeps exact and superset fixtures musically distinct", () => {
    const exact = SYNTHETIC_ALFABETO_CHART.shapes.find((shape) => shape.letter === "Σ")!;
    const superset = SYNTHETIC_ALFABETO_CHART.shapes.find((shape) => shape.letter === "Υ")!;

    expect([...shapePitchClasses(exact)].sort((a, b) => a - b)).toEqual([2, 7, 11]);
    expect([...shapePitchClasses(superset)].sort((a, b) => a - b)).toEqual([2, 7, 9, 11]);
  });
});
