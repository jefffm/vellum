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
  ChordEvent,
  EngraveBar,
  EngraveParams,
  EngraveResult,
  EngraveMusicEvent,
  PitchNote,
  PositionNote,
  RestEvent,
} from "../../lib/engrave-schema.js";
import {
  type InstrumentLyVars,
  ENGRAVE_INSTRUMENT_IDS,
  ENGRAVE_TEMPLATE_IDS,
  type EngraveTemplateId,
  getInstrumentLyVars,
  validateTemplateId,
} from "../../lib/instrument-registry.js";
import { InstrumentModel } from "../../lib/instrument-model.js";
import {
  type LyContainer,
  type LyFile,
  type LyIndicator,
  type LyLeaf,
  type LyVariable,
  lyChord,
  lyContainer,
  lyLyrics,
  lyNote,
  lyRest,
  lyRhythmicStaff,
  lyScore,
  lyStaff,
  lyTabStaff,
  lyVoice,
  serializeFile,
} from "../../lib/ly-tree.js";
import { loadProfile } from "../profiles.js";
import { parsePitch, scientificToLilyPond } from "../../lib/pitch.js";

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
  bar: number; // 1-based
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
  // Validate instrument
  const vars = getInstrumentLyVars(params.instrument);

  // Validate template
  validateTemplateId(params.template);
  const templateId = params.template as EngraveTemplateId;

  // Load instrument model for validation
  // We construct from the vars — for the engine we need the YAML profile
  // loaded via the server-side loader
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

/**
 * Load an InstrumentModel synchronously from the YAML profile.
 */
function loadInstrumentModel(instrumentId: string): InstrumentModel {
  const profile = loadProfile(instrumentId);
  return InstrumentModel.fromProfile(profile);
}

// === Step 2: Event validation ===

export function validateEvents(bars: EngraveBar[], model: InstrumentModel): { warnings: string[] } {
  const errors: ValidationDetail[] = [];
  const warnings: string[] = [];
  const maxStretch = model.maxStretch();

  for (let barIdx = 0; barIdx < bars.length; barIdx++) {
    const bar = bars[barIdx];
    const barNum = barIdx + 1;
    const positionFrets: number[] = []; // for stretch check

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
          validatePositionNote(event, model, barNum, evNum, errors);
          positionFrets.push(event.fret);
        } else {
          validatePitchNote(event, barNum, evNum, errors);
        }
      } else if (event.type === "chord") {
        for (const pos of event.positions) {
          if (pos.input === "position") {
            validatePositionEntry(pos.course, pos.fret, model, barNum, evNum, errors);
            positionFrets.push(pos.fret);
          } else {
            validatePitchEntry(pos.pitch, barNum, evNum, errors);
          }
        }
      }
      // Rests: only duration validation (already done above)
    }

    // Stretch check for position-mode events in this bar
    if (positionFrets.length >= 2) {
      const frettedOnly = positionFrets.filter((f) => f > 0);

      if (frettedOnly.length >= 2) {
        const span = Math.max(...frettedOnly) - Math.min(...frettedOnly);

        if (span > maxStretch) {
          warnings.push(
            `Bar ${barNum}: fret span ${span} exceeds comfortable stretch of ${maxStretch} frets`
          );
        }
      }
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

function validatePositionNote(
  event: PositionNote,
  model: InstrumentModel,
  barNum: number,
  evNum: number,
  errors: ValidationDetail[]
): void {
  validatePositionEntry(event.course, event.fret, model, barNum, evNum, errors);
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
    return; // skip further checks that depend on valid course
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

  // Diapason courses must be fret 0
  if (model.isDiapason(course) && fret !== 0) {
    errors.push({
      bar: barNum,
      event: evNum,
      field: "fret",
      message: `Course ${course} is a diapason (open string only) — fret must be 0, got ${fret}`,
    });
  }
}

function validatePitchNote(
  event: PitchNote,
  barNum: number,
  evNum: number,
  errors: ValidationDetail[]
): void {
  validatePitchEntry(event.pitch, barNum, evNum, errors);
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
      const indicators: LyIndicator[] = [];

      // Global indicators on the very first leaf
      if (isFirstLeaf) {
        if (params.pickup) {
          indicators.push({ kind: "partial", duration: params.pickup });
        }

        if (params.key) {
          indicators.push({
            kind: "key_signature",
            tonic: params.key.tonic,
            mode: params.key.mode,
          });
        }

        if (params.time) {
          indicators.push({ kind: "time_signature", ...parseTimeSignature(params.time) });
        }
      }

      // Per-bar overrides on the first event of the bar
      if (isFirstInBar && !isFirstBar) {
        if (bar.key) {
          indicators.push({ kind: "key_signature", tonic: bar.key.tonic, mode: bar.key.mode });
        }

        if (bar.time) {
          indicators.push({ kind: "time_signature", ...parseTimeSignature(bar.time) });
        }
      }

      // Also handle first-bar per-bar overrides (in case global AND per-bar are set)
      if (isFirstInBar && isFirstBar && !isFirstLeaf) {
        // This shouldn't happen since isFirstLeaf = true on barIdx 0, evIdx 0
      }

      const leaf = resolveEvent(event, model, indicators);

      // Post-event indicators
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
      return lyNote(lyPitch, event.duration, allIndicators);
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
        pitches.push(scientificToLilyPond(pitch));
      } else {
        pitches.push(scientificToLilyPond(pos.pitch));
      }
    }

    const afterIndicators: LyIndicator[] = [];

    if (event.tie) afterIndicators.push({ kind: "tie" });

    return lyChord(pitches, event.duration, [...indicators, ...afterIndicators]);
  }

  // Rest
  const rest = event as RestEvent;
  return lyRest(rest.duration, rest.spacer ?? false, [...indicators]);
}

function noteIndicators(event: PositionNote | PitchNote): LyIndicator[] {
  const indicators: LyIndicator[] = [];

  if (event.tie) indicators.push({ kind: "tie" });
  if (event.slur_start) indicators.push({ kind: "slur_start" });
  if (event.slur_end) indicators.push({ kind: "slur_end" });
  if (event.ornament) indicators.push({ kind: "ornament", name: event.ornament });

  return indicators;
}

/**
 * Generate rhythm-only leaves for the french-tab RhythmicStaff.
 * Notes/chords → spacer note with same duration (rhythm flags only).
 * Rests → spacer rests (invisible).
 */
export function eventsToRhythmLeaves(bars: EngraveBar[]): LyLeaf[] {
  const leaves: LyLeaf[] = [];

  for (let barIdx = 0; barIdx < bars.length; barIdx++) {
    const bar = bars[barIdx];

    for (let evIdx = 0; evIdx < bar.events.length; evIdx++) {
      const event = bar.events[evIdx];
      const isLastInBar = evIdx === bar.events.length - 1;
      const indicators: LyIndicator[] = [];

      if (isLastInBar) {
        indicators.push({ kind: "bar_check" });
      }

      if (event.type === "rest") {
        // Spacer rest on rhythm staff
        leaves.push(lyRest(event.duration, true, indicators));
      } else {
        // Dummy note for rhythm display — use 'c' as dummy pitch
        // The RhythmicStaff only shows stems and flags, no noteheads
        leaves.push(lyNote("c'", event.duration, indicators));
      }
    }
  }

  return leaves;
}

function parseTimeSignature(time: string): { numerator: number; denominator: number } {
  const parts = time.split("/");

  if (parts.length !== 2) {
    throw new Error(`Invalid time signature: "${time}". Expected format: "4/4", "3/4", "6/8"`);
  }

  const numerator = parseInt(parts[0], 10);
  const denominator = parseInt(parts[1], 10);

  if (isNaN(numerator) || isNaN(denominator) || numerator < 1 || denominator < 1) {
    throw new Error(`Invalid time signature: "${time}"`);
  }

  return { numerator, denominator };
}

// === Step 4: \with block generation ===

/**
 * Build the \with block entries for a TabStaff based on instrument vars.
 */
export function buildTabStaffWithBlock(vars: InstrumentLyVars, _diapasonScheme?: string): string[] {
  const entries: string[] = [];
  entries.push(`tablatureFormat = \\${vars.tabFormat}`);
  entries.push(`stringTunings = \\${vars.stringTunings}`);

  if (vars.diapasons) {
    // TODO: when diapasonScheme override is provided, generate inline
    // additionalBassStrings from the scheme. For now, reference the .ily default.
    entries.push(`additionalBassStrings = \\${vars.diapasons}`);
  }

  return entries;
}

// === Step 5: Hidden MIDI staff builder ===

/**
 * Build a hidden Staff for MIDI output. The staff is visually invisible
 * (all engravers removed, all elements transparent) but produces MIDI.
 */
export function buildHiddenMidiStaff(musicLeaves: LyLeaf[]): LyContainer {
  return lyStaff([lyVoice("midi", [...musicLeaves])], {
    withBlock: [
      '\\remove "Staff_symbol_engraver"',
      '\\remove "Clef_engraver"',
      '\\remove "Time_signature_engraver"',
      "\\override NoteHead.transparent = ##t",
      "\\override Rest.transparent = ##t",
      "\\override Stem.transparent = ##t",
      "\\override Dots.transparent = ##t",
      "\\override Beam.transparent = ##t",
    ],
  });
}

// === Main entry point ===

/**
 * Run the full engrave pipeline: resolve → validate → resolve pitches →
 * build LyTree → serialize.
 */
export function engrave(params: EngraveParams): EngraveResult {
  // Step 1: Resolve instrument and template
  const { vars, model, templateId } = resolveInstrument(params);

  // Step 2: Validate events
  const { warnings } = validateEvents(params.bars, model);

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

  const variables: LyVariable[] = [];
  const withBlock = buildTabStaffWithBlock(vars, params.diapason_scheme);

  let scoreChildren: (LyLeaf | LyContainer)[];
  const templateWarnings: string[] = [];

  switch (templateId) {
    case "solo-tab":
      scoreChildren = [
        lyTabStaff([lyVoice("music", musicLeaves)], { withBlock }),
        buildHiddenMidiStaff(musicLeaves),
      ];
      break;

    case "french-tab": {
      const rhythmLeaves = eventsToRhythmLeaves(params.bars);
      scoreChildren = [
        lyRhythmicStaff([lyVoice("rhythm", rhythmLeaves)], {
          withBlock: [
            "\\override StaffSymbol.line-count = 0",
            '\\remove "Time_signature_engraver"',
            '\\remove "Clef_engraver"',
          ],
          indicators: [{ kind: "literal", text: "\\autoBeamOff", site: "before" }],
        }),
        lyTabStaff([lyVoice("music", musicLeaves)], { withBlock }),
        buildHiddenMidiStaff(musicLeaves),
      ];
      break;
    }

    case "tab-and-staff":
      scoreChildren = [
        lyStaff([lyVoice("notation", musicLeaves)], {
          indicators: [{ kind: "literal", text: '\\clef "treble_8"', site: "before" }],
        }),
        lyTabStaff([lyVoice("tab", musicLeaves)], { withBlock }),
      ];
      break;

    case "voice-and-tab": {
      // Build melody variable content
      const melodyLeaves = buildMelodyLeaves(params);
      const lyricsContent = buildLyricsContent(params);

      variables.push({ name: "melody", body: serializeLeavesInline(melodyLeaves) });

      if (lyricsContent) {
        variables.push({
          name: "lyricsText",
          body: `\\lyricmode { ${lyricsContent} }`,
          braces: false,
        });
      }

      variables.push({ name: "lute", body: serializeLeavesInline(musicLeaves) });

      scoreChildren = [
        lyContainer("Staff", {
          name: "voice",
          simultaneous: true,
          children: [
            lyVoice("melody", [lyNote("c'", "1")]), // placeholder — uses \melody variable
          ],
        }),
        lyLyrics("melody", []),
        lyTabStaff([lyVoice("tab", musicLeaves)], { withBlock }),
      ];
      break;
    }
  }

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

/**
 * Build melody LyLeaf nodes from the melody params (for voice-and-tab).
 */
function buildMelodyLeaves(params: EngraveParams): LyLeaf[] {
  if (!params.melody) return [];

  const leaves: LyLeaf[] = [];

  for (const bar of params.melody.bars) {
    for (let evIdx = 0; evIdx < bar.events.length; evIdx++) {
      const event = bar.events[evIdx];
      const isLastInBar = evIdx === bar.events.length - 1;
      const indicators: LyIndicator[] = [];

      if (isLastInBar) {
        indicators.push({ kind: "bar_check" });
      }

      if (event.type === "note") {
        const lyPitch = scientificToLilyPond(event.pitch);
        leaves.push(lyNote(lyPitch, event.duration, indicators));
      } else {
        leaves.push(lyRest(event.duration, false, indicators));
      }
    }
  }

  return leaves;
}

/**
 * Extract lyrics text from melody events (for voice-and-tab).
 */
function buildLyricsContent(params: EngraveParams): string | null {
  if (!params.melody) return null;

  const syllables: string[] = [];

  for (const bar of params.melody.bars) {
    for (const event of bar.events) {
      if (event.type === "note" && event.lyric) {
        syllables.push(event.lyric);
      }
    }
  }

  return syllables.length > 0 ? syllables.join(" ") : null;
}

/**
 * Serialize a flat array of leaves into an inline string (for variable bodies).
 */
function serializeLeavesInline(leaves: LyLeaf[]): string {
  return leaves
    .map((leaf) => {
      let core: string;

      switch (leaf.type) {
        case "note":
          core = `${leaf.pitch}${leaf.duration}`;
          break;
        case "chord":
          core = `<${leaf.pitches.join(" ")}>${leaf.duration}`;
          break;
        case "rest":
          core = `${leaf.spacer ? "s" : "r"}${leaf.duration}`;
          break;
      }

      let suffix = "";

      for (const ind of leaf.indicators) {
        if (ind.kind === "tie") suffix += "~";
        else if (ind.kind === "slur_start") suffix += "(";
        else if (ind.kind === "slur_end") suffix += ")";
        else if (ind.kind === "ornament") suffix += `\\${ind.name}`;
        else if (ind.kind === "bar_check") suffix += " |";
      }

      return core + suffix;
    })
    .join(" ");
}
