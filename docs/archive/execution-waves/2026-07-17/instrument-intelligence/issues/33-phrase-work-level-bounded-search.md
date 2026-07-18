# Phrase- and work-level bounded search

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3, U4, U5, U6

SPEC coverage: Phrase-level candidate state; search selection; Slice 5

Requirement families touched: II-MUS-013, II-EXEC-005C, II-MC-033

## What to build

Replace event-local selection with resumable bounded phrase/work search that carries every relevant musical, hand, technique, resonance, and obligation state and reports honest terminal outcomes.

## Acceptance criteria

- [ ] A repeated-theme two-phrase case requires global backtracking across phrase-boundary state; a local best cannot prune the only valid whole result.
- [ ] State identity includes all history needed for future feasibility, obligations, hands/resources, held/damped/resonant notes, technique, context, and phrase/work commitments.
- [ ] Search returns multiple non-dominated committed alternatives and preserves deterministic ordering under the same exact inputs.
- [ ] `found`, `unsat_proven`, `budget_exhausted`, `cancelled`, and `infrastructure_failed` remain distinct through persistence, API, UI, checkpoint, and reload.
- [ ] Safe-dominance/reference differential tests reject unsound pruning and overclaimed impossibility.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T33-phrase-work-level-bounded-search.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T33-phrase-work-level-bounded-search.spec.ts`; `npm run eval:fast`; `npm run perf:instrument-intelligence`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T33/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 27
- 28
- 29
- 30
- 31
- 32
