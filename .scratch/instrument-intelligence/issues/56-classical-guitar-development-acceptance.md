# Classical-guitar development acceptance

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U6, U8

SPEC coverage: Classical-guitar acceptance; Golden fixtures; Slice 10.3

Requirement families touched: II-CG-006, II-EVAL-008, II-EXEC-010C, II-MC-018, II-MC-023–025

## What to build

Close classical-guitar development acceptance with a new repaired disappearing-bass generative regression and a coequal semantic/render/playback Golden fixture while retaining the original bad output as permanently failing evidence.

## Acceptance criteria

- [ ] The immutable T53 bad-output bundle still produces its pinned failures; a separate generative regression binds the disclosed source/input, old-system run digest, repaired-system run/output digests, and unchanged evaluator identities, proving old generation fails and new generation passes.
- [ ] Golden fixture covers planned rests, stems, multi-segment ties, voice crossing, written-to-sounding octave, isolated voices, full score, and no duplicates.
- [ ] Principal-voice occurrences preserve pinned pitch/rhythm/phrase-position/prominence obligations, while the bass preserves reviewed identity, activity/rest, relationship, function, cadence, and duration obligations; perceptual recognizability and musical coherence remain reserved for later target-player/Owner review.
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
