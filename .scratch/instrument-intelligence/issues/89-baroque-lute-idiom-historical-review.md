# Baroque-lute idiom and historical review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U2, U5, U8, U10

SPEC coverage: Slice 14 thirteen-course lute idiom and historical authority

Requirement families touched: II-BL-001–006, II-RC-001, II-RC-004, II-RC-008

## What to build

Review the exact T81 thirteen-course baroque-lute artifacts for idiomatic and historically scoped left/right-hand behavior, diapasons, resonance, and notation claims independently of physical playtesting and engraving review.

## Acceptance criteria

- [ ] Reviewer identity, baroque-lute idiom/historical credentials, instrument/source/profile scope, freshness, revocation, and conflicts validate independently from target player, pack author, evaluator/calibrator, and developer.
- [ ] Review covers calibrated stopped-course technique, right-hand allocation/preparation/simultaneity/alternation/crossing/thumb, stopped-to-diapason transitions, diapason succession, resonance/damping, and applicability to the exact thirteen-course setup.
- [ ] Mace/twelve-course, Serdoura, repertoire, modern pedagogical/editorial, software, and Owner ergonomic evidence remain separately scoped; unsupported course-13 historical signs stay explicitly `not_claimed`.
- [ ] Immutable private attestation binds unchanged T81 package and source/pack/profile/compiler/evaluator/qualification/output digests and records `pass`/`fail`/`blocked`/`incomplete`, disagreement, limitations, authorized private notes, and typed bounded public findings.
- [ ] Attempt finalizes even when nonpassing and routes findings to T69 without repairing inside the review.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T89-baroque-lute-idiom-historical-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T89-baroque-lute-idiom-historical-review.spec.ts`.
- Toolchain: record review UI, credential verifier/Trust Policy, browser, OS, and exact package/source/profile identities.
- Observable outcome: submit/reload the real scoped review and reject unsupported course-13 or cross-profile authority.
- Evidence: `../evidence/T89/verification.json` plus a redacted independent attestation receipt.

## Public/Vault boundary

Public evidence contains only opaque package/attestation IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, declared role/scope, validity, bounded aggregate status, and typed bounded findings. Exact held-out identity/truth, direct private-package digests, private source pages, credentials, notes, and diagnostics remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
