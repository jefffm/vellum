# Joint-hand standard-notation vertical

Status: ready-for-agent

Type: AFK

User stories: U6

SPEC coverage: Exact target/performer; joint realization; notation/playback; Slice 10.2

Requirement IDs: II-CG-001–002, II-CG-004–005, II-EXEC-010B, II-MC-024–025

## What to build

Realize the coherent polyphonic plan with linked left- and right-hand phrase state for an exact instance/performer context, then emit first-class standard notation and isolated/full playback.

## Acceptance criteria

- [ ] Search state links left-hand contacts/transitions/barré/holds with right-hand p-i-m-a allocation, preparation, alternation, crossing, simultaneity, release, and phrase boundaries.
- [ ] Mechanics, player ergonomics, pedagogy, editorial convention, and historical claims remain separate inputs/evidence.
- [ ] Standard notation preserves stable voices, stems, planned rests, multi-segment ties, crossings, articulations/spanners, written-to-sounding octave identity, and hidden fingering evidence.
- [ ] Full and isolated voice playback preserve canonical voice/tie identity and no duplicate or missing occurrences.
- [ ] Impossible joint-hand, wrong digit, dropped rest, broken tie, crossing, octave, and voice-layer mutations fail.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T55-joint-hand-standard-notation-vertical.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T55-joint-hand-standard-notation-vertical.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T55/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 54
