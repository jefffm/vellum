# 03 — Interpretation acceptance and synchronized playback

Status: ready-for-agent

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

## Reopened page-specific result

The attempted T05 review proved that the generic implementation did not establish a literal
page-9 interpretation. The current traversal repeats the entire page, but the source has two
separately repeated sections: measures 1–7 and 8–15, each preceded by its own pickup. The diplomatic
source also contains directional strums. Held-shape strums have no invented course/fret children;
explicit-chord strums preserve the source-written children. Playback must use exact interpretation
records for both cases and fail closed rather than silently advancing through an unresolved strum.
T03 becomes active again after the repaired T02 transcription lands.

## Remediation checkpoint

- Interpretation records now encode two disjoint written repeat sections, each with its own pickup,
  rather than one whole-page repeat count.
- Every historical strum requires an exact interpretation realization. Held-shape strums derive
  from accumulated course state; explicit-chord strums must agree with every written course/fret.
  Playback arpeggiates the realized courses in the encoded direction and fails closed when a strum
  is unresolved.
- Focused tests cover AABB traversal, both pickups, directional ordering, explicit disagreement,
  and unresolved-strum rejection. The host base gates, all 45 browser scenarios, and pinned render
  and playback evaluations pass.
- A fresh Chrome audition produced a persisted 72-BPM interpretation with a 1:17 AABB timeline and
  synchronized canonical-event highlighting. Acceptance remains blocked by T02's 69 unresolved
  source readings and the late Owner review.
