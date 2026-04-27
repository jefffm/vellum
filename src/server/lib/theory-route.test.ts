import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnalyzeRoute, createChordifyRoute, createLintRoute } from "./theory-route.js";
import type { SubprocessResult } from "./subprocess.js";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

describe("theory routes", () => {
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

  it("returns chord analyses from /api/chordify", async () => {
    const run = vi.fn(async () =>
      subprocessResult({
        stdout: JSON.stringify({
          chords: [{ bar: 1, beat: 1, pitches: ["C4", "E4", "G4"], name: "C major" }],
        }),
      })
    );
    const server = await listen("/api/chordify", createChordifyRoute({ runner: { run } }));
    servers.push(server);

    const response = await post(server, "/api/chordify", { source: "<score-partwise/>" });
    const json = (await response.json()) as ApiEnvelope<unknown[]>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data).toEqual([
        { bar: 1, beat: 1, pitches: ["C4", "E4", "G4"], chord: "C major" },
      ]);
    }
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "python3",
        args: [expect.stringContaining("src/server/theory.py"), "chordify"],
        stdin: "<score-partwise/>",
        timeout: 30_000,
      })
    );
  });

  it("returns normalized analysis from /api/analyze", async () => {
    const run = vi.fn(async () =>
      subprocessResult({
        stdout: JSON.stringify({
          key: "C major",
          timeSignature: "4/4",
          voices: [{ name: "Soprano", lowest: "C4", highest: "G4" }],
          chords: [{ bar: 1, beat: 1, pitches: ["C4", "E4", "G4"], roman: "I" }],
        }),
      })
    );
    const server = await listen("/api/analyze", createAnalyzeRoute({ runner: { run } }));
    servers.push(server);

    const response = await post(server, "/api/analyze", { source: "<score-partwise/>" });
    const json = (await response.json()) as ApiEnvelope<{ key: string; chords: unknown[] }>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.key).toBe("C major");
      expect(json.data.chords).toContainEqual(
        expect.objectContaining({ bar: 1, romanNumeral: "I" })
      );
    }
  });

  it("returns lint violations from /api/lint", async () => {
    const run = vi.fn(async () =>
      subprocessResult({
        stdout: JSON.stringify({
          violations: [
            {
              bar: 2,
              beat: 1,
              type: "parallel_fifths",
              description: "Parallel fifths between soprano and bass",
              voices: ["Soprano", "Bass"],
            },
          ],
        }),
      })
    );
    const server = await listen("/api/lint", createLintRoute({ runner: { run } }));
    servers.push(server);

    const response = await post(server, "/api/lint", { source: "<score-partwise/>" });
    const json = (await response.json()) as ApiEnvelope<{ violations: unknown[] }>;

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data.violations).toEqual([
        {
          bar: 2,
          beat: 1,
          type: "parallel_fifths",
          description: "Parallel fifths between soprano and bass",
          voices: ["Soprano", "Bass"],
        },
      ]);
    }
  });

  it("returns 400 for an empty request body", async () => {
    const run = vi.fn(async () => subprocessResult());
    const server = await listen("/api/analyze", createAnalyzeRoute({ runner: { run } }));
    servers.push(server);

    const response = await post(server, "/api/analyze", {});
    const json = (await response.json()) as ApiEnvelope<unknown>;

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("maps theory.py errors to API errors", async () => {
    const run = vi.fn(async () =>
      subprocessResult({ exitCode: 1, stderr: JSON.stringify({ error: "malformed MusicXML" }) })
    );
    const server = await listen("/api/analyze", createAnalyzeRoute({ runner: { run } }));
    servers.push(server);

    const response = await post(server, "/api/analyze", { source: "<bad/>" });
    const json = (await response.json()) as ApiEnvelope<unknown>;

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    if (!json.ok) {
      expect(json.error).toContain("malformed MusicXML");
    }
  });

  it("maps empty stdin errors to 400", async () => {
    const run = vi.fn(async () =>
      subprocessResult({
        exitCode: 1,
        stderr: JSON.stringify({ error: "No MusicXML input on stdin" }),
      })
    );
    const server = await listen("/api/analyze", createAnalyzeRoute({ runner: { run } }));
    servers.push(server);

    const response = await post(server, "/api/analyze", { source: "" });
    const json = (await response.json()) as ApiEnvelope<unknown>;

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("maps subprocess timeouts to 500", async () => {
    const run = vi.fn(async () =>
      subprocessResult({
        exitCode: 124,
        stderr: "Timed out after 1ms\nProcess killed with SIGTERM",
      })
    );
    const server = await listen("/api/lint", createLintRoute({ runner: { run } }));
    servers.push(server);

    const response = await post(server, "/api/lint", { source: "<score-partwise/>" });
    const json = (await response.json()) as ApiEnvelope<unknown>;

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    if (!json.ok) {
      expect(json.error).toContain("Timed out");
    }
  });
});

function subprocessResult(overrides: Partial<SubprocessResult> = {}): SubprocessResult {
  return {
    stdout: "{}",
    stderr: "",
    exitCode: 0,
    files: new Map(),
    durationMs: 1,
    ...overrides,
  };
}

async function post(server: Server, path: string, body: unknown): Promise<Response> {
  return await fetch(`${serverUrl(server)}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function listen(path: string, handler: express.RequestHandler): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.post(path, handler);
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
