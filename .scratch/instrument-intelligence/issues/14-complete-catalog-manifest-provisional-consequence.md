# Complete catalog, manifest, and provisional consequence

Status: ready-for-agent

Type: AFK

User stories: U2, U9, U10

SPEC coverage: Applied Knowledge Manifest; Slice 3 inventory/catalog/manifest

Requirement IDs: II-BND-003–004, II-KNW-004–006, II-EXEC-003B, II-MC-006–009

## What to build

Resolve the test-only release through an exact Inventory, Catalog, Resolution Policy, Activation Decision, Component Registry Snapshot, and complete Applied Knowledge Manifest, then show one visible consequence only in provisional-research mode.

## Acceptance criteria

- [ ] Inventory is rebuilt from authoritative storage; Catalog and manifest identities include every eligible release/profile/dependency/conflict/exclusion/right/authority outcome.
- [ ] Omitting any inventoried release, eligibility result, profile, dependency, component, authority path, or rights decision invalidates completeness.
- [ ] Unknown, excluded, conflicting, retracted, unavailable-source, and inapplicable states remain distinct.
- [ ] Arrangement Search and Evaluation Run record exact Inventory, Catalog, Activation Decision, component, policy, and manifest digests.
- [ ] Provisional-research mode visibly applies the release, while default Guided Start cannot activate it or claim target readiness.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T14-complete-catalog-manifest-provisional-consequence.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T14-complete-catalog-manifest-provisional-consequence.spec.ts`; `npm run eval:fast`.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T14/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 08
- 12
- 13
