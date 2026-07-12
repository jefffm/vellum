# Resumable Guided Start checkpoints

Status: ready-for-agent

Type: AFK

User stories: U1, U2, U5

## What to build

Persist the exact Guided Start stage and canonical record identities so interrupted and partially completed workflows reopen rather than restart.

## Acceptance criteria

- [ ] Workflow stages and target-specific progress are persisted with exact versions.
- [ ] Resume and Restart are explicit and never infer state from English errors.
- [ ] Failed sibling targets retry independently without replacing completed siblings.
- [ ] Browser recovery tests cover review, provider interruption, reload, and partial completion.

## Blocked by

- 04
- 05
