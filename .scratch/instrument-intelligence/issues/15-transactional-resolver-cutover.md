# Transactional resolver cutover

Status: ready-for-agent

Type: AFK

User stories: U2, U10

SPEC coverage: Authority Path Inventory; Slice 3 activation cutover

Requirement IDs: II-KNW-005–006, II-EXEC-003C, II-MC-006–008, II-NG-013

## What to build

Atomically activate the complete manifest resolver and disable legacy activation only after compatible readers, migration validation, shadow comparison, integrity checks, and rollback are proven.

## Acceptance criteria

- [ ] Preflight verifies migrated data, compatible readers, Authority Path/Registry completeness, shadow deltas, rights, and rollback state.
- [ ] Enable-new and disable-old occur in one transactional cutover; no intermediate state has two authorities or none.
- [ ] Crash before, during, and after head commit recovers to a valid old or new state with stable snapshot reads.
- [ ] Post-cutover static/runtime bypass tests reject direct legacy activation, unregistered writers, stale caches, and absent manifest components.
- [ ] Rollback restores the exact prior head and behavior without discarding immutable successor data or inventing provenance.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T15-transactional-resolver-cutover.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: the tracer's adversarial security/fake-provider suite through the focused Vitest command above; the tracer's dry-run, interruption, rollback, and compatibility suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T15/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 09
- 14
