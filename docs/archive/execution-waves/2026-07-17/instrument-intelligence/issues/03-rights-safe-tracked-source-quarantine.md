# Rights-safe tracked-source quarantine

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U10

SPEC coverage: Authority lanes; seed source program; Slice 0 tracked-source inventory; non-goals

Requirement families touched: II-BND-001, II-SRC-002, II-SEED-001, II-MC-004, II-NG-005–007, II-EXEC-000A

## What to build

Inventory every tracked source-derived table, fixture, prompt example, chart, overlay, and relevant Git-history disclosure. Record sourced rights/access decisions where they already exist and quarantine every unknown or authority-dependent use; automation must not manufacture a legal conclusion.

## Acceptance criteria

- [ ] The inventory records exact bytes/digests, derivation, current consumers, source identity, separate underlying-work and exemplar/scan status, repository-inclusion decision, redistribution decision, decision authority/evidence, and irreversible prior disclosure where applicable.
- [ ] The Tyler-derived universal chart and Foscarini overlay cannot influence production defaults until an authorized decision exists.
- [ ] Quarantined paths fail closed through old imports, prompts, tables, caches, and generated bundles.
- [ ] Unknown, conflicting, or unsourced rights remain explicitly `review_required`; automation neither calls them public domain nor converts local access into repository-inclusion or redistribution authority.
- [ ] Reviewed public-domain primary-source data with compatible exemplar rights, or an authorized local-only pack, can replace a quarantined path through an explicit provenance-substitution edge without being universalized.
- [ ] Tests prove a source-derived artifact with missing or incompatible rights cannot enter fixtures, prompts, exports, reports, or default generation.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T03-rights-safe-tracked-source-quarantine.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: the tracer's adversarial security/fake-provider suite through the focused Vitest command above; the tracer's rights/derivative-leak suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T03/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 01
