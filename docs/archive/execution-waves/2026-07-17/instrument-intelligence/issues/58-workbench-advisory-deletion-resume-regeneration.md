# Workbench release, attestation, and advisory diff

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U9

SPEC coverage: Release/attestation/advisory visibility; Knowledge Workbench; Slice 11

Requirement families touched: II-KNW-007, II-UX-002, II-EXEC-011, II-MC-036, II-EXEC-011B

## What to build

Make release, attestation, advisory, activation, and affected-artifact differences inspectable through one production Workbench path without silently changing authority or generation.

## Acceptance criteria

- [ ] Release/attestation/advisory/activation diffs identify exact changed content, authority, rights, profiles, components, claims, and affected artifacts.
- [ ] Advisory impact traverses complete lineage and compatibility edges, marks affected artifacts without mutating their bytes, and distinguishes stale, superseded, incompatible, and merely informational states.
- [ ] No advisory, successor, or diff grants authority or activation; all changes remain bound to separately reviewed immutable records.
- [ ] Workbench navigates affected work, exact current/successor records, conflicts, unknowns, and safe redacted diagnostics after reload.
- [ ] Focused tests stop at the advisory/diff boundary; rights purge, interruption recovery, legacy regeneration, and interactive editing are owned by T96–T99.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T58-workbench-advisory-diff.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T58-workbench-advisory-diff.spec.ts`; `npm run eval:fast`; the tracer's compatibility and derivative-leak cases through the focused command.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T58/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 06
- 10
- 57
