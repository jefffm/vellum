import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadBrowserProfile } from "./browser-profiles.js";
import { InstrumentModel } from "./instrument-model.js";
import { analyzeMusicologicalScore } from "./musicological-analysis.js";
import { parseExplicitVoiceLilypond } from "./restricted-lilypond.js";
import {
  arrangeFaithfulBaroqueGuitar,
  auditFaithfulPrincipalVoice,
} from "./baroque-guitar-arranger.js";
import { noteToMidi, transposeNote } from "./pitch.js";

describe("faithful baroque-guitar arrangement search", () => {
  const fixture = buildFixture();

  it("keeps every Greensleeves melody event recognizable as the sounding top line", () => {
    const result = arrangeFaithfulBaroqueGuitar(fixture.score, fixture.analysis, fixture.model, {
      arrangementId: "arrangement.greensleeves-guitar",
      createdAt: "2026-07-10T14:00:00.000Z",
      targetConfiguration: {
        id: "target.baroque-guitar",
        instrumentId: "baroque-guitar-5",
        role: "solo",
        stringing: "french",
        notationLayouts: ["french-letter-tablature"],
        deliverables: ["pdf", "audio-preview"],
      },
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.selected.preservationAudit).toEqual({
      status: "pass",
      targetIds: [expect.stringMatching(/^target\./)],
      findings: [],
    });
    expect(result.selected.transpositionPlan).toMatchObject({
      sourceKey: "G major",
      targetKey: "F major",
      semitones: -2,
    });

    const protectedEvents = fixture.score.events.filter(
      (event) =>
        fixture.analysis.preservationTargets[0]!.eventIds.includes(event.id) &&
        event.type === "note"
    );
    expect(protectedEvents.length).toBeGreaterThan(40);
    for (const source of protectedEvents) {
      if (source.type !== "note") continue;
      const arranged = result.selected.events.find(
        (event) => event.principalVoiceSourceEventId === source.id
      );
      expect(arranged, source.id).toBeDefined();
      const expectedPitch = transposeNote(
        source.pitch,
        result.selected.transpositionPlan.semitones
      );
      expect(arranged!.pitches).toContain(expectedPitch);
      expect(Math.max(...arranged!.pitches.map(noteToMidi))).toBe(noteToMidi(expectedPitch));
      expect(arranged!.duration).toEqual(source.duration);
      expect(fixture.model.isPlayable(arranged!.positions).ok).toBe(true);
    }

    expect(result.selected.events.some((event) => event.type === "chord")).toBe(true);
    expect(
      result.selected.transformationReport.filter((entry) => entry.classification === "transposed")
        .length
    ).toBe(protectedEvents.length);
  });

  it("fails the audit if one protected melody event is dropped", () => {
    const result = arrangeFaithfulBaroqueGuitar(fixture.score, fixture.analysis, fixture.model, {
      arrangementId: "arrangement.greensleeves-guitar",
      createdAt: "2026-07-10T14:00:00.000Z",
      targetConfiguration: {
        id: "target.baroque-guitar",
        instrumentId: "baroque-guitar-5",
        role: "solo",
        stringing: "french",
        notationLayouts: ["french-letter-tablature"],
        deliverables: ["pdf", "audio-preview"],
      },
    });
    const protectedId = fixture.analysis.preservationTargets[0]!.eventIds[0]!;
    const events = result.selected.events.filter(
      (event) => event.principalVoiceSourceEventId !== protectedId
    );

    const audit = auditFaithfulPrincipalVoice(
      fixture.score,
      fixture.analysis,
      events,
      result.selected.transpositionPlan.semitones
    );
    expect(audit.status).toBe("fail");
    expect(audit.findings).toContainEqual(
      expect.objectContaining({
        sourceEventId: protectedId,
        code: "principal.omitted",
        severity: "hard",
      })
    );
  });
});

function buildFixture() {
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
  const model = InstrumentModel.fromProfile(loadBrowserProfile("baroque-guitar-5"));
  return { score, analysis, model };
}
