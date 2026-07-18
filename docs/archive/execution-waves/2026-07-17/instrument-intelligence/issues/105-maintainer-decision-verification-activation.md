# Maintainer-decision verification and ordinary activation

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U2, U9, U10

SPEC coverage: Slice 3 verified nonhistorical default consequence after maintainer decision

Requirement families touched: II-BND-001, II-BND-003–004, II-KNW-003, II-EXEC-003E, II-MC-009–010

## What to build

Verify each current T102 maintainer decision under the pinned Trust Policy and atomically apply only its exact approved ordinary nonhistorical activation. Finalize rejection, requested changes, invalid authority, expiry, or revocation without activation and route a typed successor package.

## Acceptance criteria

- [ ] External Reviewer Authority Verification is issued only by an authorized verifier over the exact decision, release/profile, scope, consequence, credential, clock, and Trust Policy identities.
- [ ] A current verified approval alone creates an atomic ordinary `software_default` or `editorial_default` Activation Decision; partial writes, sibling-profile escalation, historical/specialist labels, or activation before verification fail closed.
- [ ] Aggregate result is exactly `activation_approved`, `activation_rejected`, `activation_changes_requested`, or `activation_invalid`; mixed required-package outcomes are nonpassing. Rejection, requested changes, missing scope, failed verification, expiry, or revocation leaves ordinary activation `review_required`/denied and emits a typed repair or successor-decision package; no human authority is fabricated.
- [ ] Guided Start, exports, manifests, and Workbench resolve and display the same exact nonhistorical authority, limitations, validity boundary, and activation generation after reload.
- [ ] Changed release/profile/policy/manifest bytes stale the verification and activation atomically and require a fresh T102 decision generation.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T105-maintainer-decision-verification-activation.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T105-maintainer-decision-verification-activation.spec.ts`; `npm run review:validate`; focused verifier-policy, expiry/revocation, atomic-activation, scope-escalation, stale-generation, and nonpass-routing cases.
- Toolchain: record verifier/Trust Policy, credential and clock providers, activation/resolver schemas, browser, Node/npm, OS, and exact decision/release/profile/manifest identities.
- Observable outcome: process disclosed approve/reject/changes-requested decisions through the production verifier and resolver; only the exact valid approval changes ordinary output, and every result survives reload.
- Evidence: `../evidence/T105/verification.json` plus typed bounded public verification/activation receipts and authorized private decision evidence.

## Public/Vault boundary

Public evidence contains only opaque decision/verification/activation IDs, exact already-public release/profile/manifest commitments, bounded nonhistorical scope/status, verifier-policy identity, validity boundary, and typed bounded errors. Private credentials, review notes, Owner-private source identity/content, and held-out material remain authorized private/Vault data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":102,"generation":"current","field":"resultCode","operator":"eq","expected":"maintainer_decisions_finalized"}]}`

- T102 has a current finalized maintainer-decision generation; any decision outcome may be processed, but only a verified scope-compatible approval produces `activation_approved`.

## Blocked by

- 102
