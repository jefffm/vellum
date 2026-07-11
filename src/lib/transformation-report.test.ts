import { describe, expect, it } from "vitest";
import type { AnalysisRecord, ArrangementEvent, NormalizedScore } from "./music-domain.js";
import { buildCompleteTransformationReport } from "./transformation-report.js";

describe("complete Transformation Report", () => {
  it("classifies octave relocation, revoicing, reharmonization, omission, generation, and relationships", () => {
    const score: NormalizedScore = {
      id: "score.transformations",
      scoreTranscriptionId: "transcription.transformations",
      version: 1,
      parts: [{ id: "part.one", name: "Part one", role: "other" }],
      measures: [
        {
          id: "measure.1",
          index: 0,
          displayNumber: "1",
          duration: { numerator: 1, denominator: 1 },
        },
      ],
      events: [
        {
          id: "event.octave",
          type: "note",
          partId: "part.one",
          measureId: "measure.1",
          onset: { numerator: 0, denominator: 4 },
          duration: { numerator: 1, denominator: 4 },
          pitch: "C4",
        },
        {
          id: "event.revoiced",
          type: "note",
          partId: "part.one",
          measureId: "measure.1",
          onset: { numerator: 1, denominator: 4 },
          duration: { numerator: 1, denominator: 4 },
          pitch: "D4",
        },
        {
          id: "event.reharmonized",
          type: "note",
          partId: "part.one",
          measureId: "measure.1",
          onset: { numerator: 2, denominator: 4 },
          duration: { numerator: 1, denominator: 4 },
          pitch: "E4",
        },
        {
          id: "event.omitted",
          type: "rest",
          partId: "part.one",
          measureId: "measure.1",
          onset: { numerator: 3, denominator: 4 },
          duration: { numerator: 1, denominator: 4 },
        },
        {
          id: "event.rhythm",
          type: "note",
          partId: "part.one",
          measureId: "measure.1",
          onset: { numerator: 7, denominator: 8 },
          duration: { numerator: 1, denominator: 8 },
          pitch: "G4",
        },
      ],
      createdAt: "2026-07-11T12:00:00.000Z",
    };
    const analysis: AnalysisRecord = {
      id: "analysis.transformations",
      normalizedScoreId: score.id,
      version: 1,
      texture: "monophony",
      claims: [],
      preservationTargets: [
        {
          id: "target.relationship",
          kind: "relationship",
          relationshipType: "principal_sequence",
          eventIds: ["event.octave", "event.omitted"],
          eventGroups: [["event.octave", "event.omitted"]],
          rationale: "Test relationship",
        },
      ],
      createdAt: "2026-07-11T12:01:00.000Z",
    };
    const arranged: ArrangementEvent[] = [
      {
        id: "arrangement.octave",
        type: "note",
        measureId: "measure.1",
        onset: { numerator: 0, denominator: 4 },
        duration: { numerator: 1, denominator: 4 },
        pitches: ["C5"],
        positions: [],
        sourceEventIds: ["event.octave"],
      },
      {
        id: "arrangement.revoiced",
        type: "chord",
        measureId: "measure.1",
        onset: { numerator: 1, denominator: 4 },
        duration: { numerator: 1, denominator: 4 },
        pitches: ["D4", "A4"],
        positions: [],
        sourceEventIds: ["event.revoiced"],
      },
      {
        id: "arrangement.reharmonized",
        type: "note",
        measureId: "measure.1",
        onset: { numerator: 2, denominator: 4 },
        duration: { numerator: 1, denominator: 4 },
        pitches: ["F4"],
        positions: [],
        sourceEventIds: ["event.reharmonized"],
      },
      {
        id: "arrangement.generated",
        type: "note",
        measureId: "measure.1",
        onset: { numerator: 3, denominator: 4 },
        duration: { numerator: 1, denominator: 4 },
        pitches: ["G4"],
        positions: [],
        sourceEventIds: [],
        role: "accompaniment",
      },
      {
        id: "arrangement.rhythm",
        type: "note",
        measureId: "measure.1",
        onset: { numerator: 3, denominator: 4 },
        duration: { numerator: 1, denominator: 8 },
        pitches: ["G4"],
        positions: [],
        sourceEventIds: ["event.rhythm"],
      },
    ];
    const report = buildCompleteTransformationReport(score, analysis, arranged, 0);
    expect(report).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceEventId: "event.octave",
          classification: "octave_relocated",
        }),
        expect.objectContaining({ sourceEventId: "event.revoiced", classification: "revoiced" }),
        expect.objectContaining({
          sourceEventId: "event.reharmonized",
          classification: "reharmonized",
        }),
        expect.objectContaining({ sourceEventId: "event.omitted", classification: "omitted" }),
        expect.objectContaining({
          sourceEventId: "event.rhythm",
          classification: "rhythm_changed",
        }),
        expect.objectContaining({
          arrangementEventIds: ["arrangement.generated"],
          classification: "generated",
        }),
        expect.objectContaining({
          entryType: "relationship",
          sourceRelationshipId: "target.relationship",
          sourceEventGroups: [["event.octave", "event.omitted"]],
          arrangementEventGroups: [["arrangement.octave"]],
          classification: "omitted",
        }),
      ])
    );
  });
});
