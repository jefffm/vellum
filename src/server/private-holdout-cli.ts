import { appendFileSync, readFileSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  evaluatePrivateHoldout,
  redactPrivateHoldoutAttempt,
  type PrivateHoldoutCase,
} from "./lib/private-holdout-evaluation.js";
import { WorkspaceStore } from "./lib/workspace-store.js";

const manifestPath = path.resolve(
  argument("--manifest") ?? path.join(os.homedir(), ".vellum", "holdouts", "manifest.json")
);
assertOutsideRepository(manifestPath);
const manifest = parseManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
const store = new WorkspaceStore();
const results = manifest.cases.map((entry) => evaluatePrivateHoldout(store, entry));
const attempts = results.map(redactPrivateHoldoutAttempt);
const attemptLog = path.join(path.dirname(manifestPath), "attempts.ndjson");
assertOutsideRepository(attemptLog);
const attemptedAt = new Date().toISOString();
for (const attempt of attempts) {
  appendFileSync(attemptLog, `${JSON.stringify({ attemptedAt, ...attempt })}\n`, { mode: 0o600 });
}
const ok = attempts.every(({ status }) => status === "pass");
process.stdout.write(
  `${JSON.stringify({
    ok,
    command: "proof:holdout",
    caseCount: attempts.length,
    attempts,
    averagingUsed: false,
    attemptLog: "owner-local",
  })}\n`
);
if (!ok) process.exitCode = 1;

function parseManifest(value: unknown): { schemaVersion: 1; cases: PrivateHoldoutCase[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Private holdout manifest must be an object");
  }
  const input = value as { schemaVersion?: unknown; cases?: unknown };
  if (input.schemaVersion !== 1 || !Array.isArray(input.cases) || input.cases.length === 0) {
    throw new Error("Private holdout manifest requires at least one case");
  }
  const cases = input.cases.map((entry): PrivateHoldoutCase => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Private holdout case must be an object");
    }
    const item = entry as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !/^holdout\.[a-f0-9-]{8,}$/u.test(item.id) ||
      typeof item.workspaceId !== "string" ||
      typeof item.arrangementScoreId !== "string" ||
      !item.truth ||
      typeof item.truth !== "object" ||
      Array.isArray(item.truth)
    ) {
      throw new Error("Private holdout case identity or truth is invalid");
    }
    const truth = item.truth as Record<string, unknown>;
    return {
      id: item.id,
      workspaceId: item.workspaceId,
      arrangementScoreId: item.arrangementScoreId,
      truth: {
        principalSourceEventIds: stringArray(truth.principalSourceEventIds),
        cadenceSourceEventIds: stringArray(truth.cadenceSourceEventIds),
        subordinateSourceEventIds: stringArray(truth.subordinateSourceEventIds),
      },
    };
  });
  return { schemaVersion: 1, cases };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("Private holdout truth lists must contain only event IDs");
  }
  return value;
}

function assertOutsideRepository(candidate: string): void {
  const repository = realpathSync(process.cwd());
  const parent = realpathSync(path.dirname(candidate));
  const resolved = path.join(parent, path.basename(candidate));
  const relative = path.relative(repository, resolved);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error(
      "Private holdout manifests and attempt logs must remain outside the repository"
    );
  }
}

function argument(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}
