# Optical figured-bass truth vertical

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3, U7

SPEC coverage: Continuo Realization; first extraction fixtures; Slice 6

Requirement families touched: II-MUS-009, II-SEED-004, II-EXEC-006A, II-MC-014

## What to build

Carry a legally usable soprano-plus-figured-bass PDF through optical import and score-anchored review into canonical Figure Signs, Groups, continuation spans, constraint segments, and exact foundation alignment.

## Acceptance criteria

- [ ] Reviewed truth represents ordinary/altered figures, standalone accidentals, stacked groups, changes over held bass, continuation, and a prepared 4-3 suspension.
- [ ] Each sign/group/span has an exact source segment, bass/time/voice anchor, uncertainty, and correction lineage; generated-realization mappings exist only in a successor Continuo Realization Plan, never in immutable source truth.
- [ ] OCR/OMR uncertainty uses the conditional threshold UI only when optical review is active and does not loop after accepted review.
- [ ] Interruption/reload resumes at the exact unresolved figure and preserves completed truth.
- [ ] Foundation, figure, accidental, alignment, held-bass change, continuation, and suspension mutations fail outside generation.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T36-optical-figured-bass-truth.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T36-optical-figured-bass-truth.spec.ts`; `npm run eval:fast`; `npm run eval:omr`; `npm test -- src/server/lib/omr.real-smoke.test.ts` with any skip recorded as blocked, never pass; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T36/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 30
