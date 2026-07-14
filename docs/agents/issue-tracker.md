# Issue tracker: Local Markdown

Active implementation waves are recorded as Markdown under `.scratch/`. This is intentionally independent of beads and GitHub Issues.

The current product scope is `SPEC.md`. Check `.scratch/README.md` before choosing a wave: completed path-bound evidence may remain under `.scratch/` without being active work.

## Conventions

- One wave per directory: `.scratch/<wave>/`
- The ordered overview is `.scratch/<wave>/PLAN.md`
- Tracer bullets are `.scratch/<wave>/issues/<NN>-<slug>.md`
- Every tracer bullet carries a `Status:` line using the vocabulary in `triage-labels.md`
- A tracer is a thin, demoable path through domain model, API, UI, validation, and tests
- Complete each tracer with the full quality gates, one focused commit, and a push before beginning its dependent tracer
- Every issue declares an applicable gate matrix with base and conditional commands, expected observable outcomes, and evidence paths
- Public requirement ledgers and evidence may name development fixtures, but held-out material is restricted to opaque case IDs, coverage classes, digests, aggregate status, and redacted evidence
- Exact held-out identities, truth, expectations, mutations, invalidation decisions, reserve selection, and per-attempt diagnostics belong only in the Owner Evaluation Vault and must never be copied into `.scratch`

When a workflow says to publish an issue, create the corresponding tracer file. Do not create beads unless the Owner explicitly requests them.
