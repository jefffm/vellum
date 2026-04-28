import { describe, expect, it } from "vitest";
import { getChart, listChartIds, TYLER_UNIVERSAL, FOSCARINI } from "../charts/index.js";

describe("chart registry", () => {
  it("lists both charts", () => {
    const ids = listChartIds();
    expect(ids).toContain("tyler-universal");
    expect(ids).toContain("foscarini");
  });

  it("getChart returns Tyler by default", () => {
    const chart = getChart();
    expect(chart.id).toBe("tyler-universal");
  });

  it("getChart returns Foscarini when specified", () => {
    const chart = getChart("foscarini");
    expect(chart.id).toBe("foscarini");
  });

  it("throws for unknown chart id", () => {
    expect(() => getChart("unknown" as never)).toThrow("Unknown alfabeto chart");
  });
});

describe("Tyler Universal chart integrity", () => {
  it("has no duplicate letters", () => {
    const letters = TYLER_UNIVERSAL.shapes.map((s) => s.letter);
    expect(new Set(letters).size).toBe(letters.length);
  });

  it("all frets are non-negative integers", () => {
    for (const shape of TYLER_UNIVERSAL.shapes) {
      for (const fret of shape.frets) {
        expect(Number.isInteger(fret)).toBe(true);
        expect(fret).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("each shape has exactly 5 fret values", () => {
    for (const shape of TYLER_UNIVERSAL.shapes) {
      expect(shape.frets).toHaveLength(5);
    }
  });

  it("has cross (+), all standard letters (A-P no J), extended (Q-Z no U/W), and specials", () => {
    const letters = new Set(TYLER_UNIVERSAL.shapes.map((s) => s.letter));

    expect(letters.has("+")).toBe(true);

    for (const l of "ABCDEFGHIKLMNOP") {
      expect(letters.has(l)).toBe(true);
    }

    for (const l of "QRSTVXYZ") {
      expect(letters.has(l)).toBe(true);
    }

    expect(letters.has("&")).toBe(true);
    expect(letters.has("9")).toBe(true);
    expect(letters.has("\u211E")).toBe(true);
  });

  it("does not contain letters J, U, or W", () => {
    const letters = new Set(TYLER_UNIVERSAL.shapes.map((s) => s.letter));

    expect(letters.has("J")).toBe(false);
    expect(letters.has("U")).toBe(false);
    expect(letters.has("W")).toBe(false);
  });

  it("categories are correctly assigned", () => {
    const cross = TYLER_UNIVERSAL.shapes.filter((s) => s.category === "cross");
    const standard = TYLER_UNIVERSAL.shapes.filter((s) => s.category === "standard");
    const extended = TYLER_UNIVERSAL.shapes.filter((s) => s.category === "extended");
    const special = TYLER_UNIVERSAL.shapes.filter((s) => s.category === "special");

    expect(cross).toHaveLength(1);
    expect(standard).toHaveLength(15);
    expect(extended).toHaveLength(8);
    expect(special).toHaveLength(3);
  });
});

describe("Foscarini chart integrity", () => {
  it("has no duplicate letters", () => {
    const letters = FOSCARINI.shapes.map((s) => s.letter);
    expect(new Set(letters).size).toBe(letters.length);
  });

  it("has all Tyler shapes plus Foscarini extras", () => {
    // Tyler: 27, Foscarini: 27 base + 2 extras = 29
    expect(FOSCARINI.shapes.length).toBe(29);
  });

  it("inherits all Tyler shapes except L", () => {
    const tylerNonL = TYLER_UNIVERSAL.shapes.filter((s) => s.letter !== "L");

    for (const shape of tylerNonL) {
      const foscariniShape = FOSCARINI.shapes.find((s) => s.letter === shape.letter);
      expect(foscariniShape).toBeDefined();
      expect(foscariniShape!.frets).toEqual(shape.frets);
    }
  });
});
