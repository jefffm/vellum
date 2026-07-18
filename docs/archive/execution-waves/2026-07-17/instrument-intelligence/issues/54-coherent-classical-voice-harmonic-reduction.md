# Coherent classical voice and harmonic reduction

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U2, U6

SPEC coverage: Target Voice Plan; polyphonic search; seed program; Slice 10.2

Requirement families touched: II-CG-003–004, II-SEED-003, II-EXEC-010B, II-MC-024

## What to build

Use scoped Sor plus an aligned Carulli reduction to produce a true principal-voice-and-bass arrangement through explicit Voice/Harmonic/Relationship Plans and meaningful alternative reductions.

## Acceptance criteria

- [ ] Sor/Carulli evidence produces scoped test-only historical releases plus a separately classified maintainer nonhistorical consequence; neither becomes a universal rule.
- [ ] Principal and bass voices have exact roles, activity/rest spans, continuity, function/inversion/cadence obligations, prominence, and realized mappings.
- [ ] Reduction decisions are phrase/work-level, proportionate, inspectable, and do not fill events merely to satisfy density.
- [ ] At least two alternatives expose musical texture, register, mechanics, and voice-leading tradeoffs in Workbench and isolated playback.
- [ ] Dropped bass, invented continuous bass, wrong function/inversion, broken cadence, and hidden omission mutations fail.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T54-coherent-classical-voice-harmonic-reduction.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T54-coherent-classical-voice-harmonic-reduction.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, exact fixture/review-package, and credential-verification identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the exact production or review path named above and validate persisted/reloaded output rather than accepting a paper checklist.
- Evidence: `../evidence/T54/verification.json` plus digest-bound public redacted artifacts.

## Public/Vault boundary

Named development fixtures may be public only with verified rights. Future held-out material remains opaque and Vault-only; development evidence cannot be presented as sealed or human qualification.

## Blocked by

- 16
- 29
- 53
- 79
- 80
