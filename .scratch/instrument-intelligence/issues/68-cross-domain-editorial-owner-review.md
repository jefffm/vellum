# Cross-domain, editorial, and Owner review

Status: ready-for-human

Type: HITL

User stories: U1, U2, U3, U7, U9, U10

SPEC coverage: Slice 14 review package; Release Complete cross-domain clauses

Requirement IDs: II-RC-001–002, II-RC-005–007, II-RC-010

## What to build

Review exact metadata/rights/source truth, historical claims/profiles, shared musical dimensions, Continuo, imitative intabulation, engraving/playback, and cross-target Owner usefulness over unchanged digest-bound packages.

## Acceptance criteria

- [ ] Qualified review covers metadata/rights, transcription/extraction, release/attestation scope, Source Voices, harmony, transposition, lyrics/spanners where claimed, and unresolved dimensions.
- [ ] Historical keyboard-continuo reviewer assesses exact soprano-plus-harpsichord spacing/doubling/voice leading/disposition; any piano adaptation receives separate modern editorial review.
- [ ] Qualified imitative-intabulation reviewer assesses entries, subject shapes, voice continuity/exchange, cadence, realization, and six-course target fit.
- [ ] Engraving editor reviews all exact outputs; Owner reviews Guided Start, detail disclosure, alternatives, selection/edit/version/playback workflow, and cross-target usefulness.
- [ ] Every role/credential/scope/freshness, disagreement, limitation, digest, and rerun instruction validates; blockers route to tracer 69.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T68-cross-domain-editorial-owner-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T68-cross-domain-editorial-owner-review.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`; `npm run eval:parity`; `npm run review:validate`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T68/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

No exact held-out identity, asset, truth, expected observation, forbidden outcome, mutation, invalidation decision, reserve order/seed, or per-attempt diagnostic may enter this issue, Git, ordinary logs, or public evidence. Public receipts contain only opaque IDs, coverage classes, digests, aggregate status, exact claim scope, and redacted evidence. Exact private review forms/artifacts remain in authorized local storage or the Owner Evaluation Vault as applicable.

## Blocked by

- 64
