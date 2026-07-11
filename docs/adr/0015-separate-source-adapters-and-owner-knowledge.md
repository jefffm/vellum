# ADR 0015: Separate source adapters and Owner knowledge

## Status

Accepted

## Context

Treating every source as a PDF would invent optical provenance for symbolic files. Treating repeated preferences or model-generated historical assertions as musical evidence would also collapse distinct trust boundaries.

## Decision

PDF and image sources use the backend-neutral OMR path. MusicXML and restricted explicit-voice LilyPond are parsed directly. ABC has a native deterministic parser. MEI converts through music21 and MSCZ through MuseScore before the resulting MusicXML is normalized; diagnostics name that interchange step and the immutable original remains authoritative. Semantic lead-sheet JSON retains melody and chord-symbol events. Semantic existing-tablature JSON retains pitches, rhythm, course, fret, and notation labels. Natural-language or model-memory input requires an explicit proposed score and is permanently disclosed as best effort.

Non-optical sources create Score Transcription, Normalized Score, and Analysis Record versions without fabricating an OMR Run. Guided Start accepts optical and symbolic source files and routes them appropriately.

Cross-workspace Owner state is stored outside Arrangement Workspaces. Equivalent choices in at least two distinct workspaces can produce a Personal Default Candidate, but no behavior changes until explicit approval. Defaults are soft, scoped preferences; every application or precedence-based yield is disclosed in the Arrangement Brief.

Owner references are content-addressed local artifacts. Proposed reusable claims require a reference and citation locator and remain Knowledge Candidates until explicit promotion. Promotion creates a reviewed Historical Practice Claim and increments a reviewed Knowledge Pack. Built-in packs are schema-validated and cited. Neither OMR output nor uncited model memory can enter the Historical Knowledge Base directly.

## Consequences

- Source provenance describes the actual ingestion mechanism.
- Missing local converters fail with an actionable format-specific error rather than silently degrading.
- Preferences, project evidence, and historical authority remain separately inspectable.
- Public-domain regression fixtures can exercise genuinely different source adapters.
