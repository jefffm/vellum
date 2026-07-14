# Governing contract and baseline guard

Status: ready-for-agent

Type: AFK

User stories: U10

SPEC coverage: Authority and reading order; non-negotiable boundaries; Slice 0; completion boundary

Requirement IDs: II-AUTH-001, II-BND-001–008, II-EXEC-000, II-NG-013–014, II-RC-011

## What to build

Make the current specification and this wave executable rather than merely descriptive. Preserve the frozen prototype evidence, correct any remaining active overclaims, create clause-level requirement/evidence verification, and make dependency advancement fail closed.

## Acceptance criteria

- [ ] Every normative subsection, execution bullet, Machine Complete clause, Release Complete clause, and non-goal has a stable requirement digest, owner tracer, evidence family, and current status.
- [ ] A verifier rejects missing, duplicated, contradictory, stale, or incompatible coverage and rejects a dependent tracer whose blocker is not committed and pushed.
- [ ] Current docs identify only `SPEC.md` and this wave as active; frozen prototype evidence retains identical path and bytes.
- [ ] Active UI/docs do not overstate historical authority, specialist review, physical playability, or generic completeness.
- [ ] The issue/evidence schema validates triage status, AFK/HITL type, gate commands, toolchain identity, public/Vault classification, and evidence path.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T01-governing-contract-baseline-guard.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: none beyond the focused and base gates.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T01/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

None - can start immediately.
