# 02 — Source-adaptive de Visée recognition and expert transcription

Status: completed

Type: AFK

Blocked by: 01

## Why this tracer was repivoted

The first implementation proved canonical MEI persistence, facsimile display, Verovio projection,
and atomic Correction Batches. It did not implement recognition. The live importer read a
hand-authored page JSON, presented it as a structured extraction result, and required the Owner to
repair widespread structural and musical guesses. Confidence and several source regions were
constructed rather than observed. Those results cannot establish this tracer.

## What to build

Create one source-adaptive recognition attempt directly from the Owner-local de Visée PDF. Detect
page structure and staff geometry, extract uninterpreted glyph images, cluster repeated glyphs, and
apply a versioned Notation Recognition Profile containing reviewed examples, vocabulary, and
spatial rules. Optional multimodal-model assistance may propose labels or diagnose exceptional
regions but cannot establish source truth.

Feed the candidate into a keyboard-first event workstation designed for exhaustive expert review.
The user reviews a complete chord or event beside a large source crop, confirms a correct proposal
and advances in one action, or directly edits course letters, visible rhythm signs, ornaments,
gesture marks, and event grouping. Local drafts recover after interruption; an explicitly named
system or page batch crosses the existing canonical command boundary.

## Acceptance criteria

- [x] The PDF bytes, not a hand-authored musical JSON file, initiate a backend-neutral versioned
      recognition attempt with preserved configuration, profile version, page/staff geometry,
      extracted glyphs, clusters, hypotheses, diagnostics, and facsimile mappings.
- [x] Detected token regions are evidence from image geometry. Course positions derive from detected
      and reviewed staff lines rather than evenly divided systems or invented course coordinates.
- [x] The constrained diplomatic representation records visible rhythm glyphs, dots, fret letters,
      ornaments, vertical/oblique marks, barlines, repeats, and explicit absences separately from
      interpreted duration, simultaneity, strumming action, tuning, and sounding events.
- [x] Reviewing a representative glyph identity can propose the same label for matching cluster
      members; propagated changes are inspectable, rejectable, reversible, and never silently
      accepted as source truth.
- [x] The default review unit is a complete source-linked chord or event with neighboring musical
      context, not an isolated generic attribute form.
- [x] The ordinary page pass is keyboard-operable: confirm-and-advance, previous/next, course-letter
      entry, insert/delete, split/merge, ambiguity marking, compact rhythm/ornament entry,
      repeat-previous, and undo/redo require no pointer input.
- [x] Correct proposals require one confirmation action. Editing, navigation, and undo remain local
      and immediate; whole-page Verovio rendering or server writes do not block each keystroke.
- [x] A recoverable autosaved draft survives navigation and browser closure. Completing the first
      exhaustive pass publishes canonical MEI version 1 through one named, digest-bound initial
      review batch tied to its immutable recognition run. Every later manual edit uses an ordinary
      Correction Batch and creates a successor version; cancel and inverse-version undo retain their
      existing semantics.
- [x] Automated fixtures can drive every event to confirmed or explicitly ambiguous state, and
      progress exposes untouched, reviewed, corrected, regrouped, propagated, rejected, and
      unresolved counts. The Owner-local page begins T05 as a source-derived candidate, not as a
      falsely pre-reviewed page.
- [x] Evaluation compares the resulting visible-token transcription with a private reviewed truth
      when available and otherwise with rights-approved reviewed fixtures. It reports structure,
      glyph, course, rhythm-sign, ornament, gesture-mark, region-alignment, propagation, and
      reviewer-burden properties. Schema validity alone cannot pass.
- [x] Reload restores the exact canonical version, working-draft state where applicable, truthful
      facsimile links, review progress, and source-checked rendered edition.

## Explicit non-goals

- General historical-manuscript recognition.
- Custom model training.
- Zero-review transcription.
- Inferring musical interpretation from visual plausibility.
- Treating an editorial realization as diplomatic source truth.

## Blocked by

- 01 — Secure pinned Verovio edition vertical

## Gates

Focused geometry, clustering, profile, recognition-record, diplomatic-layer, draft-recovery,
keyboard-workflow, persistence, and correction tests; then the base gates plus browser, render, and
playback evaluation. The private source-truth comparison remains Owner-local and records bounded
results without committing source bytes or private truth.

## Prior evidence retained with corrected scope

- Canonical MEI persistence, versioning, correction preview/cancel/commit, inverse-version undo,
  facsimile zoom, non-obscuring markers, and pinned Verovio projection were proven.
- The former provisional page contained 188 constructed facsimile-linked tokens and 69 unresolved
  readings. It is retained only as a failure witness and temporary UI-development candidate.
- Source inspection falsified its assumed system grid, pickup and partial-measure structure, gesture
  classification, course/fret content, and rhythm presentation. Passing infrastructure gates did
  not prove transcription truth or recognition quality.

## Completion evidence

- The production importer now submits the PDF to a versioned printed-tablature geometry backend;
  it no longer reads or labels the provisional musical JSON as recognition output.
- Recognition records preserve the rendered-page digest, detected systems and staff lines, event
  and vertical-mark geometry, raw glyphs, typed reusable clusters, scoped profile rules, explicit
  non-authoritative hypotheses, configuration, and diagnostics. Non-letter debris is ineligible
  for reviewed fret learning.
- The event workstation provides unobscured aspect-preserving context, keyboard review and
  regrouping, explicit cluster propagation and rejection, autosaved recovery, unresolved-event
  navigation, burden metrics, and one digest-bound publish command for MEI version 1.
- Focused service and browser predicates prove structural publication, exact source coverage,
  Verovio rendering without invented duration, profile reuse, debris quarantine, draft recovery,
  keyboard completion, and burden reporting. An Owner-local PDF smoke run reached the production
  workstation without committing source bytes or source truth.
- Gates passed: `npm run typecheck`, `npm test`, `npm run format:check`, `npm run spec:verify`,
  `npm run build`, `npm run server:build`, `npm run test:browser`, pinned `npm run eval:render`,
  pinned `npm run eval:playback`, and the explicit nested `npm run sandbox:lilypond:verify` gate.

## T05 first-system remediation

- The first real run exposed strict barlines and the opening clef as standalone review events. The
  v3 geometry backend now distinguishes a full-staff barline from a vertically extended musical
  mark, removes only strict barline and pre-staff anchors from musical event units, and attaches the
  preserved vertical evidence to a neighboring source event. A project-authored image predicate
  proves that an extended event stem survives while a strict barline does not become an event.
- On the immutable Owner-local page, the same source-derived predicate reduced 89 coarse units to
  71 musical review units across the four systems (15, 22, 17, and 17) without reading or importing
  the rejected hand-authored musical JSON. Fresh recognition run
  `tab-recognition.a236ab0d-5775-458c-ad9f-96a6da61effa` preserves backend v3 and its recognizer
  digest; no musical reading or acceptance was authored automatically.
- Conservative reviewed-shape reuse now uses a wider source-local distance, reducing 185 eligible
  glyph components from 167 mostly singleton families to 76 families. Propagation remains
  fail-closed when more than one reusable component occupies the selected course, because the
  event-oriented workstation has no basis to guess which visible glyph the Owner labeled.
- Remediation gates passed on the macOS host: the generated-image predicate and actual Owner-local
  page smoke passed; 1,645 tests passed with four intentional skips; typecheck, formatting,
  specification verification, client build, and server build passed; and all 46 browser scenarios
  passed, including keyboard draft recovery and the real Podman-backed engraving workflow.
