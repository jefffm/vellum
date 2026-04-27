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

describe("BWV 996 Bourrée compilation", () => {
  it("compiles BWV 996 Bourrée opening to SVG without errors", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("bwv996-bourree-opening"));

    expect(data.errors).toEqual([]);
    expect(data.svg).toBeTruthy();
  });

  it("SVG output contains tab notation text elements", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("bwv996-bourree-opening"));

    expect(data.errors).toEqual([]);
    expect(data.svg).toContain("<text");
  });

  it("compiles with format 'both' to produce SVG and MIDI", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("bwv996-bourree-opening"), "both");

    expect(data.errors).toEqual([]);
    expect(data.svg?.length ?? 0).toBeGreaterThan(0);
    expect(data.midi?.length ?? 0).toBeGreaterThan(0);
  });

  it("produces at least 1 bar of music", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("bwv996-bourree-opening"));

    expect(data.errors).toEqual([]);
    expect(data.barCount).toBeGreaterThanOrEqual(1);
  });
});

async function compile(source: string, format?: "svg" | "pdf" | "both"): Promise<CompileResult> {
  const response = await server.post("/api/compile", format ? { source, format } : { source });

  expect(response.status).toBe(200);
  const body = response.data as ApiSuccess<CompileResult>;
  expect(body.ok).toBe(true);

  return body.data;
}
