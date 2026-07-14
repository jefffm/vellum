# Workbench advisory, deletion, resume, and regeneration

Status: ready-for-agent

Type: AFK

User stories: U1, U2, U9

SPEC coverage: Lifecycle/deletion; Knowledge Workbench; Slice 11

Requirement IDs: II-BND-007–008, II-KNW-007, II-UX-002–004, II-EXEC-011, II-MC-035–036

## What to build

Make release/attestation diff, advisory, rights/deletion impact, affected-workspace navigation, interruption recovery, legacy inspection, and canonical regeneration one coherent production Workbench lifecycle.

## Acceptance criteria

- [ ] Release/attestation/advisory/activation diffs identify exact changed content, authority, rights, profiles, components, claims, and affected artifacts.
- [ ] Rights restriction or deletion maps complete derivatives, retains authorized tombstones, purges forbidden bytes, and prevents old-path reactivation.
- [ ] Interrupt extraction, reassessment, generation, evaluation, deliverables, and sibling targets; reload exact state and retry only incomplete work without duplicate versions.
- [ ] Legacy searches remain inspectable without invented manifests/authority; canonical regeneration creates new lineage and explicit comparison.
- [ ] Workbench navigates affected work, stale inputs, recovery choices, manual edits/versions, alternatives, and selected score with safe redacted diagnostics.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T58-workbench-advisory-deletion-resume-regeneration.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T58-workbench-advisory-deletion-resume-regeneration.spec.ts`; `npm run eval:fast`; the tracer's isolation, leak-canary, rights, and fake-provider cases through the focused command; the tracer's interruption, rollback, compatibility, and purge cases through the focused command; the tracer's rights and derivative-leak cases through the focused command.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T58/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 06
- 10
- 57
