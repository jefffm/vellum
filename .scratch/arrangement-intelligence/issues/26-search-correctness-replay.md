# Search correctness, completeness, and replay

Status: ready-for-agent

Type: AFK

User stories: U4, U6, U9

## What to build

Make state pruning, comparison, cancellation, checkpointing, and historical execution claims honest across all priority adapters.

## Acceptance criteria

- [ ] Dominance is checked against unpruned reference search on small finite spaces.
- [ ] Metrics declare units, direction, applicability, uncertainty, and materiality.
- [ ] Automatic selection uses authoritative lexicographic or dominance rules rather than proxy totals.
- [ ] Historical runs are recomputable only under exact compatible identities.

## Blocked by

- 23
- 24
- 25
