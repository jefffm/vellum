# Current specification reconciliation

This document is the current-status index for the normative contract in `CONTEXT.md`, accepted ADRs, `SPEC.md`, and the older subordinate design specs. Older milestone labels and unchecked planning boxes are historical records, not contradictory implementation status.

| Contract area                                 | Production evidence                                                         | Executable evidence                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Source-first Guided Start and local workspace | `src/guided-start.ts`, `workspace-store.ts`                                 | `workspace-route.test.ts`, `greensleeves-tracer.test.ts`                      |
| PDF/image OMR with native evidence            | `omr.ts`, ADR 0009                                                          | `omr.test.ts`, `score-anchored-review-tracer.test.ts`                         |
| MusicXML, LilyPond, ABC, MEI, MSCZ            | `source-import-service.ts`, `abc-normalizer.ts`, `interchange-converter.ts` | `source-import-service.test.ts`, `source-import-tracer.test.ts`               |
| Lead sheet, existing tablature, best effort   | semantic Score Events and ingestion diagnostics in `music-domain.ts`        | semantic and best-effort cases in `source-import-service.test.ts`             |
| Provider Connection and durable actions       | provider and model-action services                                          | provider contract, lifecycle, redaction, and opt-in real smoke tests          |
| Musicological Analysis                        | `musicological-analysis.ts`, `analysis-service.ts`                          | analysis unit tests and three specialist tracers                              |
| Reviewed historical knowledge                 | `owner-store.ts`, `knowledge-pack-loader.ts`                                | owner-store and knowledge-pack-loader tests                                   |
| Personal Defaults                             | scoped choice/candidate/default records and precedence disclosure           | owner-store recurrence, approval, release, application, and yielding tests    |
| Arrangement Search and branching              | `arrangement-service.ts`, search routes/store                               | Greensleeves service and candidate preview/branch tests                       |
| Three Preservation Policies                   | `preservation-policy.ts` and Guided Start selection                         | policy and Continuo Reduction tests                                           |
| Preservation Audit mutation resistance        | principal, continuo, and imitative audit functions                          | mutation tests plus three production tracers                                  |
| Transformation Report and overlay linkage     | `transformation-report.ts`, Guided Start overlay                            | transformation and tracer assertions                                          |
| Continuo disposition                          | `continuo-arranger.ts`, ADR 0011                                            | complete, separate-bass, and reduction tests                                  |
| Historical/classical targets                  | instrument profiles and engraving pipeline                                  | Greensleeves siblings, lute diapason, classical guitar, Flow My Tears         |
| Audio Preview and Performed Form              | `audio-preview.ts`, Guided Start controls                                   | playback unit and tracer tests                                                |
| Families and versioned Deliverables           | workspace records and deliverable service                                   | arrangement service compile/preview persistence assertions                    |
| Stateful lineage                              | `lineage-service.ts`, lineage routes and UI                                 | immutable staleness, conflict, regeneration, direct-edit, and migration tests |
| Commitments and Policy Drift                  | editorial/family records, exception-aware audit                             | target-local promotion guard, conflict, release, and audit tests              |
| Alfabeto                                      | library, MCP tool, engraving event, prompt                                  | 81 library tests plus engraving integration tests                             |
| Local-first reproducible runtime              | Express/Vite runtime and `flake.nix`                                        | npm client/server gates; Nix build is required where Nix is installed         |

The verification command `npm run spec:verify` checks that every indexed evidence family remains present and that known superseded prompt/spec claims do not regress. It complements, rather than replaces, behavioral tests and rendered-output checks.

## Explicitly non-current historical items

The `SPEC.md` section headed “v2 Scope” remains optional future exploration except where a later accepted ADR or `CONTEXT.md` promoted an item into the current contract. Promoted items—durable workspaces, branching, figured-bass realization, and Web Audio preview—are implemented despite their old placement. Unpromoted items such as German tablature, batch suite conversion, configurable school-specific ornament tables, and piano pedaling remain non-current and must not be represented as shipped.

The subordinate Alfabeto, historical-rendering, Hymnary, and template-fill specs are retained as design history. Their reconciliation banners point here when original v1/v2 sequencing is stale.
