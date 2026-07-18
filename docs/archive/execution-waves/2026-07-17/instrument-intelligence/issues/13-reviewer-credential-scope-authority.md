# Reviewer credential, scope, expiry, and revocation authority

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U2, U10

SPEC coverage: Release attestations/advisories; reviewer verification; Slice 3

Requirement families touched: II-KNW-003, II-EXEC-003A, II-MC-028, II-RC-001

## What to build

Build the external reviewer/advisory verification contract and verifier adapter. Trust depends on a verifier explicitly authorized by a pinned Trust Policy, not on importing a claimant-controlled credential or verification record; this AFK tracer uses synthetic credentials and mints no human authority.

## Acceptance criteria

- [ ] Trust Policy pins authorized verifier identities, trust roots/methods, credential and advisory kinds, subjects, authority scopes, clock policy, freshness, revocation sources, and policy validity boundaries.
- [ ] Verified authority records carry evaluated and authorization scopes only when the verifier is authorized by that exact policy and credential intersections cover reviewer role, subject, action/advisory kind, release/artifact, applicability, and requested scope.
- [ ] Imported/self-issued verifications, unauthorized verifiers, missing scope, failed intersection, stale verification, revocation, ambiguous subject, unsupported advisory kind, and clock mismatch fail closed; unverified, revoked, expired, and out-of-scope records carry no authority scope.
- [ ] Expiry or revocation produces a new immutable verification/advisory status for later resolution without mutating prior release or attestation bytes and without prematurely publishing an Activation Decision owned by tracer 14.
- [ ] Reviewer, curator, truth reviewer, evaluator implementer, calibrator, and run operator roles remain separately representable with conflict checks.
- [ ] Workbench shows verifier-policy identity, verified scope, source, freshness, revocation, disagreements, and unclaimed dimensions without treating synthetic fixtures as real expertise.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T13-reviewer-credential-scope-authority.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T13-reviewer-credential-scope-authority.spec.ts`; `npm run review:validate`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T13/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 12
