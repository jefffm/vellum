# Independent evaluator framework contracts

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3, U8, U10

SPEC coverage: Independent observable framework; required synthetic mutations; Slice 4

Requirement families touched: II-EVAL-001, II-EVAL-007, II-EXEC-004B, II-EXEC-004G, II-NG-010, II-AUTH-001, II-BND-002, II-BND-006, II-EVAL-003, II-EXEC-000B, II-EXEC-000C, II-EXEC-000D, II-EXEC-002, II-EXEC-002B, II-EXEC-003B, II-EXEC-003D, II-EXEC-003E, II-EXEC-004C, II-EXEC-004F, II-EXEC-006A, II-EXEC-006C, II-EXEC-007A, II-EXEC-007B, II-EXEC-008A, II-EXEC-008C, II-EXEC-008D, II-EXEC-009A, II-EXEC-009C, II-EXEC-009D, II-EXEC-010A, II-EXEC-010C, II-EXEC-011A, II-EXEC-011B, II-EXEC-011C, II-EXEC-011D, II-EXEC-011E, II-EXEC-011F, II-EXEC-013A, II-EXEC-013B, II-EXEC-013C, II-EXEC-013D, II-EXEC-013E, II-EXEC-013F, II-EXEC-013G, II-EXEC-014A, II-EXEC-014B, II-EXEC-014C, II-EXEC-014E, II-EXEC-014F, II-LEARN-001, II-MUS-001, II-MUS-010, II-MUS-011, II-MUS-012, II-MUS-013, II-NG-002, II-NG-003, II-NG-004, II-NG-005, II-NG-006, II-NG-007, II-NG-011, II-NG-012, II-NG-014, II-OUT-001, II-OUT-002, II-SEED-005, II-SRC-007, II-SRC-008, II-SRC-009

## What to build

Build the shared evaluator protocol and synthetic contract harness for independent canonical-output recomputation, applicability/status semantics, Evaluation Cards, mutation registration, persistence, and dependency-driven recomputation. Real domain and target musical evaluators remain owned by their verticals.

## Acceptance criteria

- [ ] The common protocol consumes persisted canonical output plus capability-isolated evaluator inputs, never generator pass flags, generator-derived answers, or hidden aggregate scores.
- [ ] A synthetic fixture proves independently registered dimensions, exact evaluator/input/output identities, applicability, units, uncertainty, observations, Claim Scope, and typed bounded evaluator receipts through persistence and UI.
- [ ] The synthetic mutation registry changes one controlled observable at a time, proves the corresponding evaluator recomputes rather than trusts a declaration, and cannot contaminate generation.
- [ ] Shared status semantics preserve unavailable required input as blocked/incomplete and require an explicit profile rationale for `not_applicable`; unknown never becomes zero, neutral, or pass.
- [ ] Dependency changes stale the right Card and trigger deterministic recomputation without rewriting prior Cards; real Source Voice, harmonic, transposition, figure, lyric, spanner, constituent-attack, notation, playback, and target evaluators are explicitly deferred to their owning verticals.
- [ ] T35's broad independent evidence-contributor role is a late, rerunnable aggregation, not prospective evidence authority: it may claim a mapped clause only after the exact current implementation-owner generation exists and only by recomputing the registered target evaluators against that generation's canonical outputs and inputs.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T35-independent-observable-evaluator-contracts.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T35-independent-observable-evaluator-contracts.spec.ts`; `npm run eval:fast`; the tracer's evaluator-isolation and leak-canary cases through the focused command.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T35/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 20
- 22
- 72
