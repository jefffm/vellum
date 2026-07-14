# Instrument Intelligence execution plan

Status: ready-for-agent

Authority: [SPEC.md](../../SPEC.md)

## Outcome

Deliver Vellum's complete source-backed instrument-intelligence loop: safe reference ingestion, reviewed and explicitly activated knowledge, voice- and relationship-aware phrase planning, coequal idiomatic compilers for five-course baroque guitar, thirteen-course baroque lute, and six-string classical guitar, independent evaluation, reviewed learning, and honestly scoped Machine Complete and Release Complete states.

## Goal judge

This wave is Release Complete only when:

- every requirement in [REQUIREMENTS.md](REQUIREMENTS.md) has current, compatible evidence over the exact implementation and artifact digests;
- every AFK tracer and applicable base, browser, evaluation, rendering, playback, security, migration, rights, provider, performance, and real-tool gate passes;
- the sealed non-Greensleeves qualification succeeds without exposing evaluator-only material to generation or development;
- all exact-artifact, role-scoped human reviews required by the selected profiles are current;
- no required acceptance dimension is failed, blocked, incomplete, unknown, stale, or supported only by test-only knowledge; and
- every tracer is committed and pushed to `main` before a dependent tracer starts.

Machine Complete is an explicit provisional state, not an alias for complete. It may be reported only after tracer 64 succeeds; it does not satisfy Release Complete while tracers 65–69 remain open.

## User stories

- **U1 — Trusted references:** ingest a selected PDF or local source with durable identity, rights, provenance, citations, and safe processing.
- **U2 — Reviewed knowledge:** extract, review, version, activate, inspect, reassess, and retire source-backed instrument knowledge without conflating evidence lanes.
- **U3 — Musical understanding:** preserve source voices, harmony, relationships, figures, text, context, and phrase obligations before choosing fingerings.
- **U4 — Baroque guitar:** produce playable, idiomatic punteado, rasgueado, alfabeto, or mixed-style output with truthful continuo disposition.
- **U5 — Baroque lute:** produce playable thirteen-course output with calibrated left/right-hand mechanics, diapasons, and correct French tablature/playback identity.
- **U6 — Classical guitar:** produce coherent multi-voice standard notation and playback with joint left/right-hand realization.
- **U7 — Cross-domain intelligence:** realize continuo and imitative counterpoint through the same contracts without flattening their distinct musical relationships.
- **U8 — Independent evaluation:** grade generation outside its visibility, preserve failures, and make narrow, reproducible qualification claims.
- **U9 — Guided ownership:** guide upload-to-output, expose expert detail, support manual adoption and recovery, and turn feedback into reviewable proposals rather than hidden learning.
- **U10 — Auditable release:** remain secure, rights-safe, performant, resumable, reviewable, and honest about uncertainty and authority.

## Tracer queue

|  ID | Tracer                                                       | Type | Blocked by                     | Stories            |
| --: | ------------------------------------------------------------ | ---- | ------------------------------ | ------------------ |
|  01 | Governing contract and baseline guard                        | AFK  | —                              | U10                |
|  02 | Server-minted provider boundary                              | AFK  | 01                             | U1, U10            |
|  03 | Rights-safe tracked-source quarantine                        | AFK  | 01                             | U1, U2, U10        |
|  04 | Release-floor profile and gate matrix                        | AFK  | 01                             | U10                |
|  05 | Versioned source identity and rights graph                   | AFK  | 01, 03                         | U1, U2             |
|  06 | Shared assets, acquisition provenance, and deletion          | AFK  | 05                             | U1, U2, U10        |
|  07 | Transactional publication generations                        | AFK  | 01                             | U2, U10            |
|  08 | Authority-path inventory and shadow resolver                 | AFK  | 03, 07                         | U2, U10            |
|  09 | Transactional OwnerReference migration and quarantine        | AFK  | 05–08                          | U1, U2, U10        |
|  10 | Migrated-private defaults and Workbench proof                | AFK  | 02, 09                         | U1, U2, U9         |
|  11 | Mace Page Atlas and cited-segment browser path               | AFK  | 02, 06, 10                     | U1, U2, U9         |
|  12 | Typed knowledge evidence and immutable release               | AFK  | 07, 11                         | U2                 |
|  13 | Reviewer credential, scope, expiry, and revocation authority | AFK  | 12                             | U2, U10            |
|  14 | Complete catalog, manifest, and provisional consequence      | AFK  | 08, 12, 13                     | U2, U9, U10        |
|  15 | Transactional resolver cutover                               | AFK  | 09, 14                         | U2, U10            |
|  16 | Honest nonhistorical default and test-only isolation         | AFK  | 15                             | U2, U9, U10        |
|  17 | Evaluation status and comparison migration                   | AFK  | 01, 07                         | U8, U10            |
|  18 | Sealed evaluator process boundary                            | AFK  | 02, 17                         | U8, U10            |
|  19 | Encrypted Evaluation Vault lifecycle                         | AFK  | 07, 18                         | U8, U10            |
|  20 | Public/Vault split and repository leak enforcement           | AFK  | 19                             | U8, U10            |
|  21 | Split manifests, attempt ledger, and inherited regressions   | AFK  | 17, 19, 20                     | U8, U10            |
|  22 | Qualification scopes, roles, and provider policy             | AFK  | 13, 21                         | U8, U10            |
|  23 | Source Voice Graph vertical                                  | AFK  | 10, 17                         | U3                 |
|  24 | Time-varying context and exact Transposition vertical        | AFK  | 23                             | U3                 |
|  25 | Lyric Underlay vertical                                      | AFK  | 23                             | U3                 |
|  26 | Canonical spanner and ornament vertical                      | AFK  | 23, 24                         | U3                 |
|  27 | Target Voice Plan vertical                                   | AFK  | 23, 24                         | U3                 |
|  28 | Target Harmonic Plan vertical                                | AFK  | 27                             | U3                 |
|  29 | Target Relationship Plan vertical                            | AFK  | 27, 28                         | U3, U7             |
|  30 | Continuo Plan and Disposition contract                       | AFK  | 29                             | U3, U7             |
|  31 | Intended Technique Plan vertical                             | AFK  | 29                             | U3–U6              |
|  32 | Instrument Instance calibration and Workbench path           | AFK  | 10, 23                         | U4–U6, U9          |
|  33 | Phrase- and work-level bounded search                        | AFK  | 27–32                          | U3–U6              |
|  34 | Candidate mapping and gated Adoption Decision                | AFK  | 17, 22, 33                     | U3–U6, U8          |
|  35 | Independent observable evaluator contracts                   | AFK  | 20, 22, 24–31, 34              | U3, U8, U10        |
|  36 | Optical figured-bass truth vertical                          | AFK  | 11, 25, 26, 30, 35             | U3, U7             |
|  37 | Source-backed cembalo realization                            | AFK  | 14, 34, 36                     | U3, U7             |
|  38 | Honest Continuo disposition branches                         | AFK  | 30, 37                         | U3, U7             |
|  39 | Continuo mutation and development acceptance                 | AFK  | 35, 38                         | U3, U7, U8         |
|  40 | Three-voice imitative Golden vertical                        | AFK  | 14, 29, 34, 35                 | U3, U7             |
|  41 | Imitative mutation and development acceptance                | AFK  | 35, 40                         | U3, U7, U8         |
|  42 | Baroque-guitar known-bad rejection                           | AFK  | 32, 34, 35                     | U4, U8             |
|  43 | Exact punteado repair                                        | AFK  | 14, 42                         | U2, U4             |
|  44 | Rasgueado, alfabeto, and constituent-string vertical         | AFK  | 43                             | U2, U4             |
|  45 | Mixed-style phrase vertical                                  | AFK  | 44                             | U4                 |
|  46 | Honest baroque-guitar Continuo disposition                   | AFK  | 38, 45                         | U4, U7             |
|  47 | Baroque-guitar development acceptance                        | AFK  | 35, 46                         | U4, U8             |
|  48 | Baroque-lute known-bad rejection                             | AFK  | 32, 34, 35                     | U5, U8             |
|  49 | Calibrated baroque-lute left-hand repair                     | AFK  | 11, 14, 48                     | U2, U5             |
|  50 | Whole-instrument right hand and diapasons                    | AFK  | 49                             | U5                 |
|  51 | Baroque-lute Golden engraving and playback                   | AFK  | 35, 50                         | U5, U8             |
|  52 | Baroque-lute development acceptance and course-13 claims     | AFK  | 51                             | U5, U8             |
|  53 | Classical-guitar known-bad rejection                         | AFK  | 32, 34, 35                     | U6, U8             |
|  54 | Coherent classical voice and harmonic reduction              | AFK  | 14, 29, 53                     | U2, U6             |
|  55 | Joint-hand standard-notation vertical                        | AFK  | 54                             | U6                 |
|  56 | Classical-guitar development acceptance                      | AFK  | 35, 55                         | U6, U8             |
|  57 | Reassessment and governed learning proposals                 | AFK  | 15, 16, 21, 34, 47, 52, 56     | U2, U8, U9         |
|  58 | Workbench advisory, deletion, resume, and regeneration       | AFK  | 06, 10, 57                     | U1, U2, U9         |
|  59 | Search and release-floor performance acceptance              | AFK  | 04, 33, 39, 41, 47, 52, 56     | U8, U10            |
|  60 | Cross-domain evaluator and parity closure                    | AFK  | 21, 22, 39, 41, 47, 52, 56     | U3–U8              |
|  61 | Synthetic sealed-qualification drill                         | AFK  | 21, 22, 59, 60                 | U8, U10            |
|  62 | Real PDF-to-three-target Guided Start E2E                    | AFK  | 47, 52, 56, 58–60              | U1, U4–U6, U9      |
|  63 | Pre-HITL audit, Vault curation package, and interlock        | AFK  | 15, 16, 20, 39, 41, 58, 61, 62 | U8–U10             |
|  64 | Independent curation, truth review, and sealed qualification | HITL | 63                             | U4–U8, U10         |
|  65 | Baroque-guitar exact-artifact review                         | HITL | 64                             | U4, U8, U10        |
|  66 | Baroque-lute exact-artifact review                           | HITL | 64                             | U5, U8, U10        |
|  67 | Classical-guitar exact-artifact review                       | HITL | 64                             | U6, U8, U10        |
|  68 | Cross-domain, editorial, and Owner review                    | HITL | 64                             | U1–U3, U7, U9, U10 |
|  69 | Release remediation loop and closure                         | HITL | 65–68                          | U1–U10             |

## Safe concurrency

- After 01, 02, 03, 04, and 07 can progress independently.
- Source migration work (05–11) and evaluation-contract work (17–22) may overlap once their stated blockers land.
- Continuo (36–39), imitative counterpoint (40–41), and the three target red cases (42, 48, 53) may progress independently after shared contracts.
- Baroque-guitar, baroque-lute, and classical-guitar repair chains are coequal siblings. None is a prerequisite for another.
- Human reviews 65–68 may run in parallel only after 64 produces digest-bound packages.

## Execution rules

1. Begin every tracer with its named failing output- or contract-level case.
2. Cross every applicable persistence, service, API, Workbench/UI, render/playback, and evaluator boundary; do not land horizontal infrastructure with no demoable Owner outcome.
3. Record focused evidence under `evidence/TNN/verification.json` and referenced redacted artifacts.
4. Run the base gates from `AGENTS.md` plus every conditional gate in the issue.
5. Commit and push the completed tracer to `main` before a dependent tracer starts.
6. Do not weaken an accepted invariant, evaluator, mutation, or regression to obtain a pass.
7. A sealed valid failure becomes a permanent disclosed regression; repairs consume only the next precommitted reserve group.
8. A human finding creates a new AFK remediation tracer at the earliest affected slice and invalidates all dependent evidence before review resumes.
9. Serialize shared real-tool gates that contend for Podman, Audiveris, fixed ports, or mutable local stores even when implementation tracers run in parallel. Never remove a gate lock until its owning process is proven absent; record any orphan cleanup and rerun the affected gate from a clean state.

## Late human boundary

Tracers 01–63 exhaust machine-executable work and create exact-digest review packages. Tracer 64 is the first human boundary. The curator and truth reviewers make independent pre-output commitments; the sealed runner then proceeds automatically. Tracers 65–68 gather role-scoped evidence over unchanged bytes. Tracer 69 either establishes Release Complete or records an explicit provisional stopping state without relabeling missing evidence as a pass.
