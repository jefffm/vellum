import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiResponse } from "../../lib/api-contract.js";
import { ApiRouteError, createApiRoute } from "./create-route.js";

const RequestSchema = Type.Object({ source: Type.String({ minLength: 1 }) });

type RouteCase = {
  name: string;
  body: unknown;
  handlerThrows?: boolean;
  expectStatus: number;
  expectOk: boolean;
};

const cases: RouteCase[] = [
  {
    name: "valid input",
    body: { source: "test" },
    expectStatus: 200,
    expectOk: true,
  },
  {
    name: "missing field",
    body: {},
    expectStatus: 400,
    expectOk: false,
  },
  {
    name: "handler error",
    body: { source: "test" },
    handlerThrows: true,
    expectStatus: 500,
    expectOk: false,
  },
];

describe("createApiRoute", () => {
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
    vi.restoreAllMocks();
  });

  it.each(cases)(
    "$name -> $expectStatus",
    async ({ body, handlerThrows, expectStatus, expectOk }) => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const handler = vi.fn(async (input: { source: string }) => {
        if (handlerThrows) {
          throw new Error("handler exploded");
        }

        return { echoed: input.source };
      });
      const app = express();
      app.use(express.json());
      app.post(
        "/api/test",
        createApiRoute({
          validate: (candidate) => Value.Decode(RequestSchema, candidate),
          handler,
        })
      );
      const server = await listen(app);
      servers.push(server);

      const response = await fetch(`${serverUrl(server)}/api/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as ApiResponse<{ echoed: string }>;

      expect(response.status).toBe(expectStatus);
      expect(json.ok).toBe(expectOk);
      expect(response.headers.get("x-vellum-correlation-id")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f-]{27,}$/
      );

      if (json.ok) {
        expect(json.data).toEqual({ echoed: "test" });
        expect(handler).toHaveBeenCalledOnce();
      } else if (expectStatus === 400) {
        expect(json.error).toMatchObject({
          code: "invalid_request",
          status: 400,
          correlationId: response.headers.get("x-vellum-correlation-id"),
        });
        expect(handler).not.toHaveBeenCalled();
      } else {
        expect(json.error).toMatchObject({
          code: "internal_error",
          message: "Internal server error",
          status: 500,
          correlationId: response.headers.get("x-vellum-correlation-id"),
        });
        expect(handler).toHaveBeenCalledOnce();
      }
    }
  );

  it("preserves stable expected codes, details, and redacted public messages", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const app = express();
    app.use(express.json());
    app.post(
      "/api/test",
      createApiRoute({
        validate: () => ({}),
        handler: async () => {
          throw new ApiRouteError(
            "Conflict for Bearer bearer-secret api_key=sk-1234567890",
            409,
            "conflict",
            { workspaceId: "workspace.1234567890abcdef", token: "detail-secret" }
          );
        },
      })
    );
    const server = await listen(app);
    servers.push(server);
    const response = await fetch(`${serverUrl(server)}/api/test`, { method: "POST" });
    const body = await response.text();
    expect(response.status).toBe(409);
    const json = JSON.parse(body) as ApiResponse<unknown>;
    expect(json.ok).toBe(false);
    if (json.ok) return;
    expect(json.error).toMatchObject({
      code: "conflict",
      status: 409,
      details: { workspaceId: "workspace.1234567890abcdef", token: "[redacted]" },
    });
    expect(body).not.toMatch(/bearer-secret|sk-1234567890|detail-secret/);
    expect(body).toContain("[redacted]");
  });

  it("keeps unexpected diagnostics server-side, correlated, and redacted", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = express();
    app.use(express.json());
    app.post(
      "/api/test",
      createApiRoute({
        validate: () => ({}),
        handler: async () => {
          throw new Error("canary Bearer bearer-secret api_key=sk-1234567890");
        },
      })
    );
    const server = await listen(app);
    servers.push(server);
    const response = await fetch(`${serverUrl(server)}/api/test`, { method: "POST" });
    const body = (await response.json()) as ApiResponse<unknown>;
    expect(body.ok).toBe(false);
    if (body.ok) return;
    expect(body.error.message).toBe("Internal server error");
    const diagnostic = String(errorSpy.mock.calls[0]?.[0]);
    expect(diagnostic).toContain(body.error.correlationId);
    expect(diagnostic).toContain("canary");
    expect(diagnostic).not.toMatch(/bearer-secret|sk-1234567890/);
  });

  it("does not raise a post-response error while logging the correlation ID", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const postResponseErrors: unknown[] = [];
    const app = express();
    app.use(express.json());
    app.post(
      "/api/test",
      createApiRoute({
        validate: () => ({}),
        handler: async () => ({ saved: true }),
      })
    );
    app.use(((error, _request, response, _next) => {
      postResponseErrors.push(error);
      if (!response.headersSent) response.status(500).end();
    }) satisfies express.ErrorRequestHandler);
    const server = await listen(app);
    servers.push(server);
    const response = await fetch(`${serverUrl(server)}/api/test`, { method: "POST" });
    expect(response.status).toBe(200);
    await response.body?.cancel();
    await new Promise((resolve) => setImmediate(resolve));
    expect(postResponseErrors).toEqual([]);
    expect(logSpy).toHaveBeenCalledOnce();
    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toMatchObject({
      event: "api_request",
      correlationId: response.headers.get("x-vellum-correlation-id"),
      status: 200,
    });
  });

  it("does not trust a status-like property on an unexpected thrown value", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = express();
    app.use(express.json());
    app.post(
      "/api/test",
      createApiRoute({
        validate: () => ({}),
        handler: async () => Promise.reject({ status: 400, message: "forged expected error" }),
      })
    );
    const server = await listen(app);
    servers.push(server);
    const response = await fetch(`${serverUrl(server)}/api/test`, { method: "POST" });
    const json = (await response.json()) as ApiResponse<unknown>;
    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    if (!json.ok) expect(json.error.code).toBe("internal_error");
  });

  it("logs a bounded route template instead of a secret-bearing concrete path", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const app = express();
    app.get(
      "/api/items/:id",
      createApiRoute({
        validate: (_body, request) => ({ id: String(request.params.id) }),
        handler: async ({ id }) => ({ id }),
      })
    );
    const server = await listen(app);
    servers.push(server);
    const secret = "api_key=sk-1234567890";
    const response = await fetch(`${serverUrl(server)}/api/items/${encodeURIComponent(secret)}`);
    expect(response.status).toBe(200);
    await response.body?.cancel();
    await new Promise((resolve) => setImmediate(resolve));
    expect(logSpy).toHaveBeenCalledOnce();
    const diagnostic = String(logSpy.mock.calls[0]?.[0]);
    expect(diagnostic).toContain('"path":"/api/items/:id"');
    expect(diagnostic).not.toContain(secret);
    expect(diagnostic).not.toContain("sk-1234567890");
  });
});

async function listen(app: express.Express): Promise<Server> {
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
