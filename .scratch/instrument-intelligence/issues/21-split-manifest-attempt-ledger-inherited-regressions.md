# Split manifests, attempt ledger, and inherited regressions

Status: ready-for-agent

Type: AFK

User stories: U8, U10

SPEC coverage: Dataset assignments/contamination; content-addressed regressions; held-out acceptance; Slice 4

Requirement IDs: II-EVAL-004–005, II-EVAL-009–010, II-EXEC-004B, II-MC-027–029

## What to build

Implement synthetic split manifests and an append-only Holdout Run Ledger with pre-output genesis, unique CAS head, fork detection, invalidation, permanent valid-failure regressions, and inherited reserve state.

## Acceptance criteria

- [ ] Manifest and ledger genesis freeze before any candidate output; every attempted group records an ordered terminal or nonterminal state.
- [ ] Concurrent append uses one CAS head; forks, rewritten history, missing attempts, and head rollback invalidate qualification.
- [ ] Blocked, incomplete, invalid, failed, cancelled, and infrastructure attempts remain retained and semantically distinct.
- [ ] A valid failure becomes a permanent required regression; a successor inherits all failures and the unconsumed reserve cursor.
- [ ] Public receipts expose only opaque IDs, coverage classes, digests, aggregate status, and redacted diagnostics; exact synthetic truth remains in the test Vault.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T21-split-manifest-attempt-ledger-inherited-regressions.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run eval:fast`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T21/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

This tracer uses synthetic cases only. Public evidence must obey the wave allowlist; exact case truth, mutations, invalidation decisions, reserve state, and per-attempt diagnostics remain in the test Vault and are represented publicly only by permitted opaque receipts.

## Blocked by

- 17
- 19
- 20
