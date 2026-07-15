import type { TabPosition } from "../../types.js";
import type { InstrumentInstanceConfiguration } from "../instrument-instance.js";

/** Legacy chart locators retained only so old callers can receive a typed,
 * fail-closed review decision. They are not production defaults. */
export type ChartId = "tyler-universal" | "foscarini";

/**
 * Shape category within a chart.
 *
 * - cross: the "+" symbol (E minor open)
 * - standard: letters A–P (no J) — the core 15 shapes
 * - extended: letters Q–Z (no U/W) — higher-position variants
 * - special: chart-defined auxiliary symbols
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
  /** A local algorithm/test identifier, not an activation authority. */
  readonly id: string;
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
  /** Legacy chart locator. Omission still fails closed; it does not select a default chart. */
  readonly chartId?: ChartId;
  /** Maximum fret for barré transpositions (default: 8) */
  readonly maxFret?: number;
  /** Include barré variants (default: true) */
  readonly includeBarreVariants?: boolean;
  readonly instrumentInstance?: InstrumentInstanceConfiguration;
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
  readonly physicalSoundingPitches?: readonly string[];
}

/**
 * Result from the alfabeto lookup function.
 */
export interface AvailableAlfabetoLookupResult {
  readonly status: "available";
  readonly matches: AlfabetoMatch[];
  readonly chartId: string;
  readonly instrumentInstanceDigest?: string;
}

export type AlfabetoReviewRequiredCode =
  | "tracked_source_review_required"
  | "tracked_source_denied"
  | "authorized_chart_release_unavailable";

export interface ReviewRequiredAlfabetoLookupResult {
  readonly status: "review_required";
  readonly matches: [];
  readonly chartId: ChartId;
  readonly instrumentInstanceDigest?: string;
  readonly reviewRequired: {
    readonly code: AlfabetoReviewRequiredCode;
    readonly artifactId: string;
    readonly message: string;
    readonly reasons: readonly string[];
  };
}

/** Production lookup is a closed result: quarantined data never masquerades as
 * an ordinary empty match set. */
export type AlfabetoLookupResult =
  | AvailableAlfabetoLookupResult
  | ReviewRequiredAlfabetoLookupResult;
