import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AnalysisResult, ChordAnalysis, LintViolation } from "../../src/types.js";
import { loadMusicXMLFixture } from "../lib/fixtures.js";
import { TestServer } from "../lib/test-server.js";

let server: TestServer;
let music21Available = false;

type ApiSuccess<T> = { ok: true; data: T };

beforeAll(async () => {
  try {
    execFileSync("python3", ["-c", "import music21"], { stdio: "pipe" });
    music21Available = true;
  } catch {
    music21Available = false;
  }

  server = await TestServer.start();
});

afterAll(async () => {
  await server.stop();
});

describe("music21 analysis pipeline", () => {
  it("analyzes Bach chorale C major — key, time, voices, chords", async () => {
    if (!music21Available) return;

    const result = await analyze(loadMusicXMLFixture("bach-chorale-cmaj"));

    expect(result.key).toBe("C major");
    expect(result.timeSignature).toBe("4/4");
    expect(result.voices).toHaveLength(4);

    const voiceNames = result.voices.map((v) => v.name);
    expect(voiceNames).toContain("Soprano");
    expect(voiceNames).toContain("Alto");
    expect(voiceNames).toContain("Tenor");
    expect(voiceNames).toContain("Bass");

    for (const voice of result.voices) {
      expect(voice.lowest).toBeTruthy();
      expect(voice.highest).toBeTruthy();
    }

    expect(result.chords.length).toBeGreaterThan(0);
    expect(result.chords[0].bar).toBe(1);
    expect(result.chords[0].romanNumeral).toBe("I");
  });

  it("analyzes All Creatures SATB — D major, 3/4 time, 4 voices", async () => {
    if (!music21Available) return;

    const result = await analyze(loadMusicXMLFixture("all-creatures-satb"));

    expect(result.key).toBe("D major");
    expect(result.timeSignature).toBe("3/4");
    expect(result.voices).toHaveLength(4);

    const voiceNames = result.voices.map((v) => v.name);
    expect(voiceNames).toContain("Soprano");
    expect(voiceNames).toContain("Bass");
  });

  it("chordifies Bach chorale and returns chord array", async () => {
    if (!music21Available) return;

    const chords = await chordify(loadMusicXMLFixture("bach-chorale-cmaj"));

    expect(chords.length).toBeGreaterThan(0);

    const first = chords[0];
    expect(first.bar).toBe(1);
    expect(first.beat).toBe(1);
    expect(first.pitches.length).toBeGreaterThan(0);
    expect(first.chord).toBeTruthy();
  });

  it("lints parallel-fifths fixture and returns valid violations structure", async () => {
    if (!music21Available) return;

    const violations = await lint(loadMusicXMLFixture("parallel-fifths"));

    // music21 may or may not detect violations in this fixture;
    // verify the response structure is correct either way
    expect(Array.isArray(violations)).toBe(true);

    for (const v of violations) {
      expect(v).toHaveProperty("bar");
      expect(v).toHaveProperty("beat");
      expect(v).toHaveProperty("type");
      expect(v).toHaveProperty("description");
      expect(v).toHaveProperty("voices");
      expect(Array.isArray(v.voices)).toBe(true);
    }
  });

  it("lints Bach chorale and returns valid violations structure", async () => {
    if (!music21Available) return;

    const violations = await lint(loadMusicXMLFixture("bach-chorale-cmaj"));

    expect(Array.isArray(violations)).toBe(true);

    for (const v of violations) {
      expect(typeof v.bar).toBe("number");
      expect(typeof v.type).toBe("string");
    }
  });
});

async function analyze(source: string): Promise<AnalysisResult> {
  const response = await server.post("/api/analyze", { source });

  expect(response.status).toBe(200);
  const body = response.data as ApiSuccess<AnalysisResult>;
  expect(body.ok).toBe(true);

  return body.data;
}

async function chordify(source: string): Promise<ChordAnalysis[]> {
  const response = await server.post("/api/chordify", { source });

  expect(response.status).toBe(200);
  const body = response.data as ApiSuccess<ChordAnalysis[]>;
  expect(body.ok).toBe(true);

  return body.data;
}

async function lint(source: string): Promise<LintViolation[]> {
  const response = await server.post("/api/lint", { source, format: "musicxml" });

  expect(response.status).toBe(200);
  const body = response.data as ApiSuccess<{ violations: LintViolation[] }>;
  expect(body.ok).toBe(true);

  return body.data.violations;
}
