import express, { type ErrorRequestHandler } from "express";
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
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.source).toContain('\\version "2.24.0"');
      expect(json.data.source).toContain("\\new TabStaff");
      expect(json.data.warnings).toEqual([]);
    }
  });

  it.each(["solo-tab", "french-tab", "tab-and-staff", "voice-and-tab"] as const)(
    "returns 200 for template %s",
    async (template) => {
      const server = await listen(createEngraveRoute());
      servers.push(server);

      const response = await postEngrave(server, minimalParams({ template }));
      const json = (await response.json()) as ApiEnvelope<EngraveResult>;

      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      if (json.ok) {
        expect(json.data.source).toContain('\\version "2.24.0"');
      }
    }
  );

  it("returns a validation error for invalid request bodies", async () => {
    const server = await listen(createEngraveRoute());
    servers.push(server);

    const response = await postEngrave(server, { template: "solo-tab" });
    const json = (await response.json()) as ApiEnvelope<EngraveResult>;

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("returns 400 for valid JSON missing only instrument", async () => {
    const server = await listen(createEngraveRoute());
    servers.push(server);

    const body = { template: "solo-tab", bars: minimalParams().bars };
    const response = await postEngrave(server, body);
    const json = (await response.json()) as ApiEnvelope<EngraveResult>;

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("returns 400 for malformed JSON", async () => {
    const server = await listen(createEngraveRoute());
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/engrave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ malformed",
    });
    const json = (await response.json()) as { error: { message: string; status: number } };

    expect(response.status).toBe(400);
    expect(json.error.status).toBe(400);
    expect(json.error.message.length).toBeGreaterThan(0);
  });

  it("returns 400 for semantic engrave errors", async () => {
    const server = await listen(createEngraveRoute());
    servers.push(server);

    const response = await postEngrave(server, minimalParams({ instrument: "nonexistent" }));
    const json = (await response.json()) as ApiEnvelope<EngraveResult>;

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    if (!json.ok) {
      expect(json.error).toContain("Unknown instrument");
    }
  });
});

function minimalParams(overrides: Partial<EngraveParams> = {}): EngraveParams {
  const bars = overrides.bars ?? [
    {
      events: [{ type: "note" as const, input: "pitch" as const, pitch: "C4", duration: "4" }],
    },
  ];

  return {
    instrument: "classical-guitar-6",
    template: "solo-tab",
    bars,
    ...(overrides.template === "voice-and-tab"
      ? {
          melody: {
            bars: [{ events: [{ type: "note" as const, pitch: "C4", duration: "4" }] }],
          },
        }
      : {}),
    ...overrides,
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
  app.use(jsonErrorHandler);
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  return server;
}

const jsonErrorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const status = typeof error.status === "number" ? error.status : 500;
  response.status(status).json({
    error: {
      message: error instanceof Error ? error.message : "Internal server error",
      status,
    },
  });
};

function serverUrl(server: Server): string {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return `http://127.0.0.1:${address.port}`;
}
