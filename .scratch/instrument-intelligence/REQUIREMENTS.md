# Instrument Intelligence requirement ledger

Status: planned coverage baseline

Authority: [SPEC.md](../../SPEC.md)

This ledger gives every normative specification area, execution step, closure clause, and explicit guardrail a stable public identifier and an owning tracer. Tracer 01 turns this planning inventory into an executable clause-level ledger with requirement digests and stale-evidence detection; it may split a row into smaller stable IDs but may not silently drop or weaken one.

## Evidence contract

- `planned` means an issue exists but no completion claim is made.
- `implemented` requires exact implementation and verification commits, compatible evidence, current dependency digests, and every required gate.
- `blocked`, `incomplete`, `failed`, `stale`, `unknown`, and `not_claimed` are not passes.
- Public evidence belongs under `evidence/TNN/`. Exact held-out identity, truth, mutations, invalidation, reserve selection, and per-attempt diagnostics remain Vault-only.
- Machine Complete and Release Complete are non-compensating. A human review cannot repair a failed machine gate, and a machine score cannot substitute for required human authority.

## Normative section coverage

| ID           | Requirement area                                                                                                                                   | Owner tracer(s)            | Initial status |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------- |
| II-AUTH-001  | Sole-spec authority, reading order, accepted architecture, and historical-document freeze                                                          | 01                         | planned        |
| II-OUT-001   | Source-backed personal-musicologist product outcome without requiring specialist prompts                                                           | 23–41, 42–56, 62           | planned        |
| II-OUT-002   | Coequal baroque-guitar, baroque-lute, and classical-guitar targets                                                                                 | 42–56, 60, 65–67           | planned        |
| II-OUT-003   | Complete source → knowledge → plan → search → evaluation → adoption → learning loop                                                                | 05–62                      | planned        |
| II-BND-001   | Historical, editorial, pedagogical, software, personal, and evaluation authority lanes remain distinct                                             | 12–16, 22, 57, 68          | planned        |
| II-BND-002   | Uncertainty and disagreement are represented rather than erased                                                                                    | 11–16, 23, 57, 68–69       | planned        |
| II-BND-003   | Readiness is tiered by artifact, qualification, and release state                                                                                  | 14, 17, 22, 60–69          | planned        |
| II-BND-004   | Knowledge activation is explicit, scoped, and manifest-bound                                                                                       | 12–16                      | planned        |
| II-BND-005   | Constitutive technique is planned before search and preserved in the score                                                                         | 31, 33–35, 42–56           | planned        |
| II-BND-006   | Packs contain validated declarative knowledge, never executable uploads                                                                            | 12, 14–16                  | planned        |
| II-BND-007   | Old results stay immutable and replayability is classified honestly                                                                                | 07, 09, 15, 17, 57–58      | planned        |
| II-BND-008   | Rights change and deletion traverse complete provenance and derivative graphs                                                                      | 05–06, 57–58               | planned        |
| II-SRC-001   | Durable Work, Manifestation, Exemplar, Digital Asset, acquisition, segment, and role-binding identity graph                                        | 05                         | planned        |
| II-SRC-002   | Rights, access, processing, repository inclusion, redistribution, and provider egress decisions                                                    | 02–06, 10–11               | planned        |
| II-SRC-003   | Untrusted acquisition and parsing fail safely within resource and disclosure bounds                                                                | 02, 11                     | planned        |
| II-SRC-004   | Resumable, versioned Page Atlas with printed/logical page mapping and immutable correction lineage                                                 | 11                         | planned        |
| II-SRC-005   | Modality-specific text, image, notation, OMR/OCR, and manual extraction remains typed and uncertain                                                | 11, 36                     | planned        |
| II-SRC-006   | Every extracted claim and example retains an exact, stable, reviewable citation                                                                    | 11–14                      | planned        |
| II-KNW-001   | Knowledge Candidates preserve axes, evidence, counterevidence, derivations, applicability, and open questions                                      | 12                         | planned        |
| II-KNW-002   | Drafts, immutable releases, attestations, advisories, and successor records are distinct                                                           | 12–13, 57                  | planned        |
| II-KNW-003   | Reviewer identity, credentials, verification, scope, expiry, revocation, and clock policy fail closed                                              | 13                         | planned        |
| II-KNW-004   | Profiles and compiler mappings are typed, declarative, source-bound, and lane-compatible                                                           | 12, 14, 31, 37, 40, 43–56  | planned        |
| II-KNW-005   | Applied Knowledge Manifest is complete over exact Inventory, Catalog, Resolution Policy, Activation Decisions, and Component Registry              | 08, 14–16                  | planned        |
| II-KNW-006   | Authority Path Inventory covers every prompt, default, table, branch, ranker, validator, constant, and label                                       | 08, 14–16                  | planned        |
| II-KNW-007   | Knowledge Reassessment handles corroboration, conflict, supersession, advisory, retraction, rights change, and questions without mutating old work | 57–58                      | planned        |
| II-MUS-001   | Source understanding and preservation obligations precede fingering                                                                                | 23–35                      | planned        |
| II-MUS-002   | Source Voice Graph distinguishes voices from parts/staves and versions ambiguity resolution                                                        | 23                         | planned        |
| II-MUS-003   | Lyric Underlay preserves verses, syllables, elisions, melismas, extenders, anchors, and lineage                                                    | 25, 35, 68                 | planned        |
| II-MUS-004   | Time-varying musical context and part-scoped written-to-sounding Transposition Plan are exact                                                      | 24, 35                     | planned        |
| II-MUS-005   | Canonical ties, slurs, phrase marks, and source ornaments retain notation, lineage, and playback semantics                                         | 26, 35                     | planned        |
| II-MUS-006   | Target Voice Plan records roles, activity/rest spans, continuity, prominence, omissions, and realized mappings                                     | 27, 34–35                  | planned        |
| II-MUS-007   | Target Harmonic Plan records bass, inversion, harmonic rhythm, dissonance, suspension, and cadence obligations                                     | 28, 34–35                  | planned        |
| II-MUS-008   | Target Relationship Plan preserves ordered entries, exchanges, counterpoint, suspension, cadence, and validation profile                           | 29, 34–35                  | planned        |
| II-MUS-009   | Continuo Realization and Disposition Plans distinguish complete, separate-bass, reduction, and rejected outcomes                                   | 30, 36–39, 46              | planned        |
| II-MUS-010   | Intended Technique Plan records applicable resources, transitions, held/damped state, and score consequences                                       | 31, 33–35, 42–56           | planned        |
| II-MUS-011   | Ergonomic context is exact, versioned, and separate from mechanics and historical authority                                                        | 32–35, 42–56               | planned        |
| II-MUS-012   | Owner can author, calibrate, version, select, inspect, and invalidate exact Instrument Instances                                                   | 32                         | planned        |
| II-MUS-013   | Phrase candidate state and work obligations support global reasoning and honest terminal outcomes                                                  | 33                         | planned        |
| II-MUS-014   | Candidate output retains all plans, mappings, lineage, measurements, alternatives, conflicts, and audits                                           | 34                         | planned        |
| II-MUS-015   | Selection is independent from evaluation; only a passing immutable Adoption Decision creates the default score                                     | 17, 22, 34                 | planned        |
| II-BG-001    | Baroque-guitar technique facets are orthogonal rather than a single mislabeled mode                                                                | 31, 43–45                  | planned        |
| II-BG-002    | Exact five-course configuration, constituent strings, tuning, masks, and geometry drive realization                                                | 32, 42–47                  | planned        |
| II-BG-003    | Punteado uses profile-scoped right-hand allocation and exact two-dimensional contacts/transitions                                                  | 42–43                      | planned        |
| II-BG-004    | Rasgueado and alfabeto preserve chart identity, ordered strokes, masks, attacks, resonance, and damping                                            | 44                         | planned        |
| II-BG-005    | Mixed style preserves transitions, held harmony, releases, voice prominence, and meaningful alternatives                                           | 45                         | planned        |
| II-BG-006    | Baroque-guitar Continuo never claims a complete foundation when only reduction or separate bass is valid                                           | 46                         | planned        |
| II-BG-007    | Baroque-guitar acceptance covers playability, idiom, recognition, engraving, playback, and authority                                               | 42–47, 60, 64–65           | planned        |
| II-BL-001    | Exact thirteen-course configuration separates stopped courses, diapasons, Bass Tuning, and editorial signs                                         | 32, 48–52                  | planned        |
| II-BL-002    | Joint left-hand search uses calibrated two-dimensional geometry and whole-phrase transitions                                                       | 48–49                      | planned        |
| II-BL-003    | Right-hand state covers digit allocation, preparation, simultaneity, alternation, crossing, thumb, and damping                                     | 48, 50                     | planned        |
| II-BL-004    | Diapason access uses calibrated plucking-zone/course/bass-rider geometry and explicit transitions                                                  | 50–51                      | planned        |
| II-BL-005    | French tablature and playback preserve `a`, `/a`, `//a`, `///a`, `4`, `5`, course identity, and no duplicates                                      | 51                         | planned        |
| II-BL-006    | Baroque-lute acceptance and course-13 claims remain profile-scoped and evidence-honest                                                             | 48–52, 60, 64, 66          | planned        |
| II-CG-001    | Exact six-string configuration and performer context keep mechanics distinct from ergonomics                                                       | 32, 53–56                  | planned        |
| II-CG-002    | Joint left/right-hand realization preserves linked polyphonic state across phrases                                                                 | 53–55                      | planned        |
| II-CG-003    | Target Voice Plan is mandatory; event count and continuous sound cannot proxy voice coherence                                                      | 27–29, 53–56               | planned        |
| II-CG-004    | Polyphonic search preserves bass/function/cadence, planned rests, crossings, ties, and alternatives                                                | 53–55                      | planned        |
| II-CG-005    | First-class standard notation and isolated playback retain written/sounding identity and hidden fingering evidence                                 | 55–56                      | planned        |
| II-CG-006    | Classical-guitar acceptance covers coherent voices, mechanics, notation, playback, and scoped idiom                                                | 53–56, 60, 64, 67          | planned        |
| II-EVAL-001  | Evaluation layers and observable dimensions stay independent and do not collapse into one score                                                    | 17, 22, 35, 60             | planned        |
| II-EVAL-002  | Generation and evaluation are separate processes and capabilities                                                                                  | 18–20                      | planned        |
| II-EVAL-003  | Hard-gate tri-state and acceptance four-state semantics use the specified precedence                                                               | 17                         | planned        |
| II-EVAL-004  | Dataset assignments use Generation-System-scoped contamination groups and split manifests                                                          | 21–22                      | planned        |
| II-EVAL-005  | Append-only attempt ledgers enforce genesis, CAS head, fork detection, invalidation, permanent regressions, and reserve inheritance                | 21, 61, 64                 | planned        |
| II-EVAL-006  | Deterministic, stochastic, and opaque-provider qualification policies are pinned and honestly expire                                               | 22, 61, 64                 | planned        |
| II-EVAL-007  | Required mutations are evaluator-only and independently kill every named semantic failure                                                          | 35, 39, 41, 42, 48, 53, 60 | planned        |
| II-EVAL-008  | Three coequal Golden engraving/playback fixtures verify semantic, rendered, and sounding identity                                                  | 47, 51–52, 56, 60          | planned        |
| II-EVAL-009  | Regression contracts are content-addressed and compatible only over exact system/evaluator identities                                              | 21–22, 60–64               | planned        |
| II-EVAL-010  | Development regressions and held-out acceptance remain separate, with no public truth leakage                                                      | 20–22, 61, 63–64           | planned        |
| II-LEARN-001 | Feedback and state create typed, reviewable Personal Default, Ergonomic, Knowledge, Calibration, and fixture proposals only                        | 57–58                      | planned        |
| II-UX-001    | Guided Start begins with source upload/acquisition and output-format choices, then reveals relevant controls                                       | 62                         | planned        |
| II-UX-002    | Default arrangement view supports selection, prompting, manual batch edits, versioning, playback following, and alternatives                       | 34, 58, 62                 | planned        |
| II-UX-003    | Expert disclosure exposes plans, evidence, assumptions, manifests, alternatives, conflicts, and unknowns                                           | 14, 34, 57–58, 62          | planned        |
| II-UX-004    | Knowledge Workbench supports sources, candidates, review, activation, diff, reassessment, deletion, and affected-workspace navigation              | 10–16, 57–58               | planned        |
| II-SEED-001  | Baroque-guitar seed program uses rights-reviewed primary sources and never a universal chart by assertion                                          | 03, 12–16, 43–47           | planned        |
| II-SEED-002  | Baroque-lute seed program uses Mace plus scoped normative/repertoire evidence                                                                      | 11–16, 49–52               | planned        |
| II-SEED-003  | Classical-guitar seed program uses scoped Sor and aligned Carulli evidence                                                                         | 12–16, 54–56               | planned        |
| II-SEED-004  | Italian keyboard Continuo seed program uses Gasparini and a legally usable Golden Fixture                                                          | 36–39                      | planned        |
| II-SEED-005  | Development fixtures are rights-cleared, content-addressed, and never confused with held-out evidence                                              | 03, 20–22, 35, 60–64       | planned        |
| II-OPS-001   | Versioned release-floor workloads, hardware classes, metrics, limits, cancellation, checkpoint, and resume gates are mandatory                     | 04, 33, 59, 61–64          | planned        |

## Execution-step coverage

| ID           | SPEC execution obligation                                                                            | Owner tracer(s) |
| ------------ | ---------------------------------------------------------------------------------------------------- | --------------- |
| II-EXEC-000  | Slice 0 specification, security, rights, evaluator-canary, and baseline guard                        | 01–04, 17–20    |
| II-EXEC-001A | Slice 1 versioned identity and shared asset/provenance graph                                         | 05–06           |
| II-EXEC-001B | Slice 1 publication store, authority inventory, migration, rollback, quarantine, and Workbench proof | 07–10           |
| II-EXEC-002  | Slice 2 Mace upload/acquisition through safe cited browser segment                                   | 11              |
| II-EXEC-003A | Slice 3 evidence, release, reviewer authority, profile, and mapping contracts                        | 12–13           |
| II-EXEC-003B | Slice 3 exact inventory/catalog/manifest and provisional consequence                                 | 14              |
| II-EXEC-003C | Slice 3 atomic resolver cutover and honest nonhistorical default                                     | 15–16           |
| II-EXEC-004A | Slice 4 legacy Card/status migration and sealed evaluator boundary                                   | 17–18           |
| II-EXEC-004B | Slice 4 Vault, public split, attempt ledger, qualification policies, and evaluator mutations         | 19–22, 35       |
| II-EXEC-005A | Slice 5 Source Voice, text, context, transposition, and spanners                                     | 23–26           |
| II-EXEC-005B | Slice 5 target voice, harmony, relationships, Continuo, technique, and Instrument Instance           | 27–32           |
| II-EXEC-005C | Slice 5 phrase search, candidate mapping, independent evaluation, and adoption                       | 33–35           |
| II-EXEC-006A | Slice 6 optical/reviewed canonical figured-bass truth                                                | 36              |
| II-EXEC-006B | Slice 6 source-backed cembalo realization and disposition branches                                   | 37–38           |
| II-EXEC-006C | Slice 6 mutation and development acceptance                                                          | 39              |
| II-EXEC-007A | Slice 7 imitative Golden realization                                                                 | 40              |
| II-EXEC-007B | Slice 7 independent imitative mutations and acceptance                                               | 41              |
| II-EXEC-008A | Slice 8.1 preserve and reject known-bad baroque-guitar output                                        | 42              |
| II-EXEC-008B | Slice 8.2 source-backed punteado, rasgueado, alfabeto, and mixed-style repair                        | 43–45           |
| II-EXEC-008C | Slice 8.3 honest baroque-guitar Continuo disposition                                                 | 46              |
| II-EXEC-008D | Slice 8.4 development Regression Bundle and Golden fixture                                           | 47              |
| II-EXEC-009A | Slice 9.1 preserve and reject known-bad baroque-lute output                                          | 48              |
| II-EXEC-009B | Slice 9.2 source-backed calibrated left/right-hand and diapason repair                               | 49–50           |
| II-EXEC-009C | Slice 9.3 Golden engraving and playback semantics                                                    | 51              |
| II-EXEC-009D | Slice 9.4 development Regression Bundle and course-13 claim policy                                   | 52              |
| II-EXEC-010A | Slice 10.1 preserve and reject disappearing-bass output                                              | 53              |
| II-EXEC-010B | Slice 10.2 source-backed coherent reduction and joint-hand notation repair                           | 54–55           |
| II-EXEC-010C | Slice 10.3 development Regression Bundle and Golden fixture                                          | 56              |
| II-EXEC-011  | Slice 11 reassessment, reviewed learning, deletion, recovery, and regeneration                       | 57–58           |
| II-EXEC-012  | Slice 12 performance, evaluator/parity closure, rehearsal, real E2E, and human-readiness package     | 59–63           |
| II-EXEC-013  | Slice 13 independent curation, truth review, freeze, sealed qualification, and Machine Complete      | 64              |
| II-EXEC-014A | Slice 14 exact-artifact role-scoped reviews                                                          | 65–68           |
| II-EXEC-014B | Slice 14 impact invalidation, remediation, repeat review, and honest closure                         | 69              |

## Machine Complete clause coverage

| ID        | Required Machine Complete proof                                                                                                | Owner tracer(s)                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| II-MC-001 | One real reference completes acquisition through Reassessment                                                                  | 05–16, 57, 62                  |
| II-MC-002 | Legacy IDs, bytes, hashes, and citations migrate or quarantine without invented provenance                                     | 05–10                          |
| II-MC-003 | Unauthorized egress/fixtures/logs/exports/redistribution are blocked; Model Action and Result Commit bind remote work          | 02–06, 20                      |
| II-MC-004 | Every tracked source-derived artifact has provenance and inclusion/redistribution decisions                                    | 03, 08, 14                     |
| II-MC-005 | Hostile and oversized acquisition, parsing, rendering, parameters, and references fail safely                                  | 02, 11, 59                     |
| II-MC-006 | Every authority-claiming search records a complete exact Applied Knowledge Manifest                                            | 08, 14–16, 34                  |
| II-MC-007 | Every authority path is inventoried and resolved or mechanically classified                                                    | 08, 14–16                      |
| II-MC-008 | Any omitted eligible pack/dependency/conflict/exclusion/authority/right/path invalidates the manifest                          | 14                             |
| II-MC-009 | Test-only authority cannot power default or machine-ready output                                                               | 14–16, 47, 52, 56              |
| II-MC-010 | Maintainer-reviewed nonhistorical defaults can power ordinary output without false historical presentation                     | 16, 43–56                      |
| II-MC-011 | Source Voice and exact Transposition preserve the principal voice by default                                                   | 23–24, 27, 34–35               |
| II-MC-012 | Target Voice/Harmonic/Relationship Plans prevent structural disappearance                                                      | 27–29, 34–35, 53–56            |
| II-MC-013 | Lyrics, ties, slurs, and ornaments preserve lineage, notation, and playback                                                    | 25–26, 35, 62                  |
| II-MC-014 | Figured-bass Golden Fixture traverses all canonical contracts and mutations                                                    | 30, 36–39                      |
| II-MC-015 | Imitative Golden Fixture preserves entries and subject relationships without a permanent principal voice                       | 29, 40–41                      |
| II-MC-016 | Mechanics, ergonomics, evidence lanes, preferences, and evaluation stay distinct                                               | 12–16, 22, 31–35               |
| II-MC-017 | Instrument Instances are authorable/calibratable/versioned; missing evidence cannot default-pass                               | 32, 35                         |
| II-MC-018 | All three exact Greensleeves regressions fail before repair and pass afterward                                                 | 42–56                          |
| II-MC-019 | Every target passes two sealed non-Greensleeves groups; Continuo and imitative groups pass                                     | 61, 64                         |
| II-MC-020 | Capability Qualifications and UI state exact scopes, exclusions, providers, workload, and unclaimed dimensions                 | 22, 60–64                      |
| II-MC-021 | Baroque guitar realizes exact contacts plus orthogonal attack/gesture/alfabeto/allocation/constituent/resonance/damping facets | 42–47                          |
| II-MC-022 | Baroque lute rejects the reach, models whole-hand state and diapasons, and labels course-13 evidence honestly                  | 48–52                          |
| II-MC-023 | Three Golden engraving/playback fixtures pass target-specific semantic and sounding checks                                     | 47, 51–52, 56, 60              |
| II-MC-024 | Classical guitar provides coherent voices, joint-hand state, rests/spanners, and first-class standard notation                 | 53–56                          |
| II-MC-025 | Notation and playback agree with canonical pitch, voice, position, constituents, gesture, state, and form                      | 26, 35, 39, 41, 47, 51, 56, 60 |
| II-MC-026 | Generation cannot read evaluator-only expectations, mutations, baselines, labels, or Vault data                                | 18–20, 35, 61                  |
| II-MC-027 | Public repository leaks no resolvable held-out data; Vault lifecycle and exposure ledger pass                                  | 19–21, 61, 63–64               |
| II-MC-028 | Every attempt is ledgered; failures persist; reserve state and independently verified roles are inherited                      | 13, 21–22, 61, 64              |
| II-MC-029 | Stochastic and opaque-provider qualifications obey precommitted confidence and drift/expiry policy                             | 22, 61, 64                     |
| II-MC-030 | Hard-gate pass requires every applicable gate complete and passing                                                             | 17, 60–64                      |
| II-MC-031 | Acceptance precedence never renders failed, blocked, or incomplete evidence as pass                                            | 17, 60–64                      |
| II-MC-032 | Search Measurements and Selection Policy are separate; only passing Adoption Decision selects default                          | 22, 33–34                      |
| II-MC-033 | Search distinguishes found, proven unsat, budget exhausted, cancelled, and infrastructure failed                               | 33, 59                         |
| II-MC-034 | Every pinned performance and applicable build/browser/eval/render/playback/security/migration/real-tool gate passes            | 04, 59–64                      |
| II-MC-035 | Real PDF-to-three-target flow resumes exactly, retries only incomplete siblings, and opens selected score                      | 58, 62                         |
| II-MC-036 | Alternatives, conflicts, compromises, activation modes, and unknowns stay visible                                              | 14, 34, 57–58, 62              |
| II-MC-037 | Complete repository and domain-specific quality gates pass at exact closure commit                                             | 60–64                          |

## Release Complete clause coverage

| ID        | Required Release Complete proof                                                                                  | Owner tracer(s) |
| --------- | ---------------------------------------------------------------------------------------------------------------- | --------------- |
| II-RC-001 | Every historical/specialist presentation has current credential-backed scope-appropriate exact-release authority | 13, 65–69       |
| II-RC-002 | Every released target cites a compatible Qualification over its exact Generation System and profile closure      | 64–69           |
| II-RC-003 | Exact-digest target-player playtests are current for all three targets and pinned contexts                       | 65–67           |
| II-RC-004 | Each target has a separately qualified idiom review; novice ergonomic evidence is not historical authority       | 65–67           |
| II-RC-005 | Harpsichord Continuo and imitative outputs have qualified, target-specific musical review                        | 68              |
| II-RC-006 | Claimed sung-text output has qualified underlay review                                                           | 68              |
| II-RC-007 | Engraving-editor and Owner cross-target usefulness reviews are current                                           | 65–68           |
| II-RC-008 | Course-13 historical claims have direct evidence or explicitly make no historical claim                          | 52, 66, 68      |
| II-RC-009 | Every finding repair invalidates and refreshes affected deterministic, held-out, and human evidence              | 69              |
| II-RC-010 | No acceptance dimension remains unknown, incomplete, stale, or test-only                                         | 69              |
| II-RC-011 | Every tracer is tested, committed, and pushed before its dependents                                              | 01–69           |

## Explicit guardrails and non-goals

| ID        | Guardrail                                                                             | Enforced by                |
| --------- | ------------------------------------------------------------------------------------- | -------------------------- |
| II-NG-001 | Do not train a model on the Owner library                                             | 02, 18–20, 57              |
| II-NG-002 | Do not treat model memory, search, OCR/OMR, or frequency as authority                 | 11–16, 36–41               |
| II-NG-003 | Do not bulk-import BLUEUSB without selection, identity, and deduplication             | 05–11                      |
| II-NG-004 | Do not couple ingestion to IMSLP or any one repository                                | 05–11, 62                  |
| II-NG-005 | Do not redistribute source material merely because its Work is old                    | 03, 05–06, 11–16           |
| II-NG-006 | Do not establish one universal technique for any target                               | 14, 31, 42–56              |
| II-NG-007 | Do not universalize a source-scoped practice                                          | 12–16, 22, 43–56           |
| II-NG-008 | Do not generalize from Greensleeves, one method/player/fingering, or one held-out run | 42–56, 60–64               |
| II-NG-009 | Do not put held-out labels or reserve assets in repository fixtures                   | 19–22, 61–64               |
| II-NG-010 | Do not claim total playability from geometry, synthesis, or one evaluator             | 35, 60, 64–69              |
| II-NG-011 | Do not pass unevaluated performance/notation dimensions because PDF/MIDI compiles     | 35, 39, 41, 47, 51, 56, 60 |
| II-NG-012 | Audio Preview remains a checking tool, not realistic historical-instrument synthesis  | 39, 41, 47, 51, 56, 62     |
| II-NG-013 | Preserve accepted lineage, Preservation Audit, Search, and evaluation architecture    | 01, 09, 15, 17, 34         |
| II-NG-014 | Never reopen the frozen prior wave as this execution tracker                          | 01                         |

The nonblocking research questions in the specification remain typed Knowledge/Reassessment questions under tracers 12 and 57. They may create later research tracers, but their unresolved state cannot silently become authority and does not block the common substrate unless an exact selected profile requires the missing claim.
