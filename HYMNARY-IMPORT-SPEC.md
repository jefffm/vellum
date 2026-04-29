# Hymnary Import and Arrangement Workflow — Spec

> Draft for iteration. Motivated by the Be Thou My Vision trace from
> `~/Downloads/vellum-debug-trace-2026-04-28T22-34-07-813Z.json`.

## Problem

Vellum can produce good historical plucked-instrument arrangements, but hymnary
inputs expose a workflow gap. A user may provide a hymn tune as LilyPond,
MusicXML, ABC, a PDF/image scan, or a pasted hymnary source. The desired result is
often not a free solo paraphrase; it is a faithful hymn setting where the tune,
words, and repeat structure remain recognizable, with idiomatic accompaniment
added around them.

In the trace, Vellum eventually produced the desired result only after several
prompts:

1. First attempt treated the source mostly as a solo baroque-guitar arrangement.
2. It simplified or displaced important melody notes to satisfy guitar idiom.
3. It burned tool calls on pitch/register discovery and LilyPond syntax repair.
4. The user then clarified that the lead line needed better preservation and asked
   about words/repeats.
5. A fuller hymnary LilyPond source was pasted, containing lyrics, repeats, and
   SATB parts.
6. Vellum then produced the desired voice + 5-course baroque guitar result.

The product should make the later successful workflow the default path for hymn
sources.

## Goals

- Preserve hymn melody by default.
- Extract lyrics, repeats, endings, metadata, and SATB harmony when available.
- Convert heterogeneous hymnary inputs into a canonical intermediate
  representation before arranging.
- Generate arrangements that combine a faithful vocal/lead staff with idiomatic
  historical accompaniment.
- Reduce compile retries by validating musical structure before LilyPond codegen.
- Ask fewer, better questions: only prompt the user when source material is
  missing or ambiguous.

## Non-goals

- Full optical music recognition accuracy in v1. PDF/image import is deferred to
  a later artifact-assisted pipeline unless the user first converts the source to
  MusicXML or supported text.
- Direct MuseScore `.mscz`, PDF, image, MIDI, or binary upload parsing in the text
  import tool. These require artifact metadata and storage that are outside the
  first text-import milestone.
- Perfect scholarly reconstruction of every hymn tune variant.
- Full preservation of source engraving/layout directives. The importer should
  preserve musical structure, not old page layout.
- Fully automatic copyright/licensing decisions. The UI can surface metadata and
  warnings, but the user remains responsible for source rights.

## V1 Scope Boundary

The first releasable hymn workflow is deliberately text-first:

1. `hymn_import` accepts pasted text sources only: restricted LilyPond, MusicXML,
   ABC melody sources, MEI XML, or plain lyrics.
2. MusicXML gets the most complete import path and is the preferred interchange
   for scans, MuseScore projects, and other notation applications.
3. Restricted LilyPond support is useful for hymn snippets and common hymnary
   files, but it is not a general LilyPond interpreter.
4. PDF/image/`.mscz` handling is represented as a future artifact-import path,
   not as a capability of the v1 text tool.
5. The v1 Definition of Done below assumes the necessary multi-staff/repeat
   engraving support has landed; until then the implementation may ship a narrower
   MVP for melody + simple tab only.

## Guiding Principle

For hymn-like requests, the supplied melody is authoritative unless the user
explicitly requests a free instrumental paraphrase.

Default behavior should be:

1. Keep the tune as a vocal or lead staff.
2. Preserve or recover lyrics and repeat structure if present.
3. Add idiomatic accompaniment underneath or around the tune.
4. If transposition is needed for the target instrument, preserve contour and
   phrase identity.

## User Stories

### Story 1 — Pasted restricted LilyPond hymn source

As a user, I paste a LilyPond hymn file that fits the documented v1 subset and
contains SATB voices and lyrics. I ask for a baroque guitar arrangement. Vellum
extracts the soprano melody, supported lyrics, repeats, key/time, and harmony,
then produces a voice + tab arrangement without requiring me to explain the source
format.

Acceptance criteria:

- Detects title, tune name when present, key, time signature, tempo when present.
- Extracts soprano/lead melody from a named or commented voice when possible.
- Extracts supported `\addlyrics` / `\lyricmode` stanzas.
- Preserves supported `\repeat volta` and `\alternative` structures.
- Produces a compiled score with a lead staff and target-instrument accompaniment.

### Story 2 — Minimal melody-only LilyPond source

As a user, I paste a melody-only LilyPond source. Vellum preserves the melody and
creates an idiomatic accompaniment, while telling me that lyrics/repeats were not
present and can be added if I provide a fuller hymnary source.

Acceptance criteria:

- Does not replace or paraphrase the melody as the main deliverable.
- Keeps the lead line visible in a staff or clearly marked lead voice.
- Does not invent lyrics.
- Suggests better source material only if it would materially improve the result.

### Story 3 — MusicXML/MuseScore import

As a user, I provide MusicXML or an exported MuseScore file. Vellum imports voices,
lyrics, repeats, and harmony, then arranges from the canonical representation.

Acceptance criteria:

- Supports MusicXML as the preferred non-LilyPond interchange format.
- Preserves part names and lyric verses when present.
- Detects repeats/endings.
- Produces the same canonical hymn representation used by LilyPond import.

### Story 4 — PDF/image hymnary page (post-v1 artifact path)

As a user, I provide a scan or image of a hymn page. Vellum runs an assisted import
pipeline, reports uncertain notes/lyrics/repeats, and asks targeted questions
before arranging. In v1, this story is satisfied only when the scan has first been
converted to MusicXML or another supported text source.

Acceptance criteria for the later artifact path:

- Accepts an uploaded artifact reference with filename, MIME type, and source
  provenance metadata.
- Converts notation to MusicXML via a selected OMR backend where available.
- OCRs or imports lyrics through a selected OCR backend.
- Shows uncertainty rather than silently guessing.
- Can proceed with a melody-only result when lyric alignment is incomplete.

### Story 5 — Historical plucked-instrument accompaniment

As a user, I ask for a hymn in the style of de Visée, Corbetta, or another early
plucked style. Vellum keeps the hymn tune and uses historically plausible
accompaniment: alfabeto for baroque guitar, campanella/brisé idioms where useful,
and explicit validated course/fret data.

Acceptance criteria:

- Uses `alfabeto_lookup` for 5-course baroque guitar strummed chord shapes.
- Reduces SATB harmony to chord candidates when source harmony exists.
- Validates playable positions before codegen.
- Avoids raw LilyPond hand-editing for tab-critical syntax.

## Source Types

| Source type            | v1 expectation                      | Notes                                                                                         |
| ---------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| MusicXML               | Highest-priority full import        | Preferred interchange; import parts, measures, lyrics, repeats/endings, then analyze harmony. |
| LilyPond hymn source   | Restricted text subset              | Header, key/time/tempo, simple variables, voices, repeats, alternatives, lyric blocks.        |
| ABC                    | Melody-oriented text import         | Good for melody-only hymn/tune sources; lyrics support varies.                                |
| MEI                    | XML investigation / limited import  | Useful for scholarly sources; map to the same IR only after fixture-based validation.         |
| Plain text hymn lyrics | Companion source                    | Can be aligned to imported or user-provided melody where feasible.                            |
| MuseScore `.mscz`      | Export to MusicXML first            | Direct unpack/import belongs to the later artifact path.                                      |
| PDF/image              | Convert to MusicXML outside v1 tool | Later artifact path requires OMR/OCR backend, confidence data, and user review UI.            |
| MIDI                   | Not a hymn v1 source                | Useful for pitches/rhythm, poor for lyrics/repeats/notation details.                          |

## Canonical Hymn IR

All import paths should normalize into one intermediate representation. This keeps
arrangement logic independent of source format.

```typescript
/** Rational duration measured in quarter-note units. Examples: 1/1 = quarter, 3/2 = dotted quarter. */
type Duration = {
  quarters: { numerator: number; denominator: number };
  sourceToken?: string; // e.g. LilyPond "4.", MusicXML divisions, ABC length
};

type KeySignature = { tonic: string; mode: "major" | "minor" | string };
type TempoMark = { bpm?: number; text?: string };
type SourceLocation = { sourceId: string; line?: number; column?: number; measure?: string };
type TieInfo = "start" | "stop" | "continue";

type HymnDocument = {
  id: string;
  metadata: HymnMetadata;
  sources: SourceArtifactRef[];
  musicalStructure: MusicalStructure;
  measures: ImportedMeasure[];
  parts: HymnPart[];
  lyrics: LyricStanza[];
  harmony?: HarmonyAnalysis;
  sourceDiagnostics: SourceDiagnostic[];
};

type SourceArtifactRef = {
  id: string;
  kind: "pasted_text" | "uploaded_artifact" | "derived_musicxml";
  format: SourceFormat;
  name?: string;
  mimeType?: string;
  uri?: string;
  provenance?: string;
  license?: string;
  confidence?: number;
};

type SourceFormat =
  | "lilypond"
  | "musicxml"
  | "abc"
  | "mei"
  | "plain_text"
  | "pdf"
  | "image"
  | "mscz"
  | "midi"
  | "unknown";

type HymnMetadata = {
  title?: string;
  subtitle?: string;
  tuneName?: string;
  composer?: string;
  poet?: string;
  arranger?: string;
  source?: string;
  sourceUrl?: string;
  copyright?: string;
  license?: string;
  originalKey?: KeySignature;
  preferredArrangementKey?: KeySignature;
  meter?: string;
  tempo?: TempoMark;
};

type MusicalStructure = {
  defaultTimeSignature?: string;
  pickup?: Duration;
  sections: Section[];
};

type MeasureRef = { measureId: string };

type Section =
  | { type: "measures"; measures: MeasureRef[] }
  | { type: "repeat"; times: number; body: Section[]; alternatives?: Section[][] };

type ImportedMeasure = {
  id: string;
  index: number;
  displayNumber?: string;
  timeSignature?: string;
  key?: KeySignature;
  duration: Duration;
  sourceLocation?: SourceLocation;
};

type HymnPart = {
  id: string;
  label?: string;
  role: "melody" | "soprano" | "alto" | "tenor" | "bass" | "accompaniment" | "unknown";
  clef?: string;
  voices: HymnVoice[];
};

type HymnVoice = {
  id: string;
  label?: string;
  events: ImportedEvent[];
};

type EventBase = {
  id: string;
  measureId: string;
  onset: Duration;
  duration: Duration;
  sourceLocation?: SourceLocation;
};

type ImportedEvent =
  | (EventBase & {
      type: "note";
      pitch: string;
      tie?: TieInfo;
      articulations?: string[];
      lyricAnchors?: LyricAnchor[];
    })
  | (EventBase & { type: "rest" })
  | (EventBase & { type: "chord"; pitches: string[]; tie?: TieInfo })
  | {
      id: string;
      measureId: string;
      type: "barline";
      style?: string;
      sourceLocation?: SourceLocation;
    };

type LyricStanza = {
  id: string;
  stanza: string;
  text: string;
  syllables?: LyricSyllable[];
  alignedToPartId?: string;
  alignedToVoiceId?: string;
  confidence?: number;
};

type LyricSyllable = {
  text: string;
  eventId?: string;
  kind?: "single" | "begin" | "middle" | "end" | "elision";
  extender?: boolean;
  hyphenAfter?: boolean;
  confidence?: number;
};

type LyricAnchor = {
  stanzaId: string;
  syllableIndex: number;
};

type HarmonyAnalysis = {
  key: KeySignature;
  chords: ChordSpan[];
  romanNumerals?: RomanNumeralSpan[];
};

type ChordSpan = {
  measureId: string;
  onset: Duration;
  duration: Duration;
  chordName: string;
  pitchClasses?: number[];
  source: "musicxml" | "satb_reduction" | "chord_symbol" | "generated";
  confidence?: number;
};

type RomanNumeralSpan = {
  measureId: string;
  onset: Duration;
  duration: Duration;
  figure: string;
  key: KeySignature;
  confidence?: number;
};

type SourceDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  sourceLocation?: SourceLocation;
};
```

Important invariants:

- `measures` are global; parts/voices point into those measures with `measureId`.
- Events carry `onset` and `duration`, so simultaneous SATB material is not
  collapsed unless a later harmony-reduction step chooses to do so.
- Lyrics attach to stable note event IDs through `LyricSyllable.eventId` or
  `ImportedEvent.lyricAnchors`.
- Every importer must emit diagnostics when it drops source constructs.

## Import Pipeline

### 1. Source detection

Detect source kind before asking the model to reason musically. Detection returns
ranked candidates rather than one brittle classification:

```typescript
type SourceDetection = {
  candidates: Array<{ format: SourceFormat; confidence: number; evidence: string[] }>;
  selected?: SourceFormat;
  diagnostics: SourceDiagnostic[];
};
```

Signals:

- LilyPond: `\version`, `\score`, `\relative`, `\new Staff`, `\lyricmode`,
  `\addlyrics`.
- MusicXML: XML root such as `<score-partwise>` or `<score-timewise>`.
- ABC: `X:`, `T:`, `K:`, `M:` headers; do not classify as plain lyrics if ABC
  headers are present.
- MEI: `<mei>` root.
- Plain lyrics: stanza numbers, line breaks, and no strong notation-format tokens.
- Image/PDF/`.mscz`: filename/MIME signals only in the later artifact-import path,
  not in the v1 pasted-text tool.

### 2. Parse and normalize

Parse source into `HymnDocument`.

Parser strategy:

- **MusicXML**: implement a dedicated importer using music21 (or an equivalent XML
  traversal) that emits parts, measures, lyrics, repeats/endings, and source
  diagnostics. This is separate from the existing `analyze` tool, which currently
  returns only key/time/voice ranges/chords.
- **LilyPond v1**: implement a restricted text importer. It may use a lexer/parser
  such as `python-ly` or a purpose-built tokenizer, but it must not pretend to be
  a full LilyPond interpreter.
- **ABC/MEI**: fixture-driven import only after the MusicXML/LilyPond paths define
  the IR invariants.

Supported LilyPond v1 subset:

- `\header` string fields.
- `\key`, `\time`, `\tempo` inside simple music expressions.
- Top-level music/lyric variables with literal identifiers.
- `\new Staff`, `\new Voice`, `\context Voice = "name"`, and comments near voices
  such as `% Soprano Part`.
- Absolute pitches and simple `\relative` blocks with deterministic octave
  resolution.
- Durations `1` through `64` with dots, ties, rests, chords, bar checks, and simple
  simultaneous voices.
- `\repeat volta N` and `\alternative` when their bodies are explicit music
  blocks.
- `\addlyrics` and named `\lyricmode` blocks.
- `\layout`, `\paper`, and engraving overrides are ignored with diagnostics.

Explicitly unsupported in LilyPond v1:

- Arbitrary Scheme, `\include` expansion, transposition macros, custom music
  functions, polymetric staves, tuplets, grace notes, figured bass, and any macro
  that changes musical content without an explicit literal body in the pasted
  source.

When unsupported constructs are encountered, `hymn_import` must return a warning
or error diagnostic rather than silently guessing.

### 3. Identify the lead line

Lead line heuristics:

1. Explicit part/voice label contains `melody`, `soprano`, `treble`, or `voice`.
2. For SATB, soprano is the default hymn melody.
3. For single-staff melody sources, the only pitched part is the lead.
4. If ambiguous, ask one targeted question with candidate part names.

### 4. Validate source structure

Before arrangement:

- Every voice in every measure sums to the expected rational duration, accounting
  for pickups, alternatives, and explicit measure-duration overrides.
- Repeats and endings are internally consistent and reference existing measure IDs.
- Lyrics align to melody note event IDs well enough to engrave; otherwise store
  unaligned stanza text and warn.
- Transposition plan is explicit if target instrument cannot support source key or
  range.

### 5. Harmonize or reduce harmony

If SATB or chord symbols exist:

- Derive chord spans per measure/onset from the imported event graph, not from the
  lossy summary returned by the existing `analyze` endpoint.
- Preserve source harmony as a default, but simplify for instrument idiom.
- Provide chord names and pitch classes to downstream arrangement tools.

If no harmony exists:

- Generate a conservative hymn harmonization or chord plan.
- Prefer diatonic primary-function chords unless a style request implies richer
  harmony.

### 6. Arrange for target instrument

For 5-course baroque guitar:

- Prefer G, C, D, A minor, E minor, and related alfabeto-friendly keys only when
  the user requested instrument-friendly transposition or explicitly accepts a
  proposed transposition.
- Use `alfabeto_lookup` for downbeat/structural strums.
- Use explicit course/fret positions for melodic fills.
- Preserve the lead line in a vocal/notation staff when the guitar cannot carry it
  faithfully without compromise.

For lute-family instruments:

- Use `tabulate`, `voicings`, `diapasons`, and playability validation.
- Favor brisé/campanella textures when requested.
- Preserve melody as a notated or top voice unless a solo paraphrase is requested.

### 7. Engrave and compile

Use structured codegen rather than raw LilyPond generation when possible.

Minimum validation before `compile`:

- All generated voices/measures match the active time signature using rational
  duration arithmetic.
- All tab notes have explicit valid course/fret positions.
- All chord/alfabeto events are playable.
- Lyrics attach to a named voice.
- Repeats/endings compile to valid LilyPond structure.

## Tooling Changes

### New v1 text tool: `hymn_import`

Purpose: convert a pasted text source into `HymnDocument`. This tool does **not**
accept binary PDF/image/`.mscz` uploads in v1; those are handled by the later
artifact path below.

Suggested schema:

```typescript
const SourceFormatSchema = Type.Union([
  Type.Literal("auto"),
  Type.Literal("lilypond"),
  Type.Literal("musicxml"),
  Type.Literal("abc"),
  Type.Literal("mei"),
  Type.Literal("plain_text"),
]);

const HymnImportParamsSchema = Type.Object({
  source: Type.String({ minLength: 1 }),
  source_format: Type.Optional(SourceFormatSchema),
  source_name: Type.Optional(Type.String({ minLength: 1 })),
  mime_type: Type.Optional(Type.String({ minLength: 1 })),
  provenance: Type.Optional(Type.String({ minLength: 1 })),
  license: Type.Optional(Type.String({ minLength: 1 })),
  expected_content: Type.Optional(
    Type.Array(
      Type.Union([
        Type.Literal("melody"),
        Type.Literal("lyrics"),
        Type.Literal("satb"),
        Type.Literal("chords"),
        Type.Literal("repeats"),
      ])
    )
  ),
});
```

The tool response should include:

- Summary of detected content.
- Ranked source-detection candidates and evidence.
- Canonical `HymnDocument` structured data.
- Diagnostics and confidence levels.
- Suggested next actions, e.g. “lyrics missing,” “repeat detected five times,”
  “lead part identified as soprano,” or “unsupported LilyPond macro encountered.”

### Future artifact import: `hymn_import_artifact`

Purpose: import PDFs, images, `.mscz`, or other binary artifacts after the product
has artifact storage and upload metadata. This is not part of the v1 text-import
DoD.

Sketch:

```typescript
const HymnImportArtifactParamsSchema = Type.Object({
  artifact_id: Type.String({ minLength: 1 }),
  filename: Type.String({ minLength: 1 }),
  mime_type: Type.String({ minLength: 1 }),
  source_format: Type.Optional(
    Type.Union([
      Type.Literal("pdf"),
      Type.Literal("image"),
      Type.Literal("mscz"),
      Type.Literal("midi"),
      Type.Literal("auto"),
    ])
  ),
  provenance: Type.Optional(Type.String({ minLength: 1 })),
  license: Type.Optional(Type.String({ minLength: 1 })),
});
```

This later path must select concrete OMR/OCR backends, store confidence by note and
lyric region, and expose an uncertainty-review UI before arranging.

### Planning tools or mode: hymn arrangement pipeline

Avoid making `arrange_hymn` an opaque “do the whole creative task” tool. The
agent can make musical decisions, but deterministic sub-tools should expose the
mechanical steps:

- `derive_harmony(hymn)` — return chord spans and Roman numerals from imported
  events.
- `plan_hymn_transposition(hymn, target_instrument, policy)` — recommend preserve
  key vs instrument-friendly key with range/idiom evidence.
- `reduce_harmony_for_instrument(hymn, harmony, target_instrument, style)` —
  produce chord candidates and reduction diagnostics.
- `build_hymn_engrave_input(hymn, plan)` — convert the selected plan to structured
  `engrave` input.

If a single `arrange_hymn` mode remains, it should orchestrate these stages and
return all intermediate diagnostics, not just final LilyPond.

Suggested orchestration schema (where `HymnDocumentSchema` is the TypeBox schema
for the IR defined above):

```typescript
const ArrangeHymnParamsSchema = Type.Object({
  hymn: HymnDocumentSchema,
  target_instrument: Type.String(),
  style: Type.Optional(Type.String()),
  preserve_lead_line: Type.Optional(Type.Boolean({ default: true })),
  include_voice_staff: Type.Optional(Type.Boolean({ default: true })),
  include_lyrics: Type.Optional(Type.Boolean({ default: true })),
  transpose_policy: Type.Optional(
    Type.Union([
      Type.Literal("preserve_key"),
      Type.Literal("instrument_friendly"),
      Type.Literal("ask"),
    ])
  ),
});
```

Default `transpose_policy` is `"ask"` unless the user already requested an
instrument-friendly arrangement or supplied a target key.

### Extend `engrave`

The current `engrave` shape is a flat tab bar list plus optional simple melody.
The hymn v1 DoD requires a new score-level model before it can faithfully emit
SATB/lyrics/repeats:

- Multiple staves in one score.
- Named parts and voices with stable IDs.
- Lyrics attached to named voices or event IDs.
- Repeat/alternative sections that reference measure IDs.
- Voice + tab layouts without forcing melody and tab to have identical bar arrays
  in every edge case.
- Bar-level duration validation per voice/part using rational durations.
- Alfabeto events inside multi-staff contexts.

Until that extension lands, implementation should advertise only a narrower MVP:
melody staff + tab bars with simple lyrics and no structural repeats.

### Improve existing tools

- `tabulate`: accept LilyPond pitch spelling or provide clear conversion hints.
- `tabulate_many`: batch pitch/register lookup for an entire melody.
- `check_playability`: distinguish sequential passages from simultaneous chords;
  support onset times.
- `compile`: include targeted LilyPond repair hints for common syntax mistakes.
- `alfabeto_lookup`: standardize model-facing names as snake_case, but normalize
  existing camelCase aliases (`chordName`, `pitchClasses`, `chartId`, `maxFret`,
  `includeBarreVariants`) at the tool boundary until callers migrate. Add tests
  for both forms.

## Prompt / Agent Policy Changes

When detecting a hymn, the system prompt should instruct the model:

- Preserve supplied melody as authoritative.
- Prefer voice/lead staff + accompaniment over solo paraphrase unless requested.
- Look for lyrics and repeats in source; ask for them only if absent.
- If a source is melody-only, state that clearly and proceed conservatively.
- Use `hymn_import` before arranging from pasted text hymnary sources.
- If the user provides PDF/image/`.mscz`, ask for/export MusicXML in v1 or route
  through the later artifact import path when available.
- Use structured `engrave` rather than raw LilyPond for final output whenever the
  required engraving features exist; otherwise clearly state the fallback.
- For baroque guitar, use `alfabeto_lookup` for strummed chord shapes.

Suggested short prompt section:

> Hymn workflow: If the user supplies a hymn tune or hymnary source, preserve the
> lead melody by default. First import the source structure, including lyrics,
> repeats, and SATB if present. Arrange accompaniment around the lead line. Do not
> replace important tune notes with accompaniment figures unless the user asks for
> a free instrumental paraphrase.

## UX Flow

### Ideal pasted-source flow

1. User: “Arrange this hymn for baroque guitar…” and pastes source.
2. Vellum calls `hymn_import`.
3. Vellum reports concise source summary:
   - “Found title, Eb major, 3/4, soprano melody, SATB, 5 lyric stanzas, volta 5.”
4. Vellum asks or confirms transposition policy:
   - “The original key is Eb. For baroque guitar, G major is more idiomatic. Shall
     I transpose to G while preserving the melody contour, or preserve Eb?”
   - If the user already requested an instrument-friendly key/style, Vellum may
     proceed but must state the chosen transposition explicitly.
5. Vellum generates voice + tab arrangement.
6. Vellum compiles and presents result.

### Ambiguous source flow

If lead part, repeats, or lyric alignment are ambiguous, ask one focused question:

- “I found two upper voices. Should the soprano be the lead melody?”
- “The imported MusicXML appears to contain three stanzas but only one aligned
  stanza. Engrave all stanzas as text below, or proceed with stanza 1 only?”
- “The original key is Eb. For baroque guitar, G major is more idiomatic. Preserve
  Eb or transpose to G?”

## Implementation Plan

### Phase 1 — Prompt, schema, and validation quick wins

- Add hymn workflow language to `src/prompts.ts`.
- Define `HymnDocumentSchema` and all support schemas/types in TypeScript.
- Add rational duration utilities and engrave/source bar-duration validation before
  LilyPond codegen.
- Improve compile retry hints for tab string syntax and barcheck failures.
- Add tests from the Be Thou My Vision trace to ensure the prompt says to preserve
  hymn lead lines.

### Phase 2 — MusicXML hymn import MVP

- Implement `hymn_import` for pasted MusicXML text.
- Extract metadata, parts, measures, voices, lyrics, repeats, alternatives, and
  source locations into `HymnDocument`.
- Keep the existing `analyze` tool as harmonic-analysis support, not as the import
  data model.
- Add fixtures from public-domain/simple hymn snippets and existing MusicXML
  hymn-like fixtures.

### Phase 3 — Restricted LilyPond text import

- Implement the documented LilyPond subset parser/tokenizer.
- Extract metadata, key/time, simple variables, voices, repeats, alternatives, and
  lyrics.
- Reject or warn on unsupported LilyPond constructs instead of guessing.
- Add regression fixture based on the trace shape: old LilyPond, SATB, five verses,
  fivefold repeat.

### Phase 4 — Multi-staff engrave support

- Extend `engrave` schema for named staves, voices, lyrics, repeats, alternatives,
  and rational bar-duration validation.
- Support voice + tab output without raw LilyPond hand-writing.
- Add structured alfabeto events in multi-staff scores.
- Add compile integration tests.

### Phase 5 — Harmony reduction and alfabeto planning

- Derive chord spans from imported SATB/MusicXML event graphs using music21 or an
  equivalent deterministic reducer.
- Map chord spans to alfabeto lookup candidates.
- Choose between exact source harmony and instrument-friendly reduction.
- Add tests for G/C/D/Am/Em hymn reductions on 5-course baroque guitar.

### Phase 6 — Non-text artifact imports

- Add artifact/session storage for imported `HymnDocument` values and source
  references.
- Add direct `.mscz` unpack/import if warranted, otherwise keep MusicXML export as
  the supported path.
- Investigate ABC and MEI completeness beyond simple text import.
- Select OMR/OCR backends for PDF/image import, document installation/runtime
  requirements, and implement note/lyric confidence diagnostics.

## Test Strategy

### Unit tests

- Ranked source detection for LilyPond, MusicXML, ABC, MEI, and plain lyrics.
- MusicXML metadata, parts, measures, voices, lyric, repeat, and alternative import.
- Restricted LilyPond header extraction and explicit rejection/diagnostics for
  unsupported constructs.
- Voice role detection from labels/comments.
- Repeat and alternative extraction into measure-referencing sections.
- Lyric stanza extraction and event-ID alignment.
- Rational duration arithmetic and bar-duration validation.
- Transposition/range planning with default `ask` policy.

### Integration tests

- MusicXML hymn with lyrics/repeats → complete `HymnDocument` shape.
- Melody-only restricted LilyPond → voice + simple accompaniment; melody
  preserved.
- SATB restricted LilyPond with five verses/repeats → `HymnDocument`, then voice +
  baroque guitar tab after multi-staff engrave support exists.
- Baroque guitar alfabeto plan from SATB chord reduction.
- Compile succeeds without raw LilyPond repairs for the supported engrave feature
  set.

### Regression tests from trace

- Initial melody-only source should not become a solo paraphrase that drops the
  opening `G G A G | E D D E` identity.
- Old LilyPond source with `\repeat volta 5` and five `\addlyrics` blocks should
  import as five stanzas and repeated structure.
- Generated tab syntax should use valid LilyPond note-duration-string order such as
  `g4\\3`, not `g\\3 4`.

## Open Questions

- Should `hymn_import` live server-side only, or should simple LilyPond parsing run
  in the browser?
- What persistence API should store imported `HymnDocument` artifacts for later
  editing and provenance review?
- Which LilyPond parser/tokenizer should be adopted for the restricted subset?
- What is the right UI for source uncertainty review?
- Which OMR/OCR backends are acceptable for the later artifact path, and how are
  their runtime dependencies installed?
- How should licensing/source provenance be displayed in generated arrangements
  and exports?

## Definition of Done for v1

Vellum can accept a pasted MusicXML hymnary source and a documented restricted
LilyPond hymnary source containing a lead melody, lyrics, and repeat structure;
import it into the canonical `HymnDocument`; generate a voice + historical
plucked-instrument accompaniment arrangement that preserves the lead line; and
compile successfully without manual LilyPond syntax repair. If multi-staff/repeat
`engrave` support has not yet landed, the shipped MVP must explicitly scope itself
to melody + simple tab and must not claim full hymnary v1 completion.
