import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertAcyclicClauseDependencies,
  assertBidirectionalFamilyTracerMapping,
  assertCanonicalClauseLedgerJson,
  assertDerivedClauseDependencies,
  assertMarkerBijection,
  buildClauseLedger,
  canonicalClauseLedgerJson,
  deriveClauseDependencies,
  digestClauseText,
  extractSpecClauses,
  loadClauseLedgerInputs,
  normalizeClauseText,
  parseIssueFamilyMappings,
  parseRequirementFamilies,
  parseTracerExpression,
  renderMarkedSpecCandidate,
  validateClosedClauseLedger,
} from "../../scripts/lib/instrument-intelligence-clause-ledger.mjs";

const temporaryDirectories: string[] = [];

function issueDirectory(files: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), "vellum-clause-ledger-"));
  temporaryDirectories.push(directory);
  for (const [name, contents] of Object.entries(files))
    writeFileSync(
      join(directory, name),
      contents.includes("## Blocked by")
        ? contents
        : `${contents.trimEnd()}\n\n## Blocked by\n\nNone - can start immediately.\n`
    );
  return directory;
}

function authoritySpec(statement = "This specification is authoritative.") {
  return [
    "# Fixture",
    "",
    "## Authority and reading order",
    "",
    statement,
    "",
    "## Research questions that do not block the substrate",
    "",
    "Excluded.",
    "",
  ].join("\n");
}

const authorityRequirements = [
  "# Requirements",
  "",
  "| ID | Requirement area | Evidence-producing tracer(s) | Initial status |",
  "| --- | --- | --- | --- |",
  "| II-AUTH-001 | Sole current authority | 01, 35 | planned |",
  "",
].join("\n");

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("Instrument Intelligence clause ledger", () => {
  it("normalizes whitespace and hashes normalized text", () => {
    expect(normalizeClauseText(" -  A   stable\n clause. ")).toBe("A stable clause.");
    expect(digestClauseText("A stable clause.")).toBe(digestClauseText("  A   stable clause.  "));
    expect(digestClauseText("A changed clause.")).not.toBe(digestClauseText("A stable clause."));
  });

  it("extracts only the bounded substantive SPEC region with heading/ordinal locators", () => {
    const spec = authoritySpec("First statement.\n\nSecond statement.");
    const clauses = extractSpecClauses(spec);
    expect(clauses.map((clause) => clause.normalizedText)).toEqual([
      "First statement.",
      "Second statement.",
    ]);
    expect(clauses.map((clause) => clause.source.statementOrdinal)).toEqual([1, 2]);
    expect(clauses.every((clause) => clause.classification === "normative")).toBe(true);
  });

  it("expands canonical tracer ranges and rejects malformed tokens", () => {
    expect(parseTracerExpression("01–03, 07, dynamic-remediation")).toEqual([
      "T01",
      "T02",
      "T03",
      "T07",
      "dynamic-remediation",
    ]);
    expect(() => parseTracerExpression("T03–T01")).toThrow(/Descending tracer range/);
    expect(() => parseTracerExpression("all")).toThrow(/Malformed tracer/);
  });

  it("requires issue and ledger family/tracer edges to be bidirectional", () => {
    const families = parseRequirementFamilies(authorityRequirements);
    const issues = parseIssueFamilyMappings(
      issueDirectory({
        "01-authority.md": "Requirement families touched: II-AUTH-001\n",
        "35-evidence.md": "Requirement families touched: II-AUTH-001\n",
      })
    );
    expect([
      ...assertBidirectionalFamilyTracerMapping(families, issues).get("II-AUTH-001")!,
    ]).toEqual(["T01", "T35"]);

    const unknown = parseIssueFamilyMappings(
      issueDirectory({
        "01-authority.md": "Requirement families touched: II-UNKNOWN-001\n",
        "35-evidence.md": "Requirement families touched: II-AUTH-001\n",
      })
    );
    expect(() => assertBidirectionalFamilyTracerMapping(families, unknown)).toThrow(
      /unknown family/
    );
  });

  it("derives each non-root clause dependency from all clauses owned by direct blockers", () => {
    const issues = parseIssueFamilyMappings(
      issueDirectory({
        "01-root.md": [
          "Requirement families touched: II-AUTH-001",
          "",
          "## Blocked by",
          "",
          "None - can start immediately.",
        ].join("\n"),
        "02-middle.md": [
          "Requirement families touched: II-AUTH-001",
          "",
          "## Blocked by",
          "",
          "- 01",
        ].join("\n"),
        "03-leaf.md": [
          "Requirement families touched: II-AUTH-001",
          "",
          "## Blocked by",
          "",
          "- 02",
        ].join("\n"),
      })
    );
    const clauses = [
      { id: "II-CLAUSE-0001", implementationOwner: "T01", dependencies: [] },
      { id: "II-CLAUSE-0002", implementationOwner: "T02", dependencies: [] },
      { id: "II-CLAUSE-0003", implementationOwner: "T02", dependencies: [] },
      { id: "II-CLAUSE-0004", implementationOwner: "T03", dependencies: [] },
    ];
    const derived = deriveClauseDependencies(clauses, issues);
    expect(derived.get("II-CLAUSE-0001")).toEqual([]);
    expect(derived.get("II-CLAUSE-0002")).toEqual(["II-CLAUSE-0001"]);
    expect(derived.get("II-CLAUSE-0003")).toEqual(["II-CLAUSE-0001"]);
    expect(derived.get("II-CLAUSE-0004")).toEqual(["II-CLAUSE-0002", "II-CLAUSE-0003"]);

    const bound = {
      clauses: clauses.map((clause) => ({
        ...clause,
        dependencies: derived.get(clause.id),
      })),
    };
    expect(() => assertDerivedClauseDependencies(bound, issues)).not.toThrow();
    bound.clauses[3].dependencies = [];
    expect(() => assertDerivedClauseDependencies(bound, issues)).toThrow(/direct blockers/);
  });

  it("rejects issue-blocker and clause-dependency cycles", () => {
    expect(() =>
      parseIssueFamilyMappings(
        issueDirectory({
          "01-first.md": [
            "Requirement families touched: II-AUTH-001",
            "",
            "## Blocked by",
            "",
            "- 02",
          ].join("\n"),
          "02-second.md": [
            "Requirement families touched: II-AUTH-001",
            "",
            "## Blocked by",
            "",
            "- 01",
          ].join("\n"),
        })
      )
    ).toThrow(/blocker graph contains a cycle/);
    expect(() =>
      assertAcyclicClauseDependencies([
        { id: "II-CLAUSE-0001", dependencies: ["II-CLAUSE-0002"] },
        { id: "II-CLAUSE-0002", dependencies: ["II-CLAUSE-0001"] },
      ])
    ).toThrow(/dependency graph contains a cycle/);
  });

  it("generates stable append-only IDs and a one-to-one marked SPEC candidate", () => {
    const issues = issueDirectory({
      "01-authority.md": "Requirement families touched: II-AUTH-001\n",
      "35-evidence.md": "Requirement families touched: II-AUTH-001\n",
    });
    const initial = buildClauseLedger({
      specMarkdown: authoritySpec(),
      requirementsMarkdown: authorityRequirements,
      issueDirectory: issues,
    });
    expect(initial.clauses.map((clause) => clause.id)).toEqual(["II-CLAUSE-0001"]);

    const marked = renderMarkedSpecCandidate(authoritySpec(), initial);
    expect(marked).toContain("<!-- II-CLAUSE-0001 --> This specification is authoritative.");
    assertMarkerBijection(marked, initial);

    const regenerated = buildClauseLedger({
      specMarkdown: marked,
      requirementsMarkdown: authorityRequirements,
      issueDirectory: issues,
      previousLedger: initial,
      requireMarkers: true,
    });
    expect(regenerated.clauses[0].id).toBe("II-CLAUSE-0001");
    expect(regenerated.clauses[0].closureVerifier).toBe("T85");
    expect(regenerated.clauses[0].evidenceContributors).not.toContain("T85");
    expect(regenerated.clauses[0].evidenceContributors).toEqual(["T35"]);

    const insertedBefore = marked.replace(
      "<!-- II-CLAUSE-0001 -->",
      "<!-- II-CLAUSE-0002 --> A newly appended requirement.\n\n<!-- II-CLAUSE-0001 -->"
    );
    const withInsertedClause = buildClauseLedger({
      specMarkdown: insertedBefore,
      requirementsMarkdown: authorityRequirements,
      issueDirectory: issues,
      previousLedger: regenerated,
      requireMarkers: true,
    });
    expect(withInsertedClause.clauses.map((clause) => clause.id)).toEqual([
      "II-CLAUSE-0001",
      "II-CLAUSE-0002",
    ]);
    expect(
      withInsertedClause.clauses.find((clause) => clause.id === "II-CLAUSE-0001")?.normalizedText
    ).toBe("This specification is authoritative.");
  });

  it("fails closed for missing, duplicate, or text-divergent markers", () => {
    const issues = issueDirectory({
      "01-authority.md": "Requirement families touched: II-AUTH-001\n",
      "35-evidence.md": "Requirement families touched: II-AUTH-001\n",
    });
    const ledger = buildClauseLedger({
      specMarkdown: authoritySpec(),
      requirementsMarkdown: authorityRequirements,
      issueDirectory: issues,
    });
    expect(() => assertMarkerBijection(authoritySpec(), ledger)).toThrow(/has no II-CLAUSE marker/);
    const marked = renderMarkedSpecCandidate(authoritySpec(), ledger);
    expect(() =>
      assertMarkerBijection(marked.replace("authoritative", "optional"), ledger)
    ).toThrow(/disagrees/);
    expect(() =>
      assertMarkerBijection(
        marked.replace("authoritative.", "authoritative. <!-- II-CLAUSE-0001 --> Duplicate."),
        ledger
      )
    ).toThrow(/Duplicate|marker count/);
  });

  it("rejects unknown keys recursively and noncanonical JSON", () => {
    const issues = issueDirectory({
      "01-authority.md": "Requirement families touched: II-AUTH-001\n",
      "35-evidence.md": "Requirement families touched: II-AUTH-001\n",
    });
    const ledger = buildClauseLedger({
      specMarkdown: authoritySpec(),
      requirementsMarkdown: authorityRequirements,
      issueDirectory: issues,
    });
    const withUnknown = structuredClone(ledger) as typeof ledger & { extra?: boolean };
    withUnknown.clauses[0].scope = { ...withUnknown.clauses[0].scope, surprise: true } as never;
    expect(() => validateClosedClauseLedger(withUnknown)).toThrow(/scope keys must be exactly/);
    const canonical = canonicalClauseLedgerJson(ledger);
    expect(assertCanonicalClauseLedgerJson(canonical)).toEqual(ledger);
    expect(() => assertCanonicalClauseLedgerJson(JSON.stringify(ledger))).toThrow(/not canonical/);
  });

  it("ships a recursively closed JSON schema", () => {
    const schema = JSON.parse(
      readFileSync(resolve("schemas/instrument-intelligence/clause-ledger.schema.json"), "utf8")
    ) as Record<string, unknown>;
    expect(schema.additionalProperties).toBe(false);
    const definitions = schema.$defs as Record<string, Record<string, unknown>>;
    for (const name of [
      "sourceAuthority",
      "requirementIndex",
      "family",
      "clauseSource",
      "scope",
      "stalenessPolicy",
      "clause",
    ]) {
      expect(definitions[name].additionalProperties, name).toBe(false);
    }
  });

  it("reproduces the committed ledger from the marked SPEC and issue mappings", () => {
    const root = resolve(".");
    const path = resolve(root, ".scratch/instrument-intelligence/clause-ledger.json");
    const raw = readFileSync(path, "utf8");
    const committed = assertCanonicalClauseLedgerJson(raw);
    const generated = buildClauseLedger({
      ...loadClauseLedgerInputs(root),
      previousLedger: committed,
      requireMarkers: true,
    });
    expect(canonicalClauseLedgerJson(generated)).toBe(raw);
    const issueMappings = parseIssueFamilyMappings(
      resolve(root, ".scratch/instrument-intelligence/issues")
    );
    expect(() => assertDerivedClauseDependencies(committed, issueMappings)).not.toThrow();
    const nonRootClauses = committed.clauses.filter(
      (clause) => issueMappings.get(clause.implementationOwner)!.blockerIds.length > 0
    );
    expect(nonRootClauses.length).toBeGreaterThan(0);
    expect(nonRootClauses.some((clause) => clause.dependencies.length > 0)).toBe(true);
    assertMarkerBijection(readFileSync(resolve(root, "SPEC.md"), "utf8"), committed);
  });
});
