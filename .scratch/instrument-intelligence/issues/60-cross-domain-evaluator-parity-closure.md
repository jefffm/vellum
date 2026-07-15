# Cross-domain evaluator and parity closure

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3, U4, U5, U6, U7, U8

SPEC coverage: Evaluation/grading; required mutations; coequal Golden fixtures; Slice 12

Requirement families touched: II-OUT-002, II-SEED-005, II-EVAL-001, II-EVAL-007–009, II-EXEC-012, II-EXEC-004G, II-MC-014–025, II-MC-030–032, II-NG-011, II-NG-010

## What to build

Prove the shared evaluator architecture and equal evidence depth across Continuo, imitative counterpoint, and all three priority targets without borrowing one target's mechanics, idiom, or fixture.

## Acceptance criteria

- [ ] Every required mutation is killed by a recomputed canonical observable; generator flags and hidden totals cannot pass a gate.
- [ ] Continuo and imitative domains retain their distinct relationship evaluators rather than a generic music score.
- [ ] Each target has exact Instance, plans/search, API/Workbench, Audit/Card, notation, playback, mutations, and content-addressed regression evidence.
- [ ] Parity means equal evidence depth and honest target-specific dimensions, not identical features or thresholds.
- [ ] Evaluation, Golden, parity, render, playback, security/leak, and base receipts bind one compatible Generation System/evaluator set.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T60-cross-domain-evaluator-parity-closure.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T60-cross-domain-evaluator-parity-closure.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`; `npm run eval:parity`; the tracer's isolation, leak-canary, rights, and fake-provider cases through the focused command.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T60/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 21
- 22
- 25
- 26
- 39
- 41
- 47
- 52
- 56
