# Baroque-lute phrase realization

Status: complete

Type: AFK

User stories: U4, U6

## What to build

Search complete lute phrases across stopped courses and diapasons with target-appropriate right-hand and resonance evidence.

## Acceptance criteria

- [x] State distinguishes left-hand stopped-course work from right-hand diapason access.
- [x] Bass preparation, resonance, damping, sustain, and voice lineage are represented or disclosed unknown.
- [x] Style brisé affects search only when plan and historical context support it.
- [x] A target fixture proves phrase-level improvement over first-fit placement.

## Delivered

- The bounded historical plucked-string phrase engine now has a thirteen-course lute state vocabulary distinct from the baroque-guitar vocabulary: stopped-course left-hand work, right-hand diapason access, prepared and resonating basses, damping requirements, held notes, voice lineage, exact Bass Tuning, and style-brisé authorization.
- Every transition independently records stopped-course fret change, diapason courses, newly prepared bass courses, continuing resonances, basses requiring damping, right-hand bass-access count, and whether style brisé was authorized.
- Exact Plan, Performance Brief, Instrument Instance, and candidate-search identities persist with the lute evidence. Course identity and Bass Tuning remain those of the exact T21 instance.
- Style brisé is applied only when both an exact scoped Plan Decision and an overlapping Analysis Claim backed by historical-profile evidence support it. Missing Plan, missing history, and scope mismatch all produce explicit `not_applied` evidence.
- The Greensleeves lute fixture compares the phrase path to the former event-local first fit and proves lower total modeled physical motion while preserving the complete Principal Voice and using diapasons.
- French tablature, exact diapason notation, canonical playback, and constituent-string behavior remain projected from the same selected Arrangement Score and exact instance.

## Verification

- Unit tests cover the complete lute state/evidence vocabulary, real diapason transitions, independent right/left-hand metrics, style-brisé double authorization and scope mismatch, exact lineage, and strict improvement over event-local first fit.
- Arrangement Service tests prove the evidence survives schema validation and persistence with exact Plan, Brief, and instance identities.
- The real Greensleeves and course-10 LilyPond tracers retain exact French tablature, `///a`/D2 identity, PDF/SVG/MIDI, and non-duplicated playback.
- Full quality gates and evaluation evidence are recorded in `evidence/T24/verification.json`.

## Honest limits

- Preparation, resonance, and damping are represented symbolic search-state facts, not claims that a human can execute the passage comfortably or reliably at a declared tempo.
- Historical-profile authorization permits style brisé to enter search; it does not establish aesthetic success. T42 retains specialist/player/notation review.
- T26 adds unpruned/reference replay and safe-dominance verification across all target adapters.

## Blocked by

- 16
- 21
