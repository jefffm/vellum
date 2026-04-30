import { describe, expect, it, vi } from "vitest";
import {
  alfabetoLookupTool,
  checkPlayabilityTool,
  tabulateTool,
  theoryTool,
  voicingsTool,
} from "./tools.js";

describe("instrument browser tools", () => {
  it("tabulates open and fretted lute positions", async () => {
    const f4 = await tabulateTool.execute("call-1", {
      pitch: "F4",
      instrument: "baroque-lute-13",
    });
    const d4 = await tabulateTool.execute("call-2", {
      pitch: "D4",
      instrument: "baroque-lute-13",
    });
    const cSharp4 = await tabulateTool.execute("call-3", {
      pitch: "C#4",
      instrument: "baroque-lute-13",
    });

    expect(f4.details.positions).toContainEqual({ course: 1, fret: 0, quality: "open" });
    expect(d4.details.positions).toContainEqual({ course: 2, fret: 0, quality: "open" });
    expect(cSharp4.details.positions).toEqual(
      expect.arrayContaining([
        { course: 3, fret: 4, quality: "high_fret" },
        { course: 4, fret: 8, quality: "high_fret" },
      ])
    );
  });

  it("tabulates diapasons and out-of-range pitches", async () => {
    const g2 = await tabulateTool.execute("call-1", {
      pitch: "G2",
      instrument: "baroque-lute-13",
    });
    const tooLow = await tabulateTool.execute("call-2", {
      pitch: "C1",
      instrument: "baroque-lute-13",
    });

    expect(g2.details.positions).toEqual([{ course: 7, fret: 0, quality: "diapason" }]);
    expect(tooLow.details.positions).toEqual([]);
  });

  it("enumerates playable chord voicings", async () => {
    const result = await voicingsTool.execute("call-1", {
      notes: ["D4", "F4", "A3"],
      instrument: "baroque-lute-13",
      max_stretch: 4,
    });

    expect(result.details.voicings.length).toBeGreaterThanOrEqual(1);

    for (const voicing of result.details.voicings) {
      const courses = voicing.positions.map((position) => position.course);
      expect(new Set(courses).size).toBe(courses.length);
      expect(voicing.stretch).toBeLessThanOrEqual(4);
    }

    expect(result.details.voicings[0]?.stretch).toBeLessThanOrEqual(
      result.details.voicings.at(-1)?.stretch ?? 0
    );
  });

  it("returns no voicings for impossible chords", async () => {
    const result = await voicingsTool.execute("call-1", {
      notes: ["C0", "D0", "E0"],
      instrument: "baroque-lute-13",
    });

    expect(result.details.voicings).toEqual([]);
  });

  it("detects playability violations", async () => {
    const result = await checkPlayabilityTool.execute("call-1", {
      instrument: "baroque-lute-13",
      bars: [
        {
          bar: 1,
          notes: [
            { pitch: "F#4", position: { course: 1, fret: 1, quality: "low_fret" } },
            { pitch: "E4", position: { course: 2, fret: 7, quality: "high_fret" } },
          ],
        },
        {
          bar: 2,
          notes: [
            { pitch: "G4", position: { course: 1, fret: 2, quality: "low_fret" } },
            { pitch: "G#4", position: { course: 1, fret: 3, quality: "low_fret" } },
          ],
        },
        {
          bar: 3,
          notes: [{ pitch: "C5", position: { course: 1, fret: 10, quality: "high_fret" } }],
        },
      ],
    });

    expect(result.details.violations.map((violation) => violation.type)).toEqual(
      expect.arrayContaining(["stretch", "same_course", "out_of_range"])
    );
    expect(result.details.difficulty).toBe("advanced");
    expect(result.details.flagged_bars).toEqual([1, 2, 3]);
  });

  it("rates a simple playable scale as beginner", async () => {
    const result = await checkPlayabilityTool.execute("call-1", {
      instrument: "baroque-lute-13",
      bars: [
        {
          bar: 1,
          notes: [{ pitch: "F4", position: { course: 1, fret: 0, quality: "open" } }],
        },
        {
          bar: 2,
          notes: [{ pitch: "G4", position: { course: 1, fret: 2, quality: "low_fret" } }],
        },
        {
          bar: 3,
          notes: [{ pitch: "A3", position: { course: 3, fret: 0, quality: "open" } }],
        },
      ],
    });

    expect(result.details.violations).toEqual([]);
    expect(result.details.difficulty).toBe("beginner");
    expect(result.details.flagged_bars).toEqual([]);
  });

  it("looks up alfabeto shapes with canonical snake_case params without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await alfabetoLookupTool.execute("call-1", {
      chord_name: "G major",
      chart_id: "tyler-universal",
    });

    expect(result.details.chartId).toBe("tyler-universal");
    expect(result.details.matches[0]).toEqual(
      expect.objectContaining({ letter: "A", chord: "G major", source: "standard" })
    );
    expect(result.details.matches[0]?.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ course: 1, fret: 3 }),
        expect.objectContaining({ course: 5, fret: 2 }),
      ])
    );
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("alfabeto match");
      expect(result.content[0].text).toContain("A — G major");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("accepts legacy camelCase alfabeto lookup params", async () => {
    const result = await alfabetoLookupTool.execute("call-1", {
      chordName: "G major",
      chartId: "tyler-universal",
      includeBarreVariants: false,
    });

    expect(result.details.chartId).toBe("tyler-universal");
    expect(result.details.matches[0]).toEqual(
      expect.objectContaining({ letter: "A", chord: "G major", source: "standard" })
    );
  });

  it("selects Foscarini-specific alfabeto matches", async () => {
    const result = await alfabetoLookupTool.execute("call-1", {
      chord_name: "Eb minor",
      chart_id: "foscarini",
    });

    expect(result.details.chartId).toBe("foscarini");
    expect(result.details.matches[0]).toEqual(
      expect.objectContaining({ letter: "M†", chord: "Eb minor", source: "standard" })
    );
  });

  it("returns an empty alfabeto match list for invalid chords", async () => {
    const result = await alfabetoLookupTool.execute("call-1", {
      chord_name: "not a real chord",
    });

    expect(result.details.matches).toEqual([]);
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("No alfabeto matches");
    }
  });

  it("runs theory lookups without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await theoryTool.execute("call-1", {
      operation: "interval",
      args: { from: "C4", to: "G4" },
    });

    expect(result.details.result).toBe("P5");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("accounts for re-entrant baroque guitar courses without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await tabulateTool.execute("call-1", {
      pitch: "D4",
      instrument: "baroque-guitar-5",
    });

    expect(result.details.positions).toContainEqual({ course: 4, fret: 0, quality: "open" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
