# Precommit adjudication and successor-decision routing

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U2, U4, U5, U6, U7, U8, U10

SPEC coverage: Slice 13 result-sensitive curator/maintainer decision adjudication

Requirement families touched: II-EVAL-004–006, II-EXEC-013F, II-MC-009–010, II-MC-026–029

## What to build

Adjudicate the current T64 curator and T105 maintainer-verification generations before truth review. Emit `precommit_ready` only when both are current, sufficient, compatible, and conflict-free; otherwise preserve the decision and route AFK repair plus the exact successor human generation required.

## Acceptance criteria

- [ ] Validate curator/maintainer role separation, credential scope, conflict/freshness/revocation, decision timing, rights, coverage, release/profile/manifest compatibility, and inherited regression/reserve state without resolving hidden case identity.
- [ ] A sufficient curator commitment plus every required `activation_approved` maintainer result produces one immutable result code and receipt `precommit_ready` bound to their exact evidence generations.
- [ ] Insufficient/declined curation, rejected/changes-requested/invalid maintainer decisions, incompatibility, or changed bytes finalize as nonpassing and can never unlock T82.
- [ ] Product/package defects allocate the next append-only AFK remediation tracer at the earliest affected slice and emit a closed-schema digest-bound dispatch contract naming the opaque finding, repair ID, exact invalidation edges/scopes, prescribed rejoin, and closure targets; missing or declined authority produces a fresh scoped T64/T102 human package. Successor decisions supersede but never erase the prior generation.
- [ ] Runtime reruns form an immutable generation DAG: a successor T106 generation depends on prior decision/adjudication generations and any repair, without adding a cycle to the static tracer-definition graph.
- [ ] The exact result enum is `precommit_ready`, `precommit_failed_repair_dispatched`, `precommit_blocked`, `precommit_incomplete`, or `successor_decision_required`; only `precommit_ready` agrees with acceptance `pass`, and arbitrary strings cannot route or unlock truth review.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T106-precommit-adjudication-successor-routing.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; focused nonpass matrix, credential/conflict, compatibility, dynamic-repair allocation, successor-generation, stale-evidence, generation-DAG, Vault-isolation, and leak cases.
- Toolchain: record manifest/verifier, credential/Trust Policy, Vault/activation schemas, Node/npm, OS, and exact curator/maintainer evidence generations.
- Observable outcome: adjudicate disclosed sufficient and every nonpassing decision combination, reload immutable results, and prove each nonpass exposes a dependency-correct repair/successor path rather than a dead end.
- Evidence: `../evidence/T106/verification.json` plus typed bounded aggregate/remediation receipts; private decisions and held-out details remain authorized private/Vault data.

## Public/Vault boundary

Public receipts contain only opaque decision/adjudication/repair IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, role-validity and bounded aggregate states, affected public requirement IDs, and typed bounded rationale. Exact held-out identity/truth, direct private-data digests, private review text, reserve state, credentials, and diagnostics remain private/Vault data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":64,"generation":"current","field":"resultCode","operator":"in","expected":["curation_sufficient","curation_insufficient","curation_declined"]},{"sourceTracer":105,"generation":"current","field":"resultCode","operator":"in","expected":["activation_approved","activation_rejected","activation_changes_requested","activation_invalid"]}]}`

- Current T64 and T105 generations are finalized; their results may be passing or nonpassing so adjudication and routing can always complete.

## Blocked by

- 64
- 105
