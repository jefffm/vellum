# Server-minted provider boundary

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U10

SPEC coverage: Rights, access, processing, and egress; Slice 0 provider guard; Machine Complete egress clause

Requirement families touched: II-SRC-002, II-EXEC-000, II-MC-003, II-NG-001, II-EXEC-000A

## What to build

Replace the generic client-supplied production provider stream with a server-minted Model Action → Egress Envelope → atomic Result-and-Commit publication path. Provider authentication authorizes use of a provider account; a separate, purpose-bound server decision authorizes the exact data egress for this action.

## Acceptance criteria

- [ ] Client input cannot choose arbitrary prompts, destination, workspace context, tools, capabilities, or canonical result identity.
- [ ] Forged context, cross-workspace access, prompt injection, destination substitution, tool escalation, denied egress, response mismatch, replay, and unrelated-result commits fail safely.
- [ ] The Owner sees the exact destination, purpose, data classes and source references selected for egress before authorization; provider sign-in or subscription state alone never grants permission to send those data.
- [ ] A validated provider result and its server-issued Result Commit are staged and published atomically, binding action, envelope, response, tools, validation, and canonical output; no reader can observe either half alone.
- [ ] Private references default to no egress; denial or withdrawn authorization is visible and retryable without leaking content into logs or diagnostics.
- [ ] A real browser path can request an authorized model action and observe a typed success or safe denial.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T02-server-minted-provider-boundary.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T02-server-minted-provider-boundary.spec.ts`; the tracer's adversarial security/fake-provider suite through the focused Vitest command above.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the production browser shows the exact egress disclosure, independently authorizes or denies it, and either reloads one atomically committed result or proves that neither result nor commit became visible.
- Evidence: `../evidence/T02/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 01
