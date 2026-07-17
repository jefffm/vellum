import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadBrowserProfile } from "./browser-profiles.js";
import {
  arrangeImitativeIntabulation,
  auditImitative,
  rankImitativeAssignments,
} from "./imitative-arranger.js";
import { InstrumentModel } from "./instrument-model.js";
import { imitativeArrangementToLilyPond } from "./imitative-engrave.js";
import { analyzeMusicologicalScore } from "./musicological-analysis.js";
import { parseExplicitVoiceLilypond } from "./restricted-lilypond.js";

describe("three-voice imitative intabulation search", () => {
  it("retains every voice and ordered subject entry on collision-free lute courses", () => {
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
    const model = InstrumentModel.fromProfile(loadBrowserProfile("renaissance-lute-6"));
    const lowFretAssignments = rankImitativeAssignments(score, model, "low-fret-polyphony");
    const continuityAssignments = rankImitativeAssignments(score, model, "voice-continuity");
    expect(lowFretAssignments.completeAssignmentCount).toBeGreaterThan(1);
    expect(continuityAssignments.completeAssignmentCount).toBeGreaterThan(1);
    expect(lowFretAssignments.selected.size).toBe(
      score.events.filter(({ type }) => type === "note").length
    );
    expect(continuityAssignments.selected.size).toBe(lowFretAssignments.selected.size);
    const result = arrangeImitativeIntabulation(score, analysis, model, {
      arrangementId: "arrangement.imitation",
      createdAt: "2026-07-10T14:00:00.000Z",
      targetConfiguration: {
        id: "target.renaissance-lute",
        instrumentId: "renaissance-lute-6",
        role: "solo",
        tuningId: "renaissance-g",
        notationLayouts: ["french-letter-tablature"],
        deliverables: ["pdf", "audio-preview"],
      },
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.selected).toMatchObject({
      transpositionPlan: { sourceKey: "C major", targetKey: "C major", semitones: 0 },
      preservationAudit: { status: "pass" },
    });
    expect(result.selected.preservationAudit.findings).toContainEqual(
      expect.objectContaining({ code: "imitation.ordered_entries_preserved" })
    );
    expect(result.selected.events).toHaveLength(score.events.length);
    expect(new Set(result.selected.events.map((event) => event.voiceId))).toEqual(
      new Set(["part.voiceone", "part.voicetwo", "part.voicethree"])
    );
    for (const source of score.events) {
      const arranged = result.selected.events.find((event) =>
        event.sourceEventIds.includes(source.id)
      )!;
      expect(arranged.voiceId).toBe(source.partId);
      expect(arranged.duration).toEqual(source.duration);
      if (source.type === "note") {
        expect(arranged.pitches).toEqual([source.pitch]);
        expect(arranged.positions).toHaveLength(1);
      }
    }
    expect(
      result.selected.transformationReport.filter((entry) => entry.entryType === "event")
    ).toHaveLength(score.events.length);
    expect(
      result.selected.transformationReport.filter((entry) => entry.entryType === "relationship")
    ).toHaveLength(
      analysis.preservationTargets.filter((target) => target.kind === "relationship").length
    );
    const lilypond = imitativeArrangementToLilyPond(result.selected, score);
    expect(lilypond).toContain(`data-arrangement-event-id . "${result.selected.events[0]!.id}"`);
    expect(lilypond).toContain(`data-measure-id . "${result.selected.events[0]!.measureId}"`);

    const orderedEntries = analysis.preservationTargets.find(
      (target) => target.relationshipType === "ordered_entries"
    )!;
    const secondEntryId = orderedEntries.eventGroups![1]![0]!;
    const firstEntry = result.selected.events.find((event) =>
      event.sourceEventIds.includes(orderedEntries.eventGroups![0]![0]!)
    )!;
    const mutated = result.selected.events.map((event) =>
      event.sourceEventIds.includes(secondEntryId)
        ? { ...event, measureId: firstEntry.measureId, onset: firstEntry.onset }
        : event
    );
    const audit = auditImitative(score, analysis, mutated, model);
    expect(audit.status).toBe("fail");
    expect(audit.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "imitation.onset_changed" }),
        expect.objectContaining({ code: "imitation.ordered_entries_changed" }),
      ])
    );
  });
});
