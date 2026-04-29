# Generic Music Import and Arrangement Workflow — Hymnary/SATB Profile Spec

> Draft for iteration. Motivated by the Be Thou My Vision trace from
> `~/Downloads/vellum-debug-trace-2026-04-28T22-34-07-813Z.json`, but scoped as a
> general import-normalize-arrange pipeline. Hymns and SATB chorales should work
> exceptionally well; they are not the boundary of the design.

## Problem

Vellum can produce good historical plucked-instrument arrangements, but imported
source material exposes a workflow gap. A user may provide a hymn tune, chorale,
lead sheet, part-song, instrumental melody, tablature-adjacent notation, or other
score source as LilyPond, MusicXML, ABC, MEI, a PDF/image scan, MIDI, or pasted
text. The desired result is usually not “invent something from scratch”; it is
“understand what I gave you, preserve the important musical identity, and arrange
it in a requested way.”

For hymnary inputs, that usually means a faithful hymn setting where the tune,
words, harmony, and repeat structure remain recognizable, with idiomatic
accompaniment added around them. For non-hymn inputs, the same pipeline should
preserve the source’s declared lead line, voice parts, chord symbols, bass line,
texture, form, or other salient material according to the selected arrangement
profile.

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

The product should make the later successful workflow the default path for
hymn-like sources while building the underlying import/normalization layer as a
generic score-ingestion capability.

## Goals

- Import heterogeneous musical sources into one canonical, source-format-neutral
  representation before arranging.
- Normalize imported music with deterministic analysis so downstream arrangers see
  stable measures, voices, onsets, durations, lyrics, repeats, harmony, and source
  diagnostics regardless of whether the input was SATB, melody-only, lead-sheet,
  polyphonic, or tablature-like.
- Preserve the source’s primary musical identity by default: hymn melody for hymn
  profiles, explicit lead line for lead sheets, all named parts for chamber/part
  music, bass/chord structure for continuo-like sources, and so on.
- Make SATB/four-part hymn and chorale import a first-class, high-quality profile,
  not a hard-coded assumption.
- Extract lyrics, repeats, endings, metadata, part labels, chord symbols, voices,
  and harmony when available.
- Generate arrangements that combine faithful source material with idiomatic
  target-instrument writing.
- Reduce compile retries by validating musical structure before LilyPond codegen.
- Ask fewer, better questions: only prompt the user when source material is
  missing, ambiguous, or materially affects the arrangement plan.

## Non-goals

- Universal, lossless import of every notation construct in v1. The system should
  preserve musical structure and report unsupported constructs, not pretend to be
  a full interpreter for every format.
- Full optical music recognition accuracy in v1. PDF/image import is deferred to
  a later artifact-assisted pipeline unless the user first converts the source to
  MusicXML or supported text.
- Direct MuseScore `.mscz`, PDF, image, MIDI, or binary upload parsing in the text
  import tool. These require artifact metadata and storage that are outside the
  first text-import milestone.
- Perfect scholarly reconstruction of every hymn tune or source variant.
- Full preservation of source engraving/layout directives. The importer should
  preserve musical structure, not old page layout.
- Fully automatic copyright/licensing decisions. The UI can surface metadata and
  warnings, but the user remains responsible for source rights.

## V1 Scope Boundary

The first releasable workflow is deliberately text-first and should be named and
modeled generically even if hymn/chorale fixtures drive the MVP:

1. `music_import` accepts pasted text sources only: restricted LilyPond, MusicXML,
   ABC melody sources, MEI XML, or plain lyrics. `hymn_import` may remain as a
   profile-specific alias or prompt-level workflow name, but the underlying tool
   and IR should not bake in hymns or SATB.
2. MusicXML gets the most complete import path and is the preferred interchange
   for scans, MuseScore projects, DAWs/notation apps, and other sources that can
   export notation.
3. Restricted LilyPond support is useful for hymn snippets and common hymnary
   files, but it is not a general LilyPond interpreter.
4. PDF/image/`.mscz`/binary MIDI handling is represented as a future
   artifact-import path, not as a capability of the v1 pasted-text tool.
5. The v1 Definition of Done below assumes the necessary multi-staff/repeat
   engraving support has landed; until then the implementation may ship a narrower
   MVP for melody + simple tab only.

## Guiding Principle

Import is profile-agnostic; arrangement is profile-aware.

The import layer should answer: “What musical material is present, how reliable is
it, and how does it relate over time?” The arrangement layer should answer: “Given
this target instrument/style, which source material must be preserved, reduced,
reharmonized, transposed, or omitted?”

For hymn-like requests, the supplied melody is authoritative unless the user
explicitly requests a free instrumental paraphrase. For other profiles, the
preservation contract changes but should be explicit: preserve all named parts for
part music, preserve melody plus chord symbols for lead sheets, preserve bass and
figures/chords for continuo-like sources, preserve playable fret/course data for
tablature-like sources, etc.

Default hymn/chorale behavior should be:

1. Keep the tune as a vocal or lead staff.
2. Preserve or recover lyrics and repeat structure if present.
3. Preserve source harmony where useful, including SATB/four-part harmony, but
   reduce it idiomatically for the target instrument.
4. Add idiomatic accompaniment underneath or around the tune.
5. If transposition is needed for the target instrument, preserve contour and
   phrase identity.

## User Stories

### Story 1 — Generic pasted/imported score source

As a user, I paste or provide a supported notation source and say “arrange this for
baroque guitar,” “make this into a lute accompaniment,” or another target style.
Vellum detects the source format, imports all supported musical material into the
canonical IR, infers the likely musical profile, and proposes/executes an
arrangement plan without requiring me to first classify the source as SATB,
melody-only, lead-sheet, etc.

Acceptance criteria:

- Detects source format and likely profile(s), e.g. hymn/chorale, lead sheet,
  monophonic tune, part-song, instrumental multi-part score, or plain lyrics.
- Preserves explicit part names, voices, measures, onsets, durations, lyrics,
  chord symbols, repeats/endings, and metadata when present.
- Runs normalization/analysis before arrangement so the arranger receives a stable
  event graph rather than source-format-specific syntax.
- Reports unsupported or ambiguous constructs with diagnostics rather than silent
  guesses.

### Story 2 — Pasted restricted LilyPond hymn/SATB source

As a user, I paste a LilyPond hymn file that fits the documented v1 subset and
contains SATB voices and lyrics. I ask for a baroque guitar arrangement. Vellum
extracts the soprano/lead melody, supported lyrics, repeats, key/time, and
four-part harmony, then produces a voice + tab arrangement without requiring me to
explain the source format.

Acceptance criteria:

- Detects title, tune name when present, key, time signature, tempo when present.
- Extracts soprano/lead melody from a named or commented voice when possible.
- Extracts supported `\addlyrics` / `\lyricmode` stanzas.
- Preserves supported `\repeat volta` and `\alternative` structures.
- Derives harmony from SATB/four-part material without assuming every source has
  exactly SATB voices.
- Produces a compiled score with a lead staff and target-instrument accompaniment.

### Story 3 — Minimal melody-only LilyPond source

As a user, I paste a melody-only LilyPond source. Vellum preserves the melody and
creates an idiomatic accompaniment, while telling me that lyrics/repeats/harmony
were not present and can be added if I provide a fuller source.

Acceptance criteria:

- Does not replace or paraphrase the melody as the main deliverable.
- Keeps the lead line visible in a staff or clearly marked lead voice.
- Does not invent lyrics.
- Suggests better source material only if it would materially improve the result.

### Story 4 — MusicXML/MuseScore import

As a user, I provide MusicXML or an exported MuseScore file. Vellum imports parts,
voices, lyrics, repeats, chord symbols, and harmony, then arranges from the
canonical representation.

Acceptance criteria:

- Supports MusicXML as the preferred non-LilyPond interchange format.
- Preserves part names and lyric verses when present.
- Detects repeats/endings.
- Produces the same canonical music representation used by LilyPond import.

### Story 5 — PDF/image or binary score artifact (post-v1 artifact path)

As a user, I provide a scan, image, `.mscz`, MIDI, or other binary/source artifact.
Vellum runs an assisted import pipeline, reports uncertain notes/lyrics/repeats,
and asks targeted questions before arranging. In v1, this story is satisfied only
when the artifact has first been converted to MusicXML or another supported text
source.

Acceptance criteria for the later artifact path:

- Accepts an uploaded artifact reference with filename, MIME type, and source
  provenance metadata.
- Converts notation to MusicXML via a selected OMR backend where available.
- OCRs or imports lyrics through a selected OCR backend.
- Shows uncertainty rather than silently guessing.
- Can proceed with a melody-only result when lyric alignment is incomplete.

### Story 6 — Historical plucked-instrument accompaniment

As a user, I ask for a hymn, chorale, tune, lead sheet, or other imported source in
the style of de Visée, Corbetta, or another early plucked style. Vellum keeps the
profile-required source material and uses historically plausible accompaniment:
alfabeto for baroque guitar, campanella/brisé idioms where useful, and explicit
validated course/fret data.

Acceptance criteria:

- Uses `alfabeto_lookup` for 5-course baroque guitar strummed chord shapes.
- Reduces SATB/four-part harmony, chord symbols, or inferred harmony to chord
  candidates when source harmony exists.
- Validates playable positions before codegen.
- Avoids raw LilyPond hand-editing for tab-critical syntax.

## Source Types

| Source type             | v1 expectation                      | Notes                                                                                                   |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| MusicXML                | Highest-priority full import        | Preferred interchange; import parts, measures, lyrics, repeats/endings, chord symbols, then analyze.    |
| LilyPond notation       | Restricted text subset              | Header, key/time/tempo, simple variables, voices, repeats, alternatives, lyric blocks.                  |
| ABC                     | Melody-oriented text import         | Good for monophonic tunes; lyrics/chords support varies by dialect.                                     |
| MEI                     | XML investigation / limited import  | Useful for scholarly sources; map to the same IR only after fixture-based validation.                   |
| Plain text lyrics/text  | Companion source                    | Can be aligned to imported or user-provided melody where feasible; may also serve as source metadata.   |
| MuseScore `.mscz`       | Export to MusicXML first            | Direct unpack/import belongs to the later artifact path.                                                |
| PDF/image               | Convert to MusicXML outside v1 tool | Later artifact path requires OMR/OCR backend, confidence data, and user review UI.                      |
| MIDI                    | Future artifact/import path         | Useful for pitches/rhythm and analysis, poor for lyrics/repeats/notation details; normalize separately. |
| Existing tablature text | Future/limited import path          | Preserve explicit course/fret data where parseable; convert to the same event graph plus tab metadata.  |

## Canonical Music IR

All import paths should normalize into one intermediate representation. This keeps
arrangement logic independent of source format and avoids hard-coding SATB or
hymn-specific assumptions into the importer.

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
type MusicProfile =
  | "hymn"
  | "chorale"
  | "lead_sheet"
  | "monophonic_tune"
  | "part_song"
  | "instrumental_score"
  | "tablature"
  | "plain_lyrics"
  | "unknown";

type MusicDocument = {
  id: string;
  metadata: MusicMetadata;
  /** Ranked/inferred source profiles. These guide arrangement defaults but do not change the IR shape. */
  profiles: Array<{ profile: MusicProfile; confidence: number; evidence: string[] }>;
  sources: SourceArtifactRef[];
  musicalStructure: MusicalStructure;
  measures: ImportedMeasure[];
  parts: MusicPart[];
  lyrics: LyricStanza[];
  harmony?: HarmonyAnalysis;
  analysis?: NormalizedAnalysis;
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
  | "tablature_text"
  | "unknown";

type MusicMetadata = {
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

type MusicPart = {
  id: string;
  label?: string;
  role:
    | "lead"
    | "melody"
    | "soprano"
    | "alto"
    | "tenor"
    | "bass"
    | "inner_voice"
    | "accompaniment"
    | "continuo"
    | "chord_symbols"
    | "tablature"
    | "percussion"
    | "unknown";
  clef?: string;
  voices: MusicVoice[];
};

type MusicVoice = {
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
  | (EventBase & { type: "chord_symbol"; chordName: string; bass?: string })
  | (EventBase & { type: "direction"; text: string; placement?: "above" | "below" })
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
  source:
    | "musicxml"
    | "four_part_reduction"
    | "verticality_reduction"
    | "chord_symbol"
    | "figured_bass"
    | "generated";
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

type TextureKind =
  | "monophonic"
  | "melody_with_accompaniment"
  | "homophonic_four_part"
  | "homophonic_multi_part"
  | "polyphonic"
  | "lead_sheet"
  | "tablature"
  | "lyrics_only"
  | "unknown";

type NormalizedAnalysis = {
  texture?: { kind: TextureKind; confidence: number; evidence: string[] };
  inferredLead?: { partId: string; voiceId?: string; confidence: number; evidence: string[] };
  detectedVoiceRoles?: Array<{
    partId: string;
    voiceId?: string;
    role: MusicPart["role"];
    confidence: number;
  }>;
  phrases?: Array<{ startMeasureId: string; endMeasureId: string; confidence?: number }>;
  cadences?: Array<{ measureId: string; onset: Duration; kind?: string; confidence?: number }>;
  normalizationDiagnostics: SourceDiagnostic[];
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
- Events carry `onset` and `duration`, so simultaneous material is not collapsed
  unless a later profile-specific reduction step chooses to do so.
- SATB/four-part writing is represented as ordinary parts/voices plus inferred
  roles and texture analysis, not as a special top-level schema shape.
- Lyrics attach to stable note event IDs through `LyricSyllable.eventId` or
  `ImportedEvent.lyricAnchors`.
- Every importer and normalizer must emit diagnostics when it drops, rewrites, or
  cannot classify source constructs.

## Import Pipeline

### 1. Source detection

Detect source kind before asking the model to reason musically. Detection returns
ranked candidates rather than one brittle classification:

```typescript
type SourceDetection = {
  formatCandidates: Array<{ format: SourceFormat; confidence: number; evidence: string[] }>;
  profileCandidates: Array<{ profile: MusicProfile; confidence: number; evidence: string[] }>;
  selectedFormat?: SourceFormat;
  selectedProfiles?: MusicProfile[];
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

### 2. Parse to a raw canonical event graph

Parse source into `MusicDocument` without making arrangement decisions.

Parser strategy:

- **MusicXML**: implement a dedicated importer using music21 (or an equivalent XML
  traversal) that emits parts, measures, voices, lyrics, repeats/endings, chord
  symbols, directions, source locations, and diagnostics. This is separate from
  the existing `analyze` tool, which currently returns only key/time/voice
  ranges/chords.
- **LilyPond v1**: implement a restricted text importer. It may use a lexer/parser
  such as `python-ly` or a purpose-built tokenizer, but it must not pretend to be
  a full LilyPond interpreter.
- **ABC/MEI**: fixture-driven import only after the MusicXML/LilyPond paths define
  the IR invariants.

### 3. Normalize and analyze

Run a deterministic normalization/analysis pass after parsing and before any
arrangement. This is where music21 is especially useful: MusicXML/MEI/MIDI-like
sources can be loaded into a music21 stream for stable measures, offsets,
voices/parts, key estimation, chordification, Roman numeral analysis, ambitus,
texture, phrase/cadence hints, and lyric/chord-symbol extraction. LilyPond/ABC
imports may either feed equivalent structures into music21 or use local
normalizers that emit the same `NormalizedAnalysis` shape.

Normalization should:

- Quantize all event offsets/durations to rational quarter-note units.
- Preserve original source tokens/locations for diagnostics and round-tripping
  hints, but expose normalized pitch names, measures, onsets, and durations.
- Infer profiles/textures such as monophonic tune, hymn/chorale, SATB-like
  homophony, lead sheet, polyphonic score, tablature, or lyrics-only.
- Infer voice roles and lead candidates without assuming SATB; SATB detection is a
  strong special case of four labeled or register-ordered voices.
- Build or refine `HarmonyAnalysis` from chord symbols, figured bass, SATB/four-
  part verticalities, arbitrary multi-part verticalities, or generated
  harmonization.
- Flag lossy transformations, ambiguous voice splits, unquantized rhythms,
  unsupported tuplets/grace notes, and incomplete lyric alignment.

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

When unsupported constructs are encountered, `music_import` must return a warning
or error diagnostic rather than silently guessing.

### 4. Identify preservation targets

Lead-line detection is one preservation-target heuristic, not the whole problem.
The normalizer should infer candidates and the arrangement profile should decide
which material is authoritative.

Heuristics:

1. Explicit part/voice label contains `melody`, `lead`, `soprano`, `treble`,
   `voice`, or source-specific role metadata.
2. For hymn/chorale profiles with SATB-like texture, soprano is the default hymn
   melody.
3. For single-staff melody sources, the only pitched part is the lead.
4. For lead sheets, melody and chord symbols are both preservation targets.
5. For multi-part instrumental/part-song sources, all named parts are preservation
   targets unless the requested arrangement asks for reduction.
6. If ambiguous, ask one targeted question with candidate part names and evidence.

### 5. Validate source structure

Before arrangement:

- Every voice in every measure sums to the expected rational duration, accounting
  for pickups, alternatives, and explicit measure-duration overrides.
- Repeats and endings are internally consistent and reference existing measure IDs.
- Lyrics align to melody note event IDs well enough to engrave; otherwise store
  unaligned stanza text and warn.
- Transposition plan is explicit if target instrument cannot support source key or
  range.

### 6. Harmonize or reduce harmony

If SATB/four-part writing, arbitrary multi-part verticalities, chord symbols,
figured bass, or accompaniment parts exist:

- Derive chord spans per measure/onset from the imported normalized event graph,
  not from the lossy summary returned by the existing `analyze` endpoint.
- Preserve source harmony as a default, but simplify for instrument idiom.
- Provide chord names, pitch classes, Roman numerals, and confidence values to
  downstream arrangement tools.

If no harmony exists:

- Generate a conservative harmonization or chord plan appropriate to the inferred
  profile and requested style.
- Prefer simple diatonic primary-function chords for hymn/folk-tune defaults
  unless a style request implies richer harmony.

### 7. Arrange for target instrument

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

### 8. Engrave and compile

Use structured codegen rather than raw LilyPond generation when possible.

Minimum validation before `compile`:

- All generated voices/measures match the active time signature using rational
  duration arithmetic.
- All tab notes have explicit valid course/fret positions.
- All chord/alfabeto events are playable.
- Lyrics attach to a named voice.
- Repeats/endings compile to valid LilyPond structure.

## Tooling Changes

### New v1 text tool: `music_import`

Purpose: convert a pasted text source into `MusicDocument`. This tool does **not**
accept binary PDF/image/`.mscz` uploads in v1; those are handled by the later
artifact path below. A `hymn_import` alias can exist for compatibility, but it
should call the same generic importer with `expected_profile: "hymn"` or
`"chorale"`.

Suggested schema:

```typescript
const SourceFormatSchema = Type.Union([
  Type.Literal("auto"),
  Type.Literal("lilypond"),
  Type.Literal("musicxml"),
  Type.Literal("abc"),
  Type.Literal("mei"),
  Type.Literal("plain_text"),
  Type.Literal("tablature_text"),
]);

const MusicImportParamsSchema = Type.Object({
  source: Type.String({ minLength: 1 }),
  source_format: Type.Optional(SourceFormatSchema),
  source_name: Type.Optional(Type.String({ minLength: 1 })),
  mime_type: Type.Optional(Type.String({ minLength: 1 })),
  provenance: Type.Optional(Type.String({ minLength: 1 })),
  license: Type.Optional(Type.String({ minLength: 1 })),
  expected_profile: Type.Optional(
    Type.Union([
      Type.Literal("auto"),
      Type.Literal("hymn"),
      Type.Literal("chorale"),
      Type.Literal("lead_sheet"),
      Type.Literal("monophonic_tune"),
      Type.Literal("part_song"),
      Type.Literal("instrumental_score"),
      Type.Literal("tablature"),
      Type.Literal("plain_lyrics"),
    ])
  ),
  expected_content: Type.Optional(
    Type.Array(
      Type.Union([
        Type.Literal("lead"),
        Type.Literal("melody"),
        Type.Literal("lyrics"),
        Type.Literal("four_part_harmony"),
        Type.Literal("satb"),
        Type.Literal("parts"),
        Type.Literal("chord_symbols"),
        Type.Literal("figured_bass"),
        Type.Literal("tablature"),
        Type.Literal("repeats"),
      ])
    )
  ),
});
```

The tool response should include:

- Summary of detected content.
- Ranked source-format and profile-detection candidates with evidence.
- Canonical `MusicDocument` structured data.
- Diagnostics and confidence levels.
- Suggested next actions, e.g. “lyrics missing,” “repeat detected five times,”
  “lead part identified as soprano,” or “unsupported LilyPond macro encountered.”

### Future artifact import: `music_import_artifact`

Purpose: import PDFs, images, `.mscz`, or other binary artifacts after the product
has artifact storage and upload metadata. This is not part of the v1 text-import
DoD.

Sketch:

```typescript
const MusicImportArtifactParamsSchema = Type.Object({
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

### Planning tools or mode: generic arrangement pipeline

Avoid making `arrange_music` an opaque “do the whole creative task” tool. The
agent can make musical decisions, but deterministic sub-tools should expose the
mechanical steps:

- `derive_harmony(music)` — return chord spans and Roman numerals from imported
  events.
- `plan_transposition(music, target_instrument, policy)` — recommend preserve
  key vs instrument-friendly key with range/idiom evidence.
- `reduce_harmony_for_instrument(music, harmony, target_instrument, style)` —
  produce chord candidates and reduction diagnostics.
- `build_engrave_input(music, plan)` — convert the selected plan to structured
  `engrave` input.

If a single `arrange_music` mode remains, it should orchestrate these stages and
return all intermediate diagnostics, not just final LilyPond.

Suggested orchestration schema (where `MusicDocumentSchema` is the TypeBox schema
for the IR defined above):

```typescript
const ArrangeMusicParamsSchema = Type.Object({
  music: MusicDocumentSchema,
  target_instrument: Type.String(),
  style: Type.Optional(Type.String()),
  arrangement_profile: Type.Optional(
    Type.Union([
      Type.Literal("auto"),
      Type.Literal("hymn"),
      Type.Literal("chorale"),
      Type.Literal("lead_sheet"),
      Type.Literal("monophonic_tune"),
      Type.Literal("part_reduction"),
      Type.Literal("instrumental_arrangement"),
    ])
  ),
  preservation_targets: Type.Optional(Type.Array(Type.String())),
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
The generic import workflow requires a new score-level model before it can
faithfully emit multi-part sources, SATB/lyrics/repeats, lead-sheet reductions, or
voice + tab arrangements:

- Multiple staves in one score.
- Named parts and voices with stable IDs.
- Lyrics attached to named voices or event IDs.
- Chord symbols/directions attached to measures/onsets.
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

When detecting an imported music source, the system prompt should instruct the
model:

- Use `music_import` before arranging from pasted notation, lyrics, or other
  supported text sources.
- Treat import and arrangement as separate stages: first identify the source
  format/profile and normalize the event graph, then choose an arrangement plan.
- Preserve the profile-required source material as authoritative unless the user
  asks for a free paraphrase or reduction.
- For hymn/chorale profiles, preserve the supplied melody as authoritative and
  prefer voice/lead staff + accompaniment over solo paraphrase unless requested.
- Look for lyrics, chord symbols, repeats, endings, part labels, and harmony in
  the source; ask for them only if absent or ambiguous.
- If a source is melody-only, state that clearly and proceed conservatively.
- If the user provides PDF/image/`.mscz`, ask for/export MusicXML in v1 or route
  through the later artifact import path when available.
- Use structured `engrave` rather than raw LilyPond for final output whenever the
  required engraving features exist; otherwise clearly state the fallback.
- For baroque guitar, use `alfabeto_lookup` for strummed chord shapes.

Suggested short prompt section:

> Import workflow: If the user supplies notation, lyrics, or another music source,
> first import and normalize the source structure. Infer the profile (hymn,
> chorale, lead sheet, tune, multi-part score, etc.) and preserve the material that
> defines that profile. For hymn/chorale sources, preserve the lead melody by
> default, including lyrics, repeats, and SATB/four-part harmony if present. Arrange
> accompaniment around the preserved material unless the user asks for a free
> instrumental paraphrase.

## UX Flow

### Ideal pasted-source flow

1. User: “Arrange this for baroque guitar…” and pastes source.
2. Vellum calls `music_import`.
3. Vellum reports concise source summary:
   - “Detected hymn/chorale profile: title, Eb major, 3/4, soprano lead, SATB-like
     four-part harmony, 5 lyric stanzas, volta 5.”
   - Or: “Detected lead-sheet profile: melody, chord symbols, 32 measures, no
     lyrics.”
4. Vellum asks or confirms preservation/transposition policy when needed:
   - “The original key is Eb. For baroque guitar, G major is more idiomatic. Shall
     I transpose to G while preserving the melody contour, or preserve Eb?”
   - “I found two plausible lead voices. Use Soprano or Violin I as the lead?”
   - If the user already requested an instrument-friendly key/style, Vellum may
     proceed but must state the chosen transposition explicitly.
5. Vellum generates the requested arrangement from the normalized IR.
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

- Add generic import workflow language to `src/prompts.ts`, with hymn/chorale as a
  named high-priority profile.
- Define `MusicDocumentSchema`, `NormalizedAnalysisSchema`, profile detection, and
  all support schemas/types in TypeScript.
- Add rational duration utilities and engrave/source bar-duration validation before
  LilyPond codegen.
- Improve compile retry hints for tab string syntax and barcheck failures.
- Add tests from the Be Thou My Vision trace to ensure the prompt says to preserve
  hymn lead lines while still routing generic sources through `music_import`.

### Phase 2 — MusicXML generic import MVP

- Implement `music_import` for pasted MusicXML text.
- Extract metadata, parts, measures, voices, lyrics, repeats, alternatives, chord
  symbols, directions, and source locations into `MusicDocument`.
- Add a music21-backed or equivalent normalization pass that emits profiles,
  texture, voice-role candidates, lead candidates, key/range data, and initial
  harmony analysis.
- Keep the existing `analyze` tool as harmonic-analysis support, not as the import
  data model.
- Add fixtures from public-domain/simple hymn snippets, lead sheets, melody-only
  tunes, and existing MusicXML hymn-like fixtures.

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

- Derive chord spans from imported normalized event graphs using music21 or an
  equivalent deterministic reducer: chord symbols first when present, then
  SATB/four-part verticalities, then arbitrary multi-part verticalities, then
  generated harmonization as fallback.
- Map chord spans to alfabeto lookup candidates.
- Choose between exact source harmony and instrument-friendly reduction.
- Add tests for G/C/D/Am/Em hymn reductions on 5-course baroque guitar plus at
  least one non-SATB lead-sheet or melody-only reduction.

### Phase 6 — Non-text artifact imports

- Add artifact/session storage for imported `MusicDocument` values and source
  references.
- Add direct `.mscz` unpack/import if warranted, otherwise keep MusicXML export as
  the supported path.
- Investigate ABC and MEI completeness beyond simple text import.
- Select OMR/OCR backends for PDF/image import, document installation/runtime
  requirements, and implement note/lyric confidence diagnostics.

## Test Strategy

### Unit tests

- Ranked source-format and profile detection for LilyPond, MusicXML, ABC, MEI,
  plain lyrics, hymn/chorale, lead-sheet, melody-only, and multi-part fixtures.
- MusicXML metadata, parts, measures, voices, lyrics, chord symbols, directions,
  repeats, and alternative import.
- Normalization analysis: rational offsets, texture classification, lead
  candidates, SATB-like role inference, non-SATB multi-part role inference, key
  estimation, and chordification diagnostics.
- Restricted LilyPond header extraction and explicit rejection/diagnostics for
  unsupported constructs.
- Voice role detection from labels/comments.
- Repeat and alternative extraction into measure-referencing sections.
- Lyric stanza extraction and event-ID alignment.
- Rational duration arithmetic and bar-duration validation.
- Transposition/range planning with default `ask` policy.

### Integration tests

- MusicXML hymn with lyrics/repeats → complete `MusicDocument` shape.
- MusicXML lead sheet with chord symbols → complete `MusicDocument`, harmony from
  chord symbols, arrangement plan preserves melody + chords.
- Melody-only restricted LilyPond → voice + simple accompaniment; melody
  preserved.
- SATB restricted LilyPond with five verses/repeats → `MusicDocument`, then voice +
  baroque guitar tab after multi-staff engrave support exists.
- Non-SATB multi-part MusicXML fixture → normalized parts/roles, no forced SATB
  assumptions, explicit preservation/reduction plan.
- Baroque guitar alfabeto plan from SATB and non-SATB harmony reduction.
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

- Should `music_import` live server-side only, or should simple LilyPond parsing run
  in the browser?
- What persistence API should store imported `MusicDocument` artifacts for later
  editing and provenance review?
- Which LilyPond parser/tokenizer should be adopted for the restricted subset?
- What is the right UI for source uncertainty review?
- Which OMR/OCR backends are acceptable for the later artifact path, and how are
  their runtime dependencies installed?
- How should licensing/source provenance be displayed in generated arrangements
  and exports?

## Definition of Done for v1

Vellum can accept pasted MusicXML and documented restricted LilyPond sources,
import them through `music_import` into the canonical `MusicDocument`, run a
normalization/analysis pass, infer at least hymn/chorale, SATB-like, lead-sheet,
and melody-only profiles, and generate a historical plucked-instrument arrangement
that preserves the profile-required source material. The hymnary/SATB happy path
must include lead melody, lyrics, repeats, and four-part harmony; non-SATB fixtures
must prove the importer is not hard-coded to that shape. If multi-staff/repeat
`engrave` support has not yet landed, the shipped MVP must explicitly scope itself
to melody + simple tab and must not claim full generic import or hymnary v1
completion.
