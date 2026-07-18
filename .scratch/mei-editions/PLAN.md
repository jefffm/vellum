# MEI Editions execution plan

Status: active

Current tracer: T02 — De Visée diplomatic transcription remediation.

T05 review exposed that T02's generic correction workflow was complete but its page-specific result
predicate was not: the provisional extraction used an inferred four-measures-per-system grid,
folded both strain pickups into numbered measures, misclassified historical strums as fret letters,
and contains musical readings that do not match the source. The literal comparison witness confirms
seven numbered measures in the first strain and eight in the second (1–7 and 8–15), with an
anacrusis before each. T03 and T04's generic implementations remain landed, but their page-specific
results must be rechecked after T02; T05 is not runtime-eligible until the whole page, its AABB
traversal, and its source map are truthful.

## Outcome

Turn page 9 of de Visée's 1686 _Pièces pour la guittare_ into a reviewed, interactive, playable
MEI edition, then use one accepted selection as bounded repertoire evidence.

## Queue

|  ID | Tracer                                              | Type | Blocked by | Result                                                                |
| --: | --------------------------------------------------- | ---- | ---------- | --------------------------------------------------------------------- |
|  01 | Secure pinned Verovio edition vertical              | AFK  | None       | One representative MEI renders, selects, plays, and exports safely    |
|  02 | De Visée diplomatic transcription and corrections   | AFK  | 01         | Page 9 persists as source-verified MEI with atomic Correction Batches |
|  03 | Interpretation acceptance and synchronized playback | AFK  | 02         | Separate approvals and provisional/accepted playback remain aligned   |
|  04 | Passage prompting and model-assisted edits          | AFK  | 03         | Versioned selections drive inspectable prompts and reviewed edits     |
|  05 | Owner page-9 acceptance                             | HITL | 04         | Owner accepts the whole-page transcription and one interpretation     |
|  06 | First accepted Attested Realization                 | AFK  | 05         | One accepted selection becomes bounded candidate-only evidence        |
|  07 | Retire superseded edition paths                     | AFK  | 06         | Replacement-proven prototype code and tests are deleted               |

## Execution rules

- Follow dependency order and finish each tracer with its applicable gates, one commit, and one
  push before starting its dependent.
- Build only the generic behavior exercised by the tracer. Do not build a general scholarly
  editor, library crawler, recognition model, or knowledge-publication system.
- The Owner-local de Visée scan is an execution input, not a tracked fixture. Automated tests use
  rights-approved or project-authored substitutes.
- T05 is the sole planned HITL gate. It cannot begin from a merely schema-valid provisional page;
  T02 must first prove source geometry and musical readings against the complete facsimile. T06
  and T07 resume automatically from its accepted version IDs.
- T07 removes superseded implementations rather than preserving compatibility by default. It may
  delete a path only after mapping its callers and proving the accepted MEI path covers the
  retained behavior. Still-live arrangement and LilyPond deliverable capabilities are not
  superseded merely because the edition path is MEI-native.
- A failed renderer, model, or tool call is a diagnosis problem, not permission to bypass
  canonical versions, security, or acceptance.

## Stop conditions

Pause only when the exact source bytes require a rights decision, the Owner must decide among
musically distinct viable interpretations, or T05 is ready. Ordinary implementation and test
failures remain autonomous work.
