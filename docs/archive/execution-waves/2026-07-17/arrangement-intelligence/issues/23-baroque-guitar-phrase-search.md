# Baroque-guitar phrase realization

Status: complete

Type: AFK

User stories: U4, U6

## What to build

Replace greedy baroque-guitar construction with phrase-aware state search under an exact plan, instrument, and Performance Brief.

## Acceptance criteria

- [x] State covers fingers, barré, hand position, held notes, courses, stringing, and applicable technique.
- [x] Transition evidence records observable features rather than only a scalar.
- [x] Greensleeves retains its recognizable Principal Voice and avoids the observed violent jump.
- [x] Bounded failure reports search exhaustion rather than impossibility.

## Delivered

- Exact baroque-guitar realization now uses deterministic bounded beam search across the complete Principal Voice instead of choosing each event from only the immediately previous greedy result.
- Search state retains finger occupation, barré frets, hand position, held notes, occupied courses, exact stringing identity, and the selected applicable technique. State equivalence/deduplication includes every retained history dimension.
- Each persisted candidate carries exact Arrangement Plan, Performance Brief, and Instrument Instance identities plus its actual expanded-state count, effective frontier width, configured bound, and an explicit `bounded` completeness claim.
- Transition evidence records principal course/fret motion, hand-position motion, retained/introduced/released courses, held-note count, barré change, and technique. The scalar path cost is derived from these observables rather than replacing them.
- The reported fifth-course sixth-fret to second-course first-fret transition is a named hard counterexample. Cross-neck moves of that magnitude are rejected, and every selected Greensleeves transition is checked against the predicate.
- Rasgueado, punteado, campanella, barré, and damping remain distinct applicability claims. Exact constituent strings also disclose re-entrant bass limitation instead of implying a complete low foundation.
- A typed `PhraseSearchExhaustedError` and public `search_exhausted` API code preserve bounded diagnostics and explicitly state that exhaustion is not proof of impossibility. Bounded exhaustion does not create a false infeasibility Plan Conflict.

## Verification

- Unit tests prove the complete state/evidence vocabulary, exact violent-jump counterexample, observable transition fields, Principal Voice preservation, deterministic bounded search, and honest exhaustion language.
- Arrangement Service tests prove candidate evidence survives schema validation and persistence with the exact Plan, Brief, and Instrument Instance identities and technique applicability.
- The real Greensleeves PDF tracer compiles the phrase-selected score to tablature/PDF/SVG/MIDI while retaining the complete Principal Voice and rejecting every violent transition.
- Full quality gates and evaluation evidence are recorded in `evidence/T23/verification.json`.

## Honest limits

- The path cost is a deterministic search policy, not a calibrated human difficulty or comfort score. Tempo, proficiency, preparation, reliability, and player-specific suitability remain unknown until T29/T41 evidence.
- T26 adds unpruned/reference differential replay, safe-dominance proofs, checkpoint/cancellation coverage, and calibrated comparison semantics.
- Historical and player judgments about technique choice remain late HITL evidence; machine applicability is not presented as stylistic approval.

## Blocked by

- 16
- 20
