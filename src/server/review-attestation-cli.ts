import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { validateReviewCoverage } from "../lib/review-attestation.js";

try {
  const requestPath = requiredArgument("--request");
  const attestationPaths = repeatedArguments("--attestation");
  if (attestationPaths.length === 0) {
    throw new Error("review:validate requires at least one --attestation <path>");
  }
  const request = readJson(requestPath);
  const attestations = attestationPaths.map(readJson);
  const coverage = validateReviewCoverage(request, attestations);
  process.stdout.write(
    `${JSON.stringify({
      ok: coverage.status === "accepted",
      request: path.resolve(requestPath),
      attestations: attestationPaths.map((item) => path.resolve(item)),
      ...coverage,
    })}\n`
  );
  if (coverage.status !== "accepted") process.exitCode = 1;
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`
  );
  process.exitCode = 1;
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(path.resolve(filePath), "utf8"));
}

function requiredArgument(flag: string): string {
  const value = repeatedArguments(flag)[0];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

function repeatedArguments(flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] !== flag) continue;
    const value = process.argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    values.push(value);
  }
  return values;
}
