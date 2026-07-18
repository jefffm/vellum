# Evaluation status and comparison migration

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U8, U10

SPEC coverage: Evaluation layers; hard-gate/acceptance status; Slice 0 and Slice 4

Requirement families touched: II-EVAL-001, II-EVAL-003, II-EXEC-000, II-EXEC-004A, II-MC-030–031, II-EXEC-004C

## What to build

Migrate legacy Cards and baselines without reinterpreting old proxy dimensions, separate tri-state hard gates from four-state acceptance, and enforce the specified aggregate precedence everywhere.

## Acceptance criteria

- [ ] Legacy Cards remain readable with original semantics; incompatible comparisons report `incomparable` and never fabricate new dimension passes.
- [ ] `hardGateStatus` is pass/fail/incomplete; `acceptanceStatus` is pass/fail/blocked/incomplete.
- [ ] Aggregate precedence is conclusive fail, then unavailable dependency blocked, then unfinished evidence incomplete, and pass only when every required applicable gate passed.
- [ ] UI, reports, baselines, APIs, and persisted records never render blocked, unknown, partial, legacy-unverifiable, or missing evidence as pass.
- [ ] Migration round-trip preserves old bytes and records exact evaluator/status-policy identities.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T17-evaluation-status-comparison-migration.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T17-evaluation-status-comparison-migration.spec.ts`; `npm run eval:fast`; the tracer's dry-run, interruption, rollback, and compatibility suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T17/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 01
- 07
- 71
