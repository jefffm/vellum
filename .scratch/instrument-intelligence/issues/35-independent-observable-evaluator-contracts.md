# Independent evaluator framework contracts

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3, U8, U10

SPEC coverage: Independent observable framework; required synthetic mutations; Slice 4

Requirement families touched: II-EVAL-001, II-EVAL-007, II-EXEC-004B

## What to build

Build the shared evaluator protocol and synthetic contract harness for independent canonical-output recomputation, applicability/status semantics, Evaluation Cards, mutation registration, persistence, and dependency-driven recomputation. Real domain and target musical evaluators remain owned by their verticals.

## Acceptance criteria

- [ ] The common protocol consumes persisted canonical output plus capability-isolated evaluator inputs, never generator pass flags, generator-derived answers, or hidden aggregate scores.
- [ ] A synthetic fixture proves independently registered dimensions, exact evaluator/input/output identities, applicability, units, uncertainty, observations, Claim Scope, and typed bounded evaluator receipts through persistence and UI.
- [ ] The synthetic mutation registry changes one controlled observable at a time, proves the corresponding evaluator recomputes rather than trusts a declaration, and cannot contaminate generation.
- [ ] Shared status semantics preserve unavailable required input as blocked/incomplete and require an explicit profile rationale for `not_applicable`; unknown never becomes zero, neutral, or pass.
- [ ] Dependency changes stale the right Card and trigger deterministic recomputation without rewriting prior Cards; real Source Voice, harmonic, transposition, figure, lyric, spanner, constituent-attack, notation, playback, and target evaluators are explicitly deferred to their owning verticals.

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
