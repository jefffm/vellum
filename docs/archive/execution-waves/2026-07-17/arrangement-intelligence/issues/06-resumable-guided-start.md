# Resumable Guided Start checkpoints

Status: complete

Type: AFK

User stories: U1, U2, U5

## What to build

Persist the exact Guided Start stage and canonical record identities so interrupted and partially completed workflows reopen rather than restart.

## Acceptance criteria

- [x] Workflow stages and target-specific progress are persisted with exact versions.
- [x] Resume and Restart are explicit and never infer state from English errors.
- [x] Failed sibling targets retry independently without replacing completed siblings.
- [x] Browser recovery tests cover review, provider interruption, reload, and partial completion.

## Verification

See `../evidence/T06/verification.json`.

## Blocked by

- 04
- 05
