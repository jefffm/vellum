# 03 — Interpretation acceptance and synchronized playback

Status: completed

Type: AFK

Blocked by: 02

## What to build

Create versioned Tablature Interpretations over one canonical transcription, permit clearly
labeled provisional audition, and record separate Transcription Acceptance and purpose-scoped
Interpretation Acceptance decisions. Drive literal playback from Vellum's interpreted events
while Verovio identity and timing keep the rendered score synchronized.

## Acceptance criteria

- [x] Whole-page Transcription Acceptance and Interpretation Acceptance are separate exact-version
      records and can be reviewed in one session.
- [x] Provisional playback cannot authorize analysis, Reading Edition publication, or idiom
      evidence.
- [x] Accepting one interpretation preserves viable alternatives; explicit rejection is separate
      and evidence-bearing.
- [x] Play, pause, stop, seek, and responsive score zoom preserve readable score-following
      highlighting and canonical identity. This tracer is deliberately one source and score page,
      so cross-page navigation is not applicable; it is not simulated merely to satisfy a checkbox.
- [x] Playback pitch, course-dependent sounding octave, timing, and repeats derive from the exact
      Tablature Interpretation rather than independent Verovio MIDI truth.
- [x] Changing the transcription or interpretation stales only dependent decisions and projections
      without rewriting prior versions.

## Blocked by

- 02 — De Visée diplomatic transcription and corrections

## Gates

Focused interpretation, decision-lineage, playback, and browser-workbench tests; then the base
gates plus browser, render, and playback evaluation. LilyPond sandbox verification applies only if
the existing LilyPond path changes.

## Evidence

- Exact course stringing (including octave pairs), frets, rhythm, tempo, and repeat traversal drive
  the edition playback events; Verovio supplies display identity but not a second MIDI truth.
- Acceptance records are immutable and purpose-scoped, contradictory successors require the exact
  prior decision, alternatives remain independent, and explicit revisions stale only dependent
  decisions.
- Base gates passed on the macOS host: 1,633 tests passed and four skipped; typecheck, formatting,
  spec verification, browser/server builds all passed.
- `npm run test:browser`: 44 scenarios passed, including provisional playback, play/pause/seek/stop,
  restrained highlighting through score zoom, and separate transcription/interpretation review.
- Pinned Nix shell: `npm run eval:render` and `npm run eval:playback` both passed.
- LilyPond source, compiler, and sandbox code were unchanged, so the LilyPond-only sandbox gate was
  not applicable.
