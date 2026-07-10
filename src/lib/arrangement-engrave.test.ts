import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadBrowserProfile } from "./browser-profiles.js";
import { arrangeFaithfulBaroqueGuitar } from "./baroque-guitar-arranger.js";
import { arrangementToEngraveParams, rationalToLilyDuration } from "./arrangement-engrave.js";
import { InstrumentModel } from "./instrument-model.js";
import { analyzeMusicologicalScore } from "./musicological-analysis.js";
import { parseExplicitVoiceLilypond } from "./restricted-lilypond.js";
import { engrave } from "../server/lib/engrave.js";

describe("Arrangement Score engraving projection", () => {
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
  });

  it("converts exact rational time to LilyPond durations", () => {
    expect(rationalToLilyDuration({ numerator: 3, denominator: 4 })).toBe("8.");
    expect(rationalToLilyDuration({ numerator: 1, denominator: 4 })).toBe("16");
    expect(() => rationalToLilyDuration({ numerator: 1, denominator: 3 })).toThrow(
      /cannot be represented/i
    );
  });
});
