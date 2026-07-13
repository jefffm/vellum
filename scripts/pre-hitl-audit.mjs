import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function runPreHitlAudit(projectRoot) {
  const scratch = path.join(projectRoot, ".scratch/arrangement-intelligence");
  const requirements = parseTableRows(
    readFileSync(path.join(scratch, "REQUIREMENTS.md"), "utf8"),
    /^AI-/
  ).map((cells) => ({
    id: cells[0],
    statement: cells[1],
    tracers: cells[3],
    human: cells[6],
    ledgerStatus: cells[7],
  }));
  const machineRequirementGaps = requirements
    .filter(({ id }) => id !== "AI-DEL-066")
    .filter(({ human, ledgerStatus }) => /^H0\b/.test(human) && ledgerStatus !== "implemented")
    .map(({ id, ledgerStatus }) => ({ id, ledgerStatus }));
  const requirementDispositions = requirements.map((requirement) => ({
    id: requirement.id,
    disposition:
      requirement.id === "AI-DEL-066"
        ? "satisfied_by_this_audit"
        : !/^H0\b/.test(requirement.human)
          ? "awaiting_scheduled_HITL"
          : requirement.ledgerStatus === "implemented"
            ? "machine_verified"
            : "missing_machine_evidence",
    tracers: requirement.tracers,
    human: requirement.human,
  }));

  const tracerResults = [];
  for (let number = 1; number <= 39; number += 1) {
    const id = `T${String(number).padStart(2, "0")}`;
    const evidencePath = path.join(scratch, "evidence", id, "verification.json");
    const issuePath = findIssue(scratch, number);
    const evidence = existsSync(evidencePath)
      ? JSON.parse(readFileSync(evidencePath, "utf8"))
      : undefined;
    const issue = issuePath ? readFileSync(issuePath, "utf8") : "";
    tracerResults.push({
      id,
      evidencePath: path.relative(projectRoot, evidencePath),
      evidenceResult: evidence?.result ?? "missing",
      issuePath: issuePath ? path.relative(projectRoot, issuePath) : null,
      issueStatus: issue.match(/^Status:\s*(.+)$/m)?.[1] ?? "missing",
    });
  }
  const tracerGaps = tracerResults.filter(
    ({ evidenceResult, issueStatus }) => evidenceResult !== "pass" || issueStatus !== "complete"
  );

  const audit = readFileSync(path.join(scratch, "AUDIT_TRACEABILITY.md"), "utf8");
  const findings = parseTableRows(audit, /^F\d{3}$/).map((cells) => ({
    id: cells[0],
    owners: cells[2],
    preHitlDisposition: /T4[1-4]/.test(cells[2])
      ? "machine_evidence_current_human_evidence_scheduled"
      : "machine_evidence_current",
  }));
  const findingGaps = findings.filter(({ owners }) => !/T\d/.test(owners));

  const failures = [
    ...machineRequirementGaps.map(({ id }) => `machine requirement ${id} is not implemented`),
    ...tracerGaps.map(
      ({ id, evidenceResult, issueStatus }) =>
        `${id} has evidence=${evidenceResult}, issue=${issueStatus}`
    ),
    ...findingGaps.map(({ id }) => `${id} has no owning tracer`),
  ];
  return {
    schemaVersion: 1,
    kind: "pre_hitl_completion_audit",
    result: failures.length === 0 ? "pass" : "fail",
    counts: {
      requirements: requirements.length,
      machineRequirementGaps: machineRequirementGaps.length,
      awaitingScheduledHitl: requirementDispositions.filter(
        ({ disposition }) => disposition === "awaiting_scheduled_HITL"
      ).length,
      completedAfkTracers: tracerResults.length - tracerGaps.length,
      findings: findings.length,
      unmappedFindings: findingGaps.length,
    },
    failures,
    machineRequirementGaps,
    requirementDispositions,
    tracerResults,
    findings,
  };
}

function parseTableRows(document, idPattern) {
  return document
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim())
    )
    .filter((cells) => idPattern.test(cells[0] ?? ""));
}

function findIssue(scratch, number) {
  const prefix = `${String(number).padStart(2, "0")}-`;
  const filename = readdirSync(path.join(scratch, "issues")).find((item) =>
    item.startsWith(prefix)
  );
  return filename ? path.join(scratch, "issues", filename) : undefined;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = runPreHitlAudit(process.cwd());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.result !== "pass") process.exitCode = 1;
}
