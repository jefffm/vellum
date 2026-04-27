import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

type TemplateSummary = {
  name: string;
  description: string;
};

describe("template API routes", () => {
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

  it("lists all templates", async () => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/templates`);
    const json = (await response.json()) as ApiEnvelope<TemplateSummary[]>;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data).toHaveLength(8);
      expect(json.data.map((template) => template.name).sort()).toEqual([
        "continuo",
        "french-tab",
        "grand-staff",
        "satb",
        "solo-tab",
        "tab-and-staff",
        "voice-and-piano",
        "voice-and-tab",
      ]);
      expect(json.data[0]).toEqual({ name: expect.any(String), description: expect.any(String) });
    }
  });

  it("returns raw LilyPond source as text", async () => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/templates/french-tab`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain('\\version "2.24.0"');
    expect(body).toContain("fret-letter-tablature-format");
  });

  it("returns 404 for unknown templates", async () => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/templates/nonexistent`);
    const json = (await response.json()) as ApiEnvelope<unknown>;

    expect(response.status).toBe(404);
    expect(json.ok).toBe(false);
  });

  it("rejects path traversal", async () => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/templates/..%2fpasswd`);

    expect([400, 404]).toContain(response.status);
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
