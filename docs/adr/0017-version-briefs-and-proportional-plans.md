# ADR 0017: Version briefs and proportional plans

## Status

Accepted — Owner accepted the prototype architecture baseline at T44 on 2026-07-13.

## Context

A prompt alone does not durably distinguish requested outcomes, performer constraints, and transformation choices. One universal plan shape would also flatten reductions, continuo realizations, and imitative intabulations into misleading fields.

## Decision

Arrangement Brief and Performance Brief own versioned intent. Arrangement Plan owns a proportional, typed transformation strategy linked to exact source, analysis, brief, policy, target, and Instrument Instance versions. Common lineage and decision records are shared, while plan-kind state exists only when musically applicable. Superseding an input stales dependent plans rather than mutating them.

Principal Voice is one possible Preservation Target, not a mandatory plan field. Continuo and imitation retain their own foundation, generated-voice, entry, lineage, and cadence state.

## Implemented evidence

- Production: `src/lib/performance-brief.ts`, `src/lib/arrangement-plan.ts`, `src/lib/musicological-analysis.ts`, and `src/server/lib/arrangement-service.ts`.
- Evaluation: `docs/archive/execution-waves/2026-07-17/arrangement-intelligence/evidence/T16/verification.json`, `T18/verification.json`, `T36/verification.json`, `T37/verification.json`, and `T38/verification.json`.

## Consequences

- The request, transformation decision, and realized score remain separately correctable.
- Cross-domain reuse does not impose false fretted-position or Principal Voice state.
