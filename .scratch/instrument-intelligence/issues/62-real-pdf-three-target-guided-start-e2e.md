# Real PDF-to-three-target Guided Start E2E

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U4, U5, U6, U9

SPEC coverage: Owner experience; Slice 12 real workflow; Machine Complete browser clause

Requirement families touched: II-OUT-001, II-OUT-003, II-UX-001–004, II-EXEC-012, II-MC-001, II-MC-035–036, II-NG-012

## What to build

Carry one rights-cleared real PDF through Guided Start, consequential source review, three coequal target candidates, alternatives, adoption, score selection, manual edits, playback following, history, interruption, and rehydration.

## Acceptance criteria

- [ ] Start widget guides source upload/acquisition and output formats, then shows OCR threshold only when optical review is actually active.
- [ ] Consequential uncertainty is reviewable at readable scale without covering the note; accepted review advances rather than looping.
- [ ] All three target siblings use exact plans/instances/manifests, produce alternatives, notation/playback, Cards/audits, and independent Adoption Decisions.
- [ ] The T99 selection-aware prompt/edit/version path, Audio Preview, and unobtrusive play-position marker operate on each selected target and survive reload.
- [ ] The T97 interruption path rehydrates completed siblings, retries only incomplete work, creates no duplicate versions, and opens the selected score within the release floor; the T96 rights-purge and T98 legacy-regeneration states remain reachable without contaminating this clean E2E.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T62-real-pdf-three-target-guided-start-e2e.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T62-real-pdf-three-target-guided-start-e2e.spec.ts`; `npm run eval:fast`; `npm run eval:omr`; `npm test -- src/server/lib/omr.real-smoke.test.ts` with any skip recorded as blocked, never pass; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`; `npm run eval:parity`; `npm run perf:instrument-intelligence`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T62/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

No exact held-out identity, asset, truth, expected observation, forbidden outcome, mutation, invalidation decision, reserve order/seed, direct private-data digest, or per-attempt diagnostic may enter this issue, Git, ordinary logs, or public evidence. Public receipts contain only random non-resolving IDs, public coverage classes, keyed non-resolving Vault commitments where private material is involved, digests of already-public artifacts, bounded aggregate states, exact public Claim Scopes, and typed bounded diagnostics. Exact private review forms/artifacts remain in authorized local storage or the Owner Evaluation Vault as applicable.

## Blocked by

- 47
- 52
- 56
- 58
- 59
- 60
- 96
- 97
- 98
- 99
