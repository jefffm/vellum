import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditBaroqueGuitarIdiom,
  auditBaroqueLuteIdiom,
  auditClassicalGuitarIdiom,
  auditFaithfulPrincipalVoice,
  auditPlannedVoiceObligations,
  SANZ_G_MAJOR_ALFABETO,
  validateBaroqueGuitarGesture,
} from "../../src/lib/baroque-guitar-arranger.js";
import { arrangementToEngraveParams } from "../../src/lib/arrangement-engrave.js";
import { buildAudioPreview } from "../../src/lib/audio-preview.js";
import { soundingPitches } from "../../src/lib/instrument-instance.js";
import { createBaroqueLuteInstance } from "../../src/lib/instrument-instance.js";
import {
  BAROQUE_LUTE_MAX_STOPPED_REACH_MM,
  InstrumentModel,
} from "../../src/lib/instrument-model.js";
import { loadProfile } from "../../src/server/profiles.js";
import { midiToNote, noteToMidi } from "../../src/lib/pitch.js";
import { parseExplicitVoiceLilypond } from "../../src/lib/restricted-lilypond.js";
import { ArrangementService } from "../../src/server/lib/arrangement-service.js";
import { OmrService, type OmrBackend } from "../../src/server/lib/omr.js";
import { WorkspaceStore } from "../../src/server/lib/workspace-store.js";

const roots: string[] = [];

describe("Old 100th non-Greensleeves three-target baseline", () => {
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("runs the exact public SATB source through three independent target searches", async () => {
    const rootDirectory = await mkdtemp(path.join(tmpdir(), "vellum-old-hundredth-"));
    roots.push(rootDirectory);
    const store = new WorkspaceStore({ rootDirectory });
    const workspace = store.create({
      title: "Old 100th three-target baseline",
      brief: {
        targetConfigurations: [
          {
            id: "target.baroque-guitar",
            instrumentId: "baroque-guitar-5",
            role: "solo",
            stringing: "french",
            notationLayouts: ["french-letter-tablature"],
            deliverables: ["pdf", "audio-preview"],
          },
          {
            id: "target.baroque-lute",
            instrumentId: "baroque-lute-13",
            role: "solo",
            tuningId: "d_minor",
            notationLayouts: ["french-letter-tablature"],
            deliverables: ["pdf", "audio-preview"],
          },
          {
            id: "target.classical-guitar",
            instrumentId: "classical-guitar-6",
            role: "solo",
            tuningId: "standard",
            notationLayouts: ["standard-notation"],
            deliverables: ["pdf", "audio-preview"],
          },
        ],
      },
    });
    const fixtureRoot = path.resolve(process.cwd(), "test/fixtures/old-hundredth");
    const pdf = readFileSync(path.join(fixtureRoot, "old-hundredth-satb.pdf"));
    const source = store.addSourceArtifact(workspace.id, {
      filename: "old-hundredth-satb.pdf",
      mimeType: "application/pdf",
      contentBase64: pdf.toString("base64"),
      provenance: {
        license: "Public Domain",
        catalogUrl: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=194",
      },
    });
    const parsed = parseExplicitVoiceLilypond(
      readFileSync(path.join(fixtureRoot, "old-hundredth-satb.ly"), "utf8"),
      ["sop", "alt", "ten", "bass"]
    );
    const backend: OmrBackend = {
      id: "reviewed-old-hundredth",
      recognize: async () => ({
        backend: { id: "reviewed-old-hundredth", version: "1", configuration: {} },
        artifacts: [],
        pageMappings: [{ sourcePage: 1, recognizedPage: 1 }],
        diagnostics: [],
        recognizedScore: { ...parsed, uncertainties: [] },
      }),
    };
    const recognized = await new OmrService({ store }).recognize(workspace.id, source.id, backend);
    const service = new ArrangementService({ store });
    const results = workspace.brief.targetConfigurations.map((target) =>
      service.createFaithfulReduction(workspace.id, {
        normalizedScoreId: recognized.normalizedScore.id,
        targetConfigurationId: target.id,
      })
    );

    expect(results).toHaveLength(3);
    expect(new Set(results.map(({ analysisRecordId }) => analysisRecordId)).size).toBe(1);
    const analysis = store.getAnalysisRecord(workspace.id, results[0]!.analysisRecordId);
    expect(analysis.sourceVoiceGraph).toMatchObject({
      identityIndependentOfPitchHeight: true,
      identityIndependentOfNotationCarrier: true,
    });
    expect(analysis.sourceVoiceGraph?.voices).toHaveLength(4);
    expect(
      analysis.sourceVoiceGraph?.voices.every(
        (voice) => voice.identityBasis === "event_continuity_within_notation_carrier"
      )
    ).toBe(true);
    for (const result of results) {
      expect(result.arrangementScore.preservationAudit.status).toBe("pass");
      expect(
        result.arrangementScore.events.some(
          ({ principalVoiceSourceEventId }) => principalVoiceSourceEventId
        )
      ).toBe(true);
      expect(result.arrangementSearch.normalizedScoreId).toBe(recognized.normalizedScore.id);
      expect(result.arrangementPlan.phraseObligations?.length).toBeGreaterThan(0);

      const firstPrincipal = result.arrangementScore.events.find(
        ({ principalVoiceSourceEventId }) => principalVoiceSourceEventId
      )!;
      const mutationAudit = auditFaithfulPrincipalVoice(
        recognized.normalizedScore,
        store.getAnalysisRecord(workspace.id, result.analysisRecordId),
        result.arrangementScore.events.filter(({ id }) => id !== firstPrincipal.id),
        result.arrangementScore.transpositionPlan.semitones
      );
      expect(mutationAudit.status).toBe("fail");
      expect(mutationAudit.findings.some(({ code }) => code === "principal.omitted")).toBe(true);
    }

    const baroqueGuitar = results.find(
      (result) => result.arrangementScore.targetConfiguration.instrumentId === "baroque-guitar-5"
    )!;
    const guitarEvents = baroqueGuitar.arrangementScore.events.filter(
      (event) => event.type !== "rest"
    );
    const guitarGestures = guitarEvents.map((event) => event.baroqueGuitarGesture!);
    expect(auditBaroqueGuitarIdiom(baroqueGuitar.arrangementScore.events)).toEqual([]);
    expect(new Set(guitarGestures.map(({ technique }) => technique))).toEqual(
      new Set(["punteado", "alfabeto"])
    );
    expect(
      guitarGestures
        .filter(({ technique }) => technique === "punteado")
        .every(
          ({ attackCourses, rightHandFingers }) =>
            attackCourses.length <= 3 &&
            rightHandFingers.length === attackCourses.length &&
            rightHandFingers.every(({ finger }) => ["p", "i", "m"].includes(finger))
        )
    ).toBe(true);
    const alfabetoGestures = guitarGestures.filter(({ technique }) => technique === "alfabeto");
    expect(alfabetoGestures.length).toBeGreaterThan(0);
    expect(alfabetoGestures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attackCourses: [1, 2, 3, 4, 5],
          contiguousAttack: true,
          alfabeto: expect.objectContaining({
            symbol: SANZ_G_MAJOR_ALFABETO.symbol,
            chordName: SANZ_G_MAJOR_ALFABETO.chordName,
            shapeFrets: [...SANZ_G_MAJOR_ALFABETO.shapeFrets],
            historicalClaimId: SANZ_G_MAJOR_ALFABETO.historicalClaimId,
          }),
        }),
      ])
    );

    const oversized = structuredClone(
      guitarGestures.find(({ technique }) => technique === "punteado")!
    );
    oversized.attackCourses = [1, 2, 3, 4];
    expect(validateBaroqueGuitarGesture(oversized)).toContain(
      "baroque_guitar.punteado_oversized_attack"
    );
    const skipped = structuredClone(alfabetoGestures[0]!);
    skipped.technique = "rasgueado";
    skipped.attackCourses = [1, 2, 4, 5];
    skipped.contiguousAttack = false;
    expect(validateBaroqueGuitarGesture(skipped)).toContain(
      "baroque_guitar.rasgueado_interior_course_skip"
    );
    const ungrounded = structuredClone(alfabetoGestures[0]!);
    delete ungrounded.alfabeto;
    expect(validateBaroqueGuitarGesture(ungrounded)).toContain(
      "baroque_guitar.alfabeto_shape_missing"
    );
    const allPunteado = structuredClone(baroqueGuitar.arrangementScore.events);
    for (const event of allPunteado) {
      if (event.baroqueGuitarGesture) event.baroqueGuitarGesture.technique = "punteado";
    }
    expect(auditBaroqueGuitarIdiom(allPunteado)).toContain(
      "baroque_guitar.non_idiomatic_all_punteado_reduction"
    );

    const guitarParams = arrangementToEngraveParams(
      baroqueGuitar.arrangementScore,
      recognized.normalizedScore
    );
    const engravedPositions = guitarParams.bars.flatMap(({ events }) =>
      events.flatMap((event) =>
        event.type === "chord"
          ? event.positions.map(({ course, fret }) => `${course}:${fret}`)
          : event.type === "note" && event.input === "position"
            ? [`${event.course}:${event.fret}`]
            : []
      )
    );
    expect(engravedPositions.sort()).toEqual(
      guitarEvents
        .flatMap((event) => event.positions.map(({ course, fret }) => `${course}:${fret}`))
        .sort()
    );
    const preview = buildAudioPreview(baroqueGuitar.arrangementScore, recognized.normalizedScore);
    const guitarInstance = baroqueGuitar.arrangementScore.targetConfiguration.instrumentInstance!;
    for (const event of guitarEvents) {
      const expectedMidi = event.positions
        .flatMap(({ course, fret }) => soundingPitches(guitarInstance, course, fret))
        .map(noteToMidi)
        .sort((left, right) => left - right);
      const actualMidi = preview.events
        .filter(
          ({ arrangementEventId, iteration }) => arrangementEventId === event.id && iteration === 1
        )
        .map(({ midi }) => midi)
        .sort((left, right) => left - right);
      expect(actualMidi).toEqual(expectedMidi);
    }

    const baroqueLute = results.find(
      (result) => result.arrangementScore.targetConfiguration.instrumentId === "baroque-lute-13"
    )!;
    const luteInstance = baroqueLute.arrangementScore.targetConfiguration.instrumentInstance!;
    const luteModel = InstrumentModel.fromProfile(loadProfile("baroque-lute-13"), luteInstance);
    expect(luteInstance.scaleLength).toEqual({ value: 690, unit: "mm" });
    expect(
      luteInstance.courses.slice(6, 12).map(({ notationIdentity }) => notationIdentity)
    ).toEqual(["a", "/a", "//a", "///a", "4", "5"]);
    expect(luteInstance.courses[12]?.notationIdentity).toBe("?");
    const configuredCourse13 = createBaroqueLuteInstance("d_minor", {
      course13NotationIdentity: "6",
    });
    expect(configuredCourse13.courses[12]?.notationIdentity).toBe("6");
    expect(configuredCourse13.contentDigest).not.toBe(luteInstance.contentDigest);

    expect(
      luteModel.stoppedReachMillimeters([
        { course: 1, fret: 1, quality: "low_fret" },
        { course: 2, fret: 5, quality: "high_fret" },
      ])
    ).toBeGreaterThan(BAROQUE_LUTE_MAX_STOPPED_REACH_MM);
    expect(
      luteModel.isPlayable([
        { course: 1, fret: 1, quality: "low_fret" },
        { course: 2, fret: 5, quality: "high_fret" },
      ]).ok
    ).toBe(false);
    expect(
      luteModel.isPlayable([
        { course: 1, fret: 1, quality: "low_fret" },
        { course: 2, fret: 4, quality: "low_fret" },
      ]).ok
    ).toBe(true);
    expect(auditBaroqueLuteIdiom(baroqueLute.arrangementScore.events, luteModel)).toEqual([]);
    expect(
      auditPlannedVoiceObligations(
        recognized.normalizedScore,
        baroqueLute.arrangementScore.events,
        baroqueLute.arrangementScore.transpositionPlan.semitones,
        baroqueLute.arrangementPlan
      )
    ).toEqual([]);
    const luteTransitions = baroqueLute.candidates.flatMap(
      ({ phraseSearchEvidence }) => phraseSearchEvidence?.transitions ?? []
    );
    expect(
      luteTransitions.every(
        ({ stoppedCourseReachMillimeters }) =>
          (stoppedCourseReachMillimeters ?? 0) <= BAROQUE_LUTE_MAX_STOPPED_REACH_MM
      )
    ).toBe(true);
    expect(
      luteTransitions.every(({ resonatingBassCourses = [], dampingRequiredCourses = [] }) =>
        resonatingBassCourses.every((course) => !dampingRequiredCourses.includes(course))
      )
    ).toBe(true);
    expect(
      baroqueLute.arrangementScore.events
        .filter(({ type }) => type !== "rest")
        .every(({ baroqueLuteGesture }) => {
          const assignments = baroqueLuteGesture?.rightHandAssignments ?? [];
          const thumbCourse = Math.max(...assignments.map(({ course }) => course));
          return assignments.every(
            ({ course, finger }) =>
              (course === thumbCourse && finger === "p") ||
              (course !== thumbCourse && ["i", "m"].includes(finger))
          );
        })
    ).toBe(true);
    const luteParams = arrangementToEngraveParams(
      baroqueLute.arrangementScore,
      recognized.normalizedScore
    );
    const luteEngravedPositions = luteParams.bars.flatMap(({ events }) =>
      events.flatMap((event) =>
        event.type === "chord"
          ? event.positions.map(({ course, fret }) => `${course}:${fret}`)
          : event.type === "note" && event.input === "position"
            ? [`${event.course}:${event.fret}`]
            : []
      )
    );
    expect(luteEngravedPositions.sort()).toEqual(
      baroqueLute.arrangementScore.events
        .flatMap((event) => event.positions.map(({ course, fret }) => `${course}:${fret}`))
        .sort()
    );
    const lutePreview = buildAudioPreview(baroqueLute.arrangementScore, recognized.normalizedScore);
    for (const event of baroqueLute.arrangementScore.events.filter(({ type }) => type !== "rest")) {
      const expectedMidi = event.positions
        .flatMap(({ course, fret }) => soundingPitches(luteInstance, course, fret))
        .map(noteToMidi)
        .sort((left, right) => left - right);
      const actualMidi = lutePreview.events
        .filter(
          ({ arrangementEventId, iteration }) => arrangementEventId === event.id && iteration === 1
        )
        .map(({ midi }) => midi)
        .sort((left, right) => left - right);
      expect(actualMidi).toEqual(expectedMidi);
    }

    const classical = results.find(
      (result) => result.arrangementScore.targetConfiguration.instrumentId === "classical-guitar-6"
    )!;
    const classicalVoices = classical.arrangementPlan.phraseObligations!.flatMap(
      (obligation) => obligation.targetVoices
    );
    expect(classicalVoices.map((voice) => voice.role)).toEqual(
      expect.arrayContaining(["principal_voice", "bass"])
    );
    expect(
      auditPlannedVoiceObligations(
        recognized.normalizedScore,
        classical.arrangementScore.events,
        classical.arrangementScore.transpositionPlan.semitones,
        classical.arrangementPlan
      )
    ).toEqual([]);
    const classicalInstance = classical.arrangementScore.targetConfiguration.instrumentInstance!;
    const classicalModel = InstrumentModel.fromProfile(
      loadProfile("classical-guitar-6"),
      classicalInstance
    );
    expect(auditClassicalGuitarIdiom(classical.arrangementScore.events, classicalModel)).toEqual(
      []
    );
    expect(
      classical.arrangementScore.events
        .filter(({ type }) => type !== "rest")
        .every(({ classicalGuitarGesture }) =>
          classicalGuitarGesture?.rightHandAssignments.every(({ finger, voiceRole }) =>
            voiceRole === "bass" ? finger === "p" : ["i", "m"].includes(finger)
          )
        )
    ).toBe(true);

    const bassConstituents = classical.arrangementScore.events.flatMap((event) =>
      (event.voiceConstituents ?? [])
        .filter((voice) => voice.role === "source_voice")
        .map((voice) => ({ event, voice }))
    );
    const plannedBassIds = classical.arrangementPlan
      .phraseObligations!.flatMap((obligation) => obligation.targetVoices)
      .filter(({ role }) => role === "bass")
      .flatMap(({ sourceEventIds }) => sourceEventIds);
    expect(bassConstituents.map(({ voice }) => voice.sourceEventId)).toEqual(plannedBassIds);
    expect(bassConstituents.map(({ voice }) => noteToMidi(voice.pitch) % 12)).toEqual(
      plannedBassIds.map((sourceId) => {
        const source = recognized.normalizedScore.events.find(({ id }) => id === sourceId)!;
        if (source.type !== "note") throw new Error(`Expected bass note ${sourceId}`);
        return noteToMidi(source.pitch) % 12;
      })
    );
    const classicalParams = arrangementToEngraveParams(
      classical.arrangementScore,
      recognized.normalizedScore
    );
    expect(classicalParams.notation_voices?.map(({ id }) => id).sort()).toEqual(
      ["part.bass", "part.sop"].sort()
    );
    const classicalPreview = buildAudioPreview(
      classical.arrangementScore,
      recognized.normalizedScore
    );
    for (const constituent of classical.arrangementScore.events.flatMap(
      ({ voiceConstituents = [] }) => voiceConstituents
    )) {
      expect(
        classicalPreview.events.some(
          ({ sourceEventIds, midi, durationSeconds }) =>
            sourceEventIds.includes(constituent.sourceEventId) &&
            midi === noteToMidi(constituent.pitch) &&
            durationSeconds > 0
        )
      ).toBe(true);
    }
    const timingMutation = structuredClone(classical.arrangementScore.events);
    const timingVoice = timingMutation
      .flatMap((event) => event.voiceConstituents ?? [])
      .find((voice) => voice.role === "source_voice")!;
    timingVoice.duration = {
      numerator: timingVoice.duration.numerator + 1,
      denominator: timingVoice.duration.denominator,
    };
    expect(
      auditPlannedVoiceObligations(
        recognized.normalizedScore,
        timingMutation,
        classical.arrangementScore.transpositionPlan.semitones,
        classical.arrangementPlan
      ).some(({ code }) => code === "voice.phrase_timing_changed")
    ).toBe(true);

    const jumpMutation = structuredClone(classical.arrangementScore.events);
    const jumpVoice = jumpMutation
      .flatMap((event) => event.voiceConstituents ?? [])
      .filter((voice) => voice.role === "source_voice")[1]!;
    jumpVoice.pitch = midiToNote(noteToMidi(jumpVoice.pitch) + 24);
    expect(
      auditPlannedVoiceObligations(
        recognized.normalizedScore,
        jumpMutation,
        classical.arrangementScore.transpositionPlan.semitones,
        classical.arrangementPlan
      ).some(({ code }) => code === "voice.continuity_jump")
    ).toBe(true);

    const bassCadenceId = classical.arrangementPlan
      .phraseObligations!.flatMap((obligation) => obligation.harmonicPlan.cadenceGoalEventIds)
      .find((id) => bassConstituents.some(({ voice }) => voice.sourceEventId === id))!;
    const cadenceMutation = structuredClone(classical.arrangementScore.events).map((event) => ({
      ...event,
      voiceConstituents: event.voiceConstituents?.filter(
        (voice) => voice.sourceEventId !== bassCadenceId
      ),
    }));
    expect(
      auditPlannedVoiceObligations(
        recognized.normalizedScore,
        cadenceMutation,
        classical.arrangementScore.transpositionPlan.semitones,
        classical.arrangementPlan
      ).some(({ code }) => code === "voice.cadential_goal_omitted")
    ).toBe(true);

    const observations = results.map((result) => {
      const instrumentId = result.arrangementScore.targetConfiguration.instrumentId;
      const voiceIds = [
        ...new Set(
          result.arrangementScore.events.flatMap((event) =>
            (event.voiceConstituents ?? []).map(({ voiceId }) => voiceId)
          )
        ),
      ];
      const techniques = [
        ...new Set(
          result.candidates.flatMap(
            ({ phraseSearchEvidence }) =>
              phraseSearchEvidence?.transitions.map(({ technique }) => technique) ?? []
          )
        ),
      ];
      const maxStoppedCourseFretDelta = Math.max(
        ...result.candidates.flatMap(
          ({ phraseSearchEvidence }) =>
            phraseSearchEvidence?.transitions.map(
              ({ stoppedCourseFretDelta }) => stoppedCourseFretDelta ?? 0
            ) ?? []
        )
      );
      const maxStoppedCourseReachMillimeters = Math.max(
        ...result.candidates.flatMap(
          ({ phraseSearchEvidence }) =>
            phraseSearchEvidence?.transitions.map(
              ({ stoppedCourseReachMillimeters }) => stoppedCourseReachMillimeters ?? 0
            ) ?? []
        )
      );
      const knownDefects = [
        ...(instrumentId === "baroque-guitar-5" &&
        techniques.length === 1 &&
        techniques[0] === "punteado"
          ? ["baroque_guitar.single_generic_punteado_technique"]
          : []),
        ...(instrumentId === "baroque-guitar-5" &&
        !result.arrangementScore.events.some(
          ({ baroqueGuitarGesture }) => (baroqueGuitarGesture?.attackCourses.length ?? 0) > 1
        )
          ? ["baroque_guitar.subordinate_idiom_deferred"]
          : []),
        ...(instrumentId === "baroque-lute-13" &&
        maxStoppedCourseReachMillimeters > BAROQUE_LUTE_MAX_STOPPED_REACH_MM
          ? ["baroque_lute.physical_reach_exceeded"]
          : []),
        ...(instrumentId === "baroque-lute-13" && voiceIds.length < 2
          ? ["baroque_lute.subordinate_idiom_deferred"]
          : []),
        ...(instrumentId === "classical-guitar-6" &&
        result.candidates.some(
          ({ phraseSearchEvidence }) =>
            phraseSearchEvidence?.classicalTechniqueEvidence?.rightHandScope === "unknown"
        )
          ? ["classical_guitar.right_hand_unmodeled"]
          : []),
      ];
      return {
        instrumentId,
        events: result.arrangementScore.events.length,
        voiceIds,
        techniques,
        maxStoppedCourseFretDelta,
        maxStoppedCourseReachMillimeters,
        knownDefects,
      };
    });
    expect(observations.flatMap(({ knownDefects }) => knownDefects).sort()).toEqual([]);

    if (process.env.VELLUM_PRINT_MUSICAL_PROOF_BASELINE === "1") {
      process.stderr.write(
        `${JSON.stringify({ fixture: "old-hundredth", observations }, null, 2)}\n`
      );
    }
  });
});
