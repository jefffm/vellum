# Source Voice Graph vertical

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3

SPEC coverage: Source Voice Graph; Source understanding; Slice 5; voice mutations

Requirement families touched: II-MUS-001–002, II-EXEC-005A, II-MC-011

## What to build

Carry a rights-cleared multi-voice fixture and a cross-staff/ambiguous variant from import through a reviewed Source Voice Graph, persistence, API, source review, ambiguity resolution, and dependent invalidation without manufacturing voice identity for unresolved events.

## Acceptance criteria

- [ ] Every voice-bearing Normalized Score event appears in exactly one resolved Source Voice Occurrence or in `unresolvedEventRefs`; neither unresolved placement nor identity is silently converted into a voice.
- [ ] Voice continuity, entry, exchange, overlap, cross-staff notation, ambiguity, and alternative hypotheses are representable without forced collapse; disputed overlapping occurrences name the same uncertainty and are legal only under an explicit Source Voice Graph ambiguity relation.
- [ ] Resolving ambiguity creates a successor graph version, preserves prior evidence, and stales dependent plans/searches/evaluations.
- [ ] Source review shows resolved membership, `unresolvedEventRefs`, unresolved identities, ambiguity relations, Critical Uncertainty, citations, and correction lineage.
- [ ] Silent omission, unexplained duplicate membership, false resolution, false merge, and false split mutations fail independently.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T23-source-voice-graph-vertical.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T23-source-voice-graph-vertical.spec.ts`; `npm run eval:fast`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T23/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 10
- 17
- 35
