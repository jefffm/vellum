# Typed knowledge evidence and immutable release

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U2

SPEC coverage: Reviewed Knowledge Library; Candidates; releases; profiles/mappings; Slice 3

Requirement families touched: II-KNW-001–002, II-KNW-004, II-EXEC-003A

## What to build

Turn one cited Mace extraction into typed evidence edges, orthogonal candidate axes, lane-compatible derivations, examples/counterexamples, declarative mappings, and an immutable content release. Publish a separate system-issued test-only attestation under a pinned test policy; test-only state is never mutable release content.

## Acceptance criteria

- [ ] Evidence edges use stable predicate identities and distinguish support, qualification, contradiction, supersession, example, counterexample, derivation, and unresolved ambiguity.
- [ ] Candidate axes remain orthogonal; mixed authority lanes or incompatible applicability scopes fail validation rather than collapse.
- [ ] An immutable release contains exact cited evidence, profiles, mappings, examples, counterexamples, open questions, and the complete transitive component/dependency closure, each bound by canonical digest and Merkle root.
- [ ] Pack/profile payloads are declarative data only; executable content, prompt fragments presented as authority, undeclared code/component bindings, dependency cycles, path traversal, and incompatible interface/parameter/unit/resource/replay contracts fail validation.
- [ ] The test-only attestation is a distinct immutable record bound to the exact release and pinned test policy; it conveys no human, historical, pedagogical, ergonomic, performer, or specialist authority.
- [ ] Content change creates a new release; review, test attestation, supersession, and advisory records never mutate release bytes or its Merkle/component closure.
- [ ] API and Workbench compare candidate, draft, release, and successor states with exact digests and no default activation.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T12-typed-knowledge-evidence-immutable-release.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T12-typed-knowledge-evidence-immutable-release.spec.ts`; `npm run eval:fast`.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T12/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 07
- 11
