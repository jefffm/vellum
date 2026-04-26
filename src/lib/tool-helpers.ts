import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { LintViolation, TabPosition } from "../types.js";

export function toolResult<T>(text: string, details: T): AgentToolResult<T> {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

export function toolError<T = undefined>(message: string): AgentToolResult<T> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: undefined as T,
  };
}

export function formatViolations(violations: LintViolation[]): string {
  if (violations.length === 0) {
    return "No voice leading violations found. Passage is clean.";
  }

  const label = violations.length === 1 ? "violation" : "violations";
  const lines = violations.map(
    (violation) => `  Bar ${violation.bar}, beat ${violation.beat}: ${violation.description}`
  );

  return `${violations.length} ${label} found:\n${lines.join("\n")}`;
}

export function formatPositions(positions: TabPosition[]): string {
  if (positions.length === 0) {
    return "No playable positions found.";
  }

  return positions
    .map((position) => `Course ${position.course}, fret ${position.fret} (${position.quality})`)
    .join("\n");
}
