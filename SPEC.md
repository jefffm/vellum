# Vellum MEI Editions and Repertoire Intelligence

Status: Current and authoritative next-work specification

This is the only current implementation specification in the repository. The completed and
superseded Musical Proofs program is archived at
[`docs/archive/specifications/2026-07-17-musical-proofs.md`](docs/archive/specifications/2026-07-17-musical-proofs.md).

## Outcome

Prove that Vellum can turn one page of historical tablature into a trustworthy, interactive,
playable MEI edition and then—only after review—use an exact selected passage as evidence for
instrument intelligence.

The first vertical is page 9 of Robert de Visée's 1686 _Pièces pour la guittare_. It must proceed
through facsimile import, Diplomatic Tablature Transcription, uncertainty correction, Verovio
rendering, Transcription Acceptance, Tablature Interpretation, Interpretation Acceptance,
synchronized literal playback, Passage Selection, and one source-backed Attested Realization.

This milestone is not a general OCR system, full scholarly editor, digital library, or automatic
style learner. It is one convincing path that makes later corpus growth cheap and trustworthy.

## Product proof

The milestone passes when the Owner can:

1. open the selected de Visée page beside a rendered five-line French tablature edition;
2. inspect every uncertain token at a legible source region without an overlay obscuring it;
3. stage several corrections, preview them, and commit one atomic Correction Batch as a new
   canonical transcription version;
4. approve separately that the transcription matches the page and that one interpretation is
   suitable for literal playback and analysis;
5. play, pause, seek, zoom, reflow, and follow a restrained marker without losing MEI identity;
6. select a contiguous passage or noncontiguous musical objects and use that Passage Selection in
   an inspectable prompt;
7. review model-proposed changes individually and commit only an approved typed batch; and
8. create one cited Attested Realization from the accepted passage without claiming that one
   occurrence is a recurring or preferred idiom.

## Canonical musical state

The Diplomatic Tablature Transcription is constrained, deterministically serialized MEI 5.1. It
records visible tablature tokens, stable identifiers, facsimile zones, layout anchors, uncertainty,
and editorial alternatives without silently imposing sounding pitch or analytical interpretation.

MEI does not replace Vellum's separate domain records for Source Artifacts, recognition attempts,
Tablature Interpretations, acceptance decisions, Analysis Records, Knowledge Candidates, or
arrangements. Browser indexes and rendering products are rebuildable projections.

Typed server commands are the only write path. A command names the expected parent version and
either creates one complete canonical successor or changes nothing. The browser worker never owns
canonical MEI.

## Rendering and exports

A locally bundled, exactly pinned Verovio WASM runtime renders the Interactive Edition Surface in
a Web Worker. Vellum owns the surrounding UI, selection state, version state, playback semantics,
and security boundary; it does not embed the hosted Verovio App or load executable code from a CDN.

Verovio SVG is untrusted generated markup. A dedicated versioned sanitizer may retain only the
elements, fragment-local references, styles, and mapped interaction attributes required by the
pinned output. No external resource URL, script, event handler, foreign object, or direct
unsanitized `innerHTML` insertion is permitted.

The local server uses the same Verovio version and rendering profile for reproducible SVG and PDF
Deliverables. Browser and server fixtures must agree on editorial reading, stable musical IDs,
tablature semantics, and timing identity. LilyPond remains available for Arrangement Score
deliverables but is not required in this MEI-native edition path.

## Transcription and interpretation review

Initial historical-tablature recognition uses a structured multimodal-model extraction behind a
backend-neutral adapter, notation-specific examples, and deterministic validation. Custom model
training is deferred until measured need. A confidence threshold prioritizes review but grants no
authority.

Transcription Acceptance requires:

- schema-valid constrained MEI;
- a facsimile region for every diplomatic token;
- passing deterministic structural and consistency checks;
- no unresolved Critical Uncertainty affecting visible source evidence; and
- one whole-page Owner review beside the facsimile.

High-confidence tokens do not require individual approval. Transcription Acceptance and
Interpretation Acceptance are distinct version-bound decisions even if shown in one review
session. An unaccepted interpretation may be auditioned as provisional playback but cannot support
analysis, idiom evidence, or publication as an accepted Reading Edition. Accepting one
interpretation does not reject viable alternatives.

## Correction and model-assisted editing

Manual and model-proposed transcription changes use typed Correction Batches. A batch is staged
against one parent, optimistically rendered, and committed atomically as one named version. Cancel
discards staging state; undo creates a new inverse version; a stale parent requires review rather
than silent replay.

Transcription Corrections, Interpretation Revisions, and Editorial Emendations remain separate
layers. A model cannot mix them into an opaque patch or commit canonical state. The Owner may
accept, reject, or revise individual suggestions before the remaining set is validated and
committed. Compact provenance links the original model proposal, per-change decisions, final
approved batch, and resulting version; rejected suggestions never enter canonical MEI.

## Selection and playback

A Passage Selection binds exact canonical identifiers and a version, not page coordinates. It may
be a contiguous musical range, a noncontiguous set, or both. Zoom and reflow preserve it; a later
transcription version remaps it only through unambiguous lineage and otherwise marks it stale.

Prompting receives a deterministic, inspectable Selection Context Envelope containing the minimum
required symbolic context, such as meter, tuning, measure boundaries, active voices, cadence
context, and linked evidence. Facsimile bytes require explicit inclusion and applicable access.

Vellum derives literal playback from the accepted Tablature Interpretation. Verovio timemaps and
element lookup synchronize the rendered surface but do not become independent musical truth.
Playback highlighting must remain restrained and readable.

## Repertoire intelligence boundary

No de Visée passage may support analysis or reusable knowledge until its exact transcription and
applicable interpretation are accepted. After acceptance, a Guided Knowledge Session may create a
cited Attested Realization from an exact Passage Selection and Realization Context.

One Attested Realization may support a research-only or candidate-only alternative. It cannot by
itself establish recurrence, prevalence, preference, obligation, or prohibition. A later Recurring
Idiom requires independent evidence lineages and explicit review. Knowledge remains data expressed
through supported typed operations; arbitrary code and prompt-only rules are forbidden.

## Evaluation

Evaluation is small and property-focused:

- MEI schema/profile and facsimile-link completeness;
- renderer security against external references and active content;
- browser/server identity and editorial-reading parity;
- five-course French tablature and thirteen-course diapason visual semantics;
- selection identity through zoom, pagination, and version changes;
- playback pitch, timing, and highlighting identity;
- atomic batch conflict, cancel, commit, and inverse-version behavior; and
- authority gates preventing unaccepted material from becoming idiom evidence.

The Owner-local de Visée scan remains outside Git unless a separate repository-inclusion decision
approves its bytes. Public automated tests use rights-approved or project-authored minimal MEI and
facsimile fixtures. Snapshot similarity alone is insufficient where semantic assertions are
available.

## Execution plan

The active tracer queue is [`.scratch/mei-editions/PLAN.md`](.scratch/mei-editions/PLAN.md):

1. secure pinned Verovio edition vertical;
2. de Visée page 9 diplomatic transcription and Correction Batches;
3. interpretation acceptance and synchronized playback;
4. Passage Selection prompting and model-assisted edits;
5. late whole-page Owner acceptance; and
6. first accepted Attested Realization.

Complete, test, commit, and push each autonomous tracer before beginning its dependent. Ordinary
Git history and focused tests are sufficient; do not create completion manifests, trust
ceremonies, evidence receipts, or qualification machinery.

## Completion boundary

This specification is complete when the product proof passes, T05 records both Owner decisions,
and T06 creates one properly bounded Attested Realization from the accepted page. It does not claim
complete transcription of the de Visée book, recognition of every historical tablature system,
historical-performance authenticity, a recurring baroque-guitar idiom, or readiness for
multi-owner publication.

## Deferred until demonstrated need

- custom tablature-recognition model training;
- automated whole-library transcription or idiom mining;
- Italian and German tablature beyond a small representation check;
- collaborative scholarly editing and remote multi-owner operation;
- external Knowledge Pack registries and reviewer credentials;
- arbitrary MEI profiles or a general-purpose XML editor;
- automatic activation of learned idioms; and
- replacing LilyPond in workflows not proven by representative parity fixtures.
