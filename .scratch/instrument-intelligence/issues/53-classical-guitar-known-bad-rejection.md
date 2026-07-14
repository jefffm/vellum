# Classical-guitar known-bad rejection

Status: ready-for-agent

Type: AFK

User stories: U6, U8

SPEC coverage: Classical-guitar acceptance; Regression contracts; Slice 10.1

Requirement IDs: II-CG-001–004, II-CG-006, II-EVAL-007, II-EXEC-010A, II-MC-018, II-NG-008

## What to build

Freeze the exact Greensleeves classical-guitar output whose bass disappears and prove independent evaluators reject it before repair.

## Acceptance criteria

- [ ] Bundle pins source voices, Target Voice/Harmonic/Relationship Plans, exact instance/context, candidate, standard notation, isolated/full playback, and every bass activity/rest/cadence span.
- [ ] Evaluator rejects dropped/incoherent bass, false two-voice presentation, missing function/cadence/duration, impossible mechanics, notation mismatch, and playback mismatch independently.
- [ ] Event count, sounding density, low pitch, or continuous sound cannot substitute for coherent bass voice identity and relationships.
- [ ] Production output remains unchanged while controlled omission/rest/crossing/tie/octave mutations prove the red regression.
- [ ] Evidence is development-only and makes no general classical-guitar idiom claim.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T53-classical-guitar-known-bad-rejection.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T53-classical-guitar-known-bad-rejection.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T53/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 32
- 34
- 35
