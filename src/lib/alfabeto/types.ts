import type { TabPosition } from "../../types.js";

/**
 * Supported alfabeto chart identifiers.
 */
export type ChartId = "tyler-universal" | "foscarini";

/**
 * Shape category within a chart.
 *
 * - cross: the "+" symbol (E minor open)
 * - standard: letters A–P (no J) — the core 15 shapes
 * - extended: letters Q–Z (no U/W) — higher-position variants
 * - special: auxiliary symbols (&, 9, ℞, and Foscarini-only glyphs)
 */
export type ShapeCategory = "cross" | "standard" | "extended" | "special";

/**
 * A single entry in an alfabeto chart: letter, chord identity, and fret positions.
 * Frets are ordered c1→c5 (course 1 / chanterelle first, course 5 last).
 */
export interface AlfabetoShapeEntry {
  readonly letter: string;
  readonly chord: string;
  readonly frets: readonly [number, number, number, number, number];
  readonly category: ShapeCategory;
}

/**
 * A complete alfabeto chart with metadata.
 */
export interface AlfabetoChart {
  readonly id: ChartId;
  readonly name: string;
  readonly source: string;
  readonly shapes: readonly AlfabetoShapeEntry[];
}

/**
 * Parameters for the alfabeto lookup function.
 */
export interface AlfabetoLookupParams {
  /** Chord name, e.g. "G major", "Dm", "Bb" */
  readonly chordName?: string;
  /** MIDI pitch classes (0–11) to match against shape output */
  readonly pitchClasses?: readonly number[];
  /** Which chart to use (default: "tyler-universal") */
  readonly chartId?: ChartId;
  /** Maximum fret for barré transpositions (default: 8) */
  readonly maxFret?: number;
  /** Include barré variants (default: true) */
  readonly includeBarreVariants?: boolean;
}

/**
 * A single match from the alfabeto lookup.
 */
export interface AlfabetoMatch {
  readonly letter: string;
  readonly chord: string;
  readonly positions: TabPosition[];
  readonly source: "standard" | "barre" | "superset";
  readonly barreAt?: number;
  readonly baseShape?: string;
}

/**
 * Result from the alfabeto lookup function.
 */
export interface AlfabetoLookupResult {
  readonly matches: AlfabetoMatch[];
  readonly chartId: ChartId;
}
