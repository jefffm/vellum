# Serialized workspace mutation and lineage recovery

Status: complete

Type: AFK

User stories: U1, U9

## What to build

Protect versioned workspace state from lost updates, unreachable records, deliverable divergence, and incorrect lineage resolution.

## Acceptance criteria

- [x] Workspace mutations serialize or compare revisions atomically.
- [x] Startup recovery identifies and safely handles orphaned records.
- [x] Immutable Deliverable metadata is checked before writing bytes.
- [x] Corrected score resolution follows exact transcription and parent lineage.

## Verification

See `../evidence/T07/verification.json`.

## Blocked by

- 04
