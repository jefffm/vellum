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
    expect(analysis.summary).toMatch(/Soprano is the best-supported Principal Voice/i);
    expect(analysis.passages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ texture: "homophonic-four-part", measureIds: expect.any(Array) }),
      ])
    );
    expect(analysis.passages?.[0]).toMatchObject({
      boundaries: { startReason: expect.any(String), endReason: expect.any(String) },
      roles: expect.arrayContaining([
        expect.objectContaining({ partId: "part.soprano", role: "principal_voice" }),
        expect.objectContaining({ partId: "part.bass", role: "bass" }),
      ]),
      phrases: expect.arrayContaining([
        expect.objectContaining({ partId: "part.soprano", eventIds: expect.any(Array) }),
      ]),
      cadences: [expect.objectContaining({ kind: "final_goal", goalEventIds: expect.any(Array) })],
    });
    expect(
      analysis.claims.every(
        (claim) => claim.scope && claim.evidence?.[0]?.kind === "score_observation"
      )
    ).toBe(true);
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
    expect(analysis.claims[0]?.evidence?.[0]?.explanation).toMatch(/median MIDI.*alternatives/i);
    expect(analysis.claims[0]?.alternatives).toEqual([
      expect.objectContaining({ statement: expect.stringMatching(/Part 1/) }),
    ]);
    expect(analysis.ambiguities).toEqual([
      expect.objectContaining({ critical: true, claimId: analysis.claims[0]!.id }),
    ]);
  });

  it("classifies texture by passage instead of forcing one label across the work", () => {
    const score = {
      id: "score.mixed-texture",
      scoreTranscriptionId: "transcription.mixed-texture",
      version: 1,
      parts: [
        { id: "part.tune", name: "Tune", role: "principal_voice" as const },
        { id: "part.inner", name: "Inner", role: "other" as const },
        { id: "part.bass", name: "Bass", role: "bass" as const },
      ],
      measures: [
        {
          id: "measure.1",
          index: 0,
          displayNumber: "1",
          duration: { numerator: 1, denominator: 1 },
        },
        {
          id: "measure.2",
          index: 1,
          displayNumber: "2",
          duration: { numerator: 1, denominator: 1 },
        },
      ],
      events: [
        ...["part.tune"].map((partId, index) => ({
          id: `event.intro.${index}`,
          type: "note" as const,
          partId,
          measureId: "measure.1",
          onset: { numerator: 0, denominator: 1 },
          duration: { numerator: 1, denominator: 1 },
          pitch: "G4",
        })),
        ...["part.tune", "part.inner", "part.bass"].map((partId, index) => ({
          id: `event.full.${index}`,
          type: "note" as const,
          partId,
          measureId: "measure.2",
          onset: { numerator: 0, denominator: 1 },
          duration: { numerator: 1, denominator: 1 },
          pitch: ["A4", "E4", "A2"][index]!,
        })),
      ],
      key: "A minor",
      createdAt: "2026-07-10T12:00:00.000Z",
    };
    const analysis = analyzeMusicologicalScore(score, {
      id: "analysis.mixed-texture",
      createdAt: "2026-07-10T12:01:00.000Z",
    });
    expect(analysis.passages?.map((passage) => passage.texture)).toEqual([
      "monophony",
      "polyphonic",
    ]);
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
    expect(analysis.profiles).toEqual([
      expect.objectContaining({ id: "continuo.italian-baroque", status: "selected" }),
      expect.objectContaining({ id: "continuo.french-baroque", status: "alternative" }),
    ]);
    expect(analysis.ambiguities).toEqual(
      expect.arrayContaining([expect.objectContaining({ critical: false })])
    );
    expect(analysis.passages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          texture: "continuo",
          contrapuntalTechniques: ["prepared_suspension"],
        }),
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
    expect(analysis.passages).toEqual([
      expect.objectContaining({
        texture: "imitative-polyphony",
        contrapuntalTechniques: ["imitation"],
      }),
    ]);
    expect(analysis.passages?.[0]?.roles.every((role) => role.role === "imitative_voice")).toBe(
      true
    );
    expect(analysis.profiles).toEqual([
      expect.objectContaining({ id: "counterpoint.renaissance-imitative", status: "selected" }),
    ]);
  });

  it("finds delayed interval-rhythm entries after unrelated opening notes", () => {
    const parts = ["one", "two", "three"].map((name) => ({
      id: `part.${name}`,
      name,
      role: "other" as const,
    }));
    const measures = Array.from({ length: 8 }, (_, index) => ({
      id: `measure.${index}`,
      index,
      displayNumber: `${index + 1}`,
      duration: { numerator: 4, denominator: 1 },
    }));
    const subject = [0, 2, 4, 7];
    const events = parts.flatMap((part, partIndex) => {
      const startMeasure = partIndex * 2 + 1;
      return [
        {
          id: `event.${part.id}.prelude`,
          type: "note" as const,
          partId: part.id,
          measureId: "measure.0",
          onset: { numerator: partIndex, denominator: 1 },
          duration: { numerator: 1, denominator: 2 },
          pitch: ["C4", "F3", "A2"][partIndex]!,
        },
        ...subject.map((offset, noteIndex) => ({
          id: `event.${part.id}.subject.${noteIndex + 1}`,
          type: "note" as const,
          partId: part.id,
          measureId: `measure.${startMeasure}`,
          onset: { numerator: noteIndex, denominator: 1 },
          duration: { numerator: 1, denominator: 1 },
          pitch: midiPitch(60 - partIndex * 5 + offset),
        })),
      ];
    });
    const analysis = analyzeMusicologicalScore(
      {
        id: "score.delayed-imitation",
        scoreTranscriptionId: "transcription.delayed-imitation",
        version: 1,
        parts,
        measures,
        events,
        createdAt: "2026-07-12T15:00:00.000Z",
      },
      { id: "analysis.delayed-imitation", createdAt: "2026-07-12T15:01:00.000Z" }
    );

    expect(analysis.texture).toBe("imitative-polyphony");
    expect(
      analysis.preservationTargets.find((target) => target.id.endsWith("ordered-entries"))
        ?.eventGroups
    ).toEqual([
      expect.arrayContaining(["event.part.one.subject.1"]),
      expect.arrayContaining(["event.part.two.subject.1"]),
      expect.arrayContaining(["event.part.three.subject.1"]),
    ]);
  });
});

function midiPitch(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
