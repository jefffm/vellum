# 02 — De Visée diplomatic transcription and corrections

Status: in-progress

Type: AFK

Blocked by: 01

## What to build

Import the Owner-local de Visée page 9 into a provisional facsimile-linked Diplomatic Tablature
Transcription. Present the facsimile beside Verovio output, route Critical Uncertainty to legible
review, and let several typed corrections preview and commit atomically as one named Correction
Batch and canonical MEI version that survives reload.

## Acceptance criteria

- [ ] Every visible token in the constrained diplomatic profile—rhythm signs, tablature letters,
      strum direction, pincé simultaneity, and measure/layout anchors—has a stable ID and a source
      region derived from inspected page geometry, not an evenly divided or assumed system grid.
      Marks outside this declared profile remain for Owner review rather than being silently
      inferred.
- [ ] The complete page-specific musical content is checked event by event against the facsimile
      and an independent sounding witness where one is available. Disagreements and marks that
      cannot be read confidently remain Critical Uncertainty; plausible-looking filler is forbidden.
- [x] Structured extraction remains behind a backend-neutral adapter and records confidence and
      alternatives without treating confidence as acceptance.
- [x] The review UI provides a deterministic Critical Uncertainty queue, legible source context,
      zoom, and non-obscuring uncertainty markers.
- [x] Staging, per-change preview, cancel, atomic commit, stale-parent conflict, and inverse-version
      undo are covered through the persisted API and UI. A correct uncertain reading can be
      confirmed as a reversible review decision without inventing an MEI attribute change.
- [x] Transcription Correction cannot silently become Interpretation Revision or Editorial
      Emendation.
- [ ] Reload restores the exact canonical version, pending review state, truthful facsimile links,
      and source-checked rendered edition.

## Blocked by

- 01 — Secure pinned Verovio edition vertical

## Gates

Focused domain, persistence, provisional-page, and correction-workspace tests; then the base gates
plus browser, render, and playback evaluation. LilyPond sandbox verification applies only if the
existing LilyPond path changes.

## Evidence

- The Owner-local source was imported from outside Git; the tracked provisional data contains no
  facsimile bytes and asserts no transcription acceptance.
- Base gates passed on the macOS host: 1,631 tests passed and four skipped; typecheck, formatting,
  spec verification, browser/server builds all passed.
- `npm run test:browser`: 43 scenarios passed, including source zoom, transparent region marking,
  staged cancel, multi-change preview, atomic commit, reload, and inverse-version undo.
- Pinned Nix shell: `npm run eval:render` and `npm run eval:playback` both passed.
- LilyPond source, compiler, and sandbox code were unchanged, so the LilyPond-only sandbox gate was
  not applicable.

## Reopened finding

The attempted T05 review on 2026-07-18 falsified the page-specific result predicate. The source has
3, 4, 4, and 4 numbered measures on its four systems, plus an opening pickup and a second-strain
pickup at the start of system three; the builder assigned every system four equal numbered columns.
At least the first event of measure 7 also visibly disagrees with the
tracked provisional course/fret chord. The earlier gates proved persistence and workflow behavior,
not transcription truth. T02 therefore remains active until the complete source map and musical
content are repaired and independently checked.

The review also found that the provisional extractor misclassified black noteheads between the top
two tablature lines as fret letters. In this French guitar source they are directional strum signs;
vertical lines through course letters indicate pincé simultaneity. The pickup was folded into the
first numbered measure, and the declared profile omitted both essential gesture types. A more
literal Owner-supplied realization is available as a local comparison witness; it supersedes the
Apke arrangement as the sounding/rhythmic cross-check but does not override the 1686 facsimile for
course, fret, gesture, ornament, or sustain evidence. Neither local witness is tracked.

That literal witness also falsified the sixteen-measure count. The narrow opening of source system
three is an anacrusis into the second strain. The diplomatic structure is therefore an opening
pickup, measures 1–7, a second-strain pickup, and measures 8–15. It also demonstrates that strum
direction and chord spelling are independent evidence: some signs repeat a held shape, while an
explicitly written chord can carry a strum sign at the same onset.

## Remediation checkpoint

- The builder now rejects a page without explicit inspected system/measure layout and maps the
  actual 3/4/4/4 numbered-measure structure plus the two strain pickups instead of assuming four
  equal systems.
- Critical readings have a deterministic review queue and source zoom. Confirming an unchanged
  reading is a first-class reversible review resolution; it no longer requires a fake MEI edit.
- Rhythm corrections resolve `dur` and `dots` on the enclosing `tabGrp`, matching MEI 5.1's data
  model, while rendered `tabDurSym` selection remains the user-facing anchor.
- Host gates passed: typecheck, formatting, current-spec verification, client build, server build,
  and 1,640 tests with four intentional skips. The full browser suite passed all 45 scenarios.
- Pinned Nix shell: `npm run eval:render` and `npm run eval:playback` both passed. LilyPond code was
  unchanged, so the LilyPond-only sandbox gate remained not applicable.
- A fresh Owner-local import rendered 184 facsimile-linked tokens and a deterministic queue of 69
  deliberately unresolved critical readings. Chrome showed 21 compact historical strum arrows
  (18 up, 3 down), no visible internal spacing anchors, and source-linked zoom beside the score.
