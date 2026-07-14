# Maintainer decision over ordinary nonhistorical activation

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: decision-recorded

User stories: U2, U9, U10

SPEC coverage: Authority/readiness lanes; Slice 3 maintainer decision; Release Complete authority

Requirement families touched: II-BND-001, II-BND-003–004, II-KNW-003, II-EXEC-003D, II-MC-010, II-RC-001

## What to build

Review each exact release/profile package, nonhistorical scope, permitted software/editorial use, evidence, limitations, and proposed visible consequence prepared by tracer 63. Record approval, rejection, or requested changes as the authorized maintainer. This tracer records the human decision only; verification, activation, UI consequence, and nonpass routing belong to T105/T106.

## Acceptance criteria

- [ ] The package pins exact release/profile/component/policy/manifest digests, proposed `software_default` or `editorial_default` use, nonhistorical scope, known limitations, conflicts, rights decisions, and visible labels.
- [ ] The maintainer records approve/reject/changes-requested, rationale, exact evaluated and authorized scope, unclaimed dimensions, decision time, and immutable package digest through the production review path.
- [ ] Approval creates a distinct immutable `maintainer_reviewed_system` attestation; it does not mutate release content and cannot authorize historical, pedagogical, ergonomic, performer, or specialist claims.
- [ ] Decisions remain separate for releases/profiles whose authorized scopes or consequences can differ; a bulk approval cannot silently authorize an unreviewed sibling.
- [ ] Recording approval performs no activation and issues no verification. Ordinary output remains unchanged until T105 independently verifies authority and atomically applies only the exact approved consequence.
- [ ] This tracer is complete when the immutable human decision is recorded even if rejected or unusable; downstream Machine/Release predicates pass only for a current, verified, scope-compatible approval and activation.
- [ ] After every separately scoped package has a durable decision, emit aggregate result code `maintainer_decisions_finalized`; individual decisions remain independently approved, rejected, or changes-requested and are interpreted only by T105.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T102-maintainer-attestation-ordinary-activation.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T102-maintainer-attestation-ordinary-activation.spec.ts`; `npm run review:validate`; the tracer's role, package-scope, decision-lineage, and no-side-effect cases through the focused Vitest command above.
- Toolchain: record Node, npm, browser, review-package, credential, clock, release/profile/manifest, and decision-schema identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the authorized maintainer records and reloads separate approve/reject/changes-requested decisions in the production Workbench while activation and output remain unchanged.
- Evidence: `../evidence/T102/verification.json` plus its digest-bound public decision receipt and authorized private review record.

## Public/Vault boundary

Public evidence contains only the exact reviewed release/profile/manifest commitments, bounded nonhistorical scope, decision/result status, verifier-policy identity, validity boundary, and typed redactions. Private reviewer credentials, review notes, Owner-private source identity/content, and any held-out material remain in authorized local storage or the Owner Evaluation Vault as applicable.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":63,"generation":"current","field":"resultCode","operator":"eq","expected":"pre_hitl_ready"}]}`

- T63 maintainer packages are current and separately bind every exact release, profile, manifest, and proposed activation consequence.

## Blocked by

- 63
