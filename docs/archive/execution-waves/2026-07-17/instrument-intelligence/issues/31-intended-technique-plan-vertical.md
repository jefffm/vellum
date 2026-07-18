# Intended Technique Plan vertical

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3, U4, U5, U6

SPEC coverage: Intended Technique Plan; Slice 5

Requirement families touched: II-MUS-010, II-BND-005, II-EXEC-005B, II-MC-016

## What to build

Carry a target-neutral, named, profile-scoped technique plan with only its applicable registered resource, transition, state, notation, and playback facets into candidate search instead of relabeling generated texture after the fact.

## Acceptance criteria

- [ ] Plan identifies technique family, profile and passage scope, applicability, transitions, required resources, state obligations, notation/playback consequences, alternatives, evidence, and unknown dimensions without requiring instrument-specific facets on unrelated targets.
- [ ] Registered target/profile facets compose explicitly where applicable; a target that has no attack mask, course allocation, digit allocation, resonance rule, or other facet records `not_applicable` rather than a fabricated value, and unsupported combinations produce Plan Conflict.
- [ ] Candidate mappings, the accepted Transformation Report, and Preservation Audit identify which technique obligations each event or gesture realizes.
- [ ] Historical, pedagogical, software, and personal rationale remain separate and visibly scoped.
- [ ] Missing applicable transition, impossible resource, relabeled constitutive event, hold/release, and damping mutations fail; an inapplicable target-specific mutation cannot become a universal gate.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T31-intended-technique-plan-vertical.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T31-intended-technique-plan-vertical.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T31/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 29
