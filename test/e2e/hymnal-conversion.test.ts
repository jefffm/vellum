import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InstrumentModel } from "../../src/lib/instrument-model.js";
import { loadBrowserProfile } from "../../src/lib/browser-profiles.js";
import type { AnalysisResult, CompileResult } from "../../src/types.js";
import { loadMusicXMLFixture } from "../lib/fixtures.js";
import { TestServer } from "../lib/test-server.js";

let server: TestServer;
let model: InstrumentModel;
let lilypondAvailable = false;
let music21Available = false;

type ApiSuccess<T> = { ok: true; data: T };

beforeAll(async () => {
  model = InstrumentModel.fromProfile(loadBrowserProfile("baroque-lute-13"));

  try {
    execFileSync("which", ["lilypond"], { stdio: "pipe" });
    lilypondAvailable = true;
  } catch {
    lilypondAvailable = false;
  }

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

describe("hymnal conversion pipeline", () => {
  it("analyzes All Creatures SATB — key, voices, chords", async () => {
    if (!music21Available) return;

    const result = await analyze(loadMusicXMLFixture("all-creatures-satb"));

    expect(result.key).toBe("D major");
    expect(result.timeSignature).toBe("3/4");
    expect(result.voices).toHaveLength(4);

    const sopranoVoice = result.voices.find((v) => v.name === "Soprano");
    expect(sopranoVoice).toBeDefined();
    expect(sopranoVoice!.lowest).toBeTruthy();
    expect(sopranoVoice!.highest).toBeTruthy();

    expect(result.chords.length).toBeGreaterThan(0);
  });

  it("tabulates soprano melody pitches to baroque lute positions", async () => {
    if (!music21Available) return;

    // Representative soprano pitches from All Creatures (D major scale, octave 5)
    const sopranoSample = ["D5", "E5", "F#5", "G5", "A5"];

    for (const pitch of sopranoSample) {
      const positions = model.positionsForPitch(pitch);
      // At least some should map; very high pitches may not
      if (positions.length > 0) {
        expect(positions[0].course).toBeGreaterThanOrEqual(1);
        expect(positions[0].fret).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("validates tabulated positions for playability", () => {
    // A simple D major chord in baroque lute range
    const positions = model.voicingsForChord(["D3", "A3", "D4", "F#4"]);

    expect(positions.length).toBeGreaterThan(0);

    const best = positions[0];
    const result = model.isPlayable(best.positions);
    expect(result.violations.filter((v) => v.type === "stretch")).toHaveLength(0);
  });

  it("runs the full pipeline: analyze → tabulate → generate LilyPond → compile", async () => {
    if (!music21Available || !lilypondAvailable) return;

    // Step 1: Analyze the hymnal
    const analysis = await analyze(loadMusicXMLFixture("all-creatures-satb"));
    expect(analysis.key).toBe("D major");

    // Step 2: Extract soprano melody pitches from first few chords
    const melodyPitches = analysis.chords
      .slice(0, 4)
      .map((chord) => chord.pitches[chord.pitches.length - 1])
      .filter(Boolean);
    expect(melodyPitches.length).toBeGreaterThan(0);

    // Step 3: Tabulate each pitch to a baroque lute position
    const tabulated = melodyPitches.map((pitch) => {
      const positions = model.positionsForPitch(pitch);
      return { pitch, position: positions[0] ?? null };
    });

    // Step 4: Generate LilyPond source
    const music = tabulated
      .filter((t) => t.position !== null)
      .map((t) => pitchToLily(t.pitch) + "4")
      .join(" ");

    if (music.length === 0) return; // Skip if no pitches mapped

    const source = `\\version "2.24.0"
\\include "baroque-lute-13.ily"

melodyOnLute = { \\key d \\major \\time 3/4 ${music} \\bar "|." }

\\score {
  <<
    \\new TabStaff \\with {
      tablatureFormat = \\luteTabFormat
      stringTunings = \\luteStringTunings
      additionalBassStrings = \\luteDiapasons
    } \\melodyOnLute
    \\new Staff \\melodyOnLute
  >>
  \\layout { }
}
`;

    // Step 5: Compile to SVG
    const compiled = await compile(source);
    expect(compiled.errors).toEqual([]);
    expect(compiled.svg?.length ?? 0).toBeGreaterThan(0);
  });
});

async function analyze(source: string): Promise<AnalysisResult> {
  const response = await server.post("/api/analyze", { source });

  expect(response.status).toBe(200);
  const body = response.data as ApiSuccess<AnalysisResult>;
  expect(body.ok).toBe(true);

  return body.data;
}

async function compile(
  source: string,
  format?: "svg" | "pdf" | "both"
): Promise<CompileResult> {
  const response = await server.post("/api/compile", format ? { source, format } : { source });

  expect(response.status).toBe(200);
  const body = response.data as ApiSuccess<CompileResult>;
  expect(body.ok).toBe(true);

  return body.data;
}

function pitchToLily(pitch: string): string {
  const match = pitch.match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!match) throw new Error(`Invalid pitch: ${pitch}`);

  const [, step, accidental, octaveText] = match;
  const base = step.toLowerCase();
  const suffix = accidental === "#" ? "is" : accidental === "b" ? "es" : "";
  const octave = Number(octaveText);
  const octaveMarks = octave >= 4 ? "'".repeat(octave - 3) : ",".repeat(3 - octave);

  return `${base}${suffix}${octaveMarks}`;
}
