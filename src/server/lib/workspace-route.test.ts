import express from "express";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { ErrorRequestHandler } from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ApiResponse } from "../../lib/api-contract.js";
import {
  createSourceContentRoute,
  createSourceUploadRoute,
  createWorkspaceCreateRoute,
  createWorkspaceGetRoute,
  createWorkspaceListRoute,
  createWorkspaceNavigationRoute,
  createWorkspaceRemoveRoute,
  createWorkspaceRenameRoute,
} from "./workspace-route.js";
import { ApiRouteError } from "./create-route.js";
import { WorkspaceStore } from "./workspace-store.js";

type ApiEnvelope<T> = ApiResponse<T>;

describe("workspace API routes", () => {
  let rootDirectory: string;
  let server: Server;
  let store: WorkspaceStore;

  beforeEach(async () => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-workspace-routes-"));
    store = new WorkspaceStore({ rootDirectory });
    const app = express();
    app.use(express.json({ limit: "4mb" }));
    app.get("/api/workspaces", createWorkspaceListRoute(store));
    app.post("/api/workspaces", createWorkspaceCreateRoute(store));
    app.get("/api/workspaces/:workspaceId", createWorkspaceGetRoute(store));
    app.get("/api/workspaces/:workspaceId/navigation", createWorkspaceNavigationRoute(store));
    app.patch("/api/workspaces/:workspaceId", createWorkspaceRenameRoute(store));
    app.delete("/api/workspaces/:workspaceId", createWorkspaceRemoveRoute(store));
    app.post(
      "/api/workspaces/:workspaceId/sources",
      createSourceUploadRoute(store, { maxBytes: 64 * 1024 })
    );
    app.get(
      "/api/workspaces/:workspaceId/sources/:sourceArtifactId/content",
      createSourceContentRoute(store)
    );
    app.use(((error, _request, response, _next) => {
      const status = error instanceof ApiRouteError ? error.status : 500;
      response.status(status).json({ error: error instanceof Error ? error.message : "error" });
    }) satisfies ErrorRequestHandler);
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
    expect(uploadJson.data.sha256).toBe(createHash("sha256").update(pdf).digest("hex"));

    const contentResponse = await fetch(
      `${serverUrl()}/api/workspaces/${workspaceJson.data.id}/sources/${uploadJson.data.id}/content`
    );
    expect(contentResponse.status).toBe(200);
    expect(contentResponse.headers.get("content-type")).toBe("application/pdf");
    expect(contentResponse.headers.get("content-disposition")).toBe(
      'inline; filename="greensleeves-score.pdf"'
    );
    expect(contentResponse.headers.get("x-content-type-options")).toBe("nosniff");
    expect(contentResponse.headers.get("referrer-policy")).toBe("no-referrer");
    expect(contentResponse.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(contentResponse.headers.get("content-security-policy")).toContain("sandbox");
    expect(contentResponse.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(Buffer.from(await contentResponse.arrayBuffer())).toEqual(pdf);

    const getResponse = await fetch(`${serverUrl()}/api/workspaces/${workspaceJson.data.id}`);
    const getJson = (await getResponse.json()) as ApiEnvelope<{ sourceArtifactIds: string[] }>;
    expect(getJson.ok).toBe(true);
    if (getJson.ok) expect(getJson.data.sourceArtifactIds).toEqual([uploadJson.data.id]);
  });

  it("rejects an oversized streamed source without creating a canonical artifact", async () => {
    const workspaceResponse = await post("/api/workspaces", { title: "Bounded upload" });
    const workspaceJson = (await workspaceResponse.json()) as ApiEnvelope<{ id: string }>;
    if (!workspaceJson.ok) throw new Error("workspace setup failed");
    const oversized = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(70 * 1024)]);

    const response = await fetch(`${serverUrl()}/api/workspaces/${workspaceJson.data.id}/sources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Source-Filename": "oversized.pdf",
      },
      body: oversized,
    });

    expect(response.status).toBe(413);
    expect(store.get(workspaceJson.data.id).sourceArtifactIds).toEqual([]);

    const chunkedStatus = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        `${serverUrl()}/api/workspaces/${workspaceJson.data.id}/sources`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/pdf",
            "X-Source-Filename": "chunked-oversized.pdf",
            "Transfer-Encoding": "chunked",
          },
        },
        (incoming) => {
          incoming.resume();
          incoming.on("end", () => resolve(incoming.statusCode ?? 0));
        }
      );
      request.on("error", reject);
      request.write(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(40 * 1024)]));
      request.end(Buffer.alloc(40 * 1024));
    });
    expect(chunkedStatus).toBe(413);
    expect(store.get(workspaceJson.data.id).sourceArtifactIds).toEqual([]);
  });

  it("serves XML-like source material as a byte-identical attachment", async () => {
    const workspace = store.create({ title: "Imported score" });
    const content = Buffer.from(
      '<?xml version="1.0"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n<score-partwise version="4.0"></score-partwise>'
    );
    const source = store.addSourceArtifact(workspace.id, {
      filename: "score.musicxml",
      mimeType: "application/vnd.recordare.musicxml+xml",
      contentBase64: content.toString("base64"),
      provenance: { license: "Owner supplied" },
    });

    const response = await fetch(
      `${serverUrl()}/api/workspaces/${workspace.id}/sources/${source.id}/content`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="score.musicxml"'
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(content);
  });

  it("refuses source bytes that no longer match immutable metadata", async () => {
    const workspace = store.create({ title: "Corrupt source" });
    const source = store.addSourceArtifact(workspace.id, {
      filename: "score.pdf",
      mimeType: "application/pdf",
      contentBase64: Buffer.from("%PDF-1.7\nvalid").toString("base64"),
      provenance: { license: "Owner supplied" },
    });
    writeFileSync(
      path.join(rootDirectory, workspace.id, source.storedPath),
      Buffer.from("<html>not a pdf</html>")
    );

    const response = await fetch(
      `${serverUrl()}/api/workspaces/${workspace.id}/sources/${source.id}/content`
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Stored source failed integrity validation" });
  });

  it("rejects malformed workspace ids before reading storage", async () => {
    const response = await fetch(`${serverUrl()}/api/workspaces/not-a-workspace`);
    const json = (await response.json()) as ApiEnvelope<unknown>;
    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("navigates, renames, and safely removes a local workspace", async () => {
    const created = await post("/api/workspaces", { title: "Untitled" });
    const workspace = (await created.json()) as ApiEnvelope<{ id: string }>;
    if (!workspace.ok) throw new Error(workspace.error.message);
    const navigation = await fetch(`${serverUrl()}/api/workspaces/${workspace.data.id}/navigation`);
    expect(await navigation.json()).toMatchObject({
      ok: true,
      data: { workspace: { id: workspace.data.id, title: "Untitled" }, families: [] },
    });
    const renamed = await fetch(`${serverUrl()}/api/workspaces/${workspace.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Greensleeves" }),
    });
    expect(await renamed.json()).toMatchObject({
      ok: true,
      data: { id: workspace.data.id, title: "Greensleeves" },
    });
    const refused = await fetch(`${serverUrl()}/api/workspaces/${workspace.data.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "Greensleeves" }),
    });
    expect(refused.status).toBe(400);
    const removed = await fetch(`${serverUrl()}/api/workspaces/${workspace.data.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: workspace.data.id }),
    });
    expect(await removed.json()).toMatchObject({ ok: true, data: { removed: true } });
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
