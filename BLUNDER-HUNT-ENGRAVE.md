# Blunder Hunt — TEMPLATE-FILL-SPEC.md

**Target:** `TEMPLATE-FILL-SPEC.md` in `~/workspace/vellum`
**Findings:** 4 Critical, 5 Significant, 4 Minor, 3 Omissions

---

## Critical

### C1. `pitchAtPosition()` returns scientific notation, not LilyPond notation — the spec's core pipeline has a missing conversion step

**Location:** "Position-to-pitch resolution" section

**Spec claims:**
> This is already implemented in `InstrumentModel.pitchAtPosition()` (via the tuning YAML data). The `engrave` tool reuses that — it resolves every `{course, fret}` pair to a **LilyPond pitch string**.

**Reality:** `pitchAtPosition()` calls `soundingPitch()` which calls `transposeNote()` → `midiToNote()` → `Note.fromMidi()` from tonal.js. This returns **scientific pitch notation** like `"G4"`, `"Eb3"`, `"A2"` — NOT LilyPond notation like `"g'"`, `"ees"`, `"a,"`.

There is **no function anywhere in the codebase** that converts scientific notation to LilyPond absolute pitch notation. I searched for `toLilyPond`, `noteToLily`, `lilyPondPitch`, `toLy`, `scientificToLily`, `fromLily`, `lyPitch` — zero results.

**Why it matters:** This is the single most important function `engrave` needs, and the spec handwaves it as "already implemented." In reality, a full scientific→LilyPond converter must be written from scratch, handling:
- Octave encoding (LilyPond: `c,,,` through `c''''` vs. scientific `C1` through `C7`)
- Accidental encoding (LilyPond: `ees`, `fis`, `bes` vs. scientific `Eb`, `F#`, `Bb`)
- Enharmonic choices (LilyPond `ees` vs `dis` matters for key signature context)

**Fix:** Add a `scientificToLilyPond(note: string): string` function to `src/lib/pitch.ts` as a required new dependency. Call it out as new work in the implementation scope — this is non-trivial, especially the enharmonic spelling logic.

---

### C2. Schema allows notes with NEITHER position NOR pitch — guaranteed runtime crashes

**Location:** Input schema, `bars[].notes[]`

**Spec defines:**
```typescript
course: Type.Optional(...)
fret: Type.Optional(...)
pitch: Type.Optional(...)
```

All three are optional. A note like `{ duration: "4" }` is schema-valid but meaningless — you can't resolve a pitch and you can't place it on the staff. Similarly, `{ course: 3, duration: "4" }` (fret missing) or `{ fret: 2, duration: "4" }` (course missing) are half-specified positions.

**Why it matters:** The LLM will inevitably produce malformed input. The schema must enforce that at least one complete input mode is present.

**Fix:** Use a TypeBox union or discriminated union:
```typescript
Type.Union([
  Type.Object({ course: Type.Integer(...), fret: Type.Integer(...), duration: ... }),
  Type.Object({ pitch: Type.String(...), duration: ... }),
])
```
Or at minimum, add a runtime validation step in the processing pipeline (step 2) that rejects notes with neither a complete position nor a pitch. The spec's error table lists "Missing duration" but not "missing pitch AND position."

---

### C3. Templates are hardcoded to specific instruments — `engrave` can't just swap `\include` paths

**Location:** "Processing pipeline" step 4: "inject include path (../instruments/{id}.ily)"

**Spec assumes** the tool can take any `(instrument, template)` pair and just swap the include path. In reality, each template hardcodes **instrument-specific variable names** in its `\with` blocks:

| Template | Variable names used |
|---|---|
| `french-tab.ly` | `\luteTabFormat`, `\luteStringTunings`, `\luteDiapasons` |
| `solo-tab.ly` | `\classicalGuitarTabFormat`, `\classicalGuitarStringTunings` |
| `tab-and-staff.ly` | `\classicalGuitarTabFormat`, `\classicalGuitarStringTunings` |
| `voice-and-tab.ly` | `\classicalGuitarTabFormat`, `\classicalGuitarStringTunings` |

Each `.ily` file defines its own prefixed variables:
- `baroque-lute-13.ily`: `luteStringTunings`, `luteDiapasons`, `luteTabFormat`
- `classical-guitar-6.ily`: `classicalGuitarStringTunings`, `classicalGuitarTabFormat`
- `theorbo-14.ily`: `theorboStringTunings`, `theorboDiapasons`, `theorboTabFormat`
- `renaissance-lute-6.ily`: `renaissanceLuteStringTunings`, `renaissanceLuteTabFormat`
- `baroque-guitar-5.ily`: `guitarStringTunings`, `guitarTabFormat`

So `engrave({instrument: "theorbo-14", template: "french-tab"})` would include `theorbo-14.ily` but the template body references `\luteStringTunings` and `\luteDiapasons` — which don't exist in that file. **LilyPond will error with "undefined variable."**

**Why it matters:** The spec's template mapping table implies arbitrary instrument × template combinations work. They don't. Either `engrave` must generate the entire LilyPond source from scratch (not fill templates), or the instrument→variable-name mapping must be explicit and the template `\with` blocks must be rewritten per instrument.

**Fix:** The `engrave` tool should NOT read and fill existing template `.ly` files. It should generate complete LilyPond source programmatically, using the template ID only to determine the *staff layout structure* and the instrument ID to determine the *variable names and include path*. This is more work than "inject include path" implies — it means building the entire `\score { << ... >> }` block in code.

---

### C4. `bars.notes` and `bars.chords` are disconnected — no way to express a real musical sequence

**Location:** Input schema

The schema has:
```typescript
bars: Type.Array(Type.Object({
  notes: Type.Array(...),      // sequential notes
  chords: Type.Optional(...)   // simultaneous chords
}))
```

But there's no way to express **temporal ordering between notes and chords within a bar**. Real music interleaves single notes and chords: `note chord note note chord`. With the current schema, you'd get all `notes` serialized first, then all `chords` appended — producing wrong rhythmic output.

The existing `Bar` type in `types.ts` is better designed: it has `notes: PassageNote[]` where each `PassageNote` has `pitch`, `duration`, `position`, and `voice`. There's no separate `chords` array — chords are expressed by simultaneous `PassageNote`s with the same beat position.

**Why it matters:** This is the core data structure. Getting it wrong means the generated LilyPond will have wrong note ordering in every bar that mixes single notes with chords.

**Fix:** Use a single sequential `events` array where each event is either a single note or a chord (group of simultaneous notes). Something like:
```typescript
events: Type.Array(Type.Union([
  NoteEvent,   // { type: "note", course?, fret?, pitch?, duration, ... }
  ChordEvent,  // { type: "chord", positions: [...], duration }
  RestEvent,   // { type: "rest", duration }
]))
```
This preserves temporal ordering naturally.

---

## Significant

### S1. Spec omits rests entirely

**Location:** Input schema

The schema has no concept of rests. Every real piece of music has rests. Without them, the LLM cannot express silence, pickup bars, or gaps between phrases. LilyPond needs explicit `r4`, `r8`, `s2` (spacer rest) etc.

**Why it matters:** Any piece longer than a few bars will need rests. This is a first-class musical concept, not an edge case.

**Fix:** Add a rest event type to the schema: `{ type: "rest", duration: string, spacer?: boolean }` where `spacer` produces `s` instead of `r` (spacer rests are invisible, used in rhythm staves).

---

### S2. The spec omits the `diapasons` tool from the existing toolchain and claims only 3 client-side tools

**Location:** "Problem" section and throughout

The spec repeatedly says the LLM has "`tabulate`, `voicings`, `check_playability`" as its position-finding tools. In reality, the codebase has **10 tools** in `vellumTools`:
1. `tabulate`
2. `voicings`
3. `check_playability`
4. `theory`
5. `compile`
6. `analyze`
7. `lint`
8. `transpose`
9. **`diapasons`** — specifically generates LilyPond diapason syntax for a key
10. **`fretboard`** — renders SVG fretboard diagrams

The `diapasons` tool (`src/diapasons.ts`) is particularly relevant because it already does some of what `engrave` proposes: it takes a key, looks up the diapason scheme, and **returns LilyPond syntax** for the bass strings. The spec should acknowledge this and explain whether `engrave` subsumes it or delegates to it.

**Fix:** Update the spec to reference all existing tools, particularly `diapasons` which has direct overlap with `engrave`'s diapason handling.

---

### S3. `\stringTuning` is NOT the same as `additionalBassStrings` — the spec conflates them

**Location:** Problem section: "Bad `\stringTuning` + `additionalBassStrings` interaction for tablature"

The spec mentions this as a current failure mode but doesn't recognize that `additionalBassStrings` is a **separate LilyPond property** from `stringTunings` — it's only used in `french-tab.ly` and specifically for diapasons. The `engrave` tool's template generation must know:

1. For instruments WITH diapasons: set both `stringTunings` (fretted courses) AND `additionalBassStrings` (diapasons) in the `\TabStaff \with` block
2. For instruments WITHOUT diapasons: set only `stringTunings`
3. Not all templates need `additionalBassStrings` — only tab templates for lute-family instruments

The spec's processing pipeline says nothing about generating the correct `\with` block. Step 4 just says "inject include path" — but the real work is assembling the `\TabStaff \with { ... }` block correctly per instrument.

**Fix:** Add explicit logic in the pipeline for generating `\with` blocks, distinguishing instruments with/without diapasons.

---

### S4. `solo-tab.ly` uses `\relative` — the spec claims "no \relative blocks" but that's what existing templates use

**Location:** "Position-to-pitch resolution" section

**Spec says:** "the generated source uses absolute pitches (no `\relative` blocks to get wrong)"

But the existing `solo-tab.ly` template uses `music = \relative c' { ... }`. If `engrave` generates absolute pitches and injects them into a template that wraps them in `\relative`, every pitch after the first will be wrong (LilyPond interprets them as relative intervals, not absolute positions).

This connects to C3 — the tool can't just "fill" existing templates. It must generate source that's self-consistent.

**Why it matters:** If the implementation takes the shortcut of reading template files and doing string substitution (as the spec implies), it will produce broken output for `solo-tab.ly` and `tab-and-staff.ly` which both use `\relative`.

**Fix:** Acknowledge that `engrave` must generate its own `music = { ... }` blocks using absolute pitches, which means NOT reusing the `\relative` wrappers from existing templates. The existing templates should be treated as reference for staff layout only, not as fill-in-the-blank forms.

---

### S5. Implementation scope puts `engrave` tool definition in wrong file

**Location:** "Implementation scope" → "Client side"

**Spec says:** Add `engraveTool` to `src/server-tools.ts`

This is correct — `engrave` needs server-side LilyPond generation and should be a server-backed tool like `compile`. But the spec also says to add it to `src/tools.ts` exports, which is the file for **client-side** tools (tabulate, voicings, check_playability, theory). These run in the browser without a server round-trip. `engrave` can't — it needs to read template files and instrument YAML from disk.

**Fix:** `engraveTool` should be defined via `createServerTool` in `src/server-tools.ts` (like `compileTool`), hitting a new `/api/engrave` endpoint. It should NOT be added to `src/tools.ts`. It should be imported into `src/main.ts` from `src/server-tools.ts` and added to `vellumTools`.

---

## Minor

### M1. Template mapping table lists templates that don't exist yet for some combinations

**Location:** Template mapping table

The table lists `continuo` as needing `bars + figures`, but the schema has no `figures` field. Similarly, `satb` needs "4× melody streams" but the schema only has a single `melody` field. `voice-and-piano` needs `melody + bars` but the `bars` would need to be split into `upper` and `lower` piano staves — the schema doesn't support this.

**Fix:** Either limit v1 to templates the schema can actually serve (`solo-tab`, `french-tab`, `tab-and-staff`, `voice-and-tab`), or expand the schema to cover the others.

---

### M2. The spec says `src/tools.ts` needs "add to exports" but `engrave` isn't a client-side tool

**Location:** Implementation scope → Client side

`src/tools.ts` already re-exports server tools (`compileTool`, `analyzeTool`, `lintTool`) via import from `server-tools.ts`, and then includes them in the `tools` array. The `vellumTools` array in `main.ts` is the one that actually matters for the agent. The spec's description is slightly misleading — it makes it sound like `tools.ts` needs modification, when really only `main.ts` and `server-tools.ts` do.

**Fix:** Clarify that `src/tools.ts` doesn't need changes. `main.ts` imports from `server-tools.ts` directly for the `vellumTools` array.

---

### M3. `key` field uses LilyPond syntax in JSON — fragile

**Location:** Input schema: `key: Type.Optional(Type.String())  // e.g. "d \\minor"`

Requiring the LLM to produce escaped LilyPond key syntax (`"d \\minor"`) inside JSON defeats the purpose of keeping LilyPond syntax away from the LLM.

**Fix:** Use a structured key representation: `{ tonic: "d", mode: "minor" }` or a simple string format like `"D minor"` that the server converts to `\key d \minor`.

---

### M4. Spec says "the LLM should never write LilyPond syntax directly for tab instruments" — but the `key` and `duration` fields ARE LilyPond syntax

**Location:** System prompt changes section + schema

Durations like `"4"`, `"8"`, `"2."`, `"16"` are LilyPond duration syntax. The `key` field is LilyPond syntax. Ornament values like `"trill"` map to `\trill`. The spec's principle that the LLM never writes LilyPond is partially violated by its own schema.

**Fix:** Either embrace that some LilyPond syntax leaks through (durations are fine — they're simple integers and dots) and narrow the claim, or define a non-LilyPond duration format (e.g., `"quarter"`, `"eighth"`, `"half-dotted"`). The former is more pragmatic.

---

## Omissions

### O1. No handling of pickup bars (anacrusis)

Pickup bars are extremely common in the repertoire — the piece starts mid-bar. LilyPond handles this with `\partial 4` etc. The schema has no way to express a partial first bar.

**Fix:** Add an optional `partial` or `pickup` field to the top-level params or to the first bar.

---

### O2. No handling of key/time signature changes mid-piece

The schema has `key` and `time` as top-level fields only. Many baroque pieces change meter mid-movement (e.g., a sarabande section followed by a gigue section). The spec assumes one key/time for the whole piece.

**Fix:** Allow optional `key` and `time` overrides at the bar level.

---

### O3. No discussion of where `engrave` runs — server vs. browser

The spec lists it under "Server side" implementation but doesn't discuss WHY it needs to be server-side. The existing client-side tools (`tabulate`, `voicings`) run in the browser using pre-loaded instrument profiles (`loadAllBrowserProfiles()`). If `engrave` only needs instrument YAML data and template knowledge (no filesystem access to read `.ly` files), it could theoretically run client-side too — which would be faster (no HTTP round-trip).

The answer is probably "server-side" because it needs to read template files and may benefit from having the actual `.ily` file contents available for include path resolution. But this should be stated explicitly with reasoning.

**Fix:** Add a brief justification for server-side placement, or consider whether the template structures could be embedded client-side.

---

## Overall Assessment

The spec correctly identifies the core problem (LLM writing raw LilyPond = failure) and proposes a sound architectural solution (structured data in, validated source out). The motivation, workflow comparison, and "what this does NOT do" sections are clear and well-reasoned.

However, the spec has a **fundamental gap between what it promises and what the codebase actually provides**. The two critical issues — no scientific→LilyPond pitch converter (C1) and templates being hardcoded to specific instruments (C3) — mean the implementation is substantially more work than the spec implies. The tool can't "fill templates" — it must **generate complete LilyPond source programmatically**, using templates only as structural reference.

The schema design (C2, C4, S1) needs a rework before implementation. The mixed notes/chords approach and missing rests would produce incorrect output for any non-trivial music.

These are all fixable, but the spec should be honest about the scope: this is a LilyPond codegen engine, not a template filler.
