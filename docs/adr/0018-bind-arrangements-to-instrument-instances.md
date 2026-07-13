# ADR 0018: Bind arrangements to exact Instrument Instances

## Status

Proposed — implemented evidence exists; Owner acceptance is deferred to T44.

## Context

An instrument name does not capture tuning, courses, doubled strings, re-entrancy, diapasons, scale length, setup, or notation semantics. Treating course and string as synonyms produced incorrect mechanics and playback.

## Decision

Every target-local plan, search, score, playtest, and evaluation will bind an immutable Instrument Instance with profile/version, physical setup, courses, strings, tuning state, notation configuration, applicability, and content digest. Course and component-string representation remain distinct. Standard notation and tablature are independently composable capabilities over the same canonical sounding events.

The first priority instances are five-course baroque guitar, thirteen-course baroque lute, and six-string classical guitar. Domain-specific profiles such as six-course Renaissance lute remain explicit instances rather than aliases for a priority target.

## Implemented evidence

- Production: `src/lib/instrument-instance.ts`, `src/lib/instrument-model.ts`, `src/lib/baroque-lute-instance.ts`, and `src/lib/classical-guitar-instance.ts`.
- Evaluation: `.scratch/arrangement-intelligence/evidence/T20/verification.json` through `T22/verification.json`, plus `T35/verification.json` and `T36/verification.json`.

## Consequences

- Feasibility and notation claims are scoped to exact physical facts.
- Changing tuning, stringing, or setup creates a sibling result, not a relabeled file.
