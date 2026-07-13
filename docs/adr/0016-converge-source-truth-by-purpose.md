# ADR 0016: Converge Source Truth by purpose

## Status

Proposed — implemented evidence exists; Owner acceptance is deferred to T44.

## Context

An OMR confidence score or one global `reviewed` flag cannot authorize every downstream use. A wrong note may be harmless to layout and decisive for a Principal Voice, Continuo Foundation, subject entry, or cadence. Corrections must invalidate dependent work without rewriting history.

## Decision

Vellum will retain immutable source evidence, version Score Transcriptions, derive Normalized Scores, and record purpose- and scope-specific Source Truth authorization. Review converges iteratively: a correction creates a new version, records its consequence, and stales only dependent analysis, plans, arrangements, and evaluations. Adapter evidence remains distinguishable from reviewed musical truth.

The flat LilyPond arrangement store is not Source Truth. Its data is explicitly noncanonical and must enter an Arrangement Workspace through a real source import before it can support reviewed claims.

## Implemented evidence

- Production: `src/server/lib/omr.ts`, `src/server/lib/source-import-service.ts`, `src/server/lib/workspace-store.ts`, and `src/server/lib/arrangement-route.ts`.
- Evaluation: `.scratch/arrangement-intelligence/evidence/T12/verification.json`, `T36/verification.json`, `T37/verification.json`, and `T38/verification.json`.

## Consequences

- Downstream sophistication cannot conceal unresolved source uncertainty.
- Old versions remain reproducible and inspectable.
- No migration may manufacture missing review authority.
