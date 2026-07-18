# Encrypted Evaluation Vault lifecycle

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U8, U10

SPEC coverage: Owner Evaluation Vault; Slice 4

Requirement families touched: II-EVAL-002, II-EXEC-004B, II-MC-027, II-NG-009, II-EXEC-004D

## What to build

Create the authenticated-encrypted, schema-versioned Owner Evaluation Vault outside Git under a capability boundary and prove its complete operational and durability lifecycle without adding any real held-out material.

## Acceptance criteria

- [ ] Initialize, unlock, lock, rotate keys, migrate, integrity-check, explicitly back up, restore, retain, expire, and purge synthetic Vault state using authenticated encryption with versioned algorithms, nonce-uniqueness enforcement, purpose-separated keys, and authenticated metadata.
- [ ] Workspace, generation, development-agent, repository-index, search, ordinary backup, log, and diagnostic capabilities cannot enumerate Vault contents; ordinary workspace/system backup paths provably exclude it while the explicit encrypted Vault backup path remains usable.
- [ ] Atomic write, fsync, rename/head commit, cancellation, crash, and restart tests prove no acknowledged state is lost and no partial state is accepted.
- [ ] Key absence/corruption, ciphertext or metadata tampering, nonce reuse, storage failure, incompatible migration, rollback, and restore mismatch fail closed as blocked with typed bounded diagnostics.
- [ ] Authorized administrative reads are purpose-bound and appended to an exposure ledger.
- [ ] Public state contains only opaque Vault-generation IDs, keyed non-resolving Vault commitments, bounded status enums, and typed operational receipts, never direct split-manifest/private-data digests or resolvable synthetic/future truth.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T19-encrypted-evaluation-vault-lifecycle.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run eval:fast`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T19/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

This tracer uses synthetic cases only. Public evidence must obey the wave allowlist; exact case truth, mutations, invalidation decisions, reserve state, and per-attempt diagnostics remain in the test Vault and are represented publicly only by permitted opaque receipts.

## Blocked by

- 07
- 18
- 71
