import express from "express";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseExplicitVoiceLilypond } from "../../lib/restricted-lilypond.js";
import {
  createTranscriptionCorrectionRoute,
  createTranscriptionReviewRoute,
} from "./transcription-route.js";
import { WorkspaceStore } from "./workspace-store.js";

describe("Score-Anchored Review routes", () => {
  let rootDirectory: string;
  let store: WorkspaceStore;
  let server: Server;
  let workspaceId: string;
  let transcriptionId: string;

  beforeEach(async () => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-transcription-route-"));
    store = new WorkspaceStore({ rootDirectory });
    workspaceId = store.create({ title: "Greensleeves" }).id;
    const source = store.addSourceArtifact(workspaceId, {
      filename: "greensleeves.pdf",
      mimeType: "application/pdf",
      contentBase64: readFileSync(
        path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
      ).toString("base64"),
      provenance: { license: "Public Domain" },
    });
    const timestamp = "2026-07-10T12:00:00.000Z";
    const run = store.saveOmrRun(workspaceId, {
      id: "omr.1111111111111111",
      sourceArtifactId: source.id,
      backend: { id: "fixture", version: "1", configuration: {} },
      status: "completed",
      nativeArtifactPaths: [],
      interchangeArtifactPaths: [],
      pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
      diagnostics: [],
      createdAt: timestamp,
      completedAt: timestamp,
    });
    const parsed = parseExplicitVoiceLilypond(
      readFileSync(
        path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
        "utf8"
      ),
      ["Soprano", "Alto", "Tenor", "Bass"]
    );
    transcriptionId = store.saveScoreTranscription(workspaceId, {
      id: "transcription.1111111111111111",
      sourceArtifactId: source.id,
      omrRunId: run.id,
      version: 1,
      status: "needs_review",
      ...parsed,
      events: parsed.events.map((event) =>
        event.id === "event.soprano.1" && event.type === "note"
          ? { ...event, pitch: "F#4", confidence: 0.4 }
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
          region: { page: 1, x: 120, y: 150, width: 24, height: 28 },
          resolved: false,
        },
      ],
      createdAt: timestamp,
    }).id;

    const app = express();
    app.use(express.json());
    app.get(
      "/api/workspaces/:workspaceId/transcriptions/:transcriptionId/review",
      createTranscriptionReviewRoute({ store })
    );
    app.post(
      "/api/workspaces/:workspaceId/transcriptions/:transcriptionId/corrections",
      createTranscriptionCorrectionRoute({ store })
    );
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("reads the persisted source anchor and posts a versioned correction", async () => {
    const reviewResponse = await fetch(
      `${serverUrl()}/api/workspaces/${workspaceId}/transcriptions/${transcriptionId}/review`
    );
    const review = (await reviewResponse.json()) as {
      ok: boolean;
      data: { items: Array<{ uncertainty: { id: string }; events: Array<{ pitch: string }> }> };
    };
    expect(reviewResponse.status).toBe(200);
    expect(review).toMatchObject({
      ok: true,
      data: {
        items: [
          {
            uncertainty: { id: "uncertainty.opening" },
            events: [{ pitch: "F#4" }],
          },
        ],
      },
    });

    const correctionResponse = await fetch(
      `${serverUrl()}/api/workspaces/${workspaceId}/transcriptions/${transcriptionId}/corrections`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uncertaintyId: "uncertainty.opening",
          eventEdits: [{ eventId: "event.soprano.1", pitch: "E4" }],
          rationale: "Confirmed against the source facsimile.",
        }),
      }
    );
    const correction = (await correctionResponse.json()) as {
      ok: boolean;
      data: { scoreTranscription: { parentId: string; version: number; status: string } };
    };
    expect(correctionResponse.status).toBe(200);
    expect(correction).toMatchObject({
      ok: true,
      data: {
        scoreTranscription: { parentId: transcriptionId, version: 2, status: "reviewed" },
      },
    });
  });

  function serverUrl(): string {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    return `http://127.0.0.1:${address.port}`;
  }
});
