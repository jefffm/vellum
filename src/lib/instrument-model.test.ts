import { describe, expect, it } from "vitest";
import { loadProfile } from "../server/profiles.js";
import type { TabPosition } from "../types.js";
import { InstrumentModel } from "./instrument-model.js";

type PositionCase = {
  instrument: string;
  pitch: string;
  expected: TabPosition[];
};

const positionCases: PositionCase[] = [
  {
    instrument: "baroque-lute-13",
    pitch: "F4",
    expected: [{ course: 1, fret: 0, quality: "open" }],
  },
  {
    instrument: "baroque-lute-13",
    pitch: "G4",
    expected: [{ course: 1, fret: 2, quality: "low_fret" }],
  },
  {
    instrument: "baroque-lute-13",
    pitch: "A2",
    expected: [{ course: 6, fret: 0, quality: "open" }],
  },
  {
    instrument: "baroque-lute-13",
    pitch: "G2",
    expected: [{ course: 7, fret: 0, quality: "diapason" }],
  },
  {
    instrument: "baroque-guitar-5",
    pitch: "D4",
    expected: [
      { course: 2, fret: 3, quality: "low_fret" },
      { course: 4, fret: 0, quality: "open" },
    ],
  },
  {
    instrument: "baroque-guitar-5",
    pitch: "A3",
    expected: [
      { course: 3, fret: 2, quality: "low_fret" },
      { course: 5, fret: 0, quality: "open" },
    ],
  },
];

describe("InstrumentModel", () => {
  it.each(positionCases)(
    "finds positions for $instrument $pitch",
    ({ instrument, pitch, expected }) => {
      const model = modelFor(instrument);

      expect(model.positionsForPitch(pitch)).toEqual(expect.arrayContaining(expected));
    }
  );

  it("maps positions back to sounding pitches", () => {
    const lute = modelFor("baroque-lute-13");
    const guitar = modelFor("baroque-guitar-5");

    expect(lute.pitchAtPosition(1, 2)).toBe("G4");
    expect(lute.pitchAtPosition(7, 0)).toBe("G2");
    expect(guitar.soundingPitch(4, 0)).toBe("D4");
    expect(guitar.isReentrant(4)).toBe(true);
  });

  it("reports course constraints", () => {
    const lute = modelFor("baroque-lute-13");
    const guitar = modelFor("baroque-guitar-5");

    expect(lute.courseCount()).toBe(13);
    expect(lute.frettedCourseCount()).toBe(6);
    expect(lute.maxFrets()).toBe(8);
    expect(lute.maxStretch()).toBe(4);
    expect(lute.isFretted(6)).toBe(true);
    expect(lute.isDiapason(7)).toBe(true);
    expect(guitar.maxStretch()).toBe(5);
    expect(guitar.isDiapason(5)).toBe(false);
  });

  it("keeps diapasons open-only", () => {
    const lute = modelFor("baroque-lute-13");

    expect(() => lute.pitchAtPosition(7, 1)).toThrow(/diapason/i);
    expect(lute.positionsForPitch("Ab2")).toEqual([]);
  });

  it("switches diapason schemes", () => {
    const lute = modelFor("baroque-lute-13");

    expect(lute.diapasonPitches().get(8)).toBe("F2");
    lute.setDiapasonScheme("d_major");

    expect(lute.diapasonPitches().get(8)).toBe("F#2");
    expect(lute.positionsForPitch("F#2")).toEqual([{ course: 8, fret: 0, quality: "diapason" }]);
    expect(() => lute.setDiapasonScheme("unknown")).toThrow(/unknown diapason scheme/i);
  });

  it("enumerates playable chord voicings without same-course conflicts", () => {
    const lute = modelFor("baroque-lute-13");
    const voicings = lute.voicingsForChord(["D3", "A3", "D4", "F4"], 4);

    expect(voicings.length).toBeGreaterThanOrEqual(1);
    expect(voicings[0]?.positions).toEqual([
      { course: 5, fret: 0, quality: "open" },
      { course: 3, fret: 0, quality: "open" },
      { course: 2, fret: 0, quality: "open" },
      { course: 1, fret: 0, quality: "open" },
    ]);

    for (const voicing of voicings) {
      const courses = voicing.positions.map((position) => position.course);
      expect(new Set(courses).size).toBe(courses.length);
      expect(voicing.stretch).toBeLessThanOrEqual(4);
    }
  });

  it("detects playability violations", () => {
    const lute = modelFor("baroque-lute-13");

    expect(
      lute
        .isPlayable([
          { course: 1, fret: 1, quality: "low_fret" },
          { course: 3, fret: 7, quality: "high_fret" },
        ])
        .violations.map((violation) => violation.type)
    ).toContain("stretch");

    expect(
      lute
        .isPlayable([
          { course: 1, fret: 2, quality: "low_fret" },
          { course: 1, fret: 3, quality: "low_fret" },
        ])
        .violations.map((violation) => violation.type)
    ).toContain("same_course");
  });

  it("loads profiles via the static factory", async () => {
    const model = await InstrumentModel.load("baroque-guitar-5");

    expect(model.positionsForPitch("E4")).toContainEqual({ course: 1, fret: 0, quality: "open" });
  });
});

function modelFor(id: string): InstrumentModel {
  return InstrumentModel.fromProfile(loadProfile(id));
}
