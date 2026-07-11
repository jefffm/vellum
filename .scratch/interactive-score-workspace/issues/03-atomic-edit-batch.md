# Atomic versioned Edit Batch

Status: ready-for-agent

Type: AFK

## What to build

Allow selected Arrangement Events to receive staged manual edits to pitch, rhythm, course/fingering, insertion, or deletion. The user can review the pending changes and save them atomically as one new Arrangement Score version. The save creates the narrowest applicable Editorial Commitments, one Arrangement Branch, one complete Transformation Report, and one Preservation Audit; failure leaves canonical state unchanged.

## Acceptance criteria

- [ ] Several event changes can be staged, revised, and discarded without creating versions.
- [ ] One save creates exactly one child Arrangement Score version and one branch regardless of edit count.
- [ ] Each changed semantic dimension receives an inspectable narrow Commitment Scope.
- [ ] The complete candidate state passes instrument validation and Preservation Audit before commit.
- [ ] A failed batch creates no partial Arrangement Score, commitment, branch, or Deliverable records.
- [ ] Greensleeves can save two fingering corrections together as Arrangement Score v2.

## Blocked by

- Tracer 02.
