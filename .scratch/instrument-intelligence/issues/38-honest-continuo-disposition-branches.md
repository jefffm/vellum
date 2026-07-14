# Honest Continuo disposition branches

Status: ready-for-agent

Type: AFK

User stories: U3, U7

SPEC coverage: Continuo Disposition; Slice 6

Requirement IDs: II-MUS-009, II-EXEC-006B, II-MC-014

## What to build

Demonstrate complete-on-target, complete-with-separate-bass, policy-valid labeled reduction, and correctly rejected Continuo dispositions using the same reviewed foundation.

## Acceptance criteria

- [ ] Each branch is chosen before search, covers the entire foundation set, records target capacity/policy, and produces distinct deliverable lineage.
- [ ] Complete-with-separate-bass includes an exact separate bass part; a re-entrant or otherwise incomplete target cannot imply completeness.
- [ ] Reduction is visibly and machine-readably labeled, lists omitted/altered obligations, and never inherits complete-realization readiness.
- [ ] An incapable faithful target rejects with typed Plan Conflict and meaningful alternatives.
- [ ] Notation, playback, Workbench labels, audit, Cards, and exports agree on disposition.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T38-honest-continuo-disposition-branches.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T38-honest-continuo-disposition-branches.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T38/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 30
- 37
