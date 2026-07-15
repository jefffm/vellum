# Interactive note selection, prompting, batch edits, and versioning

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U9

SPEC coverage: Workbench selection-aware feedback and manual versioning; Slice 11

Requirement families touched: II-UX-002–004, II-OUT-003, II-EXEC-011, II-MC-035–036, II-EXEC-011F

## What to build

Turn rendered note/tablature selection into stable occurrence-aware prompt context and atomic manual edit batches that save as new immutable arrangement versions with explicit adoption and lineage.

## Acceptance criteria

- [ ] Single, range, additive, and discontiguous multi-selection maps visible standard-notation/tab occurrences to canonical event/voice/bar/beat/course/string identities; zoom, reflow, pagination, playback following, and reload preserve or honestly invalidate selection.
- [ ] Prompt composer displays the exact selected canonical context, target/instance/profile, surrounding phrase scope, relevant plans/manifest, and redaction/egress preview; server-minted Egress Envelope and Result Commit prevent arbitrary client context or hidden held-out/private leakage.
- [ ] Manual operations support pitch/rhythm/voice/course/fret/digit/technique/notation metadata within schema and target constraints, validate the entire batch atomically, and show deterministic preview/diff/errors before save.
- [ ] Saving never mutates the selected version: it creates a new immutable version with parent, edit batch, author/time/reason, affected evidence, regeneration/evaluation status, and independent Adoption Decision; cancel/undo leaves no partial version.
- [ ] Browser E2E selects several notes, prompts on only that scope, applies a valid batch and rejects an invalid batch, adopts the new version, reloads history/selection/playback, and preserves sibling target versions.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T99-interactive-selection-prompt-edit-versioning.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T99-interactive-selection-prompt-edit-versioning.spec.ts`; `npm run eval:fast`; applicable render/playback, adversarial provider/egress, lineage, and stale-selection cases.
- Toolchain: record Node/npm, browser/viewport, provider/fake-provider, selection/edit/version schemas, renderer/playback, OS, and exact disclosed fixtures.
- Observable outcome: perform and reload the complete selection→prompt→batch-preview→new-version→adoption path in the production Workbench.
- Evidence: `../evidence/T99/verification.json` plus rights-cleared disclosed-fixture screenshots, diffs, and digest-bound version receipts.

## Public/Vault boundary

Public evidence may contain only explicitly rights-cleared development selections/prompts/diffs, opaque IDs, keyed non-resolving Vault commitments, and digests of already-public artifacts. Exact private/held-out selections, source content, prompts/responses, direct private-content digests, truth, credentials, reviewer notes, reserve state, and diagnostics remain private/Vault data and are excluded from egress unless explicitly authorized.

## Blocked by

- 02
- 10
- 34
