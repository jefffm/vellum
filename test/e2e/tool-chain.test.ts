import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InstrumentModel } from "../../src/lib/instrument-model.js";
import { loadBrowserProfile } from "../../src/lib/browser-profiles.js";
import type { CompileResult, TabPosition, Voicing } from "../../src/types.js";
import { TestServer } from "../lib/test-server.js";

let server: TestServer;
let model: InstrumentModel;
let lilypondAvailable = false;

type ApiSuccess<T> = { ok: true; data: T };

beforeAll(async () => {
  model = InstrumentModel.fromProfile(loadBrowserProfile("baroque-lute-13"));

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

describe("tool chain pipeline", () => {
  it("maps each D minor scalar pitch to at least one baroque lute position", () => {
    const pitches = scalarPitches();

    for (const pitch of pitches) {
      expect(model.positionsForPitch(pitch), pitch).not.toEqual([]);
    }
  });

  it("finds at least one D minor chord voicing", () => {
    const voicings = dMinorVoicings();

    expect(voicings.length).toBeGreaterThan(0);
    expect(voicings[0].stretch).toBeLessThan(5);
  });

  it("reports no stretch or same-course violations for the best voicing", () => {
    const best = dMinorVoicings()[0];
    const result = model.isPlayable(best.positions);
    const violationTypes = result.violations.map((violation) => violation.type);

    expect(result.ok).toBe(true);
    expect(violationTypes).not.toContain("stretch");
    expect(violationTypes).not.toContain("same_course");
  });

  it("catches a deliberately bad voicing", () => {
    const result = model.isPlayable([
      { course: 1, fret: 1, quality: "low_fret" },
      { course: 3, fret: 7, quality: "high_fret" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.type)).toContain("stretch");
  });

  it("generates LilyPond source from tabulated positions and compiles it to SVG", async () => {
    if (!lilypondAvailable) return;

    const source = generateScaleSource(scalarPitches());
    const response = await server.post("/api/compile", { source });

    expect(response.status).toBe(200);
    const body = response.data as ApiSuccess<CompileResult>;
    expect(body.ok).toBe(true);
    expect(body.data.errors).toEqual([]);
    expect(body.data.svg?.length ?? 0).toBeGreaterThan(0);
  });
});

function scalarPitches(): string[] {
  // The profile's 8-fret upper course reaches C#5; this keeps the scalar line inside the model range.
  return ["D4", "E4", "F4", "G4", "A4", "Bb4", "C#5", "C5"];
}

function dMinorVoicings(): Voicing[] {
  return model.voicingsForChord(["D3", "A3", "D4", "F4"]);
}

function generateScaleSource(pitches: string[]): string {
  const positionComments = pitches
    .map((pitch) => {
      const position = model.positionsForPitch(pitch)[0];
      return `% ${pitch} -> ${formatPosition(position)}`;
    })
    .join("\n");
  const music = pitches.map((pitch) => `${pitchToLily(pitch)}4`).join(" ");

  return `\\version "2.24.0"
\\include "baroque-lute-13.ily"
${positionComments}

scaleMusic = { \\key d \\minor \\time 4/4 ${music} \\bar "|." }

\\score {
  <<
    \\new TabStaff \\with {
      tablatureFormat = \\luteTabFormat
      stringTunings = \\luteStringTunings
      additionalBassStrings = \\luteDiapasons
    } \\scaleMusic
    \\new Staff \\scaleMusic
  >>
  \\layout { }
  \\midi { \\tempo 4 = 72 }
}
`;
}

function formatPosition(position: TabPosition | undefined): string {
  if (!position) {
    return "no position";
  }

  return `course ${position.course}, fret ${position.fret}`;
}

function pitchToLily(pitch: string): string {
  const match = pitch.match(/^([A-G])([#b]?)(-?\d+)$/);

  if (!match) {
    throw new Error(`Invalid pitch: ${pitch}`);
  }

  const [, step, accidental, octaveText] = match;
  const base = step.toLowerCase();
  const suffix = accidental === "#" ? "is" : accidental === "b" ? "es" : "";
  const octave = Number(octaveText);
  const octaveMarks = octave >= 4 ? "'".repeat(octave - 3) : ",".repeat(3 - octave);

  return `${base}${suffix}${octaveMarks}`;
}
