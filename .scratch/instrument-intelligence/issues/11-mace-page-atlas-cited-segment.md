# Mace Page Atlas and cited-segment browser path

Status: ready-for-agent

Type: AFK

User stories: U1, U2, U9

SPEC coverage: Reference-source substrate; first extraction fixture; Slice 2

Requirement IDs: II-SRC-003–006, II-SEED-002, II-EXEC-002, II-MC-001, II-MC-005, II-NG-002–004

## What to build

Carry the selected Mace asset through safe acquisition, identity, resumable Page Atlas, and an exact cited segment for printed page 75, staging twelve-course notation plus an explicit thirteenth-course research question without promoting authority.

## Acceptance criteria

- [ ] Upload or safe acquisition binds exact bytes, identity, rights/access, and a resumable Page Atlas with printed/logical page mapping.
- [ ] Printed page 75 produces an exact cited segment and typed extraction with image/text/notation anchors, uncertainty, and correction lineage.
- [ ] The twelve-course candidate and thirteenth-course question remain staged, scoped, and nonauthoritative.
- [ ] Atlas correction creates a successor citation mapping; old citations remain immutable and resolve honestly.
- [ ] Malicious/oversized assets, parser failure, redacted diagnostics, denied egress, interruption, and local-only processing are exercised in the real browser.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T11-mace-page-atlas-cited-segment.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T11-mace-page-atlas-cited-segment.spec.ts`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above; the tracer's rights/derivative-leak suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T11/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 02
- 06
- 10
