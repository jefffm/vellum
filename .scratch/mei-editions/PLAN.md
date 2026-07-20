# MEI Editions execution plan

Status: active

Current tracer: T05 — Owner page-9 transcription and interpretation acceptance.

T05 review exposed a larger failure than inaccurate page content. T02 built persistence, rendering,
and generic Correction Batches but never implemented the structured recognition path promised by
the specification. The live importer reads a hand-authored provisional JSON file, labels it as an
extraction backend result, and leaves the Owner to repair an unreliable transcription token by
token. Its confidence values are not calibrated recognition evidence, and many source regions are
derived from assumed event and course geometry. This proves an edition substrate, not an effective
source-to-transcription product.

T02's repivot is complete. The provisional JSON remains only a development failure witness. The
production path now creates a source-adaptive recognition attempt from PDF bytes, preserves its
geometry, typed glyph clusters, profile, hypotheses, and diagnostics, and opens a recoverable,
keyboard-first event-review pass. T03 and T04's generic implementations remain landed. T05 now
performs the exhaustive source review, publishes MEI version 1, and then uses those existing paths
to prepare and separately accept one literal interpretation.

## Outcome

Turn page 9 of de Visée's 1686 _Pièces pour la guittare_ into a reviewed, interactive, playable
MEI edition, then use one accepted selection as bounded repertoire evidence.

## Queue

|  ID | Tracer                                              | Type | Blocked by | Result                                                              |
| --: | --------------------------------------------------- | ---- | ---------- | ------------------------------------------------------------------- |
|  01 | Secure pinned Verovio edition vertical              | AFK  | None       | One representative MEI renders, selects, plays, and exports safely  |
|  02 | Source-adaptive recognition and transcription pass  | AFK  | 01         | PDF becomes a rapidly expert-verified, source-linked MEI version    |
|  03 | Interpretation acceptance and synchronized playback | AFK  | 02         | Separate approvals and provisional/accepted playback remain aligned |
|  04 | Passage prompting and model-assisted edits          | AFK  | 03         | Versioned selections drive inspectable prompts and reviewed edits   |
|  05 | Owner page-9 acceptance                             | HITL | 04         | Owner accepts the whole-page transcription and one interpretation   |
|  06 | First accepted Attested Realization                 | AFK  | 05         | One accepted selection becomes bounded candidate-only evidence      |
|  07 | Retire superseded edition paths                     | AFK  | 06         | Replacement-proven prototype code and tests are deleted             |

## Execution rules

- Follow dependency order and finish each tracer with its applicable gates, one commit, and one
  push before starting its dependent.
- Build only the generic behavior exercised by the tracer. Do not build a general scholarly
  editor, library crawler, custom recognition model, or knowledge-publication system. Source-local
  geometry, glyph clustering, recognition profiles, and optional model assistance are in scope.
- The Owner-local de Visée scan is an execution input, not a tracked fixture. Automated tests use
  rights-approved or project-authored substitutes.
- T05 is the sole planned acceptance HITL gate. T02 may use ordinary development inspection of the
  Owner-local page but cannot make the Owner manually author its candidate. Before T05, T02 must
  produce a source-derived candidate and prove the keyboard workflow, draft recovery, propagation,
  versioning, and reviewer-burden instrumentation with rights-approved automated fixtures. T05 then
  performs the complete event-by-event Owner pass over page 9, resolves its visible-token readings
  and repeat/return marks, and records the actual reviewer burden. T06
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
