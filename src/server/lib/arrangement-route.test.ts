import express from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createArrangementCreateRoute,
  createArrangementDeleteRoute,
  createArrangementGetRoute,
  createArrangementListRoute,
} from "./arrangement-route.js";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

type ArrangementCreateResponse = {
  id: string;
  title: string;
  createdAt: string;
};

type Arrangement = {
  id: string;
  title: string;
  instrument: string;
  lySource: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type ArrangementSummary = {
  id: string;
  title: string;
  instrument: string;
  createdAt: string;
  lySource?: string;
};

const validArrangement = {
  title: "BWV 996 Bourrée",
  instrument: "baroque-lute-13",
  lySource: '\\version "2.24.0"\n{ c4 d e f }',
  metadata: { key: "E minor", bars: 32 },
};

describe("arrangement API routes", () => {
  const servers: Server[] = [];
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "vellum-arrangements-"));
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
    rmSync(directory, { recursive: true, force: true });
  });

  it("creates an arrangement", async () => {
    const server = await listen(directory);
    servers.push(server);

    const response = await postJson(server, "/api/arrangements", validArrangement);
    const json = (await response.json()) as ApiEnvelope<ArrangementCreateResponse>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.id).toMatch(/^[a-f0-9-]{36}$/);
      expect(json.data.title).toBe(validArrangement.title);
      expect(Date.parse(json.data.createdAt)).not.toBeNaN();
    }
  });

  it("gets a created arrangement by id", async () => {
    const server = await listen(directory);
    servers.push(server);
    const created = await create(server);

    const response = await fetch(`${serverUrl(server)}/api/arrangements/${created.id}`);
    const json = (await response.json()) as ApiEnvelope<Arrangement>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data).toMatchObject({
        id: created.id,
        title: validArrangement.title,
        instrument: validArrangement.instrument,
        lySource: validArrangement.lySource,
        metadata: validArrangement.metadata,
      });
    }
  });

  it("lists created arrangement summaries without lySource", async () => {
    const server = await listen(directory);
    servers.push(server);
    const first = await create(server, { title: "First" });
    const second = await create(server, { title: "Second" });

    const response = await fetch(`${serverUrl(server)}/api/arrangements`);
    const json = (await response.json()) as ApiEnvelope<ArrangementSummary[]>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: first.id, title: "First" }),
          expect.objectContaining({ id: second.id, title: "Second" }),
        ])
      );
      expect(json.data.every((summary) => summary.lySource === undefined)).toBe(true);
    }
  });

  it("returns 404 for a missing arrangement id", async () => {
    const server = await listen(directory);
    servers.push(server);

    const response = await fetch(
      `${serverUrl(server)}/api/arrangements/550e8400-e29b-41d4-a716-446655440000`
    );
    const json = (await response.json()) as ApiEnvelope<unknown>;

    expect(response.status).toBe(404);
    expect(json.ok).toBe(false);
  });

  it("deletes an existing arrangement", async () => {
    const server = await listen(directory);
    servers.push(server);
    const created = await create(server);

    const deleteResponse = await fetch(`${serverUrl(server)}/api/arrangements/${created.id}`, {
      method: "DELETE",
    });
    const deleteJson = (await deleteResponse.json()) as ApiEnvelope<{ deleted: true }>;

    expect(deleteResponse.status).toBe(200);
    expect(deleteJson.ok).toBe(true);

    const getResponse = await fetch(`${serverUrl(server)}/api/arrangements/${created.id}`);
    expect(getResponse.status).toBe(404);
  });

  it.each([
    { name: "missing title", body: { instrument: "baroque-lute-13", lySource: "x" } },
    { name: "missing lySource", body: { title: "Untitled", instrument: "baroque-lute-13" } },
  ])("rejects invalid create bodies: $name", async ({ body }) => {
    const server = await listen(directory);
    servers.push(server);

    const response = await postJson(server, "/api/arrangements", body);
    const json = (await response.json()) as ApiEnvelope<unknown>;

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("rejects non-UUID ids", async () => {
    const server = await listen(directory);
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/arrangements/not-a-uuid`);
    const json = (await response.json()) as ApiEnvelope<unknown>;

    expect([400, 404]).toContain(response.status);
    expect(json.ok).toBe(false);
  });
});

async function create(
  server: Server,
  overrides: Partial<typeof validArrangement> = {}
): Promise<ArrangementCreateResponse> {
  const response = await postJson(server, "/api/arrangements", {
    ...validArrangement,
    ...overrides,
  });
  const json = (await response.json()) as ApiEnvelope<ArrangementCreateResponse>;

  if (!json.ok) {
    throw new Error(json.error);
  }

  return json.data;
}

async function postJson(server: Server, route: string, body: unknown): Promise<Response> {
  return fetch(`${serverUrl(server)}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function listen(directory: string): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.get("/api/arrangements", createArrangementListRoute({ directory }));
  app.get("/api/arrangements/:id", createArrangementGetRoute({ directory }));
  app.post("/api/arrangements", createArrangementCreateRoute({ directory }));
  app.delete("/api/arrangements/:id", createArrangementDeleteRoute({ directory }));

  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  return server;
}

function serverUrl(server: Server): string {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return `http://127.0.0.1:${address.port}`;
}
