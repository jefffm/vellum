# Shared assets, acquisition provenance, and deletion

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U10

SPEC coverage: Durable identity; lifecycle/deletion; Slice 1 content-addressed bytes

Requirement families touched: II-BND-008, II-SRC-001–002, II-EXEC-001A, II-MC-002–003

## What to build

Stage content-addressed shared assets while retaining every acquisition edge, rights context, role binding, and derivative path. Access, substitution, and deletion are determined by exact authorized provenance rather than byte equality or arrival order; canonical writes remain disabled until migration cutover.

## Acceptance criteria

- [ ] Both acquisition orderings of identical bytes with different rights produce the same content identity but distinct provenance/access edges.
- [ ] Deleting either acquisition preserves a use only when that use already has an exact authorized remaining provenance edge or an explicit authorized provenance-substitution record; deduplication alone never transfers permission.
- [ ] Rights restriction, tombstone, purge, and replay/readiness consequences traverse the full derivative graph transactionally.
- [ ] Repository inclusion, fixture use, redistribution, export, provider egress, and local processing are separately decidable.
- [ ] Diagnostic Workbench explains why staged bytes are accessible, restricted, retained as a tombstone, or purged without leaking a denied source or becoming canonical.
- [ ] A compatibility test proves legacy reads continue unchanged and no staged source/asset writer can become authoritative before tracers 09 and 15.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T06-shared-assets-acquisition-provenance-deletion.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T06-shared-assets-acquisition-provenance-deletion.spec.ts`; the tracer's dry-run, interruption, rollback, and compatibility suite through the focused Vitest command above; the tracer's rights/derivative-leak suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: acquire identical bytes through two differently authorized Workbench paths, show their separate provenance/access decisions, delete each ordering in turn, and prove derivatives never borrow the other path's rights without reviewed substitution.
- Evidence: `../evidence/T06/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 05
