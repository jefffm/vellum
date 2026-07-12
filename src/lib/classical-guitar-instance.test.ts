import { describe, expect, it } from "vitest";
import { loadProfile } from "../server/profiles.js";
import {
  assertInstrumentInstanceIdentity,
  createClassicalGuitarInstance,
  instrumentInstanceRange,
  soundingPitches,
} from "./instrument-instance.js";
import { InstrumentModel } from "./instrument-model.js";

describe("exact six-string classical-guitar Instrument Instance", () => {
  it("records six stable single stopped strings in standard tuning", () => {
    const instance = createClassicalGuitarInstance();
    expect(instance).toMatchObject({
      profileId: "classical-guitar-6",
      scaleLength: { value: 650, unit: "mm" },
      physicalSetup: {
        frets: 19,
        stringCount: 6,
        actionTrebleMm: 3,
        actionBassMm: 4,
      },
      tuningState: { variant: "standard", referencePitchHz: 440 },
      notationConfiguration: { system: "standard-notation" },
    });
    expect(instance.courses.map((course) => course.strings.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(instance.courses.map((course) => course.strings[0]!.id)).toEqual([
      "string.1",
      "string.2",
      "string.3",
      "string.4",
      "string.5",
      "string.6",
    ]);
    expect(instance.courses.every((course) => course.stopped)).toBe(true);
    expect(instance.courses.every((course) => course.strings[0]!.fretsWithCourse)).toBe(true);
    expect(instance.courses.map((course) => course.strings[0]!.openPitch)).toEqual([
      "E4",
      "B3",
      "G3",
      "D3",
      "A2",
      "E2",
    ]);
    expect(instrumentInstanceRange(instance, 19)).toEqual({ lowest: "E2", highest: "B5" });
    assertInstrumentInstanceIdentity(instance);
  });

  it("changes exact identity for scale, setup, and tuning-reference mutations", () => {
    const base = createClassicalGuitarInstance();
    for (const mutation of [
      createClassicalGuitarInstance({ scaleLengthMm: 660 }),
      createClassicalGuitarInstance({ actionTrebleMm: 2.5 }),
      createClassicalGuitarInstance({ actionBassMm: 3.5 }),
      createClassicalGuitarInstance({ referencePitchHz: 442 }),
    ]) {
      expect(mutation.contentDigest).not.toBe(base.contentDigest);
    }
  });

  it("uses the exact six-string mechanics while keeping right-hand coverage unknown", () => {
    const instance = createClassicalGuitarInstance();
    const model = InstrumentModel.fromProfile(loadProfile("classical-guitar-6"), instance);
    expect(soundingPitches(instance, 6, 3)).toEqual(["G2"]);
    expect(model.positionsForPitch("E4")).toEqual(
      expect.arrayContaining([
        { course: 1, fret: 0, quality: "open" },
        { course: 2, fret: 5, quality: "high_fret" },
      ])
    );
    expect(instance.techniqueApplicability).toContainEqual(
      expect.objectContaining({ technique: "right_hand_fingering", status: "unknown" })
    );
  });
});
