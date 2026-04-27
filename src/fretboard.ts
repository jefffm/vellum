import type { AgentTool } from "@mariozechner/pi-agent-core";
import { instrumentTool, toolResult } from "./lib/tool-helpers.js";
import { FretboardParamsSchema, type TabPosition } from "./types.js";
import type { InstrumentModel } from "./lib/instrument-model.js";

export type FretboardResult = {
  svg: string;
  coursesShown: number;
  fretsShown: number;
};

const COURSE_SPACING = 20;
const FRET_SPACING = 40;
const MARGIN_LEFT = 30;
const MARGIN_TOP = 25;
const MARGIN_RIGHT = 20;
const MARGIN_BOTTOM = 20;
const MARKER_RADIUS = 7;

function computeFretRange(
  positions: TabPosition[],
  maxFrets: number
): { minFret: number; maxFret: number } {
  const frets = positions.map((p) => p.fret).filter((f) => f > 0);

  if (frets.length === 0) {
    return { minFret: 0, maxFret: Math.min(4, maxFrets) };
  }

  const min = Math.max(0, Math.min(...frets) - 1);
  const max = Math.min(maxFrets, Math.max(...frets) + 1);
  const minWidth = 3; // Always show at least 3 frets for readability

  return { minFret: min, maxFret: Math.max(max, min + minWidth) };
}

export function renderFretboardSvg(
  positions: TabPosition[],
  model: InstrumentModel
): FretboardResult {
  const coursesShown = model.courseCount();
  const frettedCourseCount = model.frettedCourseCount();
  const { minFret, maxFret } = computeFretRange(positions, model.maxFrets());
  const fretsShown = maxFret - minFret;

  const width = MARGIN_LEFT + fretsShown * FRET_SPACING + MARGIN_RIGHT;
  const height = MARGIN_TOP + (coursesShown - 1) * COURSE_SPACING + MARGIN_BOTTOM;

  const nutX = MARGIN_LEFT;
  const topCourseY = MARGIN_TOP;
  const bottomCourseY = MARGIN_TOP + (coursesShown - 1) * COURSE_SPACING;

  const elements: string[] = [];

  // Nut line (thick) if starting at fret 0
  if (minFret === 0) {
    elements.push(
      `<line x1="${nutX}" y1="${topCourseY}" x2="${nutX}" y2="${bottomCourseY}" stroke="#333" stroke-width="3" />`
    );
  }

  // Course lines (horizontal)
  for (let c = 1; c <= coursesShown; c++) {
    const y = topCourseY + (c - 1) * COURSE_SPACING;
    const isDiapason = c > frettedCourseCount;
    const strokeDash = isDiapason ? ' stroke-dasharray="4,3"' : "";
    elements.push(
      `<line x1="${nutX}" y1="${y}" x2="${nutX + fretsShown * FRET_SPACING}" y2="${y}" stroke="#333" stroke-width="1"${strokeDash} />`
    );
  }

  // Fret lines (vertical)
  for (let f = 0; f <= fretsShown; f++) {
    const x = nutX + f * FRET_SPACING;
    elements.push(
      `<line x1="${x}" y1="${topCourseY}" x2="${x}" y2="${bottomCourseY}" stroke="#333" stroke-width="1" />`
    );
  }

  // Course labels
  for (let c = 1; c <= coursesShown; c++) {
    const y = topCourseY + (c - 1) * COURSE_SPACING;
    elements.push(
      `<text x="10" y="${y}" font-size="12" text-anchor="middle" dominant-baseline="central">${c}</text>`
    );
  }

  // Fret labels
  for (let f = 0; f <= fretsShown; f++) {
    const fretNumber = minFret + f;
    const x = nutX + f * FRET_SPACING;
    elements.push(
      `<text x="${x}" y="12" font-size="10" text-anchor="middle">${fretNumber}</text>`
    );
  }

  // Position markers
  for (const pos of positions) {
    const y = topCourseY + (pos.course - 1) * COURSE_SPACING;

    if (pos.fret === 0) {
      // Open string: hollow circle at nut
      const cx = nutX;
      elements.push(
        `<circle cx="${cx}" cy="${y}" r="6" fill="none" stroke="#333" stroke-width="2" />`
      );
    } else {
      // Fretted: filled circle between fret lines
      const fretOffset = pos.fret - minFret;
      const cx = nutX + (fretOffset - 0.5) * FRET_SPACING;
      elements.push(
        `<circle cx="${cx}" cy="${y}" r="${MARKER_RADIUS}" fill="#333" />`
      );
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    ...elements,
    "</svg>",
  ].join("\n");

  return { svg, coursesShown, fretsShown };
}

export const fretboardTool: AgentTool<typeof FretboardParamsSchema, FretboardResult> = {
  name: "fretboard",
  label: "Fretboard",
  description:
    "Render an SVG fretboard diagram showing finger positions on the instrument.",
  parameters: FretboardParamsSchema,
  execute: async (_toolCallId, params) =>
    instrumentTool(params.instrument, (model) => {
      const result = renderFretboardSvg(params.positions, model);
      const summary = `Fretboard diagram for ${params.instrument}: ${result.coursesShown} courses, frets shown: ${result.fretsShown}. ${params.positions.length} position(s) marked.`;
      return toolResult(summary, result);
    }),
};
