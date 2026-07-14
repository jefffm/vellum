# Shared assets, acquisition provenance, and deletion

Status: ready-for-agent

Type: AFK

User stories: U1, U2, U10

SPEC coverage: Durable identity; lifecycle/deletion; Slice 1 content-addressed bytes

Requirement IDs: II-BND-008, II-SRC-001–002, II-EXEC-001A, II-MC-002–003

## What to build

Store identical bytes once while retaining every acquisition edge, rights context, role binding, and derivative path so access and deletion are determined by provenance rather than arrival order.

## Acceptance criteria

- [ ] Both acquisition orderings of identical bytes with different rights produce the same content identity but distinct provenance/access edges.
- [ ] Deleting either acquisition preserves authorized uses from the other and removes only derivatives whose remaining provenance cannot authorize them.
- [ ] Rights restriction, tombstone, purge, and replay/readiness consequences traverse the full derivative graph transactionally.
- [ ] Repository inclusion, fixture use, redistribution, export, provider egress, and local processing are separately decidable.
- [ ] Workbench explains why bytes are accessible, restricted, retained as a tombstone, or purged without leaking a denied source.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T06-shared-assets-acquisition-provenance-deletion.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: the tracer's dry-run, interruption, rollback, and compatibility suite through the focused Vitest command above; the tracer's rights/derivative-leak suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T06/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 05
