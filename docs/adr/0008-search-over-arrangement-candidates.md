# Search over Arrangement Candidates

Vellum will generate and compare Arrangement Candidates instead of treating one model-authored realization as the arrangement. It will reject candidates that violate preservation, figures, instrument mechanics, or hard contextual constraints; rank survivors by historical profile, idiom, playability, voice leading, and soft preferences; and turn the selected candidate into a versioned Arrangement Score.

## Considered options

- Generate one arrangement and repair it until it compiles
- Ask the model for several prose alternatives without structured evaluation
- Run a structured generate, prune, rank, compare, and select search

## Consequences

Candidate derivation choices and evaluation results must be structured and reproducible. Search may operate section by section to control combinatorial growth. Unselected candidates remain available for audition and branching but do not produce Deliverables by default. Each Target Configuration receives an independent search and Arrangement Score; alternate Notation Layouts do not. Sibling target solutions share source-analysis lineage through an Arrangement Family without pretending that instrument conversion is formatting. Editorial Commitments stay target-local unless a user explicitly promotes a portable constraint to a Family Commitment; instrument mechanics cannot leak silently between targets. When upstream correction or a Family Commitment change makes an Arrangement Score stale, Conservative Regeneration is the default: search is constrained to the affected dependency region and must preserve applicable commitments. Commitments protect explicit musical dimensions and anchored regions rather than freezing entire score objects, so unrelated dimensions remain searchable. A fresh unconstrained Arrangement Search remains available explicitly.

Each search is persisted before generation begins and records its exact Normalized Score, Analysis Record, Target Configuration, policy, ranking weights, candidate identities, selection, and completion state. Candidate IDs are stable within that record rather than strategy-name aliases that collide between searches. Every persisted candidate records its derivation choice, hard-constraint evidence, dimension scores, weighted total, rank or rejection reason, complete event proposal, and Preservation Audit.

The selected candidate is promoted to an Arrangement Score, but all surviving alternatives remain addressable after reload. Their neutral Audio Previews are generated only when selected in the comparison control. Branching an alternative creates an Arrangement Branch and a new Arrangement Score rooted in that candidate without changing the original search selection or winner.
