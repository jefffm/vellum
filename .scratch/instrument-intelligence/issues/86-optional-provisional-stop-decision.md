# Optional Owner provisional-stop decision

Status: ready-for-human

Type: HITL

Initial execution eligibility: conditional

Completion semantics: decision-recorded

User stories: U10

SPEC coverage: Explicit provisional stopping point

Requirement families touched: II-EXEC-014C, II-RC-011

## What to build

Allow the Owner to record an explicit decision to pause after Machine Complete when human release evidence is failed, incomplete, or intentionally deferred. This is optional and never satisfies the wave goal or Release Complete.

## Acceptance criteria

- [ ] Decision binds current T85 Machine Complete, T81 package, the current review-state snapshot, T69 result when one exists, every deferred/unresolved finding, affected Claim Scopes, and exact system/qualification/package identities.
- [ ] UI states plainly that output remains provisional, names every missing/failed/stale authority dimension, and offers resume/rerun paths; it never changes review states, activation, release authority, or requirement evidence.
- [ ] Owner identity, decision time, rationale, scope, and any expiry/revisit condition are immutable and reloadable; a successor decision supersedes rather than mutates it.
- [ ] Public receipt may state only that provisional stopping was chosen, typed bounded reason/status codes, and public requirement/status IDs. Private rationale and review detail remain private.
- [ ] Completion records the decision only. Verifier proves T86 can never satisfy T87, any II-RC clause, or the overall goal judge.
- [ ] The current unsuperseded stop emits exact result `provisional_stop_current`. Only a passing, currently authorized Owner successor with exact result `provisional_stop_resumed` may supersede that precise stop generation; arbitrary result strings, failed/blocked decisions, automation, and mere absence of a receipt cannot clear it.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T86-optional-provisional-stop-decision.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T86-optional-provisional-stop-decision.spec.ts`; `npm run review:validate`.
- Toolchain: record Owner-auth/session, browser, decision schema, manifest/verifier, OS, and exact closure/package/review identities.
- Observable outcome: record/reload a provisional stop and prove release/export labels and the goal judge remain noncomplete.
- Evidence: `../evidence/T86/verification.json` plus redacted decision receipt; private rationale remains private.

## Public/Vault boundary

Public evidence contains an opaque decision ID, digest only of the already-public bounded receipt, timestamp, provisional status, public requirement/status IDs, and typed bounded reason codes. Exact held-out/review material, direct private-decision digests, private rationale, credentials, and diagnostics remain private/Vault data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":81,"generation":"current","field":"resultCode","operator":"eq","expected":"review_package_ready"}]}`

- T85 Machine Complete is current.
- T81 packages are current, and either T69 is finalized but nonpassing or the exact review-state snapshot records intentional deferral; the Owner then explicitly elects to pause rather than continue.

## Blocked by

- 81
- 85
