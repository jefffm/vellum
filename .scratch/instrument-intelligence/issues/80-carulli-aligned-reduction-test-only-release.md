# Carulli aligned reduction ingestion and test-only release

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U6

SPEC coverage: Classical-guitar aligned-reduction seed; first extraction fixture

Requirement families touched: II-SRC-001–006, II-KNW-001–004, II-SEED-003

## What to build

Carry Ferdinando Carulli's 1825 _L'Harmonie appliquée à la Guitare_ from its [identified Royal Danish Library asset](https://img.kb.dk/ma/umus/carulli_harmonie.pdf) through safe acquisition, exact identity, rights/access decisions, resumable Page Atlas, one cited source-texture/guitar-reduction alignment, review lineage, and an immutable test-only release.

## Acceptance criteria

- [ ] Work, 1825 Manifestation, library Exemplar, exact PDF Asset bytes, acquisition, contamination group, and roles remain separate; another Carulli method, arrangement, edition, or provider copy cannot silently substitute.
- [ ] Rights/access records separately control local processing, egress, repository/derivative inclusion, and redistribution; raw bytes remain outside Git absent exact authorization.
- [ ] A resumable Page Atlas binds separately cited source-texture and guitar-reduction segments and a versioned alignment of corresponding voices, spans, harmonic obligations, and events.
- [ ] The extraction proposes explicit `retain`, `omit`, `octave`, `rhythm`, and `accompaniment` transformations with source/target references, uncertainty, alternatives, counterevidence, and correction lineage; correspondence is not assumed merely from page proximity.
- [ ] Candidate, automated alignment, correction, and any reviewer/credential records retain exact lineage; one aligned example cannot establish a universal reduction policy or prove idiomatic execution.
- [ ] The immutable release is test-only and example-scoped, cannot activate default Guided Start or readiness, and preserves source truth separately from editorial transformation proposals.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T80-carulli-aligned-reduction-test-only-release.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T80-carulli-aligned-reduction-test-only-release.spec.ts`; `npm run eval:fast`; `npm run eval:omr` when an OMR adapter is selected; the tracer's adversarial acquisition, fake-provider, rights, alignment-differential, and derivative-leak cases through the focused command.
- Toolchain: record Node, npm, Nix, parser/OCR/OMR, provider/fake-provider, OS, hardware, exact provider response, and source identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the production Workbench path from exact Carulli identity to side-by-side cited source/reduction segments, inspectable transformation proposals, and a nonactivatable test-only release after reload.
- Evidence: `../evidence/T80/verification.json` plus digest-bound public metadata and redacted development artifacts.

## Public/Vault boundary

Only rights-permitted development metadata and derivatives may be public. Private source bytes and unauthorized crops stay in the Owner Reference Library; no held-out identity, truth, mutation, reserve state, or per-attempt diagnostic may appear here.

## Blocked by

- 13
