/**
 * Shared music utilities used across the engrave pipeline and other tools.
 */

/** Rational duration measured in quarter-note units. */
export interface RationalDuration {
  quarters: {
    numerator: number;
    denominator: number;
  };
  /** Original source token, e.g. LilyPond "4." or MusicXML divisions, for diagnostics. */
  sourceToken?: string;
}

export type DurationInput = RationalDuration | string;

export type DurationDiagnosticSeverity = "warning" | "error";

export interface MeasureDurationDiagnostic {
  severity: DurationDiagnosticSeverity;
  code: "measure_duration_mismatch" | "pickup_duration_mismatch" | "pickup_duration_overflow";
  message: string;
  measureId: string;
  voiceId?: string;
  expected: RationalDuration;
  actual: RationalDuration;
  difference: RationalDuration;
}

export interface ValidateMeasureDurationParams {
  measureId: string;
  voiceId?: string;
  durations?: DurationInput[];
  actualDuration?: DurationInput;
  expectedDuration?: DurationInput;
  timeSignature?: string;
  /** Explicit expected duration for an anacrusis/pickup measure. */
  pickupDuration?: DurationInput;
  /** Explicit override for irregular bars, e.g. alternative endings. */
  measureDurationOverride?: DurationInput;
  isPickup?: boolean;
  context?: string;
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }

  return x || 1;
}

function assertFiniteInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} must be a finite integer`);
  }
}

export function durationFromQuarters(
  numerator: number,
  denominator = 1,
  sourceToken?: string
): RationalDuration {
  assertFiniteInteger(numerator, "duration numerator");
  assertFiniteInteger(denominator, "duration denominator");

  if (denominator === 0) {
    throw new Error("duration denominator must not be zero");
  }

  const sign = denominator < 0 ? -1 : 1;
  const normalizedNumerator = numerator * sign;
  const normalizedDenominator = Math.abs(denominator);
  const divisor = greatestCommonDivisor(normalizedNumerator, normalizedDenominator);

  return {
    quarters: {
      numerator: normalizedNumerator / divisor,
      denominator: normalizedDenominator / divisor,
    },
    ...(sourceToken !== undefined ? { sourceToken } : {}),
  };
}

export const ZERO_DURATION: RationalDuration = durationFromQuarters(0);

export function cloneDuration(duration: RationalDuration, sourceToken?: string): RationalDuration {
  return durationFromQuarters(
    duration.quarters.numerator,
    duration.quarters.denominator,
    sourceToken ?? duration.sourceToken
  );
}

export function coerceDuration(input: DurationInput): RationalDuration {
  return typeof input === "string" ? parseLilyPondDuration(input) : cloneDuration(input);
}

export function addDurations(...durations: DurationInput[]): RationalDuration {
  return durations.reduce<RationalDuration>((sum, duration) => {
    const next = coerceDuration(duration);
    return durationFromQuarters(
      sum.quarters.numerator * next.quarters.denominator +
        next.quarters.numerator * sum.quarters.denominator,
      sum.quarters.denominator * next.quarters.denominator
    );
  }, ZERO_DURATION);
}

export function subtractDurations(left: DurationInput, right: DurationInput): RationalDuration {
  const a = coerceDuration(left);
  const b = coerceDuration(right);
  return durationFromQuarters(
    a.quarters.numerator * b.quarters.denominator - b.quarters.numerator * a.quarters.denominator,
    a.quarters.denominator * b.quarters.denominator
  );
}

export function compareDurations(left: DurationInput, right: DurationInput): -1 | 0 | 1 {
  const difference = subtractDurations(left, right);
  if (difference.quarters.numerator < 0) return -1;
  if (difference.quarters.numerator > 0) return 1;
  return 0;
}

export function durationsEqual(left: DurationInput, right: DurationInput): boolean {
  return compareDurations(left, right) === 0;
}

export function sumDurations(durations: DurationInput[]): RationalDuration {
  return addDurations(...durations);
}

export function formatDuration(duration: DurationInput): string {
  const normalized = coerceDuration(duration);
  const { numerator, denominator } = normalized.quarters;
  return denominator === 1 ? `${numerator}` : `${numerator}/${denominator}`;
}

export function parseLilyPondDuration(token: string): RationalDuration {
  const trimmed = token.trim();
  const match = /^(\d+)(\.*)$/.exec(trimmed);

  if (!match) {
    throw new Error(`Invalid LilyPond duration: "${token}"`);
  }

  const denominator = parseInt(match[1], 10);
  const dots = match[2].length;

  if (denominator < 1 || denominator > 64 || !Number.isInteger(Math.log2(denominator))) {
    throw new Error(
      `Invalid LilyPond duration denominator: ${denominator}. Expected 1, 2, 4, 8, 16, 32, or 64`
    );
  }

  const base = durationFromQuarters(4, denominator);
  let total = base;
  let dotValue = base;

  for (let i = 0; i < dots; i += 1) {
    dotValue = durationFromQuarters(dotValue.quarters.numerator, dotValue.quarters.denominator * 2);
    total = addDurations(total, dotValue);
  }

  return cloneDuration(total, trimmed);
}

export function expectedDurationForTimeSignature(time: string): RationalDuration {
  const { numerator, denominator } = parseTimeSignature(time);
  return durationFromQuarters(numerator * 4, denominator, time);
}

function diagnosticDifferenceLabel(difference: RationalDuration): string {
  if (difference.quarters.numerator === 0) {
    return "exact";
  }

  const magnitude = durationFromQuarters(
    Math.abs(difference.quarters.numerator),
    difference.quarters.denominator
  );
  return difference.quarters.numerator > 0
    ? `long by ${formatDuration(magnitude)} quarter(s)`
    : `short by ${formatDuration(magnitude)} quarter(s)`;
}

function resolveExpectedDuration(params: ValidateMeasureDurationParams): RationalDuration {
  if (params.measureDurationOverride !== undefined) {
    return coerceDuration(params.measureDurationOverride);
  }

  if (params.isPickup && params.pickupDuration !== undefined) {
    return coerceDuration(params.pickupDuration);
  }

  if (params.expectedDuration !== undefined) {
    return coerceDuration(params.expectedDuration);
  }

  if (params.timeSignature !== undefined) {
    return expectedDurationForTimeSignature(params.timeSignature);
  }

  throw new Error(
    "validateMeasureDuration requires expectedDuration, timeSignature, pickupDuration, or measureDurationOverride"
  );
}

function makeMeasureDurationDiagnostic(
  params: ValidateMeasureDurationParams,
  expected: RationalDuration,
  actual: RationalDuration,
  code: MeasureDurationDiagnostic["code"]
): MeasureDurationDiagnostic {
  const difference = subtractDurations(actual, expected);
  const voice = params.voiceId ? ` voice ${params.voiceId}` : "";
  const context = params.context ? ` (${params.context})` : "";
  return {
    severity: "error",
    code,
    measureId: params.measureId,
    ...(params.voiceId !== undefined ? { voiceId: params.voiceId } : {}),
    expected,
    actual,
    difference,
    message: `Measure ${params.measureId}${voice}${context} duration is ${formatDuration(
      actual
    )} quarter(s); expected ${formatDuration(expected)} quarter(s) (${diagnosticDifferenceLabel(
      difference
    )}).`,
  };
}

export function validateMeasureDuration(
  params: ValidateMeasureDurationParams
): MeasureDurationDiagnostic[] {
  const expected = resolveExpectedDuration(params);
  const actual =
    params.actualDuration !== undefined
      ? coerceDuration(params.actualDuration)
      : sumDurations(params.durations ?? []);

  if (params.isPickup && params.pickupDuration === undefined) {
    if (compareDurations(actual, expected) > 0) {
      return [makeMeasureDurationDiagnostic(params, expected, actual, "pickup_duration_overflow")];
    }
    return [];
  }

  if (durationsEqual(actual, expected)) {
    return [];
  }

  return [
    makeMeasureDurationDiagnostic(
      params,
      expected,
      actual,
      params.isPickup ? "pickup_duration_mismatch" : "measure_duration_mismatch"
    ),
  ];
}

export function validateMeasureDurations(
  entries: ValidateMeasureDurationParams[]
): MeasureDurationDiagnostic[] {
  return entries.flatMap((entry) => validateMeasureDuration(entry));
}

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
