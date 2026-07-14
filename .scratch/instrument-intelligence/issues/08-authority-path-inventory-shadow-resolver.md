# Authority-path inventory and shadow resolver

Status: ready-for-agent

Type: AFK

User stories: U2, U10

SPEC coverage: Applied Knowledge Manifest; Authority Path Inventory; Slice 1 compatibility/shadow resolution

Requirement IDs: II-KNW-005–006, II-EXEC-001B, II-MC-006–008

## What to build

Inventory every authority-affecting path and introduce compatible readers plus a shadow resolver that compares legacy and new outcomes without changing production activation.

## Acceptance criteria

- [ ] Prompts, tool descriptions/defaults, built-in data, compiler branches, rankers, validators, constants, labels, caches, and legacy packs are exhaustively classified.
- [ ] Each entry is mechanical or resolves through a Component Registry and Applied Knowledge Manifest; unclassified nonmechanical paths are quarantined.
- [ ] Static and runtime bypass detectors fail when a new authority path lacks inventory and registry coverage.
- [ ] Old and new readers produce digest-bound shadow comparisons with explicit differences, unknowns, and rollback inputs.
- [ ] Legacy paths cannot reactivate quarantined knowledge through direct imports, stale caches, or compatibility fallbacks.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T08-authority-path-inventory-shadow-resolver.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: the tracer's adversarial security/fake-provider suite through the focused Vitest command above; the tracer's dry-run, interruption, rollback, and compatibility suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T08/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 03
- 07
