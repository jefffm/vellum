import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import type { EngraveParams, EngraveResult } from "../../lib/engrave-schema.js";
import { createEngraveRoute } from "./engrave-route.js";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

describe("createEngraveRoute", () => {
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

  it("returns engraved LilyPond source for valid params", async () => {
    const server = await listen(createEngraveRoute());
    servers.push(server);

    const response = await postEngrave(server, minimalParams());
    const json = (await response.json()) as ApiEnvelope<EngraveResult>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.source).toContain('\\version "2.24.0"');
      expect(json.data.source).toContain("\\new TabStaff");
      expect(json.data.warnings).toEqual([]);
    }
  });

  it("returns a validation error for invalid request bodies", async () => {
    const server = await listen(createEngraveRoute());
    servers.push(server);

    const response = await postEngrave(server, { template: "solo-tab" });
    const json = (await response.json()) as ApiEnvelope<EngraveResult>;

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
  });
});

function minimalParams(): EngraveParams {
  return {
    instrument: "classical-guitar-6",
    template: "solo-tab",
    bars: [
      {
        events: [{ type: "note", input: "pitch", pitch: "C4", duration: "4" }],
      },
    ],
  };
}

async function postEngrave(server: Server, body: unknown): Promise<Response> {
  return await fetch(`${serverUrl(server)}/api/engrave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function listen(handler: express.RequestHandler): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.post("/api/engrave", handler);
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
