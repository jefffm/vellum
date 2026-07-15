const CANONICAL_REFERENCE_SOURCE_INSTANT =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;

declare const referenceSourceInstantBrand: unique symbol;

/** A semantically valid RFC 3339 UTC instant in exact millisecond form. */
export type ReferenceSourceInstant = string & {
  readonly [referenceSourceInstantBrand]: true;
};

export class ReferenceSourceInstantError extends TypeError {
  constructor(
    message: string,
    readonly code: "invalid_instant" | "not_strictly_increasing"
  ) {
    super(message);
    this.name = "ReferenceSourceInstantError";
  }
}

/**
 * Decode an unknown value without allowing Date's normalization of impossible
 * calendar dates. The accepted representation is exactly
 * `YYYY-MM-DDTHH:mm:ss.SSSZ`; offsets, omitted milliseconds, and leap-second
 * spellings are intentionally outside this finite JavaScript-instant subset.
 */
export function decodeReferenceSourceInstant(value: unknown): ReferenceSourceInstant {
  if (typeof value !== "string" || !CANONICAL_REFERENCE_SOURCE_INSTANT.test(value)) {
    throw invalidInstant();
  }

  const epochMilliseconds = Date.parse(value);
  if (!Number.isFinite(epochMilliseconds)) throw invalidInstant();

  // Date.parse normalizes some impossible dates. Exact round-tripping rejects
  // those values and also proves that the parsed instant has canonical bytes.
  if (new Date(epochMilliseconds).toISOString() !== value) throw invalidInstant();
  return value as ReferenceSourceInstant;
}

export function isReferenceSourceInstant(value: unknown): value is ReferenceSourceInstant {
  try {
    decodeReferenceSourceInstant(value);
    return true;
  } catch {
    return false;
  }
}

/** Parse a validated instant to finite Unix epoch milliseconds. */
export function parseReferenceSourceInstant(value: unknown): number {
  const instant = decodeReferenceSourceInstant(value);
  const epochMilliseconds = Date.parse(instant);
  if (!Number.isFinite(epochMilliseconds)) throw invalidInstant();
  return epochMilliseconds;
}

/** Format a finite, four-digit-year JavaScript instant canonically. */
export function formatReferenceSourceInstant(value: Date | number): ReferenceSourceInstant {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw invalidInstant();
  return decodeReferenceSourceInstant(date.toISOString());
}

export function compareReferenceSourceInstants(left: unknown, right: unknown): -1 | 0 | 1 {
  const leftEpoch = parseReferenceSourceInstant(left);
  const rightEpoch = parseReferenceSourceInstant(right);
  return leftEpoch < rightEpoch ? -1 : leftEpoch > rightEpoch ? 1 : 0;
}

export function isReferenceSourceInstantBefore(left: unknown, right: unknown): boolean {
  return compareReferenceSourceInstants(left, right) === -1;
}

/**
 * Validate an ordered lifecycle timeline. Equality is rejected: immutable
 * successor events must advance time rather than merely avoid going backwards.
 */
export function assertReferenceSourceInstantsStrictlyIncreasing(
  values: readonly unknown[],
  label = "Reference-source instant sequence"
): asserts values is readonly ReferenceSourceInstant[] {
  for (let index = 0; index < values.length; index += 1) {
    decodeReferenceSourceInstant(values[index]);
    if (index > 0 && compareReferenceSourceInstants(values[index - 1], values[index]) !== -1) {
      throw new ReferenceSourceInstantError(
        `${label} must be strictly increasing at index ${index}`,
        "not_strictly_increasing"
      );
    }
  }
}

const REFERENCE_SOURCE_TIMESTAMP_KEYS = new Set([
  "acquiredAt",
  "assertedAt",
  "createdAt",
  "decidedAt",
  "disclosedAt",
  "effectiveAt",
  "invalidatedAt",
  "observedAt",
  "submittedAt",
  "validFrom",
  "validUntil",
]);

/** Validate every timestamp-bearing field in a closed reference-source value. */
export function assertCanonicalReferenceSourceTimestampFields(value: unknown): void {
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    if (typeof candidate !== "object" || candidate === null) return;
    for (const [key, item] of Object.entries(candidate)) {
      if (item !== undefined && REFERENCE_SOURCE_TIMESTAMP_KEYS.has(key)) {
        decodeReferenceSourceInstant(item);
      }
      visit(item);
    }
  };
  visit(value);
}

function invalidInstant(): ReferenceSourceInstantError {
  return new ReferenceSourceInstantError(
    "Reference-source instant must be a valid canonical UTC millisecond timestamp",
    "invalid_instant"
  );
}
