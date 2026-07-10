# Require Preservation Audits for Faithful Reduction

Vellum will not mark a Faithful Reduction complete until a machine-readable Preservation Audit maps every Preservation Target to the resulting Arrangement Score and verifies that every transformation is permitted. Unexplained omissions, substitutions, rhythmic changes, or lost protected relationships are failures rather than advisory warnings.

## Considered options

- Depend on visual review and model self-assessment
- Report source deviations as non-blocking warnings
- Make source fidelity a deterministic completion gate

## Consequences

Preservation Targets and allowed transformations need stable identities and comparison semantics. Necessary deviations require an explicit, versioned Policy Exception approved by the Owner. The UI shows a concise result while retaining the complete event-and-relationship mapping for inspection.
