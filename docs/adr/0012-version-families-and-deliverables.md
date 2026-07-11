# Version Arrangement Families and Deliverables Explicitly

Vellum will persist an Arrangement Family as the shared source-analysis and Arrangement Brief lineage for sibling Arrangement Scores with different Target Configurations. It will persist every rendered or interactive output as a Deliverable linked to one exact Arrangement Score version and one Notation Layout.

## Considered options

- Infer siblings from similar filenames or creation time
- Treat compiled files as transient endpoint responses
- Give families and deliverables stable, inspectable identities

## Consequences

The family identity is deterministic for the exact Normalized Score, Analysis Record, and originating Arrangement Brief. Every sibling remains an independent Arrangement Score with its own Target Configuration, Arrangement Search, candidate ranking, playability checks, and Preservation Audit, but joins the same family record. Adding a sibling updates the family without rewriting prior scores.

PDF, browser SVG preview, MIDI, LilyPond source, and literal Audio Preview become content-addressed Deliverables. Metadata records kind, MIME type, Notation Layout, Arrangement Score ID and version, content hash, byte length, storage path, and creation time. Recompiling identical state reuses the same Deliverable identity; changed content or a new score version produces a new one. Artifact bytes remain local and are retrievable through the workspace API.

Deliverables are projections, never canonical musical state. They cannot change an Arrangement Score, family membership, analysis, or audit. The workbench shows the family identity and exact versioned Deliverables used for the current result; changing instrument, tuning, stringing, or ensemble role creates a sibling Arrangement Score rather than relabeling an existing file.
