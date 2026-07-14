# Continuo exact-artifact review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U3, U7, U8, U10

SPEC coverage: Slice 14 historical keyboard-Continuo review

Requirement families touched: II-MUS-009, II-RC-001, II-RC-005

## What to build

Have a qualified historical keyboard-continuo reviewer assess the exact soprano-plus-harpsichord realization, with a separate modern editorial review only if a piano adaptation is actually produced.

## Acceptance criteria

- [ ] Historical keyboard-continuo reviewer identity, credential, repertoire/profile scope, freshness, revocation, and conflicts validate independently from source reviewer, generator, evaluator/calibrator, and target-player reviewers.
- [ ] Review covers figures/accidentals, prepared suspension, bass-foundation coverage, spacing, doubling, voice leading, cadence, realization/disposition, soprano relationship, and full/isolated notation/playback under the exact profile.
- [ ] If a modern piano adaptation exists, a separately scoped modern-editorial attestation reviews it; piano evidence cannot qualify the historical harpsichord realization and absence of piano output requires no piano opinion.
- [ ] Immutable attestation binds unchanged T81 package and source/truth/profile/pack/compiler/evaluator/qualification/output digests and records non-compensating `pass`/`fail`/`blocked`/`incomplete` dimensions.
- [ ] Attempt finalizes even when nonpassing and routes findings to T69.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T91-continuo-exact-artifact-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T91-continuo-exact-artifact-review.spec.ts`; `npm run eval:render`; `npm run eval:playback`.
- Toolchain: record review UI, credential verifier, browser, Nix/LilyPond, OS, and exact package/profile/output identities.
- Observable outcome: submit/reload historical and conditional modern attestations and reject cross-profile compensation.
- Evidence: `../evidence/T91/verification.json` plus redacted independent attestation receipts.

## Public/Vault boundary

Public evidence contains only opaque package/attestation IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, declared role/profile scope, validity, bounded aggregate states, and typed bounded findings. Exact held-out source/truth, direct private-package digests, private credentials/notes, and diagnostics remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
