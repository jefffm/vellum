# Migrated-private defaults and Workbench proof

Status: ready-for-agent

Type: AFK

User stories: U1, U2, U9

SPEC coverage: Slice 1 private defaults and production Workbench exit

Requirement IDs: II-SRC-002, II-UX-004, II-EXEC-001B, II-MC-001–003

## What to build

Prove the migrated and new-source paths in production while defaulting private content to no provider egress, fixture inclusion, or redistribution and denying legacy reactivation.

## Acceptance criteria

- [ ] One migrated real Owner reference and one newly uploaded real reference appear through the production Workbench with stable identity, rights, and access explanations.
- [ ] Private defaults independently deny provider egress, fixture inclusion, redistribution, reports, exports, and logs until authorized.
- [ ] An old API, cached manifest, direct compiler import, or legacy activation attempt cannot bypass quarantine or private defaults.
- [ ] Reload, restart, and role rebinding preserve exact identity and access behavior without duplicate records.
- [ ] Workbench offers safe local processing and actionable review paths without implying historical or specialist authority.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T10-migrated-private-defaults-workbench-proof.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T10-migrated-private-defaults-workbench-proof.spec.ts`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above; the tracer's dry-run, interruption, rollback, and compatibility suite through the focused Vitest command above; the tracer's rights/derivative-leak suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T10/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 02
- 09
