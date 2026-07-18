# Weiss ingestion, cited extraction, and test-only release

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U5

SPEC coverage: Baroque-lute descriptive repertoire seed; first extraction fixture

Requirement families touched: II-SRC-001–006, II-KNW-001–004, II-SEED-002, II-EXEC-002C

## What to build

Resolve one exact Silvius Leopold Weiss Dresden manuscript item from the [SLUB collection](https://digital.slub-dresden.de/id508190533), then carry its selected page through safe acquisition, source identity, rights/access decisions, resumable Page Atlas, geometry-preserving descriptive extraction, review lineage, and an immutable test-only release.

## Acceptance criteria

- [ ] The exact Work, manuscript Manifestation, shelfmark/item Exemplar, selected Digital Asset bytes, acquisition, contamination group, and roles are identified independently; a collection landing page or adjacent manuscript cannot stand in for the chosen item.
- [ ] Rights/access records separately govern local processing, egress, repository/derivative inclusion, and redistribution; manuscript images remain outside Git unless the exact fixture use is authorized.
- [ ] A resumable Page Atlas preserves full image geometry and binds one exact tablature passage for descriptive voice-leading, texture, bass-deployment, resonance, or damping observations.
- [ ] Diplomatic transcription, normalized event hypotheses, spatial geometry, observation candidates, ambiguity, uncertainty, correction lineage, and counterevidence remain separate; extraction does not infer an instrument's course count from an unused lowest course.
- [ ] Candidate, automated extraction, correction, and any reviewer/credential records retain exact lineage; descriptive repertoire evidence cannot become a normative technique rule or course-13 authority without separately applicable review.
- [ ] The immutable release is test-only, page/passage scoped, unable to activate default Guided Start or readiness, and retains unresolved notation or target-configuration questions.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T78-weiss-ingestion-cited-extraction-test-only-release.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T78-weiss-ingestion-cited-extraction-test-only-release.spec.ts`; `npm run eval:fast`; `npm run eval:omr` when an OMR adapter is selected; the tracer's adversarial acquisition, fake-provider, rights, geometry-retention, and derivative-leak cases through the focused command.
- Toolchain: record Node, npm, Nix, parser/OCR/OMR, provider/fake-provider, OS, hardware, exact provider response, and source identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the production Workbench path from a resolved SLUB manuscript item to a geometry-preserving cited tablature segment and visibly descriptive, test-only observations after reload.
- Evidence: `../evidence/T78/verification.json` plus digest-bound public metadata and redacted development artifacts.

## Public/Vault boundary

Only rights-permitted development metadata and derivatives may be public. Private source bytes and unauthorized crops stay in the Owner Reference Library; no held-out identity, truth, mutation, reserve state, or per-attempt diagnostic may appear here.

## Blocked by

- 13
