# Purpose-scoped Source Truth convergence

Status: complete

Type: AFK

User stories: U2, U9

## What to build

Authorize downstream work only for musical scopes whose current transcription and Analysis contain no unresolved consequential uncertainty.

## Acceptance criteria

- [x] Source Truth Assessments record purpose, scope, exact inputs, authorized claims, and blocked claims.
- [x] Analysis can reopen review and assessments converge by a deterministic stability rule.
- [x] Unaffected passages may proceed while affected passages remain blocked.
- [x] Corrections create new assessments and stale every exact dependent record.

## Completion evidence

- Source Truth Assessments now bind exact source, transcription/version, Normalized Score/version, Analysis/version, purpose, musical scope, Preservation Policy, optional Performance Brief, target set, claim decisions, complete considered/unresolved/blocking uncertainty sets, typed consequences, stability iteration, and supersession.
- The consequence engine treats confidence as evidence rather than authority, maps transcription categories and Analysis-discovered ambiguities into musical dimensions, and filters by exact passage and target scope. One fixture blocks the opening while authorizing an unaffected passage and sibling target.
- Analysis can reopen a resolved transcription uncertainty. Score-Anchored Review projects that exact item as outstanding with its new consequence; a resolved subsequent Analysis converges only when no new material blocking uncertainty remains.
- Corrections create immutable transcription, normalization, Analysis, and Source Truth descendants. Only leaf assessments are superseded, while exact Plans, Searches, Candidates, Scores, and Deliverables receive typed stale records without mutating their old bytes.
- The production Arrangement Service consumes the scoped consequence assessment and permits disclosed noncritical uncertainty while rejecting unresolved material Critical Uncertainty.
- Retained machine-readable verification: `.scratch/arrangement-intelligence/evidence/T12/verification.json`.

## Blocked by

- 05
- 06
- 10
