# Reassessment and governed learning proposals

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U2, U8, U9

SPEC coverage: Knowledge reassessment; feedback/state/learning; Slice 11

Requirement families touched: II-KNW-007, II-LEARN-001, II-EXEC-011, II-MC-001, II-MC-036

## What to build

Carry one corroborating source, one conflicting source, and one scoped Owner/edit/evaluator finding through immutable Reassessment into typed learning proposals without mutating old artifacts or auto-activating behavior.

## Acceptance criteria

- [ ] Comparison distinguishes corroboration, qualification, contradiction, supersession, advisory, retraction, rights change, and research question with exact evidence and scope.
- [ ] Affected analyses, plans, searches, scores, evaluations, releases, and qualifications receive Reassessments; prior bytes remain immutable.
- [ ] Edits, playtests, comments, comparisons, and evaluator disagreements receive typed scope/authority/confidence classifications.
- [ ] Personal Default, Ergonomic Profile, Knowledge Candidate, Calibration Candidate, and fixture proposals require explicit review/activation and cannot silently change generation.
- [ ] Workbench shows current/successor authority, affected work, conflicts, alternatives, unknowns, and why no automatic authority was granted.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T57-reassessment-governed-learning-proposals.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T57-reassessment-governed-learning-proposals.spec.ts`; `npm run eval:fast`; the tracer's rights and derivative-leak cases through the focused command.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T57/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 15
- 16
- 21
- 34
- 47
- 52
- 56
