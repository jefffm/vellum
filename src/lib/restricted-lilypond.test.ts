import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseExplicitVoiceLilypond } from "./restricted-lilypond.js";

describe("restricted explicit-voice LilyPond parser", () => {
  it("derives reviewed SATB truth from the Greensleeves source", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
      "utf8"
    );
    const score = parseExplicitVoiceLilypond(source, ["Soprano", "Alto", "Tenor", "Bass"]);

    expect(score).toMatchObject({
      title: "Greensleeves",
      key: "G major",
      timeSignature: "6/8",
    });
    expect(score.parts.map((part) => part.name)).toEqual(["Soprano", "Alto", "Tenor", "Bass"]);
    expect(score.measures[0]).toMatchObject({
      id: "measure.0",
      displayNumber: "0",
      duration: { numerator: 1, denominator: 2 },
    });

    const soprano = score.events.filter((event) => event.partId === "part.soprano");
    expect(
      soprano
        .slice(0, 12)
        .map((event) =>
          event.type === "note"
            ? [event.pitch, event.duration.numerator, event.duration.denominator]
            : ["rest", event.duration.numerator, event.duration.denominator]
        )
    ).toEqual([
      ["E4", 1, 2],
      ["G4", 1, 1],
      ["A4", 1, 2],
      ["B4", 3, 4],
      ["C5", 1, 4],
      ["B4", 1, 2],
      ["A4", 1, 1],
      ["F#4", 1, 2],
      ["D4", 3, 4],
      ["E4", 1, 4],
      ["F#4", 1, 2],
      ["G4", 1, 1],
    ]);
    expect(soprano.every((event) => event.measureId.startsWith("measure."))).toBe(true);
    expect(score.events.filter((event) => event.partId === "part.bass").length).toBeGreaterThan(40);
  });

  it("rejects a voice that crosses a measure boundary", () => {
    const source = `\nTitle = { }\nVoice = { \\time 3/4 \\partial 4 c'2 c'2 }`;
    expect(() => parseExplicitVoiceLilypond(source, ["Voice"])).toThrow(
      /crosses a measure boundary/i
    );
  });
});
