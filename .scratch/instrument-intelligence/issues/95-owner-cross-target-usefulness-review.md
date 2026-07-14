# Owner cross-target usefulness review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U1, U2, U4, U5, U6, U8, U9, U10

SPEC coverage: Slice 14 Owner usefulness review

Requirement families touched: II-UX-001–004, II-RC-007

## What to build

Have the Owner use the unchanged T81 packages end to end and attest whether Guided Start, explanation/detail, alternatives, interactive feedback/edit/versioning, playback, history, and three coequal target experiences are useful for the intended personal workflow.

## Acceptance criteria

- [ ] Owner review opens each exact baroque-guitar, baroque-lute, and classical-guitar package through Guided Start, inspects assumptions/unknowns/evidence, compares alternatives, selects notes into prompts, batches manual edits into a new version, and exercises Audio Preview/score following/history/reload.
- [ ] Review records target-specific and cross-target usefulness, clarity, trust, failure recovery, requested detail depth, and whether the tool actually reduces specialist prompting; subjective usefulness does not replace physical, idiom, historical, rights, or editorial authority.
- [ ] Immutable attestation binds unchanged T81 packages, UI/build, system/qualification, score/playback/version digests, Owner identity/session, and review conditions.
- [ ] Every limitation, disagreement, and `pass`/`fail`/`blocked`/`incomplete` dimension is recorded independently; no aggregate satisfaction score hides a target or workflow failure.
- [ ] Attempt finalizes even when nonpassing and routes findings to T69 without repairing inside the review.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T95-owner-cross-target-usefulness-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T95-owner-cross-target-usefulness-review.spec.ts`; applicable render/playback tests.
- Toolchain: record review UI/build, browser/viewport, auth/session, renderer/playback, OS, and exact package identities.
- Observable outcome: complete/reload the real cross-target Owner review and prove subjective evidence remains non-authoritative outside Owner usefulness scope.
- Evidence: `../evidence/T95/verification.json` plus a redacted independent Owner attestation receipt.

## Public/Vault boundary

Public evidence contains only opaque package/attestation/UI IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, Owner-role validity, bounded aggregate per-workflow/target status, and typed bounded findings. Private preferences/comments, exact held-out material, direct private-package/UI digests, other reviewers' private notes, credentials, and diagnostics remain private/Vault data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
