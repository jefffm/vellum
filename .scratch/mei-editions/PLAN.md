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

## Immediate sequence

1. The fail-closed canonical MEI write lint described below is landed and verified.
2. Prepare T05 autonomously through the review and acceptance surfaces already delivered by T02
   through T04; defer the Owner's exact musical decisions until every machine-checkable blocker is
   cleared.
3. After the first complete source system, stop only for a demonstrated systematic blocker.
4. If viable, complete the whole-page pass and record measured Owner judgment and burden metrics.
5. Implement only the smallest recognition, geometry, propagation, or rendering remediation that
   an observed failure triggers, then restart or resume according to the identity rule below.
6. If T05 passes, proceed directly to T06 without implementing untriggered improvements.

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
  and repeat/return marks, and records the existing review metrics plus approximate elapsed review
  time. Because page 9 is the first real baseline, T05 does not invent a numeric burden threshold.
  The Owner instead records whether the candidate materially reduced repetitive entry compared with
  authoring the transcription and whether any evidence dimension was systematically left for the
  Owner to author. Either negative judgment fails T05 and routes to the smallest applicable
  remediation; the measurements establish quantitative targets for later pages. T06
  and T07 resume automatically from its accepted version IDs.
- T05 has an early failure checkpoint after the first complete source system. Isolated recognition
  and geometry errors continue through ordinary review, but a systematic blocker across that system
  stops the pass: an entire evidence dimension is absent, event geometry repeatedly requires
  reconstruction, or rendering prevents reliable review. Preserve the partial metrics as diagnostic
  evidence only; do not publish a partial initial review batch or describe it as T05 acceptance.
  After the narrow remediation, apply the identity rule: changes to source bytes, backend,
  recognition configuration, profile version, detected geometry, clusters, or hypotheses create a
  new immutable recognition attempt and fresh draft; workload-changing review UI retains the
  attempt but restarts the complete pass and burden measurement; renderer-only changes retain and
  resume the draft; MEI-linter-only changes retain the attempt and draft; post-publication visible-
  evidence changes use a successor Correction Batch.
- T05 uses the review and acceptance surfaces already delivered by T02 through T04; it is not a
  second implementation wave. Recognition breadth, spatial correction, cluster review, and render
  resilience remain conditional remediation triggered only by observed T05 failure. A failed pass
  records the dominant blocker and reopens the smallest applicable tracer rather than adopting the
  entire improvement sequence. Missing source-derived evidence dimensions route to T02 recognition,
  geometry or event-boundary failures to T02 spatial review, repeated cluster corrections to T02
  propagation review, and rendering failures to T01's Verovio surface.
- Before Transcription Acceptance is recorded, the exact canonical MEI must pass the locally
  vendored, digest-bound upstream MEI 5.1 **Pinned MEI Schema** and the separate **Vellum
  Diplomatic Tablature Profile**. The latter retains Vellum's token, facsimile-link, permitted-
  construct, and evidence-layer checks. Both layers form one fail-closed lint on every canonical
  create, Correction Batch commit, and inverse-version undo: failure returns useful diagnostics and
  produces no canonical version. This does not add a conformance-record subsystem, custom ODD,
  general-purpose XML editor, runtime schema fetch, historical migration, or external mei-friend
  integration. The pinned upstream schema is `mei-all.rng`, because MEI's CMN customization omits
  the facsimile module required by source-linked diplomatic transcription; the separate Vellum
  profile supplies the constrained permitted subset. The page-9 publication path runs the same
  lint before creating canonical version 1.
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
