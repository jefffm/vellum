# Source-to-output musical-structure fidelity review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U3, U4, U5, U6, U7, U8, U10

SPEC coverage: Slice 14 Source Voice, Harmonic, Relationship, Transposition, and spanner exact-artifact review

Requirement families touched: II-MUS-002, II-MUS-004–008, II-RC-012

## What to build

Have scope-qualified musicians compare every unchanged T81 source/package/output pair and attest whether the planned source-to-output musical structure is actually preserved. This review is independent from transcription, target idiom/physical, Continuo/imitative specialization, and engraving review.

## Acceptance criteria

- [ ] Reviewer credentials and scopes cover source/target voice identity, harmony, relationships, transposition, ties, slurs, phrase marks, and source ornaments; conflicts, expiry, revocation, and role independence validate under T13.
- [ ] Review checks Principal Voice identity/prominence where applicable, every planned structural voice and rest span, coherent bass/harmonic function, inversion, harmonic rhythm, suspension/cadence obligations, ordered relationships, and explicit omission/compromise records against source and plans.
- [ ] Time- and part-scoped written/sounding transposition plus tie/slur/phrase/ornament lineage agree across canonical score, notation, and playback. Lyric alignment is delegated only to T94 when T107 declares it applicable.
- [ ] Immutable attestations bind the unchanged T81 source, Source Voice Graph, Target Voice/Harmonic/Relationship Plans, Transposition Plan, canonical events, score, playback, package, system, and qualification identities.
- [ ] Each dimension records `pass`, `fail`, `blocked`, or `incomplete` independently; the attempt finalizes without target-idiom, player, or engraving evidence compensating for structural loss and routes findings to T69.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T104-source-structure-musical-fidelity-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T104-source-structure-musical-fidelity-review.spec.ts`; applicable render, playback, isolated-voice, harmonic, transposition, and spanner comparison tools.
- Toolchain: record review UI, credential verifier, browser/viewport, canonical score/plan viewers, isolated playback/renderer, OS, and exact package identities.
- Observable outcome: submit and reload real dimension-scoped attestations over each target package, including a deliberately broken voice/harmony/transposition/spanner comparison that cannot be hidden by a good-looking render.
- Evidence: `../evidence/T104/verification.json` plus typed bounded public attestation receipts; exact private source/output comparisons remain authorized review data.

## Public/Vault boundary

Public evidence contains only opaque package/attestation IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, declared role/scope, bounded per-dimension states, and typed bounded findings. Exact held-out source/truth, direct private-package digests, credentials, notes, comparisons, and diagnostics remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
