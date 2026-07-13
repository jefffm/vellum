# Machine pre-HITL completion audit and evidence package

Status: complete

Type: AFK

User stories: U9

## What to build

Exhaust every machine-verifiable requirement and package exact artifacts and protocols for the deferred human gates.

## Acceptance criteria

- [x] Requirement and audit ledgers contain no unmapped or unverified AFK item.
- [x] Full tests, evaluation suites, rendered checks, and final-commit comparisons pass.
- [x] HITL packages identify exact artifacts, instruments, briefs, protocols, reviewer roles, and stale dependencies.
- [x] Any remaining unknown is proven human-only rather than missing implementation.

## Delivered

- A fail-closed pre-HITL auditor maps all 447 requirements, T01–T39 issue/evidence pairs, and all 47 audit findings. It rejects missing machine implementation, failed/missing tracer evidence, non-complete AFK issues, and unmapped findings while retaining human requirements as `awaiting_scheduled_HITL`.
- The first audit exposed nineteen stale or missing machine rows. Existing lineage, staleness, edit validation, hard-gate, comparison, and model-interruption evidence was reconciled; missing capability, search identity, safe state-merging, applicability-aware Pareto, and real-browser contracts were implemented and tested.
- Search execution identity now records compiler, adapter, evaluators, profiles, capabilities, Knowledge Packs, dependencies, configuration, ordering, pruning, and seed. Capability declarations cannot omit data schema, evaluators, evidence vocabulary, or compatibility.
- Sufficient state merging requires evidence; heuristic merging cannot claim exhaustive completeness. Differential finite-space/property cases retain optima, and an adversarial future-cost counterexample proves the checker catches an unsafe merge.
- A CI-capable Playwright gate launches the coordinated runtime in real headless Chrome, uploads a symbolic source, completes the canonical Guided Start path, and verifies exact Arrangement Score identity, notation, Preservation Audit, and Audio Preview handoff.
- The parity CLI can export persistent review artifacts. T41–T43 now receive pinned LilyPond, SVG, PDF, MIDI, and semantic Audio Preview bytes plus exact hashes, modeled Instrument Instances, Performance Brief, role-scoped protocols, and staleness rules.

## Verification

- `node scripts/pre-hitl-audit.mjs` reports 447 requirements, zero machine gaps, 39 complete AFK tracers, 47 mapped findings, and no failures.
- `npm run test:browser` completes the real-browser source-to-artifact path.
- Package-integrity tests hash all fifteen review artifacts and verify the human-only protocol boundary.
- Full repository, build, evaluation, rendering, and comparison gates are recorded in `evidence/T40/verification.json`.

## Honest limits

- T40 proves machine readiness only. It does not convert target-player, specialist, engraving, recognition, usefulness, baseline, or architecture decisions into machine passes.
- Review artifacts become stale if any declared source, Brief, profile/setup, arrangement bytes, evaluator protocol, or policy dependency changes.
- Proposed ADRs remain unaccepted until T44. The physical target packages remain `awaiting_scheduled_HITL` until T41–T43.

## Blocked by

- 39
