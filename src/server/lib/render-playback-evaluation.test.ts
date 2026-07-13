import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import type { AudioPreview } from "../../lib/audio-preview.js";
import { MutationManifestSchema } from "../../lib/evaluation-domain.js";
import {
  evaluateCanonicalPlayback,
  evaluateFocusedVisualRegions,
  evaluateSemanticNotation,
  verifyMutationManifest,
} from "./render-playback-evaluation.js";

describe("render, playback, workflow, and mutation evaluation", () => {
  it("keeps semantic notation, focused visual, and canonical playback outcomes independent", () => {
    const semantic = [
      {
        id: "event.1",
        pitches: ["G4"],
        duration: "1/2",
        role: "principal_voice",
        notationIdentity: "classical-standard-staff",
      },
    ];
    expect(evaluateSemanticNotation(semantic, semantic)).toMatchObject({ status: "pass" });
    expect(
      evaluateSemanticNotation(semantic, [{ ...semantic[0]!, pitches: ["F#4"] }])
    ).toMatchObject({
      status: "fail",
      findings: [expect.objectContaining({ code: "notation.pitch_changed", eventId: "event.1" })],
    });
    expect(
      evaluateFocusedVisualRegions([
        { id: "region.principal-voice", changedFraction: 0.001, tolerance: 0.01 },
      ])
    ).toMatchObject({ status: "pass", wholePageComparison: "supplementary" });
    expect(
      evaluateFocusedVisualRegions([
        { id: "region.spacing", changedFraction: 0.02, tolerance: 0.01 },
      ])
    ).toMatchObject({ status: "review_required" });
    expect(evaluateCanonicalPlayback(preview(), preview())).toMatchObject({
      status: "pass",
      waveformCompared: false,
      comparedParts: ["principal-voice", "continuo-foundation"],
    });
  });

  it("detects duration, repeat, occurrence, part, and display-staff duplication mutations", () => {
    const expected = preview();
    const changed = structuredClone(expected);
    changed.performedForm.measureOccurrences.reverse();
    changed.performedForm.traversalDecisions = ["Skip the written repeat"];
    changed.events[0]!.durationSeconds += 0.5;
    changed.events[0]!.part = "accompaniment";
    changed.events.push(structuredClone(changed.events[0]!));
    expect(evaluateCanonicalPlayback(expected, changed)).toMatchObject({
      status: "fail",
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "playback.traversal_changed" }),
        expect.objectContaining({ code: "playback.repeat_decision_changed" }),
        expect.objectContaining({ code: "playback.canonical_event_changed" }),
        expect.objectContaining({ code: "playback.display_staff_duplication" }),
      ]),
    });
  });

  it("covers every declared mutation family without claiming universal completeness", () => {
    const manifest = Value.Decode(
      MutationManifestSchema,
      JSON.parse(
        readFileSync(path.resolve("test/fixtures/evaluation/mutation-manifest.json"), "utf8")
      )
    );
    expect(() => verifyMutationManifest(manifest)).not.toThrow();
    expect(manifest.universalCompletenessClaim).toBe(false);
    const coverage = JSON.parse(
      readFileSync(path.resolve("test/fixtures/evaluation/browser-workflow-coverage.json"), "utf8")
    ) as { scenarios: Array<{ id: string; testFile: string }> };
    expect(coverage.scenarios.map(({ id }) => id)).toEqual([
      "review",
      "artifact_handoff",
      "selection",
      "editing",
      "adoption",
      "reload",
      "stale_responses",
    ]);
    coverage.scenarios.forEach(({ testFile }) => expect(existsSync(testFile)).toBe(true));
  });
});

function preview(): AudioPreview {
  return {
    tempo: 60,
    durationSeconds: 8,
    synthesis: "basic-oscillator",
    mode: "literal",
    performedForm: {
      measureOccurrences: [
        {
          id: "occurrence.m1.1",
          measureId: "measure.1",
          iteration: 1,
          startSeconds: 0,
          durationSeconds: 4,
        },
        {
          id: "occurrence.m1.2",
          measureId: "measure.1",
          iteration: 2,
          startSeconds: 4,
          durationSeconds: 4,
        },
      ],
      traversalDecisions: ["Repeat measure 1 twice"],
      skipRepeats: false,
    },
    parts: [
      { id: "full", label: "Full arrangement" },
      { id: "principal-voice", label: "Principal Voice" },
      { id: "continuo-foundation", label: "Continuo Foundation" },
    ],
    events: [
      sounding("playback.1", "occurrence.m1.1", 1, "principal-voice", 67, 0),
      sounding("playback.2", "occurrence.m1.1", 1, "continuo-foundation", 43, 0),
      sounding("playback.3", "occurrence.m1.2", 2, "principal-voice", 67, 4),
      sounding("playback.4", "occurrence.m1.2", 2, "continuo-foundation", 43, 4),
    ],
  };
}

function sounding(
  occurrenceId: string,
  measureOccurrenceId: string,
  iteration: number,
  part: "principal-voice" | "continuo-foundation",
  midi: number,
  startSeconds: number
) {
  return {
    occurrenceId,
    measureOccurrenceId,
    iteration,
    arrangementEventId: `arrangement.${part}`,
    sourceEventIds: [`source.${part}`],
    transformationEntryIds: [`transformation.${part}`],
    auditTargetIds: [`target.${part}`],
    part,
    midi,
    startSeconds,
    durationSeconds: 2,
  };
}
