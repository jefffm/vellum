import express from "express";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSourceContentRoute,
  createSourceUploadRoute,
  createWorkspaceCreateRoute,
  createWorkspaceGetRoute,
  createWorkspaceListRoute,
} from "./workspace-route.js";
import { WorkspaceStore } from "./workspace-store.js";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

describe("workspace API routes", () => {
  let rootDirectory: string;
  let server: Server;

  beforeEach(async () => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-workspace-routes-"));
    const store = new WorkspaceStore({ rootDirectory });
    const app = express();
    app.use(express.json({ limit: "4mb" }));
    app.get("/api/workspaces", createWorkspaceListRoute(store));
    app.post("/api/workspaces", createWorkspaceCreateRoute(store));
    app.get("/api/workspaces/:workspaceId", createWorkspaceGetRoute(store));
    app.post(
      "/api/workspaces/:workspaceId/sources",
      express.raw({ type: "application/pdf", limit: "128mb" }),
      createSourceUploadRoute(store)
    );
    app.get(
      "/api/workspaces/:workspaceId/sources/:sourceArtifactId/content",
      createSourceContentRoute(store)
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

  it("creates a guided-start workspace and uploads the golden PDF", async () => {
    const workspaceResponse = await post("/api/workspaces", {
      title: "Greensleeves",
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
    const workspaceJson = (await workspaceResponse.json()) as ApiEnvelope<{
      id: string;
      sourceArtifactIds: string[];
    }>;
    expect(workspaceResponse.status).toBe(200);
    expect(workspaceJson.ok).toBe(true);
    if (!workspaceJson.ok) return;

    const pdf = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.pdf")
    );
    const uploadResponse = await fetch(
      `${serverUrl()}/api/workspaces/${workspaceJson.data.id}/sources`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "X-Source-Filename": encodeURIComponent("greensleeves score.pdf"),
          "X-Source-License": "Public Domain",
        },
        body: pdf,
      }
    );
    const uploadJson = (await uploadResponse.json()) as ApiEnvelope<{
      id: string;
      sha256: string;
    }>;
    expect(uploadResponse.status).toBe(200);
    expect(uploadJson.ok).toBe(true);
    if (!uploadJson.ok) return;

    const contentResponse = await fetch(
      `${serverUrl()}/api/workspaces/${workspaceJson.data.id}/sources/${uploadJson.data.id}/content`
    );
    expect(contentResponse.status).toBe(200);
    expect(contentResponse.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await contentResponse.arrayBuffer())).toEqual(pdf);

    const getResponse = await fetch(`${serverUrl()}/api/workspaces/${workspaceJson.data.id}`);
    const getJson = (await getResponse.json()) as ApiEnvelope<{ sourceArtifactIds: string[] }>;
    expect(getJson.ok).toBe(true);
    if (getJson.ok) expect(getJson.data.sourceArtifactIds).toEqual([uploadJson.data.id]);
  });

  it("rejects malformed workspace ids before reading storage", async () => {
    const response = await fetch(`${serverUrl()}/api/workspaces/not-a-workspace`);
    const json = (await response.json()) as ApiEnvelope<unknown>;
    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  async function post(route: string, body: unknown): Promise<Response> {
    return fetch(`${serverUrl()}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function serverUrl(): string {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    return `http://127.0.0.1:${address.port}`;
  }
});
