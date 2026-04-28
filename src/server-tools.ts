import { EngraveParamsSchema, type EngraveResult } from "./lib/engrave-schema.js";
import { createServerTool } from "./lib/create-server-tool.js";
import {
  AnalyzeParamsSchema,
  CompileParamsSchema,
  LintParamsSchema,
  type AnalysisResult,
  type CompileResult,
  type LintViolation,
} from "./types.js";

export const compileTool = createServerTool<typeof CompileParamsSchema, CompileResult>({
  name: "compile",
  label: "Compile",
  description:
    "Compile LilyPond source into SVG/PDF notation output. Mandatory after generating or modifying LilyPond; on errors, revise and recompile without asking the user until the bounded retry limit is reached.",
  parameters: CompileParamsSchema,
  endpoint: "/api/compile",
  formatContent: (result) => {
    if (result.errors.length > 0) {
      const lines = result.errors.map((error) => `  Line ${error.line}: ${error.message}`);
      const hasStringAssignmentError = result.errors.some(
        (error) => error.type === "string_assignment" || /no string for pitch/i.test(error.message)
      );

      if (hasStringAssignmentError) {
        lines.push(
          "Hint: LilyPond could not infer playable strings/frets. Use tabulate/voicings/check_playability and explicit tab-first course/fret mappings instead of automatic string assignment."
        );
      }

      return `Compilation failed with ${result.errors.length} error(s):\n${lines.join("\n")}`;
    }

    const parts = ["Compiled successfully."];
    if (result.barCount) parts.push(`${result.barCount} bars.`);
    if (result.voiceCount) parts.push(`${result.voiceCount} voices.`);
    parts.push("No errors.");
    return parts.join(" ");
  },
});

export const engraveTool = createServerTool<typeof EngraveParamsSchema, EngraveResult>({
  name: "engrave",
  label: "Engrave",
  description:
    "Generate valid LilyPond source from structured musical data (positions, pitches, durations). " +
    "Use after tabulate/voicings to produce notation without hand-writing LilyPond syntax. " +
    "Validates all input, resolves pitches, and builds output matching the chosen template.",
  parameters: EngraveParamsSchema,
  endpoint: "/api/engrave",
  formatContent: (result) => {
    const parts = ["Engraved LilyPond source successfully."];
    if (result.warnings.length > 0) {
      parts.push(`Warnings: ${result.warnings.join("; ")}`);
    } else {
      parts.push("No warnings.");
    }
    return parts.join(" ");
  },
});

export const analyzeTool = createServerTool<typeof AnalyzeParamsSchema, AnalysisResult>({
  name: "analyze",
  label: "Analyze",
  description:
    "Analyze a MusicXML score — detect key, time signature, voice ranges, and Roman numeral chord progression.",
  parameters: AnalyzeParamsSchema,
  endpoint: "/api/analyze",
  formatContent: (result) => {
    const lines = [`Key: ${result.key}`, `Time: ${result.timeSignature}`];

    if (result.voices.length > 0) {
      lines.push(
        `Voices: ${result.voices
          .map((voice) => `${voice.name} (${voice.lowest}–${voice.highest})`)
          .join(", ")}`
      );
    }

    if (result.chords.length > 0) {
      lines.push("Chord progression:");
      const byBar = new Map<number, string[]>();

      for (const chord of result.chords) {
        const label = chord.romanNumeral ?? chord.chord ?? chord.pitches.join(",");
        const bar = byBar.get(chord.bar) ?? [];
        bar.push(label);
        byBar.set(chord.bar, bar);
      }

      for (const [bar, chords] of byBar) {
        lines.push(`  Bar ${bar}: ${chords.join(" | ")}`);
      }
    }

    return lines.join("\n");
  },
});

export const lintTool = createServerTool<typeof LintParamsSchema, { violations: LintViolation[] }>({
  name: "lint",
  label: "Lint",
  description:
    "Check a passage for voice-leading violations: parallel fifths/octaves, voice crossing, spacing, unresolved leading tones.",
  parameters: LintParamsSchema,
  endpoint: "/api/lint",
  formatContent: (result) => {
    if (result.violations.length === 0) {
      return "No voice leading violations found. Passage is clean.";
    }

    const header = `${result.violations.length} violation(s) found:`;
    const items = result.violations.map(
      (violation) =>
        `  Bar ${violation.bar}, beat ${violation.beat}: ${violation.description} [${violation.voices.join(", ")}]`
    );
    return [header, ...items].join("\n");
  },
});
