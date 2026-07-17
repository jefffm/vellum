import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const activeWave = ".scratch/musical-proofs";
const frozenWave = ".scratch/instrument-intelligence";
const archive = "docs/archive/specifications/2026-07-16-high-assurance-program";

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
  `${activeWave}/README.md`,
  `${activeWave}/PLAN.md`,
  `${frozenWave}/PLAN.md`,
  `${frozenWave}/completion-manifest.json`,
  `${archive}/README.md`,
  `${archive}/SPEC.md`,
  ".scratch/arrangement-intelligence/completion-manifest.json",
]);

const spec = text("SPEC.md");
for (const marker of [
  "Status: Current and authoritative next-work specification",
  "This is the only current implementation specification in the repository.",
  "Vellum Musical Proofs",
  "Five-course baroque-guitar proof",
  "Thirteen-course baroque-lute proof",
  "Six-string classical-guitar proof",
  "PDF, review, and output proof",
  "Interaction and versions",
  "Evaluation exists to improve musical output, not to certify the execution process.",
  "Deferred until triggered by evidence",
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

const adr = text("docs/adr/0023-prioritize-musical-proofs.md");
if (!adr.includes("Accepted — Owner approved the aggressive product pivot on 2026-07-16.")) {
  fail("ADR 0023 is not accepted");
}

const agents = text("AGENTS.md");
for (const marker of [
  "The sole current implementation specification is `SPEC.md`: **Vellum Musical Proofs**.",
  "The active execution wave is `.scratch/musical-proofs`.",
  "Do not reopen `.scratch/instrument-intelligence`.",
  "history is the execution record",
]) {
  if (!agents.includes(marker)) fail(`AGENTS.md lacks pivot marker: ${marker}`);
}
for (const stale of [
  "plan:instrument-intelligence:trust-bootstrap",
  "three-ref tuple",
  "strict publication verifier",
]) {
  if (agents.includes(stale)) fail(`AGENTS.md retains active high-assurance instruction: ${stale}`);
}

const scratchReadme = text(".scratch/README.md");
if (!scratchReadme.includes("Active implementation wave: [Musical Proofs]")) {
  fail(".scratch/README.md does not identify Musical Proofs as active");
}
if (!scratchReadme.includes("superseded 107-tracer high-assurance program")) {
  fail("frozen Instrument Intelligence wave is not clearly classified");
}

const issueDirectory = path.join(root, activeWave, "issues");
const issues = readdirSync(issueDirectory)
  .filter((name) => /^\d{2}-.*\.md$/.test(name))
  .sort();
if (issues.length !== 11) fail(`active wave must have 11 tracers, found ${issues.length}`);
const ids = issues.map((name) => name.slice(0, 2));
const expectedIds = Array.from({ length: 11 }, (_, index) => String(index + 1).padStart(2, "0"));
if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
  fail(`active tracer IDs are not contiguous 01–11: ${ids.join(", ")}`);
}

let hitl = 0;
for (const issue of issues) {
  const body = text(`${activeWave}/issues/${issue}`);
  for (const field of ["Status:", "Type:", "Blocked by:", "## What to"]) {
    if (!body.includes(field)) fail(`${issue} lacks ${field}`);
  }
  if (body.includes("Type: HITL")) hitl += 1;
}
if (
  hitl !== 1 ||
  !text(`${activeWave}/issues/10-owner-three-target-playtest.md`).includes("Type: HITL")
) {
  fail("T10 must be the sole HITL tracer");
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
  `${archive}/README.md`,
]) {
  verifyLocalMarkdownLinks(file);
}

console.log(
  "Current specification verified: one active Musical Proofs spec, 11 product tracers, one late HITL boundary, and frozen high-assurance history."
);
