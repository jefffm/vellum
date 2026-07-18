# Rights restriction, deletion, and derivative purge

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U9

SPEC coverage: Rights/deletion lifecycle and complete derivative graph; Slice 11

Requirement families touched: II-BND-002–008, II-KNW-007, II-EXEC-011, II-MC-004–005, II-MC-035–036, II-EXEC-011C

## What to build

Implement a fail-closed rights restriction/deletion workflow that maps every derivative, preserves only authorized tombstone/proof material, purges forbidden bytes across capabilities, and prevents old lineage from reactivating deleted content.

## Acceptance criteria

- [ ] Impact traversal covers original bytes, Page Atlas/crops/OCR/transcriptions/citations, normalized and derived knowledge, releases/attestations/manifests, analyses/plans/searches/scores, caches/indexes, exports, logs/telemetry, provider payload/results, encrypted backups, and every target sibling.
- [ ] Rights policy determines retain, redact, cryptographic erase, provider deletion request, or authorized tombstone per artifact and jurisdiction/scope; composition public-domain status cannot imply edition/file/remote-processing/redistribution rights.
- [ ] Purge is atomic/idempotent/resumable, records durable redacted proof, invalidates affected evidence/activation, removes keys and forbidden backup/index/cache material, and fails closed on unreachable or unverifiable stores.
- [ ] Legacy IDs remain as non-resolving authorized tombstones only where permitted; old URLs, manifests, checkpoints, caches, exports, and regeneration paths cannot reconstruct or reactivate forbidden bytes.
- [ ] Workbench shows affected work, policy basis, progress, blocked stores, retained tombstones, and safe recovery without leaking deleted data; adversarial aliases, nested blobs, encodings, and low-entropy digests do not escape classification.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T96-rights-deletion-derivative-purge.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T96-rights-deletion-derivative-purge.spec.ts`; focused migration, adversarial-security, rights-leak, provider deletion/fake-provider, backup/restore, cache/index, interruption, and purge cases.
- Toolchain: record Node/npm, rights policy/jurisdiction profile, storage/index/backup/provider identities, encryption/key policy, browser, OS, and exact derivative-graph schema.
- Observable outcome: create a rights-cleared disclosed derivative graph, revoke one use, interrupt/resume purge, reload, and prove no forbidden bytes or old-path reconstruction remain.
- Evidence: `../evidence/T96/verification.json` plus digest-bound redacted purge/tombstone receipts.

## Public/Vault boundary

Public evidence contains only opaque source/operation IDs, policy category, affected artifact classes/counts, keyed non-resolving Vault commitments, digests of already-public tombstone artifacts, bounded aggregate purge status, and typed bounded errors. Exact private/deleted bytes, direct private-content digests, held-out identity/truth, credentials, provider payloads, keys, backup material, and path-level diagnostics remain protected or are destroyed according to policy.

## Blocked by

- 06
- 19
- 20
- 58
