# Transactional publication generations

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U2, U10

SPEC coverage: Immutable releases; Slice 1 publication-generation store; Slice 3 crash/concurrency

Requirement families touched: II-BND-007, II-KNW-002, II-EXEC-001B, II-EXEC-003A, II-MC-006

## What to build

Create a generation-addressed publication store with stable snapshot reads and a compare-and-swap head before any new canonical knowledge writer depends on it.

## Acceptance criteria

- [ ] Draft/release/attestation/advisory writes stage into an immutable generation and become visible only through one atomic head commit.
- [ ] Concurrent upload, review, advisory, and activation writers receive deterministic CAS success or stale-head rejection.
- [ ] Crashes after every staged write and immediately before/after head commit recover without partial visibility or lost committed data.
- [ ] Orphan generations are inspectable and safely reclaimable; readers pinned to an old snapshot remain consistent.
- [ ] API and Workbench reload the same exact generation and show successor relationships rather than mutating old content.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T07-transactional-publication-generations.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T07-transactional-publication-generations.spec.ts`; the tracer's dry-run, interruption, rollback, and compatibility suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: publish one complete Workbench generation, crash and race competing writers at every commit boundary, then reload exactly one head with recoverable orphans and no partially visible release/attestation/advisory state.
- Evidence: `../evidence/T07/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 01
