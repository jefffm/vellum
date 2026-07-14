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

No new execution wave has yet been derived from the specification. Before implementation:

1. Read CONTEXT.md, applicable accepted ADRs, and SPEC.md.
2. Apply accepted ADR 0022 to all new canonical Reviewed Knowledge Library records.
3. Create a new local Markdown tracer wave under .scratch with its own plan, issues, requirement ledger, manifest, and evidence namespace.
4. Do not reopen .scratch/arrangement-intelligence; it is a frozen completed prototype record with path- and hash-bound evidence.
5. Sequence machine-executable tracer bullets before the late role-scoped HITL package defined by the specification.
6. Complete, test, commit, and push each tracer before beginning a dependent tracer.

Public tracer artifacts may contain only development-fixture details plus opaque held-out case IDs, coverage classes, digests, aggregate statuses, and redacted evidence. Exact held-out source identities, reviewed truth, expected observations, forbidden outcomes, mutations, invalidation decisions, reserve order or seed, and per-attempt diagnostics remain exclusively in the Owner Evaluation Vault. Public manifests bind those artifacts by digest without resolving them.

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
