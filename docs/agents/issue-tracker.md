# Issue tracker: Local Markdown

Active implementation waves are Markdown under `.scratch/`. This is intentionally independent
of beads and GitHub Issues.

The current product scope is `SPEC.md`; `.scratch/README.md` identifies the one active wave.

## Conventions

- One active wave per directory: `.scratch/<wave>/`.
- The overview is `.scratch/<wave>/PLAN.md`.
- Tracer bullets are `.scratch/<wave>/issues/<NN>-<slug>.md`.
- Each tracer has `Status:`, `Type:`, and `Blocked by:` fields.
- A tracer is a thin, demoable path through every layer needed for its outcome. Avoid horizontal
  schema-only, migration-only, or governance-only slices.
- Prefer AFK. Put genuinely necessary Owner judgment in late HITL tracers.
- Complete each tracer with focused tests, applicable repository gates, one commit, and a push
  before beginning a dependent tracer.
- Ordinary Git history and the issue checklist are sufficient execution evidence. Do not create
  completion manifests, clause ledgers, evidence receipts, trust anchors, temporal generations,
  or separate manifest-only commits.
- Public fixtures must be rights-approved. Owner-private sources and holdouts remain local and
  untracked; tests refer to public substitutes or non-resolving local case IDs.
- If a tracer becomes too large to demonstrate as one narrow behavior, split it by user-visible
  outcome—not by database/API/UI layer.

Completed and superseded waves live under `docs/archive/execution-waves`. Internal status fields,
unchecked boxes, and dependency graphs in those archived snapshots describe their historical
state; they are not current work or a backlog. Never move an archived issue back into `.scratch`.

When a workflow says to publish an issue, create the corresponding tracer file. Do not create
beads unless the Owner explicitly requests them.
