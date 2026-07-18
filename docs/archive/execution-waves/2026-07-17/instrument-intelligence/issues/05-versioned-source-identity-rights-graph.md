# Versioned source identity and rights graph

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2

SPEC coverage: Durable identity graph; rights/access; Slice 1 identity

Requirement families touched: II-SRC-001–002, II-EXEC-001A, II-MC-001–002

## What to build

Introduce the complete versioned source identity graph from Work through role-specific bindings as a staging model and compatible read API. Do not enable a new canonical writer before compatibility migration and transactional cutover are proven.

## Acceptance criteria

- [ ] Staged Works, Manifestations, Exemplars, immutable Digital Assets, Acquisition Records, Source Segment Versions, Rights Assertions, Access Decisions, and Arrangement/Owner/Evaluation bindings round-trip with stable IDs and digests without changing legacy authority.
- [ ] Identity assertions retain claimant, evidence, scope, confidence, conflict, and successor state; documentary classification never receives automatic perfect confidence.
- [ ] Incomplete, composite, conflicting, and later-corrected identities remain representable without mutating prior records.
- [ ] Provenance substitution is an explicit authorized edge between exact acquisition/derivation records; matching Work identity, title, or bytes never transfers rights or silently replaces provenance.
- [ ] Compatibility API and diagnostic Workbench expose the staged graph and actionable uncertainty without disclosing unauthorized bytes or writing canonical bindings.
- [ ] Changing an identity assertion or rights/access decision invalidates exactly the dependent records named by the graph.
- [ ] Tests prove every canonical writer remains disabled until tracers 09 and 15 satisfy migration and cutover predicates.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T05-versioned-source-identity-rights-graph.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T05-versioned-source-identity-rights-graph.spec.ts`; the tracer's rights/derivative-leak suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: create and reload a staging-only Work → Manifestation → Exemplar → Asset → acquisition/right/access graph in Workbench, then prove a changed assertion stales only its exact dependent staging records and cannot become canonical.
- Evidence: `../evidence/T05/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 01
- 03
