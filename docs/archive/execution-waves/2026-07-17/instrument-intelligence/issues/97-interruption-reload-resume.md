# Interruption, reload, and exact resume

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U8, U9

SPEC coverage: Resumable Workbench lifecycle and performance checkpoints; Slice 11

Requirement families touched: II-UX-003–004, II-OPS-001, II-EXEC-011, II-MC-033–036, II-EXEC-011D

## What to build

Make extraction, reassessment, generation/search, evaluation, rendering/deliverables, provider attempts, and multi-target sibling work interruptible and exactly resumable after reload without duplicate attempts, versions, or hidden restarts.

## Acceptance criteria

- [ ] Every stage persists versioned state, completed/incomplete work, compatible checkpoint identity, cancellation status, attempt/idempotency key, dependency digests, and next safe action through atomic durable commits.
- [ ] Cancellation distinguishes user request, budget exhaustion, infrastructure/provider failure, proven unsat, and evaluator invalidity; response latency and checkpoint interval are measured under the precommitted performance policy.
- [ ] Reload rehydrates completed siblings and artifacts exactly, resumes only compatible incomplete work, preserves every counted provider/evaluation attempt, and never duplicates versions, charges, result commits, outputs, or ledger entries.
- [ ] Changed dependencies, policy, pack, toolchain, provider validity, rights, or schema reject stale checkpoints with actionable regeneration/migration choices rather than silent restart or invented compatibility.
- [ ] Fault injection covers process kill and crash at each write boundary, stale locks, CAS conflict/fork, partial provider response, renderer failure, sibling cancellation, repeated resume, and Workbench/browser reload.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T97-interruption-reload-resume.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T97-interruption-reload-resume.spec.ts`; `npm run eval:fast`; focused crash/fault-injection, CAS/fork, fake-provider, stale-checkpoint, rollback, and performance cases.
- Toolchain: record Node/npm, state/checkpoint schemas, database/storage, provider/fake-provider, browser, OS/hardware, and affected musical tool identities.
- Observable outcome: kill and reload each production stage and multi-target workflow, then compare final identities and attempt ledgers against uninterrupted reference runs.
- Evidence: `../evidence/T97/verification.json` plus digest-bound redacted checkpoint/resume receipts.

## Public/Vault boundary

Public evidence contains disclosed fixture IDs, stage/checkpoint/system digests, bounded aggregate timings/status, and typed bounded failure codes/metrics only. Exact held-out identities/truth, source envelopes, provider payloads, reserve state, private diagnostics, and credentials remain private/Vault data.

## Blocked by

- 10
- 21
- 33
- 58
