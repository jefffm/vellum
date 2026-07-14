# Lyric Underlay vertical

Status: ready-for-agent

Type: AFK

User stories: U3

SPEC coverage: Lyrics and text underlay; Slice 5

Requirement IDs: II-MUS-003, II-EXEC-005A, II-MC-013, II-RC-006

## What to build

Carry a rights-cleared vocal fixture through optical/manual review into versioned Lyric Underlay, arrangement lineage, engraving, score following, playback position, correction, and reload.

## Acceptance criteria

- [ ] Verse order, syllables, word boundaries, hyphenation, elision, melisma, extender geometry, language, and note/voice anchors round-trip.
- [ ] Corrections create a successor underlay with exact source citation and stale only affected dependent outputs.
- [ ] Requested sung text remains attached through arrangement, notation, playback following, manual edit, version history, and export.
- [ ] Missing/duplicate syllable, wrong verse, broken anchor, melisma/extender, and voice-assignment mutations fail independently.
- [ ] Workbench distinguishes transcribed truth, uncertain text, editorial adaptation, omitted text, and unreviewed underlay.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T25-lyric-underlay-vertical.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T25-lyric-underlay-vertical.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T25/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 23
