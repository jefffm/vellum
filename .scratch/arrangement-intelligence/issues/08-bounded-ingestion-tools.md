# Bounded ingestion and tool execution

Status: ready-for-agent

Type: AFK

User stories: U1, U2

## What to build

Bound memory, archive, subprocess, artifact, and diagnostic resources throughout source ingestion and external musical tooling.

## Acceptance criteria

- [ ] Uploads stream or spool with incremental hashing and declared limits.
- [ ] Subprocess output, logs, generated files, and concurrency are bounded.
- [ ] OMR archive entry count and expanded sizes are bounded safely.
- [ ] Limit failures preserve canonical input and return typed actionable evidence.

## Blocked by

- 02
- 07
