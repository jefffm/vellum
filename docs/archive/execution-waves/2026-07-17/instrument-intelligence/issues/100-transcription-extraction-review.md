# Source transcription and extraction review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U1, U3, U8, U10

SPEC coverage: Slice 14 source transcription/extraction review

Requirement families touched: II-SRC-001–009, II-RC-014, II-EXEC-014D, II-NG-010

## What to build

Have scope-qualified source readers review every consequential transcription and extraction used by the exact T81 packages, independently of musical-generation and evaluator roles.

## Acceptance criteria

- [ ] Reviewer identities, notation/language/source-type credentials, scope, freshness, revocation, and conflicts validate independently from extractor/OCR operator, pack author, generator, evaluator/calibrator, and downstream reviewers.
- [ ] Review checks Work/Edition/File/Page identity, Page Atlas coordinates, cited segments/crops, symbols/pitches/rhythms/voices/figures/accidentals/text/spanners, normalization, uncertainty, and complete lineage to canonical occurrences.
- [ ] Consequential uncertain readings are explicitly accepted/corrected/unresolved at readable scale; autoaccept thresholds and OCR confidence never substitute for source-reading authority.
- [ ] Immutable private attestations bind unchanged T81 package and exact source bytes/crops/extraction/canonical/source-truth digests and record `pass`/`fail`/`blocked`/`incomplete`, disagreements, authorized private notes, and typed bounded public findings per source domain.
- [ ] Attempt finalizes even when nonpassing and routes findings to T69 without editing source truth inside the attestation.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T100-transcription-extraction-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; `npm run test:browser -- test/browser/instrument-intelligence/T100-transcription-extraction-review.spec.ts`; `npm run eval:omr` and `npm test -- src/server/lib/omr.real-smoke.test.ts` when the reviewed package used optical ingestion (a skipped real smoke is blocked, never pass); applicable OCR, crop/zoom, notation, rights, and leak tests.
- Toolchain: record review UI, credential verifier, browser/viewport, PDF/image/OCR/Audiveris toolchain, OS, and exact package/source identities.
- Observable outcome: inspect/reload exact cited segments and submit independently bound correction/unresolved/pass attestations without exposing unrelated Vault material.
- Evidence: `../evidence/T100/verification.json` plus redacted attestation receipts; exact private crops/truth remain authorized review data.

## Public/Vault boundary

Public evidence contains only opaque source/package/attestation IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, declared role/scope, bounded aggregate status, and explicitly rights-cleared bounded crops/findings. Exact held-out identities/assets/truth, direct private-source/package digests, private pages, credentials, and diagnostics remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
