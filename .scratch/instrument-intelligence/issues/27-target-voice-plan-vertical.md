# Target Voice Plan vertical

Status: ready-for-agent

Type: AFK

User stories: U3

SPEC coverage: Target Voice and Relationship Plans; Slice 5

Requirement IDs: II-MUS-006, II-EXEC-005B, II-MC-012

## What to build

Turn a reviewed melody-and-bass source into an explicit Target Voice Plan whose roles, active/rest spans, continuity, prominence, omissions, and realized mappings are first-class and visible.

## Acceptance criteria

- [ ] Plan identifies target voices, source obligations, roles, ranges, active spans, planned rests, continuity rules, prominence, omission priority, and validation profile.
- [ ] Realized candidate events map back to exact target/source voice obligations and distinguish intentional rest/omission from silent loss.
- [ ] Dropping, merging, duplicating, reassigning, or hiding an active structural voice hard-fails its applicable gate.
- [ ] Workbench shows voice lanes, planned/rest spans, compromises, alternative reductions, and unresolved mappings.
- [ ] Plan/persistence/API/render/playback use the same stable voice identities after reload.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T27-target-voice-plan-vertical.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T27-target-voice-plan-vertical.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T27/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 23
- 24
