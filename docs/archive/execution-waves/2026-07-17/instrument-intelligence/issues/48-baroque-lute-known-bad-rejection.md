# Baroque-lute known-bad rejection

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U5, U8

SPEC coverage: Baroque-lute acceptance; Regression contracts; Slice 9.1

Requirement families touched: II-BL-001–004, II-BL-006, II-EVAL-007, II-EXEC-009A, II-MC-018, II-NG-008

## What to build

Freeze the exact observed Greensleeves baroque-lute output containing the first-position `f`/`b` reach and prove independent evaluators reject it before production repair.

## Acceptance criteria

- [ ] Content-addressed bundle pins source, exact ~690 mm instance/context, plan, search, output, tablature, playback, and the offending occurrences/transitions.
- [ ] Evaluator rejects the reach using calibrated two-dimensional finger/contact geometry and transition state, not fret span alone.
- [ ] Course allocation, digit allocation, preparation, simultaneity, alternation, crossing, thumb behavior, stopped-course/diapason transition, notation, and playback failures report independently.
- [ ] Production output remains unchanged while red cases and controlled mutations prove the regression.
- [ ] The content-addressed bad output and expected failing observations remain immutable, permanently failing development evidence; later repair records distinct run and output identities.
- [ ] Evidence is explicitly development-only and makes no general lute-idiom or player-playability claim.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T48-baroque-lute-known-bad-rejection.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T48-baroque-lute-known-bad-rejection.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T48/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 32
- 34
- 35
