# Executable specification and audit ledger

Status: complete

Type: AFK

User stories: U9

## What to build

Turn every normative Arrangement Intelligence clause and audit finding F001–F046 into a stable, machine-checkable requirement and evidence record used by the active goal judge.

## Acceptance criteria

- [x] Every normative clause has a stable `AI-PROD/STP/ICC/WPL/EVAL/DEL-###` ID, owner tracer, gate, and status.
- [x] Every F001–F046 finding maps to tracers and an allowed final disposition.
- [x] A verifier fails on unmapped, contradictory, stale, or missing mandatory evidence.
- [x] Current evidence is classified honestly as implemented, partial, absent, or unverified.

## Verification

See `../evidence/T01/verification.json`.

## Blocked by

None - can start immediately.
