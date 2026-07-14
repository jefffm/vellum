# Public/Vault split and repository leak enforcement

Status: ready-for-agent

Type: AFK

User stories: U8, U10

SPEC coverage: Evaluation isolation; held-out acceptance; Slice 4 public ledger/Vault split

Requirement IDs: II-EVAL-002, II-EVAL-010, II-EXEC-004B, II-MC-026–027, II-NG-009

## What to build

Enforce the public/Vault ledger boundary at write, export, log, report, fixture, commit, and build time using synthetic canaries and a repository leak scanner.

## Acceptance criteria

- [ ] Public schemas allow only opaque case IDs, coverage classes, digests, aggregate status, and redacted evidence.
- [ ] Exact identities, truth, expected observations, forbidden outcomes, mutations, invalidation, reserve order/seed, and per-attempt diagnostics are rejected outside the Vault capability.
- [ ] Leak scanning covers tracked files, staged diffs, generated bundles, source maps, test snapshots, logs, reports, exports, caches, and public evidence.
- [ ] Canary variants encoded, compressed, hashed with weak identifiers, or nested in error payloads are detected without exposing the secret in scanner output.
- [ ] Build and qualification publication fail closed on a leak; cleanup records an exposure event rather than pretending it never occurred.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T20-public-vault-split-leak-enforcement.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run eval:fast`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T20/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

This tracer uses synthetic cases only. Public evidence must obey the wave allowlist; exact case truth, mutations, invalidation decisions, reserve state, and per-attempt diagnostics remain in the test Vault and are represented publicly only by permitted opaque receipts.

## Blocked by

- 19
