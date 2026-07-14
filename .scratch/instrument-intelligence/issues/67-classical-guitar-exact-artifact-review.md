# Classical-guitar exact-artifact review

Status: ready-for-human

Type: HITL

User stories: U6, U8, U10

SPEC coverage: Slice 14 target review; Release Complete target clauses

Requirement IDs: II-CG-006, II-RC-002–004, II-RC-007

## What to build

Physically, idiomatically, editorially, and musically review the exact digest-bound classical-guitar artifact under its pinned instance, performer context, brief, profile, and qualification.

## Acceptance criteria

- [ ] Target player tests exact joint-hand realization, voice independence, transitions, reliability, tempo, fatigue, and hidden fingering assumptions.
- [ ] Scope-qualified idiom reviewer assesses multi-voice texture, bass coherence/function/cadence, reduction choices, voice leading, and classical-guitar convention.
- [ ] Engraving/playback review covers stable voice layers, rests, stems, crossings, ties/spanners, written/sounding octave, isolated voices, full score, and score following.
- [ ] Reviewer identity/credential/scope/freshness and findings bind unchanged source, pack, system, qualification, score, instance, and deliverable digests.
- [ ] Event density or melody preservation cannot compensate for a failed bass/relationship/physical/notation dimension; blockers route to tracer 69.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T67-classical-guitar-exact-artifact-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T67-classical-guitar-exact-artifact-review.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`; `npm run review:validate`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T67/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

No exact held-out identity, asset, truth, expected observation, forbidden outcome, mutation, invalidation decision, reserve order/seed, or per-attempt diagnostic may enter this issue, Git, ordinary logs, or public evidence. Public receipts contain only opaque IDs, coverage classes, digests, aggregate status, exact claim scope, and redacted evidence. Exact private review forms/artifacts remain in authorized local storage or the Owner Evaluation Vault as applicable.

## Blocked by

- 64
