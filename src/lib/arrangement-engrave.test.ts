import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadBrowserProfile } from "./browser-profiles.js";
import {
  arrangeFaithfulBaroqueGuitar,
  arrangeFaithfulPluckedString,
} from "./baroque-guitar-arranger.js";
import { arrangementToEngraveParams, rationalToLilyDuration } from "./arrangement-engrave.js";
import { InstrumentModel } from "./instrument-model.js";
import { buildAudioPreview } from "./audio-preview.js";
import { analyzeMusicologicalScore } from "./musicological-analysis.js";
import { parseExplicitVoiceLilypond } from "./restricted-lilypond.js";
import { engrave } from "../server/lib/engrave.js";
import { createClassicalGuitarInstance } from "./instrument-instance.js";

describe("Arrangement Score engraving projection", () => {
  it("keeps LilyPond course order aligned with the baroque-guitar model", () => {
    const instrument = readFileSync(
      path.resolve(process.cwd(), "instruments/baroque-guitar-5.ily"),
      "utf8"
    );
    expect(instrument).toContain("guitarStringTunings = \\stringTuning <a d' g b e'>");
  });

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
    expect(result.source).toContain("data-arrangement-event-id");
    expect(result.source).toContain(arrangement.events[0]!.id);
    expect(result.source).toContain(arrangement.events[0]!.measureId);
  });

  it("converts exact rational time to LilyPond durations", () => {
    expect(rationalToLilyDuration({ numerator: 3, denominator: 4 })).toBe("8.");
    expect(rationalToLilyDuration({ numerator: 1, denominator: 4 })).toBe("16");
    expect(rationalToLilyDuration({ numerator: 1, denominator: 3 })).toBe("4*1/3");
  });

  it("engraves canonical tuplet, double-dot, and tie semantics without changing playback time", () => {
    const score = {
      id: "score.rhythm",
      scoreTranscriptionId: "transcription.rhythm",
      version: 1,
      timeSignature: "4/4",
      parts: [{ id: "part.voice", name: "Voice", role: "principal_voice" as const }],
      measures: [
        {
          id: "measure.0",
          index: 0,
          displayNumber: "1",
          duration: { numerator: 4, denominator: 1 },
        },
      ],
      events: [
        ...["C4", "D4", "E4"].map((pitch, index) => ({
          id: `event.triplet.${index + 1}`,
          type: "note" as const,
          partId: "part.voice",
          measureId: "measure.0",
          onset: { numerator: index, denominator: 3 },
          duration: { numerator: 1, denominator: 3 },
          pitch,
          rhythmicNotation: {
            writtenDuration: { numerator: 1, denominator: 2 },
            dots: 0,
            tuplet: {
              groupId: "tuplet.one",
              actualNotes: 3,
              normalNotes: 2,
              boundary:
                index === 0
                  ? ("start" as const)
                  : index === 2
                    ? ("stop" as const)
                    : ("continue" as const),
            },
          },
        })),
        {
          id: "event.doubledot",
          type: "note" as const,
          partId: "part.voice",
          measureId: "measure.0",
          onset: { numerator: 1, denominator: 1 },
          duration: { numerator: 3, denominator: 1 },
          pitch: "F4",
          tie: "start" as const,
          rhythmicNotation: { writtenDuration: { numerator: 7, denominator: 2 }, dots: 2 },
        },
      ],
      performedForm: {
        id: "performed-form.rhythm",
        measureOccurrences: [
          { id: "occurrence.measure-0.1", measureId: "measure.0", iteration: 1 },
        ],
        traversalDecisions: ["Play written measures once in score order."],
      },
      createdAt: "2026-07-12T12:00:00.000Z",
    };
    const arrangement = {
      id: "arrangement.rhythm",
      analysisRecordId: "analysis.rhythm",
      selectedCandidateId: "candidate.rhythm",
      targetConfiguration: {
        id: "target.classical-guitar",
        instrumentId: "classical-guitar-6",
        role: "solo" as const,
        notationLayouts: ["standard-notation"],
        deliverables: ["pdf", "audio-preview"],
      },
      transpositionPlan: { semitones: 0, rationale: "Literal." },
      preservationPolicy: "faithful_reduction" as const,
      events: score.events.map((event) => ({
        id: `arrangement-${event.id}`,
        type: "note" as const,
        measureId: event.measureId,
        onset: event.onset,
        duration: event.duration,
        pitches: [event.pitch],
        positions: [],
        sourceEventIds: [event.id],
        role: "principal_voice" as const,
        notationSemantics: {
          voiceId: event.partId,
          voiceLayer: 1,
          stemDirection: "up" as const,
          writtenPitches: [event.pitch.replace(/(-?\d+)$/, (octave) => String(Number(octave) + 1))],
          soundingPitches: [event.pitch],
          writtenToSoundingSemitones: -12,
          duration: event.duration,
          tie: ("tie" in event ? event.tie : undefined) ?? ("none" as const),
        },
      })),
      transformationReport: [],
      preservationAudit: { status: "pass" as const, targetIds: [], findings: [] },
      createdAt: "2026-07-12T12:00:00.000Z",
    };

    const result = engrave(arrangementToEngraveParams(arrangement, score));
    expect(result.source).toContain("\\tuplet 3/2 {");
    expect(result.source).toContain("e'8 }");
    expect(result.source).toContain("f'2..~");
    expect(result.source).toContain("\\stemUp");
    const preview = buildAudioPreview(arrangement, score, 60);
    expect(preview.performedForm.measureOccurrences.map((item) => item.id)).toEqual([
      "occurrence.measure-0.1",
    ]);
    expect(preview.events.slice(0, 3).map((event) => event.durationSeconds)).toEqual([
      1 / 3,
      1 / 3,
      1 / 3,
    ]);
    expect(preview.events.map((event) => event.arrangementEventId)).toEqual(
      arrangement.events.map((event) => event.id)
    );
  });

  it("projects classical guitar from audited pitches into one correctly spelled staff", () => {
    const parsed = parseExplicitVoiceLilypond(
      readFileSync(
        path.resolve(process.cwd(), "test/fixtures/greensleeves/greensleeves-satb.ly"),
        "utf8"
      ),
      ["Soprano", "Alto", "Tenor", "Bass"]
    );
    const score = {
      id: "score.greensleeves-classical",
      scoreTranscriptionId: "transcription.greensleeves",
      version: 1,
      ...parsed,
      createdAt: "2026-07-10T12:00:00.000Z",
    };
    const analysis = analyzeMusicologicalScore(score, {
      id: "analysis.greensleeves-classical",
      createdAt: "2026-07-10T13:00:00.000Z",
    });
    const instrumentInstance = createClassicalGuitarInstance();
    const arrangement = arrangeFaithfulPluckedString(
      score,
      analysis,
      InstrumentModel.fromProfile(loadBrowserProfile("classical-guitar-6"), instrumentInstance),
      {
        arrangementId: "arrangement.greensleeves-classical",
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
      }
    ).selected;

    const params = arrangementToEngraveParams(arrangement, score);
    expect(params.template).toBe("solo-staff");
    expect(
      params.bars
        .flatMap((bar) => bar.events)
        .every(
          (event) =>
            event.type === "rest" ||
            (event.type === "note" && event.input === "pitch") ||
            (event.type === "chord" &&
              event.positions.every((position) => position.input === "pitch"))
        )
    ).toBe(true);

    const result = engrave(params);
    expect(result.source).toContain('\\clef "treble_8"');
    expect(result.source).toContain("\\stemUp");
    expect(result.source).toContain("fis'8");
    expect(result.source).toContain("dis'16");
    expect(result.source).not.toContain("\\new TabStaff");
    expect(result.source).toContain('\\new Voice = "part.soprano"');
    expect(result.source).toContain("\\stemDown");
  });
});
