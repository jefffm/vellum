# 02 — De Visée diplomatic transcription and corrections

Status: ready-for-agent

Type: AFK

Blocked by: 01

## What to build

Import the Owner-local de Visée page 9 into a provisional facsimile-linked Diplomatic Tablature
Transcription. Present the facsimile beside Verovio output, route Critical Uncertainty to legible
review, and let several typed corrections preview and commit atomically as one named Correction
Batch and canonical MEI version that survives reload.

## Acceptance criteria

- [ ] Every diplomatic token has a stable ID and facsimile region in schema-valid constrained MEI.
- [ ] Structured extraction remains behind a backend-neutral adapter and records confidence and
      alternatives without treating confidence as acceptance.
- [ ] The review UI provides legible source context, zoom, and non-obscuring uncertainty markers.
- [ ] Staging, per-change preview, cancel, atomic commit, stale-parent conflict, and inverse-version
      undo are covered through the persisted API and UI.
- [ ] Transcription Correction cannot silently become Interpretation Revision or Editorial
      Emendation.
- [ ] Reload restores the exact canonical version, pending review state, facsimile links, and
      rendered edition.

## Blocked by

- 01 — Secure pinned Verovio edition vertical
