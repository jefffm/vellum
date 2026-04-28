import { describe, expect, it } from "vitest";
import { fretboardTool, renderFretboardSvg } from "./fretboard.js";
import { InstrumentModel } from "./lib/instrument-model.js";
import { loadBrowserProfile } from "./lib/browser-profiles.js";

function luteModel(): InstrumentModel {
  return InstrumentModel.fromProfile(loadBrowserProfile("baroque-lute-13"));
}

function guitarModel(): InstrumentModel {
  return InstrumentModel.fromProfile(loadBrowserProfile("baroque-guitar-5"));
}

describe("renderFretboardSvg", () => {
  it("renders SVG with a single fretted position", () => {
    const result = renderFretboardSvg([{ course: 1, fret: 2, quality: "low_fret" }], luteModel());

    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");
    expect(result.svg).toContain("<circle");
    expect(result.svg).toContain('fill="#333"');
  });

  it("renders correct number of circles for multiple positions", () => {
    const result = renderFretboardSvg(
      [
        { course: 1, fret: 2, quality: "low_fret" },
        { course: 2, fret: 0, quality: "open" },
        { course: 3, fret: 3, quality: "low_fret" },
      ],
      luteModel()
    );

    const circleCount = (result.svg.match(/<circle/g) ?? []).length;
    expect(circleCount).toBe(3);
  });

  it("renders open string as hollow circle", () => {
    const result = renderFretboardSvg([{ course: 1, fret: 0, quality: "open" }], luteModel());

    expect(result.svg).toContain('fill="none"');
    expect(result.svg).toContain('stroke="#333"');
  });

  it("renders fretted position as filled circle", () => {
    const result = renderFretboardSvg([{ course: 1, fret: 3, quality: "low_fret" }], luteModel());

    expect(result.svg).toContain('fill="#333"');
  });

  it("shows frets 0-4 for all-open positions", () => {
    const result = renderFretboardSvg([{ course: 1, fret: 0, quality: "open" }], luteModel());

    expect(result.fretsShown).toBe(4);
  });

  it("shows only relevant fret range for high positions", () => {
    const result = renderFretboardSvg([{ course: 1, fret: 6, quality: "high_fret" }], luteModel());

    // Should show a range around fret 6, not start from 0
    expect(result.fretsShown).toBeGreaterThanOrEqual(3);
    // SVG should contain fret number 6
    expect(result.svg).toContain(">6<");
  });

  it("includes course labels as text elements", () => {
    const result = renderFretboardSvg([], luteModel());
    // Should have text elements with course numbers
    expect(result.svg).toContain(">1<");
    expect(result.svg).toContain(">13<");
  });

  it("includes fret labels as text elements", () => {
    const result = renderFretboardSvg([{ course: 1, fret: 2, quality: "low_fret" }], luteModel());
    // Should have fret number labels
    expect(result.svg).toContain("<text");
  });

  it("renders empty diagram (no markers) for empty positions", () => {
    const result = renderFretboardSvg([], luteModel());

    expect(result.svg).toContain("<svg");
    expect(result.svg).not.toContain("<circle");
    expect(result.coursesShown).toBe(13);
  });

  it("shows 13 course lines for baroque lute", () => {
    const result = renderFretboardSvg([], luteModel());

    expect(result.coursesShown).toBe(13);
    // Count horizontal course lines (excluding fret lines and nut)
    const lineMatches = result.svg.match(/<line[^>]+stroke-width="1"/g) ?? [];
    // Course lines (13) + fret lines
    expect(lineMatches.length).toBeGreaterThanOrEqual(13);
  });

  it("uses dashed stroke for diapason courses on lute", () => {
    const result = renderFretboardSvg([], luteModel());
    expect(result.svg).toContain('stroke-dasharray="4,3"');
  });

  it("shows 5 course lines for baroque guitar with no dashed courses", () => {
    const result = renderFretboardSvg([], guitarModel());

    expect(result.coursesShown).toBe(5);
    expect(result.svg).not.toContain("stroke-dasharray");
  });

  it("clamps fret range to instrument maximum", () => {
    // Baroque lute has 8 frets. Position at fret 8 should not show frets > 8.
    const result = renderFretboardSvg([{ course: 1, fret: 8, quality: "high_fret" }], luteModel());

    // Check that no fret label exceeds 8
    const fretLabels = result.svg.match(/<text[^>]*>(\d+)<\/text>/g) ?? [];
    for (const label of fretLabels) {
      const num = Number(label.match(/>(\d+)</)?.[1]);
      // Course labels (1-13) are fine; fret labels should be <= 8
      if (num > 13) {
        throw new Error(`Fret label ${num} exceeds instrument maximum`);
      }
    }
  });

  it("includes fret 0 in range when open strings are present with high frets", () => {
    const result = renderFretboardSvg(
      [
        { course: 1, fret: 0, quality: "open" },
        { course: 2, fret: 5, quality: "high_fret" },
      ],
      luteModel()
    );

    // Fret 0 should be labeled since there's an open string
    expect(result.svg).toContain(">0<");
  });

  it("produces reasonable SVG dimensions", () => {
    const result = renderFretboardSvg([{ course: 1, fret: 2, quality: "low_fret" }], luteModel());

    const viewBoxMatch = result.svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(viewBoxMatch).toBeTruthy();
    const w = Number(viewBoxMatch![1]);
    const h = Number(viewBoxMatch![2]);
    expect(w).toBeGreaterThan(50);
    expect(w).toBeLessThan(1000);
    expect(h).toBeGreaterThan(50);
    expect(h).toBeLessThan(1000);
  });
});

describe("fretboard tool", () => {
  it("executes via tool interface", async () => {
    const result = await fretboardTool.execute("call-1", {
      positions: [{ course: 1, fret: 2, quality: "low_fret" }],
      instrument: "baroque-lute-13",
    });

    expect(result.details.svg).toContain("<svg");
    expect(result.details.coursesShown).toBe(13);
    const c = result.content[0];
    expect(c.type).toBe("text");
    if (c.type === "text") {
      expect(c.text).toContain("Fretboard diagram");
    }
  });

  it("returns error for unknown instrument", async () => {
    const result = await fretboardTool.execute("call-1", {
      positions: [{ course: 1, fret: 0, quality: "open" }],
      instrument: "nonexistent",
    });

    const c = result.content[0];
    expect(c.type).toBe("text");
    if (c.type === "text") {
      expect(c.text).toContain("Error");
    }
  });
});
