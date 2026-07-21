# ADR 0024: Use Verovio for MEI-native edition surfaces

## Status

Accepted — Owner approved on 2026-07-17 after a Verovio 6.2 spike.

## Context

Vellum needs to render, navigate, select, edit, and play constrained MEI 5.1 diplomatic
tablature without converting away its notation evidence. A local spike rendered representative
five-course French tablature and thirteen-course French-lute diapasons, preserved MEI element
identity in SVG, selected alternate editorial readings, and returned MIDI and timemap data.
The Verovio App additionally proves responsive and document views, zoom, navigation, playback
synchronization, and note highlighting, but its hosted implementation loads third-party playback
code from public CDNs and owns UI, storage, and playback state that belong to Vellum.

## Decision

Vellum will use a pinned Verovio runtime as the primary renderer and interactive-notation
foundation for MEI-native Diplomatic and Reading Editions. Vellum will own the Interactive
Edition Surface and adapt Verovio App patterns rather than embed or remotely import the hosted
application. A dedicated constrained sanitizer will preserve only required local SVG fragment
references and mapped interaction identifiers.

The browser surface will run the locally bundled pinned Verovio WASM runtime in a Web Worker.
Reproducible PDF and publication exports will use the same pinned Verovio version and rendering
profile on the local server. Representative parity fixtures will prevent the two paths from
silently differing in editorial reading, element identity, tablature semantics, or layout
policy. Neither path loads executable code from a public CDN.

The worker is projection-only. Manual edits cross a typed server command boundary and either
atomically produce a validated canonical MEI version from the expected parent or produce no
change. Optimistic worker previews are labeled transiently and cannot be accepted, exported,
analyzed, or used as evidence until the server acknowledges their canonical version.
Multiple transcription corrections may be staged and previewed as one named Correction Batch;
commit creates one canonical version, cancel discards the staging state, and undo creates a new
inverse version rather than rewriting history. A batch cannot mix transcription evidence with
interpretation revisions or editorial emendations.

Every canonical create, Correction Batch commit, and inverse-version undo must pass both the
locally vendored, digest-bound upstream MEI 5.1 Pinned MEI Schema and the separate Vellum
Diplomatic Tablature Profile. This is a fail-closed write lint: failure returns useful diagnostics
and produces no canonical version. It does not add a conformance-record subsystem, custom ODD,
general-purpose XML editor, runtime schema fetch, or historical migration. An optimistic projection
may be temporarily invalid, but it remains visibly noncanonical and cannot cross the server write
boundary. The pinned upstream schema is `mei-all.rng`: MEI's CMN customization excludes the
facsimile module required by source-linked diplomatic transcription, while the Vellum profile
supplies the constrained permitted subset.

Vellum remains authoritative for canonical MEI, editorial versions, Tablature Interpretations,
Performed Form, semantic Playback Parts, and playback timing. Verovio SVG, MIDI, timemaps, and
element lookup are rebuildable rendering and synchronization products. LilyPond remains an
Arrangement Score renderer and provisional fallback until representative real-source and
target-specific fixtures establish parity for a workflow.

## Consequences

- Interactive selection and playback highlighting can use stable MEI lineage instead of page
  coordinates or inferred MIDI-note matches.
- Browser layout and reflow do not block the main UI thread, while server exports remain
  reproducible and independent of transient browser state.
- Worker crashes, stale previews, and rejected edits cannot fork canonical transcription state.
- The hosted Verovio App's external runtime dependencies and unsanitized mounting pattern do not
  enter Vellum's local-first trust boundary.
- The de Visée page-9 transcription, thirteen-course diapasons, editorial alternatives,
  right-hand fingering, multi-page navigation, selection, and synchronized playback become the
  initial renderer acceptance fixtures.
- Known Verovio engraving limitations are handled by pinned rendering profiles, disclosed
  workarounds, upstream fixes, or a workflow-local fallback rather than by forking canonical MEI.
