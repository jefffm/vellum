# Classical-guitar idiom review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U2, U6, U8, U10

SPEC coverage: Slice 14 classical-guitar idiom and voice-leading authority

Requirement families touched: II-CG-001–006, II-RC-001, II-RC-004

## What to build

Review the exact T81 classical-guitar artifacts for idiomatic multi-voice texture, harmonic reduction, voice leading, and target convention independently of physical playtesting and engraving review.

## Acceptance criteria

- [ ] Reviewer identity, classical-guitar idiom credentials, source/profile scope, freshness, revocation, and conflicts validate independently from target player, pack author, evaluator/calibrator, and developer.
- [ ] Review covers principal/bass and three-voice identity, active/rest spans, independence, function/inversion/cadence, reduction choices, voice leading, register, texture, and convention without mistaking event density or low pitches for a coherent voice.
- [ ] Sor, Carulli, modern pedagogy/editorial convention, mechanics, and Owner preferences remain separately scoped; the exact right-hand profile is reviewed without universalizing `p-i-m-a`.
- [ ] Immutable private attestation binds unchanged T81 package and all source/pack/profile/compiler/evaluator/qualification/output digests and records `pass`/`fail`/`blocked`/`incomplete`, disagreements, limitations, authorized private notes, and typed bounded public findings.
- [ ] Attempt finalizes even when nonpassing and routes findings to T69 without repairing inside the review.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T90-classical-guitar-idiom-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T90-classical-guitar-idiom-review.spec.ts`.
- Toolchain: record review UI, credential verifier/Trust Policy, browser, OS, and exact package/source/profile identities.
- Observable outcome: submit/reload the real scoped review and reject density-based, stale, or cross-package evidence.
- Evidence: `../evidence/T90/verification.json` plus a redacted independent attestation receipt.

## Public/Vault boundary

Public evidence contains only opaque package/attestation IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, declared role/scope, validity, bounded aggregate status, and typed bounded findings. Exact held-out identity/truth, direct private-package digests, private source pages, credentials, notes, and diagnostics remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
