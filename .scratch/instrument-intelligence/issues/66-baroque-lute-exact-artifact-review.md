# Baroque-lute exact-artifact review

Status: ready-for-human

Type: HITL

User stories: U5, U8, U10

SPEC coverage: Slice 14 target review; Release Complete target/course-13 clauses

Requirement IDs: II-BL-006, II-RC-002–004, II-RC-007–008

## What to build

Physically, idiomatically, historically, editorially, and musically review the exact digest-bound thirteen-course-lute artifact under its pinned instance, brief, profile, and qualification.

## Acceptance criteria

- [ ] Target player tests the exact scale/geometry and records left-hand reach, whole-instrument right-hand allocation/preparation/crossing/thumb, diapason access, reliability, tempo, and fatigue.
- [ ] Scope-qualified idiom/historical reviewer assesses source-backed technique and every course-13 claim; unsupported historical notation remains explicitly unclaimed.
- [ ] Engraving/playback review covers French tablature sequence/placement, doubled courses, diapason transitions, pitch/MIDI identity, no duplicates, and playback marker.
- [ ] Reviewer identity/credential/scope/freshness and findings bind unchanged source, pack, system, qualification, score, instance, and deliverable digests.
- [ ] Unresolved physical, idiom, historical, notation, or playback finding remains nonpassing and routes to tracer 69.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T66-baroque-lute-exact-artifact-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T66-baroque-lute-exact-artifact-review.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`; `npm run review:validate`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T66/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

No exact held-out identity, asset, truth, expected observation, forbidden outcome, mutation, invalidation decision, reserve order/seed, or per-attempt diagnostic may enter this issue, Git, ordinary logs, or public evidence. Public receipts contain only opaque IDs, coverage classes, digests, aggregate status, exact claim scope, and redacted evidence. Exact private review forms/artifacts remain in authorized local storage or the Owner Evaluation Vault as applicable.

## Blocked by

- 64
