import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIREMENT_ID = /^AI-(PROD|STP|ICC|WPL|EVAL|DEL)-(\d{3})$/;
const FINDING_ID = /^F(\d{3})$/;
const REQUIREMENT_STATUSES = new Set(["implemented", "partial", "absent", "unverified"]);
const ISSUE_STATUSES = new Set([
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "wontfix",
  "in-progress",
  "complete",
]);
const FINAL_DISPOSITIONS = [
  "fixed+verified",
  "disproven",
  "superseded by accepted decision",
  "Owner-accepted residual",
];
const FAMILY_SOURCES = new Map([
  ["PROD", "README.md"],
  ["STP", "source-truth-and-planning.md"],
  ["ICC", "instrument-and-compiler.md"],
  ["WPL", "workbench-playtest-learning.md"],
  ["EVAL", "evaluation-harness.md"],
  ["DEL", "delivery-plan.md"],
]);
const OWNER_ACCEPTED_PROTOTYPE_SCOPE = "owner_accepted_prototype_baseline";
const OWNER_WAIVED_HUMAN_TRACERS = new Set([41, 42, 43]);
const COMPLETION_METADATA_PATHS = [
  ".scratch/arrangement-intelligence/PLAN.md",
  ".scratch/arrangement-intelligence/completion-manifest.json",
  ".scratch/arrangement-intelligence/issues/45-machine-goal-closure.md",
  ".scratch/arrangement-intelligence/evidence/T45/",
];

export class ArrangementIntelligenceVerificationError extends Error {
  constructor(errors) {
    super(`Arrangement Intelligence verification failed:\n- ${errors.join("\n- ")}`);
    this.name = "ArrangementIntelligenceVerificationError";
    this.errors = errors;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function markdownCells(line) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

export function parseRequirementLedger(markdown) {
  const requirements = [];
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    if (!/^\| AI-(?:PROD|STP|ICC|WPL|EVAL|DEL)-\d{3} \|/.test(line)) continue;
    const cells = markdownCells(line);
    requirements.push({
      id: cells[0] ?? "",
      requirement: cells[1] ?? "",
      sourceSection: cells[2] ?? "",
      ownerExpression: cells[3] ?? "",
      gate: cells[4] ?? "",
      machineEvidence: cells[5] ?? "",
      humanEvidence: cells[6] ?? "",
      initialStatus: cells[7] ?? "",
      line: index + 1,
      digest: sha256(cells.join("|")),
    });
  }
  return requirements;
}

export function parseAuditLedger(markdown) {
  const findings = [];
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    if (!/^\| F\d{3}\s+\|/.test(line)) continue;
    const cells = markdownCells(line);
    findings.push({
      id: cells[0] ?? "",
      currentStatus: cells[1] ?? "",
      ownerExpression: cells[2] ?? "",
      verification: cells[3] ?? "",
      allowedDispositions: cells[4] ?? "",
      line: index + 1,
      digest: sha256(cells.join("|")),
    });
  }
  return findings;
}

export function extractTracerIds(expression) {
  const result = new Set();
  const pattern = /T?(\d{1,2})(?:\s*[–-]\s*T?(\d{1,2}))?/g;
  for (const match of expression.matchAll(pattern)) {
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (last < first || last - first > 100) continue;
    for (let id = first; id <= last; id += 1) result.add(id);
  }
  return [...result].sort((a, b) => a - b);
}

function parseField(markdown, label) {
  const match = markdown.match(new RegExp(`^${label}:\\s*(.+?)\\s*$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function parsePlanEntries(markdown) {
  const section = markdown.match(/## Tracer bullets\s+([\s\S]*?)(?=\n## |$)/)?.[1] ?? "";
  return [...section.matchAll(/^(\d+)\.\s+(.+?)\s*$/gm)].map((match) => ({
    id: Number(match[1]),
    title: match[2].replace(/\s+—\s+HITL$/, "").trim(),
  }));
}

function loadIssues(directory) {
  return readdirSync(directory)
    .filter((name) => /^\d{2}-.+\.md$/.test(name))
    .sort()
    .map((name) => {
      const markdown = readFileSync(path.join(directory, name), "utf8");
      return {
        id: Number(name.slice(0, 2)),
        name,
        title: markdown.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() ?? "",
        status: parseField(markdown, "Status"),
        type: parseField(markdown, "Type"),
      };
    });
}

export function loadArrangementIntelligenceState(root = process.cwd()) {
  const manifestPath = path.join(
    root,
    ".scratch/arrangement-intelligence/completion-manifest.json"
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const requirementPath = path.join(root, manifest.requirementsLedger);
  const auditPath = path.join(root, manifest.auditLedger);
  const planPath = path.join(root, manifest.plan);
  const issueDirectory = path.join(root, manifest.issueDirectory);
  const requirementMarkdown = readFileSync(requirementPath, "utf8");
  const auditMarkdown = readFileSync(auditPath, "utf8");
  const planMarkdown = readFileSync(planPath, "utf8");
  return {
    root,
    manifest,
    requirements: parseRequirementLedger(requirementMarkdown),
    findings: parseAuditLedger(auditMarkdown),
    issues: loadIssues(issueDirectory),
    planEntries: parsePlanEntries(planMarkdown),
    requirementMarkdown,
    auditMarkdown,
  };
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function expectedRange(count, prefix = "") {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}${String(index + 1).padStart(3, "0")}`
  );
}

function checkExactIds(errors, label, actual, expected) {
  const actualSet = new Set(actual);
  const missing = expected.filter((id) => !actualSet.has(id));
  const extra = actual.filter((id) => !expected.includes(id));
  const repeated = duplicates(actual);
  if (missing.length) errors.push(`${label} missing: ${missing.join(", ")}`);
  if (extra.length) errors.push(`${label} unexpected: ${extra.join(", ")}`);
  if (repeated.length) errors.push(`${label} duplicated: ${repeated.join(", ")}`);
}

export function validatePlanningState(state) {
  const errors = [];
  const { manifest, requirements, findings, issues, planEntries, auditMarkdown } = state;

  if (manifest.schemaVersion !== 1) errors.push("completion manifest schemaVersion must be 1");
  if (!["in_progress", "complete"].includes(manifest.status)) {
    errors.push("completion manifest status must be in_progress or complete");
  }
  if (!Number.isInteger(manifest.tracerCount) || manifest.tracerCount < 1) {
    errors.push("completion manifest tracerCount must be a positive integer");
  }
  if (auditMarkdown.includes("__")) errors.push("audit ledger contains renumbering placeholders");

  checkExactIds(
    errors,
    "plan tracer IDs",
    planEntries.map(({ id }) => String(id).padStart(3, "0")),
    expectedRange(manifest.tracerCount)
  );
  checkExactIds(
    errors,
    "issue tracer IDs",
    issues.map(({ id }) => String(id).padStart(3, "0")),
    expectedRange(manifest.tracerCount)
  );

  const planById = new Map(planEntries.map((entry) => [entry.id, entry]));
  for (const issue of issues) {
    if (!ISSUE_STATUSES.has(issue.status)) {
      errors.push(`T${String(issue.id).padStart(2, "0")} has invalid status ${issue.status}`);
    }
    const shouldBeHuman = manifest.humanTracerIds.includes(issue.id);
    if (issue.type !== (shouldBeHuman ? "HITL" : "AFK")) {
      errors.push(
        `T${String(issue.id).padStart(2, "0")} must be ${shouldBeHuman ? "HITL" : "AFK"}`
      );
    }
    if (planById.get(issue.id)?.title !== issue.title) {
      errors.push(`T${String(issue.id).padStart(2, "0")} plan and issue titles differ`);
    }
  }

  if (!requirements.length) errors.push("requirement ledger contains no atomic requirements");
  const requirementIds = requirements.map(({ id }) => id);
  const repeatedRequirements = duplicates(requirementIds);
  if (repeatedRequirements.length) {
    errors.push(`requirement IDs duplicated: ${repeatedRequirements.join(", ")}`);
  }

  for (const [family, source] of FAMILY_SOURCES) {
    const members = requirements
      .filter(({ id }) => id.startsWith(`AI-${family}-`))
      .sort((left, right) => left.id.localeCompare(right.id));
    if (!members.length) {
      errors.push(`requirement family AI-${family} has no rows for ${source}`);
      continue;
    }
    const expected = expectedRange(members.length, `AI-${family}-`);
    checkExactIds(
      errors,
      `AI-${family} requirement IDs`,
      members.map(({ id }) => id),
      expected
    );
  }

  for (const requirement of requirements) {
    const match = requirement.id.match(REQUIREMENT_ID);
    if (!match) errors.push(`invalid requirement ID ${requirement.id} at line ${requirement.line}`);
    if (!requirement.requirement || !requirement.sourceSection) {
      errors.push(`${requirement.id} lacks atomic text or source section`);
    }
    const owners = extractTracerIds(requirement.ownerExpression);
    if (!owners.length || owners.some((id) => id < 1 || id > manifest.tracerCount)) {
      errors.push(`${requirement.id} has invalid owner tracers: ${requirement.ownerExpression}`);
    }
    if (!/^G\d+$/.test(requirement.gate))
      errors.push(`${requirement.id} has invalid gate ${requirement.gate}`);
    if (!/^M\d{2}/.test(requirement.machineEvidence)) {
      errors.push(`${requirement.id} lacks a machine-evidence family`);
    }
    if (!/^H\d+/.test(requirement.humanEvidence)) {
      errors.push(`${requirement.id} lacks a human-evidence classification`);
    }
    if (!REQUIREMENT_STATUSES.has(requirement.initialStatus)) {
      errors.push(`${requirement.id} has invalid initial status ${requirement.initialStatus}`);
    }
  }

  checkExactIds(
    errors,
    "audit finding IDs",
    findings.map(({ id }) => id),
    expectedRange(47, "F")
  );
  for (const finding of findings) {
    if (!FINDING_ID.test(finding.id)) errors.push(`invalid finding ID ${finding.id}`);
    const owners = extractTracerIds(finding.ownerExpression);
    if (!owners.length || owners.some((id) => id < 1 || id > manifest.tracerCount)) {
      errors.push(`${finding.id} has invalid owner tracers: ${finding.ownerExpression}`);
    }
    if (!finding.currentStatus.includes("Open")) {
      errors.push(`${finding.id} initial audit status must remain explicitly open`);
    }
    if (!finding.verification) errors.push(`${finding.id} has no verification obligation`);
    if (!FINAL_DISPOSITIONS.some((value) => finding.allowedDispositions.includes(value))) {
      errors.push(`${finding.id} has no recognized allowed final disposition`);
    }
  }

  const requirementKeys = Object.keys(manifest.requirementEvidence ?? {});
  const findingKeys = Object.keys(manifest.findingClosures ?? {});
  for (const id of requirementKeys) {
    if (!requirementIds.includes(id)) errors.push(`manifest references unknown requirement ${id}`);
  }
  for (const id of findingKeys) {
    if (!findings.some((finding) => finding.id === id)) {
      errors.push(`manifest references unknown finding ${id}`);
    }
  }

  return errors;
}

function validCommit(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function validateDependencies(root, dependencies, label, errors) {
  if (!Array.isArray(dependencies) || dependencies.length === 0) {
    errors.push(`${label} has no staleness dependencies`);
    return;
  }
  const realRoot = realpathSync(root);
  for (const dependency of dependencies) {
    if (
      !dependency ||
      typeof dependency.path !== "string" ||
      !/^[0-9a-f]{64}$/.test(dependency.sha256 ?? "")
    ) {
      errors.push(`${label} has an invalid dependency record`);
      continue;
    }
    const candidate = path.resolve(root, dependency.path);
    if (!existsSync(candidate) || !statSync(candidate).isFile()) {
      errors.push(`${label} dependency does not exist: ${dependency.path}`);
      continue;
    }
    const realCandidate = realpathSync(candidate);
    if (realCandidate !== realRoot && !realCandidate.startsWith(`${realRoot}${path.sep}`)) {
      errors.push(`${label} dependency escapes the repository: ${dependency.path}`);
      continue;
    }
    const actual = sha256(readFileSync(realCandidate));
    if (actual !== dependency.sha256)
      errors.push(`${label} has stale dependency ${dependency.path}`);
  }
}

export function validateRequirementEvidence(root, requirement, record, ownerScopeDecision) {
  const errors = [];
  const label = requirement.id;
  const needsHuman = !requirement.humanEvidence.startsWith("H0");
  const ownerWaived = record?.status === "owner_waived";
  if (!record || !["verified", "owner_waived"].includes(record.status)) {
    errors.push(`${label} is neither verified nor explicitly Owner-waived`);
  }
  if (ownerWaived && !needsHuman) {
    errors.push(`${label} cannot waive a machine-only requirement`);
  }
  if (ownerWaived && !ownerScopeDecision) {
    errors.push(`${label} lacks the Owner scope decision required for a waiver`);
  }
  if (record?.requirementDigest !== requirement.digest)
    errors.push(`${label} evidence targets a stale requirement`);
  if (!validCommit(record?.implementationCommit))
    errors.push(`${label} lacks an implementation commit`);
  if (!validCommit(record?.verificationCommit)) errors.push(`${label} lacks a verification commit`);
  if (record?.stale === true) errors.push(`${label} is explicitly stale`);
  if (!Array.isArray(record?.automated) || record.automated.length === 0) {
    errors.push(`${label} has no automated evidence`);
  } else {
    for (const [index, evidence] of record.automated.entries()) {
      const evidenceLabel = `${label} automated evidence ${index + 1}`;
      if (
        !evidence.command ||
        evidence.result !== "pass" ||
        !evidence.artifact ||
        !evidence.recordedAt
      ) {
        errors.push(`${evidenceLabel} is incomplete or non-passing`);
      }
      validateDependencies(root, evidence.dependencies, evidenceLabel, errors);
    }
  }
  if (needsHuman && !ownerWaived && (!Array.isArray(record?.human) || record.human.length === 0)) {
    errors.push(`${label} is missing mandatory human evidence`);
  }
  for (const [index, evidence] of (record?.human ?? []).entries()) {
    const evidenceLabel = `${label} human evidence ${index + 1}`;
    const required = [
      "artifact",
      "fixture",
      "implementationCommit",
      "instrument",
      "protocol",
      "reviewerRole",
      "result",
      "confidence",
      "rationale",
      "recordedAt",
    ];
    if (required.some((field) => !evidence[field]) || evidence.result !== "pass") {
      errors.push(`${evidenceLabel} is incomplete or non-passing`);
    }
    if (!validCommit(evidence.implementationCommit)) {
      errors.push(`${evidenceLabel} lacks a valid implementation commit`);
    }
    validateDependencies(root, evidence.dependencies, evidenceLabel, errors);
  }
  return errors;
}

function validateFindingClosure(root, finding, record) {
  const errors = [];
  const label = finding.id;
  if (!record || record.status !== "closed") errors.push(`${label} is not closed`);
  if (record?.findingDigest !== finding.digest)
    errors.push(`${label} closure targets a stale finding`);
  if (!FINAL_DISPOSITIONS.includes(record?.disposition))
    errors.push(`${label} has an invalid disposition`);
  if (record?.disposition && !finding.allowedDispositions.includes(record.disposition)) {
    errors.push(`${label} disposition is not allowed by its ledger row`);
  }
  if (
    !validCommit(record?.implementationCommit) &&
    record?.implementationCommit !== "not-applicable"
  ) {
    errors.push(`${label} lacks an implementation commit or explicit not-applicable marker`);
  }
  if (!validCommit(record?.verificationCommit)) errors.push(`${label} lacks a verification commit`);
  if (!Array.isArray(record?.requirements) || record.requirements.length === 0) {
    errors.push(`${label} is not mapped to stable requirements`);
  }
  if (!Array.isArray(record?.automated) || record.automated.length === 0) {
    errors.push(`${label} has no automated closure evidence`);
  }
  for (const [index, evidence] of (record?.automated ?? []).entries()) {
    const evidenceLabel = `${label} automated evidence ${index + 1}`;
    if (
      !evidence.command ||
      evidence.result !== "pass" ||
      !evidence.artifact ||
      !evidence.recordedAt
    ) {
      errors.push(`${evidenceLabel} is incomplete or non-passing`);
    }
    validateDependencies(root, evidence.dependencies, evidenceLabel, errors);
  }
  if (record?.stale === true) errors.push(`${label} is explicitly stale`);
  return errors;
}

function repositoryHead(root) {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

function verifiedCommitCoversHead(root, verifiedCommit, head) {
  if (verifiedCommit === head) return { covered: true, unexpectedPaths: [] };
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", verifiedCommit, head], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    return { covered: false, unexpectedPaths: [] };
  }
  const paths = execFileSync("git", ["diff", "--name-only", `${verifiedCommit}..${head}`], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const unexpectedPaths = paths.filter(
    (candidate) =>
      !COMPLETION_METADATA_PATHS.some((allowed) =>
        allowed.endsWith("/") ? candidate.startsWith(allowed) : candidate === allowed
      )
  );
  return { covered: unexpectedPaths.length === 0, unexpectedPaths };
}

export function validateCompletionState(state) {
  const errors = validatePlanningState(state);
  const { root, manifest, requirements, findings, issues } = state;
  if (manifest.status !== "complete") errors.push("completion manifest is not marked complete");
  const ownerAcceptedPrototype = manifest.acceptanceScope === OWNER_ACCEPTED_PROTOTYPE_SCOPE;
  if (!ownerAcceptedPrototype) {
    errors.push("completion manifest lacks the Owner-accepted prototype scope");
  }
  if (!manifest.ownerScopeDecision?.recordedAt) {
    errors.push("completion manifest lacks a dated Owner scope decision");
  }
  validateDependencies(
    root,
    manifest.ownerScopeDecision ? [manifest.ownerScopeDecision] : [],
    "Owner scope decision",
    errors
  );
  for (const issue of issues) {
    const explicitlyWaived =
      ownerAcceptedPrototype &&
      OWNER_WAIVED_HUMAN_TRACERS.has(issue.id) &&
      issue.status === "wontfix";
    if (issue.status !== "complete" && !explicitlyWaived) {
      errors.push(`T${String(issue.id).padStart(2, "0")} is not complete`);
    }
  }

  const requirementEvidence = manifest.requirementEvidence ?? {};
  const findingClosures = manifest.findingClosures ?? {};
  checkExactIds(
    errors,
    "completion requirement evidence",
    Object.keys(requirementEvidence),
    requirements.map(({ id }) => id)
  );
  checkExactIds(
    errors,
    "completion finding closures",
    Object.keys(findingClosures),
    findings.map(({ id }) => id)
  );
  for (const requirement of requirements) {
    errors.push(
      ...validateRequirementEvidence(
        root,
        requirement,
        requirementEvidence[requirement.id],
        manifest.ownerScopeDecision
      )
    );
  }
  const knownRequirements = new Set(requirements.map(({ id }) => id));
  for (const finding of findings) {
    const closure = findingClosures[finding.id];
    errors.push(...validateFindingClosure(root, finding, closure));
    for (const id of closure?.requirements ?? []) {
      if (!knownRequirements.has(id))
        errors.push(`${finding.id} closure references unknown requirement ${id}`);
    }
  }

  const head = repositoryHead(root);
  if (!Array.isArray(manifest.finalSuites) || manifest.finalSuites.length === 0) {
    errors.push("completion manifest has no final-commit suites");
  }
  for (const [index, suite] of (manifest.finalSuites ?? []).entries()) {
    const label = `final suite ${index + 1}`;
    if (!suite.command || suite.result !== "pass" || !suite.artifact || !suite.recordedAt) {
      errors.push(`${label} is incomplete or non-passing`);
    }
    const coverage = verifiedCommitCoversHead(root, suite.verifiedCommit, head);
    if (!coverage.covered) {
      errors.push(
        coverage.unexpectedPaths.length
          ? `${label} predates non-metadata changes: ${coverage.unexpectedPaths.join(", ")}`
          : `${label} was not run against repository HEAD or its metadata-only ancestor`
      );
    }
    validateDependencies(root, suite.dependencies, label, errors);
  }
  return errors;
}

export function assertArrangementIntelligence(mode = "plan", root = process.cwd()) {
  const state = loadArrangementIntelligenceState(root);
  const errors =
    mode === "complete" ? validateCompletionState(state) : validatePlanningState(state);
  if (errors.length) throw new ArrangementIntelligenceVerificationError(errors);
  return {
    requirements: state.requirements.length,
    findings: state.findings.length,
    tracers: state.issues.length,
    mode,
  };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  const mode = process.argv.includes("--complete") ? "complete" : "plan";
  try {
    const result = assertArrangementIntelligence(mode);
    console.log(
      `Arrangement Intelligence ${result.mode} verified (${result.requirements} requirements, ${result.findings} findings, ${result.tracers} tracers).`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
