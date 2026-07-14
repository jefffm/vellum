# ADR 0020: Version evaluation manifests, baselines, and promotion

## Status

Accepted — Owner accepted the prototype architecture baseline at T44 on 2026-07-13.

## Context

Fixture assertions alone cannot establish what inputs, evaluators, policies, artifacts, and unknown human dimensions produced a result. Mutable “latest” baselines make regressions irreproducible, while a single overall grade conceals incompatible evidence.

## Decision

Evaluation Definitions, Cases, Suites, and resolved Manifests will be versioned. Runs, Case Runs, and Cards are immutable derived evidence and never mutate canonical music. Cards expose hard gates and separate source, plan, preservation, mechanics, history, notation, playback, workflow, human, and Owner-usefulness dimensions without an overall grade.

Baseline comparisons require compatible briefs or an explicit mapping. Promotion records the exact run, classification, suites, regressions, materiality, reviews, human evidence, unknowns, promoter, and rationale. Content-addressed artifacts retain provenance, privacy, expiry, pinning, and deletion behavior.

Aggregate hard-gate and acceptance status follows an explicit precedence: any conclusive required product or output violation is `fail`; otherwise an unavailable required source, access decision, provider, evaluator, Vault, or infrastructure dependency is `blocked`; otherwise unfinished, partial, unknown, or unevaluated required evidence is `incomplete`; only complete passing evidence is `pass`. Per-gate execution, evidence completeness, and result remain separately inspectable.

Held-out evaluation uses a Vault-only append-only attempt ledger whose unique genesis is committed by the pre-output split manifest and whose head advances by compare-and-swap. Every fork remains retained and blocks qualification until reconciled; every blocked, incomplete, failed, and invalid attempt remains in order. Invalidation must be permitted by the frozen policy and independent of the observed candidate result, and valid failures become permanent regressions. Capability Qualification pins the finalized ledger, exact Generation System, qualified truth and evaluator authorities, explicit Claim Scope, and a deterministic or precommitted stochastic execution policy; one favorable stochastic sample cannot qualify capability.

## Implemented evidence

- Production: `src/lib/evaluation-domain.ts`, `src/server/lib/evaluation-harness.ts`, `src/server/lib/evaluation-comparison.ts`, `src/server/lib/evaluation-promotion.ts`, and `src/server/lib/evaluation-store.ts`.
- Evaluation: `.scratch/arrangement-intelligence/evidence/T10/verification.json`, `T11/verification.json`, and `T32/verification.json` through `T36/verification.json`.

## Consequences

- Identical evidence can be replayed and compared without moving targets.
- Unknown and human-only dimensions remain visible and cannot be laundered into machine certainty.
