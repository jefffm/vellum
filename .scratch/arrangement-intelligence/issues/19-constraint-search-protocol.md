# Serializable constraint and search protocol

Status: complete

Type: AFK

User stories: U4, U6

## What to build

Introduce reusable constraint, evaluator, Search Adapter, and honest Search Outcome contracts without one universal musical state.

## Acceptance criteria

- [x] Constraints are serializable, versioned, scoped, and provenance-bearing.
- [x] Evaluator evidence separates completeness, basis, authority, and presentation.
- [x] Search distinguishes candidate found, exhaustion, exhaustive infeasibility, uncertainty, cancellation, and failure.
- [x] Checkpoints and completeness certificates retain exact execution identity.

## Delivered

- `src/lib/constraint-search.ts` defines JSON-only Constraint Specifications, independent evaluator epistemics, Search Attempt configuration, exact execution identities, checkpoints, completeness certificates, all six honest terminal outcomes, and a generic state-parameterized Search Adapter contract.
- Constraint provenance covers Preservation Targets, mechanics, Analysis, history, Plan Decisions, Commitments, Personal Defaults, Owner instructions, and Policy Exceptions. Search budgets and pruning remain in the attempt configuration.
- Existing Arrangement Searches persist compiled Preservation Target constraints and pin their exact Plan, Performance Brief, target, adapter, compiler, evaluators, constraints, and attempt configuration.
- Completed arrangements produce `candidate_found`. Bounded realization and policy failures produce `search_exhausted`, expressly without an impossibility claim.
- Only `exhaustively_infeasible` accepts impossible wording, and it requires a completeness certificate with the identical execution digest. Checkpoint resume uses the same compatibility rule.
- Workspace persistence rejects terminal searches without outcomes, completed searches without candidates, outcome identity tampering, and execution identities that do not cite the workspace's exact Plan/Brief/target.

## Verification

- `src/lib/constraint-search.test.ts` covers JSON round-trip/no-functions, policy-independent observation identity, independent evaluator evidence dimensions, every Search Outcome variant, certified wording, mismatched checkpoints/certificates, and distinct adapter state declarations.
- `src/server/lib/arrangement-service.test.ts` covers compiled constraints, exact execution identity, durable `candidate_found`, and persistence tamper rejection in the real Greensleeves first loop.
- Creative, continuo, and imitative tracer tests pass with the protocol integrated, demonstrating that the shared contract does not impose one musical state.
- The complete repository suite and final quality gates are recorded in `evidence/T19/verification.json`.

## Deferred by design

- Tracers 23–25 supply instrument-specific adapter states and applicability evidence.
- Tracer 26 supplies the generic runner, deterministic replay, reference differentials, cancellation/resume execution, and completeness-proof verification. Until then, those requirements remain `partial`; this slice does not claim that current heuristic arrangers are exhaustive.

## Blocked by

- 10
- 15
- 16
