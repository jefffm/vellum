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
2. Resolve proposed ADR 0022 before writing new canonical Reviewed Knowledge Library records.
3. Create a new local Markdown tracer wave under .scratch with its own plan, issues, requirement ledger, manifest, and evidence namespace.
4. Do not reopen .scratch/arrangement-intelligence; it is a frozen completed prototype record with path- and hash-bound evidence.
5. Sequence machine-executable tracer bullets before the late role-scoped HITL package defined by the specification.
6. Complete, test, commit, and push each tracer before beginning a dependent tracer.

Historical specifications, proposals, audits, reviews, and superseded plans are under docs/archive/specifications/2026-07-13. They are evidence, not current work.

## Quality gates

Run the complete applicable gates before each tracer commit:

```bash
cd /Users/jeff/ws/vellum
npm run typecheck
npm test
npm run format:check
npm run spec:verify
```

Use the Nix development shell when a gate requires the pinned musical toolchain.
