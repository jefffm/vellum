# Qualification adjudication and remediation dispatch

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U3, U4, U5, U6, U7, U8, U10

SPEC coverage: Slice 13 qualification adjudication, inherited failures, and remediation

Requirement families touched: II-EVAL-009–010, II-EXEC-013D, II-MC-018–020, II-MC-030–032

## What to build

Adjudicate one finalized T83 round under the precommitted policy, distinguish valid failures from independently permitted invalid fixtures, and dispatch result-sensitive repairs/reruns without blocking the round record on its own remediation.

## Acceptance criteria

- [ ] Adjudication validates immutable attempt history, CAS lineage, curator/truth authority, policy timing, evaluator validity, infrastructure status, and every invalid-fixture decision; output-dependent invalidation or convenient replacement is rejected.
- [ ] Every valid failed group becomes a permanent disclosed development regression. A successor inherits all accumulated failures and the unconsumed reserve cursor and must rerun those failures plus the next precommitted reserve groups; no reset or cherry-picking can pass.
- [ ] For each repairable failure, allocate the next append-only remediation tracer ID under the manifest repair namespace and emit a closed-schema digest-bound dispatch artifact naming the opaque failure, repair ID, earliest affected slice/rejoin generation, exact invalidation edges/scopes, closure targets, requirements, and inherited reserve/regression state. The repair binds that artifact exactly; do not let it self-declare scope or mutate an existing static issue definition.
- [ ] Each remediation execution generation carries `rejoinAt: { tracerId, generation }` naming the reserved fresh T83 generation, `invalidatesMachineComplete: true`, and `closureTargets` naming the reserved fresh T85 and T87 generations. Those identities may remain unmaterialized only while closure is pending. Once present, the rejoin is a strict temporal descendant of the passing repair and prior T84 generation; successor T84 depends on that exact T83 generation; closure targets are current descendants of the rejoin; and T85 remains blocked until this temporal path is complete and passing.
- [ ] Each rerun is a new immutable `(tracer ID, execution generation)` node. The temporal generation DAG may revisit static tracer definitions, but no prior generation, static blocker, result predicate, or definition digest is changed and no cycle is introduced in either graph.
- [ ] Automatic rerun selection is result-sensitive but policy-bound: invalid fixtures consume only precommitted replacements; valid failures preserve attempts and required regressions; infrastructure retry, unsat, budget exhaustion, and evaluator invalidity remain distinct.
- [ ] This adjudication generation finalizes with four-state acceptance and publishes a typed bounded receipt even when repair is required. Its exact result enum is `qualification_passed_no_open_repairs`, `qualification_failed_repair_dispatched`, `qualification_blocked`, `qualification_incomplete`, or `qualification_invalid_fixture_replacement_required`; only the first agrees with acceptance `pass`, and no other string may claim Machine Complete.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T84-qualification-adjudication-remediation-dispatch.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run eval:fast`; `npm run perf:instrument-intelligence`; focused CAS/fork, invalidation-policy, inherited-regression, reserve-cursor, repair-allocation, stale-evidence, isolation, and leak-canary cases.
- Toolchain: record Node/npm, manifest/verifier, Vault/ledger schema, frozen evaluator/execution policy, provider/runtime, OS, and exact T83 round identity.
- Observable outcome: adjudicate synthetic pass, valid-failure, invalid-fixture, infrastructure, and tampered-ledger rounds; reload finalized results and executable repair dispatches.
- Evidence: `../evidence/T84/verification.json` plus public redacted adjudication/repair receipts; private diagnostics remain Vault-only.

## Public/Vault boundary

Public receipts expose only opaque round/failure/repair IDs, coverage classes, keyed non-resolving Vault commitments, public-artifact digests, aggregate states, affected public requirement IDs, and typed bounded rationale. Exact cases, direct private-data digests, truth, mutations, invalidation evidence, reserve order/seed, and per-attempt diagnostics remain exclusively in the Vault.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":83,"generation":"current","field":"resultCode","operator":"in","expected":["attempt_pass","attempt_fail","attempt_blocked","attempt_incomplete"]}]}`

- T83 attempt generation is durably finalized; its product result may be pass, fail, blocked, or incomplete.

## Blocked by

- 83
