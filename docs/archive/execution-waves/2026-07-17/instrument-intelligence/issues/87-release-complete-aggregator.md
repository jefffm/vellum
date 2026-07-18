# Release closure adjudication and remediation dispatch

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U1, U2, U3, U4, U5, U6, U7, U8, U9, U10

SPEC coverage: Release Complete closure boundary

Requirement families touched: II-RC-001–015, II-EXEC-014E, II-NG-010

## What to build

Run the Release closure audit over current Machine Complete evidence and a non-compensating round of exact-package, independently scoped human attestations. Every successfully executed audit is retained as an immutable adjudication; only its exact passing result creates Release Complete, while a newly discovered repairable failure dispatches an append-only remediation obligation instead of deadlocking closure.

## Acceptance criteria

- [ ] Current T85 Machine Complete receipt, T81 packages, and latest T69 aggregate all bind unchanged compatible system, qualification, source, pack, compiler, evaluator, score, playback, deliverable, and review digests.
- [ ] Every required T65–T68, T88–T93, T95, T100–T101, and T104 dimension is independently current, authorized, unrevoked, in scope, and `pass`; T94 must pass when T107 says `lyrics_applicable`, while a verified `lyrics_not_applicable` is an applicability result rather than a human pass. `lyrics_applicability_blocked` or `lyrics_applicability_incomplete` can reach T69 remediation but can never satisfy this closure.
- [ ] No unresolved disagreement, failed/incomplete/stale/test-only evidence, dynamic repair, expired provider/sentinel, changed byte, missing rerun, or current unsuperseded T86 provisional-stop decision can be compensated or ignored. Historical/superseded stop decisions remain auditable but do not veto a resumed all-pass release.
- [ ] Clause-level verifier proves every II-RC requirement and the remote commit/evidence ancestry; only a passing generation publishes a Release Complete receipt with exact Claim Scopes and validity boundaries. Nonpassing generations publish only bounded adjudication/dispatch receipts.
- [ ] Each newly discovered repairable closure failure allocates the next append-only AFK remediation tracer and emits the closed-schema, digest-bound dispatch contract: opaque finding, exact repair ID and registry head, affected requirements, actual invalidation edges/scopes, prescribed earliest rejoin outside T85/T87, inherited regressions/reserve state, and a reserved fresh T87 closure target plus T85 exactly when Machine scope is invalidated. Existing open obligations are referenced rather than duplicated.
- [ ] The audit protocol itself must complete successfully even when the audited product state does not pass. Its exact result enum is `release_complete`, `release_closure_failed_repair_dispatched`, `release_closure_blocked`, or `release_closure_incomplete`; only `release_complete` agrees with product acceptance `pass`, establishes Release Complete, and satisfies the overall goal judge.
- [ ] A blocked or incomplete infrastructure/protocol state remains an immutable nonpassing attempt eligible for policy-bound retry; it cannot fabricate a repair finding or advance closure.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T87-release-complete-aggregator.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run eval:fast`; focused stale/changed/revoked/cross-package/dynamic-repair/provisional/leak cases and every gate referenced by II-RC evidence.
- Toolchain: record manifest/verifier, credential/Trust Policy, Git/remote ancestry, Node/npm, provider/runtime, OS, exact Machine Complete/qualification/package/review identities.
- Observable outcome: demonstrate failed, blocked, incomplete, stale, cross-bound, and provisional states produce immutable typed adjudications (with a dispatch only for a repairable failure), then compute and reload an all-pass disclosed Release Complete receipt.
- Evidence: `../evidence/T87/verification.json` plus typed bounded adjudication/dispatch receipts and, only for `release_complete`, the digest-bound public Release Complete receipt.

## Public/Vault boundary

A passing public receipt contains requirement/status IDs, opaque package/attestation/qualification IDs, keyed non-resolving Vault commitments, digests of already-public system artifacts, role/scope validity, Claim Scopes, compatibility/provider validity, and aggregate Release Complete. A nonpassing public adjudication is limited to the same safe identifiers plus bounded status and typed dispatch references; it cannot imply closure. Exact held-out identities/truth, direct private-package or attestation digests, private reviews, mutations, reserve state, credentials, and diagnostics remain private/Vault data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":85,"generation":"current","field":"resultCode","operator":"eq","expected":"machine_complete"},{"sourceTracer":69,"generation":"current","field":"resultCode","operator":"eq","expected":"review_round_passed"},{"sourceTracer":86,"generation":"latest_or_absent","field":"resultCode","operator":"not_in","expected":["provisional_stop_current"]}]}`

- T85 Machine Complete remains current over unchanged bytes.
- The latest T69 outcome is `review_round_passed` and no appended remediation or invalidated evidence remains open.

## Blocked by

- 69
- 85
