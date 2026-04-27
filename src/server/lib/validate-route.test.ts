import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createValidateRoute } from "./validate-route.js";
import type { SubprocessResult } from "./subprocess.js";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

type ValidateResponse = {
  valid: boolean;
  errors: Array<{ bar: number; beat: number; line: number; type: string; message: string }>;
};

describe("createValidateRoute", () => {
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

  it("returns valid: true for clean source", async () => {
    const run = vi.fn(async () => subprocessResult({ exitCode: 0, stderr: "" }));
    const server = await listen(createValidateRoute({ runner: { run } }));
    servers.push(server);

    const response = await postValidate(server, {
      source: '\\version "2.24.0" { c\'4 d\' e\' f\' }',
    });
    const json = (await response.json()) as ApiEnvelope<ValidateResponse>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.valid).toBe(true);
      expect(json.data.errors).toEqual([]);
    }
  });

  it("returns valid: false for syntax errors", async () => {
    const run = vi.fn(async () =>
      subprocessResult({
        exitCode: 1,
        stderr: "source.ly:2:9: error: syntax error, unexpected }",
      })
    );
    const server = await listen(createValidateRoute({ runner: { run } }));
    servers.push(server);

    const response = await postValidate(server, { source: "{ invalid !!! }" });
    const json = (await response.json()) as ApiEnvelope<ValidateResponse>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.valid).toBe(false);
      expect(json.data.errors.length).toBeGreaterThan(0);
      expect(json.data.errors[0].type).toBe("syntax");
    }
  });

  it("returns valid: false for barcheck failures", async () => {
    const run = vi.fn(async () =>
      subprocessResult({
        exitCode: 1,
        stderr: "source.ly:22:1: warning: barcheck failed at: 3/4",
      })
    );
    const server = await listen(createValidateRoute({ runner: { run } }));
    servers.push(server);

    const response = await postValidate(server, { source: "{ c4 d e |}" });
    const json = (await response.json()) as ApiEnvelope<ValidateResponse>;

    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.valid).toBe(false);
      expect(json.data.errors[0].type).toBe("barcheck");
    }
  });

  it("returns 400 for empty source", async () => {
    const run = vi.fn(async () => subprocessResult());
    const server = await listen(createValidateRoute({ runner: { run } }));
    servers.push(server);

    const response = await postValidate(server, { source: "" });
    expect(response.status).toBe(400);
  });

  it("returns generic error on non-zero exit with no parseable errors", async () => {
    const run = vi.fn(async () =>
      subprocessResult({ exitCode: 1, stderr: "" })
    );
    const server = await listen(createValidateRoute({ runner: { run } }));
    servers.push(server);

    const response = await postValidate(server, { source: "{ c4 }" });
    const json = (await response.json()) as ApiEnvelope<ValidateResponse>;

    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.valid).toBe(false);
      expect(json.data.errors).toHaveLength(1);
      expect(json.data.errors[0].type).toBe("lilypond");
    }
  });

  it("passes -dno-print-pages flag to runner", async () => {
    const run = vi.fn(async () => subprocessResult());
    const server = await listen(createValidateRoute({ runner: { run } }));
    servers.push(server);

    await postValidate(server, { source: "{ c4 }" });

    expect(run).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = (run.mock.calls as any[][])[0][0].args as string[];
    expect(callArgs).toContain("-dno-print-pages");
    expect(callArgs).toContain("--loglevel=ERROR");
  });

  it("uses empty outputGlobs (no file generation)", async () => {
    const run = vi.fn(async () => subprocessResult());
    const server = await listen(createValidateRoute({ runner: { run } }));
    servers.push(server);

    await postValidate(server, { source: "{ c4 }" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callOptions = (run.mock.calls as any[][])[0][0];
    expect(callOptions.outputGlobs).toEqual([]);
  });
});

function subprocessResult(overrides: Partial<SubprocessResult> = {}): SubprocessResult {
  return {
    stdout: "",
    stderr: "",
    exitCode: 0,
    files: new Map(),
    durationMs: 1,
    ...overrides,
  };
}

async function postValidate(server: Server, body: unknown): Promise<Response> {
  return await fetch(`${serverUrl(server)}/api/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function listen(handler: express.RequestHandler): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.post("/api/validate", handler);
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
