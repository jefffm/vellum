# Real PDF-to-three-target Guided Start E2E

Status: ready-for-agent

Type: AFK

User stories: U1, U4, U5, U6, U9

SPEC coverage: Owner experience; Slice 12 real workflow; Machine Complete browser clause

Requirement IDs: II-OUT-001, II-OUT-003, II-UX-001–004, II-EXEC-012, II-MC-001, II-MC-035–036, II-NG-012

## What to build

Carry one rights-cleared real PDF through Guided Start, consequential source review, three coequal target candidates, alternatives, adoption, score selection, manual edits, playback following, history, interruption, and rehydration.

## Acceptance criteria

- [ ] Start widget guides source upload/acquisition and output formats, then shows OCR threshold only when optical review is actually active.
- [ ] Consequential uncertainty is reviewable at readable scale without covering the note; accepted review advances rather than looping.
- [ ] All three target siblings use exact plans/instances/manifests, produce alternatives, notation/playback, Cards/audits, and independent Adoption Decisions.
- [ ] Selection-aware prompting, multi-note selection, batch manual edits, new version adoption, Audio Preview, and an unobtrusive play-position marker survive reload.
- [ ] Interruption/reload rehydrates completed siblings, retries only incomplete work, creates no duplicate versions, and opens the selected score within the release floor.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T62-real-pdf-three-target-guided-start-e2e.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T62-real-pdf-three-target-guided-start-e2e.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`; `npm run eval:parity`; `npm run perf:instrument-intelligence`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T62/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

No exact held-out identity, asset, truth, expected observation, forbidden outcome, mutation, invalidation decision, reserve order/seed, or per-attempt diagnostic may enter this issue, Git, ordinary logs, or public evidence. Public receipts contain only opaque IDs, coverage classes, digests, aggregate status, exact claim scope, and redacted evidence. Exact private review forms/artifacts remain in authorized local storage or the Owner Evaluation Vault as applicable.

## Blocked by

- 47
- 52
- 56
- 58
- 59
- 60
