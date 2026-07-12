# Canonical Owner-intent router

Status: complete

Type: AFK

User stories: U2, U3, U5

## What to build

Classify every score-anchored request before mutation so source corrections, plan revisions, score edits, interpretations, commitments, and exceptions use their correct canonical layer.

## Acceptance criteria

- [x] The UI shows proposed canonical layer, scope, consequence, and confirmation requirement.
- [x] Source and Analysis corrections follow their existing lineage rather than becoming arrangement constraints.
- [x] Low-consequence explanations require no unnecessary confirmation.
- [x] Ambiguous consequential requests remain uncommitted until resolved.

## Completion evidence

- A closed canonical-layer union covers Score Transcription, Analysis Claim, Arrangement Plan, Arrangement Score, Performance Interpretation, Commitment, Policy Exception, Personal Default Candidate, and explanation ownership. Representative fixtures exercise all nine classes.
- Every proposal binds the exact Arrangement Score version, family, search, plan, Analysis, target, policy, selected events/measures, source-event lineage, and applicable findings. Server-side resolution rejects stale score versions, mismatched lineage, out-of-scope events, and stale findings before classification.
- Classification is a no-effect proposal: its schema fixes `mutationAuthorized` to false, and an end-to-end store assertion proves both explanatory and mutating proposals leave workspace state unchanged. A model-suggested layer remains only an alternative when the request is ambiguous.
- The score-selection UI now shows canonical layer, exact scope, consequence, confirmation requirement, rationale, and evidence identities. Solver/classifier internals stay out of the default surface; the evidence disclosure changes presentation only.
- Explanations proceed from the Owner's original Ask action without a redundant confirmation. Mutating natural-language requests and direct Edit, Alternatives, and Personal Default actions stop at an explicit confirmation card before their existing canonical boundary opens.
- Cross-layer and otherwise ambiguous requests expose explicit alternatives and emit no downstream request until the Owner resolves the layer. Classification failure retains the selection/request and reports an inline retry path.
- Score Transcription and Analysis classifications are never compiled into arrangement constraints: the confirmed message names the canonical boundary and preserves the already-versioned correction/staleness services verified by the Source Truth and Analysis tracers.
- Focused verification covers nine-way classification, model ambiguity, stale anchors, no mutation, low-consequence pass-through, consequential confirmation, ambiguity resolution, and expert disclosure invariance. The reload path now fetches the exact persisted Plan before rebuilding selection context.
- Retained machine-readable verification: `.scratch/arrangement-intelligence/evidence/T17/verification.json`.

## Blocked by

- 12
- 16
