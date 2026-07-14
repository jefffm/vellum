# Instrument Intelligence execution wave

Status: active

Authority: [SPEC.md](../../SPEC.md)

This is the only active implementation wave. It converts the complete Vellum Instrument Intelligence specification into dependency-ordered, locally tracked tracer bullets.

## Contents

- [PLAN.md](PLAN.md) — execution order, dependencies, concurrency, and closure rules
- [REQUIREMENTS.md](REQUIREMENTS.md) — stable requirement-to-tracer coverage ledger
- [completion-manifest.json](completion-manifest.json) — machine-readable planned completion state
- `issues/` — one independently grabbable tracer per Markdown file
- `evidence/TNN/` — public, redacted verification evidence produced by tracer `NN`

## Execution contract

- Tracers 01–63 are AFK and run before any human gate.
- Tracers 64–69 are the late HITL and closure queue.
- A dependent tracer begins only after every blocker is tested, committed, and pushed to `main`.
- Independent tracers may run in parallel only when their file ownership is reconciled and each still lands as its own focused commit.
- Every tracer runs the base quality gates and every conditional gate named in its issue.
- A failed or blocked mandatory gate prevents completion and dependency advancement.
- `not_applicable` is allowed only with a recorded rationale in the tracer evidence manifest.

## Confidentiality boundary

Public files in this directory may contain development-fixture details and only opaque held-out case IDs, coverage classes, digests, aggregate statuses, and redacted evidence. Exact held-out Works, truth, expected observations, forbidden outcomes, mutations, invalidation decisions, reserve order or seed, and per-attempt diagnostics stay exclusively in the Owner Evaluation Vault.

The frozen `.scratch/arrangement-intelligence` wave remains historical prototype evidence and must not be modified or used as this wave's tracker.
