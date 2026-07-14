# Baroque-guitar idiom and historical review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U2, U4, U8, U10

SPEC coverage: Slice 14 baroque-guitar idiom and historical authority

Requirement families touched: II-BG-001–007, II-RC-001, II-RC-004

## What to build

Review the exact T81 five-course baroque-guitar artifacts for idiomatic and historically scoped punteado, rasgueado, alfabeto, mixed-style, and Continuo behavior, independently of the physical playtest.

## Acceptance criteria

- [ ] Reviewer identity, baroque-guitar idiom/historical credentials, exact source/profile scope, freshness, revocation, and conflicts validate independently from target player, pack author, evaluator/calibrator, and developer.
- [ ] Review covers technique selection/transitions, right-hand resources, alfabeto chart/applicability, stroke/course masks, constituent behavior, voice prominence, resonance/damping, and Continuo labeling without universalizing one school, treatise, setup, or player.
- [ ] Every historical statement is checked against the exact released source-backed claim/profile; nonhistorical maintainers' rules and physical-player observations remain visibly separate.
- [ ] Immutable private attestation binds unchanged T81 package and every source/pack/profile/compiler/evaluator/qualification/output digest and records `pass`/`fail`/`blocked`/`incomplete`, disagreements, limitations, authorized private notes, and typed bounded public findings.
- [ ] Attempt finalizes even when nonpassing and routes findings to T69; no remediation occurs inside the review.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T88-baroque-guitar-idiom-historical-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T88-baroque-guitar-idiom-historical-review.spec.ts`.
- Toolchain: record review UI, credential verifier/Trust Policy, browser, OS, and exact package/source/profile identities.
- Observable outcome: submit/reload the real scoped review and prove out-of-scope, stale, or cross-package authority is rejected.
- Evidence: `../evidence/T88/verification.json` plus a redacted independent attestation receipt.

## Public/Vault boundary

Public evidence contains only opaque package/attestation IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, declared role/scope, validity, bounded aggregate status, and typed bounded findings. Exact held-out identity/truth, direct private-package digests, private source pages, credential evidence, notes, and diagnostics remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
