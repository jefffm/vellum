# 01 — Non-Greensleeves three-target baseline

Status: completed

Type: AFK

Blocked by: None

## What to build

Choose one rights-approved public source other than Greensleeves that contains a recognizable
Principal Voice and meaningful subordinate material. Run it through the real source and
arrangement boundaries for all three priority targets. Turn the current target-specific musical
failures into focused known-bad tests and expose a repeatable developer command or fixture path.

This tracer diagnoses and locks the baseline; it does not repair every failure.

## Acceptance criteria

- [x] The source identity, rights basis, transcription truth, and expected musical roles are documented.
- [x] One command generates or evaluates all three target candidates using production boundaries.
- [x] Tests detect Principal Voice loss, incoherent subordinate material, and at least one target-specific mechanical or idiomatic failure.
- [x] The baseline does not depend on Greensleeves and does not silently substitute a synthetic source.
- [x] Existing Greensleeves regressions remain intact.

## Gates

Base gates plus `npm run eval:golden` and `npm run eval:parity`.
