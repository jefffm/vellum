# Versioned source identity and rights graph

Status: ready-for-agent

Type: AFK

User stories: U1, U2

SPEC coverage: Durable identity graph; rights/access; Slice 1 identity

Requirement IDs: II-SRC-001–002, II-EXEC-001A, II-MC-001–002

## What to build

Introduce the complete versioned source identity graph from Work through role-specific bindings, with explicit assertions and uncertainty instead of manufactured bibliographic confidence.

## Acceptance criteria

- [ ] Works, Manifestations, Exemplars, immutable Digital Assets, Acquisition Records, Source Segment Versions, Rights Assertions, Access Decisions, and Arrangement/Owner/Evaluation bindings round-trip with stable IDs and digests.
- [ ] Identity assertions retain claimant, evidence, scope, confidence, conflict, and successor state; documentary classification never receives automatic perfect confidence.
- [ ] Incomplete, composite, conflicting, and later-corrected identities remain representable without mutating prior records.
- [ ] API and Workbench expose the identity graph and actionable uncertainty without disclosing unauthorized bytes.
- [ ] Changing an identity assertion or rights/access decision invalidates exactly the dependent records named by the graph.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T05-versioned-source-identity-rights-graph.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: the tracer's rights/derivative-leak suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T05/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 01
- 03
