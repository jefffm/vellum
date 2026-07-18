# Perrine ingestion, cited extraction, and test-only release

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U5

SPEC coverage: Baroque-lute mapping and repertoire seed source

Requirement families touched: II-SRC-001–006, II-KNW-001–004, II-SEED-002, II-EXEC-002C

## What to build

Carry Perrine's 1679/1680 _Livre de Musique pour le Lut_ from its [identified BnF/Gallica manifestation](https://gallica.bnf.fr/ark:/12148/btv1b100756018) through safe acquisition, exact identity, rights/access decisions, resumable Page Atlas, one aligned staff-to-lute cited example, review lineage, and an immutable test-only release.

## Acceptance criteria

- [ ] Work, exact dated Manifestation, Gallica Exemplar, Digital Asset bytes, acquisition, contamination group, and roles remain distinct; the 1679/1680 identity is resolved rather than flattened and related copies do not alias it.
- [ ] Rights/access records separately control local processing, egress, repository/derivative inclusion, and redistribution; source bytes remain outside Git absent exact authorization.
- [ ] A resumable Page Atlas binds one exact aligned staff/tablature example with independent citations to both representations and explicit event/voice alignment candidates.
- [ ] Image geometry, transcription, staff-to-lute mapping, style-brisé/voice-leading or Continuo observation, uncertainty, alternatives, and correction lineage stay distinct; an alignment candidate cannot silently become reviewed truth.
- [ ] Candidate, automated extraction, correction, and any reviewer/credential records retain exact lineage; absent qualified review grants no historical, thirteen-course, or universal mapping authority.
- [ ] The immutable release is test-only, remains example- and manifestation-scoped, cannot activate default Guided Start or readiness, and retains conflicts or unresolved mappings.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T77-perrine-ingestion-cited-extraction-test-only-release.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T77-perrine-ingestion-cited-extraction-test-only-release.spec.ts`; `npm run eval:fast`; `npm run eval:omr` when an OMR adapter is selected; the tracer's adversarial acquisition, fake-provider, rights, alignment-uncertainty, and derivative-leak cases through the focused command.
- Toolchain: record Node, npm, Nix, parser/OCR/OMR, provider/fake-provider, OS, hardware, exact provider response, and source identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the production Workbench path from exact Perrine identity to side-by-side, independently cited staff and tablature segments plus an inspectable test-only alignment after reload.
- Evidence: `../evidence/T77/verification.json` plus digest-bound public metadata and redacted development artifacts.

## Public/Vault boundary

Only rights-permitted development metadata and derivatives may be public. Private source bytes and unauthorized crops stay in the Owner Reference Library; no held-out identity, truth, mutation, reserve state, or per-attempt diagnostic may appear here.

## Blocked by

- 13
