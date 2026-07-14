# Baroque-lute development acceptance and course-13 claims

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U5, U8

SPEC coverage: Baroque-lute evidence/readiness and acceptance; Slice 9.4

Requirement families touched: II-BL-006, II-EVAL-008, II-EXEC-009D, II-MC-018, II-MC-022–023, II-RC-008

## What to build

Close lute development acceptance with a new repaired Greensleeves generative regression, complete Regression Bundle, and an evidence-honest course-13 notation policy while retaining the original bad output as permanently failing evidence.

## Acceptance criteria

- [ ] The immutable T48 bad-output bundle still produces its pinned failures; a separate generative regression binds the disclosed source/input, old-system run digest, repaired-system run/output digests, and unchanged evaluator identities, proving old generation fails and new generation passes.
- [ ] Golden fixture and required mutations pass under exact development system/profile/evaluator identities.
- [ ] Editorial course-13 sign is displayed as `not_claimed`; a historically scoped profile stays unresolved unless directly applicable released evidence exists.
- [ ] No Mace twelve-course statement, modern convention, corpus frequency, or Owner preference is generalized into a historical course-13 claim.
- [ ] Default Guided Start cannot activate test-only historical knowledge and displays exact readiness, evidence scope, and unknowns.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T52-baroque-lute-development-acceptance.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T52-baroque-lute-development-acceptance.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T52/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 51
