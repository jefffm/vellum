# Independent truth-review commitments

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: decision-recorded

User stories: U3, U4, U5, U6, U7, U8, U10

SPEC coverage: Slice 13 independent truth review

Requirement families touched: II-EVAL-004–005, II-EXEC-013B, II-MC-027–028, II-NG-010

## What to build

Have scope-qualified truth reviewers independently review the selected cases and commit their truth, evaluator gates, and unresolved disagreements in the Owner Evaluation Vault. This tracer records human review decisions only; it neither freezes a Generation System nor runs or activates anything.

## Acceptance criteria

- [ ] Distinct scope-qualified reviewers cover target-instrument idiom/physical truth, Continuo, imitative counterpoint, transcription/extraction, lyrics where applicable, and engraving; identities, credentials, scopes, freshness, revocation, conflicts, and disagreements validate under T13 without borrowing curator, implementer, calibrator, operator, maintainer, or developer authority.
- [ ] Reviewers work from source and independently reviewed canonical material before candidate output exists; they cannot read generation output, prior attempt diagnostics, reserve ordering, or another role's private notes outside their capability.
- [ ] Vault commitments bind each opaque case to exact reviewed truth, required observations, forbidden outcomes, mutations, invalid-fixture criteria, evaluator/calibration identity, and reviewer attestations.
- [ ] Missing scope, unresolved disagreement, or declined review is recorded as `incomplete` rather than inferred or silently omitted; the decision generation remains immutable and cannot authorize T83.
- [ ] Completion means the human commitment generation is durably recorded and reloadable as `truth_sufficient`, `truth_insufficient`, `truth_blocked`, or `truth_incomplete`. Automatic verification, system freeze, remediation routing, and interlock enforcement belong to T103.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T82-independent-truth-commitments.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T82-independent-truth-commitments.spec.ts`; `npm run review:validate`; focused role-scope, conflict, disagreement, isolation, Vault-integrity, and leak-canary cases.
- Toolchain: record review UI, credential verifier/Trust Policy, Vault schema/key policy, browser, OS, and exact blinded review-package identities.
- Observable outcome: each authorized reviewer records and reloads a real scoped commitment in the production review UI while generation remains technically unable to resolve committed truth.
- Evidence: `../evidence/T82/verification.json` plus typed bounded public commitment receipts; exact truth and review material remain Vault-only.

## Public/Vault boundary

Public evidence contains only opaque commitment IDs, keyed non-resolving Vault commitments, role-validity and public coverage classes, bounded aggregate sufficiency, and typed bounded errors. Exact identities/assets, direct private-data digests, truth, observations, mutations, invalidation data, reserve state, credentials, and reviewer notes remain exclusively in the Owner Evaluation Vault.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":106,"generation":"current","field":"resultCode","operator":"eq","expected":"precommit_ready"}]}`

- T106 result is current `precommit_ready`, so the selected pool and verified maintainer decisions are compatible with this blinded truth-review generation.

## Blocked by

- 106
