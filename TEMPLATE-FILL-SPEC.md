# Engrave Tool — LilyPond Codegen Engine

> Revised 2026-04-27 after blunder hunt. See `BLUNDER-HUNT-ENGRAVE.md` for findings.

## Problem

LilyPond source generation is the primary failure mode in Vellum. The LLM has good
tools for finding valid positions (`tabulate`, `voicings`, `check_playability`,
`diapasons`, `theory`, `transpose`, `fretboard`) but must then hand-write LilyPond
syntax to express the result. This consistently fails:

- Wrong `\relative` octave contexts cause cascading pitch errors
- Incorrect variable names from `.ily` files (e.g. using `\luteStringTunings` with
  a theorbo, or `\classicalGuitarTabFormat` with a baroque lute)
- Malformed `\stringTuning` + `additionalBassStrings` interaction for diapason
  instruments — these are separate LilyPond properties with different semantics
- Bad duration expressions, missing bar checks, missing rests
- Full rewrites instead of surgical edits

The compile retry guard (`src/lib/compile-retry-guard.ts`) catches failures and nudges
the LLM to iterate, but by that point the LLM is debugging *syntax* rather than fixing
*music*, and burns all 3 retries on structural mistakes.

## Proposal: `engrave` tool

A new server-side tool that accepts **structured musical data** (positions, durations,
metadata) and **generates complete, self-contained LilyPond source** ready for
`compile`. The LLM never writes raw LilyPond for the hard parts.

**This is a codegen engine, not a template filler.** The tool generates the entire
LilyPond file programmatically — `\version`, `\include`, variable definitions, `\score`
block, `\layout`, `\midi` — using template IDs only to determine the *staff layout
structure* and instrument IDs to determine the *variable names and include paths*.
Existing `.ly` template files are structural reference, not fill-in-the-blank forms.

### Why server-side

The tool must:
1. Read instrument `.ily` files to resolve variable names per instrument
2. Access the instrument YAML profiles for validation (course ranges, frets, diapasons)
3. Generate file paths for `\include` directives relative to the server's filesystem

These require server-side filesystem access. Client-side tools (`tabulate`, `voicings`,
etc.) use pre-loaded browser profiles, but `engrave` needs the `.ily` data that only
exists on disk.

### Design principles

1. **The LLM decides what to play; the tool decides how to notate it.** The LLM's
   job is musical: pick pitches, choose voicings, set durations. The tool handles
   all LilyPond-specific syntax — include paths, variable names, string tunings,
   tab format, absolute pitch encoding, staff layout.

2. **Generate, don't fill.** The tool produces complete LilyPond source from scratch.
   It does not read or modify existing `.ly` template files. Template IDs map to
   codegen strategies (which staves to create, how to wire them).

3. **Validate before emitting.** The tool rejects unplayable positions *before*
   generating LilyPond, so the LLM gets actionable errors without burning a compile.

4. **Absolute pitches only.** No `\relative` blocks anywhere in generated output.
   This eliminates the #1 source of LilyPond compilation failures.

5. **Output is deterministic.** Same input → same LilyPond source.

### Existing tool integration

The full current toolchain (10 tools in `vellumTools`):

| Tool | Location | Relevance to `engrave` |
|---|---|---|
| `tabulate` | `src/tools.ts` (client) | LLM uses output to build `engrave` input |
| `voicings` | `src/tools.ts` (client) | LLM uses output to build `engrave` input |
| `check_playability` | `src/tools.ts` (client) | `engrave` runs equivalent validation internally |
| `theory` | `src/tools.ts` (client) | LLM uses for harmonic analysis before arranging |
| `diapasons` | `src/diapasons.ts` (client) | **Overlap** — already generates LilyPond diapason syntax. `engrave` delegates to equivalent logic for `additionalBassStrings` |
| `transpose` | `src/tools.ts` (client) | LLM uses for key transposition |
| `fretboard` | `src/tools.ts` (client) | LLM uses for visualization |
| `compile` | `src/server-tools.ts` (server) | LLM calls after `engrave` to produce SVG/PDF |
| `analyze` | `src/server-tools.ts` (server) | LLM uses for MusicXML → harmonic analysis |
| `lint` | `src/server-tools.ts` (server) | LLM uses for voice-leading checks |

The `diapasons` tool (`src/diapasons.ts`) already contains `PITCH_TO_LILYPOND` (a
note-name-to-LilyPond map) and `buildLilypondSyntax()` (octave comma logic for bass
strings). `engrave` should reuse and extend this infrastructure rather than duplicate it.

---

## Input schema

```typescript
// --- Event types (discriminated union) ---

const PositionNoteSchema = Type.Object({
  type: Type.Literal("note"),
  input: Type.Literal("position"),
  course: Type.Integer({ minimum: 1 }),
  fret: Type.Integer({ minimum: 0 }),
  duration: Type.String(),              // LilyPond duration: "4", "8", "2.", "16"
  tie: Type.Optional(Type.Boolean()),
  slur_start: Type.Optional(Type.Boolean()),
  slur_end: Type.Optional(Type.Boolean()),
  ornament: Type.Optional(Type.Union([
    Type.Literal("trill"),
    Type.Literal("mordent"),
    Type.Literal("turn"),
    Type.Literal("prall"),
  ])),
});

const PitchNoteSchema = Type.Object({
  type: Type.Literal("note"),
  input: Type.Literal("pitch"),
  pitch: Type.String(),                 // Scientific notation: "G4", "Eb3", "A2"
  duration: Type.String(),
  tie: Type.Optional(Type.Boolean()),
  slur_start: Type.Optional(Type.Boolean()),
  slur_end: Type.Optional(Type.Boolean()),
  ornament: Type.Optional(Type.Union([
    Type.Literal("trill"),
    Type.Literal("mordent"),
    Type.Literal("turn"),
    Type.Literal("prall"),
  ])),
});

const ChordEventSchema = Type.Object({
  type: Type.Literal("chord"),
  positions: Type.Array(Type.Union([
    Type.Object({
      input: Type.Literal("position"),
      course: Type.Integer({ minimum: 1 }),
      fret: Type.Integer({ minimum: 0 }),
    }),
    Type.Object({
      input: Type.Literal("pitch"),
      pitch: Type.String(),
    }),
  ]), { minItems: 2 }),
  duration: Type.String(),
  tie: Type.Optional(Type.Boolean()),
});

const RestEventSchema = Type.Object({
  type: Type.Literal("rest"),
  duration: Type.String(),
  spacer: Type.Optional(Type.Boolean()),  // true → "s" (invisible), false/omitted → "r"
});

const EventSchema = Type.Union([
  PositionNoteSchema,
  PitchNoteSchema,
  ChordEventSchema,
  RestEventSchema,
]);

// --- Bar ---

const BarSchema = Type.Object({
  events: Type.Array(EventSchema, { minItems: 1 }),
  // Per-bar overrides (for mid-piece changes)
  key: Type.Optional(Type.Object({
    tonic: Type.String(),               // "d", "c", "g", "eb" (lowercase, flat = "b")
    mode: Type.String(),                // "major", "minor", "dorian", etc.
  })),
  time: Type.Optional(Type.String()),   // "3/4", "6/8", etc.
});

// --- Top-level params ---

const EngraveParamsSchema = Type.Object({
  instrument: Type.String({ minLength: 1 }),     // e.g. "baroque-lute-13"
  template: Type.String({ minLength: 1 }),        // e.g. "french-tab", "solo-tab"
  title: Type.Optional(Type.String()),
  composer: Type.Optional(Type.String()),
  key: Type.Optional(Type.Object({
    tonic: Type.String(),
    mode: Type.String(),
  })),
  time: Type.Optional(Type.String()),             // default "4/4"
  tempo: Type.Optional(Type.Integer()),           // BPM, default 72
  pickup: Type.Optional(Type.String()),           // partial duration: "4", "8" → \partial 4
  diapason_scheme: Type.Optional(Type.String()),  // e.g. "d_minor" — for lute-family

  bars: Type.Array(BarSchema, { minItems: 1 }),

  // For voice-and-tab template: vocal melody as separate stream
  melody: Type.Optional(Type.Object({
    bars: Type.Array(Type.Object({
      events: Type.Array(Type.Union([
        Type.Object({
          type: Type.Literal("note"),
          pitch: Type.String(),         // Scientific: "C5", "A4"
          duration: Type.String(),
          lyric: Type.Optional(Type.String()),
        }),
        Type.Object({
          type: Type.Literal("rest"),
          duration: Type.String(),
        }),
      ]), { minItems: 1 }),
    })),
  })),
});
```

### Schema design decisions

**Discriminated `input` field on notes.** Every note declares whether it provides a
`{course, fret}` position or a scientific pitch string. This is validated at parse
time — you cannot submit a note with neither, and the codegen path is unambiguous.

**Scientific notation for pitch input, not LilyPond notation.** The LLM already works
with scientific notation (it's what `tabulate` and `voicings` return via tonal.js).
Requiring LilyPond notation would reintroduce the exact syntax problem we're solving.
The server converts scientific → LilyPond internally.

**Structured key representation.** `{ tonic: "d", mode: "minor" }` instead of
`"d \\minor"`. The server converts to `\key d \minor`. This keeps LilyPond syntax
out of the LLM's JSON.

**Durations stay as LilyPond strings.** `"4"`, `"8"`, `"2."`, `"16"` are simple
enough that the LLM handles them reliably, and inventing an alternative (`"quarter"`,
`"eighth-dotted"`) adds complexity with no reliability gain.

**Single `events` array per bar.** Notes, chords, and rests are interleaved in temporal
order. No ambiguity about sequencing.

---

## New infrastructure: scientific → LilyPond pitch conversion

### The gap

`pitchAtPosition()` calls `soundingPitch()` → `transposeNote()` → `midiToNote()` →
`Note.fromMidi()` (tonal.js). This returns scientific notation: `"G4"`, `"Eb3"`,
`"A2"`. There is **no function in the codebase** that converts this to LilyPond
absolute pitch notation (`g'`, `ees`, `a,`).

The `diapasons` tool (`src/diapasons.ts`) has a partial implementation:
- `PITCH_TO_LILYPOND` map handles note names (C→c, Eb→ees, F#→fis, etc.)
- `buildLilypondSyntax()` does manual octave comma logic, but only for diapason
  courses and only for a narrow octave range (1-2 commas)

### Required: `scientificToLilyPond(note: string): string`

New function in `src/lib/pitch.ts`:

```typescript
/**
 * Convert scientific pitch notation to LilyPond absolute pitch.
 *
 * Examples:
 *   "C4"  → "c'"        "A2"  → "a,"       "Eb3" → "ees"
 *   "F#5" → "fis''"     "Bb1" → "bes,,"    "D6"  → "d'''"
 *
 * LilyPond octave encoding:
 *   C3 = c (no mark)     — middle octave
 *   C4 = c'              — one tick up
 *   C5 = c''             — two ticks up
 *   C2 = c,              — one comma down
 *   C1 = c,,             — two commas down
 *
 * Accidentals:
 *   # → "is"    (C# → cis, F# → fis)
 *   b → "es"    (Eb → ees, Bb → bes)
 *   Exception: "Eb" → "ees" (not "ebes"), "Ab" → "aes" (not "abes")
 *
 * Enharmonic spelling: preserves the spelling from the input.
 * If tonal.js returns "Eb3", we emit "ees"; if "D#3", we emit "dis".
 * The caller (or a future key-context-aware wrapper) is responsible for
 * choosing the correct enharmonic.
 */
export function scientificToLilyPond(note: string): string {
  const parsed = parsePitch(note);  // existing function
  const lyName = PITCH_TO_LILYPOND[parsed.letter + parsed.accidental]
    ?? (parsed.letter.toLowerCase() + accidentalToLy(parsed.accidental));
  const octaveMark = octaveToLyMark(parsed.octave);
  return lyName + octaveMark;
}

// Octave 3 = no mark, 4 = one ', 5 = two '', 2 = one ,, 1 = two ,,
function octaveToLyMark(octave: number): string {
  const offset = octave - 3;
  if (offset > 0) return "'".repeat(offset);
  if (offset < 0) return ",".repeat(-offset);
  return "";
}

function accidentalToLy(acc: string): string {
  return acc.replace(/#/g, "is").replace(/b/g, "es");
}
```

The `PITCH_TO_LILYPOND` map from `src/diapasons.ts` should be extracted to
`src/lib/pitch.ts` and shared. This avoids duplication and keeps pitch logic
centralized.

### Enharmonic spelling

`Note.fromMidi()` (tonal.js) always returns sharps. So MIDI 63 → `"Eb4"` will
actually come back as `"D#4"` → `"dis'"`. For key signatures with flats, this
produces wrong enharmonic spellings (e.g. D minor should use Bb not A#).

**v1 approach:** Accept the tonal.js spelling. The LilyPond output will be correct
*syntactically* even if enharmonically ugly. Tab instruments don't show accidentals
on the staff, so it only matters for the hidden MIDI staff and `tab-and-staff` notation.

**v2 enhancement:** Add a key-context-aware wrapper that respects the key signature
when choosing enharmonic spellings. This matters for `tab-and-staff` and any notation
template that shows a standard staff.

---

## Instrument → LilyPond variable registry

Each `.ily` file defines instrument-specific variable names. The `engrave` tool needs
a registry mapping instrument IDs to their LilyPond variables:

```typescript
type InstrumentLyVars = {
  include: string;                        // path to .ily file
  stringTunings: string;                  // LilyPond variable name
  tabFormat: string;                      // LilyPond variable name
  diapasons?: string;                     // only for instruments with diapason courses
};

const INSTRUMENT_LY_VARS: Record<string, InstrumentLyVars> = {
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
```

This registry is the single source of truth for how instrument IDs map to LilyPond
include paths and variable names. Adding a new instrument means adding one entry here
plus the `.ily` and `.yaml` files.

---

## `\with` block generation

The `\TabStaff \with { ... }` block differs based on whether the instrument has
diapason courses:

**Instruments WITH diapasons** (baroque lute, theorbo):
```lilypond
\new TabStaff \with {
  tablatureFormat = \luteTabFormat
  stringTunings = \luteStringTunings
  additionalBassStrings = \luteDiapasons
}
```

**Instruments WITHOUT diapasons** (classical guitar, renaissance lute, baroque guitar):
```lilypond
\new TabStaff \with {
  tablatureFormat = \classicalGuitarTabFormat
  stringTunings = \classicalGuitarStringTunings
}
```

The `diapasons` field in `INSTRUMENT_LY_VARS` controls which variant is emitted.

When a `diapason_scheme` override is provided in the input params (e.g. switching a
baroque lute from d-minor to a-minor accord), the tool generates an inline
`additionalBassStrings` definition using the same logic as the existing `diapasons`
tool (`buildLilypondSyntax()` in `src/diapasons.ts`) instead of referencing the
`.ily` file's default.

---

## Intermediate representation: LyTree

Rather than concatenating LilyPond strings directly, `engrave` builds a typed tree
of nodes that mirrors LilyPond's own containment hierarchy, then serializes the tree
in a single pass. This is the same architectural pattern as
[Abjad](https://github.com/Abjad/abjad) (Python, 21K commits, the only serious
LilyPond codegen library), adapted to TypeScript and scoped to what Vellum needs.

### Why a tree instead of string concatenation

For v1 single-voice tab, string concatenation would work. But the tree pays for itself
immediately in three ways:

1. **Testability.** You can assert on tree structure ("`score` has a `TabStaff` child
   with a `withBlock` containing `additionalBassStrings`") without parsing LilyPond
   strings back.

2. **Polyphony readiness (v2).** Multi-voice on a single tab staff requires nested
   `<< { \voiceOne ... } \\ { \voiceTwo ... } >>` contexts. With string building you
   manually track brace nesting and `\\` separators. With the tree you set
   `simultaneous: true` on a container and the serializer handles it.

3. **Template strategy composability.** Each template strategy (french-tab, solo-tab,
   etc.) builds its own subtree, and the top-level assembler composes them. Adding a
   new template means writing one function that returns a `LyContainer`, not threading
   string fragments through a shared builder.

### How Abjad's tree works (for reference)

Abjad models LilyPond as a tree of **components** with **indicators** attached:

```
Score (simultaneous=true)            → \new Score << ... >>
  └─ Staff "Polyphonic"             → \context Staff = "Polyphonic" { ... }
       └─ Container (simultaneous)  → << ... >>
            ├─ Voice "Upper"        → \context Voice = "Upper" { ... }
            │    ├─ Note d''4       → d''4
            │    └─ Note e''4       → e''4
            └─ Voice "Lower"        → \context Voice = "Lower" { ... }
                 ├─ Note d'4        → d'4
                 └─ Note c'4        → c'4
```

- **Leaves** are terminal: `Note`, `Chord`, `Rest` — they hold pitch + duration.
- **Containers** hold children: `Voice`, `Staff`, `Score`. A container with
  `simultaneous=true` emits `<< >>` instead of `{ }`.
- **Indicators** are metadata attached to nodes but not part of the tree:
  `TimeSignature`, `KeySignature`, `StartSlur`, `LilyPondLiteral`, etc. They affect
  the serialized output at the point where they're attached.

Serialization is a single recursive walk: emit context type + name, open brace,
emit indicators, recurse into children, close brace. The tree handles all nesting.

### Vellum's LyTree (TypeScript)

A minimal adaptation — no need to replicate Abjad's full generality. Vellum's tree
covers exactly what `engrave` needs to generate.

```typescript
// === Leaves ===

type LyNote = {
  type: "note";
  pitch: string;          // absolute LilyPond pitch: "d'", "ees", "a,,"
  duration: string;       // "4", "8", "2.", "16"
  indicators: LyIndicator[];
};

type LyChord = {
  type: "chord";
  pitches: string[];      // absolute LilyPond pitches
  duration: string;
  indicators: LyIndicator[];
};

type LyRest = {
  type: "rest";
  duration: string;
  spacer: boolean;        // true → "s" (invisible), false → "r"
  indicators: LyIndicator[];
};

type LyLeaf = LyNote | LyChord | LyRest;

// === Indicators ===
// Attached to leaves or containers. Emitted at the attachment point
// during serialization. Order-stable.

type LyIndicator =
  | { kind: "time_signature"; numerator: number; denominator: number }
  | { kind: "key_signature"; tonic: string; mode: string }
  | { kind: "partial"; duration: string }
  | { kind: "slur_start" }
  | { kind: "slur_end" }
  | { kind: "tie" }
  | { kind: "ornament"; name: "trill" | "mordent" | "turn" | "prall" }
  | { kind: "bar_check" }
  | { kind: "literal"; text: string; site: "before" | "after" };

// === Containers ===

type LyContextType =
  | "Score"
  | "Staff"
  | "TabStaff"
  | "RhythmicStaff"
  | "PianoStaff"
  | "ChoirStaff"
  | "Voice";

type LyContainer = {
  type: "container";
  context: LyContextType;
  name?: string;                         // → = "name" in output
  simultaneous: boolean;                 // true → << >>, false → { }
  children: (LyLeaf | LyContainer)[];
  indicators: LyIndicator[];            // before-opening-brace indicators
  withBlock?: Record<string, string>;    // → \with { key = value ... }
};

// === Top-level file ===

type LyFile = {
  version: string;                       // "2.24.0"
  includes: string[];                    // \include paths
  header?: Record<string, string>;       // \header { title = "...", composer = "..." }
  variables?: Record<string, string>;    // top-level variable definitions
  score: LyContainer;                    // the \score block
  layout: boolean;                       // emit \layout { }
  midi?: { tempo: number };              // emit \midi { \tempo 4 = N }
};
```

### Serializer

One recursive function, ~60 lines:

```typescript
function serializeFile(file: LyFile): string {
  const lines: string[] = [];

  lines.push(`\\version "${file.version}"`);
  for (const inc of file.includes) {
    lines.push(`\\include "${inc}"`);
  }

  if (file.header) {
    lines.push("\\header {");
    for (const [k, v] of Object.entries(file.header)) {
      lines.push(`  ${k} = "${v}"`);
    }
    lines.push("}");
  }

  if (file.variables) {
    for (const [name, body] of Object.entries(file.variables)) {
      lines.push(`${name} = { ${body} }`);
    }
  }

  lines.push("\\score {");
  lines.push(serializeContainer(file.score, 1));
  if (file.layout) lines.push("  \\layout { }");
  if (file.midi) lines.push(`  \\midi { \\tempo 4 = ${file.midi.tempo} }`);
  lines.push("}");

  return lines.join("\n") + "\n";
}

function serializeContainer(node: LyContainer, indent: number): string {
  const pad = "  ".repeat(indent);
  const open = node.simultaneous ? "<<" : "{";
  const close = node.simultaneous ? ">>" : "}";

  let out = `${pad}\\new ${node.context}`;
  if (node.name) out += ` = "${node.name}"`;

  if (node.withBlock && Object.keys(node.withBlock).length > 0) {
    out += ` \\with {\n`;
    for (const [k, v] of Object.entries(node.withBlock)) {
      out += `${pad}  ${k} = ${v}\n`;
    }
    out += `${pad}}`;
  }

  out += ` ${open}\n`;

  // Container-level indicators (overrides, removes, etc.)
  for (const ind of node.indicators) {
    out += `${pad}  ${serializeIndicator(ind)}\n`;
  }

  // Children
  for (const child of node.children) {
    if (child.type === "container") {
      out += serializeContainer(child, indent + 1) + "\n";
    } else {
      out += `${pad}  ${serializeLeaf(child)}\n`;
    }
  }

  out += `${pad}${close}`;
  return out;
}

function serializeLeaf(leaf: LyLeaf): string {
  // Emit "before" indicators
  let prefix = "";
  let suffix = "";
  for (const ind of leaf.indicators) {
    if (ind.kind === "literal" && ind.site === "before") {
      prefix += serializeIndicator(ind) + "\n  ";
    }
  }

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

  // Post-note indicators (tie, slur, ornament, bar check)
  for (const ind of leaf.indicators) {
    if (ind.kind === "tie") suffix += "~";
    if (ind.kind === "slur_start") suffix += "(";
    if (ind.kind === "slur_end") suffix += ")";
    if (ind.kind === "ornament") suffix += `\\${ind.name}`;
    if (ind.kind === "bar_check") suffix += " |";
    if (ind.kind === "time_signature")
      prefix += `\\time ${ind.numerator}/${ind.denominator}\n  `;
    if (ind.kind === "key_signature")
      prefix += `\\key ${ind.tonic} \\${ind.mode}\n  `;
    if (ind.kind === "partial")
      prefix += `\\partial ${ind.duration}\n  `;
  }

  return prefix + core + suffix;
}

function serializeIndicator(ind: LyIndicator): string {
  switch (ind.kind) {
    case "time_signature":
      return `\\time ${ind.numerator}/${ind.denominator}`;
    case "key_signature":
      return `\\key ${ind.tonic} \\${ind.mode}`;
    case "partial":
      return `\\partial ${ind.duration}`;
    case "literal":
      return ind.text;
    case "bar_check":
      return "|";
    default:
      return "";
  }
}
```

### How template strategies build trees

Each template strategy is a function that takes resolved music data and returns a
`LyContainer` (the score's root). The top-level assembler wraps it in `LyFile`.

**`solo-tab` strategy:**

```typescript
function buildSoloTab(
  events: ResolvedEvent[],  // pitches already in LilyPond notation
  vars: InstrumentLyVars,
  params: EngraveParams,
): LyContainer {
  const musicLeaves = eventsToLeaves(events);        // → LyLeaf[]
  const musicVoice = lyVoice("Music", musicLeaves);  // → LyContainer

  const tabStaff = lyContainer("TabStaff", {
    children: [musicVoice],
    withBlock: {
      tablatureFormat: `\\${vars.tabFormat}`,
      stringTunings: `\\${vars.stringTunings}`,
      ...(vars.diapasons
        ? { additionalBassStrings: `\\${vars.diapasons}` }
        : {}),
    },
  });

  // Hidden MIDI staff (same music, invisible)
  const midiStaff = lyContainer("Staff", {
    children: [lyVoice("MIDI", musicLeaves)],
    indicators: [
      { kind: "literal", text: '\\remove "Staff_symbol_engraver"', site: "before" },
      { kind: "literal", text: '\\remove "Clef_engraver"', site: "before" },
      { kind: "literal", text: "\\override NoteHead.transparent = ##t", site: "before" },
      { kind: "literal", text: "\\override Stem.transparent = ##t", site: "before" },
      // ... remaining transparency overrides
    ],
  });

  return lyContainer("Score", {
    simultaneous: true,
    children: [tabStaff, midiStaff],
  });
}
```

**`french-tab` strategy** — adds a `RhythmicStaff` built from the same events:

```typescript
function buildFrenchTab(
  events: ResolvedEvent[],
  vars: InstrumentLyVars,
  params: EngraveParams,
): LyContainer {
  const musicLeaves = eventsToLeaves(events);
  const rhythmLeaves = eventsToRhythmLeaves(events);  // durations → spacer/note

  const rhythmStaff = lyContainer("RhythmicStaff", {
    children: [lyVoice("Rhythm", rhythmLeaves)],
    indicators: [
      { kind: "literal", text: "\\override StaffSymbol.line-count = 0", site: "before" },
      { kind: "literal", text: '\\remove "Time_signature_engraver"', site: "before" },
      { kind: "literal", text: '\\remove "Clef_engraver"', site: "before" },
      { kind: "literal", text: "\\autoBeamOff", site: "before" },
    ],
  });

  const tabStaff = lyContainer("TabStaff", {
    children: [lyVoice("Music", musicLeaves)],
    withBlock: { /* same as solo-tab */ },
  });

  const midiStaff = buildHiddenMidiStaff(musicLeaves);

  return lyContainer("Score", {
    simultaneous: true,
    children: [rhythmStaff, tabStaff, midiStaff],
  });
}
```

### v2 polyphony via the tree

When multi-voice support lands, a polyphonic passage becomes:

```typescript
const upper = lyVoice("Upper", upperLeaves, {
  indicators: [{ kind: "literal", text: "\\voiceOne", site: "before" }],
});
const lower = lyVoice("Lower", lowerLeaves, {
  indicators: [{ kind: "literal", text: "\\voiceTwo", site: "before" }],
});

// simultaneous=true on the parent → emits << { upper } { lower } >>
const polyphonic = lyContainer("Staff", {
  simultaneous: true,
  children: [upper, lower],
});
```

No string-level `\\` separator management. The serializer produces:

```lilypond
\new Staff <<
    \context Voice = "Upper" {
        \voiceOne
        d''4 e''4 f''4 g''4
    }
    \context Voice = "Lower" {
        \voiceTwo
        d'4 c'4 b4 a4
    }
>>
```

### Cost

The LyTree types are ~50 lines. The serializer is ~80 lines. Helper constructors
(`lyVoice`, `lyContainer`, `eventsToLeaves`) are ~40 lines. Total: **~170 lines** of
infrastructure. This replaces what would otherwise be ~100 lines of string
concatenation in v1 but scales cleanly to v2 without a rewrite.

---

## Processing pipeline

```
LLM calls engrave(params)
  │
  ├─ 1. Resolve instrument
  │     → look up INSTRUMENT_LY_VARS[params.instrument]
  │     → load instrument YAML profile for validation data
  │     → reject with list of valid IDs if unknown
  │
  ├─ 2. Validate all events
  │     → for each position-mode note/chord:
  │         course in range [1, courseCount]?
  │         fret in range [0, maxFrets]?
  │         diapason courses have fret == 0?
  │         per-bar stretch within limits?
  │     → for each pitch-mode note/chord:
  │         pitch parseable by parsePitch()?
  │         pitch in instrument range?
  │     → for rests: duration is valid LilyPond duration?
  │     → reject with structured errors if invalid
  │
  ├─ 3. Resolve pitches → LyLeaf[]
  │     → position-mode: course + fret → soundingPitch() → scientificToLilyPond()
  │     → pitch-mode: scientificToLilyPond(pitch) directly
  │     → attach indicators (ties, slurs, ornaments, bar checks)
  │     → output: array of LyLeaf nodes with absolute LilyPond pitches
  │
  ├─ 4. Build LyTree
  │     → select template strategy (solo-tab, french-tab, etc.)
  │     → strategy function builds LyContainer tree from resolved leaves
  │     → strategy handles staff layout, \with blocks, hidden MIDI staff
  │     → wrap in LyFile with version, includes, header, variables
  │
  ├─ 5. Serialize → string
  │     → serializeFile(lyFile) walks tree recursively
  │     → output: complete, self-contained LilyPond source
  │
  ├─ 6. Return { source: string, warnings: string[] }
  │     → warnings for non-fatal issues (stretch, enharmonic spelling, etc.)
  │
  └─ LLM calls compile(source) → SVG
```

### Leaf construction from events

`eventsToLeaves(bars: ResolvedBar[]): LyLeaf[]` iterates bars and events in order:

| Event type | LyLeaf produced |
|---|---|
| note (position) | `LyNote { pitch: resolvedLyPitch, duration, indicators: [...] }` |
| note (pitch) | `LyNote { pitch: scientificToLilyPond(pitch), duration, indicators: [...] }` |
| chord | `LyChord { pitches: [resolvedLyPitch, ...], duration, indicators: [...] }` |
| rest | `LyRest { duration, spacer, indicators: [] }` |

Ties → `{ kind: "tie" }` indicator. Slur start → `{ kind: "slur_start" }`.
Ornaments → `{ kind: "ornament", name: "trill" }`. Bar boundaries →
`{ kind: "bar_check" }` on the last leaf of each bar.

If `pickup` is set, the first leaf gets a `{ kind: "partial", duration }` indicator.

Per-bar `key` and `time` overrides become indicators on the first leaf of that bar.

### Rhythm staff generation (french-tab only)

`eventsToRhythmLeaves(bars: ResolvedBar[]): LyLeaf[]` mirrors the music events:
- Notes and chords → `LyNote` with a fixed dummy pitch (rhythm only, stem + flag)
- Rests → `LyRest` with `spacer: true` (invisible on the rhythmic staff)
- Bar checks carry over

---

## Template codegen strategies

### v1 scope (tab instruments)

| Template ID | Staff layout | Input streams | Instrument constraint |
|---|---|---|---|
| `solo-tab` | TabStaff + hidden MIDI Staff | `bars` | Any tab instrument |
| `french-tab` | RhythmicStaff + TabStaff + hidden MIDI Staff | `bars` (rhythm auto-generated) | Any tab instrument |
| `tab-and-staff` | Staff (treble_8) + TabStaff | `bars` | Any tab instrument |
| `voice-and-tab` | Staff (voice+lyrics) + TabStaff | `melody` + `bars` | Any tab instrument |

### v2 scope (deferred — schema extensions needed)

| Template ID | What's missing |
|---|---|
| `grand-staff` | Needs `upper`/`lower` bar streams for PianoStaff split |
| `continuo` | Needs `figures` field for `\figuremode` |
| `satb` | Needs 4 independent voice streams (soprano, alto, tenor, bass) |
| `voice-and-piano` | Needs `melody` + `upper`/`lower` piano streams |

These templates require schema extensions that would complicate v1. The LLM can still
use them by writing raw LilyPond (the current workflow) until v2 adds support.

---

## What the LLM's workflow becomes

**Before (current):**
1. LLM calls `tabulate` to find positions
2. LLM calls `voicings` for chords
3. LLM *hand-writes* LilyPond source (error-prone)
4. LLM calls `compile` — fails
5. LLM reads error, rewrites LilyPond — fails again
6. Retry limit reached, reports failure

**After:**
1. LLM calls `tabulate` to find positions for each note
2. LLM calls `voicings` for chords
3. LLM calls `diapasons` if the piece needs a specific diapason scheme
4. LLM calls `engrave` with structured position/pitch data → validated LilyPond source
5. LLM calls `compile` with that source → success
6. If compile fails, the error is in the *music* (wrong notes, bad rhythm), not syntax

The compile retry guard remains as a safety net but should rarely fire.

---

## Error handling

| Error type | When | Response |
|---|---|---|
| Unknown instrument | ID not in `INSTRUMENT_LY_VARS` | Reject with list of valid IDs |
| Unknown template | Template ID not in v1 scope | Reject with list of valid IDs |
| Instrument/template mismatch | Non-tab instrument with tab template | Reject with explanation |
| Course out of range | course < 1 or > courseCount | Reject with valid range |
| Fret out of range | fret > maxFrets or diapason fretted | Reject with constraint detail |
| Stretch violation | Bar exceeds max stretch | **Warning** (non-fatal) |
| Unparseable pitch | Scientific notation doesn't parse | Reject with example format |
| Pitch out of range | Pitch below/above instrument range | Reject with instrument range |
| Missing events | Empty `events` array in a bar | Reject |
| Invalid duration | Not a valid LilyPond duration | Reject with examples |
| Melody/bars bar count mismatch | `melody.bars.length ≠ bars.length` | Reject |
| Missing melody for voice-and-tab | Template requires `melody` field | Reject |

---

## Implementation scope

### New files

| File | Purpose |
|---|---|
| `src/server/lib/ly-tree.ts` | LyTree types (`LyLeaf`, `LyContainer`, `LyFile`, `LyIndicator`) + serializer (`serializeFile`) |
| `src/server/lib/engrave.ts` | Core codegen engine — validation, pitch resolution, tree building |
| `src/server/lib/engrave-route.ts` | Express route handler for `/api/engrave` |
| `src/server/lib/ly-registry.ts` | `INSTRUMENT_LY_VARS` registry |
| `src/server/lib/template-strategies.ts` | `buildSoloTab`, `buildFrenchTab`, `buildTabAndStaff`, `buildVoiceAndTab` |
| `tests/ly-tree.test.ts` | Serializer unit tests (containers, leaves, indicators, nesting) |
| `tests/engrave.test.ts` | End-to-end codegen tests (input schema → LilyPond output) |
| `tests/ly-registry.test.ts` | Registry coverage |

### Modified files

| File | Change |
|---|---|
| `src/lib/pitch.ts` | Add `scientificToLilyPond()`, `octaveToLyMark()`, extract shared `PITCH_TO_LILYPOND` |
| `src/diapasons.ts` | Import `PITCH_TO_LILYPOND` from `src/lib/pitch.ts` instead of local copy |
| `src/server-tools.ts` | Add `engraveTool` via `createServerTool` hitting `/api/engrave` |
| `src/server/index.ts` | Mount `/api/engrave` route |
| `src/main.ts` | Add `engraveTool` to `vellumTools` array |
| `src/types.ts` | Add `EngraveParams`, `EngraveResult`, event schemas |
| `src/prompts.ts` | Update workflow to prefer `engrave` for tab instruments |
| `tests/pitch.test.ts` | Add `scientificToLilyPond()` test cases |

### NOT modified

- `src/tools.ts` — client-side tools only; `engrave` is server-side
- `templates/*.ly` — remain as-is for reference and for the LLM's manual workflow
- `instruments/*.ily` — remain as-is; variable names are read by the registry

---

## What this does NOT do

- **Arrangement intelligence.** The LLM still decides *what* to arrange and *how*.
  `engrave` is a codegen tool, not a composition tool.
- **Replace compile.** You still call `compile` on the output. `engrave` produces
  source; `compile` produces SVG/PDF/MIDI.
- **Replace existing tools.** `tabulate`, `voicings`, `diapasons`, etc. are still
  the LLM's way to explore the instrument. `engrave` consumes their output.
- **Replace manual LilyPond.** For v2 templates (grand-staff, continuo, satb,
  voice-and-piano) and advanced notation, the LLM still writes raw LilyPond.
  `engrave` covers the high-failure tab workflow.

---

## System prompt changes

The workflow section in `src/prompts.ts` becomes:

```
1. When given a source file, read it first
2. When given MusicXML, call `analyze` to get harmonic analysis
3. Use `tabulate` and `voicings` to find playable positions for each passage
4. For diapason instruments, call `diapasons` to confirm bass string tuning
5. Call `engrave` with structured position data to generate LilyPond source
6. Call `compile` with the generated source to produce SVG output
7. If compile fails, check whether the error is in your music data (fix events
   and re-engrave) or unexpected (report the generated source for debugging)
8. For templates not yet supported by `engrave` (grand-staff, continuo, satb,
   voice-and-piano), write LilyPond manually using existing templates as reference

IMPORTANT: Never write raw LilyPond syntax for tab instruments. Always use `engrave`.
```

---

## Open questions (carried forward)

1. **Should `engrave` also expose a `validate` tool?** The server already has
   `validate-route.ts` for LilyPond syntax checking, but it's not wired as a browser
   tool. Adding a `validate` tool alongside `engrave` gives the LLM a cheap pre-flight
   for manually-written LilyPond (v2 templates). **Recommendation:** Yes, add it as a
   separate tool in the same wave.

2. **Multi-voice polyphony within a single tab staff.** Baroque lute music often has
   2-3 independent voices on one tab staff. The current `events` array is single-voice.
   **Recommendation:** Defer to v2. The LyTree makes this straightforward — add a
   `voices` field at the bar level, build parallel `LyContainer` nodes with
   `simultaneous: true`, and the serializer handles the `<< { voice1 } { voice2 } >>`
   nesting automatically. No changes needed to the serializer itself.

3. **Enharmonic key context.** `Note.fromMidi()` returns sharps. For flat keys this
   produces correct-but-ugly spellings (`dis` instead of `ees` in D minor). Tab staves
   don't show accidentals so it's cosmetic for v1, but matters for `tab-and-staff`.
   **Recommendation:** Ship v1 with tonal.js defaults. Add key-aware enharmonic
   respelling in v2 (consult key signature to prefer flats/sharps).
