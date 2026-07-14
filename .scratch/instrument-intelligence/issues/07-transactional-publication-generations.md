# Transactional publication generations

Status: ready-for-agent

Type: AFK

User stories: U2, U10

SPEC coverage: Immutable releases; Slice 1 publication-generation store; Slice 3 crash/concurrency

Requirement IDs: II-BND-007, II-KNW-002, II-EXEC-001B, II-EXEC-003A, II-MC-006

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
- Conditional: the tracer's dry-run, interruption, rollback, and compatibility suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T07/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 01
