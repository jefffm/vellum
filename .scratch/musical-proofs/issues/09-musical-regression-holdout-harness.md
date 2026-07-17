# 09 — Musical regression and holdout harness

Status: ready-for-agent

Type: AFK

Blocked by: 06, 07, 08

## What to build

Consolidate the three proofs into a small, fast evaluation harness with separate observable
musical dimensions. Add a simple untracked Owner-local holdout manifest and attempt log without
building a sealed evaluator or qualification system.

## Acceptance criteria

- [ ] Public fixtures cover shared voice fidelity, each target idiom, continuo, and imitative polyphony.
- [ ] Greensleeves remains a regression but is not the primary corpus.
- [ ] Measures report source fidelity, phrase/cadence, subordinate continuity, mechanics, idiom, notation, and playback separately.
- [ ] Hard failures cannot be averaged into a pass; blocked and incomplete remain distinct.
- [ ] Each claimed dimension has at least one mutation that should fail it.
- [ ] A documented local command evaluates private holdouts without logging their source identity or truth to tracked files.
- [ ] The ordinary development suite remains reasonably fast and actionable.

## Gates

Base gates plus all affected `eval:*` suites and privacy-focused tests.
