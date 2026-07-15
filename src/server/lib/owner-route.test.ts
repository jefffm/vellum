import express from "express";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ApiResponse } from "../../lib/api-contract.js";
import type { OwnerReference } from "../../lib/owner-domain.js";
import { createOwnerReferenceRoute, createOwnerStateRoute } from "./owner-route.js";
import { OwnerStore } from "./owner-store.js";

describe("Owner Reference upload", () => {
  let rootDirectory: string;
  let store: OwnerStore;
  const servers: Server[] = [];

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-owner-route-"));
    store = new OwnerStore({
      rootDirectory,
      now: () => new Date("2026-07-13T12:00:00.000Z"),
    });
  });

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          })
      )
    );
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("streams a book-sized reference without base64 JSON", async () => {
    const server = await listen(createOwnerReferenceRoute(store));
    const content = Buffer.from("%PDF-1.7\nA primary-source facsimile\n%%EOF");
    const response = await fetch(serverUrl(server), {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Reference-Title": encodeURIComponent("Méthode pour la guitare"),
        "X-Reference-Citation": encodeURIComponent("Paris, 1830, plate 1"),
      },
      body: content,
    });
    const json = (await response.json()) as ApiResponse<Omit<OwnerReference, "storedPath">>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    expect(json.data).toMatchObject({
      title: "Méthode pour la guitare",
      citation: "Paris, 1830, plate 1",
      mimeType: "application/pdf",
      byteLength: content.byteLength,
    });
    expect(json.data).not.toHaveProperty("storedPath");
    const stored = store.listReferences()[0];
    expect(readFileSync(path.join(rootDirectory, stored.storedPath))).toEqual(content);
  });

  it("retains the small legacy JSON boundary", async () => {
    const server = await listen(createOwnerReferenceRoute(store), true);
    const response = await fetch(serverUrl(server), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Short note",
        citation: "Owner notebook, folio 1",
        mimeType: "text/plain",
        contentBase64: Buffer.from("A reviewed note").toString("base64"),
      }),
    });
    const json = (await response.json()) as ApiResponse<Omit<OwnerReference, "storedPath">>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.byteLength).toBe(15);
      expect(json.data).not.toHaveProperty("storedPath");
    }
  });

  it("rejects a streamed reference beyond the configured limit", async () => {
    const server = await listen(createOwnerReferenceRoute(store, { maxBytes: 4 }));
    const response = await fetch(serverUrl(server), {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Reference-Title": "Oversized",
        "X-Reference-Citation": "Test fixture",
      },
      body: Buffer.from("12345"),
    });
    const json = (await response.json()) as { error?: { code?: string } };

    expect(response.status).toBe(413);
    expect(json.error?.code).toBe("request_too_large");
    expect(store.listReferences()).toEqual([]);
  });

  it("keeps local storage paths out of the Owner compatibility response", async () => {
    store.addReference({
      title: "Private facsimile",
      citation: "Owner library",
      mimeType: "application/pdf",
      contentBase64: Buffer.from("private source bytes").toString("base64"),
    });
    const server = await listen(createOwnerStateRoute(store));
    const response = await fetch(serverUrl(server));
    const json = (await response.json()) as ApiResponse<{
      ownerReferences: Array<Record<string, unknown>>;
    }>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    expect(json.data.ownerReferences).toHaveLength(1);
    expect(json.data.ownerReferences[0]).not.toHaveProperty("storedPath");
    expect(JSON.stringify(json.data)).not.toContain("references/reference.");
  });

  async function listen(route: express.RequestHandler, parseJson = false): Promise<Server> {
    const app = express();
    if (parseJson) app.use(express.json());
    app.all("/", route);
    app.use(((error, _request, response, _next) => {
      response.status(error.status ?? 500).json({
        ok: false,
        error: { code: error.code ?? "internal_error", message: error.message },
      });
    }) as express.ErrorRequestHandler);
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    servers.push(server);
    return server;
  }
});

function serverUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP server address");
  return `http://127.0.0.1:${address.port}`;
}
