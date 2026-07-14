# Pre-HITL audit, independent review packages, and interlock

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U8, U9, U10

SPEC coverage: Slice 12 pre-HITL curation/readiness package and interlock

Requirement families touched: II-EXEC-012, II-MC-001, II-MC-026–035, II-RC-011

## What to build

Exhaust pre-HITL machine-executable work, audit its requirements and gates, enumerate candidate identities, and produce separate safe `ready-for-human` Vault curation/truth-review and maintainer-activation packages without choosing, freezing, activating, or exposing future held-out Works.

## Acceptance criteria

- [ ] Audit maps every applicable requirement to implementation/evidence commits, dependency digests, exact commands, outcomes, toolchains, and current compatibility; any gap blocks readiness.
- [ ] The curation/truth package defines curator/truth/evaluator/calibrator/operator roles, credential/conflict policy, coverage classes, acquisition/rights workflow, review tooling, invalidation/exhaustion/reserve protocol, and rerun procedure.
- [ ] Separate maintainer packages enumerate every proposed release/profile/default consequence, exact nonhistorical scope, limitations, conflicts, rights decisions, visible labels, and compatible manifest/policy/component identities; no package groups decisions whose authorized scopes may differ.
- [ ] The eligible candidate Generation System, compiler/packs, Catalog/manifest/policies, evaluator, execution policy, provider/runtime, and performance-profile identities are enumerated by digest for later independent freeze; T63 itself grants no qualification or human authority.
- [ ] Package contains no preselected held-out Work, truth, mutation, invalidation, reserve order/seed, or diagnostic in public storage.
- [ ] Technical interlock proves no real attempt can begin before T64 records the independent curator commitment, T102 records maintainer decisions, T105/T106 verify and adjudicate them, T82 records separate truth-review commitments, and T103 completes the selected-system freeze in the Vault.
- [ ] One typed `pre_hitl_ready` result is emitted only when the audit, curation/truth package, every separately scoped maintainer package, and the technical interlock are all current and passing; partial package readiness cannot unlock either human lane.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T63-pre-hitl-audit-curation-package-interlock.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T63-pre-hitl-audit-curation-package-interlock.spec.ts`; `npm run eval:fast`; `npm run eval:omr` when optical cases are in scope; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`; `npm run eval:parity`; `npm run review:validate`; `npm run perf:instrument-intelligence`; the tracer's isolation, leak-canary, rights, and fake-provider cases through the focused command.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T63/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

No exact held-out identity, asset, truth, expected observation, forbidden outcome, mutation, invalidation decision, reserve order/seed, direct private-data digest, or per-attempt diagnostic may enter this issue, Git, ordinary logs, or public evidence. Public receipts contain only random non-resolving IDs, public coverage classes, keyed non-resolving Vault commitments, digests of already-public artifacts, bounded aggregate states, exact public Claim Scopes, and typed bounded diagnostics. Exact private review forms/artifacts remain in authorized local storage or the Owner Evaluation Vault as applicable.

## Blocked by

- 15
- 16
- 20
- 39
- 41
- 58
- 61
- 62
- 96
- 97
- 98
- 99
