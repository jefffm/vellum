# Machine closure adjudication and remediation dispatch

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U1, U2, U3, U4, U5, U6, U7, U8, U9, U10

SPEC coverage: Machine Complete closure boundary

Requirement families touched: II-MC-001–037, II-EXEC-013E, II-NG-010

## What to build

Run the non-compensating Machine closure audit over the current implementation, development, isolation/security, performance, and sealed qualification generations. Every successfully executed audit is retained as an immutable adjudication; only its exact passing result creates Machine Complete, while a newly discovered repairable failure dispatches an append-only remediation obligation instead of deadlocking closure.

## Acceptance criteria

- [ ] Clause-level verifier resolves every II-MC requirement to current compatible implementation/evidence commits, commands, toolchains, manifests, and digests, including all dynamically inserted remediation tracers.
- [ ] Latest T84 qualification generation is all-pass under current compiler/pack/policy/evaluator/provider/performance identities; every accumulated valid held-out failure passes as a disclosed regression and required reserves pass under inherited cursor state.
- [ ] No required gate is failed, incomplete, stale, incomparable where comparability is mandatory, test-only where stronger authority is required, or `not_applicable` without a valid clause-specific rationale.
- [ ] A passing generation publishes a Machine Complete receipt stating exact Claim Scopes, system/evaluator/qualification validity boundaries, clause statuses, and qualification generation without exposing held-out identity/truth or implying human Release Complete. Nonpassing generations publish only bounded adjudication/dispatch receipts and never a Machine Complete receipt.
- [ ] Each newly discovered repairable closure failure allocates the next append-only AFK remediation tracer and emits the same closed-schema, digest-bound dispatch contract as T69/T84/T103/T106: opaque finding, exact repair ID and registry head, affected requirements, actual invalidation edges/scopes, prescribed earliest rejoin outside T85/T87, inherited regressions/reserve state, and reserved fresh T85/T87 closure targets. Existing open obligations are referenced rather than duplicated.
- [ ] The audit protocol itself must complete successfully even when the audited product state does not pass. Its exact result enum is `machine_complete`, `machine_closure_failed_repair_dispatched`, `machine_closure_blocked`, or `machine_closure_incomplete`; only `machine_complete` agrees with product acceptance `pass` and establishes Machine Complete.
- [ ] A blocked or incomplete infrastructure/protocol state remains an immutable nonpassing attempt eligible for policy-bound retry; it cannot fabricate a repair finding, satisfy T81, or advance closure.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T85-machine-complete-aggregator.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: every gate referenced by an II-MC clause, including `npm run eval:fast`, `npm run eval:omr` and `npm test -- src/server/lib/omr.real-smoke.test.ts` when optical cases are in scope (a skipped real smoke is blocked, never pass), `npm run eval:golden`, `npm run eval:parity`, `npm run perf:instrument-intelligence`, review-package schema checks, and focused stale/dynamic-dependency/leak tests.
- Toolchain: record verifier/manifest schema, Git/remote ancestry, Node/npm/Nix/musical tools, provider/runtime, OS/hardware class, and exact qualification generation.
- Observable outcome: demonstrate failed, blocked, incomplete, stale, and synthetic manifests produce immutable typed adjudications (with a dispatch only for a repairable failure), then compute a passing synthetic/disclosed closure and reload its public Machine Complete receipt.
- Evidence: `../evidence/T85/verification.json` plus typed bounded adjudication/dispatch receipts and, only for `machine_complete`, the digest-bound public Machine Complete receipt.

## Public/Vault boundary

The public receipt contains requirement IDs/statuses, opaque evidence/qualification IDs, keyed non-resolving Vault commitments, digests of already-public system artifacts, Claim Scopes, compatibility/provider validity, bounded aggregate status, and typed bounded errors only. It cannot resolve private cases, direct private-data digests, truth, mutations, reserve state, diagnostics, credentials, or review notes.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":84,"generation":"current","field":"resultCode","operator":"eq","expected":"qualification_passed_no_open_repairs"}]}`

- The latest T84 outcome is `qualification_passed_no_open_repairs` for the current frozen system.
- No remediation tracer or invalidated evidence generation required by T84 remains open.

## Blocked by

- 84
