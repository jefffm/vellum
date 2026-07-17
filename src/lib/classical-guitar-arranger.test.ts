import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { arrangeFaithfulPluckedString } from "./baroque-guitar-arranger.js";
import { loadBrowserProfile } from "./browser-profiles.js";
import { InstrumentModel } from "./instrument-model.js";
import { analyzeMusicologicalScore } from "./musicological-analysis.js";
import { noteToMidi, transposeNote } from "./pitch.js";
import { parseExplicitVoiceLilypond } from "./restricted-lilypond.js";
import { createClassicalGuitarInstance } from "./instrument-instance.js";
import { arrangementToEngraveParams } from "./arrangement-engrave.js";
import { engrave } from "../server/lib/engrave.js";
import { buildAudioPreview } from "./audio-preview.js";

describe("faithful classical-guitar arrangement search", () => {
  it("creates an independently audited standard-notation Greensleeves sibling", () => {
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
    const instrumentInstance = createClassicalGuitarInstance();
    const model = InstrumentModel.fromProfile(
      loadBrowserProfile("classical-guitar-6"),
      instrumentInstance
    );
    const result = arrangeFaithfulPluckedString(score, analysis, model, {
      arrangementId: "arrangement.greensleeves-classical-guitar",
      createdAt: "2026-07-10T14:00:00.000Z",
      targetConfiguration: {
        id: "target.classical-guitar",
        instrumentId: "classical-guitar-6",
        role: "solo",
        tuningId: "standard",
        instrumentInstance,
        notationLayouts: ["standard-notation"],
        deliverables: ["pdf", "audio-preview"],
      },
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.selected.preservationAudit).toMatchObject({ status: "pass", findings: [] });
    expect(result.selected.transpositionPlan).toMatchObject({
      sourceKey: "G major",
      targetKey: "G major",
      semitones: 0,
    });
    expect(result.selected.transpositionPlan.alternatives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          semitones: 0,
          status: "complete_solution",
          selected: true,
          sourcePitchClassCoverage: expect.any(Number),
          totalPositionMotion: expect.any(Number),
        }),
        expect.objectContaining({ status: "complete_solution", selected: false }),
      ])
    );
    expect(result.selected.targetConfiguration).toMatchObject({
      instrumentId: "classical-guitar-6",
      tuningId: "standard",
      notationLayouts: ["standard-notation"],
      instrumentInstance: expect.objectContaining({
        profileId: "classical-guitar-6",
        contentDigest: instrumentInstance.contentDigest,
      }),
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
      expect(arranged.positions.every((position) => position.quality !== "diapason")).toBe(true);
      expect(arranged.notationSemantics).toMatchObject({
        voiceId: source.partId,
        voiceLayer: 1,
        stemDirection: "up",
        soundingPitches: arranged.pitches,
        writtenToSoundingSemitones: -12,
        duration: source.duration,
        tie: source.tie ?? "none",
      });
      expect(arranged.notationSemantics!.writtenPitches).toEqual(
        arranged.pitches.map((pitch) =>
          pitch.replace(/(-?\d+)$/, (octave) => String(Number(octave) + 1))
        )
      );
    }
    const hiddenFrettedPositions = result.selected.events.flatMap((event) =>
      event.positions.filter((position) => position.fret > 0)
    );
    expect(hiddenFrettedPositions.length).toBeGreaterThan(0);
    expect(
      hiddenFrettedPositions.every((position) => position.leftHandFinger && position.handPosition)
    ).toBe(true);
    expect(hiddenFrettedPositions.some((position) => position.guideFromPreviousEventId)).toBe(true);
    const voiceConstituents = result.selected.events.flatMap(
      (event) => event.voiceConstituents ?? []
    );
    expect(
      new Set(voiceConstituents.map((constituent) => constituent.voiceId)).size
    ).toBeGreaterThan(1);
    expect(
      voiceConstituents.every((constituent) => {
        const source = score.events.find((event) => event.id === constituent.sourceEventId);
        return (
          source?.type === "note" &&
          source.partId === constituent.voiceId &&
          JSON.stringify(source.duration) === JSON.stringify(constituent.duration)
        );
      })
    ).toBe(true);
    const phraseEvidence = result.candidates.find(
      (candidate) => candidate.strategy === "economical-fingering"
    )!.phraseSearchEvidence!;
    expect(phraseEvidence).toMatchObject({
      completeness: "bounded",
      stateDimensions: expect.arrayContaining([
        "left_hand_position",
        "finger_occupation",
        "barre_frets",
        "guide_fingers",
        "sustained_positions",
        "active_voice_durations",
        "standard_notation_voices",
        "right_hand_scope_disclosure",
      ]),
      classicalTechniqueEvidence: {
        leftHandScope: "represented",
        rightHandScope: "represented",
        independentVoiceDuration: "represented",
        standardNotationVoices: "represented",
      },
    });
    expect(phraseEvidence.referenceComparison!.selectedTotalMotion).toBeLessThan(
      phraseEvidence.referenceComparison!.referenceTotalMotion
    );
    expect(
      phraseEvidence.transitions.some(
        (transition) => (transition.activeVoiceDurations?.length ?? 0) > 1
      )
    ).toBe(true);

    const params = arrangementToEngraveParams(result.selected, score);
    expect(params.template).toBe("solo-staff");
    expect(
      params.bars
        .flatMap((bar) => bar.events)
        .filter((event) => event.type !== "rest")
        .every(
          (event) =>
            (event.type === "note" && event.input === "pitch") ||
            (event.type === "chord" &&
              event.positions.every((position) => position.input === "pitch"))
        )
    ).toBe(true);
    const sourceOutput = engrave(params).source;
    expect(sourceOutput).toContain('\\clef "treble_8"');
    expect(sourceOutput).toContain("\\stemUp");
    expect(sourceOutput).toContain("\\stemDown");
    expect(sourceOutput).toContain('\\new Voice = "part.soprano"');
    expect(sourceOutput).not.toContain("\\new TabStaff");
    expect(sourceOutput).not.toContain("stringNumberOrientations");

    const preview = buildAudioPreview(result.selected, score);
    expect(preview.instrumentInstanceDigest).toBe(instrumentInstance.contentDigest);
    expect(preview.events).toHaveLength(
      result.selected.events.reduce(
        (count, event) =>
          count +
          (event.type === "rest" ? 0 : (event.voiceConstituents?.length ?? event.pitches.length)),
        0
      )
    );
    for (const playback of preview.events.filter((event) => event.part.startsWith("voice:"))) {
      const source = score.events.find((event) => event.id === playback.sourceEventIds[0]);
      expect(source?.type).toBe("note");
      if (source?.type === "note") {
        expect(playback.durationSeconds).toBeCloseTo(
          (source.duration.numerator / source.duration.denominator) * (60 / 70)
        );
      }
    }
  });
});
