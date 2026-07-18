# Render, playback, workflow, and mutation suites

Status: complete

Type: AFK

User stories: U5, U6

## What to build

Evaluate notation, sounding events, browser recovery, and known musical defects independently and end to end.

## Acceptance criteria

- [x] Semantic notation, focused visual, and canonical sounding-event checks remain independent.
- [x] Playback covers repeats, occurrences, semantic parts, and no duplicated display-staff notes.
- [x] Browser suites cover review, artifact handoff, selection, editing, adoption, reload, and stale responses.
- [x] Mutations cover source identity, plans, mechanics, notation, playback, workflow, and search truthfulness.

## Delivered

- Three independent typed evaluators cover semantic notation, focused visual regions, and canonical sounding playback. A failure or review state in one record cannot be averaged into another.
- Semantic notation compares exact event identity, pitches, duration, musical role, and target-specific notation identity. A pixel-similar pitch mutation therefore fails semantically.
- Focused visual evaluation records region-specific changed fraction and tolerance. Whole-page pixel comparison is explicitly supplementary; a harmless spacing delta can require review without pretending the music changed.
- Canonical playback compares Performed Form occurrence traversal, repeat decisions, source/Arrangement identity, semantic part, pitch, onset, duration, and iteration. It never compares waveform and detects duplicate sounding occurrences from display-staff duplication.
- `eval:render` and `eval:playback` provide machine-readable offline contract commands for the independent records.
- The mutation manifest covers Principal Voice, cadence, Continuo Foundation, figures, imitation, positions, stringing, lute course identity, classical duration, Plan Decisions, playback duplication, repeats, artifact handoff, staleness, and search truthfulness.
- Mutation verification also maps every declared authoritative evaluator family to a scoped expected finding and permitted presentation. The manifest is structurally forbidden from claiming universal completeness.
- Browser workflow coverage links review, artifact handoff, selection, editing, adoption, reload, and stale-response scenarios to existing executable suites. The manifest verifier rejects missing test files.

## Verification

- Focused tests prove semantic pass/fail independent of focused visual pass/review and canonical playback pass/fail.
- Mutation fixtures independently detect pitch semantics, duration/part identity, repeat traversal, missing occurrence, and display-staff duplication while retaining semantic parts and repeat iterations.
- Manifest tests prove all required defect and evaluator families are present and `universalCompletenessClaim` is false.
- Browser coverage tests prove every named workflow scenario links to a present executable test file; the referenced suites run again in the full repository suite.
- Both new CLI commands execute and emit typed JSON.
- Full quality gates and evaluation evidence are recorded in `evidence/T33/verification.json`.

## Honest limits

- Focused visual tolerances are contract examples, not H5-approved editorial thresholds. Late visual HITL must approve real target-specific regions and tolerances.
- Mutation success proves sensitivity only to the retained mutations and scopes. It does not prove evaluator completeness or that an untested defect is impossible.
- The browser coverage manifest links existing DOM/server recovery suites; late HITL/browser tracers still own actual interaction ergonomics and real user usefulness.
- T35 owns broad licensed Golden corpus expectations and alternative-valid-output review. T33 exercises retained contract fixtures and known defects only.

## Blocked by

- 11
- 23
- 24
- 25
- 28
