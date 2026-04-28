import type { AgentTool } from "@mariozechner/pi-agent-core";
import { alfabetoLookup, type AlfabetoLookupResult } from "./lib/alfabeto/index.js";
import { InstrumentModel } from "./lib/instrument-model.js";
import { errorMessage } from "./lib/errors.js";
import { runTheoryOperation, type TheoryValue } from "./theory.js";
import { formatPositions, instrumentTool, toolError, toolResult } from "./lib/tool-helpers.js";
import { analyzeTool, compileTool, engraveTool, lintTool } from "./server-tools.js";
import { transposeTool } from "./transpose.js";
import { diapasonsTool } from "./diapasons.js";
import { fretboardTool } from "./fretboard.js";
import {
  AlfabetoLookupParamsSchema,
  CheckPlayabilityParamsSchema,
  TabulateParamsSchema,
  TheoryParamsSchema,
  VoicingsParamsSchema,
  type Bar,
  type PlayabilityResult,
  type TabPosition,
  type Violation,
  type Voicing,
} from "./types.js";

export const tabulateTool: AgentTool<typeof TabulateParamsSchema, { positions: TabPosition[] }> = {
  name: "tabulate",
  label: "Tabulate",
  description:
    "Find all playable course/fret positions for a pitch on a historical plucked instrument.",
  parameters: TabulateParamsSchema,
  execute: async (_toolCallId, params) =>
    instrumentTool(params.instrument, (model) => {
      const positions = model.positionsForPitch(params.pitch);
      const summary =
        positions.length === 0
          ? `No playable positions found for ${params.pitch} on ${params.instrument}.`
          : `${params.pitch} on ${params.instrument}:\n${formatPositions(positions)}`;

      return toolResult(summary, { positions });
    }),
};

export const voicingsTool: AgentTool<typeof VoicingsParamsSchema, { voicings: Voicing[] }> = {
  name: "voicings",
  label: "Voicings",
  description:
    "Enumerate playable chord voicings for a set of pitches on a historical plucked instrument.",
  parameters: VoicingsParamsSchema,
  execute: async (_toolCallId, params) =>
    instrumentTool(params.instrument, (model) => {
      const voicings = model.voicingsForChord(params.notes, params.max_stretch);
      const summary =
        voicings.length === 0
          ? `No playable voicings found for ${params.notes.join(", ")} on ${params.instrument}.`
          : `Top voicings for ${params.notes.join(", ")} on ${params.instrument}:\n${formatVoicings(voicings.slice(0, 5))}`;

      return toolResult(summary, { voicings });
    }),
};

export const checkPlayabilityTool: AgentTool<
  typeof CheckPlayabilityParamsSchema,
  PlayabilityResult
> = {
  name: "check_playability",
  label: "Check Playability",
  description:
    "Validate a passage against instrument range, stretch, course conflict, and right-hand constraints.",
  parameters: CheckPlayabilityParamsSchema,
  execute: async (_toolCallId, params) =>
    instrumentTool(params.instrument, (model) => {
      const details = checkPlayability(model, params.bars);
      const summary =
        details.violations.length === 0
          ? `Passage is playable on ${params.instrument}. Difficulty: ${details.difficulty}.`
          : `${details.violations.length} playability violation(s) on ${params.instrument}. Difficulty: ${details.difficulty}.\n${formatPlayabilityViolations(details.violations)}`;

      return toolResult(summary, details);
    }),
};

export const alfabetoLookupTool: AgentTool<
  typeof AlfabetoLookupParamsSchema,
  AlfabetoLookupResult
> = {
  name: "alfabeto_lookup",
  label: "Alfabeto Lookup",
  description:
    "Look up historical baroque guitar alfabeto chord symbols and course/fret shapes from supported charts. Use for rasgueado/strummed alfabeto passages before engraving alfabeto events.",
  parameters: AlfabetoLookupParamsSchema,
  execute: async (_toolCallId, params) => {
    try {
      const result = alfabetoLookup(params);
      return toolResult(formatAlfabetoLookup(result, params.chordName), result);
    } catch (error) {
      return toolError(errorMessage(error));
    }
  },
};

export const theoryTool: AgentTool<
  typeof TheoryParamsSchema,
  { operation: string; result: TheoryValue }
> = {
  name: "theory",
  label: "Theory",
  description:
    "Run instant browser-side tonal.js theory operations such as intervals, transposition, chords, scales, Roman numerals, and enharmonics.",
  parameters: TheoryParamsSchema,
  execute: async (_toolCallId, params) => {
    try {
      const result = runTheoryOperation(params);
      return toolResult(formatTheoryResult(params.operation, result), {
        operation: params.operation,
        result,
      });
    } catch (error) {
      return toolError(errorMessage(error));
    }
  },
};

export const tools = [
  tabulateTool,
  voicingsTool,
  checkPlayabilityTool,
  alfabetoLookupTool,
  theoryTool,
  compileTool,
  engraveTool,
  analyzeTool,
  lintTool,
  transposeTool,
  diapasonsTool,
  fretboardTool,
];

function formatAlfabetoLookup(result: AlfabetoLookupResult, chordName?: string): string {
  const label = chordName ? ` for ${chordName}` : "";

  if (result.matches.length === 0) {
    return `No alfabeto matches found${label} in ${result.chartId}.`;
  }

  const lines = [`${result.matches.length} alfabeto match(es)${label} in ${result.chartId}:`];

  for (const [index, match] of result.matches.slice(0, 8).entries()) {
    const source =
      match.source === "barre"
        ? `barre at fret ${match.barreAt} from ${match.baseShape}`
        : "standard";
    const positions = match.positions
      .map((position) => `course ${position.course} fret ${position.fret}`)
      .join(", ");
    lines.push(`${index + 1}. ${match.letter} — ${match.chord} (${source}): ${positions}`);
  }

  if (result.matches.length > 8) {
    lines.push(`...and ${result.matches.length - 8} more.`);
  }

  return lines.join("\n");
}

function formatTheoryResult(operation: string, result: TheoryValue): string {
  if (Array.isArray(result)) {
    return `${operation}: ${result.join(", ")}`;
  }

  if (typeof result === "string") {
    return `${operation}: ${result}`;
  }

  return `${operation}: ${result.roman} in ${result.key} = ${result.chord}`;
}

function checkPlayability(model: InstrumentModel, bars: Bar[]): PlayabilityResult {
  const violations: Violation[] = [];
  let difficultyScore = 0;

  for (const bar of bars) {
    const positions: TabPosition[] = [];

    if (bar.notes.length > 4) {
      violations.push({
        bar: bar.bar,
        type: "rh_pattern",
        description: `Bar ${bar.bar} has ${bar.notes.length} simultaneous notes; more than 4 is not feasible`,
      });
      difficultyScore = Math.max(difficultyScore, 2);
    } else if (bar.notes.length > 3 && model.courseCount() > 5) {
      difficultyScore = Math.max(difficultyScore, 2);
    }

    for (const note of bar.notes) {
      if (!note.position) {
        if (model.positionsForPitch(note.pitch).length === 0) {
          violations.push({
            bar: bar.bar,
            type: "out_of_range",
            description: `Pitch ${note.pitch} is outside the playable range`,
          });
          difficultyScore = Math.max(difficultyScore, 1);
        }
        continue;
      }

      const rangeViolation = validatePositionRange(model, note.position, bar.bar);

      if (rangeViolation) {
        violations.push(rangeViolation);
        difficultyScore = Math.max(difficultyScore, 1);
        continue;
      }

      positions.push(note.position);
    }

    const playability = model.isPlayable(positions);
    for (const violation of playability.violations) {
      violations.push({ ...violation, bar: bar.bar });
      difficultyScore = Math.max(difficultyScore, violation.type === "stretch" ? 2 : 1);
    }

    if (countPositionShifts(positions) > 2) {
      difficultyScore = Math.max(difficultyScore, 1);
    }
  }

  if (violations.length > 0) {
    difficultyScore = Math.max(difficultyScore, 1);
  }

  return {
    violations,
    difficulty:
      difficultyScore >= 2 ? "advanced" : difficultyScore === 1 ? "intermediate" : "beginner",
    flagged_bars: [...new Set(violations.map((violation) => violation.bar))].sort((a, b) => a - b),
  };
}

function validatePositionRange(
  model: InstrumentModel,
  position: TabPosition,
  bar: number
): Violation | undefined {
  if (
    !Number.isInteger(position.course) ||
    position.course < 1 ||
    position.course > model.courseCount()
  ) {
    return {
      bar,
      type: "out_of_range",
      description: `Course ${position.course} is outside 1-${model.courseCount()}`,
    };
  }

  if (!Number.isInteger(position.fret) || position.fret < 0 || position.fret > model.maxFrets()) {
    return {
      bar,
      type: "out_of_range",
      description: `Fret ${position.fret} is outside 0-${model.maxFrets()}`,
    };
  }

  if (model.isDiapason(position.course) && position.fret !== 0) {
    return {
      bar,
      type: "out_of_range",
      description: `Course ${position.course} is a diapason and cannot be fretted`,
    };
  }

  return undefined;
}

function countPositionShifts(positions: TabPosition[]): number {
  const fretted = positions
    .filter((position) => position.fret > 0)
    .map((position) => position.fret);

  if (fretted.length <= 1) {
    return 0;
  }

  let shifts = 0;
  for (let index = 1; index < fretted.length; index += 1) {
    if (Math.abs(fretted[index] - fretted[index - 1]) > 2) {
      shifts += 1;
    }
  }

  return shifts;
}

function formatPlayabilityViolations(violations: Violation[]): string {
  return violations
    .map((violation) => `Bar ${violation.bar}: ${violation.type} — ${violation.description}`)
    .join("\n");
}

function formatVoicings(voicings: Voicing[]): string {
  return voicings
    .map((voicing, index) => {
      const positions = voicing.positions
        .map((position) => `course ${position.course} fret ${position.fret}`)
        .join(", ");
      return `${index + 1}. stretch ${voicing.stretch}, open strings ${voicing.open_strings}, campanella ${voicing.campanella_score}: ${positions}`;
    })
    .join("\n");
}
