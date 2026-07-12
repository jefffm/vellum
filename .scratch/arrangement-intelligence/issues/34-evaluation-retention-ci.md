# Evaluation retention, CI impact, and promotion

Status: ready-for-agent

Type: AFK

User stories: U1, U6, U9

## What to build

Operate the Evaluation Harness safely through storage lifecycle, change-impact selection, commands, reports, and reviewed baseline promotion.

## Acceptance criteria

- [ ] Content deduplication, baseline pinning, retention classes, private deletion, and garbage collection are explicit.
- [ ] Safe suite-impact mapping falls back broadly when impact is unknown.
- [ ] All specified `eval:*` commands emit machine-readable results and correct exit status.
- [ ] Promotion records exact run, reviewer, known defects, tradeoffs, and rationale.

## Blocked by

- 07
- 30
- 32
- 33
