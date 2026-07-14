# Honest nonhistorical default and test-only isolation

Status: ready-for-agent

Type: AFK

User stories: U2, U9, U10

SPEC coverage: Authority/readiness lanes; Slice 3 maintainer-reviewed consequence

Requirement IDs: II-BND-001, II-BND-003–004, II-EXEC-003C, II-MC-009–010

## What to build

Demonstrate that explicitly nonhistorical maintainer-reviewed software/editorial knowledge can power ordinary output while test-only, Owner-local, mixed, absent, or out-of-scope authority cannot masquerade as historical or machine-ready.

## Acceptance criteria

- [ ] A separately classified maintainer-reviewed nonhistorical release produces an ordinary visible consequence with truthful labels and manifest identity.
- [ ] Historical/specialist presentation requires the exact compatible reviewed scope; no label is inferred from source age or musical plausibility.
- [ ] Test-only and provisional releases remain unavailable to default Guided Start and qualification candidates.
- [ ] Mixed, absent, revoked, expired, Owner-local, or out-of-scope authority yields the required excluded/blocked/provisional state.
- [ ] UI, exports, Evaluation Cards, and debug reports use the same authority/readiness vocabulary and cannot display a false pass.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T16-honest-nonhistorical-default-test-isolation.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T16-honest-nonhistorical-default-test-isolation.spec.ts`; `npm run eval:fast`.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T16/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 15
