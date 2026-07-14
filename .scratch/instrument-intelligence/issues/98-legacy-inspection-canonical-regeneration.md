# Legacy inspection and canonical regeneration

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U9

SPEC coverage: Legacy compatibility, immutable lineage, and Workbench regeneration; Slice 11

Requirement families touched: II-KNW-005–007, II-UX-002–004, II-EXEC-011, II-MC-002, II-MC-035–036

## What to build

Keep legacy analyses/searches/scores inspectable with their actual historical authority gaps, and regenerate canonically into new lineage using current manifests and policies without rewriting old bytes or inventing provenance.

## Acceptance criteria

- [ ] Legacy reader preserves every original ID, byte, hash, citation, output, and known authority/manifest absence and distinguishes exact migration, actionable quarantine, and inspect-only compatibility.
- [ ] UI never synthesizes a complete Applied Knowledge Manifest, release, attestation, profile, citation, rights decision, or qualification for a legacy artifact that lacked it.
- [ ] Canonical regeneration starts a new analysis/plan/search/version lineage under current source mapping, Catalog/manifest/policies/toolchain and binds explicit predecessor/comparison/reason; original artifacts remain unchanged and inspectable.
- [ ] Diff exposes musical, physical, knowledge/authority, notation/playback, and unknown/incomparable changes without presenting regenerated output as equivalent or silently adopting it.
- [ ] Rights-restricted/deleted or unresolved-quarantine legacy material cannot regenerate; stale mappings and incompatible checkpoints fail with actionable choices.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T98-legacy-inspection-canonical-regeneration.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T98-legacy-inspection-canonical-regeneration.spec.ts`; focused migration, compatibility, rights/deletion, lineage, stale-checkpoint, and diff cases.
- Toolchain: record Node/npm, legacy/current schemas, migration/mapping identities, Catalog/policies, browser, database, OS, and applicable musical tools.
- Observable outcome: inspect pinned legacy fixtures, regenerate one safely, reload both lineages, and prove missing authority stays missing in the original.
- Evidence: `../evidence/T98/verification.json` plus digest-bound public disclosed-fixture lineage/diff receipts.

## Public/Vault boundary

Only rights-cleared development fixtures and their non-sensitive lineage/diffs may be public. Exact private/held-out sources, truth, provider payloads, review notes, credentials, reserve state, and diagnostics remain private/Vault data; forbidden legacy bytes cannot enter evidence.

## Blocked by

- 06
- 10
- 14
- 34
- 58
