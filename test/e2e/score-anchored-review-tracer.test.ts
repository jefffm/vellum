import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { arrangementToEngraveParams } from "../../src/lib/arrangement-engrave.js";
import { buildAudioPreview } from "../../src/lib/audio-preview.js";
import { parseExplicitVoiceLilypond } from "../../src/lib/restricted-lilypond.js";
import { ArrangementService } from "../../src/server/lib/arrangement-service.js";
import { compileLilyPond } from "../../src/server/lib/compile-route.js";
import { engrave } from "../../src/server/lib/engrave.js";
import { OmrService } from "../../src/server/lib/omr.js";
import type { OmrBackend } from "../../src/server/lib/omr.js";
import { SubprocessRunner } from "../../src/server/lib/subprocess.js";
import { TranscriptionService } from "../../src/server/lib/transcription-service.js";
import { WorkspaceStore } from "../../src/server/lib/workspace-store.js";

let lilypondAvailable = false;

beforeAll(() => {
  try {
    execFileSync("lilypond", ["--version"], { stdio: "pipe" });
    lilypondAvailable = true;
  } catch {
    lilypondAvailable = false;
  }
});

describe("Score-Anchored Review tracer", () => {
  const rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-score-review-e2e-"));

  afterAll(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("corrects a critical PDF uncertainty immutably and resumes arrangement", async () => {
    const store = new WorkspaceStore({ rootDirectory });
    const workspace = store.create({
      title: "Greensleeves review",
      brief: {
        targetConfigurations: [
          {
            id: "target.baroque-guitar",
            instrumentId: "baroque-guitar-5",
            role: "solo",
            stringing: "french",
            notationLayouts: ["french-letter-tablature"],
            deliverables: ["pdf", "audio-preview"],
          },
        ],
      },
    });
    const pdf = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
    );
    const source = store.addSourceArtifact(workspace.id, {
      filename: "greensleeves-satb.pdf",
      mimeType: "application/pdf",
      contentBase64: pdf.toString("base64"),
      provenance: { license: "Public Domain" },
    });
    const parsed = parseExplicitVoiceLilypond(
      readFileSync(
        path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
        "utf8"
      ),
      ["Soprano", "Alto", "Tenor", "Bass"]
    );
    const backend: OmrBackend = {
      id: "ambiguous-fixture",
      recognize: async () => ({
        backend: { id: "ambiguous-fixture", version: "1", configuration: {} },
        artifacts: [],
        pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
        diagnostics: [],
        recognizedScore: {
          ...parsed,
          events: parsed.events.map((event) =>
            event.id === "event.soprano.1" && event.type === "note"
              ? { ...event, pitch: "F#4", confidence: 0.42 }
              : event
          ),
          uncertainties: [
            {
              id: "uncertainty.opening-soprano",
              eventIds: ["event.soprano.1"],
              critical: true,
              category: "pitch",
              message: "The opening Principal Voice pitch may be E4 rather than F#4.",
              alternatives: ["E4", "F#4"],
              region: { page: 1, x: 120, y: 150, width: 24, height: 28 },
              resolved: false,
            },
          ],
        },
      }),
    };

    const recognized = await new OmrService({ store }).recognize(workspace.id, source.id, backend);
    expect(recognized.scoreTranscription.status).toBe("needs_review");
    const arrangements = new ArrangementService({ store });
    expect(() =>
      arrangements.createFaithfulReduction(workspace.id, {
        normalizedScoreId: recognized.normalizedScore.id,
        targetConfigurationId: "target.baroque-guitar",
      })
    ).toThrow("Score-Anchored Review is required");

    const transcriptionService = new TranscriptionService({ store });
    const review = transcriptionService.review(workspace.id, recognized.scoreTranscription.id);
    expect(review).toMatchObject({
      transcriptionId: recognized.scoreTranscription.id,
      sourceArtifactId: source.id,
      sourceContentUrl: `/api/workspaces/${workspace.id}/sources/${source.id}/content`,
      items: [
        {
          uncertainty: {
            id: "uncertainty.opening-soprano",
            alternatives: ["E4", "F#4"],
            region: { page: 1, x: 120, y: 150, width: 24, height: 28 },
          },
          events: [{ id: "event.soprano.1", pitch: "F#4", confidence: 0.42 }],
        },
      ],
    });

    const corrected = transcriptionService.correct(workspace.id, recognized.scoreTranscription.id, {
      uncertaintyId: "uncertainty.opening-soprano",
      eventEdits: [{ eventId: "event.soprano.1", pitch: "E4" }],
      rationale: "Confirmed against the opening soprano note in the source facsimile.",
    });
    expect(corrected.scoreTranscription).toMatchObject({
      parentId: recognized.scoreTranscription.id,
      version: 2,
      status: "reviewed",
    });
    expect(
      corrected.scoreTranscription.events.find((event) => event.id === "event.soprano.1")
    ).toMatchObject({ pitch: "E4", confidence: 1 });
    expect(
      store
        .getScoreTranscription(workspace.id, recognized.scoreTranscription.id)
        .events.find((event) => event.id === "event.soprano.1")
    ).toMatchObject({ pitch: "F#4", confidence: 0.42 });
    expect(store.readSourceContent(workspace.id, source.id)).toEqual(pdf);

    const arranged = arrangements.createFaithfulReduction(workspace.id, {
      normalizedScoreId: corrected.normalizedScore.id,
      targetConfigurationId: "target.baroque-guitar",
    });
    expect(arranged.arrangementScore.preservationAudit).toMatchObject({
      status: "pass",
      findings: [],
    });
    const firstProtected = arranged.arrangementScore.events.find(
      (event) => event.principalVoiceSourceEventId === "event.soprano.1"
    );
    expect(firstProtected?.pitches).toContain("D4");
    expect(
      buildAudioPreview(arranged.arrangementScore, corrected.normalizedScore).events.some(
        (event) =>
          event.arrangementEventId === firstProtected?.id && event.part === "principal-voice"
      )
    ).toBe(true);

    if (lilypondAvailable) {
      const engraving = engrave(
        arrangementToEngraveParams(arranged.arrangementScore, corrected.normalizedScore)
      );
      const compiled = await compileLilyPond(
        { source: engraving.source, format: "both" },
        new SubprocessRunner(60_000),
        60_000
      );
      expect(compiled.errors).toEqual([]);
      expect(compiled.pdf?.length ?? 0).toBeGreaterThan(1_000);
      expect(compiled.midi?.length ?? 0).toBeGreaterThan(100);
    }

    expect(store.get(workspace.id)).toMatchObject({
      sourceArtifactIds: [source.id],
      scoreTranscriptionIds: [recognized.scoreTranscription.id, corrected.scoreTranscription.id],
      normalizedScoreIds: [recognized.normalizedScore.id, corrected.normalizedScore.id],
      analysisRecordIds: [arranged.analysisRecordId],
      arrangementScoreIds: [arranged.arrangementScore.id],
    });
  }, 90_000);
});
