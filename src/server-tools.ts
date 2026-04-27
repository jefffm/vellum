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
  description: "Compile LilyPond source into SVG/PDF notation output.",
  parameters: CompileParamsSchema,
  endpoint: "/api/compile",
  formatContent: (result) => {
    if (result.errors.length > 0) {
      return `Compilation failed with ${result.errors.length} error(s):\n${result.errors
        .map((error) => `  Line ${error.line}: ${error.message}`)
        .join("\n")}`;
    }

    const parts = ["Compiled successfully."];
    if (result.barCount) parts.push(`${result.barCount} bars.`);
    if (result.voiceCount) parts.push(`${result.voiceCount} voices.`);
    parts.push("No errors.");
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
