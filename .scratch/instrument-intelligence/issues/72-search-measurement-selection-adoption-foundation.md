# Search Measurement, Selection Policy, and Adoption Decision foundation

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3, U4, U5, U6, U8

SPEC coverage: Candidate output; search selection versus evaluation; Slice 4 canonical contracts

Requirement families touched: II-MUS-014–015, II-EVAL-001, II-EXEC-004A, II-MC-032

## What to build

Create canonical, versioned Search Measurement, Selection Policy, Selection Decision, and Adoption Decision storage and service boundaries before phrase/work search depends on them. Generator-visible selection remains distinct from independent evaluation, and only a passing immutable Adoption Decision may create the default Arrangement Score.

## Acceptance criteria

- [ ] Search Measurements are typed generator-visible facts/estimates with units, provenance, uncertainty, and measurement/component identity; evaluator-only expectations, baselines, held-out labels, and scores are schema- and capability-inaccessible.
- [ ] A versioned Selection Policy rejects hard constraints, compares survivors lexicographically by Preservation Target and Target Voice Plan priority, applies scoped preferences, retains material non-dominated alternatives, and forbids a hidden weighted total.
- [ ] Candidate order and Selection Decision commit immutably before independent evaluation; Evaluation Cards cannot rewrite measurements, policy, survivor set, order, or rationale.
- [ ] Adoption Decision pins search, candidate, committed order index, Evaluation Cards, required-gate policy, rationale, and resulting score; only `adopt` with every applicable independent gate complete and passing can atomically create the referenced default Arrangement Score.
- [ ] `reject` advances only along the precommitted survivor order; `blocked` leaves the candidate retryable and cannot skip to a convenient later candidate without an explicit Owner abandonment or new search.
- [ ] Held-out qualification can qualify/reject the sealed Generation System but cannot select or adopt candidates in the run it judges; reviewed findings affect only a later version through the reviewed-learning boundary.
- [ ] API and Workbench expose measurements, policy identity, order, alternatives, independent gates, and adopt/reject/blocked rationale without presenting selection as certification.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T72-search-measurement-selection-adoption-foundation.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T72-search-measurement-selection-adoption-foundation.spec.ts`; `npm run eval:fast`; the tracer's evaluator-isolation and transactional-publication cases through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, provider/fake-provider, OS, storage-generation, evaluator, and policy/component identities that materially affect the result; musical tools and hardware may be `not_applicable` only with rationale.
- Observable outcome: the production Workbench commits a fixed candidate order, records independent pass/fail/blocked cards without reordering it, and creates a reloadable default score only through a valid atomic Adoption Decision.
- Evidence: `../evidence/T72/verification.json` plus its digest-bound search, selection, evaluation, and adoption fixtures.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 17
- 22
