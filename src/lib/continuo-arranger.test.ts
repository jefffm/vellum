import { Value } from "@sinclair/typebox/value";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { arrangeContinuo, auditContinuo } from "./continuo-arranger.js";
import { RecognizedScoreSchema } from "./music-domain.js";
import { analyzeMusicologicalScore } from "./musicological-analysis.js";

describe("profile-scoped Continuo Realization", () => {
  const recognized = Value.Decode(
    RecognizedScoreSchema,
    JSON.parse(
      readFileSync(
        path.resolve(process.cwd(), "test/fixtures/continuo/reviewed-score.json"),
        "utf8"
      )
    )
  );
  const score = {
    id: "score.continuo",
    scoreTranscriptionId: "transcription.continuo",
    version: 1,
    ...recognized,
    createdAt: "2026-07-10T12:00:00.000Z",
  };
  const analysis = analyzeMusicologicalScore(score, {
    id: "analysis.continuo",
    createdAt: "2026-07-10T13:00:00.000Z",
  });

  it("searches candidates and preserves soprano, bass, figures, and suspension treatment", () => {
    const result = arrangeContinuo(score, analysis, {
      arrangementId: "arrangement.continuo",
      createdAt: "2026-07-10T14:00:00.000Z",
      targetConfiguration: {
        id: "target.piano-continuo",
        instrumentId: "piano",
        role: "ensemble",
        realizationProfileId: "continuo.italian-baroque",
        notationLayouts: ["continuo-score"],
        deliverables: ["pdf", "audio-preview"],
      },
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.selected).toMatchObject({
      selectedCandidateId: "candidate.complete-realization",
      transpositionPlan: { sourceKey: "C major", targetKey: "C major", semitones: 0 },
      targetConfiguration: { realizationProfileId: "continuo.italian-baroque" },
      preservationAudit: { status: "pass" },
    });
    expect(result.selected.preservationAudit.findings).toContainEqual(
      expect.objectContaining({
        severity: "observation",
        code: "continuo.prepared_suspension_accepted",
      })
    );

    const principal = result.selected.events.filter((event) => event.role === "principal_voice");
    expect(principal.map((event) => event.pitches[0])).toEqual(["F4", "F4", "E4", "D4", "C4"]);
    const foundation = result.selected.events.filter(
      (event) => event.role === "continuo_foundation"
    );
    expect(foundation.map((event) => event.pitches[0])).toEqual(["D3", "C3", "G2", "C3"]);
    expect(
      result.selected.events.find((event) => event.sourceEventIds.includes("event.figure.2"))
        ?.pitches
    ).toEqual(["F3", "G3"]);
    expect(
      result.selected.events.find((event) => event.sourceEventIds.includes("event.figure.3"))
        ?.pitches
    ).toEqual(["E3", "G3"]);
    expect(
      result.selected.transformationReport.filter((entry) => entry.classification === "generated")
    ).toHaveLength(5);

    const mutated = result.selected.events.map((event) =>
      event.sourceEventIds.includes("event.figure.2") && event.role === "realization"
        ? { ...event, onset: { numerator: 3, denominator: 4 } }
        : event
    );
    const audit = auditContinuo(score, analysis, mutated);
    expect(audit.status).toBe("fail");
    expect(audit.findings).toContainEqual(
      expect.objectContaining({
        severity: "hard",
        code: "continuo.prepared_suspension_changed",
      })
    );
  });

  it("refuses to invent an unscoped realization", () => {
    expect(() =>
      arrangeContinuo(score, analysis, {
        arrangementId: "arrangement.unscoped",
        createdAt: "2026-07-10T14:00:00.000Z",
        targetConfiguration: {
          id: "target.piano-continuo",
          instrumentId: "piano",
          role: "ensemble",
          notationLayouts: ["continuo-score"],
          deliverables: ["pdf"],
        },
      })
    ).toThrow("explicit Realization Profile");
  });
});
