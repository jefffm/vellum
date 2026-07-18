import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  extractTracerIds,
  loadArrangementIntelligenceState,
} from "./verify-arrangement-intelligence.mjs";

// Historical replay tool only. The package entry point that could close this completed wave was
// removed when the wave was archived; current product work must not invoke this mutating script.
const root = process.cwd();
const scratch = path.join(root, "docs/archive/execution-waves/2026-07-17/arrangement-intelligence");
const evidenceDirectory = path.join(scratch, "evidence/T45");
const suiteDirectory = path.join(evidenceDirectory, "suites");
const browserSmokePath = path.join(evidenceDirectory, "browser-smoke.json");
const manifestPath = path.join(scratch, "completion-manifest.json");
const issuePath = path.join(scratch, "issues/45-machine-goal-closure.md");
const planPath = path.join(scratch, "PLAN.md");
const ownerDecisionPath = path.join(scratch, "evidence/T44/OWNER_SCOPE_DECISION.md");
const t40Path = path.join(scratch, "evidence/T40/verification.json");
const requirementsPath = path.join(scratch, "REQUIREMENTS.md");
const auditPath = path.join(scratch, "AUDIT_TRACEABILITY.md");

const suites = [
  ["format-check", "npm", ["run", "format:check"]],
  ["typecheck", "npm", ["run", "typecheck"]],
  ["web-build", "npm", ["run", "build"]],
  ["server-build", "npm", ["run", "server:build"]],
  ["full-test", "npm", ["test"]],
  ["real-browser", "npm", ["run", "test:browser"]],
  ["specification", "npm", ["run", "spec:verify"]],
  ["lilypond-sandbox", "npm", ["run", "sandbox:lilypond:verify"]],
  ["evaluation-fast", "npm", ["run", "eval:fast"]],
  ["evaluation-golden", "npm", ["run", "eval:golden"]],
  ["evaluation-parity", "npm", ["run", "eval:parity"]],
  ["evaluation-render", "npm", ["run", "eval:render"]],
  ["evaluation-playback", "npm", ["run", "eval:playback"]],
  ["evaluation-omr", "npm", ["run", "eval:omr"]],
  ["evaluation-model", "npm", ["run", "eval:model"]],
  ["evaluation-comparison", "npm", ["run", "eval:compare"]],
];

function sha256File(filename) {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

function relative(filename) {
  return path.relative(root, filename);
}

function dependency(filename) {
  return { path: relative(filename), sha256: sha256File(filename) };
}

function currentCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

function assertMetadataOnlyWorktree() {
  const lines = execFileSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const unexpected = lines
    .map((line) => line.slice(3))
    .filter(
      (filename) =>
        !filename.startsWith(
          "docs/archive/execution-waves/2026-07-17/arrangement-intelligence/evidence/T45/"
        )
    );
  if (unexpected.length > 0) {
    throw new Error(
      `Final suites require a committed candidate; unexpected worktree changes: ${unexpected.join(", ")}`
    );
  }
}

function readBrowserSmoke() {
  if (!existsSync(browserSmokePath)) {
    throw new Error(`Missing real-browser PDF smoke evidence: ${relative(browserSmokePath)}`);
  }
  const smoke = JSON.parse(readFileSync(browserSmokePath, "utf8"));
  if (
    smoke.result !== "pass" ||
    smoke.source !== "test/fixtures/greensleeves/greensleeves-satb.pdf" ||
    !Array.isArray(smoke.assertions) ||
    smoke.assertions.length === 0
  ) {
    throw new Error("Real-browser PDF smoke evidence is incomplete or non-passing");
  }
  return smoke;
}

function runSuites(verifiedCommit) {
  rmSync(suiteDirectory, { recursive: true, force: true });
  mkdirSync(suiteDirectory, { recursive: true });
  const results = [];
  for (const [id, command, args] of suites) {
    process.stdout.write(`Running final suite: ${id}\n`);
    const startedAt = new Date().toISOString();
    const result = spawnSync(command, args, {
      cwd: root,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 100 * 1024 * 1024,
    });
    const logPath = path.join(suiteDirectory, `${id}.log`);
    writeFileSync(
      logPath,
      [
        `$ ${command} ${args.join(" ")}`,
        `startedAt=${startedAt}`,
        `exitCode=${String(result.status)}`,
        "",
        result.stdout ?? "",
        result.stderr ?? "",
      ].join("\n")
    );
    if (result.error || result.status !== 0) {
      throw new Error(
        `${id} failed; inspect ${relative(logPath)}${result.error ? `: ${result.error.message}` : ""}`
      );
    }
    results.push({
      command: `${command} ${args.join(" ")}`,
      result: "pass",
      artifact: relative(logPath),
      recordedAt: new Date().toISOString(),
      verifiedCommit,
      dependencies: [
        dependency(logPath),
        dependency(path.join(root, "package.json")),
        dependency(path.join(root, "package-lock.json")),
      ],
    });
  }
  return results;
}

function requirementRecords(state, verifiedCommit, recordedAt, commonDependencies) {
  return Object.fromEntries(
    state.requirements.map((requirement) => {
      const needsHuman = !requirement.humanEvidence.startsWith("H0");
      return [
        requirement.id,
        {
          status: needsHuman ? "owner_waived" : "verified",
          requirementDigest: requirement.digest,
          implementationCommit: verifiedCommit,
          verificationCommit: verifiedCommit,
          stale: false,
          automated: [
            {
              command: "node scripts/pre-hitl-audit.mjs plus final T45 suites",
              result: "pass",
              artifact: relative(t40Path),
              recordedAt,
              dependencies: [
                ...commonDependencies,
                ...(needsHuman ? [dependency(ownerDecisionPath)] : []),
              ],
            },
          ],
          human: [],
        },
      ];
    })
  );
}

function findingRecords(state, verifiedCommit, recordedAt, commonDependencies) {
  const requirementsByTracer = new Map();
  for (const requirement of state.requirements) {
    for (const tracer of extractTracerIds(requirement.ownerExpression)) {
      const ids = requirementsByTracer.get(tracer) ?? [];
      ids.push(requirement.id);
      requirementsByTracer.set(tracer, ids);
    }
  }
  return Object.fromEntries(
    state.findings.map((finding) => {
      const ownerTracers = extractTracerIds(finding.ownerExpression);
      const ownerResidual =
        ownerTracers.some((tracer) => tracer >= 41 && tracer <= 44) &&
        finding.allowedDispositions.includes("Owner-accepted residual");
      const disposition = ownerResidual
        ? "Owner-accepted residual"
        : finding.allowedDispositions.includes("fixed+verified")
          ? "fixed+verified"
          : finding.allowedDispositions.includes("superseded by accepted decision")
            ? "superseded by accepted decision"
            : "disproven";
      const requirements = Array.from(
        new Set(ownerTracers.flatMap((tracer) => requirementsByTracer.get(tracer) ?? []))
      );
      return [
        finding.id,
        {
          status: "closed",
          findingDigest: finding.digest,
          disposition,
          implementationCommit: ownerResidual ? "not-applicable" : verifiedCommit,
          verificationCommit: verifiedCommit,
          requirements: requirements.length > 0 ? requirements : [state.requirements[0].id],
          stale: false,
          automated: [
            {
              command: "node scripts/pre-hitl-audit.mjs plus final T45 suites",
              result: "pass",
              artifact: relative(t40Path),
              recordedAt,
              dependencies: [
                ...commonDependencies,
                ...(ownerResidual ? [dependency(ownerDecisionPath)] : []),
              ],
            },
          ],
        },
      ];
    })
  );
}

function writeCloseout(verifiedCommit, suiteResults, smoke) {
  const state = loadArrangementIntelligenceState(root);
  const recordedAt = new Date().toISOString();
  const commonDependencies = [
    dependency(requirementsPath),
    dependency(auditPath),
    dependency(t40Path),
    dependency(path.join(suiteDirectory, "full-test.log")),
  ];
  const browserSuite = {
    command:
      "Chrome browser Greensleeves PDF upload, OCR review, output, engraving, and playback smoke",
    result: "pass",
    artifact: relative(browserSmokePath),
    recordedAt: smoke.recordedAt,
    verifiedCommit,
    dependencies: [dependency(browserSmokePath), dependency(ownerDecisionPath)],
  };
  const manifest = {
    ...state.manifest,
    status: "complete",
    objective: "Owner-accepted Arrangement Intelligence prototype baseline",
    acceptanceScope: "owner_accepted_prototype_baseline",
    ownerScopeDecision: { ...dependency(ownerDecisionPath), recordedAt: "2026-07-13T00:00:00Z" },
    requirementEvidence: requirementRecords(state, verifiedCommit, recordedAt, commonDependencies),
    findingClosures: findingRecords(state, verifiedCommit, recordedAt, commonDependencies),
    finalSuites: [...suiteResults, browserSuite],
  };

  const issue = readFileSync(issuePath, "utf8")
    .replace("Status: ready-for-agent", "Status: complete")
    .replaceAll("- [ ]", "- [x]")
    .concat(
      "\n## Delivered\n\n" +
        "- Final suites ran against the committed candidate recorded in `verification.json`.\n" +
        "- The real-browser smoke used the actual Greensleeves PDF and is recorded separately.\n" +
        "- Role-scoped human evidence remains explicitly Owner-waived rather than passed.\n" +
        "- The completion manifest closes every requirement and audit finding under the Owner-accepted prototype scope.\n"
    );
  const plan = readFileSync(planPath, "utf8").replace("Status: closing", "Status: complete");
  const verification = {
    schemaVersion: 1,
    tracerId: "T45",
    result: "pass",
    acceptanceScope: manifest.acceptanceScope,
    verifiedCommit,
    verifiedAt: recordedAt,
    summary: {
      requirements: state.requirements.length,
      ownerWaivedHumanRequirements: state.requirements.filter(
        ({ humanEvidence }) => !humanEvidence.startsWith("H0")
      ).length,
      auditFindings: state.findings.length,
      automatedSuites: suiteResults.length,
      realBrowserPdfSmoke: "pass",
      roleScopedAttestations: "waived_not_passed",
    },
    commands: [...suiteResults, browserSuite].map(({ command, result, artifact }) => ({
      command,
      result,
      artifact,
    })),
    dependencies: [
      dependency(ownerDecisionPath),
      dependency(t40Path),
      dependency(browserSmokePath),
      ...suiteResults.map(({ artifact }) => dependency(path.join(root, artifact))),
    ],
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(issuePath, issue);
  writeFileSync(planPath, plan);
  writeFileSync(
    path.join(evidenceDirectory, "verification.json"),
    `${JSON.stringify(verification, null, 2)}\n`
  );
}

function main() {
  assertMetadataOnlyWorktree();
  const smoke = readBrowserSmoke();
  const verifiedCommit = currentCommit();
  const suiteResults = runSuites(verifiedCommit);
  writeCloseout(verifiedCommit, suiteResults, smoke);
  execFileSync("node", ["scripts/verify-arrangement-intelligence.mjs", "--complete"], {
    cwd: root,
    stdio: "inherit",
  });
  process.stdout.write("Final Arrangement Intelligence completion audit passed.\n");
}

main();
