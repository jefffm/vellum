# Versioned Evaluation Harness core

Status: complete

Type: AFK

User stories: U6, U9

## What to build

Create the persistent Evaluation Harness spine with isolated end-to-end and component cases and immutable resolved execution manifests.

## Acceptance criteria

- [x] End-to-end cases begin from source and briefs; component cases pin reviewed inputs.
- [x] Resolved manifests pin all transitive case, expectation, evaluator, mutation, profile, fixture, and protocol digests.
- [x] Absolute results separate applicability, execution, outcome, evidence, authority, and presentation.
- [x] A machine-readable command produces an Evaluation Run and Card for the first loop.

## Completion evidence

- `npm run eval:fast -- --output <directory>` executes the production restricted-LilyPond source importer, Analysis, minimal planning, search, and selected-score path from the source plus Arrangement and Performance Brief fixtures.
- Evaluation records persist under a separate local evaluation root. Manifests, case runs, Cards, and append-only Run state snapshots are mode `0600`; completed files become visible through an atomic hard-link commit and cannot be replaced with different bytes.
- The first resolved manifest pins the suite, case, four expectation sets, declared mutation, source fixture, both briefs, evaluator, adapter, target profile, comparison policy, report profile, human protocol, and execution identity. Tampering with a transitive evaluator definition creates a different manifest while the old bytes remain unchanged.
- The first command Run reports source, preservation, and Plan hard gates separately; modeled mechanics are partial evidence; historical Analysis is non-authoritative observation; engraving, playback, human/physical evidence, and Owner usefulness remain explicitly unknown when unevaluated; workflow completion does not claim the broader recovery protocol.
- Retained machine-readable verification: `.scratch/arrangement-intelligence/evidence/T10/verification.json`.

## Blocked by

- 01
- 03
- 07
- 09
