# Conditional lyric-underlay review

Status: ready-for-human

Type: HITL

Initial execution eligibility: conditional

Completion semantics: attempt-finalized

User stories: U3, U8, U10

SPEC coverage: Slice 14 lyric review where claimed

Requirement families touched: II-MUS-003, II-RC-006

## What to build

Review lyric identity and underlay only when T107 has established that the selected T81 packages claim or render sung text. Machine applicability and `not_applicable` receipts belong exclusively to T107.

## Acceptance criteria

- [ ] Reviewer identity, language/text/underlay credential, source/profile scope, freshness, revocation, and conflicts validate independently from extraction reviewer, generator, evaluator/calibrator, and editor.
- [ ] When lyrics are in scope, review exact text/source identity, normalization, syllables/elision/melisma, occurrence-to-note mapping, repeats, spanners, notation, isolated/full playback alignment, rights, and uncertainty.
- [ ] T107 must already have recorded applicability `applicable`; this reviewer is never asked to bless N/A or silent omission inside the HITL tracer.
- [ ] Immutable private attestation binds unchanged T81 package and source/text/truth/score/render/playback digests and records disagreements, limitations, authorized private notes, and typed bounded public findings.
- [ ] Attempt finalizes for `pass`, `fail`, `blocked`, or `incomplete` and routes blocking findings to T69.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T94-conditional-lyric-underlay-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T94-conditional-lyric-underlay-review.spec.ts`; applicable render/playback and rights tests.
- Toolchain: record review UI, credential verifier, text normalization schema, browser, renderer/playback, OS, and exact package identities.
- Observable outcome: submit/reload an in-scope lyric review and prove a T107 `not_applicable` package never offers or requires this human form.
- Evidence: `../evidence/T94/verification.json` plus a redacted independent attestation receipt.

## Public/Vault boundary

Public evidence contains only opaque package/attestation/text IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, declared role/scope, bounded aggregate state, and typed bounded findings; copyrighted/private text, exact held-out identity/truth, direct private-content digests, credentials, notes, and diagnostics remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":107,"generation":"current","field":"resultCode","operator":"eq","expected":"lyrics_applicable"}]}`

- T107 is current `lyrics_applicable` for the unchanged T81 package; a T107 `not_applicable` result keeps this optional human branch unexecuted.

## Blocked by

- 107
