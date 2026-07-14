# Instrument Instance calibration and Workbench path

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U4, U5, U6, U9

SPEC coverage: Ergonomic context; Instrument Instance authoring/calibration; Slice 5

Requirement families touched: II-MUS-011–012, II-EXEC-005B, II-MC-016–017

## What to build

Let the Owner author, measure, calibrate, version, diff, select, and inspect exact Instrument Instances and ergonomic contexts, with one smoke instance for each coequal target.

## Acceptance criteria

- [ ] Workbench creates and reloads versioned geometry, tuning/stringing, scale, course/string spacing, action/reach inputs, right-hand/plucking geometry, target configuration, performer context, confidence, and provenance.
- [ ] Mechanics, player ergonomics, historical evidence, pedagogy, preference, and evaluator calibration remain distinct records.
- [ ] Changing a selected instance/default stales exact dependent searches, artifacts, playtests, and qualifications rather than mutating them.
- [ ] Missing required evaluator/calibration input yields incomplete physical evidence, never a default-derived pass.
- [ ] One baroque-guitar, thirteen-course-lute, and classical-guitar instance round-trips through API, Workbench, and candidate identity.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T32-instrument-instance-calibration-workbench.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T32-instrument-instance-calibration-workbench.spec.ts`; `npm run eval:fast`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T32/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 10
- 23
