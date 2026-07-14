# Historical-claim and pack-profile review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U2, U3, U4, U5, U6, U7, U8, U10

SPEC coverage: Slice 14 historical-claim and Knowledge Pack profile review

Requirement families touched: II-KNW-001–007, II-RC-001, II-RC-015

## What to build

Have scope-qualified historians/domain reviewers validate the exact historical claims, source scopes, applicability predicates, release/attestation authority, and Applied Knowledge profiles used by every T81 package.

## Acceptance criteria

- [ ] Reviewer identities, domain/source/profile credentials, scope, freshness, revocation, and conflicts validate independently from pack author, extractor, generator, evaluator/calibrator, and target artifact reviewers.
- [ ] Review traces every authority-bearing claim to exact cited released evidence and checks claim kind, language/time/place/school/instrument/technique/tuning/stringing/repertoire scope, confidence, contradictions, exclusions, applicability parameters, and unresolved questions.
- [ ] Pack content, immutable release, separate attestation, profile, component registry, Catalog, Resolution Policy, and Applied Knowledge Manifest bindings are complete and compatible; test-only, nonhistorical, pedagogical, software, ergonomic, and Owner defaults remain distinctly labeled and cannot escalate.
- [ ] Declarative-only safety, dependency cycles, source conflicts, successor/reassessment/advisory state, and default activation are reviewed without treating corpus frequency or developer interpretation as historical authority.
- [ ] Immutable independent attestations bind unchanged T81 package and exact source/claim/pack/release/attestation/profile/manifest/output digests; attempt finalizes pass/fail/blocked/incomplete and routes findings to T69.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T101-historical-claim-pack-profile-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T101-historical-claim-pack-profile-review.spec.ts`; focused pack-safety, credential/scope, applicability, activation, cycle, conflict, rights, and leak tests.
- Toolchain: record review UI, credential verifier/Trust Policy, pack/release/attestation/profile schemas, browser, OS, and exact package/source identities.
- Observable outcome: submit/reload scoped claim/profile attestations and prove stale, test-only, out-of-scope, executable, or cyclic knowledge cannot qualify output.
- Evidence: `../evidence/T101/verification.json` plus redacted independent attestation receipts.

## Public/Vault boundary

Public evidence contains only opaque package/attestation/claim/profile IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, public citation IDs where rights permit, declared role/scope, bounded aggregate state, and typed bounded findings. Exact held-out identity/truth, direct private-package/source digests, private source pages, credentials, reviewer notes, reserve state, and diagnostics remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
