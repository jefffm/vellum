# Baron ingestion, cited extraction, and test-only release

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U5

SPEC coverage: Baroque-lute normative seed source

Requirement families touched: II-SRC-001–006, II-KNW-001–004, II-SEED-002

## What to build

Carry Ernst Gottlieb Baron's 1727 _Untersuchung des Instruments der Lauten_ from its [identified BSB manifestation](https://www.digitale-sammlungen.de/de/details/bsb10598228) through safe acquisition, exact identity, rights/access decisions, resumable Page Atlas, one bounded technique citation, review lineage, and an immutable test-only release.

## Acceptance criteria

- [ ] Work, 1727 Manifestation, BSB Exemplar, exact Digital Asset bytes, acquisition, contamination group, and roles are separately identified; edition, translation, and scan derivatives cannot silently substitute for the German source.
- [ ] Rights/access records separately decide local processing, egress, repository/derivative inclusion, and redistribution; raw bytes remain outside Git unless their exact use is authorized.
- [ ] The resumable Page Atlas binds an exact passage about a selected posture, fingering, transition, ornament, or cantabile-practice claim, including printed/logical page identity and immutable source/text/image citation.
- [ ] Original text, transcription, translation, normalized candidate, example/counterexample, uncertainty, correction lineage, and applicability remain distinct.
- [ ] Candidate and any reviewer/credential records preserve review lineage; the release states Baron's eleven-course context and cannot extrapolate course-13 notation, geometry, bass access, or universal lute technique.
- [ ] The immutable release is test-only, cannot activate default Guided Start or readiness, and retains unresolved translation, target-transfer, and modern-pedagogy questions without inventing authority.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T76-baron-ingestion-cited-extraction-test-only-release.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T76-baron-ingestion-cited-extraction-test-only-release.spec.ts`; `npm run eval:fast`; the tracer's adversarial acquisition, fake-provider, rights, translation-uncertainty, and derivative-leak cases through the focused command.
- Toolchain: record Node, npm, Nix, parser/OCR, translation component or provider/fake-provider, OS, hardware, exact provider response, and source identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the production Workbench path from exact Baron identity to a line-by-line cited, scoped, visibly test-only technique release with translation and eleven-course limits exposed after reload.
- Evidence: `../evidence/T76/verification.json` plus digest-bound public metadata and redacted development artifacts.

## Public/Vault boundary

Only rights-permitted development metadata and derivatives may be public. Private source bytes and unauthorized crops stay in the Owner Reference Library; no held-out identity, truth, mutation, reserve state, or per-attempt diagnostic may appear here.

## Blocked by

- 13
