import express from "express";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseExplicitVoiceLilypond } from "../../lib/restricted-lilypond.js";
import type { OmrBackend } from "./omr.js";
import { createOmrRunRoute } from "./omr-route.js";
import { WorkspaceStore } from "./workspace-store.js";

describe("OMR route", () => {
  let rootDirectory: string;
  let store: WorkspaceStore;
  let server: Server;
  let workspaceId: string;
  let sourceArtifactId: string;

  beforeEach(async () => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-omr-route-"));
    store = new WorkspaceStore({ rootDirectory });
    workspaceId = store.create({ title: "Greensleeves" }).id;
    const pdf = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
    );
    sourceArtifactId = store.addSourceArtifact(workspaceId, {
      filename: "greensleeves-satb.pdf",
      mimeType: "application/pdf",
      contentBase64: pdf.toString("base64"),
      provenance: { license: "Public Domain" },
    }).id;
    const lilypond = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
      "utf8"
    );
    const parsed = parseExplicitVoiceLilypond(lilypond, ["Soprano", "Alto", "Tenor", "Bass"]);
    const backend: OmrBackend = {
      id: "fixture",
      recognize: async () => ({
        backend: { id: "fixture", version: "1", configuration: {} },
        artifacts: [],
        pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
        diagnostics: [],
        recognizedScore: { ...parsed, uncertainties: [] },
      }),
    };
    const app = express();
    app.use(express.json({ limit: "4mb" }));
    app.post(
      "/api/workspaces/:workspaceId/omr-runs",
      createOmrRunRoute({ store, backendFactory: () => backend })
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

  it("runs PDF recognition through the configured backend", async () => {
    const response = await fetch(`${serverUrl()}/api/workspaces/${workspaceId}/omr-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceArtifactId, backend: "audiveris" }),
    });
    const json = (await response.json()) as {
      ok: boolean;
      data?: {
        scoreTranscription: { title?: string; status: string };
        normalizedScore: { events: unknown[] };
      };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.scoreTranscription).toMatchObject({
      title: "Greensleeves",
      status: "reviewed",
    });
    expect(json.data?.normalizedScore.events.length).toBeGreaterThan(100);
  });

  function serverUrl(): string {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    return `http://127.0.0.1:${address.port}`;
  }
});
