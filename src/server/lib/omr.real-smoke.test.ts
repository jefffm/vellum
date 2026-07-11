import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AudiverisBackend, audiverisCommand } from "./omr.js";

const command = audiverisCommand();
const available = command !== "audiveris" ? existsSync(command) : false;

describe.skipIf(!available)("installed Audiveris smoke", () => {
  it("retains native evidence and score-anchored uncertainty from a real public-domain PDF", async () => {
    const file = path.resolve("test/fixtures/greensleeves/greensleeves-satb.pdf");
    const content = readFileSync(file);
    const result = await new AudiverisBackend({ timeout: 300_000 }).recognize({
      source: {
        id: "source.real-audiveris-smoke",
        kind: "pdf",
        filename: path.basename(file),
        mimeType: "application/pdf",
        sha256: "0".repeat(64),
        byteLength: content.length,
        storedPath: "fixture",
        provenance: { license: "Public Domain" },
        createdAt: "2026-07-11T00:00:00.000Z",
      },
      content,
    });

    expect(result.backend).toMatchObject({ id: "audiveris", version: expect.any(String) });
    expect(result.artifacts.map((artifact) => artifact.category)).toEqual(
      expect.arrayContaining(["native", "interchange", "log"])
    );
    expect(result.artifacts.map((artifact) => artifact.filename)).toEqual(
      expect.arrayContaining(["source.omr", "source.mxl", "audiveris-page-1.png"])
    );
    expect(result.pageMappings).toContainEqual({ sourcePage: 1, recognizedPage: 1 });
    expect(result.recognizedScore.events.length).toBeGreaterThan(100);
    expect(
      result.recognizedScore.events.filter(
        (event) => event.sourceRegion?.coordinateSpace === "omr_raster"
      ).length
    ).toBeGreaterThan(100);
    expect(result.recognizedScore.uncertainties.length).toBeGreaterThan(0);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "audiveris.native-evidence" })
    );
  }, 300_000);
});
