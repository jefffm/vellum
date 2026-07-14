# Continuo Plan and Disposition contract

Status: ready-for-agent

Type: AFK

User stories: U3, U7

SPEC coverage: Continuo Realization and Disposition Plan; Slice 5/6

Requirement IDs: II-MUS-009, II-EXEC-005B, II-MC-014

## What to build

Represent reviewed continuo foundation/figure obligations and choose complete, separate-bass, reduction, or rejected disposition before target search, with totality and policy conflicts exposed.

## Acceptance criteria

- [ ] Continuo Plan references exact foundation events, Figure Signs/Groups/spans/constraints, realization profile, voices, spacing/doubling policy, cadence, and generated mappings.
- [ ] Disposition covers the entire foundation set and cannot switch silently between complete, separate bass, reduction, and rejection.
- [ ] An incapable target produces a typed Plan Conflict or explicitly labeled policy-valid reduction, never an implied complete bass.
- [ ] API/Workbench show foundation coverage, unresolved figures, disposition rationale, separate deliverables, and target limitations.
- [ ] Missing foundation event, wrong disposition, false implied/octave bass, and incomplete coverage mutations fail.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T30-continuo-plan-disposition-contract.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T30-continuo-plan-disposition-contract.spec.ts`; `npm run eval:fast`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T30/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 29
