# Human comparison and adjudication protocol

Status: complete

Type: AFK

User stories: U6, U7, U8

## What to build

Represent human musical judgment with explicit reviewer roles, rubric anchors, evidence thresholds, disagreement, and adjudication.

## Acceptance criteria

- [x] Owner, target player, historical specialist, editor, and listener roles have distinct authority.
- [x] Protocols record blinding limits, ordering, duplicates, confidence, conflicts, and consent.
- [x] One preference remains one judgment and cannot automatically become a regression.
- [x] Pairwise results link exact compatible candidates and contexts.

## Delivered

- Typed Human Comparison Protocols require an authority mapping and rubric anchor for every human evidence dimension, physical/listening/notation basis, randomized balanced ordering with retained seed, practical-blinding limits, duplicate policy, confidence/conflict disclosure, minimum evidence, disagreement threshold, adjudicator role, consent, privacy, access, and retention declarations.
- Protocol validation makes personal adoption/calibration Owner-only, physical execution target-player-only, historical practice specialist-only, engraving/notation editor-only, and musical identity/listening clarity independent-listener-only. No record can silently declare multiple reviewer roles.
- Human Evaluations persist one role, qualifications, confidence, conflicts, consent, exact protocol digest, exact compatible candidate/Search/Brief/Instrument identities, candidate-local and common score/source passage identities, Playback Occurrences, evidence basis, rubric judgments, and practical-blinding evidence.
- Physical comparisons must reference compatible physical Owner Playtests for both candidates instead of duplicating their evidence. Historical judgments require citations.
- A single evaluation is structurally `scoped_judgment_only`, has no winner, and is never regression-eligible. Aggregate derivation enforces distinct reviewers, minimum judgments, balanced order, duplicates, disagreement retention, and the declared adjudicator role while still remaining non-regression evidence.
- The first-loop Evaluation Manifest now pins the complete validated protocol instead of a deferred placeholder. Human Evaluations and conclusions are immutable local Evaluation Store records.

## Verification

- The real Greensleeves service fixture saves an exact physical pairwise judgment over two Search-compatible candidates and two exact Owner Playtests, then rejects an Owner role attempting to substitute for target-player physical authority.
- Focused protocol tests prove one vote is insufficient, balanced conflicting votes remain unresolved, and only the declared Owner adjudicator may settle personal adoption.
- Manifest tests reject incomplete protocol payloads and continue to prove transitive digest pinning.
- Full quality gates and evaluation evidence are recorded in `evidence/T30/verification.json`.

## Honest limits

- Automated fixtures exercise record semantics but do not claim real target-player, specialist, editor, or independent-listener evidence. Those authorities remain unknown until late HITL tracers.
- T31 owns reviewed-learning promotion; neither one judgment nor an aggregate conclusion automatically creates a regression, fixture, default, calibration update, historical claim, or mechanics change.
- T34 owns enforcement of the declared retention/access lifecycle. T30 validates that the declarations and consent exist but does not claim complete media/data-retention enforcement.
- Human comparison collection UI and real-browser ergonomics remain a late HITL concern; this AFK slice establishes the canonical protocol, persistence, and validation boundary.

## Blocked by

- 29
