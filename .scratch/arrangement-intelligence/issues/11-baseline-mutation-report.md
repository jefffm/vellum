# Baseline comparison, mutation, and safe reporting

Status: complete

Type: AFK

User stories: U6, U9

## What to build

Compare exact Evaluation Runs without freezing one arrangement or allowing a summary score to hide hard failures.

## Acceptance criteria

- [x] Baselines reference exact promoted runs and retain known defects.
- [x] Comparative deltas are separate from absolute results and classify compatibility and materiality.
- [x] At least one mutation proves detection of a known current defect.
- [x] A sanitized report links cards, musical scopes, artifacts, and review needs.

## Completion evidence

- `npm run eval:compare -- --output <directory>` executes the clean first loop and a post-generation Principal Voice omission under the same resolved manifest, promotes the clean Run with every incomplete or unknown dimension disclosed, compares the exact Runs, and persists a sanitized report.
- Baseline promotion accepts only completed Runs, verifies exact Run/Manifest/case records, refuses omitted known defects, and creates a distinct immutable record when superseding a baseline.
- Comparison keeps absolute results and deltas in separate schemas, validates the manifest-pinned policy, classifies exact, migrated, changed-semantic, and incomparable identities, and cannot emit directional claims without authorized compatibility.
- The Principal Voice mutation removes one real score event. The preservation evaluator independently detects missing source coverage and emits a material hard regression; the mutation definition limits the sensitivity claim to that mutation and scope.
- Reports retain typed links to Cards, musical scopes, generated artifacts/Deliverables, known defects, and review needs. Hostile defect markup is escaped and passed through the isolated evaluation-report sanitizer.
- Retained machine-readable verification: `.scratch/arrangement-intelligence/evidence/T11/verification.json`.

## Blocked by

- 10
