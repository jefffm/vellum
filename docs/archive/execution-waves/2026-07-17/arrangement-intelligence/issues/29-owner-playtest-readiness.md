# Owner Playtest and Arrangement Readiness

Status: complete

Type: AFK

User stories: U5, U6, U7

## What to build

Capture exact-context physical feedback and present a truthful derived readiness summary without turning personal evidence into universal mechanics.

## Acceptance criteria

- [x] Playtests anchor score/candidate, passage, instrument, Performance Brief, actual context, outcome, confidence, and rationale.
- [x] Structured findings cover mechanics, technique, clarity, identity, history, and notation.
- [x] Readiness separates inspection, playtest, Owner-tested, blocked, and stale states.
- [x] Playtest consequences remain proposals until adopted through the correct boundary.

## Delivered

- Immutable Owner Playtests bind digests for the exact Arrangement Score, optional Search-compatible candidate, Instrument Instance, and Performance Brief plus exact Arrangement Events and Playback Occurrences.
- Actual tempo, practice context, notation/listening/physical evidence basis, exhaustive outcome, confidence, structured observations, rationale, and proposed consequences are retained without mutating scores, source truth, commitments, mechanics, or historical knowledge.
- Observation vocabulary keeps mechanics, technique, clarity, identity, history, and notation independent while covering reach, shifts, held-note conflict, right hand, damping, voice clarity, cadence, source identity, historical practice, and notation.
- Arrangement Readiness is a recomputable view with `inspection_only`, `playtest_available`, `owner_tested`, `blocked`, and `stale` states. It distinguishes current evidence from ancestor-version evidence and gives upstream staleness precedence.
- The score-selection workbench exposes Record playtest. The dialog anchors the active Playback Occurrence, captures the declared context and one structured finding, shows current readiness, and states that proposed consequences require later explicit adoption.
- Workspace schema v8 persists and recovers playtests locally. Media remains optional; this slice sends none.

## Verification

- The Greensleeves service test exercises inspection-only, listening/inspection evidence, physical Owner testing, blocking physical evidence, candidate identity, proposal retention, and upstream/ancestor stale readiness.
- Tests prove three Playtests create no score, Editorial Commitment, or Family Commitment and therefore do not silently promote personal evidence.
- Schema and UI tests cover the exhaustive vocabularies, workspace migration/recovery, and visible selected-passage entry point.
- Full gates and evaluation evidence are recorded in `evidence/T29/verification.json`.

## Honest limits

- T30 owns Human Evaluation roles, de-duplication by Playtest reference, reviewer protocol, and comparative conclusions.
- T31 owns explicit reviewed-learning adoption/rejection flows for proposed consequences; T29 stores proposals but deliberately applies none.
- Late HITL tracers own actual signed target-player evidence, wording/ergonomics review, and the three-instrument playtests. Automated tests do not claim that the fixture has physically been played.
- Playtest media is optional and absent. T34 owns retention policy and any future local media lifecycle.

## Blocked by

- 10
- 15
- 28
