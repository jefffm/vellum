import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { alfabetoLookup } from "./alfabeto/lookup.js";
import { InstrumentModel } from "./instrument-model.js";
import { loadProfile } from "../server/profiles.js";
import { engrave } from "../server/lib/engrave.js";
import {
  createBaroqueGuitarInstance,
  canonicalInstrumentInstanceJson,
  assertInstrumentInstanceIdentity,
  digestInstrumentInstance,
  instrumentInstanceRange,
  soundingPitches,
} from "./instrument-instance.js";

describe("exact five-course baroque-guitar Instrument Instances", () => {
  it("models a single first course independently from doubled unison courses", () => {
    const instance = createBaroqueGuitarInstance("french");
    expect(instance.courses.map((course) => course.strings.length)).toEqual([1, 2, 2, 2, 2]);
    expect(soundingPitches(instance, 1, 0)).toEqual(["E4"]);
    expect(soundingPitches(instance, 2, 1)).toEqual(["C4", "C4"]);
    expect(instance.courses[0]?.notationIdentity).toBe("course-1");
  });

  it("produces deterministic, stringing-dependent unison, octave, and bourdon sounding sets", () => {
    const french = createBaroqueGuitarInstance("french");
    const italian = createBaroqueGuitarInstance("italian");
    const mixed = createBaroqueGuitarInstance("mixed");
    expect(soundingPitches(french, 4, 0)).toEqual(["D4", "D4"]);
    expect(soundingPitches(french, 5, 0)).toEqual(["A3", "A3"]);
    expect(soundingPitches(italian, 4, 0)).toEqual(["D4", "D3"]);
    expect(soundingPitches(italian, 5, 0)).toEqual(["A3", "A2"]);
    expect(soundingPitches(mixed, 4, 2)).toEqual(["E4", "E3"]);
    expect(soundingPitches(mixed, 5, 0)).toEqual(["A3", "A3"]);
    expect(instrumentInstanceRange(french).lowest).toBe("G3");
    expect(instrumentInstanceRange(italian).lowest).toBe("A2");
  });

  it("changes content identity for every physical or tuning mutation", () => {
    const base = createBaroqueGuitarInstance("french");
    const { id: _id, contentDigest: _digest, ...content } = base;
    expect(base.contentDigest).toBe(
      createHash("sha256").update(canonicalInstrumentInstanceJson(content)).digest("hex")
    );
    expect(digestInstrumentInstance(base)).toBe(base.contentDigest);
    expect(createBaroqueGuitarInstance("french")).toEqual(base);
    expect(createBaroqueGuitarInstance("mixed").contentDigest).not.toBe(base.contentDigest);
    expect(createBaroqueGuitarInstance("french", { scaleLengthMm: 700 }).contentDigest).not.toBe(
      base.contentDigest
    );
    expect(createBaroqueGuitarInstance("french", { referencePitchHz: 415 }).contentDigest).not.toBe(
      base.contentDigest
    );
    expect(() =>
      assertInstrumentInstanceIdentity({
        ...base,
        courses: base.courses.map((course) =>
          course.course === 5
            ? {
                ...course,
                strings: course.strings.map((string, index) =>
                  index === 0 ? { ...string, openPitch: "A2" } : string
                ),
              }
            : course
        ),
      })
    ).toThrow(/canonical content/);
  });

  it("keeps rasgueado and punteado as separate applicability claims", () => {
    const instance = createBaroqueGuitarInstance();
    const rasgueado = instance.techniqueApplicability.find(
      (claim) => claim.technique === "rasgueado"
    );
    const punteado = instance.techniqueApplicability.find(
      (claim) => claim.technique === "punteado"
    );
    expect(rasgueado).toMatchObject({ status: "applicable" });
    expect(punteado).toMatchObject({ status: "applicable" });
    expect(rasgueado).not.toBe(punteado);
  });

  it("makes the exact instance authoritative for mechanics and alfabeto sounding sets", () => {
    const profile = loadProfile("baroque-guitar-5");
    const french = createBaroqueGuitarInstance("french");
    const italian = createBaroqueGuitarInstance("italian");
    const frenchModel = InstrumentModel.fromProfile(profile, french);
    const italianModel = InstrumentModel.fromProfile(profile, italian);
    expect(frenchModel.soundingPitches(5, 0)).toEqual(["A3", "A3"]);
    expect(italianModel.soundingPitches(5, 0)).toEqual(["A3", "A2"]);
    expect(frenchModel.soundingRange().lowest).toBe("G3");
    expect(italianModel.soundingRange().lowest).toBe("A2");

    const frenchShape = alfabetoLookup({
      chordName: "G major",
      instrumentInstance: french,
    }).matches[0]!;
    const italianShape = alfabetoLookup({
      chordName: "G major",
      instrumentInstance: italian,
    }).matches[0]!;
    expect(italianShape.letter).toBe(frenchShape.letter);
    expect(italianShape.positions).toEqual(frenchShape.positions);
    expect(italianShape.physicalSoundingPitches).not.toEqual(frenchShape.physicalSoundingPitches);
  });

  it("identifies exact stringing in otherwise equivalent engraving", () => {
    const french = createBaroqueGuitarInstance("french");
    const italian = createBaroqueGuitarInstance("italian");
    const base = {
      instrument: "baroque-guitar-5",
      template: "french-tab",
      bars: [
        {
          events: [
            {
              type: "note" as const,
              input: "position" as const,
              course: 5,
              fret: 0,
              duration: "4",
            },
          ],
        },
      ],
    };
    const frenchSource = engrave({
      ...base,
      stringing: "french",
      instrument_instance_digest: french.contentDigest,
    }).source;
    const italianSource = engrave({
      ...base,
      stringing: "italian",
      instrument_instance_digest: italian.contentDigest,
    }).source;
    expect(frenchSource).toContain("french stringing");
    expect(italianSource).toContain("italian stringing");
    expect(frenchSource).not.toBe(italianSource);
  });
});
