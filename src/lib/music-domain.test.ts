import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  addRational,
  ArrangementWorkspaceSchema,
  compareRational,
  rational,
  ScoreTranscriptionSchema,
} from "./music-domain.js";

describe("music domain contracts", () => {
  it("normalizes and compares rational musical time exactly", () => {
    expect(rational(2, 4)).toEqual({ numerator: 1, denominator: 2 });
    expect(rational(-6, 8)).toEqual({ numerator: -3, denominator: 4 });
    expect(addRational(rational(1, 2), rational(3, 4))).toEqual({
      numerator: 5,
      denominator: 4,
    });
    expect(compareRational(rational(3, 4), rational(2, 3))).toBeGreaterThan(0);
  });

  it("validates a versioned arrangement workspace", () => {
    const workspace = {
      schemaVersion: 5,
      id: "workspace.test",
      title: "Greensleeves",
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
        ],
      },
      sourceArtifactIds: [],
      omrRunIds: [],
      scoreTranscriptionIds: [],
      normalizedScoreIds: [],
      analysisRecordIds: [],
      arrangementScoreIds: [],
      modelActionIds: [],
      arrangementBranchIds: [],
      arrangementSearchIds: [],
      arrangementCandidateIds: [],
      arrangementFamilyIds: [],
      deliverableIds: [],
      staleDerivationIds: [],
      editorialCommitmentIds: [],
      familyCommitmentIds: [],
      commitmentConflictIds: [],
      policyExceptionIds: [],
      createdAt: "2026-07-10T12:00:00.000Z",
      updatedAt: "2026-07-10T12:00:00.000Z",
    };

    expect(Value.Check(ArrangementWorkspaceSchema, workspace)).toBe(true);
    expect(Value.Check(ArrangementWorkspaceSchema, { ...workspace, title: "" })).toBe(false);
  });

  it("requires stable voice, measure, and event links in transcription shape", () => {
    const transcription = {
      id: "transcription.1",
      sourceArtifactId: "source.1",
      omrRunId: "omr.1",
      version: 1,
      status: "reviewed",
      title: "Greensleeves",
      key: "G major",
      timeSignature: "6/8",
      parts: [{ id: "part.soprano", name: "Soprano", role: "soprano" }],
      measures: [
        {
          id: "measure.pickup",
          index: 0,
          displayNumber: "0",
          duration: rational(1, 2),
        },
      ],
      events: [
        {
          id: "event.soprano.1",
          type: "note",
          partId: "part.soprano",
          measureId: "measure.pickup",
          onset: rational(0),
          duration: rational(1, 2),
          pitch: "E4",
          confidence: 1,
        },
      ],
      uncertainties: [],
      createdAt: "2026-07-10T12:00:00.000Z",
    };

    expect(Value.Check(ScoreTranscriptionSchema, transcription)).toBe(true);
    expect(
      Value.Check(ScoreTranscriptionSchema, {
        ...transcription,
        events: [{ ...transcription.events[0], pitch: "not-a-pitch" }],
      })
    ).toBe(false);
  });
});
