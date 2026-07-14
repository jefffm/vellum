# Split manifests, attempt ledger, and inherited regressions

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U8, U10

SPEC coverage: Dataset assignments/contamination; content-addressed regressions; held-out acceptance; Slice 4

Requirement families touched: II-EVAL-004–005, II-EVAL-009–010, II-EXEC-004B, II-MC-027–029

## What to build

Implement synthetic split manifests and an append-only Holdout Run Ledger with pre-output genesis, unique CAS head, fork detection, output-independent invalidation, inherited reserve state, and an explicit transaction that reclassifies a valid held-out failure before it may inform development.

## Acceptance criteria

- [ ] Manifest and ledger genesis freeze before any candidate output; every attempted group records an ordered terminal or nonterminal state.
- [ ] Concurrent append uses one CAS head; forks, rewritten history, missing attempts, and head rollback invalidate qualification.
- [ ] Blocked, incomplete, invalid, failed, cancelled, and infrastructure attempts remain retained and semantically distinct.
- [ ] Fixture-invalidity predicates and decision authority freeze before output; post-output invalidation requires an independent, reason-coded decision and cannot discard an inconvenient failure, rewrite reserve order, or depend on candidate quality.
- [ ] Before a valid failure informs product work, one atomic declassification/contamination transaction removes it from held-out eligibility, preserves the immutable attempt, records exposure and rights decisions, and creates a content-addressed mandatory development-regression identity.
- [ ] Public-safe regression material is disclosed only when authorized; otherwise an authorized minimized reproduction or private development-regression capability preserves the failing behavior without copying Owner-private/Vault truth into Git.
- [ ] A successor inherits every valid failure and the unconsumed reserve cursor in addition to fresh held-out groups; it cannot treat an inherited regression as fresh held-out evidence.
- [ ] Public receipts expose only random non-resolving IDs, public coverage classes, keyed non-resolving Vault commitments, digests of already-public artifacts, bounded aggregate states, and typed diagnostics; exact synthetic truth and direct private-data digests remain in the test Vault.

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
