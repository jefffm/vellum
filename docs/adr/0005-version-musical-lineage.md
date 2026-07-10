# Version the complete musical lineage

Vellum will keep immutable Source Artifacts, versioned Score Transcriptions, derived Normalized Scores, Analysis Records, Arrangement Scores, optional Performance Interpretations, and Deliverables as distinct linked layers. Every arrangement records the exact source, analysis, policy, and plan versions that produced it; every Performance Interpretation identifies the exact Arrangement Score it realizes; and deliverables are reproducible projections rather than canonical music.

## Considered options

- Mutate one MusicDocument throughout import, analysis, arrangement, and correction
- Preserve only the original file and final LilyPond output
- Version each semantic layer and retain complete derivation lineage
- Encode playback-only ornament, articulation, and timing decisions directly into the Arrangement Score

## Consequences

Corrections and transformations create new versions instead of silently rewriting source truth. Storage and APIs need stable identifiers, parent-version links, provenance, dependency tracking, branching, and regeneration support. Deterministic normalization and analysis recompute automatically after an upstream correction, carrying forward still-applicable user corrections explicitly. Creative Arrangement Scores, Performance Interpretations, and Deliverables remain preserved as Stale Derivations until the user chooses to regenerate a new version. Conservative Regeneration branches from the stale arrangement, preserves Editorial Commitments, confines generation changes to the affected dependency region, and still reruns complete validation. Direct user edits become Editorial Commitments by default; releasing a commitment affects future generation without mutating the version that contains it. Interrupted work can continue from its exact original versions on an Arrangement Branch without overwriting current lineage. Literal playback remains available even when an optional Performance Interpretation exists.
