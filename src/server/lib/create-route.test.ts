import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiRoute } from "./create-route.js";

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
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
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
      const json = (await response.json()) as { ok: boolean; data?: unknown; error?: string };

      expect(response.status).toBe(expectStatus);
      expect(json.ok).toBe(expectOk);

      if (expectOk) {
        expect(json.data).toEqual({ echoed: "test" });
        expect(handler).toHaveBeenCalledOnce();
      } else if (expectStatus === 400) {
        expect(json.error).toEqual(expect.any(String));
        expect(handler).not.toHaveBeenCalled();
      } else {
        expect(json.error).toBe("handler exploded");
        expect(handler).toHaveBeenCalledOnce();
      }

      expect(logSpy).toHaveBeenCalledOnce();
      expect(logSpy.mock.calls[0]?.[0]).toMatch(
        new RegExp(`POST /api/test ${expectStatus} \\d+ms`)
      );
    }
  );
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
