# ADR 0019: Search serializable constraints and report honest outcomes

## Status

Accepted — Owner accepted the prototype architecture baseline at T44 on 2026-07-13.

## Context

Event-local first fit, opaque executable predicates, and one proxy score cannot explain why an arrangement was selected or whether search was exhaustive. The first complete backtracking assignment can be playable yet musically poor.

## Decision

Constraint Specifications and Evaluator Specifications will be immutable, serializable, versioned data with applicability and identity. Arrangement Search will retain multiple candidates, separate hard constraints from evidence dimensions, rank complete retained assignments, disclose bounds and truncation, and report `found`, `unsat_proven`, `budget_exhausted`, `cancelled`, or `infrastructure_failed` honestly. These are the canonical terms formerly summarized as success, infeasible, exhausted, cancelled, and failed. `unsat_proven` requires an exhaustive proof under the declared finite search domain; `budget_exhausted` does not imply infeasibility. Adoption requires a complete Transformation Report, Preservation Audit, independent required Evaluation Cards, and a separate immutable Adoption Decision under the exact Preservation Policy.

No aggregate grade may hide a hard failure. Rankings compare compatible candidates within declared evidence; they do not certify comfort, history, beauty, or global optimality.

## Implemented evidence

- Production: `src/lib/constraint-search.ts`, `src/lib/imitative-arranger.ts`, `src/lib/preservation-policy.ts`, and `src/server/lib/arrangement-service.ts`.
- Evaluation: `docs/archive/execution-waves/2026-07-17/arrangement-intelligence/evidence/T19/verification.json`, `T23/verification.json` through `T26/verification.json`, `T36/verification.json`, and `T38/verification.json`.

## Consequences

- Search behavior is replayable and evaluator identity is inspectable.
- Bounded results state their epistemic limit rather than implying exhaustive proof.
