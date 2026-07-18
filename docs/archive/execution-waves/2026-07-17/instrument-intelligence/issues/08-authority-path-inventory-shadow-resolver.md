# Authority-path inventory and compatibility classification

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U2, U10

SPEC coverage: Authority Path Inventory; Slice 1 compatibility classification

Requirement families touched: II-KNW-006, II-EXEC-001B, II-MC-007

## What to build

Inventory and classify every authority-affecting path before building the complete resolver. This tracer records the mechanical/nonmechanical boundary and compatibility obligations; tracer 14 reconciles the inventory with the complete Catalog, Component Registry, and Applied Knowledge Manifest.

## Acceptance criteria

- [ ] Prompts, tool descriptions/defaults, built-in data, compiler branches, rankers, validators, constants, labels, caches, and legacy packs are exhaustively classified.
- [ ] Each entry records owner, current read/write path, authority effect, mechanical/nonmechanical classification, compatibility requirement, quarantine state, and intended future component binding; unclassified nonmechanical paths are quarantined.
- [ ] Static and runtime inventory guards fail when a new authority path lacks a classification record; they do not claim that the future manifest is already complete.
- [ ] Compatible-reader requirements and exact shadow-comparison fixtures are specified and digest-bound without enabling a new resolver or production activation.
- [ ] Legacy paths cannot reactivate quarantined knowledge through direct imports, stale caches, or compatibility fallbacks while inventory work proceeds.
- [ ] Tracer 14 can mechanically reconcile this frozen inventory against the complete Catalog, Component Registry Snapshot, and manifest, including explicit differences and unknowns.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T08-authority-path-inventory-shadow-resolver.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: the tracer's adversarial authority-bypass and compatibility suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T08/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 03
