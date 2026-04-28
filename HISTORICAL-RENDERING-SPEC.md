# Historical Rendering — Design Spec

> Draft for review. Iterate before cutting beads.

## Problem

Vellum's engrave tool produces functionally correct LilyPond that compiles and plays
back fine. But the visual output looks modern — curved flags, `3/4` time signatures,
no manuscript conventions. Historical lute and guitar tablature from the 17th–18th
centuries has a distinct visual language: straight rhythm flags, letter-based fret
notation with specific formatting, split staves for diapason bass courses, and
single-digit time signatures. Players and editors of early music expect notation
that looks like what they study from manuscript facsimiles.

The reference implementation is P.P. Schneider's 11-choir baroque lute snippet from
the LilyPond wiki (clipped in `repos/notes/Clippings/Baroque lute tablature -
LilyPond wiki.md`). That snippet renders a Kühnel courante with split diapason staff,
old-style flags, custom fret labels, polyphonic voice separation, and careful spacing
— the full historical treatment. Vellum should be able to produce output of that
caliber from structured input.

### Scope tiers

| Tier                | Items                                          | Effort    | Dependencies                               |
| ------------------- | ---------------------------------------------- | --------- | ------------------------------------------ |
| **v1 — ship now**   | Historical style options, split diapason staff | ~2-3 days | None — additive to current engine          |
| **v2 — next cycle** | Concert pitch, polyphonic voices               | ~1 week   | Polyphony needs schema + engine changes    |
| **v3 — future**     | Alfabeto chord notation, custom fret labels    | ~3-4 days | Alfabeto needs new event type + dictionary |

---

## 1. Historical Style Options (v1)

### The idea

A `style` field on `EngraveParams` that switches between modern (current default) and
historical visual rendering. The field controls `\layout` context overrides — no
structural changes to the LyTree or template strategies. Pure cosmetic layer.

### Schema change

```typescript
const EngraveStyleSchema = Type.Union([
  Type.Literal("modern"),
  Type.Literal("historical"),
]);

// Add to EngraveParamsSchema:
style: Type.Optional(EngraveStyleSchema),  // default: "modern"
```

When `style` is omitted or `"modern"`, output is identical to today. When
`"historical"`, the serializer emits an expanded `\layout` block with context
overrides.

### What `"historical"` enables

**RhythmicStaff context overrides:**

```lilypond
\context {
  \RhythmicStaff
  \override Flag.stencil = #old-straight-flag
  \override Stem.thickness = #1.0
  \override Dots.extra-offset = #'(0.5 . 1)
  \override Stem.extra-offset = #'(0.5 . 0)
  \override Flag.extra-offset = #'(0.5 . 0)
  fontSize = #-1
}
```

`old-straight-flag` produces the straight-line rhythm flags found in 17th/18th century
manuscripts. The offset tweaks align dots and stems to match the flag positions. The
`fontSize = #-1` reduction matches the Schneider snippet's proportions.

**TabStaff context overrides:**

```lilypond
\context {
  \TabStaff
  \omit Clef
  \override TimeSignature.style = #'single-digit
}
```

`single-digit` renders `\time 3/4` as just `3` — the historical convention. Clef
omission is standard for tablature (modern LilyPond sometimes emits a TAB clef).

**Score-level overrides:**

```lilypond
\context {
  \Score
  \override TimeSignature.style = #'single-digit
}
```

Propagates single-digit time to any Staff contexts too (for `tab-and-staff` and
`voice-and-tab` templates).

### LyFile and serializer changes

The `LyFile` type currently has `layout: boolean`. Extend it:

```typescript
export type LyLayoutContext = {
  context: string; // "RhythmicStaff", "TabStaff", "Score", etc.
  overrides: string[]; // raw LilyPond override lines
};

export type LyFile = {
  version: string;
  includes: string[];
  header?: Record<string, string>;
  variables?: LyVariable[];
  score: LyContainer;
  layout: boolean;
  layoutContexts?: LyLayoutContext[]; // NEW — emitted inside \layout { }
  midi?: { tempo: number };
};
```

When `layoutContexts` is populated, `serializeFile` emits:

```lilypond
\layout {
  \context {
    \RhythmicStaff
    \override Flag.stencil = #old-straight-flag
    \override Stem.thickness = #1.0
    ...
  }
  \context {
    \TabStaff
    \omit Clef
    ...
  }
}
```

instead of `\layout { }`.

### Where the style is applied

In `buildLyFile` (in `engrave.ts`), after getting the `TemplateResult` from
`dispatchTemplate`, check `params.style`. If `"historical"`, populate
`file.layoutContexts` with the appropriate overrides. The template strategies
themselves don't need to change — the style layer is orthogonal.

```typescript
function historicalLayoutContexts(templateId: EngraveTemplateId): LyLayoutContext[] {
  const contexts: LyLayoutContext[] = [];

  // Score-level: single-digit time for all contexts
  contexts.push({
    context: "Score",
    overrides: ["\\override TimeSignature.style = #'single-digit"],
  });

  // TabStaff: omit clef
  contexts.push({
    context: "TabStaff",
    overrides: ["\\omit Clef"],
  });

  // RhythmicStaff: old-style flags (only for templates that use it)
  if (templateId === "french-tab") {
    contexts.push({
      context: "RhythmicStaff",
      overrides: [
        "\\override Flag.stencil = #old-straight-flag",
        "\\override Stem.thickness = #1.0",
        "\\override Dots.extra-offset = #'(0.5 . 1)",
        "\\override Stem.extra-offset = #'(0.5 . 0)",
        "\\override Flag.extra-offset = #'(0.5 . 0)",
        "fontSize = #-1",
      ],
    });
  }

  return contexts;
}
```

### Instrument pseudo-clef glyph

Historical tablature manuscripts use an ornamental letter as a pseudo-clef (typically
`c` for lute, sometimes `ꝺ` or a decorated initial). The Schneider snippet uses
`instrumentName = \markup { \fontsize #18 c }`.

This is instrument-specific, so it belongs in the instrument profile, not the style
toggle. Add an optional field to `InstrumentLyVars`:

```typescript
export type InstrumentLyVars = {
  include: string;
  stringTunings: string;
  tabFormat: string;
  diapasons?: string;
  historicalClef?: string; // NEW — e.g. "c" for lute
};
```

When `style === "historical"` and `vars.historicalClef` is defined, add
`instrumentName = \markup { \fontsize #18 <glyph> }` to the TabStaff's `\with` block.

Instrument values:

| Instrument           | `historicalClef` | Notes                                    |
| -------------------- | ---------------- | ---------------------------------------- |
| `baroque-lute-13`    | `"c"`            | Standard French lute clef                |
| `theorbo-14`         | `"c"`            | Same convention                          |
| `renaissance-lute-6` | —                | Italian tab typically has no pseudo-clef |
| `baroque-guitar-5`   | —                | Varied by region                         |
| `classical-guitar-6` | —                | Modern instrument, not applicable        |

### What the LLM does

Nothing changes in the LLM workflow. The agent adds `style: "historical"` to the
engrave call when the user asks for historical-looking output, or when the piece
is from the baroque/renaissance repertoire and historical rendering is appropriate.
The LLM already knows the instrument and template — this is one more optional field.

---

## 2. Split Diapason Staff (v1)

### The idea

For instruments with diapason courses (baroque lute, theorbo), offer an option to
render the diapasons on a **separate, lineless TabStaff** below the main tablature.
This is how historical manuscripts actually look — bass courses appear below the
6-line staff with their own notation system (slash marks or letters).

Currently, Vellum uses LilyPond's `additionalBassStrings` property, which renders
diapasons on extra lines below the existing TabStaff. This works but doesn't match
manuscript conventions.

### When to activate

Couple this to `style: "historical"` for instruments that have diapasons. When
`style === "historical"` and the instrument has a `diapasons` entry in its
`InstrumentLyVars`, the template strategy automatically uses split diapason rendering.

Alternatively, provide a separate `splitDiapasons: true` flag for users who want the
split layout without the full historical style. For now, tie it to `style` only and
add the standalone flag later if needed.

### How it works

**Event splitting.** During `eventsToLeaves` (or in the template strategy), split
events into two streams based on course number:

```typescript
function splitEventsByCourse(
  bars: EngraveBar[],
  frettedCourses: number // from instrument profile: 6 for baroque lute
): { frettedBars: EngraveBar[]; diapasonBars: EngraveBar[] };
```

For each bar:

- Events on courses 1–`frettedCourses` go to `frettedBars`
- Events on courses `frettedCourses+1`–N go to `diapasonBars`
- Chord events are split: positions on fretted courses stay in the main bar,
  positions on diapason courses go to the diapason bar. If a chord has notes
  in both ranges, both staves get an event at that rhythmic position.
- Rests are duplicated to both staves (they need matching rhythmic structure).

This requires the instrument profile data (specifically `fretted_courses`) to be
available during template construction. Currently `dispatchTemplate` receives
`InstrumentLyVars` which doesn't include this. Options:

1. Pass the full instrument profile (from YAML) to the template strategy
2. Add `frettedCourses` to `InstrumentLyVars`
3. Add it to `EngraveParams` (redundant — it's derived from the instrument)

Option 2 is simplest and doesn't change the template strategy signatures much:

```typescript
export type InstrumentLyVars = {
  include: string;
  stringTunings: string;
  tabFormat: string;
  diapasons?: string;
  historicalClef?: string;
  frettedCourses?: number; // NEW — 6 for baroque lute, 6 for theorbo
  diapasonStringTunings?: string; // NEW — separate tuning for bass staff
};
```

### The bass TabStaff

The diapason staff is a TabStaff with special configuration:

```lilypond
\new TabStaff = "diapasons" \with {
  \bar ""
  \remove "Staff_symbol_engraver"
  \override VerticalAxisGroup.staff-staff-spacing = #'(
    (basic-distance . 2)
    (padding . 2))
  stringTunings = \stringTuning <c,>     % single-string tuning for notation
  fretLabels = \markuplist {
    "4" \null
    "///a" \null
    "//a" \null
    "/a"
    \column { \vspace #.15 "a" }
  }
} \diapasonMusic
```

Key elements:

- `\remove "Staff_symbol_engraver"` — no staff lines, just floating noteheads
- `\bar ""` — suppress barlines
- `stringTunings` with a single string — all diapason notes on one "string" since
  they're open courses (fret 0 always). The fret number encodes which course.
- `fretLabels` — the historical notation: course 7 = `a`, course 8 = `/a`,
  course 9 = `//a`, course 10 = `///a`, course 11 = `4`, etc.
- Tight vertical spacing to keep the bass staff close to the main tab

### Diapason fret label mapping

The Schneider snippet maps diapason courses to labels. For an 11-choir lute (courses
7-11), the labels from lowest pitch to highest are:

| Course | Pitch (d-minor) | Label  | Meaning                     |
| ------ | --------------- | ------ | --------------------------- |
| 7      | G2              | `a`    | Open 7th course             |
| 8      | F2              | `/a`   | One slash = 8th course      |
| 9      | Eb2             | `//a`  | Two slashes = 9th course    |
| 10     | D2              | `///a` | Three slashes = 10th course |
| 11     | C2              | `4`    | Numeral = 11th course       |

For a 13-course baroque lute (Vellum's `baroque-lute-13`), extending the pattern:

| Course | Pitch (d-minor) | Label  |
| ------ | --------------- | ------ |
| 7      | G2              | `a`    |
| 8      | F2              | `/a`   |
| 9      | Eb2             | `//a`  |
| 10     | D2              | `///a` |
| 11     | C2              | `4`    |
| 12     | Bb1             | `/4`   |
| 13     | A1              | `//4`  |

For the 14-course theorbo, add `///4` for course 14 (or `5` depending on regional
convention). This mapping should live in the instrument profile data, not hard-coded
in the template strategy.

**Instrument profile extension (YAML):**

```yaml
# baroque-lute-13.yaml
diapason_labels:
  7: "a"
  8: "/a"
  9: "//a"
  10: "///a"
  11: "4"
  12: "/4"
  13: "//4"
```

### Encoding diapason events

In the current `position` input mode, diapason events use `course: 7` through
`course: 13` with `fret: 0` (diapasons are always open). The event-splitting
function maps course number to the diapason staff's "fret" index, and the
`fretLabels` markuplist renders the correct historical label.

In the split bass TabStaff, all diapasons are placed on a single virtual "string"
(the lone string in `stringTunings = \stringTuning <c,>`). The "fret" number
encodes the course: course 7 = fret 0, course 8 = fret 1, ..., course 13 = fret 6.
The `fretLabels` list then maps fret 0 → `"a"`, fret 1 → `"/a"`, etc.

### Template strategy changes

`buildFrenchTab` gains a branch when historical style + diapasons are active:

```typescript
export function buildFrenchTab(
  musicLeaves: LyLeaf[],
  vars: InstrumentLyVars,
  params: EngraveParams,
): TemplateResult {
  const withBlock = buildTabStaffWithBlock(vars);
  const rhythmLeaves = eventsToRhythmLeaves(params.bars, params);

  const isHistorical = params.style === "historical";
  const hasDiapasons = vars.diapasons && vars.frettedCourses;

  if (isHistorical && hasDiapasons) {
    // Split events by course
    const { frettedBars, diapasonBars } = splitEventsByCourse(
      params.bars, vars.frettedCourses!
    );

    const frettedLeaves = eventsToLeaves(frettedBars, ...);
    const diapasonLeaves = eventsToLeaves(diapasonBars, ...);

    // Main tab without additionalBassStrings
    const mainWithBlock = withBlock.filter(
      e => !e.startsWith("additionalBassStrings")
    );

    return {
      scoreChildren: [
        // RhythmicStaff (unchanged)
        lyRhythmicStaff([lyVoice("rhythm", rhythmLeaves)], { ... }),
        // Main TabStaff (fretted courses only)
        lyTabStaff([lyVoice("music", frettedLeaves)], {
          withBlock: mainWithBlock,
        }),
        // Diapason TabStaff (lineless, custom labels)
        buildDiapasonStaff(diapasonLeaves, vars),
        // MIDI staff (full music for playback)
        buildHiddenMidiStaff(musicLeaves),
      ],
    };
  }

  // Modern fallback: existing behavior with additionalBassStrings
  return { ... };
}
```

The `buildSoloTab` strategy can also support split diapasons (solo baroque lute
pieces without rhythm flags). Apply the same split logic there.

### What this does NOT change

- `tab-and-staff` and `voice-and-tab` templates — these use standard notation staves
  alongside tab, and the standard staff already renders diapasons as bass notes. The
  split is only relevant for tab-only layouts.
- The `additionalBassStrings` approach remains the default for `style: "modern"`.
- The instrument `.ily` files are not modified — `luteDiapasons` is still used for
  modern rendering. The split staff generates its own inline `stringTuning`.

---

## 3. Concert Pitch (v2)

### The idea

A `concertPitch` field on `EngraveParams` that adjusts MIDI playback tuning. Tab
rendering is unaffected (it's course/fret based), but the hidden MIDI staff and any
notation staves should sound at the correct historical pitch.

### Schema

```typescript
const ConcertPitchSchema = Type.Union([
  Type.Literal(440),
  Type.Literal(415),
  Type.Literal(392),
  Type.Integer({ minimum: 380, maximum: 480 }),
]);

// Add to EngraveParamsSchema:
concertPitch: Type.Optional(ConcertPitchSchema),  // default: 440
```

### Historical pitch presets

| Standard                 | Hz  | Context                                        |
| ------------------------ | --- | ---------------------------------------------- |
| Modern                   | 440 | Default, modern instruments                    |
| Baroque (Rome)           | 415 | Roman courts, most baroque ensembles today     |
| Baroque (Venice/Cremona) | 392 | Northern Italian low pitch, French Ton d'opéra |
| Choir pitch              | 465 | German organs, not typical for plucked strings |

Source: Jeff's `Baroque guitar.md` notes on regional pitch standards.

### MIDI implementation

LilyPond doesn't have a global "set A4 frequency" knob. Two approaches:

**Option A: Global transposition.** Calculate the interval from 440 and apply a
`\transposition` or `\transpose` to the MIDI staff. A=415 is approximately one
semitone flat, so `\transpose c' b` on the MIDI staff. A=392 is approximately a
whole tone flat: `\transpose c' bes`. This is coarse — the semitone rounding means
A=415 plays at ~415.3 and A=392 plays at ~392.0 (close enough for playback).

**Option B: MIDI tuning SysEx.** Emit a MIDI tuning standard (MTS) SysEx message
at the start of the MIDI output. LilyPond doesn't support this natively, but a
post-processing step on the `.midi` file could inject it. More accurate but more
complex.

**Recommendation:** Option A for v2. It's simple, lives entirely in the LilyPond
source, and the rounding is inaudible. Option B can be a v3 refinement.

Implementation: add a `\transpose` wrapper around the hidden MIDI staff's music
when `concertPitch !== 440`:

```typescript
function concertPitchTransposition(hz: number): { from: string; to: string } | null {
  if (hz === 440) return null;
  const cents = 1200 * Math.log2(hz / 440);
  const semitones = Math.round(cents / 100);
  // Map semitone offset to LilyPond pitch pair
  // -1 semitone (415Hz): transpose c' → b
  // -2 semitones (392Hz): transpose c' → bes
  // etc.
  ...
}
```

### What this does NOT do

- Does not change tab rendering (tab is pitch-independent).
- Does not change notation staff pitches (those should reflect concert pitch for
  reading purposes — this is a design question for v2 review).
- Does not affect `\layout` — only `\midi`.

---

## 4. Polyphonic Voice Support (v2)

### The idea

Most baroque lute music has 2–3 independent voices (typically melody, inner voice,
bass). The Schneider snippet uses `\parallelMusic #'(rhythm high medium low)` to
manage four parallel streams. Currently, Vellum flattens everything into a single
voice — monophonic only. This is the single largest gap for serious baroque
repertoire.

### Schema extension

The current `bars` field is a single stream of events. For polyphony, we need
multiple named voice streams:

```typescript
const VoiceStreamSchema = Type.Object({
  name: Type.String({ minLength: 1 }),   // "melody", "inner", "bass"
  bars: Type.Array(EngraveBarSchema, { minItems: 1 }),
});

// Two options for backward compatibility:

// Option A: new field alongside bars
voices: Type.Optional(Type.Array(VoiceStreamSchema, { minItems: 2 })),

// Option B: bars becomes a union
bars: Type.Union([
  Type.Array(EngraveBarSchema),          // monophonic (current)
  Type.Array(VoiceStreamSchema),         // polyphonic (new)
]),
```

**Recommendation: Option A.** Keep `bars` as-is for monophonic input (backward
compatible). Add `voices` for polyphonic input. The engine checks: if `voices` is
provided, use polyphonic rendering; otherwise fall back to `bars`. Validation:
`voices` and `bars` are mutually exclusive.

### Voice ordering

Voice streams are ordered by convention: first voice = highest (melody), last voice
= lowest (bass). LilyPond's `\voiceOne`, `\voiceTwo`, etc. are assigned in order.
This matters for stem direction and collision resolution.

| Voice index | LilyPond command | Stem direction | Typical role       |
| ----------- | ---------------- | -------------- | ------------------ |
| 0           | `\voiceOne`      | Up             | Melody             |
| 1           | `\voiceTwo`      | Down           | Bass               |
| 2           | `\voiceThree`    | Up             | Inner voice (high) |
| 3           | `\voiceFour`     | Down           | Inner voice (low)  |

### LyTree representation

The existing tree infrastructure already supports this. A polyphonic TabStaff uses
`simultaneous: true` with multiple Voice children:

```typescript
const upper = lyVoice("melody", melodyLeaves, {
  indicators: [{ kind: "literal", text: "\\voiceOne", site: "before" }],
});
const lower = lyVoice("bass", bassLeaves, {
  indicators: [{ kind: "literal", text: "\\voiceTwo", site: "before" }],
});

const tabStaff = lyTabStaff(
  [
    lyContainer("Voice", {
      // anonymous wrapper for simultaneous
      simultaneous: true,
      children: [upper, lower],
    }),
  ],
  { withBlock }
);
```

This serializes to:

```lilypond
\new TabStaff \with { ... } {
  <<
    \context Voice = "melody" {
      \voiceOne
      d''4 e''4 f''4 g''4
    }
    \context Voice = "bass" {
      \voiceTwo
      d'4 c'4 b4 a4
    }
  >>
}
```

Which is exactly the LilyPond polyphonic voice pattern.

### RhythmicStaff with polyphony

For `french-tab`, the RhythmicStaff can either:

1. **Show only the top voice's rhythm** (simplest, matches most manuscript practice)
2. **Show all voices' rhythms** with stem direction separating them (more complex
   but more informative)

**Recommendation:** Option 1 for v2 initial. The rhythm staff shows only voice[0]
(melody) rhythm. This matches the Schneider snippet where the rhythm staff has one
stem direction and the lower voices are understood from the tab. Add option 2 later
if needed.

### Split diapasons with polyphony

When both polyphonic voices and split diapasons are active, the bass voice's
diapason-range notes go to the diapason staff. This is the combination the Schneider
snippet demonstrates — `high` and `medium` voices on the main tab, `low` voice on
the diapason tab.

The event-splitting logic from §2 applies per-voice: split each voice stream by
course number, then combine the diapason portions into one bass staff.

### Template strategy changes

`buildFrenchTab` and `buildSoloTab` gain polyphonic variants. The dispatch function
checks whether `params.voices` is present:

```typescript
if (params.voices) {
  return buildFrenchTabPolyphonic(params.voices, vars, params);
} else {
  return buildFrenchTab(musicLeaves, vars, params);
}
```

### What this does NOT do

- Does not add `\parallelMusic` — that's a LilyPond convenience macro for hand
  entry. Vellum generates the expanded form directly.
- Does not handle more than 4 voices — LilyPond's limit is 4 per staff.
- Does not resolve voice collisions — LilyPond handles this automatically via
  `\voiceOne`/`\voiceTwo` stem direction rules.
- Does not validate that voices have matching bar counts (should be validated in
  the engine, not deferred to LilyPond).

---

## 5. Alfabeto Chord Notation (v3)

### The idea

Baroque guitar repertoire (de Visée, Corbetta, Santiago de Murcia, Foscarini) uses
the **Alfabeto** system — single letters representing full chord shapes for strummed
(rasgueado) passages. Often mixed with tablature in the same piece ("mixed
tablature"). Vellum's baroque guitar profile already notes this in its constraints
field but has no rendering support.

### New event type

```typescript
const AlfabetoEventSchema = Type.Object({
  type: Type.Literal("alfabeto"),
  letter: Type.String({ minLength: 1, maxLength: 2 }), // "A", "B", "+", "Bb"
  duration: Type.String({ minLength: 1 }),
  direction: Type.Optional(
    Type.Union([
      Type.Literal("up"), // rasgueado up-stroke
      Type.Literal("down"), // rasgueado down-stroke
    ])
  ),
});
```

### Alfabeto dictionary

The standard Italian Alfabeto system (Montesardo, 1606):

| Letter | Chord    | Voicing (5→1) |
| ------ | -------- | ------------- |
| A      | G major  | 0-2-0-0-0     |
| B      | C minor  | 0-1-0-1-3     |
| C      | D major  | 2-2-2-0-x     |
| D      | A minor  | 0-0-2-2-0     |
| E      | D minor  | 0-0-0-2-3     |
| F      | F major  | 3-2-1-0-x     |
| G      | B♭ major | 1-1-3-3-x     |
| H      | A major  | 0-2-2-2-0     |
| I      | E minor  | 0-0-0-0-2     |
| K      | C major  | 0-0-2-3-x     |
| L      | E major  | 0-0-1-0-0     |
| M      | G minor  | 0-1-3-3-x     |
| N      | F minor  | 1-1-1-3-x     |
| O      | B♭ minor | 1-1-3-4-x     |
| P      | E♭ major | 1-1-1-0-x     |

There are regional variants (Spanish, French). The dictionary should be
configurable per instrument profile or as a lookup table.

### Rendering

Alfabeto letters render as text markup above the staff:

```lilypond
\mark \markup { \bold "A" }    % chord letter
```

With stroke direction indicated by an arrow or line above/below:

```lilypond
\mark \markup { \bold "A" \super "↑" }   % up-stroke
```

Or more historically, vertical lines (short line up, short line down) alongside the
letter on the rhythm staff.

### Mixed tablature

In mixed tablature, passages alternate between Alfabeto (strummed) and standard
tablature (plucked). The event stream interleaves `alfabeto` and `note`/`chord`
events. The template strategy detects transitions and emits appropriate context
switches.

### What this does NOT do

- Does not handle Alfabeto _dissonances_ (chromatic alterations marked with `#` or
  `b` suffixed to letters) — those are rare and can be a later refinement.
- Does not auto-detect whether a passage should be Alfabeto vs. tablature — the LLM
  explicitly uses the `alfabeto` event type.

---

## 6. Custom Fret Label Formatting (v3)

### The idea

The Schneider snippet uses a detailed `fretLabels = \markuplist { ... }` with
`\column`, `\vspace` positioning for each letter. Vellum currently relies entirely
on LilyPond's `fret-letter-tablature-format`. The built-in format is acceptable for
most cases, but historical manuscripts have specific letter forms and spacing that
the default doesn't match.

### Approach

Add an optional `fretLabels` field to the instrument `.ily` file:

```lilypond
% baroque-lute-13.ily (extended for historical mode)
luteFretLabels = \markuplist {
  \column { \vspace #.15 "a" }
  "b"
  \column { \vspace #.15 "r" }
  "d"
  \column { \vspace #.15 "e" }
  "f"
  "g"
  "h"
  "i"
  "k"
}
```

And a corresponding entry in `InstrumentLyVars`:

```typescript
fretLabels?: string;   // LilyPond variable name for custom fretLabels
```

When `style === "historical"` and the instrument has `fretLabels`, add
`fretLabels = \<varName>` to the TabStaff's `\with` block.

### What this does NOT do

- Does not implement alternative font rendering (e.g. Bravura SMuFL glyphs) — that
  requires font installation on the LilyPond side.
- Does not change the number of fret labels or their semantic mapping — just the
  visual presentation.

---

## Implementation order

### v1 beads (estimate: 8-10 beads)

1. **Schema**: Add `style` field to `EngraveParamsSchema` (with validation)
2. **LyFile type**: Add `layoutContexts` to `LyFile`
3. **Serializer**: Update `serializeFile` to emit `\layout { \context { ... } }`
4. **Style builder**: `historicalLayoutContexts()` function
5. **Integration**: Wire style into `buildLyFile`
6. **Instrument registry**: Add `historicalClef` and `frettedCourses` to `InstrumentLyVars`
7. **Event splitting**: `splitEventsByCourse()` function
8. **Diapason staff**: `buildDiapasonStaff()` function with fretLabels
9. **Template update**: `buildFrenchTab` and `buildSoloTab` historical branches
10. **Tests**: Style rendering, event splitting, diapason staff output, golden tests

### v2 beads (estimate: 10-12 beads)

1. **Schema**: `concertPitch` field + `voices` field
2. **Validation**: Mutual exclusion of `bars`/`voices`, voice bar-count matching
3. **Concert pitch**: Transposition logic + MIDI staff wrapping
4. **Voice processing**: `eventsToLeaves` per voice stream
5. **Polyphonic templates**: `buildFrenchTabPolyphonic`, `buildSoloTabPolyphonic`
6. **Combined mode**: Split diapasons + polyphonic voices
7. **Tests**: Polyphonic output, concert pitch transposition, combined scenarios

### v3 beads (estimate: 6-8 beads)

1. **Alfabeto dictionary**: Chord lookup table
2. **Alfabeto event type**: Schema, validation, rendering
3. **Mixed tablature**: Context switching in event stream
4. **Fret labels**: `.ily` extensions, registry updates, with-block generation

---

## What this does NOT do

- **Mensural notation.** LilyPond has a `\mensural` style for pre-baroque notation
  (white mensural, Petrucci, etc.). This spec covers tablature conventions, not
  mensural staff notation. Adding mensural would be a separate spec.

- **Facsimile reproduction.** The goal is _historically informed_ rendering, not
  pixel-perfect manuscript reproduction. The output will look like good modern
  editions of early music (e.g. SPES, Minkoff, Tree Edition), not like a scan of
  a 17th century manuscript.

- **Font management.** Custom early music fonts (Bravura, Feta, period-specific
  glyphs) require system-level font installation. This spec uses LilyPond's built-in
  capabilities only.

- **Italian tablature.** The renaissance lute uses Italian number tablature (numbers
  instead of letters, inverted string order). This spec focuses on French letter
  tablature conventions. Italian tab improvements would be a separate effort, though
  some items (historical style flags, split bass courses for 7+ course lutes) apply
  to both.

- **Continuo figures.** Figured bass (`\figuremode`) for theorbo continuo parts is
  deferred to the v2 template expansions listed in `TEMPLATE-FILL-SPEC.md`.

- **Brisé / broken chord notation.** The characteristic French lute texture of
  arpeggiated chords is a _playing technique_, not a notation issue. LilyPond's
  arpeggio indicators already handle this. No special rendering support needed.

---

## Open questions

1. **Should `style: "historical"` auto-activate split diapasons?** Current spec says
   yes. Alternative: keep them separate (`style` for cosmetics, `splitDiapasons` for
   structure). The argument for coupling: if you want historical look, you want both.
   The argument against: some users may want old-style flags without the structural
   change.

2. **Diapason labels for theorbo.** The slash-notation convention (`a`, `/a`, `//a`)
   is well-documented for baroque lute. Theorbo diapason labeling varies more by
   source. Need to research conventions for 14-course instruments — the pattern may
   extend to `5`, `/5`, etc. for the lowest courses.

3. **Polyphonic voice count.** Should we cap at 2 voices for v2 and defer 3-4 voice
   support? Most lute music is 2-3 voices. The Schneider snippet uses 3 (high,
   medium, low) plus rhythm. LilyPond supports 4. Supporting all 4 from the start
   is minimal extra work, but testing 3-4 voice combinations is more complex.

4. **Rhythm staff in historical mode.** Should `\omit NoteHead` be used (stems and
   flags only, no noteheads — closer to manuscripts) or keep noteheads visible
   (easier to read)? The Schneider snippet omits noteheads. This could be part of
   the `style: "historical"` toggle or a separate option.

5. **Concert pitch and notation staves.** When `concertPitch: 415` is set and the
   template is `tab-and-staff` or `voice-and-tab`, should the notation staff show
   sounding pitch (transposed) or written pitch (at 440)? Baroque performance
   practice would say sounding pitch, but modern editions often don't transpose.
