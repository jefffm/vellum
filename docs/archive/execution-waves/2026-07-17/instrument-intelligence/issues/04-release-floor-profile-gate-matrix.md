# Release-floor derivation policy and gate-matrix schema

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U10

SPEC coverage: Performance and operability acceptance; Slice 0 pre-measurement policy

Requirement families touched: II-OPS-001, II-EXEC-000, II-MC-034, II-MC-037, II-EXEC-000A

## What to build

Commit the immutable measurement/derivation policy and machine-checkable per-tracer gate-matrix schema before any clean-baseline measurement is collected. Tracer 70 applies this exact policy to publish `performance.release-floor.v1`.

## Acceptance criteria

- [ ] The policy fixes workloads, clean-state procedure, hardware classes, repetitions, aggregation, safety margins, metric units, redacted-diagnostic bounds, and replacement rules before results are collected.
- [ ] The derivation algorithm names every future threshold family: stage time, memory, persisted bytes, snapshot/manifest size, frontier/checkpoint size, cancellation, checkpoint interval, and resume overhead where applicable.
- [ ] Unsupported hardware or toolchain produces `blocked` or an explicitly incomparable result, never a silent pass.
- [ ] Every tracer can declare base and conditional gates, expected observable outcomes, tool identities, evidence paths, and justified `not_applicable` entries.
- [ ] Shared Podman, Audiveris, fixed-port, and mutable-store gates declare resource locks and serialize across parallel tracers; orphan cleanup requires proof that the owner is absent and a clean rerun.
- [ ] The committed policy and schema have stable digests consumed by tracer 70; no baseline result or numeric threshold is present in this tracer's commit.
- [ ] Silent policy replacement, post-measurement edits, or threshold loosening without a new identity invalidates evidence.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T04-release-floor-profile-gate-matrix.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: none; this tracer defines the performance command/schema but must not collect the clean baseline it governs.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the policy/schema validates independently and its repository commit predates every baseline measurement receipt consumed by tracer 70.
- Evidence: `../evidence/T04/verification.json` plus its digest-bound redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 01
