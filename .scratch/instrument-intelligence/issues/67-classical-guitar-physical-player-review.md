# Classical-guitar physical target-player review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U6, U8, U10

SPEC coverage: Slice 14 target-player physical playtest; Release Complete target clauses

Requirement families touched: II-CG-006, II-RC-002–003

## What to build

Have a qualified six-string classical-guitar player physically test the exact digest-bound review artifact under its pinned Instrument Instance, performer context, brief, profile, tempo, and qualification. Idiom/editorial authority remains in T90/T93.

## Acceptance criteria

- [ ] Reviewer identity, target-instrument credential, scope, freshness, conflicts, instrument setup, and review conditions validate independently.
- [ ] Player tests exact joint-hand realization, reaches, barrés, preparation, holds/releases, right-hand resources, voice crossings, transitions, reliability, tempo, and fatigue, including hidden fingering assumptions.
- [ ] Review binds unchanged T81 package, source, instance, profile, pack, compiler, evaluator, qualification, score, playback, and deliverable digests.
- [ ] Every finding, limitation, disagreement, and `pass`/`fail`/`blocked`/`incomplete` result becomes an immutable independent attestation; physical success cannot compensate for failed voice, idiom, or editorial review.
- [ ] Completion means the review attempt is finalized even when it fails; findings route to T69 without blocking this tracer's finalization.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T67-classical-guitar-physical-player-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T67-classical-guitar-physical-player-review.spec.ts`.
- Toolchain: record review UI, credential verifier, browser, OS, exact package, instrument instance, and playback/render identities.
- Observable outcome: submit and reload the real digest-bound playtest and verify exact binding plus independent attestation state.
- Evidence: `../evidence/T67/verification.json` plus redacted attestation receipt; private notes remain authorized review storage.

## Public/Vault boundary

Public evidence contains only opaque package/attestation IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, reviewer-role validity, bounded aggregate status, public scope, and typed bounded findings. Exact held-out identity/truth, direct private-package digests, assets, private credentials, and per-case observations remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
