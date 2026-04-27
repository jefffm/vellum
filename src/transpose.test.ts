import { describe, expect, it } from "vitest";
import { transposeTool } from "./transpose.js";

describe("transpose tool", () => {
  it("transposes C4 up a P5 to G4", async () => {
    const result = await transposeTool.execute("call-1", {
      source: "C4",
      interval: "P5",
      instrument: "baroque-lute-13",
    });

    expect(result.details.transposed).toEqual(["G4"]);
    expect(result.details.original).toEqual(["C4"]);
  });

  it("transposes multiple pitches up m3", async () => {
    const result = await transposeTool.execute("call-1", {
      source: "C4 E4 G4",
      interval: "m3",
      instrument: "baroque-lute-13",
    });

    expect(result.details.transposed).toHaveLength(3);
    expect(result.details.transposed[0]).toBe("Eb4");
  });

  it("flags out-of-range transposed pitches", async () => {
    // Baroque lute range is A1–C5. Transposing C5 up a P5 gives G5 — out of range.
    const result = await transposeTool.execute("call-1", {
      source: "C5",
      interval: "P5",
      instrument: "baroque-lute-13",
    });

    expect(result.details.outOfRange.length).toBeGreaterThan(0);
  });

  it("returns error for unknown instrument", async () => {
    const result = await transposeTool.execute("call-1", {
      source: "C4",
      interval: "P5",
      instrument: "nonexistent",
    });

    const c = result.content[0];
    expect(c.type).toBe("text");
    if (c.type === "text") {
      expect(c.text).toContain("Error");
    }
  });

  it("includes idiomatic keys for baroque-lute-13", async () => {
    const result = await transposeTool.execute("call-1", {
      source: "C4",
      interval: "P1",
      instrument: "baroque-lute-13",
    });

    expect(result.details.suggestedKeys).toContain("D minor");
    expect(result.details.suggestedKeys).toContain("A minor");
  });

  it("returns empty suggestedKeys for unknown instrument", async () => {
    // baroque-guitar-5 IS known, so use it
    const result = await transposeTool.execute("call-1", {
      source: "E4",
      interval: "P1",
      instrument: "baroque-guitar-5",
    });

    expect(result.details.suggestedKeys).toContain("A minor");
  });

  it("transposes down with negative interval", async () => {
    const result = await transposeTool.execute("call-1", {
      source: "G4",
      interval: "P-5",
      instrument: "baroque-lute-13",
    });

    expect(result.details.transposed).toEqual(["C4"]);
  });

  it("reports no out-of-range for in-range pitches", async () => {
    const result = await transposeTool.execute("call-1", {
      source: "A3 D4 F4",
      interval: "P1",
      instrument: "baroque-lute-13",
    });

    expect(result.details.outOfRange).toEqual([]);
  });
});
