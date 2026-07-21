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

## Reopened page-specific result

The attempted T05 review proved that the generic implementation did not establish a literal
page-9 interpretation. Published numbering has measures 1–7 and 8–15, with complementary partial
measures and internal source return signs whose exact traversal must be resolved before acceptance.
The diplomatic source also contains directional strums. Held-shape strums have no invented
course/fret children;
explicit-chord strums preserve the source-written children. Playback must use exact interpretation
records for both cases and fail closed rather than silently advancing through an unresolved strum.
The repaired T02 transcription reopened this tracer; the remediation below completed it again.

## Remediation checkpoint

- Interpretation records now encode two disjoint written repeat sections, each with its own pickup,
  rather than one whole-page repeat count.
- Every historical strum requires an exact interpretation realization. Held-shape strums derive
  from accumulated course state; explicit-chord strums must agree with every written course/fret.
  Playback arpeggiates the realized courses in the encoded direction and fails closed when a strum
  is unresolved.
- Focused tests cover two pickup-led strains, directional ordering, explicit disagreement, and
  unresolved-strum rejection. The first-strain closing partial is traversed after its numbered
  measures on every pass. MEI 5.1 `repeatMark` anchors pair the source's two `S.` marks, and the
  second strain now plays once before repeating only the event-level petite-reprise span from
  `m11-event-4` through `m15-strum-4`. The final host base gates passed 1,640 tests with four
  intentional skips; all 45 browser scenarios and both pinned render/playback evaluations passed.
- A fresh Chrome audition persisted interpretation
  `tab-interpretation.529a7302-c0ab-4c32-8165-986454cc5878` at 72 BPM. Its 1:10 provisional
  timeline contains 330 sounding events, traverses both first-strain partials on both passes, plays
  measures 8–15 once, and then returns from the first `S.` in measure 11 through the final `S.` in
  measure 15. Canonical-event highlighting followed playback. Acceptance remains blocked only by
  T02's 69 unresolved source readings and the late Owner review.

## Source-adaptive remediation

- Source-adaptive Diplomatic Editions carry only the reviewed visible rhythm glyph and dot evidence;
  they do not encode semantic `dur` values. Every new Tablature Interpretation now names exactly
  one duration reading for every `tabGrp`, and playback reads only that immutable mapping. A legacy
  interpretation remains readable but fails closed for playback until revised with explicit event
  timing.
- The provisional interpretation proposal maps a visible stem and one-, two-, or three-flag signs
  to explicit duration readings and carries the last visible sign across literal `absent` signs.
  `unread` or leading unresolved absence cannot be auditioned. The complete explicit mapping,
  tunings, repeat sections, and strum realizations remain inspectable in the workbench.
- Ordinary source segments marked `metcon="false"` are no longer mistaken for pickups. Only an
  explicit `section-pickup` has pickup semantics, while reviewed `boundary-repeat-end` evidence can
  propose separate written repeat sections.
- The page-9 vertical-mark vocabulary distinguishes literal up- and down-arrow evidence without
  calling it a strum in the transcription. A Tablature Interpretation separately realizes each
  such target as a directional strum with exact held or written courses. A generic vertical mark
  remains undecided diplomatic evidence until the interpretation explicitly records either a
  pincé on a source-written simultaneity or an up/down strum; the workbench proposes pincé while
  keeping all three readings editable, and any omitted or contradictory resolution fails closed.
- When the source-linked staff is explicitly labeled `Guitare` and carries no semantic tuning, the
  page-9 proposal starts from Vellum's existing five-course French stringing. The editable tuning
  remains part of the exact interpretation rather than being written into diplomatic MEI.
- Remediation gates passed on the macOS host: 1,644 tests passed with four intentional skips;
  typecheck, formatting, specification verification, client build, and server build all passed.
  All 46 browser scenarios passed with the Podman VM kept in the same process lifetime as the real
  LilyPond workflow, and the pinned Nix render and playback evaluations both passed.
