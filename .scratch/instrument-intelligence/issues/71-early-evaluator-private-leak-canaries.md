# Early evaluator and private-data leak canaries

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U8, U10

SPEC coverage: Slice 0 evaluator-input and public-repository canary guard

Requirement families touched: II-SRC-002, II-EVAL-002, II-EVAL-010, II-EXEC-000, II-MC-003, II-MC-026–027, II-NG-009

## What to build

Install fail-closed synthetic canaries at the current generation/evaluation executor and every public repository/evidence writer before later evaluation or Vault work begins. This early guard establishes the non-bypassable invariant; tracers 18 and 20 strengthen it with the full service and typed-receipt boundaries.

## Acceptance criteria

- [ ] Synthetic evaluator secrets placed in serialized cases, expected observations, mutations, baselines, labels, environment, prompts, filesystem paths, manifests, caches, and error payloads cannot enter generation inputs, provider egress, tools, Result Commits, logs, or diagnostics.
- [ ] Public writers, fixture generators, evidence reporters, builds, staged-diff checks, and repository scans reject synthetic held-out truth plus synthetic Owner-private paths, metadata, images/text/crops, and weak/direct content digests.
- [ ] The canary corpus includes encoded, compressed, nested, truncated, renamed, and weakly hashed variants; failures report only opaque canary IDs and locations, never the secret value.
- [ ] Required CI/gate entry points fail closed when the executor boundary, public writer, scanner, or canary corpus is absent, disabled, stale, or bypassed.
- [ ] No real held-out or Owner-private source material is introduced; test secrets are generated outside tracked files and destroyed after the run while exposure receipts remain bounded and non-resolving.
- [ ] Tracers 17–22 and every later evaluation/Vault tracer declare this guard as a satisfied dependency or fail eligibility verification.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T71-early-evaluator-private-leak-canaries.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: the tracer's adversarial executor, fake-provider, public-writer, and rights/private-leak suites through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, provider/fake-provider, OS, scanner/canary corpus, executor, and public-writer identities that materially affect the result; musical tools and hardware may be `not_applicable` only with rationale.
- Observable outcome: a clean synthetic run crosses the real executor and evidence-publication boundaries; injecting any canary variant blocks generation/publication before sensitive data becomes observable.
- Evidence: `../evidence/T71/verification.json` plus digest-bound bounded canary receipts that contain no secret values.

## Public/Vault boundary

This tracer uses generated synthetic secrets only. Public evidence may identify the canary class and aggregate result, but never its value, path-bearing private metadata, encoding variants, or per-attempt sensitive diagnostics.

## Blocked by

- 01
