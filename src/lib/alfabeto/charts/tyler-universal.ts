import type { AlfabetoChart, AlfabetoShapeEntry } from "../types.js";

/**
 * Tyler Universal Alfabeto Reference Chart.
 *
 * Source: Tyler, *A Guide to Playing the Baroque Guitar* (2011), Example 6.7.
 * Frets listed c1→c5 (chanterelle → 5th course).
 * Tuning: c1=E4, c2=B3, c3=G3, c4=D4 (re-entrant), c5=A3 (re-entrant).
 *
 * All 26 shapes verified by direct book transcription and pitch math.
 */

const shapes: readonly AlfabetoShapeEntry[] = [
  // Cross
  { letter: "+", chord: "E minor", frets: [0, 0, 0, 2, 2], category: "cross" },

  // Standard shapes A–P (no J)
  { letter: "A", chord: "G major", frets: [3, 3, 0, 0, 2], category: "standard" },
  { letter: "B", chord: "C major", frets: [0, 1, 0, 2, 3], category: "standard" },
  { letter: "C", chord: "D major", frets: [2, 3, 2, 0, 0], category: "standard" },
  { letter: "D", chord: "A minor", frets: [0, 1, 2, 2, 0], category: "standard" },
  { letter: "E", chord: "D minor", frets: [1, 3, 2, 0, 0], category: "standard" },
  { letter: "F", chord: "E major", frets: [0, 0, 1, 2, 2], category: "standard" },
  { letter: "G", chord: "F major", frets: [1, 1, 2, 3, 3], category: "standard" },
  { letter: "H", chord: "Bb major", frets: [1, 3, 3, 3, 1], category: "standard" },
  { letter: "I", chord: "A major", frets: [0, 2, 2, 2, 0], category: "standard" },
  { letter: "K", chord: "Bb minor", frets: [1, 2, 3, 3, 1], category: "standard" },
  { letter: "L", chord: "C minor", frets: [3, 4, 0, 1, 3], category: "standard" },
  { letter: "M", chord: "Eb major", frets: [3, 4, 3, 1, 1], category: "standard" },
  { letter: "N", chord: "Ab major", frets: [4, 1, 1, 1, 3], category: "standard" },
  { letter: "O", chord: "G minor", frets: [3, 3, 0, 0, 1], category: "standard" },
  { letter: "P", chord: "F minor", frets: [1, 1, 1, 3, 3], category: "standard" },

  // Extended shapes Q–Z (no U, W)
  { letter: "Q", chord: "Gb major", frets: [2, 2, 3, 4, 4], category: "extended" },
  { letter: "R", chord: "B major", frets: [2, 4, 4, 4, 2], category: "extended" },
  { letter: "S", chord: "E major", frets: [4, 5, 4, 2, 2], category: "extended" },
  { letter: "T", chord: "A major", frets: [5, 2, 2, 2, 4], category: "extended" },
  { letter: "V", chord: "F# minor", frets: [2, 2, 2, 4, 4], category: "extended" },
  { letter: "X", chord: "B minor", frets: [2, 3, 4, 4, 2], category: "extended" },
  { letter: "Y", chord: "G major", frets: [3, 3, 4, 5, 5], category: "extended" },
  { letter: "Z", chord: "C major", frets: [3, 5, 5, 5, 3], category: "extended" },

  // Special symbols
  { letter: "&", chord: "Db major", frets: [1, 2, 1, 3, 4], category: "special" },
  { letter: "9", chord: "E minor", frets: [3, 5, 4, 2, 2], category: "special" },
  {
    letter: "\u211E",
    chord: "F minor",
    frets: [4, 6, 5, 3, 3],
    category: "special",
  },
] as const;

export const TYLER_UNIVERSAL: AlfabetoChart = {
  id: "tyler-universal",
  name: "Universal Alfabeto Reference Chart",
  source: "Tyler, A Guide to Playing the Baroque Guitar (2011), Ex. 6.7",
  shapes,
};
