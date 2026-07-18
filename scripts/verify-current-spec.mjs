import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const activeWave = ".scratch/mei-editions";
const archiveRoot = "docs/archive/execution-waves/2026-07-17";

function fail(message) {
  throw new Error(`Current specification verification failed: ${message}`);
}

function text(file) {
  return readFileSync(path.join(root, file), "utf8");
}

function requirePaths(paths) {
  const missing = paths.filter((file) => !existsSync(path.join(root, file)));
  if (missing.length) fail(`missing current or historical paths: ${missing.join(", ")}`);
}

requirePaths([
  "SPEC.md",
  "CONTEXT.md",
  "AGENTS.md",
  "README.md",
  ".scratch/README.md",
  "docs/agents/domain.md",
  "docs/agents/issue-tracker.md",
  "docs/adr/0023-prioritize-musical-proofs.md",
  "docs/adr/0024-use-verovio-for-mei-edition-surfaces.md",
  `${activeWave}/README.md`,
  `${activeWave}/PLAN.md`,
  "docs/archive/specifications/2026-07-17-musical-proofs.md",
  "docs/archive/execution-waves/README.md",
  `${archiveRoot}/README.md`,
  `${archiveRoot}/musical-proofs/PLAN.md`,
  `${archiveRoot}/instrument-intelligence/completion-manifest.json`,
  `${archiveRoot}/arrangement-intelligence/completion-manifest.json`,
]);

const spec = text("SPEC.md");
for (const marker of [
  "Status: Current and authoritative next-work specification",
  "This is the only current implementation specification in the repository.",
  "Vellum MEI Editions and Repertoire Intelligence",
  "Diplomatic Tablature Transcription",
  "Interactive Edition Surface",
  "Transcription Acceptance",
  "Interpretation Acceptance",
  "Correction Batch",
  "Passage Selection",
  "Attested Realization",
  "Deferred until demonstrated need",
]) {
  if (!spec.includes(marker)) fail(`SPEC.md lacks marker: ${marker}`);
}

for (const prohibited of [
  "This committed base graph contains 107 stable tracer IDs",
  "satisfies its goal only at **Release Complete**",
  "one-time Owner bootstrap ceremony",
]) {
  if (spec.includes(prohibited)) fail(`SPEC.md retains superseded contract: ${prohibited}`);
}

const adr = text("docs/adr/0024-use-verovio-for-mei-edition-surfaces.md");
if (!adr.includes("Accepted — Owner approved on 2026-07-17")) {
  fail("ADR 0024 is not accepted");
}

const agents = text("AGENTS.md");
for (const marker of [
  "Vellum MEI Editions and Repertoire",
  "The active execution wave is `.scratch/mei-editions`.",
  "Do not reopen `docs/archive/execution-waves/2026-07-17/instrument-intelligence`.",
  "Do not reopen `docs/archive/execution-waves/2026-07-17/musical-proofs`",
  "history is the execution record",
]) {
  if (!agents.includes(marker)) fail(`AGENTS.md lacks current-work marker: ${marker}`);
}

const scratchReadme = text(".scratch/README.md");
if (!scratchReadme.includes("Active implementation wave: [MEI Editions]")) {
  fail(".scratch/README.md does not identify MEI Editions as active");
}
if (!scratchReadme.includes("No historical execution wave lives under `.scratch`")) {
  fail(".scratch/README.md does not exclude historical execution waves");
}
if (!scratchReadme.includes("T01") || !scratchReadme.includes("T05")) {
  fail(".scratch/README.md does not identify the current tracer and Owner gate");
}

const issueDirectory = path.join(root, activeWave, "issues");
const issues = readdirSync(issueDirectory)
  .filter((name) => /^\d{2}-.*\.md$/.test(name))
  .sort();
if (issues.length !== 6) fail(`active wave must have 6 tracers, found ${issues.length}`);
const ids = issues.map((name) => name.slice(0, 2));
const expectedIds = Array.from({ length: 6 }, (_, index) => String(index + 1).padStart(2, "0"));
if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
  fail(`active tracer IDs are not contiguous 01–06: ${ids.join(", ")}`);
}

let hitl = 0;
for (const issue of issues) {
  const body = text(`${activeWave}/issues/${issue}`);
  for (const field of ["Status:", "Type:", "Blocked by:", "## What to", "## Acceptance criteria"]) {
    if (!body.includes(field)) fail(`${issue} lacks ${field}`);
  }
  if (body.includes("Type: HITL")) hitl += 1;
}
if (
  hitl !== 1 ||
  !text(`${activeWave}/issues/05-owner-page9-acceptance.md`).includes("Type: HITL")
) {
  fail("T05 must be the sole HITL tracer");
}

const packageJson = JSON.parse(text("package.json"));
if (packageJson.scripts["plan:instrument-intelligence:trust-bootstrap"]) {
  fail("package.json still exposes the superseded trust bootstrap as active plan tooling");
}
if (packageJson.scripts["spec:verify"].includes("verify-instrument-intelligence-plan")) {
  fail("spec:verify still executes the frozen high-assurance plan verifier");
}

function verifyLocalMarkdownLinks(file) {
  const markdown = text(file);
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
    const resolved = path.resolve(path.dirname(path.join(root, file)), target);
    if (!existsSync(resolved)) fail(`${file} has broken local link: ${match[1]}`);
  }
}

for (const file of [
  "SPEC.md",
  "README.md",
  ".scratch/README.md",
  `${activeWave}/README.md`,
  `${activeWave}/PLAN.md`,
  "docs/archive/execution-waves/README.md",
  `${archiveRoot}/README.md`,
]) {
  verifyLocalMarkdownLinks(file);
}

console.log(
  "Current specification verified: one active MEI Editions spec, six small tracers, one late Owner gate, and prior waves archived."
);
