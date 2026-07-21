import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { ApiRouteError } from "./create-route.js";

export const PINNED_MEI_SCHEMA_SHA256 =
  "24f0d6e53eebdaf6e85f91f38fccc479bf91a200e15177d5284070cafd3b29bc";

const PINNED_MEI_SCHEMA_PATH = path.resolve("vendor/mei/5.1/mei-all.rng");
const validatedDocuments = new Set<string>();
const MAX_CACHED_DOCUMENTS = 128;

export function validateAgainstPinnedMeiSchema(mei: string): void {
  const documentDigest = createHash("sha256").update(mei).digest("hex");
  if (validatedDocuments.has(documentDigest)) return;

  let schema: Buffer;
  try {
    schema = readFileSync(PINNED_MEI_SCHEMA_PATH);
  } catch {
    throw new ApiRouteError("Pinned MEI Schema is unavailable; canonical write aborted", 503);
  }
  const schemaDigest = createHash("sha256").update(schema).digest("hex");
  if (schemaDigest !== PINNED_MEI_SCHEMA_SHA256) {
    throw new ApiRouteError(
      `Pinned MEI Schema digest mismatch: expected ${PINNED_MEI_SCHEMA_SHA256}, received ${schemaDigest}`,
      500
    );
  }

  const executable = process.env.VELLUM_XMLLINT_PATH?.trim() || "xmllint";
  const result = spawnSync(executable, ["--noout", "--relaxng", PINNED_MEI_SCHEMA_PATH, "-"], {
    input: mei,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    timeout: 15_000,
  });
  if (result.error) {
    const unavailable = (result.error as NodeJS.ErrnoException).code === "ENOENT";
    throw new ApiRouteError(
      unavailable
        ? "Pinned MEI Schema validator is unavailable; canonical write aborted"
        : `Pinned MEI Schema validator failed: ${result.error.message}`,
      unavailable ? 503 : 500
    );
  }
  if (result.status !== 0) {
    const diagnostic = String(result.stderr || result.stdout || "schema validation failed")
      .replaceAll(PINNED_MEI_SCHEMA_PATH, "mei-all.rng")
      .replaceAll(/\s+/g, " ")
      .trim()
      .slice(0, 1200);
    throw new ApiRouteError(`Pinned MEI Schema rejected canonical MEI: ${diagnostic}`, 422);
  }

  if (validatedDocuments.size >= MAX_CACHED_DOCUMENTS) {
    validatedDocuments.delete(validatedDocuments.values().next().value!);
  }
  validatedDocuments.add(documentDigest);
}
