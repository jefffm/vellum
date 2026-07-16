import { createHash } from "node:crypto";
import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";

/**
 * Stable identity digest for JSON-shaped production records. This primitive is
 * intentionally outside the evaluator lane so production lineage never needs
 * to import evaluator implementation code.
 */
export function digestValue(value: unknown): string {
  assertAuthorityPathRuntime("authority.validator.content-identity", "production");
  return createHash("sha256").update(canonicalContentJson(value)).digest("hex");
}

function canonicalContentJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalContentJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalContentJson(item)}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    throw new TypeError("Content identities require JSON-shaped values");
  }
  return encoded;
}
