# Sor text and plates ingestion with test-only release

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U6

SPEC coverage: Classical-guitar seed source; first extraction fixture

Requirement families touched: II-SRC-001–006, II-KNW-001–004, II-SEED-003

## What to build

Carry an exact 1830 French manifestation of Fernando Sor's _Méthode pour la guitare_ and its separately identified plates from the [source inventory](https://imslp.org/wiki/M%C3%A9thode_compl%C3%A8te_pour_la_guitare_%28Sor%2C_Fernando%29) through safe acquisition, source identity, rights/access decisions, Page Atlases, one text-to-plate citation link, review lineage, and an immutable test-only release.

## Acceptance criteria

- [ ] Work, exact 1830 French Manifestation, text and plate Exemplars/Assets, acquisitions, contamination groups, and roles remain separate identities; an IMSLP page is discovery metadata, not source identity.
- [ ] Rights/access records independently govern each asset's local processing, egress, repository/derivative inclusion, and redistribution; raw bytes remain outside Git unless exact fixture use is authorized.
- [ ] Resumable Page Atlases preserve printed/logical mappings for text and plates, and immutable citations link one exact text assertion about voice preservation, harmony-aware fingering, bass continuity, accompaniment, or reduction to its separately identified plate example.
- [ ] French text, transcription, translation, plate notation, alignment hypothesis, interpretation, uncertainty, correction lineage, and counterevidence remain distinct.
- [ ] The 1896 Harrison rewrite, if used for comparison, has separate identity and evidence role and cannot substitute for or silently amend the 1830 authority; candidate and any reviewer/credential records retain exact lineage.
- [ ] The immutable release is test-only and example-scoped, cannot activate default Guided Start or readiness, and grants no broad classical-guitar or pedagogical authority without qualified review.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T79-sor-text-plates-ingestion-test-only-release.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T79-sor-text-plates-ingestion-test-only-release.spec.ts`; `npm run eval:fast`; `npm run eval:omr` when an OMR adapter is selected for the plates; the tracer's adversarial acquisition, fake-provider, rights, cross-asset-alignment, translation-uncertainty, and derivative-leak cases through the focused command.
- Toolchain: record Node, npm, Nix, parser/OCR/OMR, translation component or provider/fake-provider, OS, hardware, exact provider responses, and source identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate two separately identified assets in the production Workbench with independent Atlases, an exact text-to-plate citation, visible uncertainty, and a nonactivatable test-only release after reload.
- Evidence: `../evidence/T79/verification.json` plus digest-bound public metadata and redacted development artifacts.

## Public/Vault boundary

Only rights-permitted development metadata and derivatives may be public. Private source bytes and unauthorized crops stay in the Owner Reference Library; no held-out identity, truth, mutation, reserve state, or per-attempt diagnostic may appear here.

## Blocked by

- 13
