import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./index.js";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

type InstrumentSummary = {
  id: string;
  name: string;
  courses?: number;
  strings?: number;
};

describe("server API endpoints", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          })
      )
    );
  });

  it("lists instrument summaries", async () => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/instruments`);
    const json = (await response.json()) as ApiEnvelope<InstrumentSummary[]>;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.length).toBeGreaterThanOrEqual(2);
      expect(json.data).toContainEqual(
        expect.objectContaining({ id: "baroque-lute-13", name: expect.any(String), courses: 13 })
      );
    }
  });

  it("returns a full instrument profile", async () => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/instruments/baroque-lute-13`);
    const json = (await response.json()) as ApiEnvelope<{ id: string; tuning: unknown[] }>;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.id).toBe("baroque-lute-13");
      expect(json.data.tuning).toHaveLength(13);
    }
  });

  it("returns 404 for missing profiles", async () => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/instruments/fake`);
    const json = (await response.json()) as ApiEnvelope<unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json.ok).toBe(false);
  });

  it.each(["chordify", "analyze", "lint"])("registers the /api/%s theory route", async (route) => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = (await response.json()) as ApiEnvelope<unknown>;

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json.ok).toBe(false);
  });
});

async function listen(): Promise<Server> {
  const server = createServer(createApp());

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
