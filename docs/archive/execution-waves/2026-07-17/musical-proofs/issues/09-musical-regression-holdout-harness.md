# 09 — Musical regression and holdout harness

Status: completed

Type: AFK

Blocked by: 06, 07, 08

## What to build

Consolidate the three proofs into a small, fast evaluation harness with separate observable
musical dimensions. Add a simple untracked Owner-local holdout manifest and attempt log without
building a sealed evaluator or qualification system.

## Acceptance criteria

- [x] Public fixtures cover shared voice fidelity, each target idiom, continuo, and imitative polyphony.
- [x] Greensleeves remains a regression but is not the primary corpus.
- [x] Measures report source fidelity, phrase/cadence, subordinate continuity, mechanics, idiom, notation, and playback separately.
- [x] Hard failures cannot be averaged into a pass; blocked and incomplete remain distinct.
- [x] Each claimed dimension has at least one mutation that should fail it.
- [x] A documented local command evaluates private holdouts without logging their source identity or truth to tracked files.
- [x] The ordinary development suite remains reasonably fast and actionable.

## Completion note

`npm run proof:musical` runs the existing public musical proofs once and reports seven independent
dimensions with explicit mutation coverage. Old 100th is the primary three-target source;
Greensleeves is a secondary regression, with separate continuo and imitative cases. A failing
dimension is never averaged away. `npm run proof:holdout` evaluates an Owner-local manifest outside
the repository and writes only opaque case IDs, statuses, and generic finding codes to its local
attempt log. The focused public proof completes in a few seconds, while the full repository suite
remains unchanged apart from one privacy test.

## Gates

Base gates plus all affected `eval:*` suites and privacy-focused tests.
