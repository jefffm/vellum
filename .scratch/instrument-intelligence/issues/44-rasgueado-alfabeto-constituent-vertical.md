# Rasgueado, alfabeto, and constituent-string vertical

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U2, U4

SPEC coverage: Rasgueado and alfabeto; Slice 8.2

Requirement families touched: II-BG-001–002, II-BG-004, II-EXEC-008B, II-MC-021

## What to build

Realize one reviewed chart-bound rasgueado/alfabeto gesture through lookup, plan, search, engraving, exact constituent playback, evaluation, and Workbench.

## Acceptance criteria

- [ ] Alfabeto chord identity binds chart/source, letter, shape, barré, tuning/stringing, applicability, and exact positions; lookup ambiguity remains visible.
- [ ] Gesture records ordered stroke direction/timing plus traversed, sounded, muted, and skipped edge masks; interior skips require explicit supported semantics.
- [ ] Resolved constituent pitches and attacks follow exact paired/unison/re-entrant strings with hold/release/resonance/damping state.
- [ ] Wrong chart, transposed letter, flat chord substitution, incorrect mask/order, missing suppression, and flattened/duplicate MIDI mutations fail.
- [ ] Workbench renders the alfabeto/gesture and lets the Owner hear/inspect exact constituents without test-only default activation.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T44-rasgueado-alfabeto-constituent-vertical.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T44-rasgueado-alfabeto-constituent-vertical.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T44/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 43
- 74
