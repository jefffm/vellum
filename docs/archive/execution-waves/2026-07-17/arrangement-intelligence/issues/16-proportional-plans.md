# Proportional Arrangement Plans

Status: complete

Type: AFK

User stories: U3

## What to build

Persist musical design between Analysis and realization without forcing creative bureaucracy onto literal transformations.

## Acceptance criteria

- [x] Minimal projection and sectional reduction Plan kinds are versioned with exact inputs.
- [x] Plan Decisions record scope, evidence, alternatives, portability, policy consequence, and confirmation.
- [x] Plan correction stales dependent searches without mutating prior scores.
- [x] The default UI presents a concise plan and asks only consequential questions.

## Completion evidence

- Arrangement Plans now pin exact Source Truth, Normalized Score, Analysis, Arrangement Brief revision/digest, Performance Brief, target, and Preservation Policy lineage. Their planning scope, Transposition Plan, passage-level texture/density/voice/bass/counterpoint/harmony/form intentions, and complete material disposition are durable schema data.
- `minimal_projection` is mechanically restricted to zero-transposition retained structure with no invented alternatives or policy exceptions. `sectional_reduction` must declare a real density or material reduction; later plan kinds remain owned by T18 and target-specialist tracers.
- Every Plan Decision carries resolvable musical scope, evidence, rationale, viable alternatives, confidence, material ambiguity, target portability, policy consequence, Owner-confirmation state, and downstream constraint/strategy identities.
- Consequential decisions remain proposals and put the Plan in `confirmation_required`; unresolved transposition blocks realization. The default artifact UI summarizes the plan in plain language, displays no question for literal work, and renders a confirmation action only for proposed Owner decisions.
- Plan correction creates a new immutable sequential version with a `supersedesPlanId`. Dependent searches, candidates, scores, and deliverables receive explicit stale records while the prior Arrangement Score remains byte-for-byte unchanged.
- Focused tests cover literal and sectional plans, exact lineage, semantic validation, confirmation behavior, immutable correction, stale propagation, and concise UI rendering. Full regression: 972 passed, one expected provider smoke skip.
- Retained machine-readable verification: `.scratch/arrangement-intelligence/evidence/T16/verification.json`.

## Blocked by

- 14
- 15
