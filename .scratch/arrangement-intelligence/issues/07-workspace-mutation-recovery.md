# Serialized workspace mutation and lineage recovery

Status: ready-for-agent

Type: AFK

User stories: U1, U9

## What to build

Protect versioned workspace state from lost updates, unreachable records, deliverable divergence, and incorrect lineage resolution.

## Acceptance criteria

- [ ] Workspace mutations serialize or compare revisions atomically.
- [ ] Startup recovery identifies and safely handles orphaned records.
- [ ] Immutable Deliverable metadata is checked before writing bytes.
- [ ] Corrected score resolution follows exact transcription and parent lineage.

## Blocked by

- 04
