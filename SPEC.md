# Vellum — ve*LLM*um

> The writing surface where the LLM writes music.

## Overview

Vellum is an LLM-powered music arrangement tool for historical plucked string instruments, classical guitar, piano, and voice. It renders properly formatted tablature and standard notation via LilyPond.

**The key insight:** The LLM handles musical intelligence — arrangement decisions, voice leading, idiomatic writing. The code provides **native domain-specific tools** that handle mechanical correctness, shrinking the LLM's error surface to just musical judgment. This is the agent harness thesis in practice: the harness shapes what the model can do, making it more effective within a domain than a general-purpose agent with bash access.

**The product is a pi-mono web app** — a custom web application built on [pi-mono](https://github.com/badlogic/pi-mono)'s agent toolkit, deployed as a NixOS module on servoid. The browser provides the conversational interface and a live tablature workbench. The server runs the agent, LilyPond, and custom tools.

---

## Problem Statement

Arranging music for historical lute-family instruments is hard:

1. **Tuning complexity** — Baroque lute has 13 courses in d-minor tuning with diapasons (bass courses that can't be stopped). Baroque guitar has 5 courses with re-entrant tuning. These aren't standard guitar tunings.
2. **Playability constraints** — Left-hand stretches, course spacing, open string availability, thumb-index alternation in the right hand. A mechanically correct transposition can be physically unplayable.
3. **Idiomatic writing** — Good lute music uses campanella (bell-like ringing across courses), brisé texture (broken chords), and specific ornament conventions that differ from guitar idiom.
4. **Notation** — Historical lute music uses tablature (French letter tab, Italian number tab), not standard notation. Modern tools handle this poorly.
5. **Instrument conversion** — Taking a guitar arrangement and putting it on lute (or vice versa) requires re-mapping every note to the new tuning, often requiring re-voicing entire passages.

---

## Architecture

```
Browser (any device)
┌─────────────────────────────────────────────────────┐
│  pi-web-ui ChatPanel                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │  AgentInterface       │  │  Tablature Workbench │ │
│  │  (conversation)       │  │                      │ │
│  │                       │  │  • SVG/PDF preview   │ │
│  │  "Arrange Bach        │  │  • OSMD score view   │ │
│  │   BWV 996 for         │  │  • Fretboard diagram │ │
│  │   baroque lute"       │  │  • MIDI playback     │ │
│  │                       │  │    (Web Audio API)   │ │
│  │  [tool calls visible  │  │  • Tab diff view     │ │
│  │   in chat stream]     │  │                      │ │
│  │                       │  │  [updates live as    │ │
│  │                       │  │   agent works]       │ │
│  └──────────────────────┘  └──────────────────────┘ │
└─────────────────┬───────────────────────────────────┘
                  │  HTTPS (mTLS via step-ca)
                  │
servoid (NixOS)   │
┌─────────────────┴───────────────────────────────────┐
│  Vellum server (Node.js)                             │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  pi-agent-core                                   │ │
│  │  Agent loop + custom tools + event hooks         │ │
│  │                                                   │ │
│  │  Tools:                                           │ │
│  │  • compile(file) → LilyPond → SVG/PDF            │ │
│  │  • tabulate(pitch, instrument) → positions        │ │
│  │  • voicings(chord, instrument) → ranked options   │ │
│  │  • check_playability(passage) → violations        │ │
│  │  • transpose(source, interval) → validated result │ │
│  │  • diapasons(key) → tuning scheme                 │ │
│  │  • fretboard(chord) → SVG diagram                │ │
│  │                                                   │ │
│  │  Hooks:                                           │ │
│  │  • Auto-compile on .ly write → preview update     │ │
│  │  • LilyPond stderr → structured error parsing     │ │
│  │  • Instrument profile auto-injection              │ │
│  └──────────────────────┬──────────────────────────┘ │
│                         │                             │
│  ┌──────────────────────┴──────────────────────────┐ │
│  │  LilyPond (Nix package, pinned version)          │ │
│  │  Called as subprocess by compile tool             │ │
│  │  Produces SVG / PDF / MIDI                       │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Traefik → vellum.aoeu.pw                            │
└─────────────────────────────────────────────────────┘
```

### Why Native Tools Beat Generic Agent + Bash

A general-purpose agent with bash access can technically run LilyPond. But:

| Generic agent | Vellum |
|---|---|
| LLM writes raw .ly hoping it compiles | LLM calls `voicings()` to get playable options, picks the best one |
| `bash lilypond foo.ly` → 200 lines of stderr | `compile()` → structured errors: "Bar 8: stretch violation on course 3" |
| LLM invents fret positions from training data | `tabulate()` returns all valid positions with idiomatic ranking |
| No verification until compile fails | `check_playability()` catches impossible fingerings before compilation |
| Human reads PDF to check quality | Browser shows live preview, fretboard diagrams, MIDI playback |

The LLM makes **musical decisions**. The tools handle **mechanical correctness**. That's the split that matters.


---

## Technology Stack

### pi-mono Integration

Vellum is built on [pi-mono](https://github.com/badlogic/pi-mono), an open-source AI agent toolkit:

| Package | Role in Vellum |
|---|---|
| `pi-agent-core` | Agent loop, tool execution, event system |
| `pi-web-ui` | Chat panel, artifacts panel (customized as tablature workbench) |
| `pi-ai` | Multi-provider LLM API (Anthropic, OpenAI, Google, etc.) |

Pi-mono provides the agent infrastructure. Vellum provides the domain-specific tools, instrument knowledge, and UI customizations that transform a generic agent into a music arrangement specialist.

### Server Stack

- **Node.js** ≥ 20 — runtime for pi-agent-core + Vellum server
- **LilyPond** ≥ 2.24 — music engraving, pinned as a Nix dependency
- **NixOS** — deployment target (servoid)
- **Traefik** — reverse proxy with mTLS via step-ca
- **systemd** — process management

### Browser Stack

- **pi-web-ui** — ChatPanel + AgentInterface web components
- **OSMD / VexFlow** — interactive score rendering (v2, for guitar/piano; lute tab via LilyPond SVG)
- **Web Audio API** — MIDI playback (v2)

---

## Custom Tools

Each tool is registered via pi's `registerTool()` API. The LLM calls them as native tool calls — not bash commands, not prompt instructions.

### compile

```typescript
compile({ file: string }) → {
  success: boolean,
  svg?: string,          // rendered tablature (inline preview)
  pdf?: string,          // path to PDF artifact
  midi?: string,         // path to MIDI artifact
  errors?: CompileError[] // structured: { bar, line, type, message }
}
```

Runs LilyPond as subprocess. On success, returns rendered artifacts. On failure, parses stderr into structured errors with bar numbers and line references. The auto-compile hook triggers this automatically on any `.ly` file write.

### tabulate

```typescript
tabulate({ pitch: string, instrument: string }) → TabPosition[] 
// e.g. tabulate("F4", "baroque-lute-13")
// → [{ course: 1, fret: 0, quality: "open" },
//    { course: 2, fret: 3, quality: "fretted" }]
```

Returns all valid course/fret positions for a pitch on the target instrument, ranked by idiomatic quality (open string > low fret > high fret). The LLM uses this to make informed placement decisions instead of guessing from training data.

### voicings

```typescript
voicings({ 
  notes: string[],        // e.g. ["F4", "A3", "D3"]
  instrument: string,
  max_stretch?: number    // max fret span, default 4
}) → Voicing[]
// → [{ positions: [...], stretch: 2, campanella_score: 0.8 },
//    { positions: [...], stretch: 3, campanella_score: 0.4 }]
```

Enumerates all playable voicings for a chord, ranked by stretch, idiomatic quality, and campanella potential. The LLM picks from real options instead of inventing positions.

### check_playability

```typescript
check_playability({
  bars: Bar[],            // structured passage (not .ly source)
  instrument: string
}) → PlayabilityReport {
  violations: Violation[], // { bar, type, description }
  difficulty: "beginner" | "intermediate" | "advanced",
  flagged_bars: number[]
}
```

Validates a passage against instrument-specific constraints: fret stretch, same-course conflicts, right-hand pattern feasibility. Catches impossible fingerings before compilation.

### transpose

```typescript
transpose({
  source: string,         // .ly file or passage
  interval: string,       // e.g. "m3 up", "P5 down"
  instrument: string
}) → {
  result: string,         // transposed .ly source
  out_of_range: Note[],   // notes that fell outside instrument range
  suggested_key?: string  // idiomatic key for target instrument
}
```

Transposes and validates against instrument range. Suggests idiomatic keys for the target instrument (e.g., D minor, F major, A minor for baroque lute).

### diapasons

```typescript
diapasons({ key: string }) → DiapasonTuning {
  courses: { course: number, pitch: string }[],
  notes: string  // human-readable: "Standard D minor: G-F-E-D-C-B-A"
}
```

Returns the conventional diapason tuning for a key center. Lutenists retune bass courses per piece — this tool provides the historically informed default.

### fretboard

```typescript
fretboard({
  positions: TabPosition[],
  instrument: string
}) → string // SVG diagram
```

Renders a visual SVG fretboard diagram showing finger positions. Displayed inline in the chat stream and in the tablature workbench.

---

## Event Hooks

### Auto-Compile

Every time a `.ly` file is written, the hook triggers `compile()` and pushes the rendered SVG to the tablature workbench. The human sees the arrangement update in real-time as the agent works.

### Error Parser

LilyPond stderr is cryptic Guile stack traces. The hook intercepts compilation failures and re-presents them as structured messages: "Bar 8, beat 3: voice collision on course 3 — two notes assigned to the same course simultaneously."

### Profile Auto-Injection

When the LLM's conversation mentions an instrument (e.g., "arrange for baroque lute"), the hook detects the reference and pre-loads the instrument profile into context. No manual "please load the profile" step.


---

## Instrument Profiles

Each supported instrument is defined as a YAML profile (for tool logic) and a LilyPond include file (.ily, for engraving). Profiles are loaded by the tools and injected into the LLM context via prompt templates.

### Baroque Lute (13-course, d-minor)

```yaml
id: baroque-lute-13
name: "13-Course Baroque Lute (d-minor)"
courses: 13
fretted_courses: 6        # courses 1-6 have frets
open_courses: 7           # courses 7-13 are diapasons (unfretted bass)
tuning:                    # highest to lowest
  - { course: 1, pitch: "f'",  note: "F4" }    # chanterelle
  - { course: 2, pitch: "d'",  note: "D4" }
  - { course: 3, pitch: "a",   note: "A3" }
  - { course: 4, pitch: "f",   note: "F3" }
  - { course: 5, pitch: "d",   note: "D3" }
  - { course: 6, pitch: "a,",  note: "A2" }
  # Diapasons (open bass strings, tuned diatonically — varies by key)
  - { course: 7,  pitch: "g,",  note: "G2" }
  - { course: 8,  pitch: "f,",  note: "F2" }
  - { course: 9,  pitch: "e,",  note: "E2" }
  - { course: 10, pitch: "d,",  note: "D2" }
  - { course: 11, pitch: "c,",  note: "C2" }
  - { course: 12, pitch: "b,,", note: "B1" }   # sometimes Bb
  - { course: 13, pitch: "a,,", note: "A1" }
frets: 8                   # typically 8 frets on the neck
action:                    # Jeff's lute specs
  treble_8th_fret: "2.4-2.8mm"
  bass_8th_fret: "3.5-4.5mm"
  bridge_spacing: "155mm"
constraints:
  - "Diapasons (courses 7-13) cannot be fretted — open only"
  - "Maximum left-hand stretch: ~4 frets on upper courses"
  - "Thumb plays courses 4-13; index-middle alternate on 1-3"
  - "Campanella encouraged — let notes ring across courses"
  - "Brisé (broken chord) texture is idiomatic, especially in French style"
  - "Right-hand thumb-under technique for bass runs"
notation: "french-letter"  # a=0, b=1, c=2, d=3, e=4, f=5, g=6, h=7
```

### Baroque Guitar (5-course, re-entrant)

```yaml
id: baroque-guitar-5
name: "5-Course Baroque Guitar"
courses: 5
fretted_courses: 5
open_courses: 0
tuning:                    # re-entrant: 4th and 5th courses have octave strings
  - { course: 1, pitch: "e'",  note: "E4" }
  - { course: 2, pitch: "b",   note: "B3" }
  - { course: 3, pitch: "g",   note: "G3" }
  - { course: 4, pitch: "d'",  note: "D4", re_entrant: true }   # bourdon + octave
  - { course: 5, pitch: "a",   note: "A3", re_entrant: true }   # bourdon + octave
frets: 8
constraints:
  - "Re-entrant tuning: courses 4-5 sound higher than expected"
  - "Strummed (rasgueado) and plucked (punteado) styles"
  - "Alfabeto chord notation for strummed passages"
  - "Campanella especially effective due to re-entrant tuning"
notation: "french-letter"  # or italian-number depending on source tradition
```

### Renaissance Lute (6-course, G)

```yaml
id: renaissance-lute-6
name: "6-Course Renaissance Lute (G tuning)"
courses: 6
fretted_courses: 6
open_courses: 0
tuning:
  - { course: 1, pitch: "g'",  note: "G4" }
  - { course: 2, pitch: "d'",  note: "D4" }
  - { course: 3, pitch: "a",   note: "A3" }
  - { course: 4, pitch: "f",   note: "F3" }
  - { course: 5, pitch: "c",   note: "C3" }
  - { course: 6, pitch: "g,",  note: "G2" }
frets: 8
constraints:
  - "All courses fretted"
  - "Thumb-index alternation standard"
  - "Simpler voice leading than baroque lute"
notation: "italian-number"  # or french-letter
```

### Theorbo (14-course)

```yaml
id: theorbo-14
name: "14-Course Theorbo"
courses: 14
fretted_courses: 6
open_courses: 8
tuning:
  # Fretted courses (1st and 2nd are an octave lower than on a standard lute)
  - { course: 1, pitch: "a",   note: "A3" }    # octave down from lute
  - { course: 2, pitch: "e",   note: "E3" }    # octave down from lute
  - { course: 3, pitch: "b",   note: "B3" }
  - { course: 4, pitch: "g",   note: "G3" }
  - { course: 5, pitch: "d",   note: "D3" }
  - { course: 6, pitch: "a,",  note: "A2" }
  # Diapasons
  - { course: 7,  pitch: "g,",  note: "G2" }
  - { course: 8,  pitch: "f,",  note: "F2" }
  - { course: 9,  pitch: "e,",  note: "E2" }
  - { course: 10, pitch: "d,",  note: "D2" }
  - { course: 11, pitch: "c,",  note: "C2" }
  - { course: 12, pitch: "b,,", note: "B1" }
  - { course: 13, pitch: "a,,", note: "A1" }
  - { course: 14, pitch: "g,,", note: "G1" }
frets: 8
constraints:
  - "Courses 1-2 tuned an octave lower than standard lute — melody often on 3rd course"
  - "Diapasons (7-14) unfretted"
  - "Very long scale length on diapasons — big instrument"
  - "Continuo instrument: often reading from figured bass"
notation: "french-letter"
```

### Classical Guitar (6-string)

```yaml
id: classical-guitar-6
name: "Classical Guitar"
type: fretted
strings: 6
fretted_strings: 6
open_strings: 0
tuning:
  - { string: 1, pitch: "e'",  note: "E4" }
  - { string: 2, pitch: "b",   note: "B3" }
  - { string: 3, pitch: "g",   note: "G3" }
  - { string: 4, pitch: "d",   note: "D3" }
  - { string: 5, pitch: "a,",  note: "A2" }
  - { string: 6, pitch: "e,",  note: "E2" }
frets: 19
constraints:
  - "Standard concert tuning"
  - "Maximum left-hand stretch: ~5 frets in lower positions, ~4 above 7th"
  - "Thumb plays strings 4-6; i-m-a on 1-3 (p-i-m-a notation)"
  - "Barre chords available — full or partial"
  - "Harmonics at frets 5, 7, 12"
  - "Can handle up to 4 independent voices simultaneously"
notation: "number-tab"  # standard guitar tablature (or standard notation)
```

### Piano

```yaml
id: piano
name: "Piano"
type: keyboard
range:
  lowest: "a,,,"   # A0
  highest: "c''''''" # C8
staves: 2           # treble + bass (grand staff)
constraints:
  - "Maximum stretch: ~10th (large hands) or octave (average)"
  - "Each hand can play up to 5 simultaneous notes"
  - "Sustain pedal extends note duration beyond finger release"
  - "Wide dynamic range — can mark pp to ff"
  - "No pitch bending, vibrato, or microtones"
  - "Hands are semi-independent — voice crossing between staves is idiomatic"
notation: "standard"  # grand staff, treble + bass clef
```

### Voice (SATB)

```yaml
id: voice-soprano
name: "Soprano Voice"
type: voice
range: { lowest: "c'", highest: "a''" }    # C4–A5
clef: treble
constraints:
  - "Monophonic — one note at a time"
  - "Must breathe — phrase lengths limited by breath capacity"
  - "Tessitura matters more than absolute range — avoid sitting at extremes"
  - "Text underlay: syllables aligned to notes"
  - "Melismatic or syllabic setting"
  - "Passaggio (register break) around E5-F5"
---
id: voice-alto
name: "Alto Voice"
range: { lowest: "f", highest: "d''" }     # F3–D5
clef: treble
---
id: voice-tenor
name: "Tenor Voice"
range: { lowest: "c", highest: "a'" }      # C3–A4
clef: "treble_8"
---
id: voice-bass
name: "Bass Voice"
range: { lowest: "e,", highest: "e'" }     # E2–E4
clef: bass
```

Voice profiles enable:
- **Song arrangements** — melody line with lute/guitar accompaniment
- **Continuo realization** — soprano line + figured bass → full texture
- **Transcription** — vocal part extracted from a choral work for study
- **Intabulation** — arranging vocal polyphony for solo lute (core Renaissance repertoire)

Additional profiles can be added: archlute, mandora, vihuela, 7-course Dowland-era lute, etc.


---

## Arrangement Engine — How the LLM Thinks

### Input Types

The LLM accepts multiple input formats:

1. **Natural language** — "Arrange Greensleeves for baroque lute" → LLM uses its knowledge of the melody
2. **MusicXML file** — parsed into pitches, durations, voices (v2, via import tool)
3. **LilyPond source** — read directly, modify
4. **Guitar tablature** — parsed, notes extracted, remapped via `tabulate()` tool
5. **Lead sheet** — melody + chord symbols → LLM creates full arrangement
6. **Figured bass** — bass line + figures → LLM realizes the harmony (historically authentic workflow)

### Arrangement Process

The LLM follows this process, using native tools for mechanical steps:

```
1. PITCH MAPPING (via tabulate tool)
   - For each note, call tabulate(pitch, instrument) to get valid positions
   - Score each option: open string preferred > low fret > high fret
   - Diapasons: exact pitch must match (call diapasons(key) for tuning)

2. VOICE LEADING (LLM musical judgment)
   - Minimize left-hand movement between chords
   - Prefer common tones held across beats
   - Respect voice independence (bass, tenor, soprano lines)
   - Drop notes that create impossible stretches — prefer musical coherence

3. PLAYABILITY CHECK (via check_playability tool)
   - Call check_playability(bars, instrument) to validate
   - Fix any violations before proceeding
   - Use voicings(chord, instrument) to find alternatives

4. IDIOM LAYER (LLM musical judgment)
   - Brisé: break chords into arpeggiated figures where appropriate
   - Campanella: route scalar passages across courses for ringing effect
   - Ornamentation: add period-appropriate ornaments
   - Style brisé specifically for French baroque lute

5. OUTPUT GENERATION
   - Generate LilyPond tablature notation
   - compile() auto-triggers via hook → preview updates live
   - If compilation errors, error-parser hook provides structured feedback
   - Iterate until clean
```

### Instrument Conversion

Converting between instruments (e.g., guitar → lute):

1. **Extract pitches** from source (tab position → absolute pitch via `tabulate()`)
2. **Re-map** each pitch to the target instrument using `tabulate(pitch, new_instrument)`
3. **Re-voice** passages using `voicings()` where original voicing doesn't fit
4. **Validate** via `check_playability()` on the new arrangement
5. **Adapt idiom** — LLM adjusts style (guitar arpeggios → brisé, strummed chords → thinning)

---

## LilyPond Integration

### Why LilyPond

- **Text-based input** — LLM generates it natively, no binary format issues
- **Tablature support** — `\new TabStaff` with custom tunings
- **Publication quality** — best open-source music engraving available
- **Programmable** — Scheme extensions for custom behavior
- **Free** — no licensing issues

### Server-Side Only

LilyPond is a C++ program depending on Guile (Scheme), Pango, Fontconfig, and GhostScript. It cannot run in the browser. All compilation happens server-side via the `compile` tool. The browser receives rendered SVG/PDF artifacts.

### French Letter Tablature

French letter tab (the native notation for baroque lute) requires:
1. A `TabStaff` with `tablatureFormat = #fret-letter-tablature-format` for the letters
2. A separate `RhythmicStaff` above for rhythm flags
3. Careful vertical alignment between the two staves

This is more complex than standard guitar tab and requires a dedicated template (`french-tab.ly`).

### Output Formats

LilyPond produces:
- **SVG** — primary output for browser display
- **PDF** — for download/print
- **MIDI** — for playback
- **PNG** — for static display

---

## Workflow Examples

### Example 1: Arrange from Knowledge

```
User: "Arrange Greensleeves for baroque lute. Simple version,
       mostly single line with bass notes."

Agent:
1. Profile-detect hook loads baroque-lute-13
2. Calls diapasons("A minor") → gets diapason tuning
3. Calls tabulate() for each melody note → gets course/fret positions
4. Writes .ly source using template
5. Auto-compile hook fires → preview appears in workbench
6. Calls check_playability() → no violations
7. Returns arrangement with PDF + .ly
```

### Example 2: Convert Guitar to Lute

```
User: [uploads guitar-tab.musicxml]
      "Convert this guitar arrangement to baroque lute."

Agent:
1. Parses MusicXML → extracts pitches + durations
2. For each note: tabulate(pitch, "baroque-lute-13") → lute positions
3. Calls voicings() for chords that need revoicing
4. Calls check_playability() → flags 3 bars with stretch violations
5. Revoices flagged bars using voicings(chord, max_stretch=3)
6. Writes .ly → auto-compile → preview
7. Adjusts idiom (guitar hammer-ons → lute mordents)
```

### Example 3: Iterative Editing

```
User: "The stretch in bar 8 is too wide. Can you revoice that chord?"

Agent:
1. Reads current .ly source, identifies bar 8
2. Extracts chord pitches → calls voicings(pitches, instrument, max_stretch=3)
3. Gets 4 alternatives ranked by quality
4. Picks the best, explains the trade-off ("dropped the tenor D3")
5. Edits .ly → auto-compile → workbench updates live
```

### Example 4: Instrument Swap

```
User: "Now give me this same piece for baroque guitar."

Agent:
1. Profile-detect hook loads baroque-guitar-5
2. For each note: tabulate(pitch, "baroque-guitar-5")
3. Drops bass lines that don't fit (5 courses vs 13)
4. Adjusts for re-entrant tuning on courses 4-5
5. check_playability() → clean
6. May suggest rasgueado for chordal passages
7. New .ly → auto-compile → new preview in workbench
```

---

## Quality Criteria

An arrangement is "good" if:

1. **Playable** — no impossible stretches, fingerings are natural (`check_playability` passes)
2. **Musical** — voice leading is smooth, bass line makes harmonic sense
3. **Idiomatic** — sounds like it belongs on the instrument, not like a mechanical transposition
4. **Complete** — no missing notes that the instrument could have handled
5. **Readable** — tablature is clear, rhythmic notation is correct, page layout is clean

The LLM should flag when it makes compromises (dropped notes, simplified voicing) and explain why.


---

## File Structure

```
vellum/
├── flake.nix                  # Nix flake: package + NixOS module export
├── SPEC.md                    # This file
├── OPEN-QUESTIONS.md          # Gap tracker
├── README.md
├── package.json               # Node.js project root
├── tsconfig.json
│
├── src/
│   ├── server.ts              # Express/Fastify server + pi-agent-core setup
│   ├── extension.ts           # Main pi extension: registers tools, hooks
│   ├── tools/
│   │   ├── compile.ts         # LilyPond compile + preview
│   │   ├── tabulate.ts        # Pitch → tab position mapping
│   │   ├── playability.ts     # Stretch/collision checking
│   │   ├── voicings.ts        # Chord voicing enumeration
│   │   ├── transpose.ts       # Transposition with range validation
│   │   ├── diapasons.ts       # Key-specific diapason tuning
│   │   └── fretboard.ts       # SVG fret diagram renderer
│   ├── hooks/
│   │   ├── auto-compile.ts    # Compile on .ly save
│   │   ├── error-parser.ts    # LilyPond stderr → structured errors
│   │   └── profile-detect.ts  # Auto-load instrument on mention
│   └── web/
│       ├── app.ts             # pi-web-ui ChatPanel + custom artifact panel
│       └── artifacts/
│           ├── tablature.ts   # SVG/PDF tablature renderer
│           ├── score.ts       # OSMD/VexFlow interactive score (v2)
│           ├── fretboard.ts   # Fretboard diagram component
│           └── player.ts      # MIDI playback via Web Audio (v2)
│
├── instruments/               # Instrument profile definitions
│   ├── baroque-lute-13.yaml
│   ├── baroque-lute-13.ily
│   ├── baroque-guitar-5.yaml
│   ├── baroque-guitar-5.ily
│   ├── classical-guitar-6.yaml
│   ├── classical-guitar-6.ily
│   ├── renaissance-lute-6.yaml
│   ├── renaissance-lute-6.ily
│   ├── theorbo-14.yaml
│   ├── theorbo-14.ily
│   ├── piano.yaml
│   ├── piano.ily
│   ├── voice-soprano.yaml
│   ├── voice-alto.yaml
│   ├── voice-tenor.yaml
│   ├── voice-bass.yaml
│   └── voice.ily
│
├── templates/                 # LilyPond boilerplate
│   ├── solo-tab.ly            # Tab only
│   ├── tab-and-staff.ly       # Tab + standard notation
│   ├── french-tab.ly          # French letter tab (RhythmicStaff + TabStaff)
│   ├── grand-staff.ly         # Piano (treble + bass)
│   ├── voice-and-tab.ly       # Voice line + lute/guitar tab
│   ├── voice-and-piano.ly     # Voice line + piano accompaniment
│   ├── satb.ly                # Four-part choral
│   └── continuo.ly            # Figured bass realization
│
├── prompts/                   # pi prompt templates
│   ├── arrange.md             # /arrange <piece> for <instrument>
│   ├── convert.md             # /convert <source> to <target>
│   ├── revoice.md             # /revoice bar <N>
│   └── compile.md             # /compile — force recompile
│
├── arrangements/              # Completed arrangements
│   └── .../
└── sources/                   # Input files (MusicXML, reference scores)
    └── .../
```

---

## NixOS Deployment

Vellum's `flake.nix` exports a package and a NixOS module. The `.nix` repo (`jefffm/.nix`) consumes it:

```nix
# In flake.nix inputs:
inputs.vellum.url = "github:jefffm/vellum";

# In hosts/servoid/default.nix:
services.vellum = {
  enable = true;
  port = 3XXX;                          # pick an available port
  domain = "vellum.aoeu.pw";
  apiKeyFile = "/run/secrets/anthropic-key";  # sops-nix or agenix
};
```

The NixOS module provides:
- **systemd service** — runs the Node.js server
- **LilyPond dependency** — pinned, reproducible, no version drift
- **Traefik integration** — reverse proxy with mTLS via step-ca
- **Secrets management** — API keys never in the repo

This follows the same deployment pattern as the existing A2A adapter and Hermes agent on servoid.

---

## v1 Scope

- [ ] Set up pi-mono packages (`pi-agent-core`, `pi-web-ui`, `pi-ai`)
- [ ] Install LilyPond via Nix
- [ ] Register custom tools: `compile`, `tabulate`, `voicings`, `check_playability`, `transpose`, `diapasons`, `fretboard`
- [ ] Create instrument profiles (YAML + .ily) for all 7 instruments
- [ ] Create LilyPond templates (solo-tab, tab+staff, french-tab, grand-staff, voice+tab, voice+piano, satb, continuo)
- [ ] Wire up pi-web-ui ChatPanel with custom tablature artifact renderer (SVG/PDF inline)
- [ ] Auto-compile hook (write .ly → compile → preview updates)
- [ ] LilyPond error parser hook
- [ ] Profile auto-injection hook
- [ ] Create prompt templates (`/arrange`, `/convert`, `/revoice`, `/compile`)
- [ ] Arrange one test piece end-to-end (BWV 996 Bourrée or Dowland "Flow My Tears")
- [ ] Create `flake.nix` with package + NixOS module
- [ ] Deploy on servoid

## v2 Scope

- [ ] OSMD/VexFlow interactive score rendering in browser (guitar/piano; lute via LilyPond SVG)
- [ ] MIDI playback via Web Audio API
- [ ] Bar-click interaction (click a bar → agent knows which bar to revoice)
- [ ] MusicXML import tool (JS parser or Rust/WASM crate)
- [ ] Fretboard visualization with position overlay
- [ ] Arrangement library with session management
- [ ] Session branching for "try it this way" workflows
- [ ] Figured bass realization workflow
- [ ] French letter tablature refinement (test LilyPond's `fret-letter-tablature-format`)
- [ ] Batch conversion (whole suites at once)
- [ ] Ornamentation table (configurable per style period)


---

## Technology Decision

### Chosen: pi-mono Web App + NixOS Deployment

The core realization: **v1 needs almost no code for the musical intelligence.** The LLM does the arrangement. LilyPond does the engraving. What v1 needs is:
1. A conversational interface with visual feedback
2. Native tools that handle mechanical correctness
3. A way to run LilyPond server-side

Pi-mono provides #1 out of the box (`pi-web-ui` ChatPanel + artifacts panel, `pi-agent-core` agent loop). Vellum provides #2 (custom tools registered via pi's extension API). NixOS provides #3 (LilyPond pinned as a Nix dependency, deployed on servoid).

**Why pi-mono over building from scratch:**
- Pi already provides the agent loop, tool registration, event system, web UI, and session persistence
- Building these from scratch would replicate what pi does, but worse
- Pi's extension system (`registerTool`, `on()` events) is the exact API surface Vellum needs
- Pi's SDK mode allows embedding in a custom server — not locked into the terminal
- The `pi-web-ui` artifacts panel supports custom artifact types (SVG tablature, fretboard diagrams)

### Alternative Considered: Python + music21

**Strengths:**
- **music21** is the only comprehensive music theory library in any language — MusicXML, MIDI, LilyPond export, voice leading, counterpoint rules
- Fastest prototype path for parsing and transposition

**Weaknesses:**
- Runtime type errors in production
- Dependency management fragility (pip, venv conflicts)
- music21 doesn't help with the hard part (instrument-specific tab math, playability)
- No web UI path without a second language
- The LLM handles what music21 is best at (musical analysis, arrangement decisions)

**Verdict:** music21 solves the wrong problem. Its strength is musical analysis; Vellum's hard problem is mechanical correctness for exotic instruments. The LLM replaces music21's analytical capabilities; custom tools replace its computational ones.

### Alternative Considered: Custom TypeScript + Rust/WASM

**Strengths:**
- Maximum control, clean TypeScript/Rust boundary
- Rust for correctness-critical math, TypeScript for everything else

**Weaknesses:**
- Rebuilds the agent loop, web UI, session management from scratch
- The WASM bridge adds complexity (serde serialization, not zero-cost typed bindings)
- LilyPond can't run in the browser anyway — WASM doesn't help with the main pipeline
- Validates LilyPond source in Rust? No Rust LilyPond parser exists
- Double-rewrite problem: TypeScript placeholder math → Rust rewrite

**Verdict:** Over-engineered. Pi-mono provides the infrastructure; custom tools provide the domain expertise. The Rust/WASM engine could be revisited in v2 if tool performance becomes a bottleneck (e.g., batch voicing enumeration), but v1 doesn't need it.

### Alternative Considered: Pure Prompt Engineering (Skill file + bash)

**Strengths:**
- Zero code — just a SKILL.md with instrument profiles and `bash lilypond`
- Works today in any agent harness

**Weaknesses:**
- LLM invents fret positions from training data (error-prone)
- Compilation errors come back as raw stderr (LLM wastes tokens parsing Guile stack traces)
- No visual feedback — human downloads PDF to check
- No playability validation until a human reads the tab
- Every arrangement burns tokens on mechanical correctness the tools should handle

**Verdict:** This is where the project started. Native tools are the difference between "an agent that can sort of do this" and "an agent that's genuinely good at this."

---

## References

- [pi-mono](https://github.com/badlogic/pi-mono) — AI agent toolkit (coding agent CLI, unified LLM API, TUI & web UI libraries)
- [pi-web-ui](https://www.npmjs.com/package/@mariozechner/pi-web-ui) — Reusable web UI components for AI chat interfaces
- [LilyPond Tablature docs](https://lilypond.org/doc/v2.24/Documentation/notation/common-notation-for-fretted-strings)
- [Fronimo](https://sites.google.com/view/fronimo/home) — reference for historical tablature rendering
- [MEI Tablature encoding](https://music-encoding.org/guidelines/v5/content/tablature.html) — future interchange format
- [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) — browser-based MusicXML rendering
- Nigel North, *Continuo Playing on the Lute, Archlute and Theorbo* — baroque lute tuning reference
- Robert Dowland, *Varietie of Lute Lessons* (1610) — ornament tables
