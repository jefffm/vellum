# Automatic sealed qualification run

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U3, U4, U5, U6, U7, U8, U10

SPEC coverage: Slice 13 automatic sealed execution

Requirement families touched: II-EVAL-005–006, II-EXEC-013C, II-MC-028–032, II-NG-010

## What to build

Run the frozen qualification automatically after T103 verifies the current human commitments and freezes the exact system, retain every attempt, and emit honest raw Evaluation Cards and receipts. This tracer finalizes an attempted run regardless of pass/fail/blocked/incomplete; adjudication and repair routing belong to T84.

## Acceptance criteria

- [ ] Interlock verifies the current `freeze_complete` T103 generation, including sufficient curator/truth commitments and verified maintainer consequence, before releasing source-only envelopes to sealed generation; generation cannot enumerate Vault truth, labels, reserves, reviewer notes, or prior diagnostics.
- [ ] Initial run attempts at least two independent non-Greensleeves contamination groups per target: baroque guitar covers punteado plus rasgueado or mixed transition with 2-D reach, Gesture Sequences, stroke/course masks, and alfabeto applicability; lute covers stopped polyphony, digit/simultaneity/alternation/crossing/thumb state, stopped-to-diapason transitions, diapason succession, resonance/damping, and exact French tablature; classical guitar covers coherent two-voice plus independent three-voice or contrapuntal writing.
- [ ] Dedicated non-Greensleeves groups cover soprano plus figured bass with an accidental and prepared suspension and a three-voice imitative source with ordered entries. At least one legally usable PDF or image case per target executes ingestion through deliverables; compiler-isolation cases may start from independently reviewed canonical transcription.
- [ ] Deterministic/provider-free or precommitted stochastic policy executes exactly: every sample/retry/timeout/failure counts, all outputs and attempts append durably, and provider/sentinel/retention/session validity boundaries are recorded.
- [ ] Runner emits tri-state hard gates, four-state acceptance, baseline comparability, exact Claim Scopes, and typed bounded public receipts. Finalization records exactly `attempt_pass`, `attempt_fail`, `attempt_blocked`, or `attempt_incomplete` without selecting convenient reserves or claiming Machine Complete.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T83-automatic-sealed-qualification-run.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run eval:fast`; `npm run eval:omr` for every optical-ingestion case; `npm test -- src/server/lib/omr.real-smoke.test.ts` with any skip recorded as blocked, never pass; `npm run eval:golden`; `npm run eval:parity`; `npm run perf:instrument-intelligence`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; focused isolation, Vault, rights, fake/real-provider, cancellation, CAS/fork, and leak-canary cases.
- Toolchain: record every frozen system/profile/evaluator/provider/runtime/performance identity, Node/npm/Nix/LilyPond/Audiveris, OS, hardware class, and execution-policy identity.
- Observable outcome: execute a disclosed synthetic sealed round with the same production orchestrator, including failures/cancellation, then reload every retained attempt and redacted receipt.
- Evidence: `../evidence/T83/verification.json` plus redacted run/Card receipts; exact case material and diagnostics remain Vault-only.

## Public/Vault boundary

Public output contains only opaque group/attempt IDs, coverage classes, public system/evaluator digests, keyed non-resolving source-envelope Vault commitments, aggregate gate/acceptance states, Claim Scopes, provider validity, and typed bounded errors. Exact assets, identities, direct source-envelope digests, truth, expected/forbidden observations, mutations, invalidation decisions, reserve order/seed, and per-attempt diagnostics remain exclusively in the Vault.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":103,"generation":"current","field":"resultCode","operator":"eq","expected":"freeze_complete"}]}`

- T103 result is current `freeze_complete`, with no open precommit/truth remediation.
- The frozen split manifest and source-envelope policy match the current T64/T82 commitments and T106 adjudication generation.

## Blocked by

- 61
- 103
