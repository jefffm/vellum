import process from "node:process";
import type { AudioPreview } from "../lib/audio-preview.js";
import {
  evaluateCanonicalPlayback,
  evaluateFocusedVisualRegions,
  evaluateSemanticNotation,
} from "./lib/render-playback-evaluation.js";

export function main(): void {
  const kind = process.argv[process.argv.indexOf("--kind") + 1];
  if (kind === "render") {
    const semantic = [
      {
        id: "fixture.event.1",
        pitches: ["G4"],
        duration: "1/2",
        role: "principal_voice",
        notationIdentity: "standard-staff",
      },
    ];
    const result = {
      ok: true,
      command: "eval:render",
      semantic: evaluateSemanticNotation(semantic, semantic),
      visual: evaluateFocusedVisualRegions([
        { id: "fixture.region.principal-voice", changedFraction: 0, tolerance: 0.01 },
      ]),
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (kind === "playback") {
    const fixture = preview();
    const result = {
      ok: true,
      command: "eval:playback",
      canonical: evaluateCanonicalPlayback(fixture, fixture),
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    process.stderr.write(
      `${JSON.stringify({ ok: false, error: "--kind must be render or playback" })}\n`
    );
    process.exitCode = 1;
  }
}

function preview(): AudioPreview {
  return {
    tempo: 60,
    durationSeconds: 4,
    synthesis: "basic-oscillator",
    mode: "literal",
    performedForm: {
      measureOccurrences: [
        {
          id: "fixture.occurrence.1",
          measureId: "fixture.measure.1",
          iteration: 1,
          startSeconds: 0,
          durationSeconds: 4,
        },
      ],
      traversalDecisions: ["Play the retained occurrence once"],
      skipRepeats: false,
    },
    parts: [
      { id: "full", label: "Full arrangement" },
      { id: "principal-voice", label: "Principal Voice" },
    ],
    events: [
      {
        occurrenceId: "fixture.playback.1",
        measureOccurrenceId: "fixture.occurrence.1",
        iteration: 1,
        arrangementEventId: "fixture.event.1",
        sourceEventIds: ["fixture.source-event.1"],
        transformationEntryIds: ["fixture.transformation.1"],
        auditTargetIds: ["fixture.target.principal-voice"],
        part: "principal-voice",
        midi: 67,
        startSeconds: 0,
        durationSeconds: 2,
      },
    ],
  };
}

main();
