# Baroque-guitar known-bad rejection

Status: ready-for-agent

Type: AFK

User stories: U4, U8

SPEC coverage: Baroque-guitar acceptance; Regression contracts; Slice 8.1

Requirement IDs: II-BG-002–003, II-BG-007, II-EVAL-007, II-EXEC-008A, II-MC-018, II-NG-008

## What to build

Freeze the exact observed unidiomatic Greensleeves baroque-guitar output as development evidence and prove independent evaluators reject it before changing production generation.

## Acceptance criteria

- [ ] Content-addressed bundle pins source/plan/instance/search/output/notation/playback identities and the observed course/fret reach and cross-neck jump.
- [ ] Independent gates reject principal-voice loss, two-dimensional reach/transition, left/right-hand allocation, stroke/traverse/sound/mute masks, Gesture Sequence, held/released/damped state, and playback disagreement.
- [ ] Each failure is observable and separately mutated; no scalar comfort score or fret distance alone substitutes.
- [ ] Production output remains unchanged while the red fixture proves the regression.
- [ ] Public evidence uses Greensleeves only as disclosed development evidence and makes no general idiom claim.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T42-baroque-guitar-known-bad-rejection.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T42-baroque-guitar-known-bad-rejection.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T42/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 32
- 34
- 35
