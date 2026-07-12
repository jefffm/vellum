import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  arrangeFaithfulPluckedString,
  styleBriseAuthorization,
} from "./baroque-guitar-arranger.js";
import { loadBrowserProfile } from "./browser-profiles.js";
import { InstrumentModel } from "./instrument-model.js";
import { analyzeMusicologicalScore } from "./musicological-analysis.js";
import { noteToMidi, transposeNote } from "./pitch.js";
import { parseExplicitVoiceLilypond } from "./restricted-lilypond.js";
import { createBaroqueLuteInstance } from "./instrument-instance.js";

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
    const instrumentInstance = createBaroqueLuteInstance("d_minor");
    const model = InstrumentModel.fromProfile(
      loadBrowserProfile("baroque-lute-13"),
      instrumentInstance
    );
    const result = arrangeFaithfulPluckedString(score, analysis, model, {
      arrangementId: "arrangement.greensleeves-lute",
      createdAt: "2026-07-10T14:00:00.000Z",
      targetConfiguration: {
        id: "target.baroque-lute",
        instrumentId: "baroque-lute-13",
        role: "solo",
        tuningId: "d_minor",
        instrumentInstance,
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
    const evidence = result.candidates.find(
      (candidate) => candidate.strategy === "economical-fingering"
    )!.phraseSearchEvidence!;
    expect(evidence).toMatchObject({
      completeness: "bounded",
      instrumentInstanceDigest: instrumentInstance.contentDigest,
      stateDimensions: expect.arrayContaining([
        "left_hand_stopped_courses",
        "right_hand_diapason_access",
        "prepared_bass_courses",
        "resonating_bass_courses",
        "damping_requirements",
        "held_notes",
        "voice_lineage",
        "exact_bass_tuning",
        "style_brise_authorization",
      ]),
      luteTechniqueEvidence: {
        stoppedCourseCount: 6,
        diapasonCount: 7,
        rightHandBassAccess: "represented",
        bassPreparation: "represented",
        resonance: "represented",
        damping: "represented",
        sustain: "represented",
        voiceLineage: "represented",
        styleBrise: { status: "not_applied", planDecisionIds: [], historicalClaimIds: [] },
      },
    });
    expect(
      evidence.transitions.some((transition) => (transition.diapasonCourses?.length ?? 0) > 0)
    ).toBe(true);
    expect(
      evidence.transitions.every(
        (transition) =>
          transition.stoppedCourseFretDelta !== undefined &&
          transition.rightHandBassAccessCount !== undefined &&
          transition.preparedBassCourses !== undefined &&
          transition.resonatingBassCourses !== undefined &&
          transition.dampingRequiredCourses !== undefined &&
          transition.styleBriseApplied === false
      )
    ).toBe(true);
    expect(evidence.referenceComparison!.selectedTotalMotion).toBeLessThan(
      evidence.referenceComparison!.referenceTotalMotion
    );
  });

  it("requires both a Plan Decision and historical-profile claim before style brise applies", () => {
    const base = buildMinimalAuthorizationFixture();
    expect(styleBriseAuthorization(undefined, base.analysis).status).toBe("not_applied");
    expect(styleBriseAuthorization(base.plan, { ...base.analysis, claims: [] }).status).toBe(
      "not_applied"
    );
    expect(
      styleBriseAuthorization(
        {
          ...base.plan,
          decisions: base.plan.decisions.map((decision) => ({
            ...decision,
            scope: { ...decision.scope, eventIds: ["event.unrelated"] },
          })),
        },
        base.analysis
      ).status
    ).toBe("not_applied");
    expect(styleBriseAuthorization(base.plan, base.analysis)).toMatchObject({
      status: "applied",
      planDecisionIds: ["decision.style-brise"],
      historicalClaimIds: ["claim.style-brise"],
    });
  });
});

function buildMinimalAuthorizationFixture() {
  const analysis = {
    id: "analysis.style-brise",
    normalizedScoreId: "score.style-brise",
    texture: "melody-with-accompaniment",
    claims: [
      {
        id: "claim.style-brise",
        kind: "historical_style_brise_applicability",
        subjectIds: ["score.style-brise"],
        statement: "Style brise is historically supported for this passage.",
        basis: "inference" as const,
        confidence: 0.8,
        scope: { measureIds: [], eventIds: ["event.1"] },
        evidence: [
          {
            kind: "historical_profile" as const,
            sourceIds: ["profile.baroque-lute-13"],
            explanation: "Reviewed historical profile.",
          },
        ],
      },
    ],
    preservationTargets: [
      {
        id: "target.principal",
        kind: "principal_voice" as const,
        partId: "part.soprano",
        eventIds: ["event.1"],
        rationale: "Protected.",
      },
    ],
    createdAt: "2026-07-12T12:00:00.000Z",
  };
  const plan = {
    id: "plan.style-brise",
    decisions: [
      {
        id: "decision.style-brise",
        dimension: "style_brise",
        selectedValue: "style_brise",
        scope: {
          kind: "whole_score",
          sectionIds: [],
          passageIds: [],
          measureIds: [],
          eventIds: ["event.1"],
        },
      },
    ],
  };
  return { analysis, plan } as unknown as {
    analysis: Parameters<typeof styleBriseAuthorization>[1];
    plan: NonNullable<Parameters<typeof styleBriseAuthorization>[0]>;
  };
}
