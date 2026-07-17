# 11 — Playtest remediation and milestone closure

Status: ready-for-agent

Type: AFK

Blocked by: 10

## What to build

Turn every concrete nonpassing Owner finding into a focused regression, repair the smallest
responsible shared or target-specific behavior, rerun the real three-target workflow, and document
the demonstrated product boundary.

## Acceptance criteria

- [ ] Each actionable finding has a failing regression before its fix.
- [ ] Repairs preserve passing behavior on the other targets and public fixtures.
- [ ] The real PDF workflow completes again with current artifacts and synchronized playback.
- [ ] Remaining limitations are concrete non-goals or explicitly incomplete behavior, not hidden passes.
- [ ] The Owner's usefulness decision and all automated dimensions are summarized without claiming universal authenticity or playability.
- [ ] `SPEC.md` completion criteria are either satisfied or a narrowly scoped follow-up product tracer is recorded.

## Gates

All base and conditional gates exercised by the repaired behavior.
