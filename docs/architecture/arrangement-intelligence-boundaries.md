# Arrangement Intelligence boundaries and legacy disposition

This inventory records the implemented prototype boundary governed by accepted ADRs 0016 through 0021. Tracer T44 captured the Owner's architecture acceptance and prototype-scope decision; the remaining target-player attestations were explicitly left unevaluated rather than converted into passes.

## Canonical ownership

| Decision or evidence                  | Canonical owner                                                 | Derived or projected forms               |
| ------------------------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| Uploaded evidence                     | immutable Source Artifact plus adapter-specific import evidence | thumbnails, OMR overlays                 |
| Reviewed notation reading             | versioned Score Transcription                                   | Normalized Score                         |
| Musical claims and protected identity | Analysis Record                                                 | prompt summaries, readiness views        |
| Requested musical outcome             | Arrangement Brief and Performance Brief                         | guided-start summary                     |
| Intended transformation               | Arrangement Plan                                                | plan cards and corrections               |
| Target setup                          | versioned Instrument Instance                                   | profile labels in notation               |
| Explored realizations                 | Arrangement Search and Candidate records                        | comparisons and auditions                |
| Adopted target-local music            | immutable Arrangement Score                                     | LilyPond, SVG, PDF, MIDI, Audio Preview  |
| Physical use                          | Owner Playtest                                                  | Human Evaluation reference and readiness |
| Evaluation expectations and evidence  | Evaluation Case, immutable Run, Case Run, and Card              | reports and CI summaries                 |

No derived view owns an independent musical decision. A Deliverable cannot mutate an Arrangement Score, and an Evaluation Run cannot mutate canonical music.

## Legacy disposition

| Surface                                                              | Disposition                                                                 | Reason and migration boundary                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/arrangements` and `VELLUM_ARRANGEMENTS_DIR` flat LilyPond JSON | Retained compatibility surface; explicitly `noncanonical_legacy_projection` | Existing files lack source, review, analysis, brief, plan, search, audit, and immutable lineage. Reading old files injects the noncanonical label in memory. Canonical use requires importing the actual source into an Arrangement Workspace; Vellum must not fabricate missing provenance. |
| Direct `/api/compile`, `/api/engrave`, and tool calls                | Retained stateless tools                                                    | Useful for diagnostics and projections. Successful compilation proves syntax/artifact production only, never musical adoption or readiness.                                                                                                                                                  |
| Restricted LilyPond input adapter                                    | Retained source adapter                                                     | It creates workspace lineage through the same import boundary; it is not the flat arrangement store.                                                                                                                                                                                         |
| Legacy `reviewed` transcription status                               | Retained descriptive status, not global authority                           | Purpose-scoped Source Truth authorization and downstream consequence checks remain required.                                                                                                                                                                                                 |
| Event-local position helpers                                         | Retained primitives                                                         | Canonical target workflows select phrase candidates through bounded search; helpers do not select adopted arrangements by themselves.                                                                                                                                                        |

There is deliberately no automatic flat-file-to-Arrangement-Score migration. Such a conversion would invent authoritative source identity, review state, Preservation Targets, and decision lineage. A future guided import may preserve the flat file as a Source Artifact and ask for the missing decisions.

## Supported production surfaces

The canonical Guided Start accepts optical sources through backend-neutral OMR and documented symbolic adapters. Implemented target families are five-course baroque guitar, thirteen-course baroque lute, and six-string classical guitar. Contextual continuo and six-course Renaissance-lute imitative intabulation validate shared contracts without pretending that all domains use the same position state.

Production evidence: `src/server/lib/workspace-store.ts`, `src/server/lib/arrangement-service.ts`, `src/server/lib/arrangement-route.ts`, `src/server/lib/continuo-evaluation.ts`, and `src/server/lib/imitative-evaluation.ts`. Evaluation evidence: `docs/archive/execution-waves/2026-07-17/arrangement-intelligence/evidence/T36/verification.json` through `T38/verification.json`.
