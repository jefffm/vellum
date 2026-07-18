# Three-voice imitative Golden vertical

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3, U7

SPEC coverage: Imitative-counterpoint relationship vertical; Slice 7

Requirement families touched: II-MUS-008, II-EXEC-007A, II-MC-015

## What to build

Carry the legally usable three-voice imitative fixture through Analysis, scoped Validation Profile, manifest, Voice/Relationship Plans, bounded six-course Renaissance-lute search, engraving, isolated playback, audit, evaluation, and Workbench.

## Acceptance criteria

- [ ] Ordered entries, subject interval-rhythm shapes, voice continuities/exchanges, contrapuntal relations, and cadence goals remain explicit.
- [ ] No permanent Principal Voice is invented; prominence and obligations may transfer by span.
- [ ] Six-course realization maps every source/target voice and relationship into playable candidate events with honest compromises.
- [ ] Full and isolated voice engraving/playback share canonical identity and preserve entry order after reload.
- [ ] Workbench shows relationship timelines, alternatives, audit, Evaluation Card, and scoped profile claims.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T40-three-voice-imitative-golden-vertical.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T40-three-voice-imitative-golden-vertical.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T40/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 14
- 29
- 34
- 35
