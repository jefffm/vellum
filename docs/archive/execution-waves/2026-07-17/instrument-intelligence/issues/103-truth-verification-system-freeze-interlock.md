# Truth verification, system freeze, and sealed-run interlock

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U3, U4, U5, U6, U7, U8, U10

SPEC coverage: Slice 13 automatic truth verification, system freeze, and nonpass routing

Requirement families touched: II-EVAL-004–006, II-EXEC-013G, II-MC-026–034

## What to build

Automatically verify the current blinded truth-review generation and either freeze the exact Generation System before any output or route every insufficiency to an append-only repair/successor-review generation. Human truth review remains exclusively T82.

## Acceptance criteria

- [ ] Verify every T82 reviewer credential, scope, conflict, freshness, revocation state, commitment signature, coverage assignment, disagreement, evaluator/calibration binding, and compatibility with current T64/T106 commitments without exposing truth to generation.
- [ ] Only a sufficient current review generation atomically freezes compiler, pack releases/attestations/profiles, Catalog/manifest, Resolution and Selection Policies, evaluator, Qualification Execution Policy, split manifest, provider or provider-free runtime, performance profile, and source-envelope policy before candidate output and emits exact result code `freeze_complete`.
- [ ] Missing, invalid, conflicting, expired, revoked, or insufficient review finalizes as nonpassing, emits a typed bounded repair package, and requires a fresh T82 decision generation; it never partially freezes or silently reuses an older approval.
- [ ] Product or package defects allocate the next append-only AFK remediation tracer at the earliest affected slice and emit the same closed-schema digest-bound dispatch contract used by T69/T84: opaque finding, repair ID, exact invalidation edges/scopes, prescribed rejoin, and closure targets. Purely missing human evidence creates a successor review generation without pretending automation supplied authority.
- [ ] The sealed-run capability checks the current immutable `freeze_complete` receipt and cannot start on an earlier/superseded generation, an open remediation, a changed byte, or a nonpassing decision.
- [ ] The exact result enum is `freeze_complete`, `truth_verification_failed_repair_dispatched`, `truth_verification_blocked`, `truth_verification_incomplete`, or `successor_truth_review_required`; only `freeze_complete` agrees with acceptance `pass`, and arbitrary strings cannot route or unlock execution.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T103-truth-verification-system-freeze-interlock.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run eval:fast`; focused credential/conflict/revocation, coverage, atomic-freeze, stale-generation, remediation-allocation, generation-isolation, Vault-integrity, and leak-canary cases.
- Toolchain: record credential verifier/Trust Policy, Vault schema/key policy, freeze builder, manifest/verifier, provider/runtime, Node/npm, OS, and every frozen identity.
- Observable outcome: verify disclosed synthetic sufficient and insufficient truth generations, reload their immutable outcomes, prove only the sufficient generation freezes, and prove a nonpass produces an executable successor route.
- Evidence: `../evidence/T103/verification.json` plus typed bounded commitment/freeze/remediation receipts; exact truth and review material remain Vault-only.

## Public/Vault boundary

Public evidence contains only opaque commitment/freeze/repair IDs, keyed non-resolving Vault commitments, role-validity and public coverage classes, digests of already-public system artifacts, bounded aggregate result, compatibility, and typed bounded errors. Exact identities/assets, direct private-data digests, truth, observations, mutations, invalidation data, reserve state, credentials, and reviewer notes remain exclusively in the Owner Evaluation Vault.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":106,"generation":"current","field":"resultCode","operator":"eq","expected":"precommit_ready"},{"sourceTracer":82,"generation":"current","field":"resultCode","operator":"in","expected":["truth_sufficient","truth_insufficient","truth_blocked","truth_incomplete"]}]}`

- T82 has a current finalized human truth-review generation and T106 remains `precommit_ready`; either sufficient or nonpassing truth may be processed, but only T103 `freeze_complete` unlocks T83.

## Blocked by

- 82
- 106
