# Server-minted provider boundary

Status: ready-for-agent

Type: AFK

User stories: U1, U10

SPEC coverage: Rights, access, processing, and egress; Slice 0 provider guard; Machine Complete egress clause

Requirement IDs: II-SRC-002, II-EXEC-000, II-MC-003, II-NG-001

## What to build

Replace the generic client-supplied production provider stream with a server-minted Model Action → Egress Envelope → Result Commit path that reconstructs authorized remote context and binds any accepted result to the exact attempt and canonical output.

## Acceptance criteria

- [ ] Client input cannot choose arbitrary prompts, destination, workspace context, tools, capabilities, or canonical result identity.
- [ ] Forged context, cross-workspace access, prompt injection, destination substitution, tool escalation, denied egress, response mismatch, replay, and unrelated-result commits fail safely.
- [ ] Provider results are validated and persisted only after a server-issued Result Commit binds inputs, response, tools, validation, and canonical output.
- [ ] Private references default to no egress; denial is visible and retryable without leaking content into logs or diagnostics.
- [ ] A real browser path can request an authorized model action and observe a typed success or safe denial.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T02-server-minted-provider-boundary.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T02-server-minted-provider-boundary.spec.ts`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T02/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 01
