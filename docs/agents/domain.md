# Domain docs

Vellum is a single-context repository.

Before planning or changing behavior:

1. Read the relevant definitions and invariants in `CONTEXT.md`.
2. Read applicable decisions under `docs/adr/`.
3. Read the current scope and acceptance boundary in `SPEC.md`.
4. Use the exact domain terms from the glossary in code, tests, and tracer titles.
5. Surface any proposed contradiction with an accepted ADR instead of silently overriding it.

For the current Musical Proofs work, prefer the smallest relevant vocabulary: Source Artifact,
Score Transcription, Source Voice Graph, Principal Voice, Preservation Target, Preservation
Policy, Target Voice Plan, Target Harmonic Plan, Target Relationship Plan, Intended Technique
Plan, Instrument Instance, Instrument Calibration, Arrangement Candidate, Arrangement Score,
Transformation Report, Preservation Audit, Evaluation Card, Knowledge Candidate, Knowledge Pack,
Source Segment Version, Owner Playtest, and Arrangement Workspace.

Terms for external release attestations, complete inventory resolution, sealed qualification,
Vault ledgers, and artifact-readiness certification remain in the glossary for future use but
are not current implementation obligations. ADR 0023 defines the trigger for revisiting them.
