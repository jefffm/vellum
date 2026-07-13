import { Value } from "@sinclair/typebox/value";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  arrangeContinuo,
  auditContinuo,
  continuoRealizationRequests,
} from "./continuo-arranger.js";
import { loadBrowserProfile } from "./browser-profiles.js";
import { InstrumentModel } from "./instrument-model.js";
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
    expect(
      result.selected.transformationReport.filter(
        (entry) => entry.entryType === "event" && entry.sourceEventId
      )
    ).toHaveLength(score.events.length);
    expect(
      result.selected.transformationReport.find((entry) =>
        entry.sourceRelationshipId?.endsWith("prepared-suspension")
      )
    ).toMatchObject({ entryType: "relationship", classification: "retained" });
    expect(
      result.selected.transformationReport
        .filter((entry) => entry.classification === "generated")
        .every((entry) => entry.sourceEventIds?.length === 2)
    ).toBe(true);

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

  it("derives a key-contextual implied 5-3 request for genuinely unfigured bass", () => {
    const unfigured = {
      ...score,
      events: score.events.filter(
        (event) => event.type !== "figured_bass" || event.bassEventId !== "event.bass.4"
      ),
    };
    expect(
      continuoRealizationRequests(unfigured, "part.continuo").find(
        ({ bassEventId }) => bassEventId === "event.bass.4"
      )
    ).toMatchObject({
      id: "implicit-figure.event.bass.4",
      implicit: true,
      figures: [{ interval: 3 }, { interval: 5 }],
    });
  });

  it("uses a named separate bass when a re-entrant guitar cannot sound the foundation", () => {
    const model = InstrumentModel.fromProfile(loadBrowserProfile("baroque-guitar-5"));
    const result = arrangeContinuo(score, analysis, {
      arrangementId: "arrangement.guitar-continuo",
      createdAt: "2026-07-10T14:00:00.000Z",
      targetInstrument: model,
      targetConfiguration: {
        id: "target.baroque-guitar-continuo",
        instrumentId: "baroque-guitar-5",
        role: "ensemble",
        stringing: "french",
        realizationProfileId: "continuo.italian-baroque",
        continuoTreatment: "separate_bass",
        continuoBassInstrumentId: "voice-bass",
        notationLayouts: ["continuo-score"],
        deliverables: ["pdf", "audio-preview"],
      },
    });
    expect(result.candidates.map((candidate) => candidate.strategy)).toEqual([
      "separate-bass-realization",
      "continuo-reduction",
    ]);
    expect(result.selected).toMatchObject({
      selectedCandidateId: "candidate.separate-bass-realization",
      preservationAudit: { status: "pass" },
      continuoDisposition: {
        kind: "separate_bass_realization",
        bassInstrumentId: "voice-bass",
        unsoundedFoundationEventIds: [],
      },
    });
    const foundation = result.selected.events.filter(
      (event) => event.role === "continuo_foundation"
    );
    expect(foundation).toHaveLength(4);
    expect(foundation.every((event) => event.instrumentId === "voice-bass")).toBe(true);
    expect(
      result.selected.events
        .filter((event) => event.role === "realization")
        .every(
          (event) =>
            event.positions.length === event.pitches.length && model.isPlayable(event.positions).ok
        )
    ).toBe(true);
    const reduction = result.candidates.find(
      (candidate) => candidate.strategy === "continuo-reduction"
    )!;
    expect(reduction.status).toBe("rejected");
    expect(
      reduction.audit.findings.filter((finding) => finding.code === "continuo.foundation_unsounded")
    ).toHaveLength(4);
  });

  it("requires an explicit bass decision for an incapable target", () => {
    expect(() =>
      arrangeContinuo(score, analysis, {
        arrangementId: "arrangement.guitar-continuo",
        createdAt: "2026-07-10T14:00:00.000Z",
        targetInstrument: InstrumentModel.fromProfile(loadBrowserProfile("baroque-guitar-5")),
        targetConfiguration: {
          id: "target.guitar-continuo",
          instrumentId: "baroque-guitar-5",
          role: "ensemble",
          realizationProfileId: "continuo.italian-baroque",
          notationLayouts: ["continuo-score"],
          deliverables: ["pdf"],
        },
      })
    ).toThrow(/Choose a separate bass instrument/);
  });

  it("allows an explicitly labeled reduction under a less restrictive policy", () => {
    const result = arrangeContinuo(score, analysis, {
      arrangementId: "arrangement.guitar-adaptation",
      createdAt: "2026-07-10T14:00:00.000Z",
      preservationPolicy: "idiomatic_adaptation",
      targetInstrument: InstrumentModel.fromProfile(loadBrowserProfile("baroque-guitar-5")),
      targetConfiguration: {
        id: "target.guitar-continuo",
        instrumentId: "baroque-guitar-5",
        role: "ensemble",
        realizationProfileId: "continuo.italian-baroque",
        notationLayouts: ["continuo-score"],
        deliverables: ["pdf"],
      },
    });

    expect(result.selected).toMatchObject({
      preservationPolicy: "idiomatic_adaptation",
      selectedCandidateId: "candidate.continuo-reduction",
      preservationAudit: { status: "pass" },
      continuoDisposition: {
        kind: "continuo_reduction",
        soundedFoundationEventIds: [],
        unsoundedFoundationEventIds: [
          "event.bass.1",
          "event.bass.2",
          "event.bass.3",
          "event.bass.4",
        ],
      },
    });
    expect(result.selected.preservationAudit.findings).toContainEqual(
      expect.objectContaining({
        severity: "observation",
        code: "idiomatic_adaptation.continuo.foundation_unsounded",
      })
    );
    expect(result.selected.transformationReport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ classification: "omitted", sourceEventId: "event.bass.1" }),
      ])
    );
  });
});
