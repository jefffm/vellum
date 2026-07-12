import { describe, expect, it } from "vitest";
import { loadProfile } from "../server/profiles.js";
import { engrave } from "../server/lib/engrave.js";
import {
  assertInstrumentInstanceIdentity,
  createBaroqueLuteInstance,
  instrumentInstanceRange,
  soundingPitches,
} from "./instrument-instance.js";
import { InstrumentModel } from "./instrument-model.js";

describe("exact thirteen-course baroque-lute Instrument Instances", () => {
  it("separates stopped paired courses from single unstopped diapasons", () => {
    const instance = createBaroqueLuteInstance();
    expect(instance.courses.map((course) => course.strings.length)).toEqual([
      1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(instance.courses.slice(0, 6).every((course) => course.stopped)).toBe(true);
    expect(instance.courses.slice(6).every((course) => !course.stopped)).toBe(true);
    expect(instance.courses.slice(6).every((course) => !course.strings[0]!.fretsWithCourse)).toBe(
      true
    );
    expect(soundingPitches(instance, 6, 2)).toEqual(["B2", "B2"]);
    expect(() => soundingPitches(instance, 7, 1)).toThrow(/unstopped/);
  });

  it("renders course 10 as ///a and sounds D2 in the default instance", () => {
    const instance = createBaroqueLuteInstance("d_minor");
    expect(instance.courses[9]).toMatchObject({
      course: 10,
      stopped: false,
      notationIdentity: "///a",
    });
    expect(soundingPitches(instance, 10, 0)).toEqual(["D2"]);
    expect(instrumentInstanceRange(instance)).toEqual({ lowest: "A1", highest: "Db5" });
    assertInstrumentInstanceIdentity(instance);
  });

  it("changes bass sounding pitches and identity without changing course signs", () => {
    const minor = createBaroqueLuteInstance("d_minor");
    const major = createBaroqueLuteInstance("d_major");
    expect(minor.contentDigest).not.toBe(major.contentDigest);
    expect(minor.courses.map((course) => course.notationIdentity)).toEqual(
      major.courses.map((course) => course.notationIdentity)
    );
    expect(soundingPitches(minor, 9, 0)).toEqual(["Eb2"]);
    expect(soundingPitches(major, 9, 0)).toEqual(["E2"]);
    expect(soundingPitches(major, 10, 0)).toEqual(["D2"]);
    expect(soundingPitches(minor, 11, 0)).toEqual(["C2"]);
    expect(soundingPitches(major, 11, 0)).toEqual(["C#2"]);
  });

  it("makes the selected immutable instance authoritative in InstrumentModel", () => {
    const instance = createBaroqueLuteInstance("d_major");
    const model = InstrumentModel.fromProfile(loadProfile("baroque-lute-13"), instance);
    expect(model.diapasonPitches()).toEqual(
      new Map([
        [7, "G2"],
        [8, "F#2"],
        [9, "E2"],
        [10, "D2"],
        [11, "C#2"],
        [12, "B1"],
        [13, "A1"],
      ])
    );
    expect(model.positionsForPitch("D2")).toContainEqual({
      course: 10,
      fret: 0,
      quality: "diapason",
    });
    expect(() => model.setDiapasonScheme("d_minor")).toThrow(/create a new instance/);
  });

  it("carries tuning and exact identity into otherwise equivalent engraving", () => {
    const minor = createBaroqueLuteInstance("d_minor");
    const major = createBaroqueLuteInstance("d_major");
    const render = (instance: typeof minor) =>
      engrave({
        instrument: "baroque-lute-13",
        template: "french-tab",
        diapason_scheme: instance.tuningState.variant,
        instrument_configuration: instance.tuningState.variant,
        instrument_instance_digest: instance.contentDigest,
        bars: [
          {
            events: [{ type: "note", input: "position", course: 10, fret: 0, duration: "1" }],
          },
        ],
      }).source;
    expect(render(minor)).toContain("d_minor configuration");
    expect(render(major)).toContain("d_major configuration");
    expect(render(minor)).not.toBe(render(major));
  });
});
