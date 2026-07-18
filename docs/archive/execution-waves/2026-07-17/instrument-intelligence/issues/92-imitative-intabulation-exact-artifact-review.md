# Imitative-intabulation exact-artifact review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U3, U8, U10

SPEC coverage: Slice 14 imitative-intabulation review

Requirement families touched: II-MUS-008, II-RC-001, II-RC-005, II-EXEC-014D, II-NG-010

## What to build

Have a qualified imitative-intabulation reviewer assess the exact three-voice source and six-course-lute output whose identity depends on ordered entries.

## Acceptance criteria

- [ ] Reviewer identity, contrapuntal/intabulation credential, source/target/profile scope, freshness, revocation, and conflicts validate independently from transcription reviewer, generator, evaluator/calibrator, and other roles.
- [ ] Review covers ordered entries, subject shapes and transformations, voice identity/continuity/exchange, active/rest spans, cadence, realization choices, target fit, and full/isolated notation/playback.
- [ ] Texture density, copied pitch sets, or a successful cadence cannot compensate for lost/reordered entries or broken voice identity.
- [ ] Immutable private attestation binds unchanged T81 package and source/truth/profile/pack/compiler/evaluator/qualification/output digests and records `pass`/`fail`/`blocked`/`incomplete`, disagreements, limitations, authorized private notes, and typed bounded public findings.
- [ ] Attempt finalizes even when nonpassing and routes findings to T69.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T92-imitative-intabulation-exact-artifact-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T92-imitative-intabulation-exact-artifact-review.spec.ts`; `npm run eval:render`; `npm run eval:playback`.
- Toolchain: record review UI, credential verifier, browser, Nix/LilyPond, OS, and exact package/profile/output identities.
- Observable outcome: submit/reload the review and prove reordered-entry and cross-package evidence cannot pass.
- Evidence: `../evidence/T92/verification.json` plus a redacted independent attestation receipt.

## Public/Vault boundary

Public evidence contains only opaque package/attestation IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, declared role/profile scope, validity, bounded aggregate status, and typed bounded findings. Exact held-out source/truth, direct private-package digests, credentials, notes, and diagnostics remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
