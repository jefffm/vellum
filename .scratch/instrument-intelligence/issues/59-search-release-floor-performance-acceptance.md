# Search and release-floor performance acceptance

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U8, U10

SPEC coverage: Performance/operability; Slice 12; Machine Complete performance clauses

Requirement families touched: II-OPS-001, II-EXEC-012, II-MC-033–035

## What to build

Run the precommitted release-floor profile across ingestion, publication, manifest resolution, shared search, Continuo, imitative, and all three target workloads with checkpoint/cancellation/resume evidence.

## Acceptance criteria

- [ ] Reference and stress workloads record stage time, peak memory, persisted bytes, snapshot/manifest size, frontier/checkpoint size, cancellation response, checkpoint interval, and resume overhead.
- [ ] Each result binds exact hardware class, toolchain, clean-state method, profile, workload, system, and measurement digests.
- [ ] Budget exhaustion, cancellation, infrastructure failure, and proven unsat stay distinct; restart resumes exact compatible checkpoints.
- [ ] Mandatory threshold failure blocks advancement; unsupported/incomparable environments cannot pass.
- [ ] Performance optimization preserves reference-search equivalence, regression/evaluator semantics, determinism where claimed, and all target outputs.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T59-search-release-floor-performance-acceptance.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run eval:fast`; `npm run perf:instrument-intelligence`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T59/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 04
- 70
- 33
- 39
- 41
- 47
- 52
- 56
- 97
