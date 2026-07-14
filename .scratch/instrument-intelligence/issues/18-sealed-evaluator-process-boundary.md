# Sealed evaluator process boundary

Status: ready-for-agent

Type: AFK

User stories: U8, U10

SPEC coverage: Generator/evaluator separation; enforced isolation; Slice 4

Requirement IDs: II-EVAL-002, II-EXEC-004A, II-MC-026, II-NG-001

## What to build

Run generation and evaluation through separate capabilities: generation receives only a server-built Generation Input Envelope, persists output first, and cannot inspect evaluator cases, paths, labels, mutations, or baselines.

## Acceptance criteria

- [ ] Generation receives only authorized source/plan/profile inputs and no evaluator case ID, path, environment, prompt, manifest truth, mutation, baseline, or Vault capability.
- [ ] Candidate bytes and identity commit before evaluator-only data is loaded by a separate process.
- [ ] Canaries in file paths, environment, IPC, logs, error messages, cache keys, and prompts are unreadable from generation.
- [ ] Unavailable or failed evaluation yields blocked/incomplete and a retryable record, never skipped gates or automatic adoption.
- [ ] Fake provider and hostile output tests prove evaluator payloads cannot be exfiltrated through tools, diagnostics, or Result Commit.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T18-sealed-evaluator-process-boundary.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run eval:fast`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T18/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 02
- 17
