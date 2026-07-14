# Classical-guitar development acceptance

Status: ready-for-agent

Type: AFK

User stories: U6, U8

SPEC coverage: Classical-guitar acceptance; Golden fixtures; Slice 10.3

Requirement IDs: II-CG-006, II-EVAL-008, II-EXEC-010C, II-MC-018, II-MC-023–025

## What to build

Close classical-guitar development acceptance with the repaired disappearing-bass regression and a coequal semantic/render/playback Golden fixture.

## Acceptance criteria

- [ ] Known-bad bundle now passes voice activity, relationships, cadence, duration, joint mechanics, notation, and playback without weakening red evaluators.
- [ ] Golden fixture covers planned rests, stems, multi-segment ties, voice crossing, written-to-sounding octave, isolated voices, full score, and no duplicates.
- [ ] Principal voice remains recognizable and bass is a coherent independent voice rather than intermittent low notes.
- [ ] Canonical plans/mappings, standard notation, SVG/PDF, MIDI/Audio Preview, and playback following agree after reload.
- [ ] Test-only knowledge stays inactive by default; public development acceptance does not imply held-out or human idiom qualification.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T56-classical-guitar-development-acceptance.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T56-classical-guitar-development-acceptance.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T56/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 35
- 55
