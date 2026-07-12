# Exact thirteen-course lute projection

Status: complete

Type: AFK

User stories: U4

## What to build

Represent exact stopped courses, diapasons, tuning schemes, notation identity, and sounding behavior for a thirteen-course D-minor lute.

## Acceptance criteria

- [x] Stopped and unstopped courses retain distinct physical semantics.
- [x] Bass Tuning changes sounding pitch without changing course-identity signs.
- [x] Course 10 renders `///a` and sounds D2 under the default configuration.
- [x] Engraving, playback, lineage, and evaluation use one exact instance.

## Delivered

- The shared Instrument Instance model now supplies a content-addressed thirteen-course D-minor lute with one chanterelle, paired stopped courses 2–6, and seven single unstopped diapasons.
- Every constituent string has stable identity, pitch, and fretting behavior. Unstopped courses reject nonzero frets; stopped pairs sound both strings.
- D-minor, A-minor, G-minor, D-major, and E-minor Bass Tuning configurations create distinct immutable instances. Retuning changes diapason pitches and digest without changing course/notation identity.
- French notation identities are explicit per course: `a`, `/a`, `//a`, `///a`, `4`, `/4`, and `//4` for courses 7–13. Course 10 is `///a` and D2 in the default and D-major fixtures.
- The exact instance is generated before Performance Brief and Plan creation, then retained by Brief snapshot, Search constraints and execution identity, selected Score, edit validation, engraving, Audio Preview, and persistence checks.
- Audio Preview projects stopped pairs to their constituent strings, preserves a single semantic Principal Voice occurrence, and identifies each acoustic string. Diapasons remain single sounding events.
- The legacy profile's declared upper range was corrected from C5 to Db5 because an eight-fret F4 chanterelle reaches Db5.
- Exact instances cannot be retuned by mutating `InstrumentModel`; selecting a different Bass Tuning requires a different content-addressed instance.

## Verification

- Unit tests cover paired/single construction, stopped/unstopped behavior, tuning mutations, immutable model behavior, complete range, course-10 notation/pitch identity, and engraving identity.
- The Arrangement Service Greensleeves workflow proves exact lute identity through Brief, Search, Score, sibling family, reload, audit, engraving, and playback.
- The real LilyPond tracer compiles the exact-digested default/D-major configurations, renders `///a`, and verifies MIDI D2 plus all seven historical diapason signs without duplicate playback.
- Full quality gates and evaluation evidence are recorded in `evidence/T21/verification.json`.

## Honest limits

- Scale length, stringing convention, historical suitability, and player ergonomics remain pending specialist/player evidence rather than being promoted from machine fixtures.
- T24 adds phrase-state right-hand bass access, preparation, resonance, damping, and contextual style-brisé evaluation. T29 adds dimension-specific stale-evidence propagation.

## Blocked by

- 19
