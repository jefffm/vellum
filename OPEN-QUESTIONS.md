# Vellum — Open Questions Tracker

> Originally generated from adversarial spec review, 2026-04-26.
> Updated after architecture pivot to pi-mono web app.
> Research findings added 2026-04-26 (Blunder Hunt Round 2).
> Spec revision pass 2026-04-27: resolved OQ-25, OQ-26, promoted French tab to v1, added source-file-first workflow.
> Status: 🔴 = blocker, 🟡 = should resolve before v1, 🟢 = can defer to v2

---

## Resolved

The following questions have been resolved by architecture decisions, research, or the spec revision.

### ✅ OQ-01: How does the LLM load instrument profiles?

**Resolution:** Profiles loaded from server at init (`GET /api/instruments`), injected into system prompt via `prompts.ts`. No runtime hook needed — all profiles fit in context.

### ✅ OQ-09: MIDI output reliability from TabStaff

**Resolution:** Use hidden parallel `Staff` for MIDI output. The visible `TabStaff` handles notation; the hidden `Staff` (same music expression, all engravers removed/transparent) produces correct MIDI. Built into all LilyPond templates. See SPEC.md §LilyPond Integration → MIDI Output.

### ✅ OQ-11: Ornamentation table

**Resolution:** Six standard baroque lute ornaments for v1 using LilyPond builtins: trill (`\trill`), mordent (`\mordent`), appoggiatura (`\appoggiatura`), slur (`( )`), staccato (`\staccato`), turn (`\turn`). Full configurable ornament table per style period is v2. See SPEC.md §Ornaments in Tablature.

### ✅ OQ-16: convert.py role is unclear

**Resolution:** Eliminated. Instrument conversion handled by LLM + native tools (`tabulate`, `voicings`).

### ✅ OQ-17: validate.py has no defined scope

**Resolution:** Replaced by `check_playability` tool and structured error parsing in `POST /api/compile`.

### ✅ OQ-22: pi-web-ui artifact panel customization depth

**Resolution:** ArtifactsPanel supports SVG as a built-in artifact type. The "tablature workbench" is multiple artifact tabs (tablature.svg, fretboard.svg, arrangement.ly). Custom tool renderers via `registerToolRenderer()` provide inline visual feedback in chat. See SPEC.md §Tool Renderers.

### ✅ OQ-23: pi-agent-core tool return types for visual artifacts

**Resolution:** `AgentToolResult<T>` provides dual-channel: `content` (text for LLM) + `details` (structured data for UI renderer). Custom tool renderers access `result.details` to display SVGs inline. See SPEC.md §Tool Definition Pattern.

### ✅ OQ-25: Client-server architecture split is undefined

**Resolution (spec revision 2026-04-27):** Agent runs in the browser. Tools make `fetch()` calls to server REST API. LLM calls proxied through server via `streamProxy` (API keys stay server-side). Server endpoints:
- `POST /api/stream` — LLM proxy
- `POST /api/compile` — LilyPond subprocess
- `POST /api/validate` — syntax check
- `GET /api/instruments[/:id]` — profile serving
- `GET/POST /api/arrangements` — persistence
- `GET /api/templates/:name` — LilyPond templates

Full architecture diagram in SPEC.md §Architecture.

### ✅ OQ-26: Spec uses wrong pi-mono API surface

**Resolution (spec revision 2026-04-27):** Entire spec rewritten to use correct APIs:
- `AgentTool<T>` with TypeBox schemas for tool definitions
- `Agent({ initialState: { tools: [...] } })` for agent setup
- `ChatPanel.setAgent(agent)` for UI wiring
- `registerToolRenderer()` for custom tool rendering
- `AgentToolResult<T>` with `content`/`details` dual channel
- Full `execute(toolCallId, params, signal?, onUpdate?)` signature
- All `pi.registerTool()` / `pi.on()` references removed

---

## Architecture & Core Design

### 🟡 OQ-02: LLM pitch accuracy from memory

Example 1 assumes the LLM "knows" Greensleeves well enough to produce a pitch-accurate arrangement. LLMs are notoriously unreliable at exact pitch recall.

#### Research Findings (2026-04-26)

**No formal benchmarks exist** for LLM pitch-accurate recall. Key evidence:

- LLMs are text models with no pitch perception. Melody recall comes from notation in training data.
- Well-known melodies may be roughly accurate for first few bars; accuracy degrades for inner voices and less-common sections.
- Obscure repertoire (Weiss, Mouton, Visée) is almost certainly unreliable.
- A 2024 test (José Luis Miralles Bono) found Claude 3.5 got Chopin Op. 9 No. 2's key and rough contour right but actual notes and harmony wrong.
- A 2025 NYU study (Carone et al., arXiv 2510.22455) confirmed LLMs handle music syntax but not content.

#### Resolution (spec revision 2026-04-27)

**Source-file-first is now the default v1 workflow.** The system prompt instructs the LLM to:
1. Prefer source files (.ly, lead sheets) over memory recall
2. When no source provided, warn: "I'm working from memory — please verify the pitches"
3. Flag specific passages where it's uncertain

"Arrange from memory" is a convenience feature with explicit disclaimers, not a primary workflow. See SPEC.md §Input Types and §System Prompt Design.

**Status:** Downgraded from 🔴 to 🟡. The risk is managed by workflow design. Remains 🟡 because the LLM's actual accuracy should be validated during v1 testing.

---

### 🟡 OQ-03: Diapason retuning model

#### Research Findings (2026-04-26)

3-5 standard schemes cover ~90% of repertoire:

| Key | Courses 7→13 | Name |
|---|---|---|
| D minor / F major | G-F-E♭-D-C-B♭-A | *Accord ordinaire* |
| A minor / C major | G-F-E♮-D-C-B♮-A | Natural 3rd/7th |
| G minor / B♭ major | G-F-E♭-D-C-B♭-A | Same as standard |
| D major (rare) | G-F♯-E-D-C♯-B-A | Sharp keys (Weiss) |
| E minor | G-F♯-E-D-C-B-A | Natural with F♯ |

#### Resolution (spec revision 2026-04-27)

Diapason lookup table added to SPEC.md §diapasons tool and to the baroque lute instrument profile (`diapason_schemes` field). The `diapasons()` tool uses this table with per-piece override support. LilyPond integration via `additionalBassStrings = \stringTuning <...>`.

**Status:** Downgraded to 🟢. Implementation path is clear. Straightforward lookup table.

---

### 🟡 OQ-04: Re-entrant tuning semantics

#### Research Findings (2026-04-26)

Three historical stringing schemes for baroque guitar:

| Type | Course 5 | Course 4 | Region | Effect |
|---|---|---|---|---|
| Fully re-entrant | a/a (no bourdon) | d'/d' (no bourdon) | Italian (Rome) | Maximum campanella, no bass |
| Semi re-entrant | a/a (no bourdon) | d/d' (octave pair) | French (de Visée) | Some bass on 4 |
| Bourdons on both | A/a (bourdon+octave) | d/d' (bourdon+octave) | Spanish (Sanz) | Bass foundation |

#### Resolution (spec revision 2026-04-27)

`stringing` parameter added to baroque guitar profile with three options: `"french"`, `"italian"`, `"mixed"`. Default: `"french"` for solo repertoire. The parameter affects `tabulate()` and `voicings()` ranking (French favors campanella, Italian favors bass lines). Theorbo correctly distinguished as non-re-entrant.

See SPEC.md §Baroque Guitar profile.

**Status:** Downgraded to 🟢. Implementation decision made. The `tabulate()` and `voicings()` tools need to respect the `stringing` parameter, which is straightforward.

---

### 🟡 OQ-05: No transposition strategy

What happens when a piece in C major needs to go on a baroque lute in d-minor tuning?

#### Resolution (spec revision 2026-04-27)

Idiomatic key table added to SPEC.md §transpose tool. The `transpose()` tool suggests keys where open strings align with the key center. The LLM + transpose tool handle the decision.

**Status:** Downgraded to 🟢. Key suggestion table defined. Algorithm: transpose to target interval, check out-of-range notes, suggest nearby idiomatic key if many notes fall outside range.

---

### 🟡 OQ-06: Difficulty threshold is undefined

#### Resolution (spec revision 2026-04-27)

Minimum viable difficulty algorithm defined in SPEC.md §check_playability:
- Max fret stretch per chord (>4 lute / >5 guitar = violation)
- Position shifts per bar (>2 adds difficulty)
- Simultaneous sustained voices (>3 on lute = advanced)
- Weighted sum → beginner / intermediate / advanced

**Status:** Downgraded to 🟢. Algorithm defined. Tuning the weights is an implementation detail.

---

## Notation & Rendering

### ✅ OQ-07: French letter tab LilyPond support

#### Research Findings (2026-04-26)

**LilyPond 2.24 has full support.** Confirmed working syntax:
- `tablatureFormat = #fret-letter-tablature-format` — letters a-p
- `additionalBassStrings = \stringTuning <...>` — diapasons below staff
- `\new RhythmicStaff` above `\new TabStaff` — rhythm flags

#### Resolution (spec revision 2026-04-27)

**Promoted to v1.** French letter tab is the native notation for baroque lute (the primary instrument). Full working LilyPond template added to SPEC.md §French Letter Tablature with RhythmicStaff + TabStaff + hidden MIDI Staff pattern. `french-tab.ly` template in v1 scope.

**Remaining testing needs:** polyphonic voices with diapasons, ornament placement in tab, vertical alignment at complex rhythms. These are validation tasks during implementation, not design gaps.

**Status:** ✅ Resolved. Design complete, promoted to v1.

---

### 🟢 OQ-08: MusicXML export has no implementation path

LilyPond can't export MusicXML. Options: MuseScore CLI, custom writer.

**Status:** Deferred to v2. No v1 workflow requires MusicXML export.

---

### 🟢 OQ-10: German tablature support

German tablature uses a completely different notation system (unique letter codes, no staff lines). Low demand, high implementation effort.

**Status:** 🟢 Deferred to v2. Evaluate demand vs. effort.

---

### 🟡 OQ-12: Verification/feedback loop

No automated pitch verification (does the arrangement match the source?).

**Status:** Unchanged. For v1, the human reviews SVG preview and listens to MIDI. Automated pitch verification (compare against source) is v2. The source-file-first workflow (OQ-02 resolution) reduces the risk by starting from known-correct pitches.

---

### 🟡 OQ-13: LilyPond compilation error handling

How does the server parse LilyPond stderr into structured errors?

**Status:** Implementation detail. LilyPond stderr follows predictable patterns (`filename:line:col: error: message`). The `POST /api/compile` endpoint parses these with regex into `CompileError` objects. Bar number extraction requires correlating line numbers with the `.ly` source. Straightforward but needs testing with real error output.

---

### 🟢 OQ-14: Voice text underlay mechanics

**Status:** Deferred to v2. Basic voice parts work without lyrics. Song arrangements with text underlay are a v2 concern.

---

### 🟢 OQ-15: Piano pedaling model

**Status:** Deferred to v2. LLM can add pedal markings using standard LilyPond notation. A systematic pedaling model is v2.

---

### 🟢 OQ-18: Baroque guitar course 5 stringing controversy

**Status:** Resolved by OQ-04. The `stringing` parameter handles the three historical variants. Default: `"french"` for solo repertoire.

---

### 🟢 OQ-19: Copyright/licensing discussion

**Status:** Deferred. User's responsibility. The system prompt can note public domain status for pre-1928 compositions.

---

### 🟢 OQ-20: Renaissance lute profile may be too simple

**Status:** Deferred to v2. 6-course is the starting point. 7-course (Dowland-era) and 10-course profiles can be added as additional instrument profiles.

---

### 🟢 OQ-21: Test piece selection

#### Resolution (spec revision 2026-04-27)

**Primary:** Dowland "Flow My Tears" (Lachrimae) — voice + lute, tests the most v1 constraints (voice+tab template, intabulation, diapasons, ornaments, moderate difficulty, public domain).

**Secondary:** BWV 996 Bourrée (Bach) — purely instrumental, simpler validation.

See SPEC.md §Test Piece for full rationale and test scenarios.

**Status:** ✅ Resolved.

---

### 🟢 OQ-24: Servoid deployment readiness

NixOS packaging path is clear. LilyPond 2.24.4 in nixpkgs. pi-mono packages are pure JS (no native deps). Servoid health is an infrastructure issue independent of Vellum.

**Status:** 🟢 Infrastructure dependency, not a Vellum design question.

---

## Summary

| Priority | Count | Key themes |
|---|---|---|
| 🔴 Blocker | 0 | — |
| 🟡 Pre-v1 | 3 | LLM pitch accuracy validation, verification loop, error parsing |
| 🟢 Deferrable | 10 | MusicXML export, German tab, text underlay, pedaling, stringing variants, copyright, Renaissance profiles, test pieces, deployment, diapasons, re-entrant tuning, transposition, difficulty |
| ✅ Resolved | 12 | Profile loading, MIDI, ornaments, convert.py, validate.py, artifact panel, tool return types, client-server architecture, API surface, French tab, test piece, diapason model |

**No remaining blockers.** The three 🟡 items are validation tasks during implementation, not design gaps. The spec is ready for implementation.
