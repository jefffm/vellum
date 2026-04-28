import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENGRAVE_INSTRUMENT_IDS,
  ENGRAVE_TEMPLATE_IDS,
  INSTRUMENT_LY_VARS,
  getInstrumentLyVars,
  validateTemplateId,
} from "./instrument-registry.js";

/** Read an .ily file and return its content. */
function readIly(relativePath: string): string {
  // Resolve from the vellum project root (two dirs up from src/lib/)
  const absPath = resolve(import.meta.dirname, "../../", relativePath);
  return readFileSync(absPath, "utf-8");
}

describe("instrument-registry", () => {
  it("has entries for all 5 tab instruments", () => {
    expect(ENGRAVE_INSTRUMENT_IDS).toHaveLength(5);
    expect(ENGRAVE_INSTRUMENT_IDS).toContain("baroque-lute-13");
    expect(ENGRAVE_INSTRUMENT_IDS).toContain("theorbo-14");
    expect(ENGRAVE_INSTRUMENT_IDS).toContain("renaissance-lute-6");
    expect(ENGRAVE_INSTRUMENT_IDS).toContain("baroque-guitar-5");
    expect(ENGRAVE_INSTRUMENT_IDS).toContain("classical-guitar-6");
  });

  it("has 4 v1 templates", () => {
    expect(ENGRAVE_TEMPLATE_IDS).toHaveLength(4);
    expect(ENGRAVE_TEMPLATE_IDS).toContain("solo-tab");
    expect(ENGRAVE_TEMPLATE_IDS).toContain("french-tab");
    expect(ENGRAVE_TEMPLATE_IDS).toContain("tab-and-staff");
    expect(ENGRAVE_TEMPLATE_IDS).toContain("voice-and-tab");
  });

  describe("getInstrumentLyVars", () => {
    it("returns vars for known instrument", () => {
      const vars = getInstrumentLyVars("baroque-lute-13");
      expect(vars.include).toBe("instruments/baroque-lute-13.ily");
      expect(vars.stringTunings).toBe("luteStringTunings");
      expect(vars.tabFormat).toBe("luteTabFormat");
      expect(vars.diapasons).toBe("luteDiapasons");
    });

    it("throws for unknown instrument with list of valid IDs", () => {
      expect(() => getInstrumentLyVars("nonexistent")).toThrow(/unknown instrument/i);
      expect(() => getInstrumentLyVars("nonexistent")).toThrow(/baroque-lute-13/);
    });
  });

  describe("validateTemplateId", () => {
    it("accepts valid template IDs", () => {
      expect(() => validateTemplateId("solo-tab")).not.toThrow();
      expect(() => validateTemplateId("french-tab")).not.toThrow();
      expect(() => validateTemplateId("tab-and-staff")).not.toThrow();
      expect(() => validateTemplateId("voice-and-tab")).not.toThrow();
    });

    it("throws for unknown template with list of valid IDs", () => {
      expect(() => validateTemplateId("grand-staff")).toThrow(/unknown template/i);
      expect(() => validateTemplateId("grand-staff")).toThrow(/solo-tab/);
    });
  });

  describe("variable names match .ily files", () => {
    for (const [instrumentId, vars] of Object.entries(INSTRUMENT_LY_VARS)) {
      describe(instrumentId, () => {
        const ilyContent = readIly(vars.include);

        it(`defines ${vars.stringTunings}`, () => {
          expect(ilyContent).toContain(`${vars.stringTunings} =`);
        });

        it(`defines ${vars.tabFormat}`, () => {
          expect(ilyContent).toContain(`${vars.tabFormat} =`);
        });

        if (vars.diapasons) {
          it(`defines ${vars.diapasons}`, () => {
            expect(ilyContent).toContain(`${vars.diapasons} =`);
          });
        }
      });
    }
  });

  describe("diapason instruments", () => {
    it("baroque-lute-13 has diapasons", () => {
      expect(getInstrumentLyVars("baroque-lute-13").diapasons).toBeDefined();
    });

    it("theorbo-14 has diapasons", () => {
      expect(getInstrumentLyVars("theorbo-14").diapasons).toBeDefined();
    });

    it("classical-guitar-6 has no diapasons", () => {
      expect(getInstrumentLyVars("classical-guitar-6").diapasons).toBeUndefined();
    });

    it("renaissance-lute-6 has no diapasons", () => {
      expect(getInstrumentLyVars("renaissance-lute-6").diapasons).toBeUndefined();
    });

    it("baroque-guitar-5 has no diapasons", () => {
      expect(getInstrumentLyVars("baroque-guitar-5").diapasons).toBeUndefined();
    });
  });
});
