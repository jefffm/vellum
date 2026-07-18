# 02 — De Visée diplomatic transcription and corrections

Status: completed

Type: AFK

Blocked by: 01

## What to build

Import the Owner-local de Visée page 9 into a provisional facsimile-linked Diplomatic Tablature
Transcription. Present the facsimile beside Verovio output, route Critical Uncertainty to legible
review, and let several typed corrections preview and commit atomically as one named Correction
Batch and canonical MEI version that survives reload.

## Acceptance criteria

- [x] Every token in the constrained diplomatic profile—rhythm signs, tablature letters, and
      measure/layout anchors—has a stable ID and facsimile region in schema-valid MEI. Marks outside
      this declared profile remain for Owner review rather than being silently inferred.
- [x] Structured extraction remains behind a backend-neutral adapter and records confidence and
      alternatives without treating confidence as acceptance.
- [x] The review UI provides legible source context, zoom, and non-obscuring uncertainty markers.
- [x] Staging, per-change preview, cancel, atomic commit, stale-parent conflict, and inverse-version
      undo are covered through the persisted API and UI.
- [x] Transcription Correction cannot silently become Interpretation Revision or Editorial
      Emendation.
- [x] Reload restores the exact canonical version, pending review state, facsimile links, and
      rendered edition.

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
