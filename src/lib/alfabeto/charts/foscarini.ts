import type { AlfabetoChart, AlfabetoShapeEntry } from "../types.js";
import { TYLER_UNIVERSAL } from "./tyler-universal.js";

/**
 * Foscarini Alfabeto Chart.
 *
 * Source: Foscarini, via Tyler (2011). Transcribed from Jeff's direct book reading.
 *
 * 25 of 26 core shapes are identical to Tyler Universal.
 * Differences:
 *   - L: c2=3 (D4) instead of Tyler's c2=4 (Eb4), giving C minor add9
 *
 * Foscarini-only extra shapes are appended.
 */

/** Foscarini's L shape: C minor with added 9th (D on c2). */
const foscariniL: AlfabetoShapeEntry = {
  letter: "L",
  chord: "C minor",
  frets: [3, 3, 0, 1, 3],
  category: "standard",
};

/** Extra shapes unique to Foscarini. */
const foscariniExtras: readonly AlfabetoShapeEntry[] = [
  {
    letter: "B\u00B7",
    chord: "Dm add4",
    frets: [3, 3, 0, 3, 0],
    category: "special",
  },
  {
    letter: "M\u2020",
    chord: "Eb minor",
    frets: [2, 4, 3, 1, 1],
    category: "special",
  },
];

/**
 * Build the Foscarini chart by overlaying on Tyler Universal.
 * Replace L with Foscarini variant, then append Foscarini-only extras.
 */
function buildFoscariniChart(): AlfabetoChart {
  const shapes: AlfabetoShapeEntry[] = TYLER_UNIVERSAL.shapes.map((shape) =>
    shape.letter === "L" ? foscariniL : shape
  );

  return {
    id: "foscarini",
    name: "Foscarini Alfabeto Chart",
    source: "Foscarini, via Tyler (2011)",
    shapes: [...shapes, ...foscariniExtras],
  };
}

export const FOSCARINI: AlfabetoChart = buildFoscariniChart();
