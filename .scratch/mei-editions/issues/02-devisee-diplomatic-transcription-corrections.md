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
      and measure/layout anchors—has a stable ID and a source region derived from inspected page
      geometry, not an evenly divided or assumed system grid. Marks outside this declared profile
      remain for Owner review rather than being silently inferred.
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
3, 4, 5, and 4 measures on its four systems (after the pickup), while the builder assigned every
system four equal columns. At least the first event of measure 7 also visibly disagrees with the
tracked provisional course/fret chord. The earlier gates proved persistence and workflow behavior,
not transcription truth. T02 therefore remains active until the complete source map and musical
content are repaired and independently checked.

## Remediation checkpoint

- The builder now rejects a page without explicit inspected system/measure layout and maps the
  actual 3/4/5/4 page structure instead of assuming four equal systems.
- Critical readings have a deterministic review queue and source zoom. Confirming an unchanged
  reading is a first-class reversible review resolution; it no longer requires a fake MEI edit.
- Rhythm corrections resolve `dur` and `dots` on the enclosing `tabGrp`, matching MEI 5.1's data
  model, while rendered `tabDurSym` selection remains the user-facing anchor.
- Host gates passed: typecheck, formatting, current-spec verification, client build, server build,
  and 1,636 tests with four intentional skips. The full browser suite passed all 45 scenarios.
- Pinned Nix shell: `npm run eval:render` and `npm run eval:playback` both passed. LilyPond code was
  unchanged, so the LilyPond-only sandbox gate remained not applicable.
