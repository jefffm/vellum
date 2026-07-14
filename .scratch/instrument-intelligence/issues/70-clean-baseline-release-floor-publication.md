# Clean baseline and release-floor publication

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U10

SPEC coverage: Performance and operability acceptance; Slice 0 clean-baseline derivation

Requirement families touched: II-OPS-001, II-EXEC-000, II-MC-034, II-MC-037

## What to build

Apply the exact policy committed by tracer 04 to a recorded clean supported baseline and publish immutable `performance.release-floor.v1` workloads, hardware classes, numeric thresholds, and comparison rules before optimization or qualification output is observed.

## Acceptance criteria

- [ ] The policy/schema commit and digest predate every measurement receipt; this tracer does not edit the policy, workload generators, aggregation, safety margins, or replacement rules after observing results.
- [ ] A clean-state run records raw observations, repetitions, stage boundaries, Node/npm/Nix/musical/provider/runtime identities, OS, hardware class, resource locks, cancellation behavior, and environmental noise/incomparability reasons.
- [ ] The pinned profile deterministically derives numeric thresholds for stage time, peak memory, persisted bytes, Inventory/Catalog/Manifest size, candidate frontier/checkpoint size, cancellation response, checkpoint interval, resume overhead, and redacted diagnostics where applicable.
- [ ] Unsupported or materially different hardware/toolchains compare as `blocked` or explicitly `incomparable`; a narrower later profile cannot replace or satisfy this mandatory release floor.
- [ ] Raw measurements, derivation inputs, profile, and gate-matrix schema are content-addressed and replay to identical thresholds; mutation or threshold loosening creates a new identity and invalidates dependent evidence.
- [ ] Shared Podman, Audiveris, fixed-port, and mutable-store measurements hold declared resource locks, clean up only proven-orphan state, and pass a clean rerun.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T70-clean-baseline-release-floor-publication.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run perf:instrument-intelligence` under the hardware/toolchain class pinned by tracer 04.
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, hardware, resource-lock, clean-state, and measurement-policy identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: a clean run deterministically publishes `performance.release-floor.v1`; a post-measurement policy edit, unsupported host, or perturbed raw observation fails comparison rather than silently passing.
- Evidence: `../evidence/T70/verification.json` plus its digest-bound raw observations, derivation receipt, profile, and redacted artifacts.

## Public/Vault boundary

Public planning and verification contain only rights-approved development identifiers and closed-schema bounded receipts. Owner-private or held-out identity, truth, paths, direct private-data digests, mutations, reserve state, and diagnostics remain private/Vault data; unknown public evidence fields and unlisted artifacts fail closed.

## Blocked by

- 04
