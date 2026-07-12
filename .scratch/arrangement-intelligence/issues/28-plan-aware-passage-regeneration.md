# Plan-aware passage regeneration

Status: complete

Type: AFK

User stories: U3, U4, U5

## What to build

Generate fresh passage alternatives from the active plan and expanded dependency region rather than projecting unrelated whole-score candidates.

## Acceptance criteria

- [x] Search includes incoming/outgoing state, sustain, harmony, phrase, cadence, repeats, and Commitments.
- [x] Alternatives record exact passage-search identity and candidate lineage.
- [x] Audition is temporary; adoption creates one new audited version.
- [x] Unselected events remain unchanged and the complete score is re-audited.

## Delivered

- Passage requests now derive a dependency context from the exact Arrangement Score, Plan, Search, Analysis, target, source Performed Form, and active applicable Commitments.
- Expansion records requested and expanded events separately, incoming and outgoing state, overlapping sustains, same-measure harmony, applicable phrase/cadence Preservation Targets, repeated measures, active Commitments, and every derivation evidence ID.
- Each passage attempt is an immutable persisted `PassageSearchRecord` with a canonical digest. Workspace schema v7 migrates and recovers the new record collection.
- Fresh passage candidates are projected over the expanded region and carry exact passage-search, source-candidate, Plan-decision, evidence, requested-scope, and expanded-scope lineage. A stale or incompatible passage-search ID blocks preview and adoption.
- Candidate audition overlays the expanded events only in a temporary Audio Preview and leaves the workspace byte-for-byte unchanged.
- Adoption creates exactly one child Arrangement Score and Branch, cites both source candidate and Passage Search, preserves every event outside the expanded region, and recomputes the complete Transformation Report and whole-score Preservation Audit.
- The workbench already supports command-click multi-selection, shift/drag contiguous ranges, exact selection prompts, temporary looping, staged batch editing, candidate comparison, adoption, and parent/child branch navigation. Passage UI now explains dependency expansion and displays authoritative policy evidence instead of the removed weighted proxy.

## Verification

- The Greensleeves service fixture includes repeated performed form and an active commitment, then proves incoming/outgoing, harmony, phrase/cadence, repeat, commitment, and derivation fields in the persisted passage identity.
- Tests prove stale identity rejection, no mutation after audition, one-version adoption, complete audit/report regeneration, exact source-candidate lineage, and byte equality for every event outside the expanded boundary.
- Existing workbench tests retain multi-event/range selection, exact selection context, loop/audition, edit validation, version events, and branch comparison wiring.
- Full quality gates and evaluation evidence are recorded in `evidence/T28/verification.json`.

## Honest limits

- Materially ambiguous analytical boundaries do not yet produce competing conservative scopes or a typed block; AI-ICC-078 remains absent.
- Passage alternatives are fresh dependency-expanded projections of candidates from the active Arrangement Search. A future adapter may perform a dedicated local successor search, but no unrelated search or candidate identity is presented as new.
- Manual edit validation is staged and atomic, but generic machine verification of every possible Plan Decision dimension remains partial under AI-WPL-026.
- Human review of range-selection ergonomics, boundary explanations, and comparison usefulness remains deferred to the late HITL gate.

## Blocked by

- 17
- 18
- 23
- 24
- 25
- 27
