# 04 — Passage prompting and model-assisted edits

Status: ready-for-agent

Type: AFK

Blocked by: 03

## What to build

Let the Owner form contiguous or noncontiguous Passage Selections from the interactive edition,
inspect the deterministic Selection Context Envelope, and ask a model for explanation or typed
proposed changes. Review suggestions individually, preview the surviving set, and commit only an
explicitly approved layer-correct version with compact provenance.

## Acceptance criteria

- [ ] Click, shift-click, range, and role-filter gestures resolve to version-bound canonical
      selections rather than SVG coordinates.
- [ ] Zoom and reflow preserve selection; later versions remap only through unambiguous lineage and
      otherwise mark the selection stale.
- [ ] The context envelope exposes exact selected objects, bounded symbolic context, and remote
      payload; facsimile bytes are never included implicitly.
- [ ] Fake-provider tests prove the model cannot retrieve hidden workspace context or write
      canonical MEI directly.
- [ ] Transcription, interpretation, and emendation proposals remain separate; individual decisions
      rerender the complete staged result before atomic commit.
- [ ] The resulting version links the Model Action Result Commit, original proposal, Owner
      decisions, approved batch, and canonical successor while rejected suggestions stay outside
      MEI.

## Blocked by

- 03 — Interpretation acceptance and synchronized playback
