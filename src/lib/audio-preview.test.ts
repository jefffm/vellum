import { describe, expect, it } from "vitest";
import type { ArrangementScore, NormalizedScore } from "./music-domain.js";
import { buildAudioPreview } from "./audio-preview.js";

describe("buildAudioPreview", () => {
  it("uses arrangement pitches once and separates the protected top voice", () => {
    const score = {
      measures: [{ id: "measure.1", number: 1, duration: { numerator: 2, denominator: 1 } }],
    } as unknown as NormalizedScore;
    const arrangement = {
      events: [
        {
          id: "arrangement-event.1",
          type: "chord",
          measureId: "measure.1",
          onset: { numerator: 0, denominator: 1 },
          duration: { numerator: 1, denominator: 1 },
          pitches: ["F4", "A3", "D4"],
          positions: [],
          sourceEventIds: ["event.soprano", "event.bass"],
          principalVoiceSourceEventId: "event.soprano",
        },
      ],
    } as unknown as ArrangementScore;

    const preview = buildAudioPreview(arrangement, score, 60);
    expect(preview.events).toHaveLength(3);
    expect(preview.events.filter((event) => event.part === "principal-voice")).toMatchObject([
      { midi: 65, startSeconds: 0, durationSeconds: 1 },
    ]);
    expect(preview.events.filter((event) => event.part === "accompaniment")).toHaveLength(2);
    expect(new Set(preview.events.map((event) => event.midi)).size).toBe(3);
  });

  it("keeps Continuo Foundation and generated realization independently audible", () => {
    const score = {
      measures: [{ id: "measure.1", duration: { numerator: 4, denominator: 1 } }],
    } as unknown as NormalizedScore;
    const arrangement = {
      events: [
        {
          id: "arrangement-event.soprano",
          type: "note",
          role: "principal_voice",
          measureId: "measure.1",
          onset: { numerator: 0, denominator: 1 },
          duration: { numerator: 4, denominator: 1 },
          pitches: ["F4"],
          sourceEventIds: ["event.soprano"],
        },
        {
          id: "arrangement-event.bass",
          type: "note",
          role: "continuo_foundation",
          measureId: "measure.1",
          onset: { numerator: 0, denominator: 1 },
          duration: { numerator: 4, denominator: 1 },
          pitches: ["D3"],
          sourceEventIds: ["event.bass"],
        },
        {
          id: "arrangement-event.realization",
          type: "chord",
          role: "realization",
          measureId: "measure.1",
          onset: { numerator: 0, denominator: 1 },
          duration: { numerator: 4, denominator: 1 },
          pitches: ["F3", "A3"],
          sourceEventIds: ["event.figure"],
        },
      ],
    } as unknown as ArrangementScore;

    const preview = buildAudioPreview(arrangement, score, 60);
    expect(preview.parts).toEqual([
      { id: "full", label: "Full arrangement" },
      { id: "principal-voice", label: "Principal Voice" },
      { id: "continuo-foundation", label: "Continuo Foundation" },
      { id: "realization", label: "Generated realization" },
    ]);
    expect(preview.events.filter((event) => event.part === "continuo-foundation")).toHaveLength(1);
    expect(preview.events.filter((event) => event.part === "realization")).toHaveLength(2);
  });
});
