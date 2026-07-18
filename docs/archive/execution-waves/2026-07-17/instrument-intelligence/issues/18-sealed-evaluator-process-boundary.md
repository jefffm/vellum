# Sealed evaluator process boundary

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U8, U10

SPEC coverage: Generator/evaluator separation; enforced isolation; Slice 4

Requirement families touched: II-EVAL-002, II-EXEC-004A, II-MC-026, II-NG-001, II-EXEC-004D

## What to build

Run generation and evaluation under separate OS/service principals and deny generation every evaluator capability. Generation receives only a server-built Generation Input Envelope, commits output before evaluator startup, and is identified by the full transitive Generation System closure that could reveal or fit an expected answer.

## Acceptance criteria

- [ ] Generation receives only authorized source/plan/profile inputs and no evaluator case ID, path, environment, prompt, manifest truth, mutation, baseline, or Vault capability.
- [ ] Candidate bytes and identity commit before evaluator-only data is loaded by a separately sandboxed process/service principal.
- [ ] OS/service policy denies generation Vault/evaluator filesystem roots, database credentials, environment, arbitrary IPC, process inspection, inherited handles, evaluator-only network endpoints, and log/cache/diagnostic channels; application-level omission alone is insufficient.
- [ ] Canaries in file paths, environment, IPC, logs, error messages, cache keys, prompts, databases, inherited descriptors, and service endpoints are unreadable from generation.
- [ ] Generation System identity pins the transitive closure of source analysis, planning, prompts, activated packs/examples, compilers, search and fitted parameters, Selection Policy, model/provider configuration, runtime, and every upstream consumer capable of revealing or fitting expected answers.
- [ ] Unavailable or failed evaluation yields blocked/incomplete and a retryable record, never skipped gates or automatic adoption.
- [ ] Fake provider and hostile output tests prove evaluator payloads cannot be exfiltrated through tools, diagnostics, or Result Commit.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T18-sealed-evaluator-process-boundary.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run eval:fast`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T18/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 02
- 17
- 71
