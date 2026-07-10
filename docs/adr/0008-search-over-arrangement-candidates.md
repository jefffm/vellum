# Search over Arrangement Candidates

Vellum will generate and compare Arrangement Candidates instead of treating one model-authored realization as the arrangement. It will reject candidates that violate preservation, figures, instrument mechanics, or hard contextual constraints; rank survivors by historical profile, idiom, playability, voice leading, and soft preferences; and turn the selected candidate into a versioned Arrangement Score.

## Considered options

- Generate one arrangement and repair it until it compiles
- Ask the model for several prose alternatives without structured evaluation
- Run a structured generate, prune, rank, compare, and select search

## Consequences

Candidate derivation choices and evaluation results must be structured and reproducible. Search may operate section by section to control combinatorial growth. Unselected candidates remain available for audition and branching but do not produce Deliverables by default. Each Target Configuration receives an independent search and Arrangement Score; alternate Notation Layouts do not. Sibling target solutions share source-analysis lineage through an Arrangement Family without pretending that instrument conversion is formatting. Editorial Commitments stay target-local unless a user explicitly promotes a portable constraint to a Family Commitment; instrument mechanics cannot leak silently between targets. When upstream correction or a Family Commitment change makes an Arrangement Score stale, Conservative Regeneration is the default: search is constrained to the affected dependency region and must preserve applicable commitments. Commitments protect explicit musical dimensions and anchored regions rather than freezing entire score objects, so unrelated dimensions remain searchable. A fresh unconstrained Arrangement Search remains available explicitly.
