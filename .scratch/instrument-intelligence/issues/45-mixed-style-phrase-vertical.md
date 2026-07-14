# Mixed-style phrase vertical

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U4

SPEC coverage: Mixed style; Slice 8.2

Requirement families touched: II-BG-001, II-BG-005, II-EXEC-008B, II-MC-021

## What to build

Realize a complete phrase that transitions between punteado and rasgueado/alfabeto while preserving the principal melody, harmony, hand/resource continuity, resonance, release, and damping.

## Acceptance criteria

- [ ] Technique transition is planned at a musically meaningful boundary and carried in phrase state rather than inferred after event selection.
- [ ] Principal Voice pitch/rhythm identity, phrase position, audibility/prominence thresholds, and exact harmonic obligations remain satisfied across single-note, partial, and strummed gestures; human musical intelligibility is assessed only in the later digest-bound reviews.
- [ ] Held harmony, preparation, release, resonance/damping, stroke masks, and left/right-hand transitions remain feasible under the exact instance.
- [ ] At least two non-dominated alternatives expose meaningful technique/texture/ergonomic compromises in Workbench and Audio Preview.
- [ ] Flattened mode, lost melody, impossible transition, stale hold, missing release, and duplicate attack mutations fail.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T45-mixed-style-phrase-vertical.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T45-mixed-style-phrase-vertical.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T45/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 44
