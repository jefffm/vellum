# Time-varying context and exact Transposition vertical

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3

SPEC coverage: Musical context, transposition, and spanners; Slice 5

Requirement families touched: II-MUS-004, II-EXEC-005A, II-MC-011

## What to build

Preserve internal key/meter changes and exact time- and part-scoped written-to-sounding behavior from reviewed source through plans, engraving, playback, reload, and evaluation.

## Acceptance criteria

- [ ] Context maps represent changing key, meter, clef, tempo/form, tuning/capo/scordatura, and part-specific written/sounding rules at exact ranges.
- [ ] Transposition Plan is structural rather than semitone-only and records source, target, part, time span, spelling, octave, and sounding consequences.
- [ ] Engraving, playback, score following, and persisted plans resolve the same canonical context after reload.
- [ ] Wrong-part, wrong-range, semitone-only, capo, scordatura, spelling, and octave mutations fail independently.
- [ ] Workbench exposes context transitions and unresolved assumptions without requiring a specialist prompt.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T24-time-varying-context-exact-transposition.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T24-time-varying-context-exact-transposition.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T24/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 23
