import { Value } from "@sinclair/typebox/value";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { InstrumentProfile, InstrumentProfileSchema } from "../types.js";
import { InstrumentModel } from "./instrument-model.js";
import { loadAllBrowserProfiles, loadBrowserProfile } from "./browser-profiles.js";

const newProfileIds = [
  "renaissance-lute-6",
  "theorbo-14",
  "classical-guitar-6",
  "piano",
  "voice-soprano",
  "voice-alto",
  "voice-tenor",
  "voice-bass",
] as const;

describe("instrument profiles", () => {
  it.each(newProfileIds)("validates %s against InstrumentProfileSchema", (id) => {
    const profile = readProfile(id);
    expect(Value.Check(InstrumentProfileSchema, profile)).toBe(true);
  });

  it("loads all browser profiles", () => {
    const profiles = loadAllBrowserProfiles();
    expect(profiles).toHaveLength(10);
    expect(profiles.map((profile) => profile.id).sort()).toEqual([
      "baroque-guitar-5",
      "baroque-lute-13",
      "classical-guitar-6",
      "piano",
      "renaissance-lute-6",
      "theorbo-14",
      "voice-alto",
      "voice-bass",
      "voice-soprano",
      "voice-tenor",
    ]);
  });

  it("loads the renaissance lute browser profile", () => {
    const profile = loadBrowserProfile("renaissance-lute-6");
    expect(profile.tuning?.[0]).toMatchObject({ course: 1, note: "G4" });
    expect(profile.frets).toBe(8);
    expect(profile.notation).toBe("italian-number");
  });

  it("loads theorbo with octave-lower first courses and diapason schemes", () => {
    const profile = loadBrowserProfile("theorbo-14");
    expect(profile.tuning?.[0]).toMatchObject({ course: 1, note: "A3" });
    expect(profile.tuning?.[1]).toMatchObject({ course: 2, note: "E3" });
    expect(profile.diapason_schemes).toBeDefined();
    expect(profile.fretted_courses).toBe(6);
    expect(profile.open_courses).toBe(8);
  });

  it("loads classical guitar with 19 frets, 6 strings, and no diapason schemes", () => {
    const profile = loadBrowserProfile("classical-guitar-6");
    expect(profile.frets).toBe(19);
    expect(profile.strings).toBe(6);
    expect(profile.tuning).toHaveLength(6);
    expect(profile.diapason_schemes).toBeUndefined();
  });

  it("loads piano as a keyboard with no tuning", () => {
    const profile = loadBrowserProfile("piano");
    expect(profile.type).toBe("keyboard");
    expect(profile.tuning).toBeUndefined();
    expect(profile.range).toEqual({ lowest: "A0", highest: "C8" });
  });

  it("loads soprano voice with expected range", () => {
    const profile = loadBrowserProfile("voice-soprano");
    expect(profile.type).toBe("voice");
    expect(profile.range).toEqual({ lowest: "C4", highest: "A5" });
  });

  it.each(["renaissance-lute-6", "theorbo-14", "classical-guitar-6"])(
    "constructs InstrumentModel for fretted profile %s",
    (id) => {
      const model = InstrumentModel.fromProfile(loadBrowserProfile(id));
      expect(model.courseCount()).toBeGreaterThan(0);
    }
  );

  it.each(["piano", "voice-soprano", "voice-alto", "voice-tenor", "voice-bass"])(
    "constructs InstrumentModel for non-fretted profile %s",
    (id) => {
      const model = InstrumentModel.fromProfile(loadBrowserProfile(id));
      expect(model.courseCount()).toBe(0);
    }
  );
});

function readProfile(id: string): InstrumentProfile {
  const filePath = path.resolve(process.cwd(), "instruments", `${id}.yaml`);
  const document = yaml.load(fs.readFileSync(filePath, "utf8"));

  if (!Value.Check(InstrumentProfileSchema, document)) {
    throw new Error(`Invalid test profile: ${id}`);
  }

  return document;
}
