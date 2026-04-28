import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Note } from "tonal";
import { noteToMidi } from "./lib/pitch.js";
import { loadBrowserProfile } from "./lib/browser-profiles.js";
import { errorMessage } from "./lib/errors.js";
import { toolError, toolResult } from "./lib/tool-helpers.js";
import { TransposeParamsSchema } from "./types.js";

export type TransposeResult = {
  original: string[];
  transposed: string[];
  outOfRange: string[];
  suggestedKeys: string[];
};

const IDIOMATIC_KEYS: Record<string, string[]> = {
  "baroque-lute-13": ["D minor", "A minor", "F major", "G minor", "C major"],
  "baroque-guitar-5": ["A minor", "E minor", "C major", "G major", "D minor"],
  "renaissance-lute-6": ["G major", "D minor", "C major", "A minor"],
  "theorbo-14": ["D minor", "G minor", "A minor"],
  "classical-guitar-6": ["E minor", "A minor", "D major", "G major", "C major"],
};

export const transposeTool: AgentTool<typeof TransposeParamsSchema, TransposeResult> = {
  name: "transpose",
  label: "Transpose",
  description:
    "Transpose a set of pitches by a named interval, check against instrument range, and suggest idiomatic keys.",
  parameters: TransposeParamsSchema,
  execute: async (_toolCallId, params) => {
    try {
      const profile = loadBrowserProfile(params.instrument);
      const original = params.source.trim().split(/\s+/);
      const transposed: string[] = [];
      const outOfRange: string[] = [];

      const range = profile.range;
      const rangeLow = range ? noteToMidi(range.lowest) : undefined;
      const rangeHigh = range ? noteToMidi(range.highest) : undefined;

      for (const pitch of original) {
        const result = Note.transpose(pitch, params.interval);

        if (!result || result === "") {
          return toolError(`Could not transpose pitch "${pitch}" by interval "${params.interval}"`);
        }

        transposed.push(result);

        const midi = Note.midi(result);

        if (midi !== null && rangeLow !== undefined && rangeHigh !== undefined) {
          if (midi < rangeLow || midi > rangeHigh) {
            outOfRange.push(result);
          }
        }
      }

      const suggestedKeys = IDIOMATIC_KEYS[params.instrument] ?? [];

      const outOfRangeNote =
        outOfRange.length > 0
          ? ` ${outOfRange.length} out of range: ${outOfRange.join(", ")}.`
          : " 0 out of range.";

      const summary = `Transposed ${original.length} pitch(es) by ${params.interval}.${outOfRangeNote} Idiomatic keys for ${params.instrument}: ${suggestedKeys.join(", ") || "none listed"}.`;

      return toolResult(summary, { original, transposed, outOfRange, suggestedKeys });
    } catch (error) {
      return toolError(errorMessage(error));
    }
  },
};
