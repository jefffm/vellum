#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCanonicalClauseLedgerJson,
  assertMarkerBijection,
  buildClauseLedger,
  canonicalClauseLedgerJson,
  loadClauseLedgerInputs,
  planMissingFamilyIssueMappings,
  reconcileRequirementTracerMappings,
  renderMarkedSpecCandidate,
} from "./lib/instrument-intelligence-clause-ledger.mjs";

const rootDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ledgerPath = resolve(rootDirectory, ".scratch/instrument-intelligence/clause-ledger.json");

function migratePrereleaseLedger(value) {
  if (!value?.clauses?.some((clause) => clause.dependencyDigest === undefined)) return value;
  return {
    ...value,
    clauses: value.clauses.map((clause) => ({
      ...clause,
      dependencyDigest:
        clause.dependencyDigest ??
        createHash("sha256")
          .update(JSON.stringify(clause.dependencies ?? []))
          .digest("hex"),
    })),
  };
}

function usage() {
  console.error(
    "Usage: node scripts/generate-instrument-intelligence-clause-ledger.mjs " +
      "[--bootstrap-markers <output-spec>] [--apply-bootstrap-markers] " +
      "[--rebuild-bootstrap-markers] [--reconcile-requirements] [--write] [--verify]"
  );
  process.exitCode = 2;
}

const args = process.argv.slice(2);
let mode = "verify";
let markedSpecOutput = null;
if (args.length === 1 && args[0] === "--write") mode = "write";
else if (args.length === 1 && args[0] === "--verify") mode = "verify";
else if (args.length === 1 && args[0] === "--reconcile-requirements") mode = "reconcile";
else if (args.length === 1 && args[0] === "--apply-bootstrap-markers") mode = "apply-bootstrap";
else if (args.length === 1 && args[0] === "--rebuild-bootstrap-markers") mode = "rebuild-bootstrap";
else if (args.length === 2 && args[0] === "--bootstrap-markers") {
  mode = "bootstrap";
  markedSpecOutput = resolve(process.cwd(), args[1]);
} else if (args.length !== 0) {
  usage();
  process.exit(2);
}

const inputs = loadClauseLedgerInputs(rootDirectory);
if (mode === "reconcile") {
  const issueUpdates = planMissingFamilyIssueMappings(
    inputs.requirementsMarkdown,
    inputs.issueDirectory
  );
  for (const update of issueUpdates) writeFileSync(update.path, update.after);
  const refreshed = loadClauseLedgerInputs(rootDirectory);
  const reconciled = reconcileRequirementTracerMappings(
    refreshed.requirementsMarkdown,
    refreshed.issueDirectory
  );
  writeFileSync(
    resolve(rootDirectory, ".scratch/instrument-intelligence/REQUIREMENTS.md"),
    reconciled
  );
  console.log(`Added missing reverse family mappings to ${issueUpdates.length} issue headers:`);
  for (const update of issueUpdates)
    console.log(`- ${update.relativePath}: ${update.additions.join(", ")}`);
  console.log("Reconciled every REQUIREMENTS family/tracer column from issue headers");
} else if (mode === "apply-bootstrap" || mode === "rebuild-bootstrap") {
  if (/<!--\s*II-CLAUSE-\d{4}\s*-->/.test(inputs.specMarkdown)) {
    if (mode !== "rebuild-bootstrap") {
      throw new Error("SPEC already contains clause markers; use --write or --verify");
    }
    writeFileSync(
      resolve(rootDirectory, "SPEC.md"),
      inputs.specMarkdown.replace(/<!--\s*II-CLAUSE-\d{4}\s*-->\s*/g, "")
    );
  }
  const unmarkedInputs = loadClauseLedgerInputs(rootDirectory);
  const bootstrapLedger = buildClauseLedger({
    ...unmarkedInputs,
    previousLedger: null,
    requireMarkers: false,
  });
  const markedSpec = renderMarkedSpecCandidate(unmarkedInputs.specMarkdown, bootstrapLedger);
  writeFileSync(resolve(rootDirectory, "SPEC.md"), markedSpec);
  const markedInputs = loadClauseLedgerInputs(rootDirectory);
  const markedLedger = buildClauseLedger({
    ...markedInputs,
    previousLedger: bootstrapLedger,
    requireMarkers: true,
  });
  writeFileSync(ledgerPath, canonicalClauseLedgerJson(markedLedger));
  console.log(`Applied and verified ${markedLedger.clauses.length} stable SPEC clause markers`);
} else if (mode === "bootstrap") {
  const previousLedger = existsSync(ledgerPath)
    ? migratePrereleaseLedger(JSON.parse(readFileSync(ledgerPath, "utf8")))
    : null;
  const ledger = buildClauseLedger({ ...inputs, previousLedger, requireMarkers: false });
  const markedSpec = renderMarkedSpecCandidate(inputs.specMarkdown, ledger);
  writeFileSync(ledgerPath, canonicalClauseLedgerJson(ledger));
  writeFileSync(markedSpecOutput, markedSpec);
  console.log(`Wrote ${ledger.clauses.length} clauses to ${ledgerPath}`);
  console.log(`Wrote marked SPEC candidate to ${markedSpecOutput}`);
} else if (mode === "write") {
  const previousLedger = existsSync(ledgerPath)
    ? migratePrereleaseLedger(JSON.parse(readFileSync(ledgerPath, "utf8")))
    : null;
  const ledger = buildClauseLedger({ ...inputs, previousLedger, requireMarkers: true });
  writeFileSync(ledgerPath, canonicalClauseLedgerJson(ledger));
  assertMarkerBijection(inputs.specMarkdown, ledger);
  console.log(`Wrote ${ledger.clauses.length} marked clauses to ${ledgerPath}`);
} else {
  if (!existsSync(ledgerPath)) throw new Error(`Missing clause ledger: ${ledgerPath}`);
  const raw = readFileSync(ledgerPath, "utf8");
  const committed = assertCanonicalClauseLedgerJson(raw);
  const generated = buildClauseLedger({
    ...inputs,
    previousLedger: committed,
    requireMarkers: true,
  });
  const expected = canonicalClauseLedgerJson(generated);
  if (raw !== expected) throw new Error("Committed clause ledger is stale; run with --write");
  assertMarkerBijection(inputs.specMarkdown, committed);
  console.log(`Verified ${committed.clauses.length} marked SPEC clauses and closed ledger records`);
}
