# Exact six-string classical-guitar projection

Status: complete

Type: AFK

User stories: U4

## What to build

Represent classical guitar as six single strings with hidden physical fingering evidence and independent standard-notation semantics.

## Acceptance criteria

- [x] Target instance records exact tuning, scale, setup, and string identities used by evaluation.
- [x] Hidden positions remain persisted even when no tablature or fingering numbers are printed.
- [x] Standard notation preserves voice durations, spelling, ties, stems, and sounding octave.
- [x] Playback derives once from canonical events rather than display staves.

## Delivered

- The shared Instrument Instance model now supplies a content-addressed 650 mm classical guitar with six stable single stopped strings, 19 frets, explicit action, standard E4–E2 tuning at A440, and target-local technique applicability.
- Arrangement Service creates and validates the exact instance before Performance Brief and Plan construction, then retains it in the Brief snapshot, Search constraints and execution identity, selected Score, persistence, engraving, and Audio Preview.
- Candidate events persist hidden course/fret, left-hand finger, hand position, barré identity, guide-finger lineage, and tie-derived sustain evidence. A feasibility filter rejects simultaneous use of one finger at different frets.
- Standard notation is projected from explicit canonical voice semantics rather than hidden tablature positions. The semantic record retains source voice, layer, stem, duration, tie, spelling-preserving written pitches, sounding pitches, and the guitar's written-to-sounding octave displacement.
- Engraving consumes canonical sounding pitches under `treble_8`, emits the declared stem direction, and omits hidden physical evidence when fingering labels or tablature were not requested.
- Audio Preview consumes canonical Arrangement Score events exactly once, carries the exact instance digest, and is independent of the number or kind of display staves.
- Right-hand fingering coverage is explicitly `unknown`; the slice does not convert missing right-hand evidence into a generic playability claim.

## Verification

- Unit tests cover exact construction, immutable identity mutations, tuning/range/mechanics, left-hand evidence, independent notation projection, spelling, stems, ties, duration, and playback cardinality.
- Arrangement Service tests prove exact identity through Brief, Search, Score, sibling family, reload, hidden fingering persistence, and notation semantics.
- The real Greensleeves PDF tracer compiles standard-notation PDF/SVG/MIDI, verifies exact-instance provenance, hidden-evidence omission, `treble_8`/stem semantics, and one canonical MIDI note-on per canonical sounding pitch.
- Full quality gates and evaluation evidence are recorded in `evidence/T22/verification.json`.

## Honest limits

- T25 adds phrase-state polyphonic realization and deeper right/left-hand ergonomic evaluation; this slice intentionally discloses right-hand coverage as unknown.
- Specialist/player confirmation of the physical setup and visual review of polyphonic notation remain late HITL evidence rather than machine-inferred facts.

## Blocked by

- 19
