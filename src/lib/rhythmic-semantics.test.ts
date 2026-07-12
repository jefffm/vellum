import { describe, expect, it } from "vitest";
import {
  assertRhythmicSourceSupported,
  UnsupportedRhythmicNotationError,
} from "./rhythmic-semantics.js";
import type { NormalizedScore } from "./music-domain.js";

describe("canonical rhythmic source gate", () => {
  it("blocks unsupported notation before arrangement and retains exact source scope", () => {
    const score: NormalizedScore = {
      id: "score.unsupported",
      scoreTranscriptionId: "transcription.unsupported",
      version: 1,
      parts: [{ id: "part.voice", name: "Voice", role: "principal_voice" }],
      measures: [
        {
          id: "measure.4",
          index: 4,
          displayNumber: "5",
          duration: { numerator: 4, denominator: 1 },
        },
      ],
      events: [
        {
          id: "event.voice.1",
          type: "note",
          partId: "part.voice",
          measureId: "measure.4",
          onset: { numerator: 0, denominator: 1 },
          duration: { numerator: 1, denominator: 1 },
          pitch: "C4",
        },
      ],
      notationIssues: [
        {
          id: "notation-issue.grace.1",
          severity: "error",
          code: "unsupported_grace_note",
          message: "Grace-note timing requires review.",
          measureIds: ["measure.4"],
          eventIds: ["event.voice.1"],
        },
      ],
      createdAt: "2026-07-12T12:00:00.000Z",
    };

    expect(() => assertRhythmicSourceSupported(score)).toThrow(UnsupportedRhythmicNotationError);
    try {
      assertRhythmicSourceSupported(score);
    } catch (error) {
      expect((error as UnsupportedRhythmicNotationError).issues).toEqual(score.notationIssues);
      expect((error as Error).message).toContain("measure.4");
    }
  });
});
