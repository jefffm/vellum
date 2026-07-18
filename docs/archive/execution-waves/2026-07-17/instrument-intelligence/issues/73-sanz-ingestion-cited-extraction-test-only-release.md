# Sanz ingestion, cited extraction, and test-only release

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U4

SPEC coverage: Five-course baroque-guitar seed source; first extraction fixture

Requirement families touched: II-SRC-001–006, II-KNW-001–004, II-SEED-001, II-EXEC-002A

## What to build

Carry Gaspar Sanz's complete 1697 _Instrucción de música sobre la guitarra española_ from its [identified UGR manifestation](https://hdl.handle.net/10481/86789) through safe acquisition, source identity, rights/access decisions, resumable Page Atlas, exact cited extraction, review lineage, and an immutable test-only release focused on contextual right-hand digit use.

## Acceptance criteria

- [ ] Work, 1697 Manifestation, provider Exemplar, exact Digital Asset bytes, acquisition, contamination group, and roles remain separate identities; a different edition, compilation, exemplar, or scan cannot alias them.
- [ ] Rights/access records decide local processing, provider egress, repository inclusion, derivative-fixture inclusion, and redistribution separately; raw bytes remain in the Owner Reference Library and outside Git unless their exact inclusion purpose is authorized.
- [ ] A resumable Page Atlas maps the exact printed/logical pages and image regions for at least one ordinary right-hand example and one contextual four-voice/fourth-finger passage; every claim and example cites immutable Source Segment Versions.
- [ ] Extraction records source text or notation, normalized interpretation, translation where used, image geometry, uncertainty, counterevidence, correction lineage, and the limited source/context scope; it cannot produce an unscoped universal three-finger rule.
- [ ] Candidate, automated extraction, correction, and any reviewer/credential records form an inspectable lineage; absent or out-of-scope qualified review carries no historical authority.
- [ ] The immutable release is test-only, retains open questions and counterexamples, cannot activate default Guided Start or target readiness, and survives Atlas correction by creating successor citations/releases rather than rewriting old bytes.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T73-sanz-ingestion-cited-extraction-test-only-release.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T73-sanz-ingestion-cited-extraction-test-only-release.spec.ts`; `npm run eval:fast`; `npm run eval:omr` when an OMR adapter is selected; the tracer's adversarial acquisition, fake-provider, rights, and derivative-leak cases through the focused command.
- Toolchain: record Node, npm, Nix, parser/OCR/OMR, provider/fake-provider, OS, hardware, exact provider response, and source identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the real acquisition-to-test-only-release path in the production Workbench, including interruption/reload, zoomed citation review, uncertainty, and denied authority/activation.
- Evidence: `../evidence/T73/verification.json` plus digest-bound public metadata and redacted development artifacts.

## Public/Vault boundary

Only rights-permitted development metadata and derivatives may be public. Private source bytes and unauthorized crops stay in the Owner Reference Library; no held-out identity, truth, mutation, reserve state, or per-attempt diagnostic may appear here.

## Blocked by

- 13
