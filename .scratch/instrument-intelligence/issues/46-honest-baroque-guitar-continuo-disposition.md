# Honest baroque-guitar Continuo disposition

Status: ready-for-agent

Type: AFK

User stories: U4, U7

SPEC coverage: Baroque-guitar Slice 8.3; Continuo disposition

Requirement IDs: II-BG-006, II-MUS-009, II-EXEC-008C

## What to build

Apply the shared Continuo disposition contract to the re-entrant five-course target and prevent any incomplete bass foundation from being presented as a complete realization.

## Acceptance criteria

- [ ] Exact target/instance capacity is evaluated against every foundation obligation before search.
- [ ] An incomplete foundation produces an explicit separate bass part, a policy-valid visibly labeled reduction, or rejection.
- [ ] Implied root, chord membership, octave displacement, Audio Preview pitch, or low-looking notation cannot count as a complete foundation.
- [ ] Full and isolated playback, notation, lineage, Cards, Workbench, and export agree on the chosen disposition.
- [ ] Mutations that remove the separate bass, hide reduction labeling, or misreport coverage fail.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T46-honest-baroque-guitar-continuo-disposition.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T46-honest-baroque-guitar-continuo-disposition.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`; `npm run eval:golden`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T46/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 38
- 45
