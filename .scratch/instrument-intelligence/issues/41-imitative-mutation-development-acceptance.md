# Imitative mutation and development acceptance

Status: ready-for-agent

Type: AFK

User stories: U3, U7, U8

SPEC coverage: Required mutations; Slice 7 acceptance

Requirement IDs: II-EVAL-007, II-EXEC-007B, II-MC-015, II-MC-025

## What to build

Close imitative development acceptance with sealed evaluator-only mutations and a content-addressed semantic/render/playback fixture.

## Acceptance criteria

- [ ] Entry order, subject interval/rhythm shape, relation timing, source/target voice identity, exchange, and cadence placement mutations fail independently.
- [ ] Mutations remain outside generation and cannot influence candidate selection or prompts.
- [ ] A generic counterpoint or event-count grade cannot substitute for named relationship findings.
- [ ] Known-good full and isolated outputs preserve exact voices, ordering, notation, sounding identity, and no duplicates.
- [ ] Golden, render, playback, evaluator, and browser receipts bind exact system/profile/evaluator/output digests.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T41-imitative-mutation-development-acceptance.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T41-imitative-mutation-development-acceptance.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T41/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 35
- 40
