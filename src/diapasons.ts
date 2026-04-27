import type { AgentTool } from "@mariozechner/pi-agent-core";
import { loadBrowserProfile } from "./lib/browser-profiles.js";
import { errorMessage } from "./lib/errors.js";
import { toolError, toolResult } from "./lib/tool-helpers.js";
import { DiapasonsParamsSchema } from "./types.js";

export type DiapasonCourse = {
  course: number;
  pitch: string;
};

export type DiapasonsResult = {
  key: string;
  schemeName: string;
  courses: DiapasonCourse[];
  lilypondSyntax: string;
  warning?: string;
};

const PITCH_TO_LILYPOND: Record<string, string> = {
  C: "c",
  "C#": "cis",
  Db: "des",
  D: "d",
  "D#": "dis",
  Eb: "ees",
  E: "e",
  F: "f",
  "F#": "fis",
  Gb: "ges",
  G: "g",
  "G#": "gis",
  Ab: "aes",
  A: "a",
  "A#": "ais",
  Bb: "bes",
  B: "b",
};

function normalizeKeyToScheme(key: string): string {
  let s = key.trim();

  // Handle shorthand before lowercasing (case-sensitive: m = minor, M = major)
  s = s.replace(/^([A-Ga-g](?:#|b)?)M$/, "$1_major");
  s = s.replace(/^([A-Ga-g](?:#|b)?)m$/, "$1_minor");

  return s.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

function findScheme(
  schemes: Record<string, string[]>,
  key: string
): { name: string; pitches: string[]; warning?: string } | undefined {
  const normalized = normalizeKeyToScheme(key);

  // Exact match
  if (schemes[normalized]) {
    return { name: normalized, pitches: schemes[normalized] };
  }

  // Try matching just the root note
  const rootMatch = key.trim().match(/^([A-Ga-g][#b]?)/);

  if (rootMatch) {
    const root = rootMatch[1].toLowerCase();
    const candidates = Object.keys(schemes).filter((schemeName) =>
      schemeName.startsWith(root)
    );

    if (candidates.length > 0) {
      // Prefer minor if ambiguous
      const minorCandidate = candidates.find((c) => c.includes("minor"));
      const chosen = minorCandidate ?? candidates[0];
      return {
        name: chosen,
        pitches: schemes[chosen],
        warning: `Key "${key}" not found exactly; using closest match "${chosen}".`,
      };
    }
  }

  return undefined;
}

function buildLilypondSyntax(pitches: string[], startCourse: number): string {
  const lilyParts: string[] = [];

  for (let i = 0; i < pitches.length; i++) {
    const course = startCourse + i;
    const lyName = PITCH_TO_LILYPOND[pitches[i]] ?? pitches[i].toLowerCase();
    // Courses in the upper range get one comma (octave 2),
    // last two courses get two commas (octave 1)
    const octaveSuffix = i < pitches.length - 2 ? "," : ",,";
    lilyParts.push(`${lyName}${octaveSuffix}`);
  }

  return `\\stringTuning <${lilyParts.join(" ")}>`;
}

export const diapasonsTool: AgentTool<typeof DiapasonsParamsSchema, DiapasonsResult> = {
  name: "diapasons",
  label: "Diapasons",
  description:
    "Look up bass string tuning for a key. Returns diapason pitches and LilyPond syntax for the instrument's diapason scheme.",
  parameters: DiapasonsParamsSchema,
  execute: async (_toolCallId, params) => {
    try {
      const instrumentId = params.instrument ?? "baroque-lute-13";
      const profile = loadBrowserProfile(instrumentId);

      if (!profile.diapason_schemes || Object.keys(profile.diapason_schemes).length === 0) {
        return toolError(`Instrument ${instrumentId} has no diapason schemes.`);
      }

      const match = findScheme(profile.diapason_schemes, params.key);

      if (!match) {
        const available = Object.keys(profile.diapason_schemes).join(", ");
        return toolError(
          `No diapason scheme found for key "${params.key}". Available schemes: ${available}`
        );
      }

      const startCourse = (profile.fretted_courses ?? 0) + 1;
      const courses: DiapasonCourse[] = match.pitches.map((pitch, i) => ({
        course: startCourse + i,
        pitch,
      }));

      const lilypondSyntax = buildLilypondSyntax(match.pitches, startCourse);

      const summary = `${params.key} diapasons for ${instrumentId}: ${match.pitches.join(" ")} (courses ${startCourse}-${startCourse + match.pitches.length - 1}). LilyPond: ${lilypondSyntax}`;

      const details: DiapasonsResult = {
        key: params.key,
        schemeName: match.name,
        courses,
        lilypondSyntax,
        warning: match.warning,
      };

      return toolResult(match.warning ? `${summary}\nNote: ${match.warning}` : summary, details);
    } catch (error) {
      return toolError(errorMessage(error));
    }
  },
};
