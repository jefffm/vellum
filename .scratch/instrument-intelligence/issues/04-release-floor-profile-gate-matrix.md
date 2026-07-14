# Release-floor profile and gate matrix

Status: ready-for-agent

Type: AFK

User stories: U10

SPEC coverage: Performance and operability acceptance; Slice 0 release-floor derivation

Requirement IDs: II-OPS-001, II-EXEC-000, II-MC-034, II-MC-037

## What to build

Commit the measurement and derivation policy before measuring, record a clean supported baseline, and publish versioned `performance.release-floor.v1` thresholds plus a machine-checkable per-tracer gate matrix.

## Acceptance criteria

- [ ] The policy fixes workloads, clean-state procedure, hardware classes, repetitions, aggregation, safety margins, metric units, and replacement rules before results are collected.
- [ ] The profile pins numeric thresholds for stage time, memory, persisted bytes, snapshot/manifest size, frontier/checkpoint size, cancellation, checkpoint interval, and resume overhead where applicable.
- [ ] Unsupported hardware or toolchain produces `blocked` or an explicitly incomparable result, never a silent pass.
- [ ] Every tracer can declare base and conditional gates, expected observable outcomes, tool identities, evidence paths, and justified `not_applicable` entries.
- [ ] Shared Podman, Audiveris, fixed-port, and mutable-store gates declare resource locks and serialize across parallel tracers; orphan cleanup requires proof that the owner is absent and a clean rerun.
- [ ] Silent profile replacement, post-measurement policy edits, or threshold loosening without a new identity invalidates evidence.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T04-release-floor-profile-gate-matrix.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run perf:instrument-intelligence` (created and pinned by tracer 04).
- Toolchain: record Node, npm, Nix, musical-tool, provider/fake-provider, OS, and hardware identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: the acceptance path is demonstrated through the production boundary named above, not only by schema/unit tests.
- Evidence: `../evidence/T04/verification.json` plus its digest-bound redacted artifacts.

## Blocked by

- 01
