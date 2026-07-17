import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = "src/server/lib/evaluation-leak-canary.ts";
const harnessPath = "src/server/lib/evaluation-harness.ts";
const focusedTestPath =
  "test/instrument-intelligence/T71-early-evaluator-private-leak-canaries.test.ts";

function fail(message) {
  throw new Error(`Evaluation leak-canary verification failed: ${message}`);
}

function readRegularFile(repoPath) {
  const absolute = path.join(root, repoPath);
  if (!existsSync(absolute)) fail(`required path is absent: ${repoPath}`);
  const info = lstatSync(absolute);
  if (info.isSymbolicLink() || !info.isFile()) {
    fail(`required path is not a regular file: ${repoPath}`);
  }
  return readFileSync(absolute, "utf8");
}

function requireTokens(text, tokens, context) {
  for (const token of tokens) {
    if (!text.includes(token)) fail(`${context} is missing ${JSON.stringify(token)}`);
  }
}

const source = readRegularFile(sourcePath);
const harness = readRegularFile(harnessPath);
const focusedTest = readRegularFile(focusedTestPath);

requireTokens(
  source,
  [
    'guardVersion: "t71.v1"',
    '"generation_input"',
    '"provider_egress"',
    '"tool_payload"',
    '"result_commit"',
    '"public_writer"',
    '"log"',
    '"diagnostic"',
    '"repository_scan"',
    'variant("canary-class.raw"',
    'variant("canary-class.base64"',
    'variant("canary-class.compressed"',
    'variant("canary-class.truncated"',
    'variant("canary-class.renamed"',
    'variant("canary-class.sha1"',
    'variant("canary-class.md5"',
    "assertFilesSafe(paths:",
    "guardedLeakBoundaryEffect",
    "if (!guard) throw new Error",
    "secret.fill(0)",
    "variant.bytes.fill(0)",
  ],
  sourcePath
);

requireTokens(
  harness,
  [
    "this.options.leakCanaryGuard ?? createEvaluationLeakCanaryGuard()",
    'leakGuard.assertSafe("generation_input", process.env)',
    'leakGuard.assertSafe("generation_input", generatorVisibleInput(evaluationCase))',
    'leakGuard.assertSafe("result_commit", execution)',
    'leakGuard.assertSafe("diagnostic", execution.diagnostics ?? [])',
    "this.options.executeCase(evaluationCase, manifest, boundaries)",
    "leakGuard.assertFilesSafe(paths)",
    "finally",
    "leakGuard.close()",
  ],
  harnessPath
);

for (const [writer, value, expectedCount] of [
  ["saveManifest", "resolvedManifest", 1],
  ["saveRun", "runningRun", 1],
  ["saveCaseRun", "caseRun", 1],
  ["saveCard", "card", 1],
  ["saveRun", "run", 1],
]) {
  const pattern = new RegExp(
    `leakGuard\\.assertSafe\\("public_writer", ${value}\\)[\\s\\S]{0,240}?this\\.options\\.store\\.${writer}\\(${value}\\)`,
    "g"
  );
  const count = [...harness.matchAll(pattern)].length;
  if (count !== expectedCount) {
    fail(`${harnessPath} does not guard ${writer}(${value}) exactly once before publication`);
  }
}

requireTokens(
  focusedTest,
  [
    "randomBytes(32)",
    "gzipSync(secret)",
    'guardedLeakBoundaryEffect(guard, "provider_egress"',
    'guardedLeakBoundaryEffect(guard, "tool_payload"',
    'guardedLeakBoundaryEffect(guard, "log"',
    "guardedPublicWrite(undefined",
    "guard.assertFilesSafe([privatePath])",
    "not.toContain(privatePath)",
    "not.toContain(secret.toString",
    'toThrow("stale")',
    'toThrow("inactive")',
  ],
  focusedTestPath
);

const issueRoot = path.join(root, ".scratch/instrument-intelligence/issues");
const issues = new Map();
for (const file of readdirSync(issueRoot).filter((name) => /^\d+-.*\.md$/.test(name))) {
  const markdown = readRegularFile(`.scratch/instrument-intelligence/issues/${file}`);
  const id = Number(file.match(/^\d+/)[0]);
  const blockedSection = markdown.split("## Blocked by\n")[1]?.split("\n## ")[0] ?? "";
  issues.set(id, {
    file,
    blockedBy: [...blockedSection.matchAll(/^- (\d+)$/gm)].map((match) => Number(match[1])),
    evaluation:
      id >= 17 && (id <= 22 || /^Requirement families touched:.*II-EVAL-/m.test(markdown)),
  });
}

function dependsOnCanary(id, visiting = new Set()) {
  if (id === 71) return true;
  if (visiting.has(id)) return false;
  visiting.add(id);
  return (issues.get(id)?.blockedBy ?? []).some((dependency) =>
    dependsOnCanary(dependency, visiting)
  );
}

for (const [id, issue] of issues) {
  if (issue.evaluation && !dependsOnCanary(id)) {
    fail(`T${id} (${issue.file}) has no transitive dependency on T71`);
  }
}

console.log("Evaluation leak-canary integrity and dependency closure verified.");
