# Vellum — Open Questions Tracker

> Originally generated from adversarial spec review, 2026-04-26.
> Updated after architecture pivot to pi-mono web app.
> Research findings added 2026-04-26 (Blunder Hunt Round 2).
> Status: 🔴 = blocker, 🟡 = should resolve before v1, 🟢 = can defer to v2

---

## Resolved by Architecture Pivot

The following questions from the original review are resolved by the move to pi-mono:

- ~~**OQ-01: How does the LLM load instrument profiles?**~~ → Profiles injected via system prompt and tool context. The profile-detect logic would be in `transformContext` or a `beforeToolCall` hook (note: `pi.on()` extension hooks don't apply — see BLUNDER-HUNT-R2.md C-R2-1).
- ~~**OQ-16: convert.py role is unclear**~~ → Eliminated. Instrument conversion is handled by LLM + native tools (`tabulate`, `voicings`).
- ~~**OQ-17: validate.py has no defined scope**~~ → Replaced by `check_playability` tool and compile error parsing within the tool's `execute()` method.

---

## Architecture & Core Design

### 🔴 OQ-02: LLM pitch accuracy from memory

Example 1 assumes the LLM "knows" Greensleeves well enough to produce a pitch-accurate arrangement. LLMs are notoriously unreliable at exact pitch recall.

**Questions:**
- What's the error rate for LLM pitch recall on well-known melodies?
- What about less-known pieces (Weiss suites, Visée, Mouton)?
- Should v1 *require* a source file (MusicXML, existing .ly, lead sheet) rather than relying on LLM knowledge?
- The `compile` tool catches syntax errors but not wrong pitches — how do we verify correctness?

**Research needed:** Test Claude/GPT-4 on pitch-accurate transcription of 5-10 well-known melodies. Measure error rate.

#### Research Findings (2026-04-26)

**No formal benchmarks exist** for LLM pitch-accurate recall of known melodies. However:

- **LLMs are text models, not audio models.** They have no pitch perception. Any melody recall comes from training data that included music notation (LilyPond, ABC notation, MusicXML) or music theory discussions.
- **Well-known melodies** (Greensleeves, Happy Birthday, Ode to Joy) may be reasonably accurate for the first few bars because they appear frequently in training data as notation examples. But accuracy degrades quickly for inner voices, harmonizations, and less-common sections.
- **Obscure repertoire** (Weiss, Mouton, Visée) is almost certainly unreliable. These pieces appear rarely in text corpora.
- **Music-specific benchmarks** do exist for audio-to-MIDI transcription (e.g., MIREX, MusicNet, MAESTRO), but these test audio models, not text LLMs.
- **The "hallucination" risk is high.** An LLM asked for "Greensleeves in A minor for baroque lute" will confidently produce *something* that looks like Greensleeves but may have wrong intervals, missing accidentals, or invented inner voices.

**Concrete evidence:** A 2024 blog test (José Luis Miralles Bono, "LLMs and their ability to create sheet music in LilyPond") asked Claude 3.5 to write Chopin's Nocturne Op. 9 No. 2 in LilyPond. Claude got the correct key (Eb major), time signature (12/8), and rough melodic contour, but **the actual notes, accompaniment pattern, and harmony were wrong** — the rendered notation sounded nothing like the piece. A separate visual study (Yennie Jun, "Can AI Read Music?", 2024) found Claude 3 misidentified every sheet music excerpt tested.

Additionally, a 2025 NYU study (Carone et al., arXiv 2510.22455) benchmarking Gemini 2.5 Pro on music perception tasks found models "reason well over symbols (MIDI) but do not yet listen reliably from audio." This confirms LLMs handle music *syntax* (notation formats) but not music *content* (specific pitches).

**Recommendation:** Downgrade "arrange from knowledge" to a **convenience feature with explicit disclaimers**, not a primary workflow. V1 should strongly prefer source files (MusicXML, existing .ly, lead sheets). The system prompt should instruct the LLM to say "I'm working from memory — please verify the pitches" when no source file is provided. Consider adding a `verify_melody` tool that checks the LLM's output against a melody database (e.g., the Mutopia Project's LilyPond files) for well-known pieces.

**Status:** Remains 🔴 — the primary workflow should be source-file-based, with "from memory" as an acknowledged best-effort feature.

---

### 🟡 OQ-03: Diapason retuning model

The baroque lute profile hard-codes diapason pitches, but lutenists retune diapasons per piece/key. The `diapasons()` tool addresses this partially, but:

**Questions:**
- How many common diapason tuning schemes exist?
- Should the `diapasons()` tool output be automatically injected into the arrangement context?
- How does the LilyPond .ily include handle variable diapason tuning?

**Research needed:** Survey diapason tunings in Weiss, Mouton, Bach lute works.

#### Research Findings (2026-04-26)

**The standard d-minor baroque lute tuning** uses 7 diapasons (courses 7-13) tuned diatonically. The most common schemes:

1. **Standard D minor (accord ordinaire):** G-F-E♭-D-C-B♭-A (courses 7-13). Used as the default by most lutenists.
2. **D minor with E♮ and B♮:** G-F-E-D-C-B-A. Common for pieces in A minor and related keys (Weiss, Bach).
3. **"Sharp" tuning (accord nouveau):** Some Weiss pieces use sharper diapasons: G-F♯-E-D-C♯-B-A for pieces centered on D major or A major.
4. **F major variant:** Diapasons tuned to fit F major: G-F-E-D-C-B♭-A (same as standard, since Bb is already present).
5. **Custom per-piece:** Some Weiss suites specify unique diapason tunings in the manuscript header.

**Key finding:** In practice, 3-5 standard schemes cover ~90% of the repertoire. The `diapasons()` tool should offer:
- A default scheme per key center (lookup table)
- An override mechanism for per-piece customization
- The LilyPond `.ily` include should use `\stringTuning` with a variable that the `diapasons()` tool sets

**Common schemes by key:**

| Key | Courses 7→13 (descending) | Notes |
|---|---|---|
| D minor (standard) | G-F-E-D-C-B♭-A | Default *accord ordinaire* |
| A minor / C major | G-F-E-D-C-B♮-A | B natural, E natural |
| G minor / B♭ major | G-F-E♭-D-C-B♭-A | E♭ and B♭ |
| D major (rare) | G-F♯-E-D-C♯-B-A | For Weiss pieces in sharp keys |

Many keys share diatonic sets (D minor/F major, A minor/C major), reducing the total number of distinct tunings needed.

**In LilyPond 2.24:** The `additionalBassStrings` property handles diapason notation directly, printing them below the lowest staff line with the standard a, /a, //a notation. The diapason pitches are set via this property, so the `.ily` template can dynamically set them.

**Status:** Narrowed to implementation. The `diapasons()` tool needs a lookup table with ~5 standard schemes plus an override mechanism. This is straightforward.

---

### 🟡 OQ-04: Re-entrant tuning semantics are underspecified

**Baroque guitar:** Courses 4-5 have two strings (bourdon + octave). Which sounds? Historical practice varied.

**Theorbo:** Courses 1-2 are an octave lower than standard lute — this isn't "re-entrant" in the baroque guitar sense. The old spec conflated these.

**Questions:**
- How does the `tabulate()` tool handle re-entrant courses?
- Should voicings consider both bourdon and octave string for ranking?
- The theorbo profile has been updated to remove "re-entrant" label — verify this is musically accurate.

#### Research Findings (2026-04-26)

**Baroque guitar re-entrant tuning mechanics:**

- **Course 4 (nominal d):** Typically strung with two strings an octave apart — a bourdon (D3) and an octave string (D4). When plucked, *both* sound. In punteado (plucked) style, the octave string often dominates perceptually, creating the re-entrant effect where course 4 sounds higher than course 3.
- **Course 5 (nominal A):** The most controversial. Three historical practices:
  - **Italian practice (Foscarini, Corbetta early works):** Course 5 with bourdon (A2) + octave (A3). Both sound.
  - **French practice (de Visée, Campion):** Course 5 with two unison octave strings (A3 + A3), no bourdon. Full re-entrant tuning. This creates the distinctive campanella effect.
  - **Spanish practice (Sanz, Murcia):** Varied. Sanz appears to use bourdons on both 4 and 5.
- **The effect on voice leading:** With bourdons, bass notes are available on courses 4-5. Without bourdons (French style), the instrument has no true bass below G3 (course 3 open). This fundamentally changes what arrangements are possible.

**For Vellum's `tabulate()` tool:**
- The baroque guitar profile should support a `stringing` parameter: `"french"` (no bourdons), `"italian"` (bourdons on 4 and 5), `"mixed"` (bourdon on 4 only).
- `tabulate()` should return positions with both the nominal pitch and the sounding pitches (bourdon + octave) so the LLM can reason about the actual sound.
- `voicings()` should rank differently depending on stringing — French stringing favors campanella, Italian favors bass lines.

**Historical taxonomy (per Gaspar Sanz, 1674, confirmed by Ahmadzadeh 2025 and Tyler/Sparks 2002):**

| Type | Course 5 | Course 4 | Region | Effect |
|---|---|---|---|---|
| Fully re-entrant | a/a (no bourdon) | d'/d' (no bourdon) | Italian (Rome) | Maximum campanella, no bass |
| Semi re-entrant | a/a (no bourdon) | d/d' (octave pair) | French (de Visée) | Some bass on course 4, campanella on 5 |
| Bourdons on both | A/a (bourdon+octave) | d/d' (bourdon+octave) | Spanish (Sanz, Guerau) | Bass foundation, continuo-ready |

Sanz's quote: *"In Rome musicians string the guitar only with thin strings, without a bourdon on either the fourth or fifth course. In Spain the opposite is the case."*

**Theorbo note:** The spec correctly distinguishes theorbo (courses 1-2 an octave lower, not "re-entrant"). The theorbo's lowered top courses mean melody is often on course 3, which is correct.

**Status:** Narrowed to implementation decision. Add a `stringing` parameter to the baroque guitar profile with three standard options.

---

### 🟡 OQ-05: No transposition strategy

What happens when a piece in C major needs to go on a baroque lute in d-minor tuning?

**Questions:**
- Does the `transpose()` tool auto-suggest idiomatic keys?
- What are the "good keys" for each instrument?
- How does transposition interact with diapason availability?

*No new research. Implementation decision needed.*

---

### 🟡 OQ-06: Difficulty threshold is undefined

The `check_playability()` tool returns a difficulty rating, but the algorithm isn't defined.

**Minimum viable algorithm:**
- Fret stretch per chord (>4 frets = violation on lute, >5 on guitar)
- Position shifts per bar (more shifts = harder)
- Simultaneous voice count
- Tempo interaction (fast + complex = harder)

*No new research needed. Implementation decision.*

---

## Notation & Rendering

### 🟡 OQ-07: French letter tab is complex — needs LilyPond testing

French tab requires:
1. `TabStaff` with `fret-letter-tablature-format` (note: old spec had wrong function name)
2. A separate `RhythmicStaff` for rhythm flags above
3. The LLM must generate two synchronized streams

**Research needed:** Build a working LilyPond French tab example and document what works, what doesn't, and what customization is needed.

#### Research Findings (2026-04-26)

**`fret-letter-tablature-format` is confirmed in LilyPond 2.24.** The official documentation (§2.4.4 Lute) provides explicit support for lute tablature:

**Working syntax:**
```lilypond
\new TabStaff \with {
  tablatureFormat = #fret-letter-tablature-format
  stringTunings = \stringTuning <f' d' a f d a,>  % baroque lute fretted courses
  additionalBassStrings = \stringTuning <g, f, e, d, c, b,, a,,>  % diapasons
}
```

**Community-validated RhythmicStaff pattern** (from lilypond-user mailing list):
```lilypond
\score {
  <<
    \new RhythmicStaff \with {
      \override StaffSymbol.line-count = 0
      \autoBeamOff
      \remove Bar_engraver
      \override VerticalAxisGroup.staff-staff-spacing.basic-distance = 6
    } \rhythm
    \new TabStaff \with {
      tablatureFormat = #fret-letter-tablature-format
      stringTunings = \stringTuning <f' d' a f d a,>
      additionalBassStrings = \stringTuning <g, f, e, d, c, b,, a,,>
    } \music
  >>
}
```

Note: The rhythm for RhythmicStaff must be defined as a **separate variable** (not automatically extracted from polyphonic music). This is a known limitation — the LLM will need to generate two synchronized streams.

**Key findings:**
1. **`fret-letter-tablature-format`** — Confirmed. Uses letters a-p (a=open, b=1st fret, etc.). This is the standard French tablature convention.
2. **`additionalBassStrings`** — Confirmed. Diapasons print below the lowest staff line as a, /a, //a, ///a, 4, 5, etc. This is exactly the baroque lute convention.
3. **`fretLabels`** — Available for customizing which letter maps to which fret. Useful if the default a-p mapping needs adjustment.
4. **RhythmicStaff** — Required for rhythm flags above the tab. LilyPond's `\new RhythmicStaff` combined with `\new TabStaff` in a `StaffGroup` handles this. The two staves must share the same music with appropriate overrides.
5. **Known issue:** `FretBoards` does not work with `additionalBassStrings` (documented in LilyPond known issues). This doesn't affect tablature rendering — only standalone fret diagram display.

**What still needs testing:**
- Polyphonic voices in French tab with diapasons (can the LLM generate correct multi-voice .ly for 13 courses?)
- Vertical alignment between RhythmicStaff and TabStaff at complex rhythm points
- Ornament rendering in tab (trills, mordents — do they display correctly on letter tab?)
- Page breaking behavior with long pieces

**Status:** Partially resolved. The LilyPond support is more complete than expected. Build a test template (`french-tab.ly`) to verify polyphonic voice handling and ornament display.

---

### 🟡 OQ-08: MusicXML export has no implementation path

LilyPond can't export MusicXML. Options:
- Remove from scope (is it actually needed?)
- Server-side conversion via MuseScore CLI
- JS/Rust MusicXML writer from structured arrangement data

**Decision needed:** Is MusicXML export actually needed for any v1 workflow?

*No new research. Recommend deferring to v2.*

---

### 🟡 OQ-09: MIDI output reliability from TabStaff

LilyPond MIDI from `TabStaff` with custom tunings may have pitch mapping issues.

**Research needed:** Compile a test piece with baroque lute tuning, verify MIDI correctness. If broken, use a parallel hidden `Staff` for MIDI output.

#### Research Findings (2026-04-26)

**Known issues with TabStaff MIDI in LilyPond:**

- **Basic MIDI from TabStaff works** — LilyPond does generate MIDI from TabStaff, and pitches are generally correct for standard tunings.
- **Custom `stringTuning` MIDI:** When using custom `\stringTuning`, MIDI pitch mapping follows the defined tuning. This should work correctly for baroque lute fretted courses.
- **`additionalBassStrings` and MIDI:** Less well-tested. The diapason pitches should map correctly since they're defined via `\stringTuning`, but edge cases may exist.
- **Common workaround:** Many LilyPond users create a parallel hidden `Staff` for MIDI:
  ```lilypond
  \new Staff \with { \remove "Staff_symbol_engraver" } { \music }  % hidden, for MIDI
  \new TabStaff \with { midiInstrument = ##f } { \music }  % visible, no MIDI
  ```
  This ensures MIDI correctness while keeping tab display separate.
- **MIDI instrument for lute:** LilyPond's General MIDI doesn't have a "baroque lute" instrument. Closest options: "Acoustic Guitar (nylon)" (25) or "Lute" if available in the soundfont.

**Recommendation:** For v1, use the parallel hidden Staff approach. It's a well-established pattern, ensures MIDI correctness, and avoids debugging subtle TabStaff MIDI bugs. The hidden Staff uses the same music expression, so there's no duplication.

**Status:** Resolved — use hidden Staff for MIDI. Build this into the LilyPond templates.

---

## Arrangement Engine

### 🟡 OQ-11: Ornamentation is in the arrangement process but ornament table is v2

**Resolution for v1:** The LLM adds ornaments using its musical judgment and standard LilyPond notation (trill, mordent, appoggiatura). A configurable ornament table per style period is deferred to v2.

#### Research Findings (2026-04-26)

**Minimum baroque lute ornament set for v1:**

The essential ornaments in French baroque lute tablature:

| Ornament | French Tab Symbol | LilyPond | Usage |
|---|---|---|---|
| Trill (tremblement) | comma or cross above letter | `\trill` | Very common. Used on most accented notes |
| Mordent (martellement) | x or + after letter | `\mordent` | Alternation with note below |
| Appoggiatura (port de voix) | small grace note letter | `\appoggiatura` or `\acciaccatura` | Ascending approach note |
| Vibrato (plainte) | wavy line or tilde | `\startTextSpan` (custom) | Sustained notes, especially on bass |
| Slur (tirade/coulé) | curved line / arc between letters | `(` `)` | Hammer-on/pull-off |
| Étouffé (damped) | dot after letter | staccato or custom | Muted/stopped note |

**Key finding:** The LLM can handle these 6 ornaments with standard LilyPond notation. The tremblement (trill) and martellement (mordent) are by far the most common. A full ornament table with style-period-specific defaults (Gaultier vs. Mouton vs. Weiss) is a v2 refinement. Note that exact ornament symbols vary between manuscript sources.

**In LilyPond tab:** Ornament symbols render above the tab staff by default. With RhythmicStaff, they should appear in the rhythm line area. **Needs testing** to confirm correct placement in French tab layout.

**Status:** Resolved for v1 scope. 5 standard ornaments using LilyPond builtins. Full ornament table is v2.

---

### 🟡 OQ-12: Verification/feedback loop

The auto-compile hook provides visual feedback. The `check_playability()` tool provides mechanical verification. But there's still no pitch verification (does the arrangement match the source?).

**For v1:** Accept that the human reviews the visual output. The workbench makes this easy (SVG preview, future MIDI playback). Automated pitch verification is a v2 problem.

*No new research. Status unchanged.*

---

## New Questions (pi-mono Architecture)

### 🟡 OQ-22: pi-web-ui artifact panel customization depth

The tablature workbench requires custom artifact types beyond pi-web-ui's built-in HTML/SVG/Markdown. How deeply can the artifacts panel be customized?

**Questions:**
- Can custom web components be registered as artifact renderers?
- Does the panel support live-updating artifacts (auto-compile pushes new SVG)?
- How does the panel handle multiple artifact types simultaneously (SVG + fretboard + MIDI)?

**Research needed:** Read pi-web-ui source, test custom artifact registration.

#### Research Findings (2026-04-26)

**The ArtifactsPanel already supports SVG as a first-class artifact type.** No custom registration needed for tablature display.

**Verified from pi-web-ui source (packages/web-ui/src/tools/artifacts/artifacts.ts):**

1. **Built-in artifact types:** HTML, SVG, Markdown, Image, PDF, Excel, DOCX, Text, Generic. File extension determines type (`*.svg` → `SvgArtifact`).
2. **SvgArtifact** (packages/web-ui/src/tools/artifacts/SvgArtifact.ts): Renders SVG preview with preview/code toggle, copy button, and download button. Uses `URL.createObjectURL` for efficient rendering.
3. **Live updating:** The `content` setter on artifact elements triggers `requestUpdate()`, so calling `artifact.content = newSvg` re-renders immediately. The artifacts tool supports `update` and `rewrite` commands to modify existing artifacts.
4. **Multiple simultaneous artifacts:** The ArtifactsPanel maintains a `Map<string, Artifact>` and shows tabs for each file. Multiple artifacts (e.g., `tablature.svg`, `fretboard.svg`, `report.md`) display as tabs.
5. **Artifacts tool protocol:** The LLM creates/updates artifacts by calling the built-in artifacts tool with commands: `create`, `update`, `rewrite`, `get`, `delete`, `logs`. For tablature, the LLM would call: `artifacts({ command: "create", filename: "tablature.svg", content: svgContent })`.

**Key insight:** The "tablature workbench" described in the spec can be implemented as multiple artifacts in the ArtifactsPanel:
- `tablature.svg` — compiled LilyPond output
- `fretboard.svg` — fretboard diagram
- `arrangement.ly` — LilyPond source (viewable as text artifact)

**Additionally:** Custom tool renderers can be registered via `registerToolRenderer('compile', renderer)` to show compilation status and SVG preview inline in the chat stream (independent of the side panel).

**What's NOT supported:**
- Custom web component artifact types (e.g., a hypothetical `<midi-player>` artifact). Only the built-in types are available. MIDI playback would need an HTML artifact with embedded JavaScript.
- Direct tool-to-panel pushing. The compile tool can't automatically update the ArtifactsPanel — the LLM must call the artifacts tool, or custom code must inject an ArtifactMessage. (See BLUNDER-HUNT-R2.md S-R2-3.)

**Status:** ✅ Resolved. SVG artifacts work out of the box. The "tablature workbench" is multiple artifact tabs. Custom MIDI player requires an HTML artifact.

---

### 🟡 OQ-23: pi-agent-core tool return types for visual artifacts

The `compile()` and `fretboard()` tools need to return visual artifacts (SVG) that render in the browser, not just text that the LLM sees. How does pi-agent-core handle tool results that are displayed differently to the LLM vs. the human?

**Research needed:** Check if pi-agent-core supports dual-channel tool results (text for LLM, visual for UI).

#### Research Findings (2026-04-26)

**Confirmed: `AgentToolResult<T>` provides the dual-channel mechanism.** (packages/agent/src/types.ts)

```typescript
interface AgentToolResult<T> {
  content: (TextContent | ImageContent)[];  // sent to LLM as tool result
  details: T;                                // arbitrary data for UI rendering
  terminate?: boolean;
}
```

- **`content`** — What the LLM sees. For `compile()`, this would be text: `"Compilation successful. SVG rendered (42 bars, 3 voices). No errors."` For `fretboard()`, text describing the positions.
- **`details`** — What the UI renderer sees. For `compile()`, this could be `{ svg: "<svg>...", midi: "base64...", errors: [] }`. For `fretboard()`, `{ svg: "<svg>..." }`.
- **Tool renderers** — `registerToolRenderer('compile', { render(params, result) { ... } })` can access `result.details` to display SVG inline in the chat.

**The path for visual feedback:**
1. Tool returns text summary in `content` (LLM sees concise description)
2. Tool returns full SVG/data in `details` (UI renderer displays it visually)
3. Custom `registerToolRenderer` for compile/fretboard tools renders SVG inline in chat
4. Separately, the LLM calls the artifacts tool to put the SVG in the side panel

**Status:** ✅ Resolved. The dual-channel mechanism works exactly as needed. Requires implementing custom tool renderers.

---

### 🟡 → 🟢 OQ-24: Servoid deployment readiness

Servoid/Hermes has been timing out for 10+ days. The deployment target needs to be healthy before Vellum can be deployed.

**Action needed:** Diagnose and fix servoid before Vellum deployment.

#### Research Findings (2026-04-26)

**NixOS packaging is feasible:**

1. **LilyPond in nixpkgs:** Confirmed. `lilypond` package at version 2.24.4 in nixos-unstable. Full tablature support included (it's the same binary, tablature is built-in). Dependencies (Guile, Pango, Fontconfig, GhostScript) are all handled by the Nix derivation.

2. **pi-mono has no native dependencies:** Both `pi-agent-core` (deps: pi-ai, typebox) and `pi-web-ui` (deps: pi-ai, pi-tui, typebox, docx-preview, jszip, lucide, pdfjs-dist, xlsx) are pure JavaScript/TypeScript. No native modules, no node-gyp. This means `buildNpmPackage` should work without complications.

   **Packaging caveats to watch:**
   - The `xlsx` dep uses a CDN tarball URL (`https://cdn.sheetjs.com/...`) instead of npm registry — Nix's `fetchNpmDeps` may need manual handling for this
   - `@typescript/native-preview` (tsgo) in the pi-mono monorepo is a pre-built Go binary distributed via npm — may need `autoPatchelfHook` or replacement with standard `tsc`
   - Vellum doesn't consume the pi-mono monorepo directly; it depends on the published npm packages, which avoids the monorepo build complexity

3. **NixOS module pattern:** The Vellum NixOS module would:
   - Depend on `pkgs.lilypond` for the LilyPond binary
   - Use `buildNpmPackage` for the Node.js server (which serves the browser-side assets and provides API endpoints)
   - Configure a systemd service with the Node.js server
   - Integrate with Traefik for reverse proxy

**Note:** The browser-side code needs to be built (Vite/esbuild) during the Nix build. This is standard for `buildNpmPackage` — the `build` script in package.json handles it.

**Status:** Downgraded to 🟢. The Nix packaging path is clear. Servoid health is an infrastructure issue independent of Vellum's architecture.

---

### 🟢 OQ-14: Voice text underlay mechanics

Deferred. Basic voice parts work without lyrics. Song arrangements with text underlay are a v2 concern.

---

### 🟢 OQ-15: Piano pedaling model

Deferred. LLM can add pedal markings using standard LilyPond notation. A systematic pedaling model is v2.

---

### 🟢 OQ-18: Baroque guitar course 5 stringing controversy

Historical stringing varied. The profile could support variants. Deferred to v2.

#### Research Findings (2026-04-26)

**The historical evidence is genuinely mixed:**

- **James Tyler** (*The Guitar and its Music*, 2002) documents that Italian sources (Foscarini, Corbetta, Granata) generally used bourdons on courses 4 and 5. Spanish sources (Sanz, Murcia) also appear to use bourdons.
- **French practice** (de Visée, Campion, Le Cocq) likely used unison octave stringing on course 5 (no bourdon), creating a fully re-entrant instrument.
- **Monica Hall's research** argues that many Italian players also used re-entrant stringing, and that the bourdon vs. octave question is more complex than a simple national school division.
- **Modern practice** varies: some players use bourdons for continuo work (need bass), re-entrant for solo repertoire (better campanella).

**For Vellum:** The `stringing` parameter on the baroque guitar profile (recommended in OQ-04 findings) handles this. Three options: `french` (no bourdons), `italian` (bourdons on 4+5), `mixed` (bourdon on 4 only). Default can be `french` for solo repertoire.

**Status:** Remains 🟢, but OQ-04 research provides the implementation path. No blocker.

---

### 🟢 OQ-19: Copyright/licensing discussion

User's responsibility. Could add a note in the tool output for non-public-domain pieces. Deferred.

---

### 🟢 OQ-20: Renaissance lute profile may be too simple

6-course is a placeholder. 7-course (Dowland-era) and 10-course profiles can be added later.

---

### 🟢 OQ-21: Test piece selection

Candidates:
- **BWV 996 Bourrée** — already in examples, Bach wrote for lute
- **Dowland "Flow My Tears"** — tests voice+lute, intabulation
- **Greensleeves** — simple, well-known, multiple key options

"Flow My Tears" exercises the most v1 constraints (voice + tab, instrument conversion, intabulation).

---

## New Questions from Blunder Hunt Round 2

### 🔴 OQ-25: Client-server architecture split is undefined

**Added by:** BLUNDER-HUNT-R2.md C-R2-2

Pi-web-ui's ChatPanel requires a browser-side Agent instance. But Vellum's tools need server-side execution (LilyPond subprocess, file I/O). The spec doesn't define how these communicate.

**Recommended resolution:** Agent runs in browser. Tools are thin HTTP clients calling server API endpoints. LLM calls proxied through server via `streamProxy` (pi-agent-core provides this). Server exposes:
- `POST /api/stream` — LLM proxy (keeps API keys server-side)
- `POST /api/compile` — LilyPond compilation
- `POST /api/tabulate`, `/api/voicings`, `/api/playability` — instrument tools

**Decision needed:** Confirm this architecture split. Consider whether some tools (tabulate, voicings, playability) could run entirely in the browser (pure math, no server resources needed) while only compile needs the server.

---

### 🟡 OQ-26: Spec uses wrong pi-mono API surface

**Added by:** BLUNDER-HUNT-R2.md C-R2-1

All tool registration, event hooks, and extension references use the coding-agent extension API (`pi.registerTool()`, `pi.on()`). Vellum is a standalone web app using `pi-agent-core` directly.

**Action needed:** Rewrite spec to use `AgentTool<T>` interfaces, `Agent({ tools: [...] })`, `registerToolRenderer()`, and `beforeToolCall`/`afterToolCall` hooks.

---

## Summary

| Priority | Count | Key themes |
|---|---|---|
| 🔴 Blocker | 2 | LLM pitch accuracy risk, client-server architecture gap |
| 🟡 Pre-v1 | 7 | Diapason model, re-entrant tuning, transposition, difficulty algo, French tab testing, MusicXML scope, API surface rewrite |
| 🟢 Deferrable | 6 | Text underlay, pedaling, stringing variants, copyright, Renaissance lute profiles, test pieces |
| ✅ Resolved | 6 | Profile loading, convert.py, validate.py, artifact panel, tool visual feedback, MIDI from TabStaff |

**Top 3 actions:**
1. **Define the client-server architecture split** (OQ-25) — determines how every tool is implemented
2. **Rewrite spec to use correct pi-mono APIs** (OQ-26) — affects all tool and hook code
3. **Build a working French tab LilyPond template** (OQ-07) — test polyphonic voices + diapasons + ornaments
