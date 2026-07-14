# Baroque-guitar physical target-player review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U4, U8, U10

SPEC coverage: Slice 14 target-player physical playtest; Release Complete target clauses

Requirement families touched: II-BG-007, II-RC-002–003

## What to build

Have a qualified five-course baroque-guitar player physically test the exact digest-bound review artifact under its pinned Instrument Instance, Performance Brief, profile, tempo, and qualification. This review covers physical realization only; idiom and historical authority belong to T88.

## Acceptance criteria

- [ ] Reviewer identity, target-instrument credential, scope, freshness, conflicts, instrument/stringing setup, and review conditions validate independently.
- [ ] Player tests exact reaches, transitions, left/right-hand allocation, punteado contacts, rasgueado traversals/masks, preparation, holds, releases, damping, reliability, tempo, and fatigue without claiming historical authority from ergonomic evidence.
- [ ] Review binds the unchanged T81 package, source, instance, profile, pack, compiler, evaluator, qualification, score, playback, and deliverable digests.
- [ ] Every finding, limitation, disagreement, and `pass`/`fail`/`blocked`/`incomplete` result is recorded as an immutable independent attestation; missing scope or a blocking finding cannot be compensated by another review.
- [ ] Completion means this review attempt is finalized even when it fails. It reports findings to T69 and never waits for remediation inside this tracer.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T65-baroque-guitar-physical-player-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T65-baroque-guitar-physical-player-review.spec.ts`.
- Toolchain: record review UI, credential verifier, browser, OS, exact package, instrument instance, and playback/render identities that materially affect the review.
- Observable outcome: submit and reload the real digest-bound physical playtest; verify unchanged-package binding and independent attestation status.
- Evidence: `../evidence/T65/verification.json` plus the redacted attestation receipt; private notes remain authorized review storage.

## Public/Vault boundary

Public evidence contains only opaque package/attestation IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, reviewer-role validity, bounded aggregate status, public scope, and typed bounded findings. Exact held-out identity/truth, direct private-package digests, source assets, per-case diagnostics, private credential material, and unredacted physical observations remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
