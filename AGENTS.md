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

The sole current implementation specification is `SPEC.md`: **Vellum MEI Editions and Repertoire
Intelligence**.

The active execution wave is `.scratch/mei-editions`. Before implementation:

1. Read `CONTEXT.md`, applicable accepted ADRs—especially ADRs 0023 and 0024—and `SPEC.md`.
2. Read `.scratch/mei-editions/PLAN.md` and the selected tracer issue.
3. Build a thin, demoable product path. Do not add generalized governance, migration,
   qualification, publication, or review infrastructure unless the selected tracer directly
   requires it.
4. Keep the current de Visée baroque-guitar source vertical from becoming a universal instrument
   model. Shared MEI, rendering, selection, playback, and knowledge code must remain usable by
   thirteen-course baroque lute and ordinary notation without smuggling five-course mechanics.
5. Preserve diplomatic evidence, interpretation, editorial action, explicit uncertainty, version
   lineage, and source-backed knowledge as separate layers while using the smallest implementation
   that proves the behavior.
6. Complete, test, commit, and push one tracer before beginning a dependent tracer. Ordinary Git
   history is the execution record; no separate evidence-receipt or publication-attestation
   commit is required.
7. T01 is current. Execute T01–T04 autonomously in dependency order, stop at T05 for the exact
   Owner acceptance decisions, and resume T06 only from accepted version IDs.

Do not reopen `docs/archive/execution-waves/2026-07-17/instrument-intelligence`. It is the frozen,
superseded 107-tracer high-assurance program. Do not run its trust bootstrap, manifest writer,
strict verifier, or completion machinery. Do not reopen
`docs/archive/execution-waves/2026-07-17/arrangement-intelligence`; it is completed prototype
evidence with historical path- and hash-bound records.
Do not reopen `docs/archive/execution-waves/2026-07-17/musical-proofs`; its unfinished T11 is a
frozen historical proposal, not current work.

Historical specifications and execution waves are under `docs/archive`. They are evidence, not
current work or a backlog.

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
- notation or playback: `npm run eval:render` and `npm run eval:playback`; add
  `npm run sandbox:lilypond:verify` only when the LilyPond path changes
- cross-target behavior: `npm run eval:golden` and `npm run eval:parity`
- OMR changes: the focused fake adapter tests and one real Audiveris smoke test on macOS
- provider or rights changes: the focused fake-provider, egress, or rights tests

Use the repo-tracked Podman-backed Nix shell when a gate needs the pinned musical toolchain.
Run the complete `npm test`, real Audiveris, and Chrome/browser gates on macOS where those
applications and host paths live. Serialize Podman/Nix, Audiveris, and browser work that shares
VMs, ports, caches, or application state.

A failed required gate prevents the commit. Record relevant commands and outcomes in the commit
message or tracer checklist; do not build a second evidence-manifest system.
