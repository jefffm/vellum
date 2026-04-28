/**
 * Shared music utilities used across the engrave pipeline and other tools.
 */

/**
 * Parse a time signature string like "4/4" or "6/8" into numerator/denominator.
 * Throws on invalid format.
 */
export function parseTimeSignature(time: string): { numerator: number; denominator: number } {
  const parts = time.split("/");

  if (parts.length !== 2) {
    throw new Error(`Invalid time signature: "${time}". Expected format: "4/4", "3/4", "6/8"`);
  }

  const numerator = parseInt(parts[0], 10);
  const denominator = parseInt(parts[1], 10);

  if (isNaN(numerator) || isNaN(denominator) || numerator < 1 || denominator < 1) {
    throw new Error(`Invalid time signature: "${time}"`);
  }

  // Denominator must be a power of 2 (valid note value)
  if (!Number.isInteger(Math.log2(denominator))) {
    throw new Error(
      `Invalid time signature denominator: ${denominator}. Must be a power of 2 (1, 2, 4, 8, 16, 32, 64)`
    );
  }

  return { numerator, denominator };
}

/** Valid LilyPond key modes. */
export const VALID_KEY_MODES = [
  "major",
  "minor",
  "dorian",
  "phrygian",
  "lydian",
  "mixolydian",
  "aeolian",
  "locrian",
  "ionian",
] as const;

/** Valid LilyPond tonic names (lowercase, with accidentals). */
export const VALID_KEY_TONICS = [
  "c",
  "cis",
  "ces",
  "d",
  "dis",
  "des",
  "e",
  "eis",
  "ees",
  "f",
  "fis",
  "fes",
  "g",
  "gis",
  "ges",
  "a",
  "ais",
  "aes",
  "b",
  "bis",
  "bes",
] as const;

/**
 * Validate a key signature. Throws on invalid tonic or mode.
 */
export function validateKeySignature(tonic: string, mode: string): void {
  if (!VALID_KEY_TONICS.includes(tonic as (typeof VALID_KEY_TONICS)[number])) {
    throw new Error(
      `Invalid key tonic: "${tonic}". Expected LilyPond tonic like "c", "d", "ees", "fis"`
    );
  }

  if (!VALID_KEY_MODES.includes(mode as (typeof VALID_KEY_MODES)[number])) {
    throw new Error(`Invalid key mode: "${mode}". Expected: ${VALID_KEY_MODES.join(", ")}`);
  }
}
