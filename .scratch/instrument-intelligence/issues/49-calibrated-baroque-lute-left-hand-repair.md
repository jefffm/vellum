# Calibrated baroque-lute left-hand repair

Status: ready-for-agent

Type: AFK

User stories: U2, U5

SPEC coverage: Exact lute configuration; joint left-hand search; Slice 9.2

Requirement IDs: II-BL-001–002, II-SEED-002, II-EXEC-009B, II-MC-022

## What to build

Use Mace plus one scoped normative and one repertoire path to repair the known reach with calibrated two-dimensional left-hand contact and transition geometry for an exact thirteen-course Instrument Instance.

## Acceptance criteria

- [ ] Exact course/stringing, scale, fret geometry, hand/finger contacts, preparation, held notes, barré where applicable, release, and transition trajectories drive whole-phrase search.
- [ ] The pinned `f`/`b` realization is rejected and a closer musically equivalent mapping preserves voice/harmony/relationship obligations.
- [ ] Missing or low-confidence calibration yields incomplete physical evidence rather than a default pass.
- [ ] Mace, normative, repertoire, modern pedagogy, software, and Owner ergonomic evidence stay separately scoped; test-only historical releases remain inactive by default.
- [ ] Workbench compares exact alternatives and explains musical/physical tradeoffs under the selected instance and tempo/reliability context.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T49-calibrated-baroque-lute-left-hand-repair.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T49-calibrated-baroque-lute-left-hand-repair.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T49/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 11
- 14
- 48
