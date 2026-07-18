# Target Harmonic Plan vertical

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U3

SPEC coverage: Target Harmonic Plan; Slice 5

Requirement families touched: II-MUS-007, II-EXEC-005B, II-MC-012

## What to build

Make profile-scoped harmonic obligations explicit enough that a same-melody/wrong-harmony candidate fails for independently applicable reasons without forcing Roman-numeral, functional, chordal, or tonal analysis onto modal or nonfunctional material.

## Acceptance criteria

- [ ] Each Harmonic Obligation records its span, source events, interpretation, protected features, priority, transformations, Validation Profile, evaluator requirements, uncertainty, and source evidence; bass, inversion, sonority, function, dissonance, tendency, and cadence are present only when applicable.
- [ ] Candidate mappings identify which events realize each obligation and where an authorized reduction or compromise applies.
- [ ] Applicable wrong-bass, inversion, change-time, essential-dissonance, suspension, and cadence mutations fail independently; the same fixture includes a modal or nonfunctional counterexample in which Roman-numeral function is explicitly `not_applicable` or unresolved rather than fabricated.
- [ ] Plan conflicts are typed and remain visible rather than repaired by hidden local substitutions.
- [ ] Workbench compares two melody-preserving alternatives by their actual profile-scoped obligations, unknowns, and inapplicable dimensions, not one scalar score.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T28-target-harmonic-plan-vertical.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T28-target-harmonic-plan-vertical.spec.ts`; `npm run eval:fast`; `nix develop --command bash -c 'npm run sandbox:lilypond:verify && npm run eval:render && npm run eval:playback'`.
- Toolchain: record Node, npm, Nix, LilyPond/Audiveris, provider/fake-provider, OS, hardware, and fixture identities that materially affect the result; record `not_applicable` with rationale.
- Observable outcome: demonstrate the complete production-path result named above, including reload and the applicable Workbench/render/playback/evaluator boundary.
- Evidence: `../evidence/T28/verification.json` plus digest-bound public development artifacts.

## Public/Vault boundary

Development fixtures named by this tracer may be public only with verified rights. No future held-out identity, truth, mutation, invalidation, reserve state, or per-attempt diagnostic may appear here; public held-out receipts remain opaque and redacted.

## Blocked by

- 27
