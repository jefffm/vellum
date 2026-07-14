# Whole-instrument right hand and diapasons

Status: ready-for-agent

Type: AFK

User stories: U5

SPEC coverage: Diapasons, resonance, and right hand; Slice 9.2

Requirement IDs: II-BL-003–004, II-EXEC-009B, II-MC-022

## What to build

Extend lute phrase search across the whole instrument with calibrated plucking-zone, course spacing, diapason/bass-rider access, digit preparation, simultaneity, alternation, crossing, thumb, resonance, damping, and stopped↔diapason transitions.

## Acceptance criteria

- [ ] Right-hand state allocates every attack and preparation under exact course/plucking geometry, not a local post-process.
- [ ] Diapasons are independent course resources with tuning, resonance, damping, access path, notation identity, and transition state.
- [ ] Stopped doubled-course attacks and stopped-course-to-diapason transitions preserve exact constituent pitches and gesture timing.
- [ ] Impossible allocation, simultaneity, alternation, crossing, thumb, access, preparation, stale resonance, and damping mutations fail independently.
- [ ] Notation, Audio Preview, isolated playback, Card, audit, and Workbench expose the same whole-instrument state.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T50-whole-instrument-right-hand-diapasons.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T50-whole-instrument-right-hand-diapasons.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T50/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 49
