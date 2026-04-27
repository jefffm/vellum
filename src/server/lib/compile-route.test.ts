import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompileRoute, parseLilyPondErrors } from "./compile-route.js";
import type { SubprocessResult } from "./subprocess.js";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

type CompileResponse = {
  svg?: string;
  pdf?: string;
  errors: unknown[];
};

describe("createCompileRoute", () => {
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

  it("returns SVG artifacts from LilyPond", async () => {
    const run = vi.fn(async () =>
      subprocessResult({
        files: new Map([["output.svg", Buffer.from("<svg><g class='note'/></svg>")]]),
      })
    );
    const server = await listen(createCompileRoute({ runner: { run } }));
    servers.push(server);

    const response = await postCompile(server, { source: "\\version \"2.24.0\" { c'4 d' e' f' }" });
    const json = (await response.json()) as ApiEnvelope<CompileResponse>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.svg).toContain("<svg");
      expect(json.data.errors).toEqual([]);
    }
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ command: "lilypond", args: ["--svg", "-o", "output", "source.ly"] })
    );
  });

  it("returns base64 PDFs", async () => {
    const run = vi.fn(async () =>
      subprocessResult({ files: new Map([["output.pdf", Buffer.from("%PDF fake")]]) })
    );
    const server = await listen(createCompileRoute({ runner: { run } }));
    servers.push(server);

    const response = await postCompile(server, { source: "{ c'4 }", format: "pdf" });
    const json = (await response.json()) as ApiEnvelope<CompileResponse>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.pdf).toBe(Buffer.from("%PDF fake").toString("base64"));
    }
  });

  it("returns structured errors on LilyPond failure", async () => {
    const run = vi.fn(async () =>
      subprocessResult({ exitCode: 1, stderr: "source.ly:2:9: error: syntax error, unexpected }" })
    );
    const server = await listen(createCompileRoute({ runner: { run } }));
    servers.push(server);

    const response = await postCompile(server, { source: "{ invalid !!! }" });
    const json = (await response.json()) as ApiEnvelope<{
      errors: Array<{ line: number; message: string }>;
    }>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.errors).toContainEqual(
        expect.objectContaining({ line: 2, message: "syntax error, unexpected }" })
      );
    }
  });

  it("parses generic LilyPond errors", () => {
    expect(parseLilyPondErrors("fatal error: failed files: source.ly")).toEqual([
      expect.objectContaining({ line: 0, type: "lilypond", message: "failed files: source.ly" }),
    ]);
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

async function postCompile(server: Server, body: unknown): Promise<Response> {
  return await fetch(`${serverUrl(server)}/api/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function listen(handler: express.RequestHandler): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.post("/api/compile", handler);
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
