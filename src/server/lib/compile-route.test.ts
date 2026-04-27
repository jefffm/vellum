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
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ command: "lilypond" }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = (run.mock.calls as any[][])[0][0].args as string[];
    expect(callArgs).toContain("--svg");
    expect(callArgs).toContain("-o");
    expect(callArgs).toContain("output");
    expect(callArgs).toContain("source.ly");
    expect(callArgs).toContain("-I");
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
      subprocessResult({
        exitCode: 1,
        stderr: "source.ly:2:9: error: syntax error, unexpected }",
        files: new Map([["output.svg", Buffer.from("<svg>partial output</svg>")]]),
      })
    );
    const server = await listen(createCompileRoute({ runner: { run } }));
    servers.push(server);

    const response = await postCompile(server, { source: "{ invalid !!! }" });
    const json = (await response.json()) as ApiEnvelope<{
      svg?: string;
      errors: Array<{ line: number; message: string }>;
    }>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.errors).toContainEqual(
        expect.objectContaining({ line: 2, message: "syntax error, unexpected }" })
      );
      expect(json.data.svg).toBeUndefined();
    }
  });

  it("parses generic LilyPond errors", () => {
    expect(parseLilyPondErrors("fatal error: failed files: source.ly")).toEqual([
      expect.objectContaining({ line: 0, type: "lilypond", message: "failed files: source.ly" }),
    ]);
  });
});

describe("parseLilyPondErrors", () => {
  it("parses syntax error with line and type", () => {
    const stderr =
      "source.ly:15:5: error: syntax error, unexpected STRING\n  d'4 badtoken\n      ^";
    const errors = parseLilyPondErrors(stderr);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(15);
    expect(errors[0].type).toBe("syntax");
  });

  it("maps line to bar when source provided", () => {
    const source = '\\version "2.24.0"\n{ a4 b c d |\n  e f g a |\n  badtoken\n}';
    const stderr = "source.ly:4:3: error: syntax error, unexpected STRING";
    const errors = parseLilyPondErrors(stderr, source);
    expect(errors[0].bar).toBeGreaterThan(0);
  });

  it("classifies barcheck failure as barcheck type", () => {
    const stderr = "source.ly:22:1: warning: barcheck failed at: 3/4";
    const errors = parseLilyPondErrors(stderr);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("barcheck");
  });

  it("extracts beat from barcheck failure message", () => {
    const stderr = "source.ly:22:1: warning: barcheck failed at: 3/4";
    const errors = parseLilyPondErrors(stderr);
    expect(errors[0].beat).toBe(3);
  });

  it("skips continuation lines", () => {
    const stderr =
      "source.ly:15:5: error: syntax error\n  d'4 badtoken\n      ^\nsource.ly:20:1: error: another error";
    const errors = parseLilyPondErrors(stderr);
    expect(errors).toHaveLength(2);
  });

  it("returns empty for clean compilation", () => {
    const errors = parseLilyPondErrors("");
    expect(errors).toHaveLength(0);
  });

  it("works without source (backward compatible)", () => {
    const stderr = "source.ly:10:1: error: something wrong";
    const errors = parseLilyPondErrors(stderr);
    expect(errors[0].bar).toBe(0);
  });

  it("classifies undefined variable errors", () => {
    const stderr = "source.ly:5:3: error: unknown escaped string: \\badCommand";
    const errors = parseLilyPondErrors(stderr);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("undefined_variable");
  });

  it("classifies automatic string assignment failures", () => {
    const stderr = "source.ly:25:5: error: No string for pitch #<Pitch g, > (given frets ())";
    const errors = parseLilyPondErrors(stderr);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("string_assignment");
  });

  it("classifies note out of range", () => {
    const stderr = "source.ly:8:1: warning: pitch out of range";
    const errors = parseLilyPondErrors(stderr);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("note_out_of_range");
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
