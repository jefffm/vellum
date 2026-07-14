# Intended Technique Plan vertical

Status: ready-for-agent

Type: AFK

User stories: U3, U4, U5, U6

SPEC coverage: Intended Technique Plan; Slice 5

Requirement IDs: II-MUS-010, II-BND-005, II-EXEC-005B, II-MC-016

## What to build

Carry a named, profile-scoped technique plan with resources, transitions, attack/release, held/damped state, notation, and playback consequences into candidate search instead of relabeling a generated texture after the fact.

## Acceptance criteria

- [ ] Plan identifies technique/profile scope, applicability, hand/resource budgets, transition obligations, attack masks, held/released/damped state, resonance, and target notation/playback consequences.
- [ ] Orthogonal compatible facets compose explicitly; unsupported combinations produce Plan Conflict rather than a flat substitute mode.
- [ ] Candidate mappings and Transformation Audit prove which technique obligations each event/gesture realizes.
- [ ] Historical, pedagogical, software, and personal rationale remain separate and visibly scoped.
- [ ] Missing transition, impossible resource, relabeled attack, hold/release, and damping mutations fail.

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
