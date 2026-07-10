# Version the complete musical lineage

Vellum will keep immutable Source Artifacts, versioned Score Transcriptions, derived Normalized Scores, Analysis Records, Arrangement Scores, optional Performance Interpretations, and Deliverables as distinct linked layers. Every arrangement records the exact source, analysis, policy, and plan versions that produced it; every Performance Interpretation identifies the exact Arrangement Score it realizes; and deliverables are reproducible projections rather than canonical music.

## Considered options

- Mutate one MusicDocument throughout import, analysis, arrangement, and correction
- Preserve only the original file and final LilyPond output
- Version each semantic layer and retain complete derivation lineage
- Encode playback-only ornament, articulation, and timing decisions directly into the Arrangement Score

## Consequences

Corrections and transformations create new versions instead of silently rewriting source truth. Storage and APIs need stable identifiers, parent-version links, provenance, and regeneration support. Analysis, arrangement, and performance results become invalid or explicitly stale when an upstream version changes. Literal playback remains available even when an optional Performance Interpretation exists.
