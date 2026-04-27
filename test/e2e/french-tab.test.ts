import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CompileResult } from "../../src/types.js";
import { loadLyFixture } from "../lib/fixtures.js";
import { TestServer } from "../lib/test-server.js";

let server: TestServer;
let lilypondAvailable = false;

type ApiSuccess<T> = { ok: true; data: T };

beforeAll(async () => {
  try {
    execFileSync("which", ["lilypond"], { stdio: "pipe" });
    lilypondAvailable = true;
  } catch {
    lilypondAvailable = false;
  }

  server = await TestServer.start();
});

afterAll(async () => {
  await server.stop();
});

describe("French tab compile pipeline", () => {
  it("compiles a simple D minor scale to SVG with French letters", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("d-minor-scale-lute"));

    expect(data.errors).toEqual([]);
    expect(data.svg).toBeTruthy();
    expect(data.svg).toContain("<text");
  });

  it("renders a polyphonic passage with both voices", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("polyphonic-lute"));

    expect(data.errors).toEqual([]);
    expect(data.svg).toBeTruthy();
    expect(data.svg).toContain("<text");
    expect(data.voiceCount).toBeGreaterThanOrEqual(2);
  });

  it("compiles diapason bass notes without errors", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("diapason-test"));

    expect(data.errors).toEqual([]);
    expect(data.svg?.length ?? 0).toBeGreaterThan(0);
  });

  it("compiles the BWV 996 Bourree opening as valid French tab", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("bwv996-bourree-opening"));

    expect(data.errors).toEqual([]);
    expect(data.svg?.length ?? 0).toBeGreaterThan(0);
  });

  it("returns structured errors and no SVG for invalid source", async () => {
    if (!lilypondAvailable) return;

    const data = await compile('\\version "2.24.0"\n{ c4 d e f \\invalid_command }');

    expect(data.errors.length).toBeGreaterThan(0);
    expect(data.svg ?? "").toBe("");
  });

  it("returns MIDI output when requested", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("d-minor-scale-lute"), "both");

    expect(data.errors).toEqual([]);
    expect(data.svg?.length ?? 0).toBeGreaterThan(0);
    expect(data.midi?.length ?? 0).toBeGreaterThan(0);
  });
});

async function compile(source: string, format?: "svg" | "pdf" | "both"): Promise<CompileResult> {
  const response = await server.post("/api/compile", format ? { source, format } : { source });

  expect(response.status).toBe(200);
  const body = response.data as ApiSuccess<CompileResult>;
  expect(body.ok).toBe(true);

  return body.data;
}
