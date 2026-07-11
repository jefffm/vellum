import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadBrowserProfile } from "./browser-profiles.js";
import {
  arrangeFaithfulBaroqueGuitar,
  arrangeFaithfulPluckedString,
} from "./baroque-guitar-arranger.js";
import { arrangementToEngraveParams, rationalToLilyDuration } from "./arrangement-engrave.js";
import { InstrumentModel } from "./instrument-model.js";
import { analyzeMusicologicalScore } from "./musicological-analysis.js";
import { parseExplicitVoiceLilypond } from "./restricted-lilypond.js";
import { engrave } from "../server/lib/engrave.js";

describe("Arrangement Score engraving projection", () => {
  it("keeps LilyPond course order aligned with the baroque-guitar model", () => {
    const instrument = readFileSync(
      path.resolve(process.cwd(), "instruments/baroque-guitar-5.ily"),
      "utf8"
    );
    expect(instrument).toContain("guitarStringTunings = \\stringTuning <a d' g b e'>");
  });

  it("projects the audited Greensleeves result into French tablature and MIDI source", () => {
    const parsed = parseExplicitVoiceLilypond(
      readFileSync(
        path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
        "utf8"
      ),
      ["Soprano", "Alto", "Tenor", "Bass"]
    );
    const score = {
      id: "score.greensleeves",
      scoreTranscriptionId: "transcription.greensleeves",
      version: 1,
      ...parsed,
      createdAt: "2026-07-10T12:00:00.000Z",
    };
    const analysis = analyzeMusicologicalScore(score, {
      id: "analysis.greensleeves",
      createdAt: "2026-07-10T13:00:00.000Z",
    });
    const arrangement = arrangeFaithfulBaroqueGuitar(
      score,
      analysis,
      InstrumentModel.fromProfile(loadBrowserProfile("baroque-guitar-5")),
      {
        arrangementId: "arrangement.greensleeves",
        createdAt: "2026-07-10T14:00:00.000Z",
        targetConfiguration: {
          id: "target.baroque-guitar",
          instrumentId: "baroque-guitar-5",
          role: "solo",
          stringing: "french",
          notationLayouts: ["french-letter-tablature"],
          deliverables: ["pdf", "audio-preview"],
        },
      }
    ).selected;

    const params = arrangementToEngraveParams(arrangement, score);
    expect(params).toMatchObject({
      instrument: "baroque-guitar-5",
      template: "french-tab",
      key: { tonic: "f", mode: "major" },
      time: "6/8",
      pickup: "8",
    });
    expect(params.bars).toHaveLength(score.measures.length);

    const result = engrave(params);
    expect(result.warnings).toEqual([]);
    expect(result.source).toContain('\\include "instruments/baroque-guitar-5.ily"');
    expect(result.source).toContain("tablatureFormat = \\guitarTabFormat");
    expect(result.source).toContain("\\midi { \\tempo 4 = 70 }");
    expect(result.source).toContain("\\partial 8");
    expect(result.source).toContain("data-arrangement-event-id");
    expect(result.source).toContain(arrangement.events[0]!.id);
    expect(result.source).toContain(arrangement.events[0]!.measureId);
  });

  it("converts exact rational time to LilyPond durations", () => {
    expect(rationalToLilyDuration({ numerator: 3, denominator: 4 })).toBe("8.");
    expect(rationalToLilyDuration({ numerator: 1, denominator: 4 })).toBe("16");
    expect(() => rationalToLilyDuration({ numerator: 1, denominator: 3 })).toThrow(
      /cannot be represented/i
    );
  });

  it("projects classical guitar from audited pitches into one correctly spelled staff", () => {
    const parsed = parseExplicitVoiceLilypond(
      readFileSync(
        path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
        "utf8"
      ),
      ["Soprano", "Alto", "Tenor", "Bass"]
    );
    const score = {
      id: "score.greensleeves-classical",
      scoreTranscriptionId: "transcription.greensleeves",
      version: 1,
      ...parsed,
      createdAt: "2026-07-10T12:00:00.000Z",
    };
    const analysis = analyzeMusicologicalScore(score, {
      id: "analysis.greensleeves-classical",
      createdAt: "2026-07-10T13:00:00.000Z",
    });
    const arrangement = arrangeFaithfulPluckedString(
      score,
      analysis,
      InstrumentModel.fromProfile(loadBrowserProfile("classical-guitar-6")),
      {
        arrangementId: "arrangement.greensleeves-classical",
        createdAt: "2026-07-10T14:00:00.000Z",
        targetConfiguration: {
          id: "target.classical-guitar",
          instrumentId: "classical-guitar-6",
          role: "solo",
          tuningId: "standard",
          notationLayouts: ["standard-notation"],
          deliverables: ["pdf", "audio-preview"],
        },
      }
    ).selected;

    const params = arrangementToEngraveParams(arrangement, score);
    expect(params.template).toBe("solo-staff");
    expect(
      params.bars
        .flatMap((bar) => bar.events)
        .every(
          (event) =>
            event.type === "rest" ||
            (event.type === "note" && event.input === "pitch") ||
            (event.type === "chord" &&
              event.positions.every((position) => position.input === "pitch"))
        )
    ).toBe(true);

    const result = engrave(params);
    expect(result.source).toContain('\\clef "treble_8"');
    expect(result.source).toContain("fis'8");
    expect(result.source).toContain("dis'16");
    expect(result.source).not.toContain("\\new TabStaff");
    expect(result.source).not.toContain("ges'");
    expect(result.source).not.toContain("ees'");
  });
});
