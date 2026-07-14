# Vellum Coding Agent Prompt

## Agent skills

### Issue tracker

Current implementation waves use local Markdown tracer bullets under .scratch; do not create beads unless the Owner explicitly requests them. See docs/agents/issue-tracker.md.

### Triage labels

Local tracer bullets use the canonical needs-triage, needs-info, ready-for-agent, ready-for-human, and wontfix states. See docs/agents/triage-labels.md.

### Domain docs

Vellum is a single-context repository governed, in order, by CONTEXT.md, accepted decisions in docs/adr, and the current SPEC.md. See docs/agents/domain.md.

## Current work

The sole current implementation specification is SPEC.md: **Vellum Instrument Intelligence**.

It governs the next program of source-backed Knowledge Packs, Applied Knowledge Manifests, shared phrase and voice planning, and coequal idiom compilers for five-course baroque guitar, thirteen-course baroque lute, and six-string classical guitar.

The active execution wave is `.scratch/instrument-intelligence`. Before implementation:

1. Read CONTEXT.md, applicable accepted ADRs, and SPEC.md.
2. Apply accepted ADR 0022 to all new canonical Reviewed Knowledge Library records.
3. Read `.scratch/instrument-intelligence/PLAN.md`, its requirement ledger, and the selected tracer issue before changing code.
4. Do not reopen .scratch/arrangement-intelligence; it is a frozen completed prototype record with path- and hash-bound evidence.
5. Treat tracer IDs as stable locators, not sequence. Follow the typed dependency/result-predicate graph and temporal execution generations in the generated completion manifest.
6. Sequence autonomous implementation before late human commitments, then resume automatic sealed execution, remediation, packaging, and aggregation after those commitments; never hide AFK work inside one HITL ticket.
7. Treat schema 5 as an evidence-empty execution lock. After this bootstrap is pushed, the Owner establishes its one-time local trust checkpoint with `npm run plan:instrument-intelligence:trust-bootstrap`; never infer a fresh bootstrap after schema-5 history exists.
8. T01 first lands and strictly verifies a governance-only next-schema/verifier/clause-ledger pre-registration transaction. Do not add or push T01 evidence before that upgraded pending-evidence validator is active.
9. Thereafter complete, test, commit, push, and record `origin/main` reachability for each tracer before beginning a dependent tracer. Run `npm run spec:verify` for draft/precommit validation; after pushing prevalidated implementation/evidence and its separate manifest-only receipt commit, run `npm run plan:instrument-intelligence:verify`. Dependents require local `HEAD` and a clean worktree at the strictly verified `origin/main` receipt tip.

Public tracer artifacts may contain only rights-approved development-fixture details plus typed bounded receipts. Hidden material uses non-resolving case IDs and keyed Vault commitments, never bare hidden-source or truth digests. Exact held-out source identities, reviewed truth, expected observations, forbidden outcomes, mutations, invalidation decisions, reserve order or seed, and per-attempt diagnostics remain exclusively in the Owner Evaluation Vault. Owner-private reference identities, paths, metadata, crops, text, images, and direct digests are equally private unless an explicit repository-inclusion decision authorizes disclosure.

Historical specifications, proposals, audits, reviews, and superseded plans are under docs/archive/specifications/2026-07-13. They are evidence, not current work.

## Quality gates

Every tracer issue must declare its applicable gate matrix, exact commands, toolchain identity, and evidence paths. Run the base gates before every tracer commit:

```bash
cd /Users/jeff/ws/vellum
npm run typecheck
npm test
npm run format:check
npm run spec:verify
npm run build
npm run server:build
```

Add the affected conditional gates:

- UI or workflow changes: `npm run test:browser`
- evaluation changes: the affected `npm run eval:*` suites
- notation or playback: `npm run sandbox:lilypond:verify`, `npm run eval:render`, and `npm run eval:playback` in the Nix shell
- cross-target behavior: `npm run eval:golden` and `npm run eval:parity`
- migration, security, provider, or rights work: the named migration, adversarial-security, fake-provider, rights-leak, and applicable real-tool gates defined by that tracer

Use the Nix development shell when a gate requires the pinned musical toolchain. A required failed or blocked gate prevents commit and dependency advancement. `not_applicable` requires a recorded rationale; gate outputs and toolchain identities belong in the tracer evidence manifest.
