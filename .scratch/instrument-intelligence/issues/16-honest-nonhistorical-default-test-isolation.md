# Synthetic authority and ordinary-activation isolation

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U2, U9, U10

SPEC coverage: Authority/readiness lanes; Slice 3 AFK authority isolation

Requirement families touched: II-BND-001, II-BND-003–004, II-EXEC-003C, II-MC-009

## What to build

Exercise the production authority/readiness path with synthetic and provisional records while proving that AFK automation cannot invent the human maintainer authority required for an ordinary nonhistorical default. Tracer 102 records the late maintainer decision through this prebuilt path.

## Acceptance criteria

- [ ] A synthetic maintainer-attestation fixture can exercise the resolver only under isolated test policy; it is unmistakably synthetic, cannot enter ordinary storage, and cannot satisfy default Guided Start or qualification.
- [ ] A provisional nonhistorical release produces one visible consequence only in provisional-research mode with truthful labels and exact manifest identity.
- [ ] Historical/specialist presentation requires the exact compatible reviewed scope; no label is inferred from source age or musical plausibility.
- [ ] Test-only, synthetic, and provisional releases remain unavailable to default Guided Start and qualification candidates; ordinary activation remains `review_required` until a real scope-limited maintainer attestation is recorded by tracer 102 and independently verifies.
- [ ] Mixed, absent, revoked, expired, Owner-local, or out-of-scope authority yields the required excluded/blocked/provisional state.
- [ ] UI, exports, Evaluation Cards, and debug reports use the same authority/readiness vocabulary and cannot display a false pass.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T16-honest-nonhistorical-default-test-isolation.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T16-honest-nonhistorical-default-test-isolation.spec.ts`; `npm run eval:fast`.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the production browser visibly applies the provisional consequence while ordinary Guided Start stays blocked; injecting a synthetic or AFK-authored human attestation cannot change that result.
- Evidence: `../evidence/T16/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 15
