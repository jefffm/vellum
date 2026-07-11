# Version-aware score refresh and comparison

Status: complete

Type: AFK

## What to build

After an Edit Batch commits, render the new Arrangement Score and its Audio Preview immediately. Add a compact lineage navigator that shows parent, current version, branch, active Editorial Commitments, audit status, and changed musical objects, with a side-by-side or overlay comparison against the parent.

## Acceptance criteria

- [x] Successful edit commit replaces the active score with the new version without a manual URL change.
- [x] Parent and current versions remain independently openable and reproducible.
- [x] The UI identifies changed events and semantic dimensions.
- [x] Version navigation never relabels or overwrites an existing Deliverable.
- [x] Greensleeves v1 and v2 can be switched and audibly/visually compared.

## Blocked by

- Tracer 03.
