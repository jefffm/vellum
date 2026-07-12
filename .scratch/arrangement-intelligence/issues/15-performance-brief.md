# Performance Brief and Intended Performer Profile

Status: complete

Type: AFK

User stories: U3, U4

## What to build

Make playability and arrangement quality relative to a declared musical use, intended performer, difficulty, tempo, preparation, reliability, technique, and notation context.

## Acceptance criteria

- [x] Guided Start captures a concise Performance Brief with safe defaults and progressive disclosure.
- [x] Performance Brief persists independently from Owner Ergonomic Profile and instrument facts.
- [x] Search, planning, and evaluation cite the exact brief used.
- [x] Incompatible briefs make comparisons intentionally incomparable.

## Completion evidence

- Guided Start visibly captures intended use, performer proficiency, and difficulty; a progressive disclosure section captures optional tempo range, preparation, reliability, technique familiarity, allowed/avoided techniques, notation needs, and ensemble role. Invalid tempo ranges fail before workspace creation.
- Resumable Guided Workflow checkpoints persist the exact input so an interrupted multi-target run cannot silently return to defaults. Each target augments notation needs with its selected Notation Layout before creating the canonical brief.
- Immutable Performance Briefs retain the exact Arrangement Brief revision, digest, and evidence snapshot; store validation rejects stale or mismatched request lineage, invalid tempo ranges, contradictory techniques, and target-mismatched difficulty context.
- Intended Performer Profile admits proficiency and technique familiarity but rejects Owner anatomy and Instrument Instance facts such as scale, tuning, and stringing. Technique omission remains explicitly `unspecified`, not universal permission.
- Each target receives a target-specific difficulty definition/evidence identity. Search, Source Truth, Arrangement Plan, Arrangement Score lineage, and Evaluation Card cite the same exact Performance Brief identity.
- Evaluation manifest comparison now includes Arrangement/Performance Brief digests. A novice/expert brief change is `incomparable` unless a reviewed compatibility mapping is supplied.
- Retained machine-readable verification: `.scratch/arrangement-intelligence/evidence/T15/verification.json`.

## Blocked by

- 09
- 14
