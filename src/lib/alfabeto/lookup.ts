import type {
  AlfabetoChart,
  AlfabetoLookupParams,
  AlfabetoLookupResult,
  AlfabetoMatch,
  AvailableAlfabetoLookupResult,
  ChartId,
  ReviewRequiredAlfabetoLookupResult,
} from "./types.js";
import { assertAuthorityPathRuntime } from "../authority-path-runtime.js";
import {
  barrePitchClasses,
  barreTranspose,
  shapePitchClasses,
  shapeToPositions,
} from "./barre-transpose.js";
import { soundingPitches } from "../instrument-instance.js";
import {
  authorizeTrackedSourceOperation,
  loadBundledTrackedSourceInventory,
} from "../tracked-source-quarantine.js";

const QUARANTINED_CHART_ARTIFACTS: Readonly<Record<ChartId, string>> = {
  "tyler-universal": "tracked.alfabeto-tyler-universal",
  foscarini: "tracked.alfabeto-foscarini-overlay",
};

/**
 * Parse a chord name string into MIDI pitch classes (0–11).
 *
 * Supported formats:
 *   Strict:   "G major", "C minor", "Bb major", "F# minor", "Eb minor"
 *   Aliases:  "Gm" → G minor, "Bb" → Bb major, "F#m" → F# minor
 *             "Dm" → D minor, "Am" → A minor
 */
export function parseChordName(name: string): { root: number; quality: string } | null {
  const trimmed = name.trim();

  const ROOT_MAP: Record<string, number> = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
  };

  // Match root note + optional quality
  const match = trimmed.match(/^([A-G][#b]?)\s*(.*)/);

  if (!match) return null;

  const [, rootStr, qualityRaw] = match;
  const root = ROOT_MAP[rootStr];

  if (root === undefined) return null;

  const q = qualityRaw.trim().toLowerCase();

  // Normalize quality
  let quality: string;

  if (q === "" || q === "major" || q === "maj") {
    quality = "major";
  } else if (q === "m" || q === "minor" || q === "min") {
    quality = "minor";
  } else {
    // Pass through for non-triadic chords like "Dm add4"
    quality = qualityRaw.trim();
  }

  return { root, quality };
}

/**
 * Compute the pitch classes for a chord by name.
 * Returns null if the chord name can't be parsed to a standard triad.
 */
export function chordNameToPitchClasses(name: string): Set<number> | null {
  const parsed = parseChordName(name);

  if (!parsed) return null;

  const { root, quality } = parsed;

  if (quality === "major") {
    return new Set([root, (root + 4) % 12, (root + 7) % 12]);
  }

  if (quality === "minor") {
    return new Set([root, (root + 3) % 12, (root + 7) % 12]);
  }

  return null;
}

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;

  for (const v of a) {
    if (!b.has(v)) return false;
  }

  return true;
}

/**
 * Returns true if `a` is a proper superset of `b` (contains all of b's
 * elements plus at least one extra).
 */
function isProperSuperset(a: Set<number>, b: Set<number>): boolean {
  if (a.size <= b.size) return false;

  for (const v of b) {
    if (!a.has(v)) return false;
  }

  return true;
}

/**
 * Resolve a production alfabeto request.
 *
 * The only built-in chart locators point at quarantined tracked-source data.
 * They intentionally return a structured review requirement instead of loading
 * those bytes. A future release loader may call `lookupAlfabetoChart` only after
 * binding exact authorized release bytes to the core source-authority decision.
 */
export function alfabetoLookup(params: AlfabetoLookupParams): AlfabetoLookupResult {
  assertAuthorityPathRuntime("authority.validator.alfabeto-quarantine-denial", "production");
  const chartId = params.chartId ?? "tyler-universal";
  const artifactId = QUARANTINED_CHART_ARTIFACTS[chartId];
  const artifact = loadBundledTrackedSourceInventory().artifacts.find(
    (candidate) => candidate.id === artifactId
  );

  if (!artifact) {
    return reviewRequiredResult(params, chartId, artifactId, "tracked_source_review_required", [
      "The tracked-source inventory does not contain the requested chart artifact.",
    ]);
  }

  const decision = authorizeTrackedSourceOperation({
    artifactId,
    sha256: artifact.sha256,
    operation: "default_generation",
  });

  if (decision.outcome !== "allow") {
    return reviewRequiredResult(
      params,
      chartId,
      artifactId,
      decision.outcome === "deny" ? "tracked_source_denied" : "tracked_source_review_required",
      decision.reasons
    );
  }

  // Authorization of a provenance substitution never authorizes the legacy
  // bytes at this path. T03 deliberately has no caller-constructible chart
  // injection seam; the reviewed release registry will supply exact bytes in a
  // later tracer.
  return reviewRequiredResult(
    params,
    chartId,
    decision.resolvedArtifactId ?? artifactId,
    "authorized_chart_release_unavailable",
    [
      ...decision.reasons,
      "The authority decision allows an artifact, but no exact authorized chart release is loaded.",
    ]
  );
}

/**
 * Pure shape-matching algorithm for synthetic tests and future exact release
 * bytes. This function conveys no production activation or rights authority.
 */
export function lookupAlfabetoChart(
  chart: AlfabetoChart,
  params: Omit<AlfabetoLookupParams, "chartId">
): AvailableAlfabetoLookupResult {
  const maxFret = params.maxFret ?? 8;
  const includeBarre = params.includeBarreVariants ?? true;

  // Resolve target pitch classes
  let targetPitchClasses: Set<number> | null = null;

  if (params.pitchClasses) {
    targetPitchClasses = new Set(params.pitchClasses.map((pc) => ((pc % 12) + 12) % 12));
  } else if (params.chordName) {
    targetPitchClasses = chordNameToPitchClasses(params.chordName);
  }

  if (!targetPitchClasses || targetPitchClasses.size === 0) {
    return {
      status: "available",
      matches: [],
      chartId: chart.id,
      instrumentInstanceDigest: params.instrumentInstance?.contentDigest,
    };
  }

  const standardMatches: AlfabetoMatch[] = [];
  const supersetMatches: AlfabetoMatch[] = [];
  const lowBarreMatches: AlfabetoMatch[] = [];
  const highBarreMatches: AlfabetoMatch[] = [];

  for (const shape of chart.shapes) {
    // Check standard (un-barred) match
    const pitchClasses = shapePitchClasses(shape);

    if (setsEqual(pitchClasses, targetPitchClasses)) {
      standardMatches.push({
        letter: shape.letter,
        chord: shape.chord,
        positions: shapeToPositions(shape),
        source: "standard",
      });
    } else if (isProperSuperset(pitchClasses, targetPitchClasses)) {
      // Shape contains all target pitch classes plus one or more chart-defined extras.
      supersetMatches.push({
        letter: shape.letter,
        chord: shape.chord,
        positions: shapeToPositions(shape),
        source: "superset",
      });
    }

    // Check barré variants
    if (includeBarre) {
      for (let semitones = 1; semitones <= maxFret; semitones++) {
        const barrePCs = barrePitchClasses(shape, semitones);

        if (!setsEqual(barrePCs, targetPitchClasses)) continue;

        const match = barreTranspose(shape, semitones, maxFret);

        if (!match) continue;

        if (semitones <= 3) {
          lowBarreMatches.push(match);
        } else {
          highBarreMatches.push(match);
        }
      }
    }
  }

  // Sort within tiers: fewer open strings last (more open = better), lower position first
  const sortByPosition = (a: AlfabetoMatch, b: AlfabetoMatch): number => {
    const aMin = Math.min(...a.positions.map((p) => p.fret));
    const bMin = Math.min(...b.positions.map((p) => p.fret));

    return aMin - bMin;
  };

  standardMatches.sort(sortByPosition);
  supersetMatches.sort(sortByPosition);
  lowBarreMatches.sort(sortByPosition);
  highBarreMatches.sort(sortByPosition);

  const matches = [...standardMatches, ...supersetMatches, ...lowBarreMatches, ...highBarreMatches];
  return {
    status: "available",
    matches: params.instrumentInstance
      ? matches.map((match) => ({
          ...match,
          physicalSoundingPitches: match.positions.flatMap((position) =>
            soundingPitches(params.instrumentInstance!, position.course, position.fret)
          ),
        }))
      : matches,
    chartId: chart.id,
    instrumentInstanceDigest: params.instrumentInstance?.contentDigest,
  };
}

function reviewRequiredResult(
  params: AlfabetoLookupParams,
  chartId: ChartId,
  artifactId: string,
  code: ReviewRequiredAlfabetoLookupResult["reviewRequired"]["code"],
  reasons: readonly string[]
): ReviewRequiredAlfabetoLookupResult {
  return {
    status: "review_required",
    matches: [],
    chartId,
    instrumentInstanceDigest: params.instrumentInstance?.contentDigest,
    reviewRequired: {
      code,
      artifactId,
      message:
        "Alfabeto chart use requires an exact rights-authorized Knowledge Pack release; no chart data was used.",
      reasons,
    },
  };
}
