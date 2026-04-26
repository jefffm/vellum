# Vellum — Open Questions Tracker

> Originally generated from adversarial spec review, 2026-04-26.
> Updated after architecture pivot to pi-mono web app.
> Status: 🔴 = blocker, 🟡 = should resolve before v1, 🟢 = can defer to v2

---

## Resolved by Architecture Pivot

The following questions from the original review are resolved by the move to pi-mono:

- ~~**OQ-01: How does the LLM load instrument profiles?**~~ → Profiles injected via pi prompt templates + tool registration. The `profile-detect` hook auto-loads on instrument mention.
- ~~**OQ-16: convert.py role is unclear**~~ → Eliminated. Instrument conversion is handled by LLM + native tools (`tabulate`, `voicings`).
- ~~**OQ-17: validate.py has no defined scope**~~ → Replaced by `check_playability` tool and `error-parser` hook. Validation operates on structured data (tool inputs), not on .ly source.

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

---

### 🟡 OQ-03: Diapason retuning model

The baroque lute profile hard-codes diapason pitches, but lutenists retune diapasons per piece/key. The `diapasons()` tool addresses this partially, but:

**Questions:**
- How many common diapason tuning schemes exist?
- Should the `diapasons()` tool output be automatically injected into the arrangement context?
- How does the LilyPond .ily include handle variable diapason tuning?

**Research needed:** Survey diapason tunings in Weiss, Mouton, Bach lute works.

---

### 🟡 OQ-04: Re-entrant tuning semantics are underspecified

**Baroque guitar:** Courses 4-5 have two strings (bourdon + octave). Which sounds? Historical practice varied.

**Theorbo:** Courses 1-2 are an octave lower than standard lute — this isn't "re-entrant" in the baroque guitar sense. The old spec conflated these.

**Questions:**
- How does the `tabulate()` tool handle re-entrant courses?
- Should voicings consider both bourdon and octave string for ranking?
- The theorbo profile has been updated to remove "re-entrant" label — verify this is musically accurate.

---

### 🟡 OQ-05: No transposition strategy

What happens when a piece in C major needs to go on a baroque lute in d-minor tuning?

**Questions:**
- Does the `transpose()` tool auto-suggest idiomatic keys?
- What are the "good keys" for each instrument?
- How does transposition interact with diapason availability?

---

### 🟡 OQ-06: Difficulty threshold is undefined

The `check_playability()` tool returns a difficulty rating, but the algorithm isn't defined.

**Minimum viable algorithm:**
- Fret stretch per chord (>4 frets = violation on lute, >5 on guitar)
- Position shifts per bar (more shifts = harder)
- Simultaneous voice count
- Tempo interaction (fast + complex = harder)

---

## Notation & Rendering

### 🟡 OQ-07: French letter tab is complex — needs LilyPond testing

French tab requires:
1. `TabStaff` with `fret-letter-tablature-format` (note: old spec had wrong function name)
2. A separate `RhythmicStaff` for rhythm flags above
3. The LLM must generate two synchronized streams

**Research needed:** Build a working LilyPond French tab example and document what works, what doesn't, and what customization is needed.

---

### 🟡 OQ-08: MusicXML export has no implementation path

LilyPond can't export MusicXML. Options:
- Remove from scope (is it actually needed?)
- Server-side conversion via MuseScore CLI
- JS/Rust MusicXML writer from structured arrangement data

**Decision needed:** Is MusicXML export actually needed for any v1 workflow?

---

### 🟡 OQ-09: MIDI output reliability from TabStaff

LilyPond MIDI from `TabStaff` with custom tunings may have pitch mapping issues.

**Research needed:** Compile a test piece with baroque lute tuning, verify MIDI correctness. If broken, use a parallel hidden `Staff` for MIDI output.

---

## Arrangement Engine

### 🟡 OQ-11: Ornamentation is in the arrangement process but ornament table is v2

**Resolution for v1:** The LLM adds ornaments using its musical judgment and standard LilyPond notation (trill, mordent, appoggiatura). A configurable ornament table per style period is deferred to v2.

---

### 🟡 OQ-12: Verification/feedback loop

The auto-compile hook provides visual feedback. The `check_playability()` tool provides mechanical verification. But there's still no pitch verification (does the arrangement match the source?).

**For v1:** Accept that the human reviews the visual output. The workbench makes this easy (SVG preview, future MIDI playback). Automated pitch verification is a v2 problem.

---

## New Questions (pi-mono Architecture)

### 🟡 OQ-22: pi-web-ui artifact panel customization depth

The tablature workbench requires custom artifact types beyond pi-web-ui's built-in HTML/SVG/Markdown. How deeply can the artifacts panel be customized?

**Questions:**
- Can custom web components be registered as artifact renderers?
- Does the panel support live-updating artifacts (auto-compile pushes new SVG)?
- How does the panel handle multiple artifact types simultaneously (SVG + fretboard + MIDI)?

**Research needed:** Read pi-web-ui source, test custom artifact registration.

---

### 🟡 OQ-23: pi-agent-core tool return types for visual artifacts

The `compile()` and `fretboard()` tools need to return visual artifacts (SVG) that render in the browser, not just text that the LLM sees. How does pi-agent-core handle tool results that are displayed differently to the LLM vs. the human?

**Research needed:** Check if pi-agent-core supports dual-channel tool results (text for LLM, visual for UI).

---

### 🟡 OQ-24: Servoid deployment readiness

Servoid/Hermes has been timing out for 10+ days. The deployment target needs to be healthy before Vellum can be deployed.

**Action needed:** Diagnose and fix servoid before Vellum deployment.

---

### 🟢 OQ-14: Voice text underlay mechanics

Deferred. Basic voice parts work without lyrics. Song arrangements with text underlay are a v2 concern.

---

### 🟢 OQ-15: Piano pedaling model

Deferred. LLM can add pedal markings using standard LilyPond notation. A systematic pedaling model is v2.

---

### 🟢 OQ-18: Baroque guitar course 5 stringing controversy

Historical stringing varied. The profile could support variants. Deferred to v2.

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

## Summary

| Priority | Count | Key themes |
|---|---|---|
| 🔴 Blocker | 1 | LLM pitch accuracy risk |
| 🟡 Pre-v1 | 11 | Diapason model, French tab, pi-web-ui customization, servoid health |
| 🟢 Deferrable | 6 | Text underlay, pedaling, stringing variants, copyright |
| ✅ Resolved | 3 | Profile loading, convert.py, validate.py |

**Top 3 actions:**
1. Test LLM pitch accuracy on known melodies — determines whether "arrange from knowledge" is v1 viable (OQ-02)
2. Build a working French tab example in LilyPond (OQ-07)
3. Test pi-web-ui artifact panel customization depth (OQ-22, OQ-23)
