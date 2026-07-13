import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../../prompts.js";

const projectRoot = process.cwd();
const focusedAdrs = [
  "0016-converge-source-truth-by-purpose.md",
  "0017-version-briefs-and-proportional-plans.md",
  "0018-bind-arrangements-to-instrument-instances.md",
  "0019-search-serializable-constraints-and-report-outcomes.md",
  "0020-version-evaluation-manifests-baselines-and-promotion.md",
  "0021-learn-only-from-reviewed-playtest-evidence.md",
];

describe("Arrangement Intelligence architecture boundary", () => {
  it("records Owner acceptance of every focused ADR and grounds it in production and evaluation evidence", () => {
    for (const filename of focusedAdrs) {
      const document = readFileSync(path.join(projectRoot, "docs/adr", filename), "utf8");
      expect(document).toMatch(
        /## Status\s+Accepted — Owner accepted the prototype architecture baseline at T44 on 2026-07-13\./
      );
      expect(document).toMatch(/## Decision/);
      expect(document).toMatch(/## Implemented evidence/);
      expect(document).toMatch(/- Production: `src\//);
      expect(document).toMatch(
        /- Evaluation: `\.scratch\/arrangement-intelligence\/evidence\/T\d+/
      );
      expect(document).toMatch(/## Consequences/);
      expect(document).toMatch(/T44/);
    }
  });

  it("requires parity and both cross-domain evidence sets before the ADR package can be reviewed", () => {
    for (const tracer of ["T36", "T37", "T38"]) {
      const evidence = JSON.parse(
        readFileSync(
          path.join(
            projectRoot,
            ".scratch/arrangement-intelligence/evidence",
            tracer,
            "verification.json"
          ),
          "utf8"
        )
      ) as { result?: string };
      expect(evidence.result).toBe("pass");
    }
  });

  it("documents retained legacy surfaces and prevents the prompt from presenting them as canonical", () => {
    const boundary = readFileSync(
      path.join(projectRoot, "docs/architecture/arrangement-intelligence-boundaries.md"),
      "utf8"
    );
    expect(boundary).toContain("noncanonical_legacy_projection");
    expect(boundary).toContain(
      "There is deliberately no automatic flat-file-to-Arrangement-Score migration"
    );
    expect(boundary).toContain("Direct `/api/compile`, `/api/engrave`, and tool calls");

    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain("canonical path is an Arrangement Workspace");
    expect(prompt).toContain("noncanonical legacy projection");
    expect(prompt).toContain("baroque guitar, thirteen-course lute, classical guitar");
    expect(prompt).toContain("contextual continuo");
    expect(prompt).toContain("imitative intabulation");
  });
});
