import { describe, expect, it } from "vitest";
import { formatPositions, formatViolations, toolError, toolResult } from "./tool-helpers.js";
import type { LintViolation, TabPosition } from "../types.js";

describe("tool helpers", () => {
  it("builds successful tool results", () => {
    const result = toolResult("hello", { value: 1 });

    expect(result.content).toEqual([{ type: "text", text: "hello" }]);
    expect(result.details.value).toBe(1);
  });

  it("builds error tool results", () => {
    const result = toolError("bad input");

    expect(result.content).toEqual([{ type: "text", text: "Error: bad input" }]);
    expect(result.details).toBeUndefined();
  });

  it("formats zero violations", () => {
    expect(formatViolations([])).toBe("No voice leading violations found. Passage is clean.");
  });

  it("formats one violation", () => {
    const violations: LintViolation[] = [
      {
        bar: 2,
        beat: 1.5,
        type: "parallel_fifths",
        description: "Parallel fifths between soprano and bass",
        voices: ["soprano", "bass"],
      },
    ];

    expect(formatViolations(violations)).toBe(
      "1 violation found:\n  Bar 2, beat 1.5: Parallel fifths between soprano and bass"
    );
  });

  it("formats multiple violations", () => {
    const violations: LintViolation[] = [
      {
        bar: 1,
        beat: 1,
        type: "spacing",
        description: "Upper voices too far apart",
        voices: ["alto", "soprano"],
      },
      {
        bar: 3,
        beat: 2,
        type: "voice_crossing",
        description: "Alto crosses above soprano",
        voices: ["alto", "soprano"],
      },
    ];

    expect(formatViolations(violations)).toBe(
      "2 violations found:\n" +
        "  Bar 1, beat 1: Upper voices too far apart\n" +
        "  Bar 3, beat 2: Alto crosses above soprano"
    );
  });

  it("formats positions for every quality type", () => {
    const positions: TabPosition[] = [
      { course: 1, fret: 0, quality: "open" },
      { course: 2, fret: 2, quality: "low_fret" },
      { course: 3, fret: 7, quality: "high_fret" },
      { course: 7, fret: 0, quality: "diapason" },
    ];

    expect(formatPositions(positions)).toBe(
      "Course 1, fret 0 (open)\n" +
        "Course 2, fret 2 (low_fret)\n" +
        "Course 3, fret 7 (high_fret)\n" +
        "Course 7, fret 0 (diapason)"
    );
  });

  it("formats empty positions", () => {
    expect(formatPositions([])).toBe("No playable positions found.");
  });
});
