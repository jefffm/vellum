# Domain docs

Vellum is a single-context repository.

Before planning or changing behavior:

1. Read the relevant definitions and invariants in `CONTEXT.md`.
2. Read applicable decisions under `docs/adr/`.
3. Read the current scope and acceptance boundary in `SPEC.md`.
4. Use the exact domain terms from the glossary in code, tests, and tracer titles.
5. Surface any proposed contradiction with an accepted ADR instead of silently overriding it.

For the current MEI Editions work, prefer the smallest relevant vocabulary: Source Artifact,
Diplomatic Tablature Transcription, Transcription Acceptance, Tablature Interpretation,
Interpretation Acceptance, Transcription Correction, Correction Batch, Diplomatic Edition,
Reading Edition, Interactive Edition Surface, Critical Uncertainty, Passage Selection, Selection
Context Envelope, Attested Realization, Guided Knowledge Session, and Arrangement Workspace.

Terms for external release attestations, complete inventory resolution, sealed qualification,
Vault ledgers, and artifact-readiness certification remain in the glossary for future use but
are not current implementation obligations. ADR 0023 defines the trigger for revisiting them.
