# ADR 0021: Learn only from reviewed playtest evidence

## Status

Proposed — implemented evidence exists; Owner acceptance is deferred to T44.

## Context

Clicks, auditions, edits, and model suggestions are not automatically reliable preferences or musical facts. Physical playability depends on exact Instrument Instance and Performance Brief context. Evaluation tuning on held-out cases would contaminate the evidence used to judge it.

## Decision

Owner Playtest will own physical-use evidence for one exact Arrangement Score, Instrument Instance, Performance Brief, task, and performer context. Human Evaluation references the Playtest rather than copying it. Reviewed Learning may retain adopted and rejected candidates, edits, repairs, corrections, prediction disagreements, recurring choices, and usefulness markers, but it may change behavior only through explicit, versioned Personal Defaults, Knowledge promotion, or Calibration Candidate acceptance.

Calibration Candidates must disclose fitting data, remain isolated from held-out evaluation, and have no effect until accepted. Evaluator changes create new Evaluation versions. Deletion and privacy policy apply to local reviewed evidence and any exported artifacts.

## Implemented evidence

- Production: `src/server/lib/owner-store.ts`, `src/server/lib/owner-playtest-route.ts`, `src/server/lib/reviewed-learning.ts`, and `src/server/lib/human-comparison.ts`.
- Evaluation: `.scratch/arrangement-intelligence/evidence/T29/verification.json` through `T34/verification.json`.

## Consequences

- The system accumulates useful state without treating unreviewed behavior as authority.
- Physical claims remain scoped and stale when their context changes.
