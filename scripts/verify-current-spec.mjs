import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const archiveRoot = "docs/archive/specifications/2026-07-13";

function fail(message) {
  throw new Error("Current specification verification failed: " + message);
}

function requirePaths(paths, label) {
  const missing = paths.filter((file) => !existsSync(path.join(root, file)));
  if (missing.length) fail(label + " missing: " + missing.join(", "));
}

requirePaths(
  [
    "SPEC.md",
    "CONTEXT.md",
    "AGENTS.md",
    "README.md",
    ".scratch/README.md",
    "docs/agents/domain.md",
    "docs/adr/0022-govern-reviewed-knowledge-library.md",
    "docs/architecture/arrangement-intelligence-boundaries.md",
    archiveRoot + "/README.md",
    archiveRoot + "/repository/SPEC.md",
    archiveRoot + "/repository/docs/SPEC_RECONCILIATION.md",
    archiveRoot + "/repository/docs/proposals/instrument-knowledge-source-ingestion.md",
    archiveRoot + "/repository/.scratch/arrangement-intelligence-followup/PLAN.md",
    ".scratch/arrangement-intelligence/completion-manifest.json",
  ],
  "canonical or historical document"
);

requirePaths(
  [
    "src/server/lib/omr.ts",
    "src/server/lib/source-import-service.ts",
    "src/server/lib/owner-store.ts",
    "src/server/lib/knowledge-pack-loader.ts",
    "src/server/lib/arrangement-service.ts",
    "src/lib/instrument-instance.ts",
    "src/lib/preservation-policy.ts",
    "src/lib/transformation-report.ts",
    "src/lib/audio-preview.ts",
    "test/e2e/greensleeves-tracer.test.ts",
    "test/e2e/continuo-tracer.test.ts",
    "test/e2e/imitative-counterpoint-tracer.test.ts",
    "test/e2e/lute-diapason-tracer.test.ts",
  ],
  "prototype baseline evidence"
);

const forbiddenCurrentPaths = [
  "ALFABETO-SPEC.md",
  "HISTORICAL-RENDERING-SPEC.md",
  "HYMNARY-IMPORT-SPEC.md",
  "TEMPLATE-FILL-SPEC.md",
  "OPEN-QUESTIONS.md",
  "TECH_DEBT_AUDIT.md",
  "docs/SPEC_RECONCILIATION.md",
  "docs/proposals",
  ".scratch/arrangement-intelligence-followup",
  ".scratch/interactive-score-workspace",
];
const stillActive = forbiddenCurrentPaths.filter((file) => existsSync(path.join(root, file)));
if (stillActive.length) fail("superseded paths still look current: " + stillActive.join(", "));

const unexpectedRootPlans = readdirSync(root).filter(
  (name) =>
    /^(?:WAVE.*|.*-SPEC)\.md$/i.test(name) || /^(?:BLUNDER-HUNT.*|OPEN-QUESTIONS)\.md$/i.test(name)
);
if (unexpectedRootPlans.length) {
  fail(
    "historical planning documents remain at repository root: " + unexpectedRootPlans.join(", ")
  );
}

const spec = readFileSync(path.join(root, "SPEC.md"), "utf8");
for (const phrase of [
  "Status: Current and authoritative next-work specification",
  "This is the only current implementation specification in the repository.",
  "Five-course baroque guitar, thirteen-course baroque lute, and six-string classical guitar are coequal initial targets.",
  "Reference-source substrate",
  "Reviewed Knowledge Library",
  "Knowledge Library Inventory Snapshot",
  "Activation Decision",
  "Advisory Verification",
  "Applied Knowledge Manifest",
  "Target Voice and Relationship Plans",
  "Continuo Realization and Disposition Plan",
  "Intended Technique Plan",
  "Five-course baroque-guitar compiler",
  "Thirteen-course baroque-lute compiler",
  "Six-string classical-guitar compiler",
  "Evaluation and grading",
  "Generation System",
  "Capability Qualification",
  "Adoption Decision",
  "Vault Split Manifest",
  "Development regressions and held-out acceptance",
  "Late human review and release",
  "Completion boundary",
]) {
  if (!spec.includes(phrase)) fail("SPEC.md lacks required contract marker: " + phrase);
}
if (spec.includes("proposed ADR 0022") || spec.includes("must be accepted before Slice 1")) {
  fail("SPEC.md still treats accepted ADR 0022 as proposed");
}

const agents = readFileSync(path.join(root, "AGENTS.md"), "utf8");
for (const phrase of [
  "The sole current implementation specification is SPEC.md",
  "do not create beads unless the Owner explicitly requests",
  "Do not reopen .scratch/arrangement-intelligence",
]) {
  if (!agents.includes(phrase)) fail("AGENTS.md lacks current-work marker: " + phrase);
}
for (const stale of ["Alfabeto Pipeline Integration", "vellum-chj", "~/workspace/vellum"]) {
  if (agents.includes(stale)) fail("AGENTS.md retains stale instruction: " + stale);
}

const frozenWaveReadme = readFileSync(
  path.join(root, ".scratch/arrangement-intelligence/README.md"),
  "utf8"
);
if (!frozenWaveReadme.includes("Status: frozen completed prototype evidence")) {
  fail("completed Arrangement Intelligence evidence is not clearly marked frozen");
}

const context = readFileSync(path.join(root, "CONTEXT.md"), "utf8");
for (const term of [
  "Reviewed Knowledge Library",
  "Knowledge Pack Release",
  "Release Attestation",
  "Attestation Verification",
  "Release Advisory",
  "Advisory Verification",
  "Activation Decision",
  "Knowledge Library Inventory Snapshot",
  "Applied Knowledge Manifest",
  "Source Segment Version",
  "Knowledge Reassessment",
  "Target Voice Plan",
  "Target Relationship Plan",
  "Continuo Realization Plan",
  "Intended Technique Plan",
  "Adoption Decision",
  "Generation System",
  "Capability Qualification",
  "Artifact Readiness",
  "Contamination Group",
  "Owner Evaluation Vault",
  "Vault Split Manifest",
  "Owner Ergonomic Profile",
  "Instrument Instance",
  "Performance Brief",
  "Arrangement Plan",
]) {
  if (!context.includes("**" + term + "**")) fail("CONTEXT.md lacks current domain term: " + term);
}

const adr0022 = readFileSync(
  path.join(root, "docs/adr/0022-govern-reviewed-knowledge-library.md"),
  "utf8"
);
if (!adr0022.includes("Accepted — Owner approved on 2026-07-13.")) {
  fail("ADR 0022 acceptance is not recorded");
}

const currentClaims = [
  readFileSync(path.join(root, "CONTEXT.md"), "utf8"),
  readFileSync(path.join(root, "README.md"), "utf8"),
  readFileSync(path.join(root, "docs/architecture/arrangement-intelligence-boundaries.md"), "utf8"),
].join("\n");
for (const stale of [
  "historical default sequence",
  "historical default 13-course",
  "ADRs are not Owner-accepted architecture",
]) {
  if (currentClaims.includes(stale)) fail("current documentation retains stale claim: " + stale);
}

const readme = readFileSync(path.join(root, "README.md"), "utf8");
for (const staleLink of [
  "./ALFABETO-SPEC.md",
  "./HISTORICAL-RENDERING-SPEC.md",
  "./HYMNARY-IMPORT-SPEC.md",
  "./TEMPLATE-FILL-SPEC.md",
]) {
  if (readme.includes(staleLink)) fail("README links a historical spec as current: " + staleLink);
}

function verifyLocalMarkdownLinks(file) {
  const absoluteFile = path.join(root, file);
  const markdown = readFileSync(absoluteFile, "utf8");
  const pattern = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(pattern)) {
    let target = match[1].trim();
    if (
      !target ||
      target.startsWith("#") ||
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:")
    ) {
      continue;
    }
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
    target = target.split("#", 1)[0];
    if (!target) continue;
    const resolved = path.resolve(path.dirname(absoluteFile), target);
    if (!existsSync(resolved)) fail(file + " has broken local link: " + match[1]);
  }
}

for (const file of [
  "SPEC.md",
  "README.md",
  ".scratch/README.md",
  "docs/archive/specifications/2026-07-13/README.md",
]) {
  verifyLocalMarkdownLinks(file);
}

const archivedRepository = path.join(root, archiveRoot, "repository");
if (!statSync(archivedRepository).isDirectory())
  fail("historical repository snapshot is not a directory");

const prompt = readFileSync(path.join(root, "src/prompts.ts"), "utf8");
if (prompt.includes("unsupported v2 templates")) {
  fail("system prompt still mislabels maintained templates as unsupported v2 work");
}

console.log(
  "Current specification verified: one active spec, archived predecessors, current domain terms, and intact prototype baseline."
);
