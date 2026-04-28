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

- Full optical music recognition accuracy in v1. PDF/image import may initially be
  an assisted/offline pipeline.
- Perfect scholarly reconstruction of every hymn tune variant.
- Full preservation of source engraving/layout directives. The importer should
  preserve musical structure, not old page layout.
- Fully automatic copyright/licensing decisions. The UI can surface metadata and
  warnings, but the user remains responsible for source rights.

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

### Story 1 — Pasted LilyPond hymn source

As a user, I paste an existing LilyPond hymn file with SATB voices and lyrics. I
ask for a baroque guitar arrangement. Vellum extracts the soprano melody, all
lyrics, repeats, key/time, and harmony, then produces a voice + tab arrangement
without requiring me to explain the source format.

Acceptance criteria:

- Detects title, tune name when present, key, time signature, tempo when present.
- Extracts soprano/lead melody from a named or commented voice when possible.
- Extracts all `\addlyrics` / `\lyricmode` stanzas.
- Preserves `\repeat volta` and `\alternative` structures.
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

### Story 4 — PDF/image hymnary page

As a user, I provide a scan or image of a hymn page. Vellum runs an assisted import
pipeline, reports uncertain notes/lyrics/repeats, and asks targeted questions
before arranging.

Acceptance criteria:

- Converts notation to MusicXML via OMR where available.
- OCRs or imports lyrics.
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

| Source type            | v1 expectation              | Notes                                                                |
| ---------------------- | --------------------------- | -------------------------------------------------------------------- |
| LilyPond hymn source   | High priority               | Include old LilyPond 2.x idioms, comments, SATB, lyrics, repeats.    |
| MusicXML               | High priority               | Preferred interchange for non-LilyPond notation.                     |
| ABC                    | Medium priority             | Good for melody-only hymn/tune sources; lyrics support varies.       |
| MEI                    | Medium priority             | Useful for scholarly sources; can map into same IR.                  |
| MuseScore `.mscz`      | Via MusicXML export in v1   | Later direct unpack/import may be useful.                            |
| PDF/image              | Assisted pipeline initially | OMR/OCR with uncertainty review; not expected to be perfect in v1.   |
| MIDI                   | Low priority                | Useful for pitches/rhythm, poor for lyrics/repeats/notation details. |
| Plain text hymn lyrics | Companion source            | Can be aligned to imported or user-provided melody where feasible.   |

## Canonical Hymn IR

All import paths should normalize into one intermediate representation. This keeps
arrangement logic independent of source format.

```typescript
type HymnDocument = {
  metadata: HymnMetadata;
  musicalStructure: MusicalStructure;
  parts: HymnPart[];
  lyrics: LyricStanza[];
  harmony?: HarmonyAnalysis;
  sourceDiagnostics: SourceDiagnostic[];
};

type HymnMetadata = {
  title?: string;
  subtitle?: string;
  tuneName?: string;
  composer?: string;
  poet?: string;
  arranger?: string;
  source?: string;
  copyright?: string;
  originalKey?: KeySignature;
  preferredArrangementKey?: KeySignature;
  meter?: string;
  tempo?: TempoMark;
};

type MusicalStructure = {
  timeSignature: string;
  pickup?: Duration;
  sections: Section[];
};

type Section =
  | { type: "bars"; bars: BarRef[] }
  | { type: "repeat"; times: number; body: Section[]; alternatives?: Section[][] };

type HymnPart = {
  id: string;
  label?: string;
  role: "melody" | "soprano" | "alto" | "tenor" | "bass" | "accompaniment" | "unknown";
  clef?: string;
  bars: ImportedBar[];
};

type ImportedBar = {
  index: number;
  events: ImportedEvent[];
  duration: Duration;
  sourceLocation?: SourceLocation;
};

type ImportedEvent =
  | { type: "note"; pitch: string; duration: Duration; tie?: TieInfo; articulations?: string[] }
  | { type: "rest"; duration: Duration }
  | { type: "chord"; pitches: string[]; duration: Duration }
  | { type: "barline"; style?: string };

type LyricStanza = {
  stanza: string;
  text: string;
  syllables?: LyricSyllable[];
  alignedToPartId?: string;
  confidence?: number;
};

type HarmonyAnalysis = {
  key: KeySignature;
  chords: ChordSpan[];
  romanNumerals?: RomanNumeralSpan[];
};

type SourceDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  sourceLocation?: SourceLocation;
};
```

## Import Pipeline

### 1. Source detection

Detect source kind before asking the model to reason musically.

Signals:

- LilyPond: `\version`, `\score`, `\relative`, `\new Staff`, `\lyricmode`,
  `\addlyrics`.
- MusicXML: XML root such as `<score-partwise>`.
- ABC: `X:`, `T:`, `K:`, `M:` headers.
- MEI: `<mei>` root.
- Plain lyrics: stanza numbers, line breaks, no notation tokens.
- Image/PDF: MIME type or uploaded file extension.

### 2. Parse and normalize

Parse source into `HymnDocument`.

For LilyPond v1, support a pragmatic subset:

- `\header` fields.
- `\key`, `\time`, `\tempo`.
- `\new Staff`, `\new Voice`, comments near voices such as `% Soprano Part`.
- Absolute and relative pitches if feasible; otherwise use LilyPond/music21
  conversion as an intermediate.
- `\repeat volta N`.
- `\alternative`.
- `\addlyrics` and named `\lyricmode` blocks.
- Chords and simultaneous voices.
- Ignore layout/paper directives unless they affect musical structure.

### 3. Identify the lead line

Lead line heuristics:

1. Explicit part/voice label contains `melody`, `soprano`, `treble`, or `voice`.
2. For SATB, soprano is the default hymn melody.
3. For single-staff melody sources, the only pitched part is the lead.
4. If ambiguous, ask one targeted question with candidate part names.

### 4. Validate source structure

Before arrangement:

- Every bar duration matches meter, accounting for pickups and alternatives.
- Repeats and endings are internally consistent.
- Lyrics align to melody well enough to engrave; otherwise store unaligned stanza
  text and warn.
- Transposition plan is explicit if target instrument cannot support source key or
  range.

### 5. Harmonize or reduce harmony

If SATB or chord symbols exist:

- Derive chord spans per bar or beat.
- Preserve source harmony as a default, but simplify for instrument idiom.
- Provide chord names and pitch classes to downstream arrangement tools.

If no harmony exists:

- Generate a conservative hymn harmonization or chord plan.
- Prefer diatonic primary-function chords unless a style request implies richer
  harmony.

### 6. Arrange for target instrument

For 5-course baroque guitar:

- Prefer G, C, D, A minor, E minor, and related alfabeto-friendly keys when a
  transposition is acceptable.
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

- All generated bars match time signature.
- All tab notes have explicit valid course/fret positions.
- All chord/alfabeto events are playable.
- Lyrics attach to a named voice.
- Repeats/endings compile to valid LilyPond structure.

## Tooling Changes

### New tool: `hymn_import`

Purpose: convert a source string or uploaded artifact reference into `HymnDocument`.

Suggested schema:

```typescript
const HymnImportParamsSchema = Type.Object({
  source: Type.String({ minLength: 1 }),
  source_format: Type.Optional(
    Type.Union([
      Type.Literal("auto"),
      Type.Literal("lilypond"),
      Type.Literal("musicxml"),
      Type.Literal("abc"),
      Type.Literal("mei"),
      Type.Literal("plain_text"),
    ])
  ),
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
- Canonical `HymnDocument` structured data.
- Diagnostics and confidence levels.
- Suggested next actions, e.g. “lyrics missing,” “repeat detected five times,”
  “lead part identified as soprano.”

### New tool or mode: `arrange_hymn`

Purpose: take `HymnDocument` plus target style/instrument and produce structured
engrave input.

Suggested schema:

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

### Extend `engrave`

Add support for:

- Multiple staves in one score.
- Named voices.
- Lyrics attached to a named voice.
- Repeat/alternative sections.
- Voice + tab layouts.
- Bar-level validation per voice/part.
- Alfabeto events inside multi-staff contexts.

### Improve existing tools

- `tabulate`: accept LilyPond pitch spelling or provide clear conversion hints.
- `tabulate_many`: batch pitch/register lookup for an entire melody.
- `check_playability`: distinguish sequential passages from simultaneous chords;
  support onset times.
- `compile`: include targeted LilyPond repair hints for common syntax mistakes.
- `alfabeto_lookup`: keep both snake_case and current camelCase aliases if the
  agent/provider mixes naming conventions.

## Prompt / Agent Policy Changes

When detecting a hymn, the system prompt should instruct the model:

- Preserve supplied melody as authoritative.
- Prefer voice/lead staff + accompaniment over solo paraphrase unless requested.
- Look for lyrics and repeats in source; ask for them only if absent.
- If a source is melody-only, state that clearly and proceed conservatively.
- Use `hymn_import` before arranging from pasted hymnary source.
- Use structured `engrave` rather than raw LilyPond for final output.
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
4. Vellum chooses/asks transposition policy:
   - If obvious for instrument, “I’ll set this in G major for alfabeto-friendly
     baroque guitar while preserving the melody contour.”
5. Vellum generates voice + tab arrangement.
6. Vellum compiles and presents result.

### Ambiguous source flow

If lead part, repeats, or lyric alignment are ambiguous, ask one focused question:

- “I found two upper voices. Should the soprano be the lead melody?”
- “The image appears to contain three stanzas but OMR only aligned one. Engrave all
  stanzas as text below, or proceed with stanza 1 only?”
- “The original key is Eb. For baroque guitar, G major is more idiomatic. Preserve
  Eb or transpose to G?”

## Implementation Plan

### Phase 1 — Prompt and validation quick wins

- Add hymn workflow language to `src/prompts.ts`.
- Add engrave duration validation for every bar before emitting LilyPond.
- Improve compile retry hints for tab string syntax and barcheck failures.
- Add tests from the Be Thou My Vision trace to ensure the prompt says to preserve
  hymn lead lines.

### Phase 2 — LilyPond hymn import MVP

- Implement `hymn_import` for pasted LilyPond.
- Extract metadata, key/time, simple voices, repeats, alternatives, and lyrics.
- Normalize to `HymnDocument`.
- Add fixtures from public-domain/simple hymn snippets.
- Add regression fixture based on the trace shape: old LilyPond, SATB, five verses,
  fivefold repeat.

### Phase 3 — Multi-staff engrave support

- Extend `engrave` schema for named staves, voices, lyrics, and repeats.
- Support voice + tab output without raw LilyPond hand-writing.
- Add structured alfabeto events in multi-staff scores.
- Add compile integration tests.

### Phase 4 — Harmony reduction and alfabeto planning

- Derive chord spans from SATB or MusicXML using music21.
- Map chord spans to alfabeto lookup candidates.
- Choose between exact source harmony and instrument-friendly reduction.
- Add tests for G/C/D/Am/Em hymn reductions on 5-course baroque guitar.

### Phase 5 — Non-LilyPond imports

- MusicXML import through music21.
- ABC import where feasible.
- MEI import investigation.
- PDF/image assisted path via OMR/OCR, with confidence diagnostics.

## Test Strategy

### Unit tests

- Source detection for LilyPond, MusicXML, ABC, MEI, plain lyrics.
- LilyPond header extraction.
- Voice role detection from labels/comments.
- Repeat and alternative extraction.
- Lyric stanza extraction.
- Bar duration validation.
- Transposition/range planning.

### Integration tests

- Melody-only LilyPond → voice + simple accompaniment; melody preserved.
- SATB LilyPond with five verses/repeats → voice + baroque guitar tab.
- MusicXML hymn with lyrics → same `HymnDocument` shape.
- Baroque guitar alfabeto plan from SATB chord reduction.
- Compile succeeds without raw LilyPond repairs.

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
- Should Vellum store imported `HymnDocument` artifacts for later editing?
- How much of LilyPond should be parsed directly versus converted through
  LilyPond/MusicXML/music21?
- What is the right UI for source uncertainty review?
- Should transposition default to preserving the source key or target-instrument
  idiom when both are possible?
- How should we display licensing/source provenance in generated arrangements?

## Definition of Done for v1

Vellum can accept a pasted LilyPond hymnary source containing a lead melody,
lyrics, and repeat structure; import it into a canonical representation; generate a
voice + historical plucked-instrument accompaniment arrangement that preserves the
lead line; and compile successfully without manual LilyPond syntax repair.
