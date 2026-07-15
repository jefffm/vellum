import type { AlfabetoChart, AlfabetoShapeEntry } from "../types.js";

/** Deliberately invented shapes used only to test shape-matching algorithms.
 * They are not copied from, attributed to, or presented as historical charts. */
export const SYNTHETIC_SHAPES = {
  sigma: {
    letter: "Σ",
    chord: "G major",
    frets: [3, 0, 7, 0, 2],
    category: "standard",
  },
  tau: {
    letter: "Τ",
    chord: "E minor",
    frets: [0, 8, 4, 2, 7],
    category: "standard",
  },
  pi: {
    letter: "Π",
    chord: "C major",
    frets: [8, 5, 0, 10, 10],
    category: "extended",
  },
  upsilon: {
    letter: "Υ",
    chord: "G major add2",
    frets: [3, 0, 2, 0, 2],
    category: "special",
  },
} as const satisfies Record<string, AlfabetoShapeEntry>;

export const SYNTHETIC_ALFABETO_CHART: AlfabetoChart = {
  id: "test.synthetic-alfabeto.v1",
  name: "Synthetic algorithm fixture",
  source: "Invented test data; no historical authority",
  shapes: Object.values(SYNTHETIC_SHAPES),
};
