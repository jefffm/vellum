# Independent held-out curator precommit

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: decision-recorded

User stories: U4, U5, U6, U7, U8, U10

SPEC coverage: Slice 13 independent curation commitment

Requirement families touched: II-EVAL-004, II-EXEC-013A, II-MC-026, II-NG-010

## What to build

Have an independent curator commit the legal eligible pool and blinded selection protocol in the Owner Evaluation Vault before any candidate output is observed. This tracer records only the curator decision; it neither reviews musical truth, freezes the Generation System, runs qualification, nor grants Machine Complete.

## Acceptance criteria

- [ ] A scope-qualified curator, verified separately from truth reviewers, evaluator implementers/calibrators, run operator, and developers, records credential, scope, freshness, conflicts, and decision time.
- [ ] Before any candidate output, the Vault commitment binds legally usable eligible assets, near-duplicate/derivative contamination closures, target and shared-contract coverage assignments, output-independent invalid-fixture policy, reserve order or deterministic selection seed, exhaustion rule, ledger genesis, and inherited regression/reserve state.
- [ ] Coverage is sufficient for the exact T83 target, Continuo, imitative, and optical-ingestion classes; an insufficient or declined commitment is recorded honestly and cannot unlock T82/T83.
- [ ] Public receipt exposes only curator-role validity, opaque pool IDs, keyed non-resolving Vault commitments, public coverage classes, aggregate sufficiency state, and timestamp. Exact identities, direct hidden-source digests, rights documents, reserve order/seed, or curator diagnostics remain Vault-only.
- [ ] Completion means the curator decision and immutable receipt are finalized as `curation_sufficient`, `curation_insufficient`, or `curation_declined`; downstream interlocks independently require the current sufficient result.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T64-independent-curator-precommit.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; the focused credential, conflict, Vault-integrity, rights, isolation, and public-leak cases.
- Toolchain: record Node, npm, Vault schema/key-policy identity, credential verifier, OS, and curation-package/system identities that materially affect the decision; record `not_applicable` with rationale.
- Observable outcome: complete the real curation form in authorized local UI, persist/reload the immutable Vault decision, and verify that public storage contains only the redacted receipt.
- Evidence: `../evidence/T64/verification.json` plus a digest-bound public curation receipt; exact commitment and source evidence remain in the Owner Evaluation Vault.

## Public/Vault boundary

Public evidence may contain only opaque commitment IDs, public coverage classes, keyed non-resolving Vault commitments, aggregate sufficiency, role-validity state, and typed bounded errors. Exact held-out identities/assets, direct hidden-source digests, rights evidence, contamination links, reserve order/seed, invalidation details, and per-case notes remain exclusively in the Owner Evaluation Vault and may not enter Git, ordinary logs, screenshots, or diagnostics.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":63,"generation":"current","field":"resultCode","operator":"eq","expected":"pre_hitl_ready"}]}`

- T63 `pre_hitl_ready` receipt is current and all pre-HITL machine/package gates pass.

## Blocked by

- 63
