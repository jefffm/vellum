# Synthetic sealed-qualification drill

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U8, U10

SPEC coverage: Held-out acceptance; Slice 12 sealed-run readiness

Requirement families touched: II-EVAL-004–006, II-EVAL-009–010, II-EXEC-012, II-MC-019–020, II-MC-026–034

## What to build

Exercise the complete sealed protocol with synthetic/disclosed cases only, including every failure and recovery path, while proving real held-out execution remains technically disabled.

## Acceptance criteria

- [ ] Drill covers genesis, CAS append, fork detection, invalidation, invalid fixture, blocked/incomplete/failed attempts, permanent regression, inherited reserve cursor, cancellation, retry, and redacted reporting.
- [ ] Deterministic, stochastic repeated-trial/confidence, and opaque-provider sentinel/expiry policies execute exactly as precommitted.
- [ ] Generation/evaluator/Vault isolation and repository leak canaries remain intact through every attempt and diagnostic.
- [ ] Public Cards/receipts expose only allowed opaque fields, exact Claim Scope, tri-state hard gates, four-state acceptance, compatibility, and typed bounded status/error fields.
- [ ] A real holdout run cannot start without T64's independent curator precommit, T102/T105's verified maintainer consequence, T82's separate truth-review commitments, T106's passing precommit adjudication, and T103's exact frozen candidate identities.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T61-synthetic-sealed-qualification-drill.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run eval:fast`; `npm run perf:instrument-intelligence`; the tracer's isolation, leak-canary, rights, and fake-provider cases through the focused command.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T61/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

No exact held-out identity, asset, truth, expected observation, forbidden outcome, mutation, invalidation decision, reserve order/seed, direct private-data digest, or per-attempt diagnostic may enter this issue, Git, ordinary logs, or public evidence. Public receipts contain only random non-resolving IDs, public coverage classes, keyed non-resolving Vault commitments, digests of already-public artifacts, bounded aggregate states, exact public Claim Scopes, and typed bounded diagnostics. Exact private review forms/artifacts remain in authorized local storage or the Owner Evaluation Vault as applicable.

## Blocked by

- 21
- 22
- 59
- 60
