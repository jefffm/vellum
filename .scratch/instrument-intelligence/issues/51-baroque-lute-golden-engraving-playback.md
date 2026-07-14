# Baroque-lute Golden engraving and playback

Status: ready-for-agent

Type: AFK

User stories: U5, U8

SPEC coverage: French tablature; Golden fixtures; Slice 9.3

Requirement IDs: II-BL-004–005, II-EVAL-008, II-EXEC-009C, II-MC-023, II-MC-025

## What to build

Re-run and strengthen the coequal lute Golden fixture so canonical course identity, French tablature glyph/placement, pitch, doubled constituents, transitions, and playback agree exactly.

## Acceptance criteria

- [ ] Course 10 engraves as `///a` and sounds D2 under the exact Bass Tuning; changing tuning alters pitch without changing the historical/editorial sign identity.
- [ ] The full `a`, `/a`, `//a`, `///a`, `4`, `5` sequence uses correct below-staff placement; no slash is prepended to `4` or `5`.
- [ ] A stopped doubled-course attack and stopped-course-to-diapason transition preserve exact constituents, timing, hold/release, and no duplicate playback.
- [ ] SVG/PDF visual assertions keep glyphs legible and playback markers unobtrusive; Workbench overlays do not cover tablature.
- [ ] Semantic, LilyPond, SVG/PDF, MIDI/Audio Preview, and isolated/full playback receipts share exact identities.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T51-baroque-lute-golden-engraving-playback.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T51-baroque-lute-golden-engraving-playback.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T51/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 35
- 50
