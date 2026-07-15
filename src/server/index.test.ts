import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiResponse } from "../lib/api-contract.js";
import { createApp, startServer } from "./index.js";
import { VELLUM_API_SCHEMA_VERSION } from "../lib/runtime-contract.js";

type ApiEnvelope<T> = ApiResponse<T>;

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
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("binds the actual default listener to numeric loopback", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const server = startServer(0, { installSignalHandlers: false });
    servers.push(server);
    await listening(server);
    const address = server.address();
    expect(address && typeof address !== "string" ? address.address : address).toBe("127.0.0.1");
  });

  it("serves the application and API with the shared browser security headers", async () => {
    const server = await listen();
    servers.push(server);
    const response = await fetch(`${serverUrl(server)}/health`);

    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain("object-src 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      apiSchemaVersion: VELLUM_API_SCHEMA_VERSION,
      runtimeInstanceId: expect.stringMatching(/^runtime\./),
    });
  });

  it("allows only the exact configured browser origin and emits a strict preflight", async () => {
    const server = await listen();
    servers.push(server);
    const response = await fetch(`${serverUrl(server)}/api/workspaces`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "content-type,x-source-filename,x-reference-title,x-reference-citation",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
    expect(response.headers.get("vary")).toContain("Origin");
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    expect(response.headers.get("access-control-allow-headers")).toContain("x-reference-title");
    expect(response.headers.get("access-control-allow-headers")).not.toContain("*");
  });

  it.each([
    ["provider lifecycle", "GET", "/api/provider-connection"],
    ["model action creation", "POST", "/api/workspaces/workspace.1234567890abcdef/model-actions"],
    ["compile tool", "POST", "/api/compile"],
    ["owner state", "GET", "/api/owner"],
    [
      "reference-source staging transaction",
      "POST",
      "/api/owner/reference-source-staging/transactions",
    ],
    [
      "reference-source lifecycle planning",
      "POST",
      "/api/owner/reference-source-staging/lifecycle/plan",
    ],
    ["workspace mutation", "POST", "/api/workspaces"],
    ["source upload", "POST", "/api/workspaces/workspace.1234567890abcdef/sources"],
    ["arrangement search", "POST", "/api/workspaces/workspace.1234567890abcdef/arrangements"],
    [
      "deliverable content",
      "GET",
      "/api/workspaces/workspace.1234567890abcdef/deliverables/deliverable.1234567890abcdef/content",
    ],
    ["legacy arrangement", "POST", "/api/arrangements"],
  ])("rejects a hostile browser origin before the %s route family", async (_name, method, url) => {
    const server = await listen();
    servers.push(server);
    const response = await fetch(`${serverUrl(server)}${url}`, {
      method,
      headers: { Origin: "https://hostile.example", "Content-Type": "application/json" },
      ...(method === "GET" ? {} : { body: "{}" }),
    });
    const json = (await response.json()) as ApiResponse<unknown>;
    expect(response.status).toBe(403);
    expect(json.ok).toBe(false);
    if (json.ok) return;
    expect(json.error).toMatchObject({
      code: "forbidden_origin",
      status: 403,
      correlationId: response.headers.get("x-vellum-correlation-id"),
    });
  });

  it("does not expose the generic provider stream as a production route", async () => {
    const server = await listen();
    servers.push(server);
    const response = await fetch(`${serverUrl(server)}/api/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });

  it.each(["null", "http://localhost:5174", "not an origin"])(
    "actively rejects unknown preflight origin %s",
    async (origin) => {
      const server = await listen();
      servers.push(server);
      const response = await fetch(`${serverUrl(server)}/api/workspaces`, {
        method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "GET" },
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      expect(response.status).toBe(403);
      expect(json.ok).toBe(false);
      if (!json.ok) expect(json.error.code).toBe("forbidden_origin");
    }
  );

  it("blocks hostile workspace mutation without side effects but permits browser and local clients", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "vellum-api-boundary-"));
    vi.stubEnv("VELLUM_WORKSPACES_DIR", directory);
    try {
      const server = await listen();
      servers.push(server);
      const request = (origin?: string) =>
        fetch(`${serverUrl(server)}/api/workspaces`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(origin ? { Origin: origin } : {}),
          },
          body: JSON.stringify({ title: "Boundary test", brief: { targetConfigurations: [] } }),
        });
      expect((await request("https://hostile.example")).status).toBe(403);
      expect(readdirSync(directory)).toEqual([]);
      expect((await request("http://127.0.0.1:5173")).status).toBe(200);
      expect((await request()).status).toBe(200);
      expect(readdirSync(directory).filter((name) => name.startsWith("workspace."))).toHaveLength(
        2
      );
    } finally {
      if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses the same non-disclosing envelope for routing and parser failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const server = await listen();
    servers.push(server);
    const missing = await fetch(`${serverUrl(server)}/api/does-not-exist`);
    const missingJson = (await missing.json()) as ApiResponse<unknown>;
    expect(missing.status).toBe(404);
    expect(missingJson.ok).toBe(false);
    if (!missingJson.ok) expect(missingJson.error.code).toBe("not_found");

    const malformed = await fetch(`${serverUrl(server)}/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"title":',
    });
    const malformedJson = (await malformed.json()) as ApiResponse<unknown>;
    expect(malformed.status).toBe(400);
    expect(malformedJson.ok).toBe(false);
    if (!malformedJson.ok) {
      expect(malformedJson.error).toMatchObject({
        code: "invalid_request",
        message: "Invalid request body",
        status: 400,
      });
    }
  });

  it("returns a stable request-too-large envelope before route execution", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const server = await listen();
    servers.push(server);
    const response = await fetch(`${serverUrl(server)}/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(4 * 1024 * 1024) }),
    });
    const json = (await response.json()) as ApiResponse<unknown>;
    expect(response.status).toBe(413);
    expect(json.ok).toBe(false);
    if (!json.ok) {
      expect(json.error).toMatchObject({
        code: "request_too_large",
        message: "Request body is too large",
        status: 413,
      });
    }
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
      expect(json.data).toHaveLength(10);
      expect(json.data).toContainEqual(
        expect.objectContaining({ id: "baroque-lute-13", name: expect.any(String), courses: 13 })
      );
      expect(json.data).toContainEqual(
        expect.objectContaining({ id: "piano", name: expect.any(String), type: "keyboard" })
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

  it.each(["engrave", "chordify", "analyze", "lint"])(
    "registers the /api/%s POST route",
    async (route) => {
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
    }
  );
});

async function listen(): Promise<Server> {
  const server = createServer(createApp());

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  return server;
}

async function listening(server: Server): Promise<void> {
  if (server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
}

function serverUrl(server: Server): string {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return `http://127.0.0.1:${address.port}`;
}
