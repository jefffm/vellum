# Imitative intabulation through the shared loop

Status: complete

Type: AFK

User stories: U3, U6, U8

## What to build

Validate shared planning, search, evaluation, and lineage through imitative music without inventing a permanent Principal Voice.

## Acceptance criteria

- [x] Plan and Preservation Targets protect entries, subject shapes, voice continuity, and cadential goals.
- [x] Complete assignments are ranked rather than accepting the first backtracking solution.
- [x] Notation and playback isolate source voices without duplicated sounding events.
- [x] Evaluation proves reuse of shared contracts without generic counterpoint rules.

## Delivered

- The imitative solver now retains up to a declared bound of complete collision-free assignments and ranks those complete assignments under distinct low-fret and voice-continuity cost policies. Search-order accident no longer selects the first complete backtracking result.
- The proportional `imitative_intabulation` Plan retains both candidate strategies and target-local decisions without inventing a permanent Principal Voice.
- Preservation Targets and audits protect every source voice event, voice identity, onset, duration, pitch, ordered subject-entry groups, subject-shape relationships, voice continuity, and cadential goals.
- A held-out imitative Evaluation Case reuses Source Truth, reviewed transcription, Normalized Score, Analysis, Performance Brief, Plan, bounded search, Transformation Report, Preservation Audit, deliverables, Run, Case Run, and Card contracts.
- The evaluator retains imitative-specific state and explicitly refuses to substitute a generic counterpoint pass/grade for ordered entries, subject shapes, lineages, and cadences.
- French tablature isolates three source lineages in separate TabVoices. Rhythmic display staves remove note performance, so canonical MIDI and Audio Preview contain one sounding occurrence per source event rather than duplicate notation playback.
- LilyPond, sanitized SVG, PDF, MIDI, and semantic Audio Preview are persisted as the complete projection set. Deterministic hard gates pass while historical, physical, editorial, audible, and Owner evidence remains incomplete.

## Verification

- Solver tests prove more than one complete assignment is retained/ranked for each strategy and every selected note receives one collision-free position.
- Mutation coverage changes a later subject entry to the first entry's onset and fails both voice-onset and ordered-entry preservation.
- The shared-loop test verifies two non-identical candidates, protected domain state, no permanent Principal Voice, unique playback occurrences, five deliverables, complete Card dimension families, and imitative-specific diagnostics.
- The HTTP end-to-end tracer continues to compile the exact three-lineage score and verifies MIDI note-on count equals the source-note count.
- Full gates and dependency hashes are recorded in `evidence/T38/verification.json`.

## Honest limits

- The complete-assignment set is deliberately bounded and reports truncation in the solver result; ranking establishes quality among retained complete assignments, not exhaustive global optimality when the bound is reached.
- The evaluator proves the named imitative fixture and mutations, not all species counterpoint or every historical intabulation practice.
- Historical appropriateness, physical execution, visual engraving quality, audible clarity, and Owner usefulness remain scoped human evidence.

## Blocked by

- 14
- 16
- 18
- 19
- 31
- 34
