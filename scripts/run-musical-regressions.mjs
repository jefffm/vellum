import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const manifestPath = path.join(root, "test/fixtures/evaluation/musical-regression-suite.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assertManifest(manifest);

const temporary = mkdtempSync(path.join(tmpdir(), "vellum-musical-regressions-"));
const resultPath = path.join(temporary, "vitest.json");
const testFiles = [...new Set(manifest.cases.map(({ testFile }) => testFile))];

try {
  const vitest = spawnSync(
    path.join(root, "node_modules/.bin/vitest"),
    ["run", ...testFiles, "--reporter=json", `--outputFile=${resultPath}`],
    { cwd: root, encoding: "utf8", env: process.env }
  );
  const results = JSON.parse(readFileSync(resultPath, "utf8"));
  const assertions = new Map();
  for (const suite of results.testResults ?? []) {
    const relative = path.relative(root, suite.name);
    for (const assertion of suite.assertionResults ?? []) {
      assertions.set(`${relative}\0${assertion.title}`, assertion.status);
    }
  }

  const cases = manifest.cases.map((entry) => {
    const suite = (results.testResults ?? []).find(
      ({ name }) => path.relative(root, name) === entry.testFile
    );
    return {
      id: entry.id,
      role: entry.role,
      status: suite ? (suite.status === "passed" ? "pass" : "blocked") : "incomplete",
    };
  });
  const dimensions = manifest.dimensions.map((dimension) => gradeDimension(dimension, assertions));
  const hardFailure = dimensions.some(({ status }) => status === "fail");
  const unresolved = dimensions.some(
    ({ status }) => status === "blocked" || status === "incomplete"
  );
  const ok = vitest.status === 0 && !hardFailure && !unresolved;
  process.stdout.write(
    `${JSON.stringify({
      ok,
      command: "proof:musical",
      primaryCorpus: cases.filter(({ role }) => role === "primary").map(({ id }) => id),
      secondaryRegressions: cases
        .filter(({ role }) => role === "secondary-regression")
        .map(({ id }) => id),
      cases,
      dimensions,
      hardFailure,
      averagingUsed: false,
    })}\n`
  );
  if (!ok) {
    if (vitest.stdout) process.stderr.write(vitest.stdout);
    if (vitest.stderr) process.stderr.write(vitest.stderr);
    process.exitCode = 1;
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

function gradeDimension(dimension, assertions) {
  const missingEvidence = dimension.evidence.filter(
    (item) => !assertions.has(`${item.testFile}\0${item.testTitle}`)
  );
  const missingMutations = dimension.mutations.filter(
    (item) => !assertions.has(`${item.testFile}\0${item.testTitle}`)
  );
  if (missingEvidence.length || missingMutations.length) {
    return {
      id: dimension.id,
      status: "incomplete",
      findingCodes: ["musical_regression.evidence_incomplete"],
      mutationCount: dimension.mutations.length - missingMutations.length,
    };
  }
  const mutationFailed = dimension.mutations.some(
    (item) => assertions.get(`${item.testFile}\0${item.testTitle}`) !== "passed"
  );
  if (mutationFailed) {
    return {
      id: dimension.id,
      status: "fail",
      findingCodes: ["musical_regression.mutation_not_rejected"],
      mutationCount: dimension.mutations.length,
    };
  }
  const evidenceBlocked = dimension.evidence.some(
    (item) => assertions.get(`${item.testFile}\0${item.testTitle}`) !== "passed"
  );
  return {
    id: dimension.id,
    status: evidenceBlocked ? "blocked" : "pass",
    findingCodes: evidenceBlocked ? ["musical_regression.evidence_blocked"] : [],
    mutationCount: dimension.mutations.length,
  };
}

function assertManifest(value) {
  if (
    value?.schemaVersion !== 1 ||
    !Array.isArray(value.cases) ||
    !Array.isArray(value.dimensions)
  ) {
    throw new Error("Musical regression manifest is invalid");
  }
  const primary = value.cases.filter(({ role }) => role === "primary");
  if (primary.length !== 1 || /greensleeves/i.test(primary[0].id)) {
    throw new Error("The public musical corpus requires one non-Greensleeves primary case");
  }
  if (
    !value.cases.some(({ role, id }) => role === "secondary-regression" && /greensleeves/i.test(id))
  ) {
    throw new Error("Greensleeves must remain a secondary regression");
  }
  const required = [
    "source_fidelity",
    "phrase_and_cadence",
    "subordinate_voice_continuity",
    "target_mechanics",
    "historical_and_target_idiom",
    "notation_correctness",
    "playback_identity",
  ];
  for (const id of required) {
    const dimension = value.dimensions.find((item) => item.id === id);
    if (!dimension?.evidence?.length || !dimension?.mutations?.length) {
      throw new Error(`Musical regression dimension lacks evidence or a mutation: ${id}`);
    }
  }
}
