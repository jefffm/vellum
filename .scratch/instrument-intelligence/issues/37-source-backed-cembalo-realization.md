# Source-backed cembalo realization

Status: ready-for-agent

Type: AFK

User stories: U3, U7

SPEC coverage: Continuo vertical; shared Italian keyboard seed; Slice 6

Requirement IDs: II-KNW-004, II-MUS-009, II-SEED-004, II-EXEC-006B, II-MC-014

## What to build

Use cited Gasparini segments to build a scoped cembalo realization profile and produce a complete soprano-plus-harpsichord arrangement for an exact Instrument Instance through manifest, plans, search, engraving, isolated playback, audit, evaluation, and Workbench.

## Acceptance criteria

- [ ] Gasparini evidence resolves into a source-backed test-only profile with exact release/attestation/manifest identity and no universal claim.
- [ ] Complete score retains soprano and figured-bass source truth plus generated keyboard voices under exact spacing, doubling, voice-leading, and cadence obligations.
- [ ] Isolated soprano, foundation, and generated voices agree with full engraving/playback and canonical occurrence identity.
- [ ] Workbench exposes figures, realization mappings, plan choices, alternatives, audit, and Evaluation Card.
- [ ] Any piano output is a separately named modern editorial adaptation with separate profile, plan, artifact, and claim.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T37-source-backed-cembalo-realization.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T37-source-backed-cembalo-realization.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T37/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 14
- 34
- 36
