# Require Preservation Audits for Faithful Reduction

Vellum will retain a complete source-to-arrangement Transformation Report under every Preservation Policy. It will not mark a Faithful Reduction complete until a machine-readable Preservation Audit evaluates that report, maps every Preservation Target to the resulting Arrangement Score, and verifies that every transformation is permitted. Unexplained omissions, substitutions, rhythmic changes, or lost protected relationships are failures rather than advisory warnings. Under Idiomatic Adaptation and Free Paraphrase, the same mapping remains inspectable but is not a note-level fidelity gate.

## Considered options

- Depend on visual review and model self-assessment
- Report source deviations as non-blocking warnings
- Make source fidelity a deterministic completion gate

## Consequences

Preservation Targets, source-to-arrangement mappings, and allowed transformations need stable identities and comparison semantics. Necessary deviations require an explicit, versioned Policy Exception approved by the Owner. An Editorial Commitment that conflicts with source evidence, a Preservation Target, or another hard constraint becomes a Commitment Conflict and blocks completion. The user must release the commitment, correct the Score Transcription, or approve a score-anchored Policy Exception; Vellum cannot silently choose a side. Local exceptions may yield a disclosed pass with exceptions, but the audit evaluates their cumulative musical consequence. A critical or accumulated compromise of a Preservation Target is Policy Drift and fails Faithful Reduction until the arrangement or policy changes. Transformations such as local octave displacement require relationship-level checks for phrase contour, cadence, registral emphasis, and perceptual prominence rather than pitch-class equality alone. The UI shows a concise result while retaining the complete Transformation Report, conflicts, exceptions, and drift findings for inspection.
