# Instrument Intelligence requirement ledger

Status: bootstrap requirement-family index — not yet clause-level completion evidence

Authority: [SPEC.md](../../SPEC.md)

This file is an honest planning index of requirement **families**. It does not claim that each row is one atomic clause, and it is not sufficient to judge completion. The parser-facing `Initial execution eligibility` scalar in each issue records only the immutable bootstrap declaration; runtime eligibility is computed independently. Tracer 01 must enumerate every normative SPEC clause, execution bullet, Machine Complete clause, Release Complete clause, and guardrail into the generated manifest with a stable ID, normalized-text digest, implementation owner, evidence contributors, closure verifier, dependency digests, and stale-evidence rules before any dependent tracer can become runtime-eligible. It may split a family into smaller stable IDs but may not silently drop, merge, weaken, or relabel one.

The checked-in schema-5 verifier is correspondingly a static bootstrap guard only: it rejects mutable progress and all public evidence. T01's first governance-only pre-registration transaction must upgrade the schema and atomize every T01 acceptance item—including pending-evidence validation, exact A → P → manifest-only-M ancestry, result-disposition and remediation-obligation ledgers, role-separated clause claims, signed Owner/reviewer authority, subject/tree freshness, privacy aggregation, media sanitization, historical authority path sets, and monotonic external trust—before T01 itself can record execution evidence.

Issue headers name `Requirement families touched`; they are not completion claims. In the clause ledger, `implementation owner`, `evidence contributor`, and `closure verifier` are separate roles. A development tracer may contribute evidence to a Release Complete family without owning or satisfying its human-authority clause.

Tracers 01–107 are the designed base wave, not a fixed completion count. A failed qualification, Machine-closure audit, review round, or Release-closure audit appends new remediation IDs after T107 through an origin-anchored registry/PLAN-row transaction that cannot alter prior definitions or authority narrative. Each remediation generation is bound to a closed-schema T69/T84/T85/T87/T103/T106 dispatch artifact and names affected requirement families, exact actual invalidation edges/scopes, the prescribed `rejoinAt`, derived Machine impact, and closure targets. Finalizing repair reserves exact future identities. An unresolved reservation is permitted only while closure remains pending and blocks it; a materialized rejoin strictly descends from repair and each target descends from rejoin. Current closure covers every target from every historical remediation generation, including superseded and tombstoned generations, so later state cannot erase an obligation. T87 is mandatory; T85 is present exactly when actual scope reaches Machine Complete. Release Complete requires every cumulative contract current, materialized, passing, committed, pushed, and strictly verified against freshly fetched `origin/main` and the preceding manifest-changing revision.

## Evidence contract

- `planned` means an issue exists but no completion claim is made.
- `implemented` requires exact implementation and verification commits, compatible evidence, current dependency digests, and every required gate.
- `blocked`, `incomplete`, `failed`, `stale`, `unknown`, and `not_claimed` are not passes.
- Public evidence belongs under `evidence/TNN/`. Exact held-out identity, truth, mutations, invalidation, reserve selection, direct private-data digests, and per-attempt diagnostics remain Vault-only; public receipts use only keyed non-resolving Vault commitments, digests of already-public artifacts, bounded aggregate states, and typed bounded diagnostics.
- Machine Complete and Release Complete are non-compensating. A human review cannot repair a failed machine gate, and a machine score cannot substitute for required human authority.

## Normative section coverage

| ID           | Requirement area                                                                                                                                   | Evidence-producing tracer(s)                 | Initial status |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------- |
| II-AUTH-001  | Sole-spec authority, reading order, accepted architecture, and historical-document freeze                                                          | 01                                           | planned        |
| II-OUT-001   | Source-backed personal-musicologist product outcome without requiring specialist prompts                                                           | 23–62, 73–80, 99–101                         | planned        |
| II-OUT-002   | Coequal baroque-guitar, baroque-lute, and classical-guitar targets                                                                                 | 42–56, 60, 65–67, 73–80, 88–90               | planned        |
| II-OUT-003   | Complete source → knowledge → plan → search → evaluation → adoption → learning loop                                                                | 05–107                                       | planned        |
| II-BND-001   | Historical, editorial, pedagogical, software, personal, and evaluation authority lanes remain distinct                                             | 12–16, 22, 57, 68, 88–95, 100–106            | planned        |
| II-BND-002   | Uncertainty and disagreement are represented rather than erased                                                                                    | 11–16, 23, 57, 68–80, 88–102                 | planned        |
| II-BND-003   | Readiness is tiered by artifact, qualification, and release state                                                                                  | 14, 17, 22, 60–69, 81–107                    | planned        |
| II-BND-004   | Knowledge activation is explicit, scoped, and manifest-bound                                                                                       | 12–16, 101–102, 105–106                      | planned        |
| II-BND-005   | Constitutive technique is planned before search and preserved in the score                                                                         | 31, 33–35, 42–56, 73–80, 88–90               | planned        |
| II-BND-006   | Packs contain validated declarative knowledge, never executable uploads                                                                            | 12, 14–16, 73–80, 101                        | planned        |
| II-BND-007   | Old results stay immutable and replayability is classified honestly                                                                                | 07, 09, 15, 17, 57–58, 84, 96–99             | planned        |
| II-BND-008   | Rights change and deletion traverse complete provenance and derivative graphs                                                                      | 05–06, 57–58, 68, 84, 96                     | planned        |
| II-SRC-001   | Durable Work, Manifestation, Exemplar, Digital Asset, acquisition, segment, and role-binding identity graph                                        | 05, 11, 73–80, 100                           | planned        |
| II-SRC-002   | Rights, access, processing, repository inclusion, redistribution, and provider egress decisions                                                    | 02–06, 10–11, 68, 71, 73–80, 96, 100         | planned        |
| II-SRC-003   | Untrusted acquisition and parsing fail safely within resource and disclosure bounds                                                                | 02, 11, 70–71, 73–80, 100                    | planned        |
| II-SRC-004   | Resumable, versioned Page Atlas with printed/logical page mapping and immutable correction lineage                                                 | 11, 73–80, 100                               | planned        |
| II-SRC-005   | Modality-specific text, image, notation, OMR/OCR, and manual extraction remains typed and uncertain                                                | 11, 36, 73–80, 100                           | planned        |
| II-SRC-006   | Every extracted claim and example retains an exact, stable, reviewable citation                                                                    | 11–14, 73–80, 100–101                        | planned        |
| II-SRC-007   | Every consequential transcription/extraction used by a release package receives independent scope-qualified source review                          | 81, 100                                      | planned        |
| II-SRC-008   | Source review preserves uncertainty, correction lineage, disagreement, and unresolved readings; OCR confidence never substitutes for authority     | 11, 36, 73–80, 100                           | planned        |
| II-SRC-009   | Source-review attestations bind exact asset, Page Atlas, segment/crop, extraction, canonical occurrence, and package identities                    | 81, 100                                      | planned        |
| II-KNW-001   | Knowledge Candidates preserve axes, evidence, counterevidence, derivations, applicability, and open questions                                      | 12, 73–80, 100–101                           | planned        |
| II-KNW-002   | Drafts, immutable releases, attestations, advisories, and successor records are distinct                                                           | 12–13, 57, 73–80, 84, 88–102                 | planned        |
| II-KNW-003   | Reviewer identity, credentials, verification, scope, expiry, revocation, and clock policy fail closed                                              | 13, 64–68, 82, 86, 88–95, 100–102            | planned        |
| II-KNW-004   | Profiles and compiler mappings are typed, declarative, source-bound, and lane-compatible                                                           | 12, 14, 31, 37, 40, 43–56, 73–80, 88–92, 101 | planned        |
| II-KNW-005   | Applied Knowledge Manifest is complete over exact Inventory, Catalog, Resolution Policy, Activation Decisions, and Component Registry              | 08, 14–16, 72, 101–102                       | planned        |
| II-KNW-006   | Authority Path Inventory covers every prompt, default, table, branch, ranker, validator, constant, and label                                       | 08, 14–16, 101–102                           | planned        |
| II-KNW-007   | Knowledge Reassessment handles corroboration, conflict, supersession, advisory, retraction, rights change, and questions without mutating old work | 57–58, 84, 96, 98                            | planned        |
| II-MUS-001   | Source understanding and preservation obligations precede fingering                                                                                | 23–35, 73–80, 100–101                        | planned        |
| II-MUS-002   | Source Voice Graph distinguishes voices from parts/staves and versions ambiguity resolution                                                        | 23, 104                                      | planned        |
| II-MUS-003   | Lyric Underlay preserves verses, syllables, elisions, melismas, extenders, anchors, and lineage                                                    | 25, 35, 94, 107                              | planned        |
| II-MUS-004   | Time-varying musical context and part-scoped written-to-sounding Transposition Plan are exact                                                      | 24, 35, 104                                  | planned        |
| II-MUS-005   | Canonical ties, slurs, phrase marks, and source ornaments retain notation, lineage, and playback semantics                                         | 26, 35, 93, 104                              | planned        |
| II-MUS-006   | Target Voice Plan records roles, activity/rest spans, continuity, prominence, omissions, and realized mappings                                     | 27, 34–35, 72, 79–80, 104                    | planned        |
| II-MUS-007   | Target Harmonic Plan records bass, inversion, harmonic rhythm, dissonance, suspension, and cadence obligations                                     | 28, 34–35, 72, 75, 79–80, 104                | planned        |
| II-MUS-008   | Target Relationship Plan preserves ordered entries, exchanges, counterpoint, suspension, cadence, and validation profile                           | 29, 34–35, 72, 77, 80, 92, 104               | planned        |
| II-MUS-009   | Continuo Realization and Disposition Plans distinguish complete, separate-bass, reduction, and rejected outcomes                                   | 30, 36–39, 46, 75, 91                        | planned        |
| II-MUS-010   | Intended Technique Plan records applicable resources, transitions, held/damped state, and score consequences                                       | 31, 33–35, 42–56, 73–80, 88–90               | planned        |
| II-MUS-011   | Ergonomic context is exact, versioned, and separate from mechanics and historical authority                                                        | 32–35, 42–56                                 | planned        |
| II-MUS-012   | Owner can author, calibrate, version, select, inspect, and invalidate exact Instrument Instances                                                   | 32                                           | planned        |
| II-MUS-013   | Phrase candidate state and work obligations support global reasoning and honest terminal outcomes                                                  | 33                                           | planned        |
| II-MUS-014   | Candidate output retains all plans, mappings, lineage, measurements, alternatives, conflicts, and audits                                           | 34, 72                                       | planned        |
| II-MUS-015   | Selection is independent from evaluation; only a passing immutable Adoption Decision creates the default score                                     | 17, 22, 34, 72                               | planned        |
| II-BG-001    | Baroque-guitar technique facets are orthogonal rather than a single mislabeled mode                                                                | 31, 43–45, 73–74, 88                         | planned        |
| II-BG-002    | Exact five-course configuration, constituent strings, tuning, masks, and geometry drive realization                                                | 32, 42–47, 73–74, 88                         | planned        |
| II-BG-003    | Punteado uses profile-scoped right-hand allocation and exact two-dimensional contacts/transitions                                                  | 42–43, 73, 88                                | planned        |
| II-BG-004    | Rasgueado and alfabeto preserve chart identity, ordered strokes, masks, attacks, resonance, and damping                                            | 44, 74, 88                                   | planned        |
| II-BG-005    | Mixed style preserves transitions, held harmony, releases, voice prominence, and meaningful alternatives                                           | 45, 74, 88                                   | planned        |
| II-BG-006    | Baroque-guitar Continuo never claims a complete foundation when only reduction or separate bass is valid                                           | 46, 73–75, 88, 91                            | planned        |
| II-BG-007    | Baroque-guitar acceptance covers playability, idiom, recognition, engraving, playback, and authority                                               | 42–47, 60, 65, 73–74, 81, 88, 93, 101        | planned        |
| II-BL-001    | Exact thirteen-course configuration separates stopped courses, diapasons, Bass Tuning, and editorial signs                                         | 32, 48–52, 76–78, 89                         | planned        |
| II-BL-002    | Joint left-hand search uses calibrated two-dimensional geometry and whole-phrase transitions                                                       | 48–49, 76–78, 89                             | planned        |
| II-BL-003    | Right-hand state covers digit allocation, preparation, simultaneity, alternation, crossing, thumb, and damping                                     | 48, 50, 76–78, 89                            | planned        |
| II-BL-004    | Diapason access uses calibrated plucking-zone/course/bass-rider geometry and explicit transitions                                                  | 50–51, 76–78, 89                             | planned        |
| II-BL-005    | French tablature and playback preserve `a`, `/a`, `//a`, `///a`, `4`, `5`, course identity, and no duplicates                                      | 51, 78, 89, 93                               | planned        |
| II-BL-006    | Baroque-lute acceptance and course-13 claims remain profile-scoped and evidence-honest                                                             | 48–52, 60, 66, 76–78, 81, 89, 93, 101        | planned        |
| II-CG-001    | Exact six-string configuration and performer context keep mechanics distinct from ergonomics                                                       | 32, 53–56, 79–80, 90                         | planned        |
| II-CG-002    | Joint left/right-hand realization preserves linked polyphonic state across phrases                                                                 | 53–55, 79–80, 90                             | planned        |
| II-CG-003    | Target Voice Plan is mandatory; event count and continuous sound cannot proxy voice coherence                                                      | 27–29, 53–56, 79–80, 90                      | planned        |
| II-CG-004    | Polyphonic search preserves bass/function/cadence, planned rests, crossings, ties, and alternatives                                                | 53–55, 79–80, 90                             | planned        |
| II-CG-005    | First-class standard notation and isolated playback retain written/sounding identity and hidden fingering evidence                                 | 55–56, 90, 93                                | planned        |
| II-CG-006    | Classical-guitar acceptance covers coherent voices, mechanics, notation, playback, and scoped idiom                                                | 53–56, 60, 67, 79–81, 90, 93, 101            | planned        |
| II-EVAL-001  | Evaluation layers and observable dimensions stay independent and do not collapse into one score                                                    | 17, 22, 35, 60, 72, 83–85                    | planned        |
| II-EVAL-002  | Generation and evaluation are separate processes and capabilities                                                                                  | 18–20, 71, 83                                | planned        |
| II-EVAL-003  | Hard-gate tri-state and acceptance four-state semantics use the specified precedence                                                               | 17                                           | planned        |
| II-EVAL-004  | Dataset assignments use Generation-System-scoped contamination groups and split manifests                                                          | 21–22, 64, 82–83                             | planned        |
| II-EVAL-005  | Append-only attempt ledgers enforce genesis, CAS head, fork detection, invalidation, permanent regressions, and reserve inheritance                | 21, 61, 64, 82–85                            | planned        |
| II-EVAL-006  | Deterministic, stochastic, and opaque-provider qualification policies are pinned and honestly expire                                               | 22, 61, 64, 82–85                            | planned        |
| II-EVAL-007  | Required mutations are evaluator-only and independently kill every named semantic failure                                                          | 35, 39, 41, 42, 48, 53, 60, 83               | planned        |
| II-EVAL-008  | Three coequal Golden engraving/playback fixtures verify semantic, rendered, and sounding identity                                                  | 47, 51–52, 56, 60, 83, 93                    | planned        |
| II-EVAL-009  | Regression contracts are content-addressed and compatible only over exact system/evaluator identities                                              | 21–22, 60–61, 83–85                          | planned        |
| II-EVAL-010  | Development regressions and held-out acceptance remain separate, with no public truth leakage                                                      | 20–22, 61, 63–64, 71, 82–84                  | planned        |
| II-LEARN-001 | Feedback and state create typed, reviewable Personal Default, Ergonomic, Knowledge, Calibration, and fixture proposals only                        | 57–58, 84, 96–99                             | planned        |
| II-UX-001    | Guided Start begins with source upload/acquisition and output-format choices, then reveals relevant controls                                       | 62                                           | planned        |
| II-UX-002    | Default arrangement view supports selection, prompting, manual batch edits, versioning, playback following, and alternatives                       | 34, 58, 62, 97, 99                           | planned        |
| II-UX-003    | Expert disclosure exposes plans, evidence, assumptions, manifests, alternatives, conflicts, and unknowns                                           | 14, 34, 57–58, 62, 81, 95, 99                | planned        |
| II-UX-004    | Knowledge Workbench supports sources, candidates, review, activation, diff, reassessment, deletion, and affected-workspace navigation              | 10–16, 57–58, 96, 99, 102                    | planned        |
| II-SEED-001  | Baroque-guitar seed program uses rights-reviewed primary sources and never a universal chart by assertion                                          | 03, 12–16, 43–47, 73–74, 88, 101             | planned        |
| II-SEED-002  | Baroque-lute seed program uses Mace plus scoped normative/repertoire evidence                                                                      | 11–16, 49–52, 76–78, 89, 101                 | planned        |
| II-SEED-003  | Classical-guitar seed program uses scoped Sor and aligned Carulli evidence                                                                         | 12–16, 54–56, 79–80, 90, 101                 | planned        |
| II-SEED-004  | Italian keyboard Continuo seed program uses Gasparini and a legally usable Golden Fixture                                                          | 36–39, 75, 91, 101                           | planned        |
| II-SEED-005  | Development fixtures are rights-cleared, content-addressed, and never confused with held-out evidence                                              | 03, 20–22, 35, 60–64, 68, 71, 73–83, 100     | planned        |
| II-OPS-001   | Versioned release-floor workloads, hardware classes, metrics, limits, cancellation, checkpoint, and resume gates are mandatory                     | 04, 33, 59, 61–64, 70, 83–85, 97             | planned        |

## Execution-step coverage

| ID           | SPEC execution obligation                                                                               | Evidence-producing tracer(s) |
| ------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------- |
| II-EXEC-000  | Slice 0 specification, security, rights, evaluator-canary, and baseline guard umbrella                  | 01–04, 70–71                 |
| II-EXEC-000A | Slice 0 specification, provider/security, rights, and release-floor policy guard                        | 01–04                        |
| II-EXEC-000B | Slice 0 clean-baseline measurement and immutable release-floor publication                              | 70                           |
| II-EXEC-000C | Slice 0 early evaluator-input and private/public leak canaries                                          | 71                           |
| II-EXEC-001A | Slice 1 versioned identity and shared asset/provenance graph                                            | 05–06                        |
| II-EXEC-001B | Slice 1 publication store, authority inventory, migration, rollback, quarantine, and Workbench proof    | 07–10                        |
| II-EXEC-002  | Slice 2 Mace upload/acquisition through safe cited browser segment                                      | 11                           |
| II-EXEC-002A | Slice 2 Sanz and Corbetta acquisition through cited test-only baroque-guitar releases                   | 73–74                        |
| II-EXEC-002B | Slice 2 Gasparini acquisition through cited test-only Continuo release                                  | 75                           |
| II-EXEC-002C | Slice 2 Baron, Perrine, and Weiss acquisition through cited test-only baroque-lute releases             | 76–78                        |
| II-EXEC-002D | Slice 2 Sor and Carulli acquisition through cited test-only classical-guitar releases                   | 79–80                        |
| II-EXEC-003A | Slice 3 evidence, release, reviewer authority, profile, and mapping contracts                           | 12–13                        |
| II-EXEC-003B | Slice 3 exact inventory/catalog/manifest and provisional consequence                                    | 14                           |
| II-EXEC-003C | Slice 3 atomic resolver cutover and isolated nonhistorical test default                                 | 15–16                        |
| II-EXEC-003D | Slice 3 authorized maintainer decision                                                                  | 102                          |
| II-EXEC-003E | Slice 3 automatic maintainer verification and ordinary nonhistorical activation                         | 105                          |
| II-EXEC-004A | Slice 4 legacy Card/status, sealed-evaluator, and canonical search/selection foundation umbrella        | 17–18, 72                    |
| II-EXEC-004B | Slice 4 Vault/public split, ledgers, qualification policies, and evaluator-framework umbrella           | 19–22, 35, 71                |
| II-EXEC-004C | Slice 4 legacy Card/status migration                                                                    | 17                           |
| II-EXEC-004D | Slice 4 sealed evaluator service and typed private/public capability boundaries                         | 18–20, 71                    |
| II-EXEC-004E | Slice 4 split/attempt ledgers and qualification/provider policies                                       | 21–22                        |
| II-EXEC-004F | Slice 4 Search Measurement, Selection Policy/Decision, and Adoption Decision foundation                 | 72                           |
| II-EXEC-004G | Slice 4 synthetic observable evaluator framework and mutation contracts                                 | 35                           |
| II-EXEC-005A | Slice 5 Source Voice, text, context, transposition, and spanners                                        | 23–26                        |
| II-EXEC-005B | Slice 5 target voice, harmony, relationships, Continuo, technique, and Instrument Instance              | 27–32                        |
| II-EXEC-005C | Slice 5 phrase search, candidate mapping, independent evaluation, and adoption                          | 33–35                        |
| II-EXEC-006A | Slice 6 optical/reviewed canonical figured-bass truth                                                   | 36                           |
| II-EXEC-006B | Slice 6 source-backed cembalo realization and disposition branches                                      | 37–38                        |
| II-EXEC-006C | Slice 6 mutation and development acceptance                                                             | 39                           |
| II-EXEC-007A | Slice 7 imitative Golden realization                                                                    | 40                           |
| II-EXEC-007B | Slice 7 independent imitative mutations and acceptance                                                  | 41                           |
| II-EXEC-008A | Slice 8.1 preserve and reject known-bad baroque-guitar output                                           | 42                           |
| II-EXEC-008B | Slice 8.2 source-backed punteado, rasgueado, alfabeto, and mixed-style repair                           | 43–45                        |
| II-EXEC-008C | Slice 8.3 honest baroque-guitar Continuo disposition                                                    | 46                           |
| II-EXEC-008D | Slice 8.4 development Regression Bundle and Golden fixture                                              | 47                           |
| II-EXEC-009A | Slice 9.1 preserve and reject known-bad baroque-lute output                                             | 48                           |
| II-EXEC-009B | Slice 9.2 source-backed calibrated left/right-hand and diapason repair                                  | 49–50                        |
| II-EXEC-009C | Slice 9.3 Golden engraving and playback semantics                                                       | 51                           |
| II-EXEC-009D | Slice 9.4 development Regression Bundle and course-13 claim policy                                      | 52                           |
| II-EXEC-010A | Slice 10.1 preserve and reject disappearing-bass output                                                 | 53                           |
| II-EXEC-010B | Slice 10.2 source-backed coherent reduction and joint-hand notation repair                              | 54–55                        |
| II-EXEC-010C | Slice 10.3 development Regression Bundle and Golden fixture                                             | 56                           |
| II-EXEC-011  | Slice 11 reassessment, reviewed learning, deletion, recovery, regeneration, and interactive editing     | 57–58, 96–99                 |
| II-EXEC-011A | Slice 11 reassessment and governed learning proposals                                                   | 57                           |
| II-EXEC-011B | Slice 11 Workbench advisory, affected-workspace navigation, and review diff                             | 58                           |
| II-EXEC-011C | Slice 11 rights deletion, derivative purge, and invalidation                                            | 96                           |
| II-EXEC-011D | Slice 11 interruption, exact resume, and incomplete-sibling retry                                       | 97                           |
| II-EXEC-011E | Slice 11 legacy regeneration and immutable-result classification                                        | 98                           |
| II-EXEC-011F | Slice 11 interactive selection, prompting, batch editing, and new-version save                          | 99                           |
| II-EXEC-012  | Slice 12 performance, evaluator/parity closure, rehearsal, real E2E, and human-readiness package        | 59–63                        |
| II-EXEC-013A | Slice 13 independent held-out curator precommit                                                         | 64                           |
| II-EXEC-013B | Slice 13 independent human truth-review commitments                                                     | 82                           |
| II-EXEC-013C | Slice 13 automatic sealed multi-target qualification runner                                             | 83                           |
| II-EXEC-013D | Slice 13 failed-qualification routing, append-only remediation, and rerun                               | 84                           |
| II-EXEC-013E | Slice 13 Machine closure adjudication, remediation dispatch, and pass-only state transition             | 85                           |
| II-EXEC-013F | Slice 13 curator/maintainer precommit adjudication and successor-decision routing                       | 106                          |
| II-EXEC-013G | Slice 13 automatic truth verification, exact Generation System freeze, and interlock                    | 103                          |
| II-EXEC-014A | Slice 14 post-qualification digest-bound review-package generation and validation                       | 81                           |
| II-EXEC-014B | Slice 14 review aggregation, typed temporal rejoin, impact invalidation, remediation, and repeat review | 69, dynamic-remediation      |
| II-EXEC-014C | Slice 14 optional Owner provisional-stop decision without completion claims                             | 86                           |
| II-EXEC-014D | Slice 14 independently scoped exact-artifact reviews                                                    | 65–68, 88–95, 100–101, 104   |
| II-EXEC-014E | Slice 14 Release closure adjudication, remediation dispatch, and pass-only state transition             | 87                           |
| II-EXEC-014F | Slice 14 four-way lyric applicability result and direct nonpass remediation routing                     | 107                          |

## Machine Complete clause coverage

| ID        | Required Machine Complete proof                                                                                                 | Evidence-producing tracer(s)               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| II-MC-001 | One real reference completes acquisition through Reassessment                                                                   | 05–16, 57, 62, 73–80, 85                   |
| II-MC-002 | Legacy IDs, bytes, hashes, and citations migrate or quarantine without invented provenance                                      | 05–10, 85, 98                              |
| II-MC-003 | Unauthorized egress/fixtures/logs/exports/redistribution are blocked; Model Action and Result Commit bind remote work           | 02–06, 20, 68, 71, 85                      |
| II-MC-004 | Every tracked source-derived artifact has provenance and inclusion/redistribution decisions                                     | 03, 08, 14, 68, 73–80, 85, 100             |
| II-MC-005 | Hostile and oversized acquisition, parsing, rendering, parameters, and references fail safely                                   | 02, 11, 59, 70, 73–80, 85, 97, 100         |
| II-MC-006 | Every authority-claiming search records a complete exact Applied Knowledge Manifest                                             | 08, 14–16, 34, 72, 85                      |
| II-MC-007 | Every authority path is inventoried and resolved or mechanically classified                                                     | 08, 14–16, 85                              |
| II-MC-008 | Any omitted eligible pack/dependency/conflict/exclusion/authority/right/path invalidates the manifest                           | 14, 85                                     |
| II-MC-009 | Test-only authority cannot power default or machine-ready output                                                                | 14–16, 47, 52, 56, 73–80, 85, 102, 105–106 |
| II-MC-010 | Maintainer-reviewed nonhistorical defaults can power ordinary output without false historical presentation                      | 16, 43–56, 85, 102, 105–106                |
| II-MC-011 | Source Voice and exact Transposition preserve the principal voice by default                                                    | 23–24, 27, 34–35, 79–80, 85, 100           |
| II-MC-012 | Target Voice/Harmonic/Relationship Plans prevent structural disappearance                                                       | 27–29, 34–35, 53–56, 79–80, 85             |
| II-MC-013 | Lyrics, ties, slurs, and ornaments preserve lineage, notation, and playback                                                     | 25–26, 35, 62, 85                          |
| II-MC-014 | Figured-bass Golden Fixture traverses all canonical contracts and mutations                                                     | 30, 36–39, 75, 85                          |
| II-MC-015 | Imitative Golden Fixture preserves entries and subject relationships without a permanent principal voice                        | 29, 40–41, 85                              |
| II-MC-016 | Mechanics, ergonomics, evidence lanes, preferences, and evaluation stay distinct                                                | 12–16, 22, 31–35, 85                       |
| II-MC-017 | Instrument Instances are authorable/calibratable/versioned; missing evidence cannot default-pass                                | 32, 35, 85                                 |
| II-MC-018 | Immutable known-bad Greensleeves bundles stay failing while separate generative regressions prove old failure and repaired pass | 42–56, 85                                  |
| II-MC-019 | Every target passes two sealed non-Greensleeves groups; Continuo and imitative groups pass                                      | 61, 64, 82–85, 103, 106                    |
| II-MC-020 | Capability Qualifications and UI state exact scopes, exclusions, providers, workload, and unclaimed dimensions                  | 22, 60–64, 82–85, 103, 106                 |
| II-MC-021 | Baroque guitar realizes exact contacts plus orthogonal attack/gesture/alfabeto/allocation/constituent/resonance/damping facets  | 42–47, 73–74, 85                           |
| II-MC-022 | Baroque lute rejects the reach, models whole-hand state and diapasons, and labels course-13 evidence honestly                   | 48–52, 76–78, 85                           |
| II-MC-023 | Three Golden engraving/playback fixtures pass target-specific semantic and sounding checks                                      | 47, 51–52, 56, 60, 83, 85                  |
| II-MC-024 | Classical guitar provides coherent voices, joint-hand state, rests/spanners, and first-class standard notation                  | 53–56, 79–80, 85                           |
| II-MC-025 | Notation and playback agree with canonical pitch, voice, position, constituents, gesture, state, and form                       | 26, 35, 39, 41, 47, 51, 56, 60, 83, 85     |
| II-MC-026 | Generation cannot read evaluator-only expectations, mutations, baselines, labels, or Vault data                                 | 18–20, 35, 61, 71, 83, 85, 103, 106        |
| II-MC-027 | Public repository leaks no resolvable held-out data; Vault lifecycle and exposure ledger pass                                   | 19–21, 61, 63–64, 71, 82–85, 103, 106      |
| II-MC-028 | Every attempt is ledgered; failures persist; reserve state and independently verified roles are inherited                       | 13, 21–22, 61, 64, 82–85, 103, 106         |
| II-MC-029 | Stochastic and opaque-provider qualifications obey precommitted confidence and drift/expiry policy                              | 22, 61, 64, 82–85, 103, 106                |
| II-MC-030 | Hard-gate pass requires every applicable gate complete and passing                                                              | 17, 60–64, 70, 82–85                       |
| II-MC-031 | Acceptance precedence never renders failed, blocked, or incomplete evidence as pass                                             | 17, 60–64, 82–85                           |
| II-MC-032 | Search Measurements and Selection Policy are separate; only passing Adoption Decision selects default                           | 22, 33–34, 72, 85                          |
| II-MC-033 | Search distinguishes found, proven unsat, budget exhausted, cancelled, and infrastructure failed                                | 33, 59, 70, 83, 85, 97                     |
| II-MC-034 | Every pinned performance and applicable build/browser/eval/render/playback/security/migration/real-tool gate passes             | 04, 59–64, 70, 82–85                       |
| II-MC-035 | Real PDF-to-three-target flow resumes exactly, retries only incomplete siblings, and opens selected score                       | 58, 62, 85, 97                             |
| II-MC-036 | Alternatives, conflicts, compromises, activation modes, and unknowns stay visible                                               | 14, 34, 57–58, 62, 85, 99                  |
| II-MC-037 | Complete repository and domain-specific quality gates pass at exact closure commit                                              | 60–64, 70, 83–85                           |

## Release Complete clause coverage

| ID        | Required Release Complete proof                                                                                   | Evidence-producing tracer(s)        |
| --------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| II-RC-001 | Every historical/specialist presentation has current credential-backed scope-appropriate exact-release authority  | 13, 69, 81, 87–92, 101–102          |
| II-RC-002 | Every released target cites a compatible Qualification over its exact Generation System and profile closure       | 65–69, 81, 87                       |
| II-RC-003 | Exact-digest target-player playtests are current for all three targets and pinned contexts                        | 65–67, 69, 81, 87                   |
| II-RC-004 | Each target has a separately qualified idiom review; novice ergonomic evidence is not historical authority        | 69, 81, 87–90                       |
| II-RC-005 | Harpsichord Continuo and imitative outputs have qualified, target-specific musical review                         | 69, 81, 87, 91–92                   |
| II-RC-006 | Claimed sung-text output has qualified underlay review and no-lyrics applicability stays separate from acceptance | 69, 81, 87, 94, 107                 |
| II-RC-007 | Engraving-editor and Owner cross-target usefulness reviews are current                                            | 69, 81, 87, 93, 95                  |
| II-RC-008 | Course-13 historical claims have direct evidence or explicitly make no historical claim                           | 52, 69, 81, 87, 89, 93, 101         |
| II-RC-009 | Every finding repair invalidates and refreshes affected deterministic, held-out, and human evidence               | 69, 81, 84, 87, dynamic-remediation |
| II-RC-010 | No acceptance dimension remains unknown, incomplete, stale, or test-only                                          | 69, 81, 87                          |
| II-RC-011 | Every tracer is tested, committed, and pushed before its dependents                                               | 01–107, dynamic-remediation         |
| II-RC-012 | Source-to-output Voice, Harmonic, Relationship, Transposition, and spanner fidelity review is current             | 69, 87, 104                         |
| II-RC-013 | Exact-package metadata and rights review is current                                                               | 68–69, 87                           |
| II-RC-014 | Consequential source transcription and extraction review is current                                               | 69, 87, 100                         |
| II-RC-015 | Historical claims, packs, profiles, and applicability bindings have current independent review                    | 69, 87, 101                         |

## Explicit guardrails and non-goals

| ID        | Guardrail                                                                             | Enforced by                            |
| --------- | ------------------------------------------------------------------------------------- | -------------------------------------- |
| II-NG-001 | Do not train a model on the Owner library                                             | 02, 18–20, 57, 71, 96                  |
| II-NG-002 | Do not treat model memory, search, OCR/OMR, or frequency as authority                 | 11–16, 36–41, 73–80, 100–101           |
| II-NG-003 | Do not bulk-import BLUEUSB without selection, identity, and deduplication             | 05–11                                  |
| II-NG-004 | Do not couple ingestion to IMSLP or any one repository                                | 05–11, 62                              |
| II-NG-005 | Do not redistribute source material merely because its Work is old                    | 03, 05–06, 11–16, 68, 73–80, 96, 100   |
| II-NG-006 | Do not establish one universal technique for any target                               | 14, 31, 42–56, 73–80, 88–90, 101       |
| II-NG-007 | Do not universalize a source-scoped practice                                          | 12–16, 22, 43–56, 73–80, 88–92, 101    |
| II-NG-008 | Do not generalize from Greensleeves, one method/player/fingering, or one held-out run | 42–56, 60–64, 73–80, 82–90, 101        |
| II-NG-009 | Do not put held-out labels or reserve assets in repository fixtures                   | 19–22, 61–64, 71, 82–84                |
| II-NG-010 | Do not claim total playability from geometry, synthesis, or one evaluator             | 35, 60, 64–69, 82–95, 100–101          |
| II-NG-011 | Do not pass unevaluated performance/notation dimensions because PDF/MIDI compiles     | 35, 39, 41, 47, 51, 56, 60, 83, 85, 93 |
| II-NG-012 | Audio Preview remains a checking tool, not realistic historical-instrument synthesis  | 39, 41, 47, 51, 56, 62, 93             |
| II-NG-013 | Preserve accepted lineage, Preservation Audit, Search, and evaluation architecture    | 01, 09, 15, 17, 34, 72                 |
| II-NG-014 | Never reopen the frozen prior wave as this execution tracker                          | 01                                     |

The nonblocking research questions in the specification remain typed Knowledge/Reassessment questions under tracers 12 and 57. They may create later research tracers, but their unresolved state cannot silently become authority and does not block the common substrate unless an exact selected profile requires the missing claim. Finding-triggered remediation likewise appends tracer IDs after T107; those tracers inherit the affected families, evidence invalidations, regressions, reserve cursor, and temporal generation dependencies recorded by T69, T84, T85, T87, T103, or T106. Their typed `rejoinAt` and `closureTargets` prove a fresh temporal path back to closure rather than changing old static issue definitions or this bootstrap index into a fixed-count checklist.
