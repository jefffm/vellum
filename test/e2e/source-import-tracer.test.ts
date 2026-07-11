import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SourceImportService } from "../../src/server/lib/source-import-service.js";
import { WorkspaceStore } from "../../src/server/lib/workspace-store.js";

describe("broader public-domain source ingestion tracer", () => {
  const roots: string[] = [];
  afterEach(() =>
    roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
  );

  it("imports Old Hundredth from ABC through disclosed interchange lineage", async () => {
    const rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-abc-tracer-"));
    roots.push(rootDirectory);
    const store = new WorkspaceStore({ rootDirectory });
    const workspace = store.create({ title: "Old Hundredth" });
    const content = readFileSync(path.resolve("test/fixtures/old-hundredth.abc"));
    const source = store.addSourceArtifact(workspace.id, {
      filename: "old-hundredth.abc",
      mimeType: "text/vnd.abc",
      contentBase64: content.toString("base64"),
      provenance: { license: "Public Domain", attribution: "Louis Bourgeois (attributed), 1551" },
    });
    const result = await new SourceImportService({ store }).import(workspace.id, source.id);
    expect(result.scoreTranscription).toMatchObject({
      title: "Old Hundredth",
      ingestion: {
        method: "deterministic_parse",
        sourceFormat: "abc",
        diagnostics: [expect.objectContaining({ code: "abc.native_parse" })],
      },
    });
    expect(
      result.normalizedScore.events.filter((event) => event.type === "note").length
    ).toBeGreaterThan(20);
    expect(result.normalizedScore.title).toBe("Old Hundredth");
    expect(result.analysisRecord.summary).toContain("monophony");
  });
});
