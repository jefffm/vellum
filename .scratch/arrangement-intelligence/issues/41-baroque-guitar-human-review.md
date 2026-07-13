# Baroque-guitar physical review and baseline approval

Status: wontfix

Type: HITL

User stories: U4, U6, U8

## What to build

Physically and musically review the exact baroque-guitar result and accept or reject its Evaluation Baseline.

## Acceptance criteria

- [ ] Exact instrument, Performance Brief, tempo/context, artifact, and protocol are recorded.
- [ ] Physical playability, recognition, historical practice, and engraving receive scoped attestations.
- [ ] Findings are corrected or explicitly accepted with rationale.
- [ ] Baseline promotion records reviewer, known limitations, confidence, and stale dependencies.

## Blocked by

- 40

## Machine handoff ready

- Exact request: `evidence/T40/review-packages/baroque-guitar-5/review-request.json`.
- Exact LilyPond, SVG, PDF, MIDI, and Audio Preview bytes are digest-bound by the request.
- Required scoped roles: target player, historical specialist, engraving editor, Owner, and baseline reviewer.
- `npm run review:validate` rejects stale bytes, missing roles, nonphysical target-player evidence, undocumented historical authority, and undisclosed limitations.
- No human attestation has been created or inferred.

## Owner disposition

On 2026-07-13 the Owner waived formal role-scoped attestation for this prototype wave and accepted the current artifact only as a prototype baseline with known limitations. Physical playability, historical idiom, notation quality, and independent baseline approval remain unevaluated rather than passed. The missing punteado/rasgueado/mixed-style and alfabeto-aware realization work is carried into the follow-up wave.
