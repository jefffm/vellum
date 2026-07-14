# Engraving and playback editorial review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U4, U5, U6, U7, U8, U10

SPEC coverage: Slice 14 engraving-editor and playback review

Requirement families touched: II-MUS-005, II-RC-007

## What to build

Have a qualified engraving editor review exact notation, tablature, rendered deliverables, playback, and score following across the three targets plus Continuo and imitative outputs.

## Acceptance criteria

- [ ] Reviewer identity, engraving/notation credential and target-notation scopes, freshness, revocation, and conflicts validate independently from generator, renderer implementer, evaluator/calibrator, and musical reviewers.
- [ ] Review covers canonical-to-LilyPond-to-SVG/PDF identity, standard-notation voices/rests/stems/ties/spanners/crossings/octave, French tablature signs/placement, alfabeto/gesture legibility, constituent pitches/attacks/releases, full/isolated playback, and unobtrusive score-following markers.
- [ ] Review explicitly checks overlays do not cover notes/tab, glyphs remain readable at usable scale, playback markers follow the correct occurrence, and MIDI/Audio Preview neither duplicates nor omits constituents.
- [ ] Immutable attestation binds unchanged T81 package and exact semantic/render/toolchain/playback/output digests and records per-target `pass`/`fail`/`blocked`/`incomplete` dimensions without musical-authority substitution.
- [ ] Attempt finalizes even when nonpassing and routes findings to T69.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T93-engraving-playback-editorial-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T93-engraving-playback-editorial-review.spec.ts`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record review UI, credential verifier, browser/viewport, Nix/LilyPond, MIDI/audio engine, OS, and exact package/render/playback identities.
- Observable outcome: inspect/play/reload every exact artifact and submit a digest-bound per-target editorial attestation.
- Evidence: `../evidence/T93/verification.json` plus redacted independent attestation receipt and permitted visual/playback evidence.

## Public/Vault boundary

Public evidence contains only opaque package/attestation/render/playback IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, role/scope validity, bounded aggregate per-target status, and explicitly rights-cleared bounded screenshots. Exact held-out source/truth, direct private-package/render/playback digests, private pages/audio, credentials, notes, and diagnostics remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
