export const ALL_EVALUATION_SUITES = [
  "fast",
  "golden",
  "render",
  "playback",
  "omr",
  "model",
  "comparison",
  "workflow",
] as const;

export type EvaluationSuiteName = (typeof ALL_EVALUATION_SUITES)[number];

const rules: Array<{ pattern: RegExp; suites: EvaluationSuiteName[] }> = [
  { pattern: /^src\/lib\/(music-domain|evaluation-domain)/, suites: [...ALL_EVALUATION_SUITES] },
  { pattern: /^src\/lib\/.*arrang/, suites: ["fast", "golden", "playback", "render"] },
  { pattern: /^src\/lib\/audio-preview/, suites: ["fast", "playback", "golden"] },
  { pattern: /^src\/server\/lib\/(omr|source-import)/, suites: ["fast", "omr", "golden"] },
  { pattern: /^src\/server\/lib\/.*evaluation/, suites: ["fast", "comparison", "golden"] },
  { pattern: /^src\/(guided-start|artifact-preview)/, suites: ["fast", "workflow", "render"] },
  { pattern: /^profiles\//, suites: ["fast", "golden", "render", "playback"] },
  { pattern: /^test\/fixtures\//, suites: ["golden", "render", "playback", "omr", "model"] },
];

export function selectEvaluationSuites(changedPaths: string[]): {
  suites: EvaluationSuiteName[];
  broadFallback: boolean;
  rationale: string;
  disclaimer: string;
} {
  const selected = new Set<EvaluationSuiteName>();
  let broadFallback = changedPaths.length === 0;
  for (const changedPath of changedPaths) {
    const matches = rules.filter(({ pattern }) => pattern.test(changedPath));
    if (matches.length === 0 || /dynamic|registry|plugin/.test(changedPath)) {
      broadFallback = true;
      break;
    }
    matches.flatMap(({ suites }) => suites).forEach((suite) => selected.add(suite));
  }
  const suites = broadFallback
    ? [...ALL_EVALUATION_SUITES]
    : ALL_EVALUATION_SUITES.filter((suite) => selected.has(suite));
  return {
    suites,
    broadFallback,
    rationale: broadFallback
      ? "Unknown or dynamic impact selects the broad offline suite set."
      : "Selected suites follow declared representative path mappings.",
    disclaimer:
      "Impact selection is routing evidence only; it does not prove that skipped suites are irrelevant.",
  };
}
