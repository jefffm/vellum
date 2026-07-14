# Gasparini ingestion, cited extraction, and test-only release

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U7

SPEC coverage: Shared Italian keyboard Continuo seed; first extraction fixture

Requirement families touched: II-SRC-001–006, II-KNW-001–004, II-SEED-004

## What to build

Carry Francesco Gasparini's 1708 Venice _L'armonico pratico al cimbalo_, [Library of Congress LCCN 05004057](https://www.loc.gov/item/05004057/), through safe acquisition, exact identity, rights/access decisions, resumable Page Atlas, chapter-scoped cited extraction, review lineage, and an immutable test-only `continuo.italian-baroque.cembalo` evidence release.

## Acceptance criteria

- [ ] Work, 1708 Manifestation, Library of Congress Exemplar, exact Digital Asset bytes, acquisitions, contamination group, and roles remain separate; the 1764 manifestation may assist comparison/OCR but cannot replace or silently merge with 1708 identity.
- [ ] Rights/access records separately control local processing, provider egress, repository/derivative inclusion, and redistribution; source bytes remain outside Git unless exact fixture authorization exists.
- [ ] A resumable Page Atlas retains Chapters II, IV, and VII–X as separately citable ranges and binds exact segments for keyboard disposition, doubling, economical motion, density, and figured-dissonance candidates.
- [ ] Text, notation, translation/normalization, image geometry, noisy OCR, alternative readings, uncertainty, correction lineage, and counterevidence remain distinct; OCR output never becomes reviewed source truth by confidence alone.
- [ ] Candidate, automated extraction, correction, comparison, and any reviewer/credential records form exact lineage; absent qualified historical/Continuo review carries no specialist authority.
- [ ] The immutable test-only release is limited to cembalo/harpsichord development evidence, excludes the source contamination group from held-out Continuo acceptance, and grants no authority to spinet, organ, piano, fretted targets, default Guided Start, or readiness.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T75-gasparini-ingestion-cited-extraction-test-only-release.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T75-gasparini-ingestion-cited-extraction-test-only-release.spec.ts`; `npm run eval:fast`; `npm run eval:omr` when an OMR adapter is selected; the tracer's adversarial acquisition, fake-provider, rights, OCR-uncertainty, and derivative-leak cases through the focused command.
- Toolchain: record Node, npm, Nix, parser/OCR/OMR, provider/fake-provider, OS, hardware, exact provider response, and source identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the production Workbench path from exact 1708 identity to separately cited chapter segments and a visibly test-only cembalo release, including interruption/reload and 1764 comparison without identity substitution.
- Evidence: `../evidence/T75/verification.json` plus digest-bound public metadata and redacted development artifacts.

## Public/Vault boundary

Only rights-permitted development metadata and derivatives may be public. Private source bytes and unauthorized crops stay in the Owner Reference Library; no held-out identity, truth, mutation, reserve state, or per-attempt diagnostic may appear here.

## Blocked by

- 13
