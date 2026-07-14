# Typed knowledge evidence and immutable release

Status: ready-for-agent

Type: AFK

User stories: U2

SPEC coverage: Reviewed Knowledge Library; Candidates; releases; profiles/mappings; Slice 3

Requirement IDs: II-KNW-001–002, II-KNW-004, II-EXEC-003A

## What to build

Turn one cited Mace extraction into typed evidence edges, orthogonal candidate axes, lane-compatible derivations, examples/counterexamples, declarative mappings, and an immutable test-only release.

## Acceptance criteria

- [ ] Evidence edges use stable predicate identities and distinguish support, qualification, contradiction, supersession, example, counterexample, derivation, and unresolved ambiguity.
- [ ] Candidate axes remain orthogonal; mixed authority lanes or incompatible applicability scopes fail validation rather than collapse.
- [ ] A test-only release contains exact cited evidence, profiles, mappings, examples, counterexamples, open questions, and complete dependency identities.
- [ ] Content change creates a new release; review/attestation never mutates release bytes.
- [ ] API and Workbench compare candidate, draft, release, and successor states with exact digests and no default activation.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T12-typed-knowledge-evidence-immutable-release.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T12-typed-knowledge-evidence-immutable-release.spec.ts`; `npm run eval:fast`.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T12/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 07
- 11
