# Lyric-review applicability adjudication

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U3, U8, U10

SPEC coverage: Slice 14 machine applicability decision before conditional lyric HITL

Requirement families touched: II-MUS-003, II-EXEC-014F, II-RC-006

## What to build

Determine from the unchanged T81 Claim Scopes and canonical/package content whether qualified lyric-underlay review is applicable. Emit a typed applicability receipt; never ask a human to attest N/A and never treat N/A as a passing acceptance result.

## Acceptance criteria

- [ ] Inspect every package's claimed sung text, textual alignment, verses/syllables/elisions/melismas/extenders, source lineage, exports, playback, and visible labels under the exact selected acceptance profile.
- [ ] Emit applicability `applicable` and result code `lyrics_applicable` with exact bounded scope when any lyric alignment is claimed or present; this makes T94 eligible and blocks T69 until its current human attempt finalizes.
- [ ] Emit applicability `not_applicable` and result code `lyrics_not_applicable` only when machine-verifiable package and Claim Scope evidence prove no sung-text/alignment dimension is claimed; include a clause-specific rationale without fabricating a human pass.
- [ ] Contradictory or stale evidence emits acceptance `blocked` with explicit result code `lyrics_applicability_blocked`; missing or unfinished evidence emits acceptance `incomplete` with explicit result code `lyrics_applicability_incomplete`. Neither result offers or requires T94, and both finalize this attempt so T69 can route package correction through T81 or the earliest affected slice.
- [ ] Changed package, source, profile, or Claim Scope invalidates the receipt and any dependent T94/T69 generation.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T107-lyric-review-applicability-adjudication.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; focused claimed-lyrics, verified-no-lyrics, contradictory, stale-package, privacy, and downstream-eligibility cases.
- Toolchain: record applicability schema/verifier, Claim Scope/package/canonical schemas, Node/npm, OS, and exact package generations.
- Observable outcome: reload `lyrics_applicable`, `lyrics_not_applicable`, `lyrics_applicability_blocked`, and `lyrics_applicability_incomplete` decisions; prove only the first offers T94, while each other code reaches T69 without fabricating a lyric-review attempt.
- Evidence: `../evidence/T107/verification.json` plus typed bounded public applicability receipts; private text/source material remains authorized private/Vault data.

## Public/Vault boundary

Public evidence contains only opaque package/applicability IDs, keyed non-resolving Vault commitments, public Claim Scope, applicability enum, bounded rationale code, and digests of already-public artifacts. Exact copyrighted/private text, held-out identity/truth, direct private-content digests, and diagnostics remain Vault/private data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- T81 package generation is current, unchanged, and complete enough to decide applicability without hidden inference.

## Blocked by

- 81
