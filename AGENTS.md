# Vellum Coding Agent Prompt

## Agent skills

### Issue tracker

Current implementation waves use local Markdown tracer bullets under `.scratch`; do not create
beads unless the Owner explicitly requests them. See `docs/agents/issue-tracker.md`.

### Triage labels

Local tracer bullets use `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and
`wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Vellum is a single-context repository governed, in order, by `CONTEXT.md`, accepted decisions
in `docs/adr`, and the current `SPEC.md`. See `docs/agents/domain.md`.

## Current work

The sole current implementation specification is `SPEC.md`: **Vellum Musical Proofs**.

The active execution wave is `.scratch/musical-proofs`. Before implementation:

1. Read `CONTEXT.md`, applicable accepted ADRs—especially ADR 0023—and `SPEC.md`.
2. Read `.scratch/musical-proofs/PLAN.md` and the selected tracer issue.
3. Build a thin, demoable product path. Do not add generalized governance, migration,
   qualification, publication, or review infrastructure unless the selected tracer directly
   requires it.
4. Keep five-course baroque guitar, thirteen-course baroque lute, and six-string classical
   guitar coequal. Shared code must not smuggle one target's mechanics or idiom into another.
5. Preserve source understanding, musical relationships, explicit uncertainty, version lineage,
   and source-backed knowledge while using the smallest implementation that proves the behavior.
6. Complete, test, commit, and push one tracer before beginning a dependent tracer. Ordinary Git
   history is the execution record; no separate evidence-receipt or publication-attestation
   commit is required.
7. Sequence autonomous work before the single late Owner playtest.

Do not reopen `.scratch/instrument-intelligence`. It is the frozen superseded 107-tracer
high-assurance program. Do not run its trust bootstrap, manifest writer, strict verifier, or
completion machinery. Do not reopen `.scratch/arrangement-intelligence`; it is frozen completed
prototype evidence with path- and hash-bound records.

Historical specifications are under `docs/archive/specifications`. They are evidence, not
current work.

## Quality gates

Run the base gates before every tracer commit:

```bash
cd /Users/jeff/ws/vellum
npm run typecheck
npm test
npm run format:check
npm run spec:verify
npm run build
npm run server:build
```

Add only the relevant conditional gates:

- UI or workflow changes: `npm run test:browser`
- evaluation changes: the affected `npm run eval:*` suites
- notation or playback: `npm run sandbox:lilypond:verify`, `npm run eval:render`, and
  `npm run eval:playback`
- cross-target behavior: `npm run eval:golden` and `npm run eval:parity`
- OMR changes: the focused fake adapter tests and one real Audiveris smoke test on macOS
- provider or rights changes: the focused fake-provider, egress, or rights tests

Use the repo-tracked Podman-backed Nix shell when a gate needs the pinned musical toolchain.
Run the complete `npm test`, real Audiveris, and Chrome/browser gates on macOS where those
applications and host paths live. Serialize Podman/Nix, Audiveris, and browser work that shares
VMs, ports, caches, or application state.

A failed required gate prevents the commit. Record relevant commands and outcomes in the commit
message or tracer checklist; do not build a second evidence-manifest system.
