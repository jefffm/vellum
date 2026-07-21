# 05 — Owner page-9 acceptance

Status: ready-for-human

Type: HITL

Blocked by: none — 02 remediation and 04 are completed

## What to review

Review the complete de Visée page 9 facsimile beside the current Diplomatic Edition, exercise
selection and playback, and record separately whether the visible transcription matches the page
and whether one exact Tablature Interpretation is suitable for literal playback, analysis, and
the first idiom-study follow-up.

## Acceptance criteria

- [ ] Every Critical Uncertainty is resolved or the decision records an honest blocker.
- [ ] The Owner has completed one chord/event-oriented keyboard pass over the whole page; ordinary
      correct events required confirm-and-advance rather than per-token forms.
- [ ] The stored reviewed, corrected, regrouped, propagated, rejected, unresolved, and keyboard-
      action counts are accompanied by approximate elapsed review time and the Owner's explicit
      judgment that the candidate materially reduced repetitive entry compared with authoring the
      transcription.
- [ ] The Owner explicitly confirms that no visible-evidence dimension, including rhythm, dots,
      ornaments, gesture or vertical marks, repeats, and event grouping, was systematically left for
      the Owner to author; a negative judgment fails T05 and routes to the applicable remediation.
- [ ] The exact canonical MEI passes the locally vendored, digest-bound upstream MEI 5.1
      **Pinned MEI Schema** and the separate **Vellum Diplomatic Tablature Profile**, including its
      deterministic token, facsimile-link, permitted-construct, and evidence-layer checks; the
      source-derived publication write fails with diagnostics and creates no canonical version if
      either lint rejects it. The upstream schema is `mei-all.rng`, because MEI's CMN
      customization omits the required facsimile module; the Vellum profile supplies the narrow
      diplomatic subset.
- [ ] The complete rendered page is legible and source-linked at useful zoom levels.
- [ ] Literal playback and the score-following marker make the chosen reading reviewable.
- [ ] Transcription Acceptance and Interpretation Acceptance name exact versions and purposes.
- [ ] Viable alternatives remain preserved unless explicitly rejected.

## Failure routing

T05 exercises the review and acceptance surfaces already delivered by T02 through T04. It does not
pre-authorize a new implementation sequence. If the pass cannot satisfy acceptance, record the
dominant observed blocker and reopen only the smallest applicable tracer:

- systematic missing source-derived evidence dimensions — T02 recognition breadth;
- incorrect staff, glyph, or event geometry — T02 spatial correction;
- excessive repeated correction of matching glyphs — T02 cluster propagation review;
- worker latency, stale rendering, or rendering failure that prevents review — T01 Verovio surface;
- schema/profile rejection — the narrow MEI conformance gate, without adding a general XML editor.

After the first complete source system, stop early when one of these defects is demonstrably
systematic rather than an isolated correction. Preserve the partial review metrics as diagnostic
evidence, but do not publish a partial initial review batch or treat them as Transcription
Acceptance evidence. After remediation:

- source bytes, backend, recognition configuration, profile version, detected geometry, clusters,
  or hypotheses changed — create a new immutable recognition attempt and fresh review draft;
- workload-changing review UI changed without changing recognition output — retain the recognition
  attempt but restart the complete pass and burden measurement;
- renderer/projection alone changed — retain the recognition attempt and recoverable draft;
- MEI linter alone changed — retain the recognition attempt and draft because musical evidence did
  not change;
- visible source evidence changed after publication — create a successor version through a
  Correction Batch.

When none of these failures blocks acceptance, complete T05 and resume T06 from the accepted exact
version IDs; untriggered improvements remain outside the current wave. Page 9 is the first real
review-burden baseline, so T05 records measured Owner judgment rather than imposing an invented
numeric threshold; its measurements establish quantitative targets for later pages.

## Blocked by

- None. 02's reopened source-map/transcription predicate and 04's passage-prompting path are
  completed dependencies.
