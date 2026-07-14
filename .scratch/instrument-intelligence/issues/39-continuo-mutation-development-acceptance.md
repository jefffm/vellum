# Continuo mutation and development acceptance

Status: ready-for-agent

Type: AFK

User stories: U3, U7, U8

SPEC coverage: Required mutations; Slice 6 acceptance; Machine Complete figured-bass clause

Requirement IDs: II-EVAL-007, II-EXEC-006C, II-MC-014, II-MC-025

## What to build

Close the Continuo development vertical with a content-addressed Golden fixture and independent mutations over every foundation, figure, generated voice, and disposition obligation.

## Acceptance criteria

- [ ] Every foundation event, figure, accidental, alignment, held-bass change, continuation, suspension, generated voice, and disposition mutation yields the scoped independent failure.
- [ ] Canonical signs/groups/spans/constraints/mappings and the exact pack/manifest/Voice/Harmonic/Relationship/Continuo plans are covered in one replayable fixture.
- [ ] Semantic, rendered, and sounding outputs agree for full and isolated parts with no duplicate occurrence.
- [ ] Known-good output passes only the applicable profile; unknown/unreviewed dimensions remain visible.
- [ ] Focused, Golden, render, playback, and browser evidence is content-addressed and compatible with the exact evaluator/system.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T39-continuo-mutation-development-acceptance.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T39-continuo-mutation-development-acceptance.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T39/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 35
- 38
