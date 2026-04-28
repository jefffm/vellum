import type { EngraveBar, EngraveParams } from "../../lib/engrave-schema.js";
import type { InstrumentLyVars, EngraveTemplateId } from "../../lib/instrument-registry.js";
import {
  type LyContainer,
  type LyIndicator,
  type LyLeaf,
  type LyVariable,
  lyContainer,
  lyLyrics,
  lyNote,
  lyRest,
  lyRhythmicStaff,
  lyStaff,
  lyTabStaff,
  lyVoice,
  serializeLeafInline,
} from "../../lib/ly-tree.js";
import { parseTimeSignature } from "../../lib/music-utils.js";
import { scientificToLilyPond } from "../../lib/pitch.js";

export type TemplateResult = {
  scoreChildren: (LyLeaf | LyContainer)[];
  variables?: LyVariable[];
  warnings?: string[];
};

export function buildSoloTab(
  musicLeaves: LyLeaf[],
  vars: InstrumentLyVars,
  _params: EngraveParams
): TemplateResult {
  const withBlock = buildTabStaffWithBlock(vars);

  return {
    scoreChildren: [
      lyTabStaff([lyVoice("music", musicLeaves)], { withBlock }),
      buildHiddenMidiStaff(stripTabStringIndicators(musicLeaves)),
    ],
  };
}

export function buildFrenchTab(
  musicLeaves: LyLeaf[],
  vars: InstrumentLyVars,
  params: EngraveParams
): TemplateResult {
  const withBlock = buildTabStaffWithBlock(vars);
  const rhythmLeaves = eventsToRhythmLeaves(params.bars, params);

  return {
    scoreChildren: [
      lyRhythmicStaff([lyVoice("rhythm", rhythmLeaves)], {
        withBlock: [
          "\\override StaffSymbol.line-count = 0",
          '\\remove "Time_signature_engraver"',
          '\\remove "Clef_engraver"',
        ],
        indicators: [{ kind: "literal", text: "\\autoBeamOff", site: "before" }],
      }),
      lyTabStaff([lyVoice("music", musicLeaves)], { withBlock }),
      buildHiddenMidiStaff(stripTabStringIndicators(musicLeaves)),
    ],
  };
}

export function buildTabAndStaff(
  musicLeaves: LyLeaf[],
  vars: InstrumentLyVars,
  _params: EngraveParams
): TemplateResult {
  const withBlock = buildTabStaffWithBlock(vars);

  return {
    scoreChildren: [
      lyStaff([lyVoice("notation", stripTabStringIndicators(musicLeaves))], {
        indicators: [{ kind: "literal", text: '\\clef "treble_8"', site: "before" }],
      }),
      lyTabStaff([lyVoice("tab", musicLeaves)], { withBlock }),
    ],
  };
}

export function buildVoiceAndTab(
  musicLeaves: LyLeaf[],
  vars: InstrumentLyVars,
  params: EngraveParams
): TemplateResult {
  const withBlock = buildTabStaffWithBlock(vars);
  const melodyLeaves = buildMelodyLeaves(params);
  const lyricsContent = buildLyricsContent(params);

  const variables: LyVariable[] = [
    {
      name: "melody",
      body: serializeLeavesInlineArray(melodyLeaves),
    },
  ];

  if (lyricsContent) {
    variables.push({
      name: "lyricsText",
      body: `\\lyricmode { ${lyricsContent} }`,
      braces: false,
    });
  }

  variables.push({
    name: "lute",
    body: serializeLeavesInlineArray(musicLeaves),
  });

  const scoreChildren: (LyLeaf | LyContainer)[] = [
    lyContainer("Staff", {
      name: "voice",
      simultaneous: true,
      children: [
        lyVoice("melody", [], {
          indicators: [{ kind: "literal", text: "\\melody", site: "before" }],
        }),
      ],
    }),
  ];

  if (lyricsContent) {
    scoreChildren.push(
      lyLyrics("melody", [], {
        indicators: [{ kind: "literal", text: "\\lyricsText", site: "before" }],
      })
    );
  }

  scoreChildren.push(
    lyTabStaff(
      [
        lyVoice("tab", [], {
          indicators: [{ kind: "literal", text: "\\lute", site: "before" }],
        }),
      ],
      { withBlock }
    )
  );

  return { scoreChildren, variables };
}

export function dispatchTemplate(
  templateId: EngraveTemplateId,
  musicLeaves: LyLeaf[],
  vars: InstrumentLyVars,
  params: EngraveParams
): TemplateResult {
  switch (templateId) {
    case "solo-tab":
      return buildSoloTab(musicLeaves, vars, params);
    case "french-tab":
      return buildFrenchTab(musicLeaves, vars, params);
    case "tab-and-staff":
      return buildTabAndStaff(musicLeaves, vars, params);
    case "voice-and-tab":
      return buildVoiceAndTab(musicLeaves, vars, params);
    default:
      throw new Error(`Unknown template strategy: ${String(templateId)}`);
  }
}

/**
 * Build leading indicators (time/key/pickup) for a leaf position.
 */
export function buildLeadingIndicators(
  params: EngraveParams,
  bar: EngraveBar,
  isFirstLeaf: boolean,
  isFirstBar: boolean,
  isFirstInBar: boolean
): LyIndicator[] {
  const indicators: LyIndicator[] = [];

  if (isFirstLeaf) {
    if (params.pickup) {
      indicators.push({ kind: "partial", duration: params.pickup });
    }
    if (params.key) {
      indicators.push({ kind: "key_signature", tonic: params.key.tonic, mode: params.key.mode });
    }
    if (params.time) {
      indicators.push({ kind: "time_signature", ...parseTimeSignature(params.time) });
    }
  }

  if (isFirstInBar && !isFirstBar) {
    if (bar.key) {
      indicators.push({ kind: "key_signature", tonic: bar.key.tonic, mode: bar.key.mode });
    }
    if (bar.time) {
      indicators.push({ kind: "time_signature", ...parseTimeSignature(bar.time) });
    }
  }

  return indicators;
}

/**
 * Generate rhythm-only leaves for the french-tab RhythmicStaff.
 * Notes/chords → spacer note with same duration (rhythm flags only).
 * Rests → spacer rests (invisible).
 *
 * Also attaches time/key/pickup indicators matching the main voice.
 */
export function eventsToRhythmLeaves(bars: EngraveBar[], params: EngraveParams): LyLeaf[] {
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

      if (isLastInBar) {
        indicators.push({ kind: "bar_check" });
      }

      if (event.type === "rest") {
        leaves.push(lyRest(event.duration, true, indicators));
      } else {
        leaves.push(lyNote("c'", event.duration, indicators));
      }

      isFirstLeaf = false;
    }
  }

  return leaves;
}

/**
 * Build the \with block entries for a TabStaff based on instrument vars.
 */
export function buildTabStaffWithBlock(vars: InstrumentLyVars): string[] {
  const entries: string[] = [];
  entries.push(`tablatureFormat = \\${vars.tabFormat}`);
  entries.push(`stringTunings = \\${vars.stringTunings}`);

  if (vars.diapasons) {
    // TODO: future diapason scheme override support — generate inline
    // additionalBassStrings from a scheme parameter. For now, reference the .ily default.
    entries.push(`additionalBassStrings = \\${vars.diapasons}`);
  }

  return entries;
}

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

/**
 * Build melody LyLeaf nodes from the melody params (for voice-and-tab).
 */
export function buildMelodyLeaves(params: EngraveParams): LyLeaf[] {
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
export function buildLyricsContent(params: EngraveParams): string | null {
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
 * Uses the shared serializeLeafInline from ly-tree.ts.
 */
export function serializeLeavesInlineArray(leaves: LyLeaf[]): string {
  return leaves.map((leaf) => serializeLeafInline(leaf)).join(" ");
}

function stripTabStringIndicators(leaves: LyLeaf[]): LyLeaf[] {
  return leaves.map((leaf) => {
    if (leaf.type === "chord") {
      return {
        ...leaf,
        pitches: leaf.pitches.map((pitch) => pitch.replace(/\\\d+$/, "")),
      };
    }

    return {
      ...leaf,
      indicators: leaf.indicators.filter(
        (indicator) =>
          !(
            indicator.kind === "literal" &&
            indicator.site === "after" &&
            /^\\\d+$/.test(indicator.text)
          )
      ),
    };
  });
}
