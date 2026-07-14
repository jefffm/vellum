# Target Relationship Plan vertical

Status: ready-for-agent

Type: AFK

User stories: U3, U7

SPEC coverage: Target Voice/Relationship Plans; Slice 5

Requirement IDs: II-MUS-008, II-EXEC-005B, II-MC-012

## What to build

Preserve ordered entries, subject relations, voice exchanges, counterpoint, suspensions, and cadential goals as named relationship obligations under an exact Validation Profile.

## Acceptance criteria

- [ ] Relationship Plan maps source obligation groups to target voices/events with relation kind, timing/order, interval/rhythm shape, cadence, allowed transformation, and evidence.
- [ ] An explicit ambiguity relation can preserve overlapping disputed analyses without forcing false certainty.
- [ ] Entry order, identity exchange, relation timing, subject shape, suspension, and cadence mutations fail independently.
- [ ] Candidate and evaluation reports show which relationship passed, failed, was intentionally transformed, or remains unknown.
- [ ] Plans survive serialization/reload and stale correctly when Source Voice, context, harmonic, or profile inputs change.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T29-target-relationship-plan-vertical.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T29-target-relationship-plan-vertical.spec.ts`; `npm run eval:fast`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T29/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 27
- 28
