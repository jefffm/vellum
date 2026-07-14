# Canonical spanner and ornament vertical

Status: ready-for-agent

Type: AFK

User stories: U3

SPEC coverage: Musical context, transposition, and spanners; Slice 5

Requirement IDs: II-MUS-005, II-EXEC-005A, II-MC-013, II-MC-025

## What to build

Represent canonical ties, slurs, phrase marks, and source-notated ornaments once, then preserve their lineage and distinct notation/playback behavior across score, arrangement, rendering, playback, and reload.

## Acceptance criteria

- [ ] Multi-segment tie chains, slurs, phrase marks, and typed source ornaments retain exact endpoints, voice/context, source citations, and successor lineage.
- [ ] A tie chain engraves as tied notation and plays as one uninterrupted occurrence without reattack; slurs and phrase marks do not change duration.
- [ ] Ornament literal notation and interpretive playback remain separately identified and profile-scoped.
- [ ] Broken endpoint, wrong voice, duplicated attack, lost segment, slur-as-tie, and unsupported ornament mutations fail.
- [ ] Score selection and playback following highlight canonical occurrences without obscuring the notation.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T26-canonical-spanner-ornament-vertical.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T26-canonical-spanner-ornament-vertical.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T26/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 23
- 24
