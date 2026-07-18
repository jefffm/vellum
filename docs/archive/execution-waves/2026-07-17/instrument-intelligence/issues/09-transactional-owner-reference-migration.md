# Transactional OwnerReference migration and quarantine

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U10

SPEC coverage: Slice 1 safe migration and rollback

Requirement families touched: II-SRC-001, II-EXEC-001B, II-MC-002, II-NG-013

## What to build

Migrate every OwnerReference through compatibility readers into the new identity graph with permanent mappings, exact-byte verification, collision quarantine, resumability, dry run, and proven rollback before cutover.

## Acceptance criteria

- [ ] Every legacy ID remains immutable and has a verified mapping or actionable quarantine with exact old/new bytes, hashes, and citations.
- [ ] Migration is transactional, idempotent, resumable after interruption, dry-runnable, and rollback-safe.
- [ ] Collision, incomplete/composite identity, missing bytes, stale head, and concurrent mutation fail without manufacturing Work, date, edition, provenance, rights, or authority.
- [ ] Compatibility reads work before any canonical writer is enabled; rollback is exercised against committed and interrupted migrations.
- [ ] A migration journal supports audit, rerun, and exact diagnosis without exposing private content.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T09-transactional-owner-reference-migration.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: the tracer's dry-run, interruption, rollback, and compatibility suite through the focused Vitest command above; the tracer's rights/derivative-leak suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T09/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 05
- 06
- 07
- 08
