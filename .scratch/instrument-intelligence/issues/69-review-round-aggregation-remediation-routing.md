# Review-round aggregation and remediation routing

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U1, U2, U3, U4, U5, U6, U7, U8, U9, U10

SPEC coverage: Slice 14 review aggregation and remediation loop

Requirement families touched: II-EXEC-014B, II-RC-001–015, II-NG-010

## What to build

Aggregate one complete round of independently finalized exact-artifact attestations, determine the honest non-compensating result, and route every blocking finding to append-only AFK remediation without making this attempt wait for its own repair. Release Complete belongs only to T87.

## Acceptance criteria

- [ ] Aggregator requires current finalized attestations from T65–T68, T88–T93, T95, T100–T101, and T104 plus a finalized T107 applicability attempt and T94 only for `lyrics_applicable`; it verifies role independence/scope/freshness/revocation and exact T81 package bindings and rejects missing, stale, changed, or cross-package evidence.
- [ ] Applicability is separate from acceptance. Every applicable dimension remains independently `pass`, `fail`, `blocked`, or `incomplete`; `not_applicable` requires a current T107 applicability receipt. No score, majority, or successful role compensates for another required failure.
- [ ] `lyrics_applicability_blocked` and `lyrics_applicability_incomplete` are nonpassing findings routed directly to repair/package regeneration without requiring T94; only `lyrics_applicable` waits for the current T94 attempt, and only a valid `lyrics_not_applicable` bypasses that human branch.
- [ ] Every blocking finding maps to the earliest affected slice and allocates the next append-only remediation tracer ID under the manifest's repair namespace. Before repair execution, this aggregator emits a closed-schema digest-bound dispatch artifact naming an opaque finding ID, repair ID, exact invalidation edges/scopes, inherited regressions/reserve cursor, prescribed `rejoinAt`, derived Machine impact, and closure targets. The repair must bind that artifact exactly rather than self-declaring weaker scope or inserting a back-edge into an old static issue definition.
- [ ] Finalizing the repair reserves the exact fresh rejoin and closure generation identities. Unmaterialized reservations are allowed only while those closures remain pending and keep them blocked. Once materialized, the rejoin is a strict temporal descendant of the passing repair and every target is current and descends from it; T87 is mandatory and T85 is present if and only if `invalidatesMachineComplete` is true. The completed temporal proof covers required new qualification → package → review → aggregation generations while preserving every old definition and generation unchanged.
- [ ] A changed byte invalidates every affected deterministic, performance, qualification, package, and human attestation; valid held-out failures become permanent disclosed regressions and only the precommitted next reserves may be consumed.
- [ ] This tracer finalizes and publishes the review-round result even when failed or incomplete. Public output is typed and bounded and cannot claim Machine Complete or Release Complete; T87 separately verifies a current all-pass round.
- [ ] Only a current non-compensating all-pass aggregate emits `review_round_passed`. The complete result enum is `review_round_passed`, `review_round_failed`, `review_round_blocked`, `review_round_incomplete`, or `review_round_applicability_invalid`; the pass code must agree exactly with product acceptance and no other string is valid.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T69-review-round-aggregation-remediation-routing.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run eval:fast`; the focused stale-evidence, repair-allocation, invalidation, Vault-isolation, and public-leak cases.
- Toolchain: record Node, npm, manifest/verifier, credential verifier, Vault schema, OS, exact package, review-round, and qualification identities.
- Observable outcome: aggregate persisted pass/fail/blocked/incomplete synthetic review rounds, reload the result, and demonstrate that nonpassing rounds finalize while dependency-correct repair records become executable.
- Evidence: `../evidence/T69/verification.json` plus digest-bound public aggregate/remediation receipts; exact findings and held-out diagnostics remain authorized private data.

## Public/Vault boundary

Public receipts contain only opaque round/finding/repair/package/attestation IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, role-validity and bounded aggregate dimension states, affected public requirement IDs, and typed bounded rationale. Exact held-out identities/truth, direct private-package or attestation digests, private review text, mutations, invalidation evidence, reserve order/seed, and per-attempt diagnostics remain exclusively Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"},{"any":[{"sourceTracer":107,"generation":"current","field":"resultCode","operator":"eq","expected":"lyrics_not_applicable"},{"sourceTracer":107,"generation":"current","field":"resultCode","operator":"eq","expected":"lyrics_applicability_blocked"},{"sourceTracer":107,"generation":"current","field":"resultCode","operator":"eq","expected":"lyrics_applicability_incomplete"},{"all":[{"sourceTracer":107,"generation":"current","field":"resultCode","operator":"eq","expected":"lyrics_applicable"},{"sourceTracer":94,"generation":"current","field":"issueCompletion","operator":"eq","expected":"complete"}]}]}]}`

- Every unconditional review attempt over the current T81 packages is finalized. `lyrics_applicable` additionally requires current T94 finalization. `lyrics_not_applicable`, `lyrics_applicability_blocked`, and `lyrics_applicability_incomplete` make this aggregator executable without T94; the latter two force a nonpassing aggregate and remediation.
- A failed, blocked, or incomplete review may satisfy attempt finalization but never the all-pass release predicate.

## Blocked by

- 65
- 66
- 67
- 68
- 88
- 89
- 90
- 91
- 92
- 93
- 95
- 100
- 101
- 104
- 107
