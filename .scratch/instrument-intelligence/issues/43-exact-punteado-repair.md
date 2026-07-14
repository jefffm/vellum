# Exact punteado repair

Status: ready-for-agent

Type: AFK

User stories: U2, U4

SPEC coverage: Baroque-guitar exact configuration and punteado; Slice 8.2

Requirement IDs: II-BG-001–003, II-SEED-001, II-EXEC-008B, II-MC-021

## What to build

Use one reviewed Sanz path for scoped test-only historical knowledge plus a separately classified maintainer nonhistorical consequence, then repair an exact punteado phrase through production search, notation, playback, Card, and Workbench.

## Acceptance criteria

- [ ] Exact two-dimensional contacts, fingers, course allocation, constituent strings, held notes, transitions, hand position, and profile-scoped right-hand resources drive search.
- [ ] No universal three-finger assertion is hard-coded; historical, pedagogical, software, and player-specific rules remain distinct.
- [ ] Principal Voice stays recognizable and the known violent cross-neck transition is absent under the exact instance/context.
- [ ] Notation and playback preserve selected course/string constituents, attacks, durations, releases, and no duplicates.
- [ ] Test-only historical knowledge remains unavailable by default; the nonhistorical consequence is visibly labeled and manifest-bound.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T43-exact-punteado-repair.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T43-exact-punteado-repair.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T43/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 14
- 42
