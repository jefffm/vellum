# Triage labels

| Canonical role    | Local status      | Meaning                                                                     |
| ----------------- | ----------------- | --------------------------------------------------------------------------- |
| `needs-triage`    | `needs-triage`    | Requires specification or routing evaluation                                |
| `needs-info`      | `needs-info`      | Requires Owner input before it can be specified                             |
| `ready-for-agent` | `ready-for-agent` | Fully specified for agent work once computed runtime eligibility holds      |
| `ready-for-human` | `ready-for-human` | Fully specified hands-on human work once computed runtime eligibility holds |
| `wontfix`         | `wontfix`         | Intentionally not planned                                                   |

Completed local tracers use `complete`. Active tracers use `in-progress`.

Triage status describes whether a tracer is specified and who can perform it. It does **not** prove that dependencies have landed. Every active tracer carries an immutable parser-facing `Initial execution eligibility:` bootstrap declaration:

- `eligible` — eligible in the committed bootstrap snapshot (initially T01 only);
- `blocked` — not eligible in the committed bootstrap snapshot, though it may become runtime-eligible later; or
- `conditional` — an optional branch that remains subject to its named runtime condition.

The initial declaration never changes as work advances. The completion manifest is authoritative for computed current runtime eligibility, based on current execution generations, blockers, typed result predicates, invalidations, and `origin/main` reachability. An executor must re-check that computed state immediately before beginning work.

Eligibility predicates are machine-readable expressions over exact source tracer generations and bounded result fields. Free-form prose may explain a predicate but cannot authorize execution.

`Completion semantics:` uses one of four values:

- `implementation-pass` — the tracer completes only when its implementation acceptance and gates pass;
- `attempt-finalized` — the tracer completes when an immutable attempt or review result is recorded, even when that product result is failed, blocked, or incomplete;
- `decision-recorded` — the tracer completes when the authorized human decision is durably recorded; downstream predicates determine whether the decision is usable; or
- `closure-pass-required` — the tracer completes only when every referenced non-compensating closure predicate passes.

Product acceptance is separately one of `pass`, `fail`, `blocked`, or `incomplete`. Applicability is separately `applicable`, `not_applicable`, or `not_claimed`; `not_applicable` is never an acceptance pass. Comparison and freshness are likewise independent axes.
