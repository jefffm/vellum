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

The attempted T05 review on 2026-07-18 falsified the page-specific result predicate. Direct source
inspection establishes three ordinary spans on system one; four ordinary spans and a narrow 5/8
closing partial on system two; and the second-strain material on systems three and four. The builder
had assigned every system four equal numbered columns and then briefly misread a directional strum
as a new barline. The opening 1/8 and first-strain closing 5/8 are complementary partial measures;
the closing partial must be represented without inventing a sixteenth numbered measure or filling
silence with notes. At least one tracked course/fret chord also visibly disagrees with the source.
The earlier gates proved persistence and workflow behavior, not transcription truth. T02 therefore
remains active until the complete source map, musical content, partial measures, and repeat/return
marks are repaired and independently checked.

The review also found that the provisional extractor misclassified black noteheads between the top
two tablature lines as fret letters. In this French guitar source they are directional strum signs;
vertical lines through course letters indicate pincé simultaneity. The pickup was folded into the
first numbered measure, and the declared profile omitted both essential gesture types. An
Owner-supplied realization is available as a local comparison witness. It is more literal than the
Apke arrangement but remains editorial, is not perfectly accurate, and adds material. Neither
realization may override or fill the 1686 facsimile for course, fret, rhythm, gesture, ornament,
sustain, voice completion, register, or fingering evidence; disagreement stays unresolved rather
than being reconciled by preference. Neither local witness is tracked.

The corrected editorial numbering remains measures 1–7 and 8–15. The diplomatic structure must
add the source's partial-measure spans and event-level return signs without pretending they are
ordinary numbered bars. Comparison witnesses corroborate—but do not establish—this geometry and
the local metric anomaly. The source also demonstrates that strum direction and chord spelling are
independent evidence: some signs repeat a held shape, while an explicitly written chord can carry a
strum sign at the same onset. Its internal return signs remain part of the transcription and form
review rather than being flattened into an assumed AABB traversal.

## Remediation checkpoint

- The builder rejects a page without explicit inspected layout and maps the inspected 3/4/4/4
  numbered-measure structure plus the two strain pickups instead of assuming four equal systems.
  The source-linked first-strain closing partial is a distinct unnumbered `metcon=false` MEI
  measure after measure 7; encoding it as numbered measure 16 was tested and rejected.
- Critical readings have a deterministic review queue and source zoom. Confirming an unchanged
  reading is a first-class reversible review resolution; it no longer requires a fake MEI edit.
- Rhythm corrections resolve `dur` and `dots` on the enclosing `tabGrp`, matching MEI 5.1's data
  model, while rendered `tabDurSym` selection remains the user-facing anchor.
- Host gates passed: typecheck, formatting, current-spec verification, client build, server build,
  and 1,640 tests with four intentional skips. The full browser suite passed all 45 scenarios.
- Pinned Nix shell: `npm run eval:render` and `npm run eval:playback` both passed. LilyPond code was
  unchanged, so the LilyPond-only sandbox gate remained not applicable.
- The current 15-measure-plus-closing-partial draft renders 188 facsimile-linked tokens and a
  deterministic queue of 69 deliberately unresolved critical readings. Fresh Chrome review showed
  the partial and both `S.` return signs in the Verovio proof, no visible internal spacing anchors,
  and source-linked zoom beside the score. The Owner-local realization remains a comparison witness,
  not a source for resolving those readings.
