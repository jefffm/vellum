# Qualification scopes, roles, and provider policy

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U8, U10

SPEC coverage: Readiness tiers; dataset assignments; provider exposure; Slice 4

Requirement families touched: II-BND-003, II-EVAL-006, II-EXEC-004B, II-MC-019–020, II-MC-028–029

## What to build

Define exact Capability Qualification Claim Scopes, independent operational roles, deterministic/stochastic execution policies, and opaque-provider drift/expiry boundaries using only synthetic cases. Qualification judges an already committed Generation System and output; it does not rank, select, or adopt candidates.

## Acceptance criteria

- [ ] Claim Scope pins Generation System, profile closure, compiler/pack/policy/evaluator versions, provider conditions, workload envelope, coverage, exclusions, and unclaimed dimensions.
- [ ] Curator, truth reviewer, evaluator implementer, calibrator, and run operator are separate roles with credential/scope/conflict validation.
- [ ] Deterministic and repeated-trial stochastic policies retain every attempt; one favorable sample cannot pass a precommitted confidence rule.
- [ ] Provider/session exposure history binds each attempt; sentinel drift, version change, expiry, or unavailable evidence stales or blocks qualification.
- [ ] Qualification consumes immutable preordered output and Evaluation Cases only after output commit; it cannot mutate Search Measurements, Selection Policy, candidate order, Selection Decision, or Adoption Decision for the run it judges.
- [ ] UI and Evaluation Cards show narrow claims and unknowns without implying universal target-instrument capability.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T22-qualification-scopes-roles-provider-policy.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T22-qualification-scopes-roles-provider-policy.spec.ts`; `npm run eval:fast`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T22/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

This tracer uses synthetic cases only. Public evidence must obey the wave allowlist; exact case truth, mutations, invalidation decisions, reserve state, and per-attempt diagnostics remain in the test Vault and are represented publicly only by permitted opaque receipts.

## Blocked by

- 13
- 21
