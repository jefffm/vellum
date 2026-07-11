import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseExplicitVoiceLilypond } from "../../lib/restricted-lilypond.js";
import { TranscriptionService } from "./transcription-service.js";
import { WorkspaceStore } from "./workspace-store.js";

describe("TranscriptionService", () => {
  let rootDirectory: string;
  let store: WorkspaceStore;
  let workspaceId: string;
  let transcriptionId: string;

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-transcription-"));
    store = new WorkspaceStore({ rootDirectory });
    workspaceId = store.create({ title: "Greensleeves" }).id;
    const pdf = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
    );
    const source = store.addSourceArtifact(workspaceId, {
      filename: "greensleeves.pdf",
      mimeType: "application/pdf",
      contentBase64: pdf.toString("base64"),
      provenance: { license: "Public Domain" },
    });
    const timestamp = "2026-07-10T12:00:00.000Z";
    const run = store.saveOmrRun(workspaceId, {
      id: "omr.1111111111111111",
      sourceArtifactId: source.id,
      backend: { id: "fixture", version: "1", configuration: {} },
      status: "completed",
      nativeArtifactPaths: ["records/omr-runs/omr.1111111111111111/audiveris-page-1.png"],
      interchangeArtifactPaths: [],
      pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
      diagnostics: [],
      createdAt: timestamp,
      completedAt: timestamp,
    });
    const lilypond = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
      "utf8"
    );
    const parsed = parseExplicitVoiceLilypond(lilypond, ["Soprano", "Alto", "Tenor", "Bass"]);
    transcriptionId = store.saveScoreTranscription(workspaceId, {
      id: "transcription.1111111111111111",
      sourceArtifactId: source.id,
      omrRunId: run.id,
      version: 1,
      status: "needs_review",
      title: parsed.title,
      key: parsed.key,
      timeSignature: parsed.timeSignature,
      parts: parsed.parts,
      measures: parsed.measures,
      events: parsed.events.map((event) =>
        event.id === "event.soprano.1" && event.type === "note"
          ? { ...event, pitch: "F#4", confidence: 0.5 }
          : event
      ),
      uncertainties: [
        {
          id: "uncertainty.opening",
          eventIds: ["event.soprano.1"],
          critical: true,
          category: "pitch",
          message: "Opening pitch is uncertain.",
          alternatives: ["E4", "F#4"],
          region: {
            coordinateSpace: "omr_raster",
            page: 1,
            x: 100,
            y: 100,
            width: 20,
            height: 20,
          },
          resolved: false,
        },
      ],
      createdAt: timestamp,
    }).id;
  });

  afterEach(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("creates a reviewed child transcription without mutating OMR output", () => {
    const ids = ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
    const service = new TranscriptionService({
      store,
      now: () => new Date("2026-07-10T13:00:00.000Z"),
      createId: () => ids.shift()!,
    });

    const result = service.correct(workspaceId, transcriptionId, {
      uncertaintyId: "uncertainty.opening",
      eventEdits: [{ eventId: "event.soprano.1", pitch: "E4" }],
      rationale: "Confirmed against the source facsimile.",
    });

    expect(result.scoreTranscription).toMatchObject({
      parentId: transcriptionId,
      version: 2,
      status: "reviewed",
    });
    expect(result.scoreTranscription.uncertainties[0]?.resolved).toBe(true);
    expect(result.scoreTranscription.corrections).toEqual([
      {
        uncertaintyId: "uncertainty.opening",
        eventIds: ["event.soprano.1"],
        rationale: "Confirmed against the source facsimile.",
        createdAt: "2026-07-10T13:00:00.000Z",
      },
    ]);
    expect(
      result.scoreTranscription.events.find((event) => event.id === "event.soprano.1")
    ).toMatchObject({ type: "note", pitch: "E4", confidence: 1 });
    expect(
      store
        .getScoreTranscription(workspaceId, transcriptionId)
        .events.find((event) => event.id === "event.soprano.1")
    ).toMatchObject({ type: "note", pitch: "F#4", confidence: 0.5 });
    expect(result.normalizedScore.scoreTranscriptionId).toBe(result.scoreTranscription.id);
  });

  it("builds a persisted review model anchored to the immutable source", () => {
    const review = new TranscriptionService({ store }).review(workspaceId, transcriptionId);

    expect(review).toMatchObject({
      transcriptionId,
      version: 1,
      status: "needs_review",
      sourceFilename: "greensleeves.pdf",
      sourceContentUrl: expect.stringContaining("/sources/source."),
      items: [
        {
          uncertainty: {
            id: "uncertainty.opening",
            region: {
              coordinateSpace: "omr_raster",
              page: 1,
              x: 100,
              y: 100,
              width: 20,
              height: 20,
            },
            alternatives: ["E4", "F#4"],
          },
          sourceImageUrl: expect.stringContaining("audiveris-page-1.png"),
          events: [{ id: "event.soprano.1", type: "note", pitch: "F#4" }],
        },
      ],
    });
  });

  it("cannot resolve an uncertainty by editing an unrelated event", () => {
    expect(() =>
      new TranscriptionService({ store }).correct(workspaceId, transcriptionId, {
        uncertaintyId: "uncertainty.opening",
        eventEdits: [{ eventId: "event.soprano.2", pitch: "E4" }],
        rationale: "Wrong anchor.",
      })
    ).toThrow("outside transcription uncertainty");
  });

  it("versions reviewed voice identity assignments into deterministic score parts", () => {
    const ids = [
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
    ];
    const result = new TranscriptionService({ store, createId: () => ids.shift()! }).correct(
      workspaceId,
      transcriptionId,
      {
        uncertaintyId: "uncertainty.opening",
        eventEdits: [
          {
            eventId: "event.soprano.1",
            partId: "part.reviewed-soprano",
            partName: "Soprano",
            partRole: "soprano",
          },
        ],
        rationale: "The upper staff and registral line identify the soprano voice.",
      }
    );

    expect(result.scoreTranscription.parts).toContainEqual({
      id: "part.reviewed-soprano",
      name: "Soprano",
      role: "soprano",
    });
    expect(
      result.scoreTranscription.events.find((event) => event.id === "event.soprano.1")
    ).toMatchObject({ partId: "part.reviewed-soprano", confidence: 1 });
    expect(result.normalizedScore.parts).toEqual(result.scoreTranscription.parts);
    expect(result.analysisRecord.normalizedScoreId).toBe(result.normalizedScore.id);
  });
});
