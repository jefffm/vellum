import { execFileSync } from "node:child_process";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { SubprocessRunner } from "../../src/server/lib/subprocess.js";
import { loadMusicXMLFixture } from "../lib/fixtures.js";

let music21Available = false;
let runner: SubprocessRunner;
let theoryPath: string;

beforeAll(() => {
  try {
    execFileSync("python3", ["-c", "import music21"], { stdio: "pipe" });
    music21Available = true;
  } catch {
    music21Available = false;
  }

  runner = new SubprocessRunner(30_000);
  theoryPath = path.resolve(process.cwd(), "src/server/theory.py");
});

describe("music21 integration — direct subprocess", () => {
  it("analyze returns key, timeSignature, voices, and chords for Bach chorale", async () => {
    if (!music21Available) return;

    const result = await runner.run({
      command: "python3",
      args: [theoryPath, "analyze"],
      stdin: loadMusicXMLFixture("bach-chorale-cmaj"),
      timeout: 30_000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");

    const data = JSON.parse(result.stdout) as Record<string, unknown>;

    expect(data.key).toBe("C major");
    expect(data.timeSignature).toBe("4/4");
    expect(Array.isArray(data.voices)).toBe(true);
    expect((data.voices as unknown[]).length).toBe(4);
    expect(Array.isArray(data.chords)).toBe(true);
    expect((data.chords as unknown[]).length).toBeGreaterThan(0);
  });

  it("analyze returns D major for All Creatures SATB", async () => {
    if (!music21Available) return;

    const result = await runner.run({
      command: "python3",
      args: [theoryPath, "analyze"],
      stdin: loadMusicXMLFixture("all-creatures-satb"),
      timeout: 30_000,
    });

    expect(result.exitCode).toBe(0);

    const data = JSON.parse(result.stdout) as Record<string, unknown>;

    expect(data.key).toBe("D major");
    expect(data.timeSignature).toBe("3/4");
  });

  it("chordify returns array of chords with bar, beat, pitches", async () => {
    if (!music21Available) return;

    const result = await runner.run({
      command: "python3",
      args: [theoryPath, "chordify"],
      stdin: loadMusicXMLFixture("bach-chorale-cmaj"),
      timeout: 30_000,
    });

    expect(result.exitCode).toBe(0);

    const data = JSON.parse(result.stdout) as { chords: unknown[] };

    expect(Array.isArray(data.chords)).toBe(true);
    expect(data.chords.length).toBeGreaterThan(0);

    const first = data.chords[0] as Record<string, unknown>;
    expect(first).toHaveProperty("bar");
    expect(first).toHaveProperty("beat");
    expect(first).toHaveProperty("pitches");
    expect(Array.isArray(first.pitches)).toBe(true);
  });

  it("lint returns violations array structure", async () => {
    if (!music21Available) return;

    const result = await runner.run({
      command: "python3",
      args: [theoryPath, "lint"],
      stdin: loadMusicXMLFixture("parallel-fifths"),
      timeout: 30_000,
    });

    expect(result.exitCode).toBe(0);

    const data = JSON.parse(result.stdout) as { violations: unknown[] };

    expect(data).toHaveProperty("violations");
    expect(Array.isArray(data.violations)).toBe(true);
  });

  it("lint with bach chorale returns valid structure", async () => {
    if (!music21Available) return;

    const result = await runner.run({
      command: "python3",
      args: [theoryPath, "lint"],
      stdin: loadMusicXMLFixture("bach-chorale-cmaj"),
      timeout: 30_000,
    });

    expect(result.exitCode).toBe(0);

    const data = JSON.parse(result.stdout) as { violations: unknown[] };

    expect(data).toHaveProperty("violations");
    expect(Array.isArray(data.violations)).toBe(true);
  });

  it("exits non-zero with error JSON for empty stdin", async () => {
    if (!music21Available) return;

    const result = await runner.run({
      command: "python3",
      args: [theoryPath, "analyze"],
      stdin: "",
      timeout: 30_000,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it("chordify with hymn-simple fixture returns valid chords", async () => {
    if (!music21Available) return;

    const result = await runner.run({
      command: "python3",
      args: [theoryPath, "chordify"],
      stdin: loadMusicXMLFixture("hymn-simple"),
      timeout: 30_000,
    });

    expect(result.exitCode).toBe(0);

    const data = JSON.parse(result.stdout) as { chords: unknown[] };
    expect(Array.isArray(data.chords)).toBe(true);
    expect(data.chords.length).toBeGreaterThan(0);
  });
});
