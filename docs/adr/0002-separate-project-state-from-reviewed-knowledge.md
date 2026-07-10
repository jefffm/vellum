# Separate project state from reviewed knowledge

Vellum will persist three distinct kinds of state: complete Arrangement Workspaces, cross-project Personal Defaults, and a reviewed Historical Knowledge Base. Project corrections and decisions save automatically inside their workspace, while reusable findings cross into global historical knowledge only through explicit, source-backed review.

## Considered options

- Keep imports and analysis session-local
- Automatically learn globally from every correction and model inference
- Persist project state automatically with an explicit global promotion boundary

## Consequences

Source artifacts, transcriptions, analysis, corrections, plans, outputs, and provenance need durable identities and relationships. Potentially reusable findings are Knowledge Candidates until reviewed; OMR output and unreviewed model inference never become global historical truth automatically. Repeated Owner choices may produce scoped Personal Default Candidates, but they have no effect until explicitly approved and remain soft, reversible preferences rather than historical claims or arrangement commitments. Defaults yield to musical evidence, selected historical profiles, preservation, commitments, and hard constraints; an inapplicable default is explained rather than silently applied or deleted.
