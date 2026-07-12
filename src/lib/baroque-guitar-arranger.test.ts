import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadBrowserProfile } from "./browser-profiles.js";
import { buildAudioPreview } from "./audio-preview.js";
import { InstrumentModel } from "./instrument-model.js";
import { analyzeMusicologicalScore } from "./musicological-analysis.js";
import { parseExplicitVoiceLilypond } from "./restricted-lilypond.js";
import {
  arrangeFaithfulBaroqueGuitar,
  auditFaithfulPrincipalVoice,
  isViolentCrossNeckJump,
  PhraseSearchExhaustedError,
} from "./baroque-guitar-arranger.js";
import { noteToMidi, transposeNote } from "./pitch.js";
import { arrangeCreativeParaphrase } from "./creative-arranger.js";
import { createBaroqueGuitarInstance } from "./instrument-instance.js";
import { arrangementToEngraveParams } from "./arrangement-engrave.js";
import { engrave } from "../server/lib/engrave.js";

describe("faithful baroque-guitar arrangement search", () => {
  const fixture = buildFixture();

  it("produces materially distinct creative candidate families only under free paraphrase", () => {
    const result = arrangeCreativeParaphrase(fixture.score, fixture.analysis, fixture.model, {
      arrangementId: "arrangement.greensleeves-creative",
      createdAt: "2026-07-12T19:30:00.000Z",
      targetConfiguration: {
        id: "target.baroque-guitar",
        instrumentId: "baroque-guitar-5",
        role: "solo",
        stringing: "french",
        notationLayouts: ["french-letter-tablature"],
        deliverables: ["pdf", "audio-preview"],
      },
      preservationPolicy: "free_paraphrase",
      allowedStrategies: ["ornamented-paraphrase", "idiomatic-revoicing"],
    });
    expect(result.candidates.map((candidate) => candidate.strategy)).toEqual([
      "ornamented-paraphrase",
      "idiomatic-revoicing",
    ]);
    expect(result.candidates[0]!.events).not.toEqual(result.candidates[1]!.events);
    expect(
      result.candidates[0]!.events.some(
        (event, index) =>
          event.pitches.length !== result.candidates[1]!.events[index]?.pitches.length
      )
    ).toBe(true);
  });

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
    expect(result.selected.preservationAudit.status).toBe("pass");
    expect(result.selected.preservationAudit.targetIds).toEqual(
      fixture.analysis.preservationTargets.map((target) => target.id)
    );
    expect(result.selected.preservationAudit.findings).toEqual([]);
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

    const preview = buildAudioPreview(result.selected, fixture.score);
    for (const source of protectedEvents) {
      if (source.type !== "note") continue;
      const expectedMidi = noteToMidi(
        transposeNote(source.pitch, result.selected.transpositionPlan.semitones)
      );
      expect(
        preview.events.some(
          (event) =>
            event.part === "principal-voice" &&
            event.sourceEventIds.includes(source.id) &&
            event.midi === expectedMidi
        ),
        `Audio Preview omitted Principal Voice event ${source.id}`
      ).toBe(true);
    }

    expect(result.selected.events.some((event) => event.type === "chord")).toBe(true);
    expect(
      result.selected.transformationReport.filter(
        (entry) => entry.entryType === "event" && entry.classification === "transposed"
      ).length
    ).toBe(protectedEvents.length);
  });

  it("projects the same source through exact stringing-dependent arrangement, playback, and engraving", () => {
    const sourceSnapshot = structuredClone(fixture.score);
    const arrange = (stringing: "french" | "italian") => {
      const instrumentInstance = createBaroqueGuitarInstance(stringing);
      return arrangeFaithfulBaroqueGuitar(
        fixture.score,
        fixture.analysis,
        InstrumentModel.fromProfile(loadBrowserProfile("baroque-guitar-5"), instrumentInstance),
        {
          arrangementId: `arrangement.greensleeves-${stringing}`,
          createdAt: "2026-07-12T20:10:00.000Z",
          targetConfiguration: {
            id: `target.baroque-guitar-${stringing}`,
            instrumentId: "baroque-guitar-5",
            role: "solo",
            stringing,
            instrumentInstance,
            notationLayouts: ["french-letter-tablature"],
            deliverables: ["pdf", "audio-preview"],
          },
        }
      ).selected;
    };
    const french = arrange("french");
    const italian = arrange("italian");
    expect(fixture.score).toEqual(sourceSnapshot);
    expect(french.targetConfiguration.instrumentInstance?.contentDigest).not.toBe(
      italian.targetConfiguration.instrumentInstance?.contentDigest
    );
    expect(french.events).not.toEqual(italian.events);
    const frenchPreview = buildAudioPreview(french, fixture.score);
    const italianPreview = buildAudioPreview(italian, fixture.score);
    expect(frenchPreview.instrumentInstanceDigest).toBe(
      french.targetConfiguration.instrumentInstance?.contentDigest
    );
    expect(italianPreview.instrumentInstanceDigest).toBe(
      italian.targetConfiguration.instrumentInstance?.contentDigest
    );
    expect(frenchPreview.events).not.toEqual(italianPreview.events);
    expect(engrave(arrangementToEngraveParams(french, fixture.score)).source).not.toBe(
      engrave(arrangementToEngraveParams(italian, fixture.score)).source
    );
  });

  it("keeps the Greensleeves Principal Voice in a continuous playable hand position", () => {
    const result = arrangeFaithfulBaroqueGuitar(fixture.score, fixture.analysis, fixture.model, {
      arrangementId: "arrangement.greensleeves-continuity",
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
    const shifts = result.selected.events.flatMap((event, index, events) => {
      if (!event.principalVoiceSourceEventId || event.positions.length === 0) return [];
      const previous = events[index - 1];
      if (!previous?.principalVoiceSourceEventId || previous.positions.length === 0) return [];
      const previousPosition = previous.positions[0]!;
      const position = event.positions[0]!;
      const previousFretted = previous.positions.filter((candidate) => candidate.fret > 0);
      const fretted = event.positions.filter((candidate) => candidate.fret > 0);
      const previousHandPosition =
        previousFretted.length === 0
          ? 0
          : previousFretted.reduce((sum, candidate) => sum + candidate.fret, 0) /
            previousFretted.length;
      const handPosition =
        fretted.length === 0
          ? 0
          : fretted.reduce((sum, candidate) => sum + candidate.fret, 0) / fretted.length;
      return [
        {
          from: `${previousPosition.course}:${previousPosition.fret}`,
          to: `${position.course}:${position.fret}`,
          fretShift: Math.abs(position.fret - previousPosition.fret),
          handShift: Math.abs(handPosition - previousHandPosition),
        },
      ];
    });

    expect(
      Math.max(...shifts.map((shift) => shift.fretShift)),
      JSON.stringify(shifts)
    ).toBeLessThan(5);
    expect(
      Math.max(...shifts.map((shift) => shift.handShift)),
      JSON.stringify(shifts)
    ).toBeLessThan(5);
    const evidence = result.candidates.find(
      (candidate) => candidate.id === result.selected.selectedCandidateId
    )!.phraseSearchEvidence!;
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      completeness: "bounded",
      instrumentInstanceDigest: fixture.model.exactInstance()!.contentDigest,
      bassCapability: {
        status: "reentrant_limited",
        lowestSoundingPitch: "G3",
        bourdonCourses: [],
      },
      stateDimensions: expect.arrayContaining([
        "left_hand_fingers",
        "barre_frets",
        "hand_position",
        "held_notes",
        "occupied_courses",
        "exact_stringing",
        "applicable_technique",
      ]),
    });
    expect(evidence.expandedStates).toBeGreaterThan(0);
    expect(evidence.transitions).toHaveLength(
      result.selected.events.filter((event) => event.type !== "rest").length
    );
    expect(evidence.transitions.every((transition) => !transition.violentCrossNeckJump)).toBe(true);
    expect(
      evidence.transitions.every(
        (transition) =>
          Number.isFinite(transition.fretDisplacement) &&
          Number.isFinite(transition.courseDisplacement) &&
          Number.isFinite(transition.handPositionDelta) &&
          Array.isArray(transition.retainedCourses) &&
          typeof transition.barreChanged === "boolean"
      )
    ).toBe(true);
  });

  it("rejects the observed sixth-fret fifth-course to first-fret second-course jump", () => {
    expect(isViolentCrossNeckJump({ course: 5, fret: 6 }, { course: 2, fret: 1 })).toBe(true);
    expect(isViolentCrossNeckJump({ course: 5, fret: 6 }, { course: 4, fret: 2 })).toBe(false);
  });

  it("reports bounded exhaustion without claiming musical impossibility", () => {
    expect(() =>
      arrangeFaithfulBaroqueGuitar(fixture.score, fixture.analysis, fixture.model, {
        arrangementId: "arrangement.greensleeves-bounded-exhaustion",
        createdAt: "2026-07-10T14:00:00.000Z",
        targetConfiguration: {
          id: "target.baroque-guitar",
          instrumentId: "baroque-guitar-5",
          role: "solo",
          stringing: "french",
          instrumentInstance: fixture.model.exactInstance(),
          notationLayouts: ["french-letter-tablature"],
          deliverables: ["pdf", "audio-preview"],
        },
        phraseSearch: { frontierWidth: 1, maximumExpandedStates: 1 },
      })
    ).toThrowError(PhraseSearchExhaustedError);
    try {
      arrangeFaithfulBaroqueGuitar(fixture.score, fixture.analysis, fixture.model, {
        arrangementId: "arrangement.greensleeves-bounded-message",
        createdAt: "2026-07-10T14:00:00.000Z",
        targetConfiguration: {
          id: "target.baroque-guitar",
          instrumentId: "baroque-guitar-5",
          role: "solo",
          stringing: "french",
          instrumentInstance: fixture.model.exactInstance(),
          notationLayouts: ["french-letter-tablature"],
          deliverables: ["pdf", "audio-preview"],
        },
        phraseSearch: { frontierWidth: 1, maximumExpandedStates: 1 },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(PhraseSearchExhaustedError);
      expect((error as Error).message).toMatch(/exhausted/i);
      expect((error as Error).message).toMatch(/no impossibility claim/i);
    }
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

  it("fails relationship invariants when melody timing, order, contour, or cadence is mutated", () => {
    const result = arrangeFaithfulBaroqueGuitar(fixture.score, fixture.analysis, fixture.model, {
      arrangementId: "arrangement.greensleeves-mutation",
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
    const sequence = fixture.analysis.preservationTargets.find(
      (target) => target.relationshipType === "principal_sequence"
    )!;
    const cadence = fixture.analysis.preservationTargets.find(
      (target) => target.relationshipType === "cadential_goal"
    )!;
    const mutationId = sequence.eventIds[1]!;
    const firstEvent = result.selected.events.find(
      (event) => event.principalVoiceSourceEventId === sequence.eventIds[0]
    )!;
    const mutated = result.selected.events
      .filter((event) => event.principalVoiceSourceEventId !== cadence.eventIds[0])
      .map((event) =>
        event.principalVoiceSourceEventId === mutationId
          ? { ...event, measureId: firstEvent.measureId, onset: { numerator: 0, denominator: 1 } }
          : event
      );

    const audit = auditFaithfulPrincipalVoice(
      fixture.score,
      fixture.analysis,
      mutated,
      result.selected.transpositionPlan.semitones
    );
    expect(audit.status).toBe("fail");
    expect(audit.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "principal.onset_changed" }),
        expect.objectContaining({ code: "principal.sequence_changed" }),
        expect.objectContaining({ code: "principal.cadential_goal_changed" }),
        expect.objectContaining({ code: "principal.phrase_contour_changed" }),
      ])
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
  const model = InstrumentModel.fromProfile(
    loadBrowserProfile("baroque-guitar-5"),
    createBaroqueGuitarInstance("french")
  );
  return { score, analysis, model };
}
