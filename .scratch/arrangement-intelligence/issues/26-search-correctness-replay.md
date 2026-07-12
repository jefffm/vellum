# Search correctness, completeness, and replay

Status: complete

Type: AFK

User stories: U4, U6, U9

## What to build

Make state pruning, comparison, cancellation, checkpointing, and historical execution claims honest across all priority adapters.

## Acceptance criteria

- [x] Dominance is checked against unpruned reference search on small finite spaces.
- [x] Metrics declare units, direction, applicability, uncertainty, and materiality.
- [x] Automatic selection uses authoritative lexicographic or dominance rules rather than proxy totals.
- [x] Historical runs are recomputable only under exact compatible identities.

## Delivered

- A typed comparison registry declares each metric's units, direction, normalization, uncertainty, applicability, missing-value behavior, and materiality policy.
- Candidate selection now rejects hard failures and missing required evidence first, then applies the persisted policy's lexicographic priorities. Legacy normalized display scores remain observable but cannot select an arrangement, and weighted totals are no longer emitted as authority.
- Exact ties remain ambiguous; candidate enumeration order cannot invent a winner. The selected candidate records its policy method and decisive metric, while Arrangement Search persists the complete comparison policy.
- A finite reference verifier runs the same small search with and without dominance pruning and requires equivalent optimal results. The differential fixture demonstrates less expansion without loss of the optimum.
- Checkpoint and certificate reuse now requires equality of the entire execution identity, including component IDs, versions and digests, Plan, Performance Brief, target, Instrument Instance, constraints, and attempt configuration. A forged component version is rejected even if the top-level digest is left unchanged.
- Bounded search exhaustion remains distinct from certified exhaustive infeasibility and cannot be described as impossible.

## Verification

- Unit coverage proves metric-schema completeness, hard-gate precedence, missing-evidence rejection, lexicographic priority, deterministic replay under reversed enumeration, honest ambiguity, reference-search equivalence, and exact checkpoint incompatibility.
- The Greensleeves Arrangement Service integration proves policy and typed measurements persist across reload and selected score events match the policy winner.
- Full project, real Audiveris, Podman isolation, Greensleeves PDF, evaluation, and specification gates are recorded in `evidence/T26/verification.json`.

## Honest limits

- The generic finite differential verifier establishes the pruning proof mechanism; adapter-specific exhaustive counterexample suites remain partial and continue through later evaluation tracers.
- Pareto reduction and cosmetic-variant clustering are not introduced here. Inapplicable dimensions therefore cannot create false dominance because automatic selection is lexicographic and skips a metric unless every survivor has an applicable value.
- Historical artifacts remain inspectable when exact implementations are unavailable; T34 adds the user-facing recomputability classification and retention workflow.

## Blocked by

- 23
- 24
- 25
