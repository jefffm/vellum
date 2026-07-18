# 04 — Passage prompting and model-assisted edits

Status: completed

Type: AFK

Blocked by: 03

## What to build

Let the Owner form contiguous or noncontiguous Passage Selections from the interactive edition,
inspect the deterministic Selection Context Envelope, and ask a model for explanation or typed
proposed changes. Review suggestions individually, preview the surviving set, and commit only an
explicitly approved layer-correct version with compact provenance.

## Acceptance criteria

- [x] Click, shift-click, range, Command/Ctrl-toggle, and role-filter gestures resolve to version-bound canonical
      selections rather than SVG coordinates.
- [x] Score zoom and responsive surface reflow preserve selection; later versions remap only through unambiguous lineage and
      otherwise mark the selection stale.
- [x] The context envelope exposes exact selected objects, bounded symbolic context, and remote
      payload; facsimile bytes are never included implicitly.
- [x] Fake-provider tests prove the model cannot retrieve hidden workspace context or write
      canonical MEI directly.
- [x] Transcription, interpretation, and emendation proposals remain separate; individual decisions
      rerender the complete staged result before atomic commit.
- [x] The resulting version links the Model Action Result Commit, original proposal, Owner
      decisions, approved batch, and canonical successor while rejected suggestions stay outside
      MEI.

## Blocked by

- 03 — Interpretation acceptance and synchronized playback

## Gates

Focused selection, Model Action boundary, provenance-validation, and browser-workbench tests; then
the base gates plus browser, render, and playback evaluation. LilyPond sandbox verification applies
only if the existing LilyPond path changes.

## Evidence

- The deterministic envelope is reconstructed from exact MEI identities, meter, tuning, bounded
  neighbors, and selected symbolic facts; it carries `facsimileIncluded: false` and no source bytes.
- The existing server-governed Model Action boundary discloses one owner-intent-only payload and no
  tools. A provider result remains inert until suggestion-level decisions form a fully rerendered
  typed batch.
- The committed successor validates and links the exact Selection Context digest, Model Action,
  publication, Result Commit, provider proposal, approved/revised/rejected decisions, and final
  Correction Batch. Rejected suggestions do not enter MEI.
- Base gates passed on the macOS host: 1,634 tests passed and four skipped; typecheck, formatting,
  spec verification, browser/server builds all passed.
- `npm run test:browser`: 45 scenarios passed, including range/noncontiguous/filter selection,
  selection through zoom and rerender, fake-provider egress, individual decisions, preview, and
  commit.
- Pinned Nix shell: `npm run eval:render` and `npm run eval:playback` both passed.
- LilyPond source, compiler, and sandbox code were unchanged, so the LilyPond-only sandbox gate was
  not applicable.
