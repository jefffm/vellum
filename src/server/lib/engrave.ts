/**
 * Engrave Codegen Engine — Core Pipeline
 *
 * Takes validated EngraveParams, runs a multi-step pipeline (resolve instrument →
 * validate events → resolve pitches → build LyTree → serialize), and produces
 * complete LilyPond source. This is the heart of the engrave tool.
 *
 * Design principles:
 * - Absolute pitches only (no \relative)
 * - Deterministic: same input → same output
 * - Validate before emitting
 */

import type {
  AlfabetoChordEvent,
  AlfabetoEvent,
  ChordEvent,
  EngraveBar,
  EngraveParams,
  EngraveResult,
  EngraveMusicEvent,
  Melody,
  PitchNote,
  PositionNote,
  RestEvent,
} from "../../lib/engrave-schema.js";
import {
  type InstrumentLyVars,
  type EngraveTemplateId,
  getInstrumentLyVars,
  validateTemplateId,
} from "../../lib/instrument-registry.js";
import { InstrumentModel } from "../../lib/instrument-model.js";
import {
  type LyFile,
  type LyIndicator,
  type LyLeaf,
  lyChord,
  lyNote,
  lyRest,
  lyScore,
  serializeFile,
} from "../../lib/ly-tree.js";
import {
  alfabetoLookup,
  getChart,
  shapeToPositions,
  type AlfabetoMatch,
} from "../../lib/alfabeto/index.js";
import { parseTimeSignature, validateKeySignature } from "../../lib/music-utils.js";
import { loadProfile } from "../profiles.js";
import { parsePitch, scientificToLilyPond } from "../../lib/pitch.js";
import { buildLeadingIndicators, dispatchTemplate } from "./template-strategies.js";
export {
  buildHiddenMidiStaff,
  buildTabStaffWithBlock,
  eventsToRhythmLeaves,
} from "./template-strategies.js";

// === Error types ===

export class EngraveValidationError extends Error {
  constructor(
    message: string,
    public readonly details: ValidationDetail[]
  ) {
    super(message);
    this.name = "EngraveValidationError";
  }
}

export type ValidationDetail = {
  bar: number; // 1-based (0 for global/structural errors)
  event?: number; // 1-based within bar
  field?: string;
  message: string;
};

// === Duration validation ===

const DURATION_PATTERN = /^(1|2|4|8|16|32|64)(\.{0,2})$/;

function isValidDuration(duration: string): boolean {
  return DURATION_PATTERN.test(duration);
}

// === Step 1: Instrument resolution ===

export type ResolvedInstrument = {
  vars: InstrumentLyVars;
  model: InstrumentModel;
  templateId: EngraveTemplateId;
};

export function resolveInstrument(params: EngraveParams): ResolvedInstrument {
  const vars = getInstrumentLyVars(params.instrument);

  validateTemplateId(params.template);
  const templateId = params.template as EngraveTemplateId;

  const model = loadInstrumentModel(params.instrument);

  // Template-specific validation
  if (templateId === "voice-and-tab") {
    if (!params.melody) {
      throw new EngraveValidationError(
        'Template "voice-and-tab" requires a melody parameter with vocal bars.',
        [{ bar: 0, message: "Missing melody parameter for voice-and-tab template" }]
      );
    }

    if (params.melody.bars.length !== params.bars.length) {
      throw new EngraveValidationError(
        `Melody bar count (${params.melody.bars.length}) must match tab bar count (${params.bars.length}).`,
        [
          {
            bar: 0,
            message: `melody has ${params.melody.bars.length} bars but tab has ${params.bars.length} bars`,
          },
        ]
      );
    }
  }

  return { vars, model, templateId };
}

function loadInstrumentModel(instrumentId: string): InstrumentModel {
  const profile = loadProfile(instrumentId);
  return InstrumentModel.fromProfile(profile);
}

// === Step 2: Event validation ===

/**
 * Validate all tab bar events. Also validates global and per-bar time/key signatures.
 */
export function validateEvents(
  bars: EngraveBar[],
  model: InstrumentModel,
  params: EngraveParams
): { warnings: string[] } {
  const errors: ValidationDetail[] = [];
  const warnings: string[] = [];
  const maxStretch = model.maxStretch();

  // Validate global time signature
  if (params.time) {
    try {
      parseTimeSignature(params.time);
    } catch (e) {
      errors.push({
        bar: 0,
        field: "time",
        message: `Invalid global time signature: ${(e as Error).message}`,
      });
    }
  }

  // Validate global key signature
  if (params.key) {
    try {
      validateKeySignature(params.key.tonic, params.key.mode);
    } catch (e) {
      errors.push({
        bar: 0,
        field: "key",
        message: `Invalid global key signature: ${(e as Error).message}`,
      });
    }
  }

  // Validate pickup duration
  if (params.pickup && !isValidDuration(params.pickup)) {
    errors.push({
      bar: 0,
      field: "pickup",
      message: `Invalid pickup duration "${params.pickup}"`,
    });
  }

  for (let barIdx = 0; barIdx < bars.length; barIdx++) {
    const bar = bars[barIdx];
    const barNum = barIdx + 1;

    // Validate per-bar time override
    if (bar.time) {
      try {
        parseTimeSignature(bar.time);
      } catch (e) {
        errors.push({
          bar: barNum,
          field: "time",
          message: `Invalid time signature: ${(e as Error).message}`,
        });
      }
    }

    // Validate per-bar key override
    if (bar.key) {
      try {
        validateKeySignature(bar.key.tonic, bar.key.mode);
      } catch (e) {
        errors.push({
          bar: barNum,
          field: "key",
          message: `Invalid key signature: ${(e as Error).message}`,
        });
      }
    }

    for (let evIdx = 0; evIdx < bar.events.length; evIdx++) {
      const event = bar.events[evIdx];
      const evNum = evIdx + 1;

      // Duration validation (applies to all event types)
      if (!isValidDuration(event.duration)) {
        errors.push({
          bar: barNum,
          event: evNum,
          field: "duration",
          message: `Invalid duration "${event.duration}". Expected: 1, 2, 4, 8, 16, 32, or 64, optionally followed by dots (e.g. "4.", "8..")`,
        });
      }

      if (event.type === "note") {
        if (event.input === "position") {
          validatePositionEntry(event.course, event.fret, model, barNum, evNum, errors);
        } else {
          validatePitchEntry(event.pitch, barNum, evNum, errors);
        }
      } else if (event.type === "chord") {
        // Stretch check: only within this chord (simultaneous notes)
        const chordFrets: number[] = [];

        for (const pos of event.positions) {
          if (pos.input === "position") {
            validatePositionEntry(pos.course, pos.fret, model, barNum, evNum, errors);
            chordFrets.push(pos.fret);
          } else {
            validatePitchEntry(pos.pitch, barNum, evNum, errors);
          }
        }

        // Per-chord stretch check
        const frettedOnly = chordFrets.filter((f) => f > 0);
        if (frettedOnly.length >= 2) {
          const span = Math.max(...frettedOnly) - Math.min(...frettedOnly);
          if (span > maxStretch) {
            warnings.push(
              `Bar ${barNum}, event ${evNum}: chord fret span ${span} exceeds comfortable stretch of ${maxStretch} frets`
            );
          }
        }
      } else if (event.type === "alfabeto" || event.type === "alfabeto_chord") {
        validateAlfabetoEvent(event, model, params.instrument, barNum, evNum, errors);
      }
      // Rests: only duration validation (already done above)
    }
  }

  if (errors.length > 0) {
    const summary = errors
      .slice(0, 5)
      .map((e) => `Bar ${e.bar}${e.event ? `, event ${e.event}` : ""}: ${e.message}`)
      .join("; ");
    throw new EngraveValidationError(`Validation failed: ${summary}`, errors);
  }

  return { warnings };
}

/**
 * Validate melody events (pitches and durations). Called for voice-and-tab template.
 */
export function validateMelody(melody: Melody): void {
  const errors: ValidationDetail[] = [];

  for (let barIdx = 0; barIdx < melody.bars.length; barIdx++) {
    const bar = melody.bars[barIdx];
    const barNum = barIdx + 1;

    for (let evIdx = 0; evIdx < bar.events.length; evIdx++) {
      const event = bar.events[evIdx];
      const evNum = evIdx + 1;

      if (!isValidDuration(event.duration)) {
        errors.push({
          bar: barNum,
          event: evNum,
          field: "melody.duration",
          message: `Invalid melody duration "${event.duration}"`,
        });
      }

      if (event.type === "note") {
        try {
          parsePitch(event.pitch);
        } catch {
          errors.push({
            bar: barNum,
            event: evNum,
            field: "melody.pitch",
            message: `Invalid melody pitch "${event.pitch}". Expected scientific notation like "C4", "Eb3", "F#5"`,
          });
        }
      }
    }
  }

  if (errors.length > 0) {
    const summary = errors
      .slice(0, 5)
      .map((e) => `Melody bar ${e.bar}, event ${e.event}: ${e.message}`)
      .join("; ");
    throw new EngraveValidationError(`Melody validation failed: ${summary}`, errors);
  }
}

function validatePositionEntry(
  course: number,
  fret: number,
  model: InstrumentModel,
  barNum: number,
  evNum: number,
  errors: ValidationDetail[]
): void {
  const courseCount = model.courseCount();

  if (course < 1 || course > courseCount) {
    errors.push({
      bar: barNum,
      event: evNum,
      field: "course",
      message: `Course ${course} out of range [1, ${courseCount}]`,
    });
    return;
  }

  const maxFrets = model.maxFrets();

  if (fret < 0 || fret > maxFrets) {
    errors.push({
      bar: barNum,
      event: evNum,
      field: "fret",
      message: `Fret ${fret} out of range [0, ${maxFrets}]`,
    });
    return;
  }

  if (model.isDiapason(course) && fret !== 0) {
    errors.push({
      bar: barNum,
      event: evNum,
      field: "fret",
      message: `Course ${course} is a diapason (open string only) — fret must be 0, got ${fret}`,
    });
  }
}

function validatePitchEntry(
  pitch: string,
  barNum: number,
  evNum: number,
  errors: ValidationDetail[]
): void {
  try {
    parsePitch(pitch);
  } catch {
    errors.push({
      bar: barNum,
      event: evNum,
      field: "pitch",
      message: `Invalid pitch "${pitch}". Expected scientific notation like "C4", "Eb3", "F#5"`,
    });
  }
}

function validateAlfabetoEvent(
  event: AnyAlfabetoEvent,
  model: InstrumentModel,
  instrumentId: string,
  barNum: number,
  evNum: number,
  errors: ValidationDetail[]
): void {
  if (
    instrumentId !== "baroque-guitar-5" ||
    model.courseCount() !== 5 ||
    model.frettedCourseCount() !== 5
  ) {
    errors.push({
      bar: barNum,
      event: evNum,
      field: "alfabeto",
      message: "Alfabeto events require a 5-course fully fretted instrument (baroque-guitar-5)",
    });
    return;
  }

  try {
    const match = selectAlfabetoMatch(event);

    if (!match) {
      errors.push({
        bar: barNum,
        event: evNum,
        field: "alfabeto",
        message: describeMissingAlfabetoMatch(event),
      });
      return;
    }

    for (const position of match.positions) {
      validatePositionEntry(position.course, position.fret, model, barNum, evNum, errors);
    }
  } catch (error) {
    errors.push({
      bar: barNum,
      event: evNum,
      field: "alfabeto",
      message: error instanceof Error ? error.message : "Invalid alfabeto event",
    });
  }
}

// === Step 3: Pitch resolution and leaf construction ===

/**
 * Convert validated events to LyLeaf nodes with resolved pitches and indicators.
 */
export function eventsToLeaves(
  bars: EngraveBar[],
  params: EngraveParams,
  model: InstrumentModel
): LyLeaf[] {
  const leaves: LyLeaf[] = [];
  let isFirstLeaf = true;

  for (let barIdx = 0; barIdx < bars.length; barIdx++) {
    const bar = bars[barIdx];
    const isFirstBar = barIdx === 0;

    for (let evIdx = 0; evIdx < bar.events.length; evIdx++) {
      const event = bar.events[evIdx];
      const isLastInBar = evIdx === bar.events.length - 1;
      const isFirstInBar = evIdx === 0;

      const indicators = buildLeadingIndicators(params, bar, isFirstLeaf, isFirstBar, isFirstInBar);
      const leaf = resolveEvent(event, model, indicators);

      if (isLastInBar) {
        leaf.indicators.push({ kind: "bar_check" });
      }

      leaves.push(leaf);
      isFirstLeaf = false;
    }
  }

  return leaves;
}

/**
 * Resolve a single event to a LyLeaf with the given pre-indicators.
 */
function resolveEvent(
  event: EngraveMusicEvent,
  model: InstrumentModel,
  indicators: LyIndicator[]
): LyLeaf {
  if (event.type === "note") {
    const afterIndicators = noteIndicators(event);
    const allIndicators = [...indicators, ...afterIndicators];

    if (event.input === "position") {
      const pitch = model.soundingPitch(event.course, event.fret);
      const lyPitch = scientificToLilyPond(pitch);
      return lyNote(lyPitch, event.duration, [
        ...allIndicators,
        { kind: "literal", text: `\\${event.course}`, site: "after" },
      ]);
    } else {
      const lyPitch = scientificToLilyPond(event.pitch);
      return lyNote(lyPitch, event.duration, allIndicators);
    }
  }

  if (event.type === "chord") {
    const pitches: string[] = [];

    for (const pos of event.positions) {
      if (pos.input === "position") {
        const pitch = model.soundingPitch(pos.course, pos.fret);
        pitches.push(`${scientificToLilyPond(pitch)}\\${pos.course}`);
      } else {
        pitches.push(scientificToLilyPond(pos.pitch));
      }
    }

    const afterIndicators: LyIndicator[] = [];
    if (event.tie) afterIndicators.push({ kind: "tie" });

    return lyChord(pitches, event.duration, [...indicators, ...afterIndicators]);
  }

  if (event.type === "alfabeto" || event.type === "alfabeto_chord") {
    const match = selectAlfabetoMatch(event);

    if (!match) {
      throw new EngraveValidationError(describeMissingAlfabetoMatch(event), [
        { bar: 0, field: event.type, message: describeMissingAlfabetoMatch(event) },
      ]);
    }

    const pitches = match.positions.map((position) => {
      const pitch = model.soundingPitch(position.course, position.fret);
      return `${scientificToLilyPond(pitch)}\\${position.course}`;
    });
    const afterIndicators: LyIndicator[] = [];

    if (event.type === "alfabeto") {
      afterIndicators.push({
        kind: "literal",
        text: `^\\markup { "${escapeLilyPondString(match.letter)}" }`,
        site: "after",
      });
    }

    if (event.tie) afterIndicators.push({ kind: "tie" });

    return lyChord(pitches, event.duration, [...indicators, ...afterIndicators]);
  }

  // Rest
  const rest = event as RestEvent;
  return lyRest(rest.duration, rest.spacer ?? false, [...indicators]);
}

type AnyAlfabetoEvent = AlfabetoEvent | AlfabetoChordEvent;

/** Cache alfabeto lookups so validation + codegen don't repeat work on the same event. */
const alfabetoMatchCache = new WeakMap<AnyAlfabetoEvent, AlfabetoMatch | undefined>();

function selectAlfabetoMatch(event: AnyAlfabetoEvent): AlfabetoMatch | undefined {
  const cached = alfabetoMatchCache.get(event);
  if (cached !== undefined) return cached;
  // WeakMap returns undefined for missing keys AND for cached undefined values.
  // Use has() to distinguish "not cached" from "cached as no-match".
  if (alfabetoMatchCache.has(event)) return undefined;

  const match = resolveAlfabetoMatch(event);
  alfabetoMatchCache.set(event, match);
  return match;
}

function resolveAlfabetoMatch(event: AnyAlfabetoEvent): AlfabetoMatch | undefined {
  const request = normalizeAlfabetoEvent(event);
  const chartId = request.chartId ?? "tyler-universal";

  if (request.letter && !request.chordName && !request.pitchClasses) {
    const shape = getChart(chartId).shapes.find((candidate) => candidate.letter === request.letter);

    if (!shape) {
      return undefined;
    }

    return {
      letter: shape.letter,
      chord: shape.chord,
      positions: shapeToPositions(shape),
      source: "standard",
    };
  }

  if (!request.chordName && !request.pitchClasses) {
    return undefined;
  }

  const result = alfabetoLookup({
    chordName: request.chordName,
    pitchClasses: request.pitchClasses,
    chartId,
    maxFret: request.maxFret,
    includeBarreVariants: request.includeBarreVariants,
  });
  const matches = request.letter
    ? result.matches.filter((match) => match.letter === request.letter)
    : result.matches;

  return matches[0];
}

type NormalizedAlfabetoEvent = {
  chordName?: string;
  pitchClasses?: readonly number[];
  chartId?: "tyler-universal" | "foscarini";
  maxFret?: number;
  includeBarreVariants?: boolean;
  letter?: string;
};

function normalizeAlfabetoEvent(event: AnyAlfabetoEvent): NormalizedAlfabetoEvent {
  if (event.type === "alfabeto_chord") {
    return {
      chordName: event.chord_name,
      chartId: event.chart_id,
      letter: event.prefer,
    };
  }

  return {
    chordName: event.chordName,
    pitchClasses: event.pitchClasses,
    chartId: event.chartId,
    maxFret: event.maxFret,
    includeBarreVariants: event.includeBarreVariants,
    letter: event.letter,
  };
}

function describeMissingAlfabetoMatch(event: AnyAlfabetoEvent): string {
  const request = normalizeAlfabetoEvent(event);

  if (request.letter && !request.chordName && !request.pitchClasses) {
    return `No alfabeto chart shape found for letter "${request.letter}" in ${request.chartId ?? "tyler-universal"}`;
  }

  if (!request.chordName && !request.pitchClasses) {
    return "Alfabeto event requires chordName, pitchClasses, or letter";
  }

  const target = request.chordName ?? `pitch classes ${request.pitchClasses?.join(",")}`;
  const letter = request.letter ? ` and letter "${request.letter}"` : "";
  return `No alfabeto match found for ${target}${letter} in ${request.chartId ?? "tyler-universal"}`;
}

function escapeLilyPondString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function noteIndicators(event: PositionNote | PitchNote): LyIndicator[] {
  const indicators: LyIndicator[] = [];

  if (event.tie) indicators.push({ kind: "tie" });
  if (event.slur_start) indicators.push({ kind: "slur_start" });
  if (event.slur_end) indicators.push({ kind: "slur_end" });
  if (event.ornament) indicators.push({ kind: "ornament", name: event.ornament });

  return indicators;
}

// === Main entry point ===

/**
 * Run the full engrave pipeline: resolve → validate → resolve pitches →
 * build LyTree → serialize.
 */
export function engrave(params: EngraveParams): EngraveResult {
  // Step 0: Validate structure when called directly (routes validate schema first).
  validateStructure(params);

  // Step 1: Resolve instrument and template
  const { vars, model, templateId } = resolveInstrument(params);

  // Step 2: Validate events (tab + global time/key)
  const { warnings } = validateEvents(params.bars, model, params);

  // Step 2b: Validate melody if present
  if (params.melody) {
    validateMelody(params.melody);
  }

  // Step 3: Resolve pitches → LyLeaf[]
  const musicLeaves = eventsToLeaves(params.bars, params, model);

  // Step 4: Build LyTree based on template strategy
  const { file, templateWarnings } = buildLyFile(params, vars, templateId, musicLeaves);

  // Step 5: Serialize
  const source = serializeFile(file);

  return {
    source,
    warnings: [...warnings, ...templateWarnings],
  };
}

/**
 * Guard structural invariants for direct engrave() callers.
 * HTTP routes perform full TypeBox decoding before calling engrave(), but tests
 * and server-side callers can construct EngraveParams values directly.
 */
function validateStructure(params: EngraveParams): void {
  const errors: ValidationDetail[] = [];

  if (!Array.isArray(params.bars) || params.bars.length === 0) {
    errors.push({ bar: 0, field: "bars", message: "Engrave params must include at least one bar" });
  } else {
    for (let barIdx = 0; barIdx < params.bars.length; barIdx++) {
      const bar = params.bars[barIdx];
      const barNum = barIdx + 1;

      if (!Array.isArray(bar.events) || bar.events.length === 0) {
        errors.push({
          bar: barNum,
          field: "events",
          message: `Bar ${barNum} must include at least one event`,
        });
      }
    }
  }

  if (errors.length > 0) {
    const summary = errors.map((e) => e.message).join("; ");
    throw new EngraveValidationError(`Validation failed: ${summary}`, errors);
  }
}

/**
 * Build the complete LyFile for the given template strategy.
 */
function buildLyFile(
  params: EngraveParams,
  vars: InstrumentLyVars,
  templateId: EngraveTemplateId,
  musicLeaves: LyLeaf[]
): { file: LyFile; templateWarnings: string[] } {
  const header: Record<string, string> = {};

  if (params.title) header.title = params.title;
  if (params.composer) header.composer = params.composer;

  const templateResult = dispatchTemplate(templateId, musicLeaves, vars, params);
  const scoreChildren = templateResult.scoreChildren;
  const variables = templateResult.variables ?? [];
  const templateWarnings = templateResult.warnings ?? [];

  const file: LyFile = {
    version: "2.24.0",
    includes: [vars.include],
    header: Object.keys(header).length > 0 ? header : undefined,
    variables: variables.length > 0 ? variables : undefined,
    score: lyScore(scoreChildren, { simultaneous: true }),
    layout: true,
    midi: params.tempo ? { tempo: params.tempo } : { tempo: 72 },
  };

  return { file, templateWarnings };
}
