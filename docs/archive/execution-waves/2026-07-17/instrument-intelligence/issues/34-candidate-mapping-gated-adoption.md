# Candidate mapping and gated Adoption Decision

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3, U4, U5, U6

SPEC coverage: Candidate output; search selection/evaluation; Slice 5

Requirement families touched: II-MUS-014–015, II-EXEC-005C, II-MC-032, II-UX-002–003

## What to build

Persist complete candidate mappings and committed Selection Policy separately from evaluation, then require a passing immutable Adoption Decision before any candidate becomes the default Arrangement Score.

## Acceptance criteria

- [ ] Candidate identity includes exact source/plan/instance/manifest/search/policy versions, realized mappings, Search Measurements, Transformation Report, Preservation Audit, alternatives, conflicts, and unknowns.
- [ ] Ranking or persistence alone cannot create or replace an Arrangement Score.
- [ ] A conclusive evaluation failure rejects and advances committed ordering; unavailable infrastructure remains retryable and cannot be silently skipped.
- [ ] Only a passing immutable Adoption Decision creates a new default score version; manual adoption records scope and rationale.
- [ ] Workbench compares committed candidates, their mappings, measurements, tradeoffs, Evaluation Cards, and Adoption Decisions, then adopts, versions, reloads, and audits without losing lineage; note selection, prompting, and manual batch editing are outside this tracer.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T34-candidate-mapping-gated-adoption.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T34-candidate-mapping-gated-adoption.spec.ts`; `npm run eval:fast`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T34/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 17
- 22
- 33
