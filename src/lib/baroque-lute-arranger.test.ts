import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { arrangeFaithfulPluckedString } from "./baroque-guitar-arranger.js";
import { loadBrowserProfile } from "./browser-profiles.js";
import { InstrumentModel } from "./instrument-model.js";
import { analyzeMusicologicalScore } from "./musicological-analysis.js";
import { noteToMidi, transposeNote } from "./pitch.js";
import { parseExplicitVoiceLilypond } from "./restricted-lilypond.js";

describe("faithful 13-course baroque-lute arrangement search", () => {
  it("creates an independently audited Greensleeves sibling in accord ordinaire", () => {
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
    const model = InstrumentModel.fromProfile(loadBrowserProfile("baroque-lute-13"));
    const result = arrangeFaithfulPluckedString(score, analysis, model, {
      arrangementId: "arrangement.greensleeves-lute",
      createdAt: "2026-07-10T14:00:00.000Z",
      targetConfiguration: {
        id: "target.baroque-lute",
        instrumentId: "baroque-lute-13",
        role: "solo",
        tuningId: "d_minor",
        notationLayouts: ["french-letter-tablature"],
        deliverables: ["pdf", "audio-preview"],
      },
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.selected.preservationAudit.status).toBe("pass");
    expect(result.selected.transpositionPlan).toMatchObject({
      sourceKey: "G major",
      targetKey: "D major",
      semitones: -5,
    });
    expect(result.selected.targetConfiguration).toMatchObject({
      instrumentId: "baroque-lute-13",
      tuningId: "d_minor",
    });

    const protectedIds = new Set(
      analysis.preservationTargets.find((target) => target.kind === "principal_voice")!.eventIds
    );
    const protectedEvents = score.events.filter(
      (event) => protectedIds.has(event.id) && event.type === "note"
    );
    for (const source of protectedEvents) {
      if (source.type !== "note") continue;
      const arranged = result.selected.events.find(
        (event) => event.principalVoiceSourceEventId === source.id
      )!;
      const expected = transposeNote(source.pitch, result.selected.transpositionPlan.semitones);
      expect(arranged.pitches).toContain(expected);
      expect(Math.max(...arranged.pitches.map(noteToMidi))).toBe(noteToMidi(expected));
      expect(model.isPlayable(arranged.positions).ok).toBe(true);
    }
    expect(
      result.selected.events.some((event) =>
        event.positions.some((position) => position.quality === "diapason")
      )
    ).toBe(true);
  });
});
