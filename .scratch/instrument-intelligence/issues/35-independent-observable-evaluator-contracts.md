# Independent observable evaluator contracts

Status: ready-for-agent

Type: AFK

User stories: U3, U8, U10

SPEC coverage: Independent observable dimensions; required mutations; Slice 4/5

Requirement IDs: II-EVAL-001, II-EVAL-007, II-EXEC-004B, II-MC-011–015, II-MC-025–026

## What to build

Build evaluator contracts that recompute canonical observable truth outside generation for voices, harmony, transposition, figures, lyrics, spanners, constituent attacks, notation, playback, and target-specific state.

## Acceptance criteria

- [ ] Evaluators consume persisted canonical output and sealed truth, never generator self-reported pass flags or hidden aggregate scores.
- [ ] Voice identity/activity, harmony/inversion/cadence, transposition/context, figures/spans, lyric underlay, spanners/ornaments, constituent attacks, and notation/playback dimensions report independently.
- [ ] Every named development mutation changes one controlled observable and is killed by its corresponding evaluator without contaminating generation.
- [ ] Unavailable required input yields blocked/incomplete; inapplicable dimensions require explicit profile rationale.
- [ ] Cards retain exact evaluator/input/output identities, observable findings, Claim Scope, and redacted evidence through persistence and UI.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T35-independent-observable-evaluator-contracts.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T35-independent-observable-evaluator-contracts.spec.ts`; `npm run eval:fast`; the tracer's evaluator-isolation and leak-canary cases through the focused command.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T35/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 20
- 22
- 24
- 25
- 26
- 27
- 28
- 29
- 30
- 31
- 34
