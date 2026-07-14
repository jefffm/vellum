# Reviewer credential, scope, expiry, and revocation authority

Status: ready-for-agent

Type: AFK

User stories: U2, U10

SPEC coverage: Release attestations/advisories; reviewer verification; Slice 3

Requirement IDs: II-KNW-003, II-EXEC-003A, II-MC-028, II-RC-001

## What to build

Make authority-bearing review depend on externally verified reviewer identity, credential intersection, explicit scope, freshness, revocation, and a pinned clock policy.

## Acceptance criteria

- [ ] Verified authority records carry evaluated and authorization scopes; unverified, revoked, expired, or out-of-scope records carry none.
- [ ] Missing scope, failed credential intersection, stale verification, revocation, and clock mismatch fail closed.
- [ ] Expiry or revocation publishes an atomic successor decision/advisory without mutating prior release or attestation bytes.
- [ ] Reviewer, curator, truth reviewer, evaluator implementer, calibrator, and run operator roles remain separately representable with conflict checks.
- [ ] Workbench shows verified scope, source, freshness, revocation, disagreements, and unclaimed dimensions without overstating expertise.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T13-reviewer-credential-scope-authority.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T13-reviewer-credential-scope-authority.spec.ts`; `npm run review:validate`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T13/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 12
