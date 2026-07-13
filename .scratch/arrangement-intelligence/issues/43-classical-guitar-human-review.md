# Classical-guitar physical review and baseline approval

Status: ready-for-human

Type: HITL

User stories: U4, U6, U8

## What to build

Physically and musically review the exact classical-guitar result and accept or reject its Evaluation Baseline.

## Acceptance criteria

- [ ] Exact guitar, Performance Brief, tempo/context, artifact, and protocol are recorded.
- [ ] Position, sustain, polyphony, notation, recognition, and editorial evidence is reviewed.
- [ ] Findings are corrected or explicitly accepted with rationale.
- [ ] Baseline promotion records reviewer, known limitations, confidence, and stale dependencies.

## Blocked by

- 40

## Machine handoff ready

- Exact request: `evidence/T40/review-packages/classical-guitar-6/review-request.json`.
- Exact LilyPond, SVG, PDF, MIDI, and Audio Preview bytes are digest-bound by the request.
- Required scoped roles: target player, engraving editor, Owner, and baseline reviewer.
- The request requires position/sustain, polyphonic clarity, recognition, notation, usefulness, and baseline-tradeoff evidence against the modeled standard EADGBE setup.
- No human attestation has been created or inferred. This tracer remains `ready-for-human`.
