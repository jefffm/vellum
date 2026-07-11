# ADR 0009: Preserve OMR evidence behind backend-neutral adapters

## Status

Accepted

## Context

Vellum must accept ordinary score PDFs and images rather than requiring users to
prepare LilyPond or MusicXML. Optical music recognition is uncertain, backend
capabilities change, and interchange exports can lose recognition, layout, and
provenance information. Coupling persisted musical state directly to Audiveris or
retaining only its MusicXML export would make recognition results difficult to
audit, correct, reproduce, or migrate.

## Decision

Vellum will invoke optical music recognition through a backend-neutral adapter
contract. Audiveris will be the first supported backend, but it will not define
the canonical score model.

Each recognition attempt is a versioned OMR Run. It preserves the immutable source
artifact, backend identity and version, configuration and invocation, logs and
diagnostics, page/region mappings, confidence or uncertainty evidence where
available, backend-native artifacts such as Audiveris `.omr`, and interchange
exports such as MusicXML. The exported MusicXML is normalized into a Score
Transcription but is not treated as the complete recognition record.

Changing the backend, backend version, or recognition configuration creates a new
OMR Run and Score Transcription version rather than mutating prior results.

## Consequences

- Users can start from a generic PDF upload while retaining traceable evidence for
  every recognized note.
- Page and region mappings support Score-Anchored Review in which the source
  facsimile and editable recognized notation are presented together.
- Audiveris adapters correlate MusicXML events with native `.omr` voice and symbol
  records. Native recognition grades become event confidence, and native raster
  bounds use an explicit `omr_raster` coordinate space so a review client never
  draws them over an incompatible PDF coordinate system.
- The review API serves retained backend page rasters through a linkage-checked
  workspace route. Clients use the immutable source document only as a fallback
  when a backend does not preserve a compatible page raster.
- Audiveris can be replaced or supplemented without migrating Vellum's canonical
  score representation.
- Recognition runs consume more local storage than keeping MusicXML alone.
- The import layer must manage native artifacts and incomplete or backend-specific
  confidence data.
- Reproduction and correction remain possible even when a later backend produces
  a different result.
