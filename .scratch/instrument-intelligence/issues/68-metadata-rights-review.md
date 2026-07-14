# Metadata and rights review

Status: ready-for-human

Type: HITL

Initial execution eligibility: blocked

Completion semantics: attempt-finalized

User stories: U1, U2, U3, U8, U10

SPEC coverage: Slice 14 metadata and rights review

Requirement families touched: II-SRC-001–002, II-BND-008, II-RC-013

## What to build

Have a scope-qualified metadata/rights reviewer assess every exact source and derivative in the T81 package. This tracer does not review transcription, historical claims, musical idiom, engraving, or Owner usefulness.

## Acceptance criteria

- [ ] Reviewer identity, metadata/rights credential, jurisdiction/scope, freshness, conflicts, and authority source validate independently.
- [ ] Review covers Work/Edition/File identity, acquisition/provider record, rights basis, repository inclusion, redistribution, remote-processing authorization, retention/deletion obligations, derivative lineage, and every deliverable's permitted use.
- [ ] Review binds unchanged T81 package plus source, file, extraction, pack, qualification, score, export, and redistribution digests; uncertainty remains `incomplete`, never inferred from public-domain composition status alone.
- [ ] Each finding and `pass`/`fail`/`blocked`/`incomplete` result is an immutable independent attestation. A failed rights decision blocks release but does not erase the attempt or wait for repair here.
- [ ] Completion means the review attempt is finalized; findings route to T69.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T68-metadata-rights-review.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run review:validate`; the focused rights, derivative-graph, egress, purge, and public-leak cases.
- Toolchain: record review UI, credential verifier/policy, jurisdiction profile, provider, OS, and exact package identities.
- Observable outcome: submit/reload the real digest-bound rights review and prove denied/unknown uses fail closed across export and provider egress.
- Evidence: `../evidence/T68/verification.json` plus a redacted attestation receipt; exact rights evidence remains authorized private review data.

## Public/Vault boundary

Public evidence contains only opaque source/package/attestation IDs, keyed non-resolving Vault commitments, digests of already-public artifacts, declared jurisdiction/scope, reviewer-role validity, bounded aggregate decision, permitted-use categories, and typed bounded rationale. Exact held-out identities/assets, direct private-package digests, private contracts, credentials, reserve state, and per-case diagnostics remain Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- The role-specific T81 package is current, unchanged, and authorized for this reviewer capability.

## Blocked by

- 81
