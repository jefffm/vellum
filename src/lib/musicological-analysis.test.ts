import { readFileSync } from "node:fs";
import path from "node:path";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { RecognizedScoreSchema } from "./music-domain.js";
import { parseExplicitVoiceLilypond } from "./restricted-lilypond.js";
import { analyzeMusicologicalScore } from "./musicological-analysis.js";

describe("musicological analysis", () => {
  it("identifies and protects the complete Greensleeves soprano tune", () => {
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
      createdAt: "2026-07-10T12:01:00.000Z",
    });

    expect(analysis).toMatchObject({
      principalVoicePartId: "part.soprano",
      texture: "homophonic-four-part",
    });
    const protectedIds = analysis.preservationTargets[0]!.eventIds;
    const sopranoNotes = score.events.filter(
      (event) => event.partId === "part.soprano" && event.type === "note"
    );
    expect(protectedIds).toEqual(sopranoNotes.map((event) => event.id));
    expect(protectedIds.length).toBeGreaterThan(40);
    expect(analysis.claims[0]?.statement).toMatch(/labeled soprano/i);
  });

  it("falls back to register evidence for unlabeled voices", () => {
    const score = {
      id: "score.unlabeled",
      scoreTranscriptionId: "transcription.unlabeled",
      version: 1,
      parts: [
        { id: "part.low", name: "Part 1", role: "other" as const },
        { id: "part.high", name: "Part 2", role: "other" as const },
      ],
      measures: [
        {
          id: "measure.0",
          index: 0,
          displayNumber: "0",
          duration: { numerator: 1, denominator: 1 },
        },
      ],
      events: [
        {
          id: "event.low.1",
          type: "note" as const,
          partId: "part.low",
          measureId: "measure.0",
          onset: { numerator: 0, denominator: 1 },
          duration: { numerator: 1, denominator: 1 },
          pitch: "C3",
        },
        {
          id: "event.high.1",
          type: "note" as const,
          partId: "part.high",
          measureId: "measure.0",
          onset: { numerator: 0, denominator: 1 },
          duration: { numerator: 1, denominator: 1 },
          pitch: "G4",
        },
      ],
      createdAt: "2026-07-10T12:00:00.000Z",
    };

    const analysis = analyzeMusicologicalScore(score, {
      id: "analysis.unlabeled",
      createdAt: "2026-07-10T12:01:00.000Z",
    });
    expect(analysis.principalVoicePartId).toBe("part.high");
    expect(analysis.claims[0]?.basis).toBe("inference");
  });
});

describe("continuo analysis", () => {
  it("protects the complete foundation and recognizes the prepared 4-3 suspension", () => {
    const recognized = Value.Decode(
      RecognizedScoreSchema,
      JSON.parse(
        readFileSync(
          path.resolve(process.cwd(), "test/fixtures/continuo/reviewed-score.json"),
          "utf8"
        )
      )
    );
    const score = {
      id: "score.continuo",
      scoreTranscriptionId: "transcription.continuo",
      version: 1,
      ...recognized,
      createdAt: "2026-07-10T12:00:00.000Z",
    };
    const analysis = analyzeMusicologicalScore(score, {
      id: "analysis.continuo",
      createdAt: "2026-07-10T13:00:00.000Z",
    });

    expect(analysis).toMatchObject({
      texture: "continuo",
      principalVoicePartId: "part.soprano",
      validationProfileId: "continuo.italian-baroque",
      contrapuntalTechniques: ["prepared_suspension"],
    });
    expect(analysis.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "continuo_foundation", confidence: 1 }),
        expect.objectContaining({ kind: "prepared_suspension", confidence: 1 }),
      ])
    );
    expect(analysis.preservationTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "continuo_foundation",
          eventIds: [
            "event.bass.1",
            "event.bass.2",
            "event.bass.3",
            "event.bass.4",
            "event.figure.1",
            "event.figure.2",
            "event.figure.3",
            "event.figure.4",
            "event.figure.5",
          ],
        }),
        expect.objectContaining({ kind: "relationship" }),
      ])
    );
  });
});

describe("imitative counterpoint analysis", () => {
  it("protects ordered subject entries, each voice continuity, and the cadence", () => {
    const parsed = parseExplicitVoiceLilypond(
      readFileSync(
        path.resolve(process.cwd(), "test/fixtures/imitation/imitative-passage.ly"),
        "utf8"
      ),
      ["VoiceOne", "VoiceTwo", "VoiceThree"]
    );
    const score = {
      id: "score.imitation",
      scoreTranscriptionId: "transcription.imitation",
      version: 1,
      ...parsed,
      createdAt: "2026-07-10T12:00:00.000Z",
    };
    const analysis = analyzeMusicologicalScore(score, {
      id: "analysis.imitation",
      createdAt: "2026-07-10T13:00:00.000Z",
    });

    expect(analysis).toMatchObject({
      texture: "imitative-polyphony",
      validationProfileId: "counterpoint.renaissance-imitative",
      contrapuntalTechniques: ["imitation"],
    });
    expect(analysis.principalVoicePartId).toBeUndefined();
    expect(analysis.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "contrapuntal_technique", confidence: 1 }),
        expect.objectContaining({ kind: "cadential_goal" }),
      ])
    );
    expect(analysis.preservationTargets.filter((target) => target.kind === "voice")).toHaveLength(
      3
    );
    expect(
      analysis.preservationTargets.find((target) => target.id.endsWith("ordered-entries"))?.eventIds
    ).toHaveLength(12);
    expect(
      analysis.preservationTargets.find((target) => target.id.endsWith("cadential-goal"))?.eventIds
    ).toHaveLength(3);
  });
});
