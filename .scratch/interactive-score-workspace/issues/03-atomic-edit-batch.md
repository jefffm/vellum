# Atomic versioned Edit Batch

Status: complete

Type: AFK

## What to build

Allow selected Arrangement Events to receive staged manual edits to pitch, rhythm, and course/fingering. The user can review the pending changes and save them atomically as one new Arrangement Score version. The save creates the narrowest applicable Editorial Commitments, one Arrangement Branch, one complete Transformation Report, and one Preservation Audit; failure leaves canonical state unchanged. Structural insertion, deletion, and candidate-splicing remain passage-generation operations covered by tracer 08 rather than being disguised as ordinary field edits.

## Acceptance criteria

- [x] Several event changes can be staged, revised, and discarded without creating versions.
- [x] One save creates exactly one child Arrangement Score version and one branch regardless of edit count.
- [x] Each changed semantic dimension receives an inspectable narrow Commitment Scope.
- [x] The complete candidate state passes instrument validation and Preservation Audit before commit.
- [x] A failed batch creates no partial Arrangement Score, commitment, branch, or Deliverable records.
- [x] Greensleeves can save two fingering corrections together as Arrangement Score v2.

## Blocked by

- Tracer 02.
