import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "docs/SPEC_RECONCILIATION.md",
  "src/server/lib/omr.ts",
  "src/server/lib/provider-connection.ts",
  "src/server/lib/source-import-service.ts",
  "src/server/lib/owner-store.ts",
  "src/server/lib/lineage-service.ts",
  "src/lib/preservation-policy.ts",
  "src/lib/transformation-report.ts",
  "src/lib/audio-preview.ts",
  "test/e2e/greensleeves-tracer.test.ts",
  "test/e2e/continuo-tracer.test.ts",
  "test/e2e/imitative-counterpoint-tracer.test.ts",
  "test/e2e/lute-diapason-tracer.test.ts",
  "test/e2e/source-import-tracer.test.ts",
];
const missing = required.filter((file) => !existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing specification evidence: ${missing.join(", ")}`);

for (const file of [
  "ALFABETO-SPEC.md",
  "HISTORICAL-RENDERING-SPEC.md",
  "HYMNARY-IMPORT-SPEC.md",
  "TEMPLATE-FILL-SPEC.md",
]) {
  const text = readFileSync(path.join(root, file), "utf8");
  if (!text.includes("Reconciliation (2026-07-11)")) {
    throw new Error(`${file} lacks a current reconciliation banner`);
  }
}

const prompt = readFileSync(path.join(root, "src/prompts.ts"), "utf8");
if (prompt.includes("unsupported v2 templates")) {
  throw new Error("System prompt still mislabels maintained templates as unsupported v2 work");
}

const context = readFileSync(path.join(root, "CONTEXT.md"), "utf8");
for (const term of [
  "Preservation Policy",
  "Personal Default Candidate",
  "Knowledge Candidate",
  "Conservative Regeneration",
  "Policy Drift",
]) {
  if (!context.includes(term)) throw new Error(`CONTEXT.md lost required domain term: ${term}`);
}

console.log(`Specification reconciliation verified (${required.length} evidence families).`);
