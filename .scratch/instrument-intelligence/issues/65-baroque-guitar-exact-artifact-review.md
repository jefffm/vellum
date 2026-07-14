# Baroque-guitar exact-artifact review

Status: ready-for-human

Type: HITL

User stories: U4, U8, U10

SPEC coverage: Slice 14 target review; Release Complete target clauses

Requirement IDs: II-BG-007, II-EXEC-014A, II-RC-002–004, II-RC-007

## What to build

Physically, idiomatically, historically, editorially, and musically review the exact digest-bound baroque-guitar artifact under its pinned Instrument Instance, Performance Brief, profile, and qualification.

## Acceptance criteria

- [ ] Target player physically tests the exact artifact/context and records reach, transitions, reliability, tempo, fatigue, and technique-specific findings.
- [ ] Scope-qualified idiom/historical reviewer assesses punteado, rasgueado, alfabeto, mixed-style, gesture/masks, voice prominence, and Continuo labeling without universalizing one style.
- [ ] Engraving/playback review covers exact constituents, tablature/notation, stroke/gesture legibility, Audio Preview, and score following.
- [ ] Reviewer identity/credential/scope/freshness and every finding/disagreement bind unchanged source, pack, system, qualification, score, and deliverable digests.
- [ ] Missing scope or unresolved blocking finding remains incomplete/failed and routes to tracer 69; no novice ergonomic evidence becomes historical authority.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T65-baroque-guitar-exact-artifact-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T65-baroque-guitar-exact-artifact-review.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`; `npm run review:validate`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T65/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

No exact held-out identity, asset, truth, expected observation, forbidden outcome, mutation, invalidation decision, reserve order/seed, or per-attempt diagnostic may enter this issue, Git, ordinary logs, or public evidence. Public receipts contain only opaque IDs, coverage classes, digests, aggregate status, exact claim scope, and redacted evidence. Exact private review forms/artifacts remain in authorized local storage or the Owner Evaluation Vault as applicable.

## Blocked by

- 64
