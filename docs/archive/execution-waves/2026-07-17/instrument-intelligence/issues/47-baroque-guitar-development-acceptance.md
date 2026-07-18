# Baroque-guitar development acceptance

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U4, U8

SPEC coverage: Baroque-guitar acceptance; Golden fixtures; Slice 8.4

Requirement families touched: II-BG-007, II-EVAL-008, II-EXEC-008D, II-MC-018, II-MC-021, II-MC-023

## What to build

Close baroque-guitar development acceptance with a new repaired Greensleeves generative regression and a coequal semantic-to-rendered-to-sounding Golden fixture while retaining the original bad artifact as permanently failing evidence.

## Acceptance criteria

- [ ] The immutable T42 bad-output bundle still produces its pinned failures; a separate generative regression binds the same disclosed source/input plus old-system run digest, repaired-system run/output digests, and unchanged evaluator identities, proving old generation fails and new generation passes.
- [ ] Golden fixture covers punteado, alfabeto, up/down rasgueado, edge suppression, paired constituents, technique transition, hold/release, resonance, and damping.
- [ ] Canonical semantics, tablature/notation, PDF/SVG, MIDI/Audio Preview, and playback-following marker agree with no duplicate constituents.
- [ ] Default Guided Start cannot activate test-only historical knowledge and displays exact readiness/unknowns.
- [ ] Public development acceptance makes no held-out or human-playability claim.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T47-baroque-guitar-development-acceptance.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T47-baroque-guitar-development-acceptance.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T47/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 35
- 46
