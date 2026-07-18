# Classical-guitar phrase realization

Status: complete

Type: AFK

User stories: U4, U6

## What to build

Search classical-guitar phrases across positions and fingers while preserving polyphonic duration and readable standard notation.

## Acceptance criteria

- [x] State covers position, fingers, barré, guide fingers, sustain, voices, and disclosed right-hand scope.
- [x] A better complete path outranks needlessly violent locally valid shifts.
- [x] Polyphonic source voices retain independent durations and roles.
- [x] A named public-domain fixture validates notation, mechanics, and playback.

## Delivered

- Exact classical guitar now uses the bounded complete-phrase engine with target-specific state for hand position, finger occupation, barrés, guide fingers, sustained positions, active voice durations, notation voices, and explicit right-hand scope.
- Phrase cost now includes complete-position motion rather than only Principal Voice motion. The named Greensleeves fixture proves the selected economical path has strictly lower modeled total motion than the former event-local first fit.
- Retained polyphonic material is canonical `voiceConstituents` owned by Arrangement Score. Each constituent records exact source event/voice, role, sounding and written spelling, physical position, onset, independent duration, layer, stem, tie, and guitar octave displacement.
- Standard notation projects retained constituents into simultaneous LilyPond Voice contexts with voice-local spacers, durations, stems, ties, and spelling. Hidden physical fingering remains absent from the requested standard-notation output.
- Literal Audio Preview projects the same constituents exactly once with their own source voice, onset, duration, pitch, and constituent string; it no longer borrows the Principal Voice duration for retained lower voices.
- Right-hand fingering remains explicitly `unknown`. The candidate records represented left-hand and notation scope without promoting that missing evidence to a general playability claim.
- Exact Plan, Performance Brief, Instrument Instance, candidate evidence, notation, playback, persistence, and audits retain one lineage.

## Verification

- Unit tests cover phrase-state dimensions, hidden guide/finger evidence, strict improvement over first fit, multiple retained source voices, independent source durations/roles, spelling, simultaneous voices/stems, and right-hand disclosure.
- Arrangement Service tests prove voice constituents and candidate evidence survive schema validation and persistence with exact Plan, Brief, and instance identities.
- The public-domain Greensleeves PDF tracer compiles the selected classical arrangement to simultaneous-voice PDF/SVG/MIDI and verifies one MIDI/playback event per canonical voice constituent.
- Full quality gates and evaluation evidence are recorded in `evidence/T25/verification.json`.

## Honest limits

- Retained lower voices are a reduction chosen by the Arrangement Plan/search, not an assertion that every SATB source event survives. Every retained event has complete lineage; omissions remain Transformation Report concerns.
- Right-hand fingering, comfort, tempo suitability, preparation, and performance reliability remain unevaluated until target-player evidence. T43 retains visual/player review.
- T26 adds unpruned/reference differential replay and safe-dominance verification for the bounded search policies.

## Blocked by

- 16
- 22
