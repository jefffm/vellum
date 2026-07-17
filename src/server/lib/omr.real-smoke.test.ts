import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AudiverisBackend, audiverisCommand, OmrService } from "./omr.js";
import { TranscriptionService } from "./transcription-service.js";
import { WorkspaceStore } from "./workspace-store.js";

const command = audiverisCommand();
const available = command !== "audiveris" ? existsSync(command) : false;

describe.skipIf(!available)("installed Audiveris smoke", () => {
  it("retains native evidence and score-anchored uncertainty from a real public-domain PDF", async () => {
    const rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-real-omr-"));
    const file = path.resolve("test/fixtures/greensleeves/greensleeves-satb.pdf");
    const content = readFileSync(file);
    try {
      const store = new WorkspaceStore({ rootDirectory });
      const workspace = store.create({
        title: "Real Audiveris lineage smoke",
        brief: { targetConfigurations: [] },
      });
      const source = store.addSourceArtifact(workspace.id, {
        filename: path.basename(file),
        mimeType: "application/pdf",
        contentBase64: content.toString("base64"),
        provenance: { license: "Public Domain" },
      });
      const result = await new OmrService({ store }).recognize(
        workspace.id,
        source.id,
        new AudiverisBackend({ timeout: 300_000 })
      );

      expect(result.omrRun).toMatchObject({
        sourceArtifactId: source.id,
        backend: { id: "audiveris", version: expect.any(String) },
        status: "completed",
      });
      expect(result.omrRun.nativeArtifactPaths).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/source\.omr$/),
          expect.stringMatching(/audiveris-page-1\.png$/),
        ])
      );
      expect(result.omrRun.interchangeArtifactPaths).toEqual([
        expect.stringMatching(/source\.mxl$/),
      ]);
      expect(result.omrRun.pageMappings).toContainEqual({ sourcePage: 1, recognizedPage: 1 });
      expect(result.scoreTranscription).toMatchObject({
        sourceArtifactId: source.id,
        omrRunId: result.omrRun.id,
        status: "needs_review",
      });
      expect(result.normalizedScore.scoreTranscriptionId).toBe(result.scoreTranscription.id);
      expect(
        result.scoreTranscription.events.filter(
          (event) => event.sourceRegion?.coordinateSpace === "omr_raster"
        ).length
      ).toBeGreaterThan(100);
      expect(result.scoreTranscription.uncertainties.length).toBeGreaterThan(0);
      expect(result.omrRun.diagnostics).toContainEqual(
        expect.objectContaining({ code: "audiveris.native-evidence" })
      );

      const transcriptionService = new TranscriptionService({ store });
      const review = transcriptionService.review(workspace.id, result.scoreTranscription.id);
      const first = review.items[0]!;
      const firstEvent = first.events[0]!;
      if (firstEvent.type !== "note") throw new Error("Expected a note uncertainty");
      expect(first.sourceImageUrl).toMatch(/audiveris-page-1\.png$/);
      const corrected = transcriptionService.correct(workspace.id, result.scoreTranscription.id, {
        correctionId: "correction.real-audiveris-smoke",
        uncertaintyId: first.uncertainty.id,
        eventEdits: [{ eventId: firstEvent.id, pitch: firstEvent.pitch }],
        rationale: "Confirmed against the retained source region during the real-tool smoke.",
      });
      expect(corrected.scoreTranscription).toMatchObject({
        parentId: result.scoreTranscription.id,
        sourceArtifactId: source.id,
        omrRunId: result.omrRun.id,
        corrections: [
          expect.objectContaining({
            correctionId: "correction.real-audiveris-smoke",
            uncertaintyId: first.uncertainty.id,
          }),
        ],
      });
      expect(corrected.normalizedScore.scoreTranscriptionId).toBe(corrected.scoreTranscription.id);
    } finally {
      rmSync(rootDirectory, { recursive: true, force: true });
    }
  }, 300_000);
});
