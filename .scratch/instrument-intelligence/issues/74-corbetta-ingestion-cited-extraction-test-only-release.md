# Corbetta ingestion, cited extraction, and test-only release

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U4

SPEC coverage: Five-course baroque-guitar seed source; first extraction fixture

Requirement families touched: II-SRC-001–006, II-KNW-001–004, II-SEED-001

## What to build

Carry Francesco Corbetta's 1671 _La Guitarre royalle_ from its [identified BnF/Gallica manifestation](https://gallica.bnf.fr/ark:/12148/bpt6k1505774n) through safe acquisition, source identity, rights/access decisions, resumable Page Atlas, one exact mixed-style cited extraction, review lineage, and an immutable test-only release.

## Acceptance criteria

- [ ] Work, 1671 Manifestation, Gallica Exemplar, exact Digital Asset bytes, acquisition, contamination group, and roles remain separate identities; related editions and provider derivatives cannot collapse into this source.
- [ ] Rights/access records independently govern local processing, egress, repository/derivative inclusion, and redistribution; raw bytes stay outside Git unless the exact use is authorized.
- [ ] The resumable Page Atlas and immutable citations bind one bounded passage containing stroke path plus independently represented sounding-course mask, course suppression, held harmony, and notation ambiguity.
- [ ] Extraction preserves glyph/image geometry, stroke order and direction, course-allocation uncertainty, alternative readings, correction lineage, and counterevidence; stroke path never implies that all five courses sound.
- [ ] Candidate, automated extraction, correction, and any reviewer/credential records retain exact lineage; unresolved suppression marks remain unresolved and missing qualified review grants no historical authority.
- [ ] The immutable test-only release remains source- and passage-scoped, cannot activate default Guided Start or readiness, and treats any broader mixed-style rule as an open research question rather than an inferred universal.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T74-corbetta-ingestion-cited-extraction-test-only-release.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T74-corbetta-ingestion-cited-extraction-test-only-release.spec.ts`; `npm run eval:fast`; `npm run eval:omr` when an OMR adapter is selected; the tracer's adversarial acquisition, fake-provider, rights, and derivative-leak cases through the focused command.
- Toolchain: record Node, npm, Nix, parser/OCR/OMR, provider/fake-provider, OS, hardware, exact provider response, and source identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the production Workbench path from exact acquisition to a test-only passage release whose stroke, mask, held-state, and ambiguity layers can be inspected separately after reload.
- Evidence: `../evidence/T74/verification.json` plus digest-bound public metadata and redacted development artifacts.

## Public/Vault boundary

Only rights-permitted development metadata and derivatives may be public. Private source bytes and unauthorized crops stay in the Owner Reference Library; no held-out identity, truth, mutation, reserve state, or per-attempt diagnostic may appear here.

## Blocked by

- 13
