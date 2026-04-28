/**
 * Instrument → LilyPond variable registry.
 *
 * Maps instrument IDs to their exact .ily file paths and LilyPond variable names.
 * This is the single source of truth for how instrument IDs map to LilyPond include
 * paths and variable names. Adding a new instrument means adding one entry here plus
 * the .ily and .yaml files.
 */

export type InstrumentLyVars = {
  /** Path to the .ily file (relative to project root). */
  include: string;
  /** LilyPond variable name for string tunings. */
  stringTunings: string;
  /** LilyPond variable name for tablature format. */
  tabFormat: string;
  /** LilyPond variable name for diapason tunings (only for instruments with diapason courses). */
  diapasons?: string;
};

export const INSTRUMENT_LY_VARS: Record<string, InstrumentLyVars> = {
  "baroque-lute-13": {
    include: "instruments/baroque-lute-13.ily",
    stringTunings: "luteStringTunings",
    tabFormat: "luteTabFormat",
    diapasons: "luteDiapasons",
  },
  "theorbo-14": {
    include: "instruments/theorbo-14.ily",
    stringTunings: "theorboStringTunings",
    tabFormat: "theorboTabFormat",
    diapasons: "theorboDiapasons",
  },
  "renaissance-lute-6": {
    include: "instruments/renaissance-lute-6.ily",
    stringTunings: "renaissanceLuteStringTunings",
    tabFormat: "renaissanceLuteTabFormat",
  },
  "baroque-guitar-5": {
    include: "instruments/baroque-guitar-5.ily",
    stringTunings: "guitarStringTunings",
    tabFormat: "guitarTabFormat",
  },
  "classical-guitar-6": {
    include: "instruments/classical-guitar-6.ily",
    stringTunings: "classicalGuitarStringTunings",
    tabFormat: "classicalGuitarTabFormat",
  },
};

/** All supported instrument IDs for the engrave tool. */
export const ENGRAVE_INSTRUMENT_IDS = Object.keys(INSTRUMENT_LY_VARS);

/** All supported v1 template IDs. */
export const ENGRAVE_TEMPLATE_IDS = [
  "solo-tab",
  "french-tab",
  "tab-and-staff",
  "voice-and-tab",
] as const;

export type EngraveTemplateId = (typeof ENGRAVE_TEMPLATE_IDS)[number];

/**
 * Look up instrument LilyPond variables by instrument ID.
 * Throws with a descriptive error listing valid IDs if the instrument is unknown.
 */
export function getInstrumentLyVars(instrumentId: string): InstrumentLyVars {
  const vars = INSTRUMENT_LY_VARS[instrumentId];

  if (!vars) {
    throw new Error(
      `Unknown instrument "${instrumentId}". Valid instruments: ${ENGRAVE_INSTRUMENT_IDS.join(", ")}`
    );
  }

  return vars;
}

/**
 * Check whether a template ID is valid for the engrave tool.
 * Throws with a descriptive error listing valid IDs if unknown.
 */
export function validateTemplateId(templateId: string): asserts templateId is EngraveTemplateId {
  if (!ENGRAVE_TEMPLATE_IDS.includes(templateId as EngraveTemplateId)) {
    throw new Error(
      `Unknown template "${templateId}". Valid v1 templates: ${ENGRAVE_TEMPLATE_IDS.join(", ")}`
    );
  }
}
