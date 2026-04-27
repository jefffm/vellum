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

describe("Flow My Tears compilation", () => {
  it("compiles Flow My Tears opening to SVG without errors", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("flow-my-tears-opening"));

    expect(data.errors).toEqual([]);
    expect(data.svg).toBeTruthy();
    expect(data.svg).toContain("<text");
  });

  it("reports voice and bar metadata", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("flow-my-tears-opening"));

    expect(data.errors).toEqual([]);
    // voiceCount reflects \new Voice declarations in source (1 explicit melody voice);
    // the lute part uses TabStaff, not Voice, so it's not counted
    expect(data.voiceCount).toBeGreaterThanOrEqual(1);
    expect(data.barCount).toBeGreaterThanOrEqual(4);
  });

  it("compiles with format 'both' to produce SVG and MIDI", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("flow-my-tears-opening"), "both");

    expect(data.errors).toEqual([]);
    expect(data.svg?.length ?? 0).toBeGreaterThan(0);
    expect(data.midi?.length ?? 0).toBeGreaterThan(0);
  });

  it("SVG output contains text elements for tab notation", async () => {
    if (!lilypondAvailable) return;

    const data = await compile(loadLyFixture("flow-my-tears-opening"));

    expect(data.errors).toEqual([]);
    expect(data.svg).toContain("<text");
  });
});

async function compile(source: string, format?: "svg" | "pdf" | "both"): Promise<CompileResult> {
  const response = await server.post("/api/compile", format ? { source, format } : { source });

  expect(response.status).toBe(200);
  const body = response.data as ApiSuccess<CompileResult>;
  expect(body.ok).toBe(true);

  return body.data;
}
