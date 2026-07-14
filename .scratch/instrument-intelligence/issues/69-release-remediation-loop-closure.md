# Release remediation loop and closure

Status: ready-for-human

Type: HITL

User stories: U1, U2, U3, U4, U5, U6, U7, U8, U9, U10

SPEC coverage: Slice 14 remediation loop; completion boundary; Release Complete

Requirement IDs: II-EXEC-014B, II-RC-001–011

## What to build

Turn every blocking finding into a dependency-correct AFK repair, invalidate all affected evidence, repeat sealed and exact-artifact review as required, and declare only the closure state actually earned.

## Acceptance criteria

- [ ] Each finding maps to the earliest affected slice and creates a new local AFK remediation tracer before any dependent work continues.
- [ ] Impact analysis stales affected deterministic, performance, qualification, held-out, and human evidence; no attestation transfers to changed bytes.
- [ ] Any valid holdout that informed repair becomes a permanent disclosed regression; only the next precommitted reserve groups are consumed and all inherited failures rerun.
- [ ] Changed content creates a new release; review creates a new attestation; test-only authority never mutates into stronger authority.
- [ ] Release Complete is recorded only when every II-RC clause has current compatible evidence and no required dimension is unknown/incomplete/stale/test-only; otherwise record explicit provisional closure without relabeling it.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T69-release-remediation-loop-closure.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T69-release-remediation-loop-closure.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`; `npm run eval:parity`; `npm run review:validate`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T69/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

No exact held-out identity, asset, truth, expected observation, forbidden outcome, mutation, invalidation decision, reserve order/seed, or per-attempt diagnostic may enter this issue, Git, ordinary logs, or public evidence. Public receipts contain only opaque IDs, coverage classes, digests, aggregate status, exact claim scope, and redacted evidence. Exact private review forms/artifacts remain in authorized local storage or the Owner Evaluation Vault as applicable.

## Blocked by

- 65
- 66
- 67
- 68
