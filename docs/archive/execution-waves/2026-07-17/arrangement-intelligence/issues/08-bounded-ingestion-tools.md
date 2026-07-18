# Bounded ingestion and tool execution

Status: complete

Type: AFK

User stories: U1, U2

## What to build

Bound memory, archive, subprocess, artifact, and diagnostic resources throughout source ingestion and external musical tooling.

## Acceptance criteria

- [x] Uploads stream or spool with incremental hashing and declared limits.
- [x] Subprocess output, logs, generated files, and concurrency are bounded.
- [x] OMR archive entry count and expanded sizes are bounded safely.
- [x] Limit failures preserve canonical input and return typed actionable evidence.

## Verification

See `../evidence/T08/verification.json`.

## Blocked by

- 02
- 07
