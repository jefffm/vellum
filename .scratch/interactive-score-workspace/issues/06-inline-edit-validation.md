# Inline Edit Batch validation and repair

Status: complete

Type: AFK

## What to build

Validate the complete staged Edit Batch before commit and place playability, voice-leading, Principal Voice, counterpoint, and Preservation Policy consequences beside the affected notation. Offer safe, ranked repairs where deterministic or candidate search can provide them; never conceal a Policy Exception or Policy Drift behind bulk approval.

## Acceptance criteria

- [x] Staged edits receive live hard/soft Validation Findings scoped to musical objects.
- [x] Stretch, collision, range, lost Principal Voice, and audit failures highlight the affected notation.
- [x] Applicable repairs can be previewed without mutating canonical state.
- [x] Hard failures block commit; owner-approved localized exceptions follow the existing versioned Policy Exception workflow.
- [x] The original six-to-one baroque-guitar reach is rejected and explained inline.

## Blocked by

- Tracer 03.
- Tracer 05.
