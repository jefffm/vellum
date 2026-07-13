# ADR 0020: Version evaluation manifests, baselines, and promotion

## Status

Accepted — Owner accepted the prototype architecture baseline at T44 on 2026-07-13.

## Context

Fixture assertions alone cannot establish what inputs, evaluators, policies, artifacts, and unknown human dimensions produced a result. Mutable “latest” baselines make regressions irreproducible, while a single overall grade conceals incompatible evidence.

## Decision

Evaluation Definitions, Cases, Suites, and resolved Manifests will be versioned. Runs, Case Runs, and Cards are immutable derived evidence and never mutate canonical music. Cards expose hard gates and separate source, plan, preservation, mechanics, history, notation, playback, workflow, human, and Owner-usefulness dimensions without an overall grade.

Baseline comparisons require compatible briefs or an explicit mapping. Promotion records the exact run, classification, suites, regressions, materiality, reviews, human evidence, unknowns, promoter, and rationale. Content-addressed artifacts retain provenance, privacy, expiry, pinning, and deletion behavior.

## Implemented evidence

- Production: `src/lib/evaluation-domain.ts`, `src/server/lib/evaluation-harness.ts`, `src/server/lib/evaluation-comparison.ts`, `src/server/lib/evaluation-promotion.ts`, and `src/server/lib/evaluation-store.ts`.
- Evaluation: `.scratch/arrangement-intelligence/evidence/T10/verification.json`, `T11/verification.json`, and `T32/verification.json` through `T36/verification.json`.

## Consequences

- Identical evidence can be replayed and compared without moving targets.
- Unknown and human-only dimensions remain visible and cannot be laundered into machine certainty.
