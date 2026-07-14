# Issue tracker: Local Markdown

Active implementation waves are recorded as Markdown under `.scratch/`. This is intentionally independent of beads and GitHub Issues.

The current product scope is `SPEC.md`. Check `.scratch/README.md` before choosing a wave: completed path-bound evidence may remain under `.scratch/` without being active work.

## Conventions

The current Instrument Intelligence schema 5 is an evidence-empty execution lock. T01 must first push and strictly verify its governance-only next-schema/verifier/ledger pre-registration transaction. Only that upgraded verifier may validate pending T01 evidence and activate the ordinary implementation/evidence → manifest-only receipt protocol.

- One wave per directory: `.scratch/<wave>/`
- The ordered overview is `.scratch/<wave>/PLAN.md`
- Tracer bullets are `.scratch/<wave>/issues/<NN>-<slug>.md`
- Numeric tracer IDs are immutable locators, not execution sequence. Plan order and declared typed dependency/result predicates define execution order. New remediation tracers allocate the next unused ID transactionally under the registry head; after execution starts, the governed append may add only the new issue definition and its PLAN row while prior authority and definitions remain byte-stable. Deleted definitions retain tombstones without erasing unresolved dynamic closure obligations, and existing IDs/evidence paths are never renumbered or reused.
- Every tracer bullet carries `Status:`, `Type:`, `Initial execution eligibility:`, and `Completion semantics:` fields using the vocabulary in `triage-labels.md`. Initial eligibility is immutable bootstrap metadata, not current workflow state; the completion manifest computes runtime eligibility from current generations, blockers, typed result predicates, invalidations, and remote-reachability evidence.
- A tracer is a thin, demoable path through domain model, API, UI, validation, and tests
- Complete each tracer with the full quality gates, one focused commit, and a push before beginning its dependent tracer
- Every issue declares an applicable gate matrix with base and conditional commands, expected observable outcomes, and evidence paths
- `attempt-finalized` distinguishes successful execution of an evaluation/review protocol from a passing product result. A failed attempt may unblock remediation, but it never satisfies Machine Complete or Release Complete.
- Runtime reruns append immutable `(tracer ID, execution generation)` nodes with exact predecessors and typed invalidation/supersession edges. Every remediation generation is bound to a typed T69/T84/T85/T87/T103/T106 dispatch artifact that prescribes its rejoin, actual invalidations, Machine impact, and closure targets. The verifier retains every historical contract—including superseded and tombstoned repairs—and blocks closure until current T85/T87 covers all of them. Historical evidence is verified from its own reachable commit while the canonical evidence path represents the latest generation.
- Each completed tracer uses two pushed commits: implementation plus canonical typed evidence first, then the receipt-manifest transaction naming that reachable commit. Draft verification is precommit; strict verification requires canonical manifest bytes to equal `origin/main` before a dependent may start.
- The completion manifest enumerates every tracer, typed dependency/result predicate, definition digest, evidence path, implementation commit, remote-reachability receipt, invalidation generation, tombstone/supersession edge, and temporal execution generation. Fixed tracer-count/range assumptions are forbidden.
- Public requirement ledgers and evidence may name rights-approved development fixtures. Hidden material is represented only by random non-resolving case IDs, public coverage classes, keyed non-resolving Vault commitments, digests of already-public artifacts, bounded aggregate states, exact public Claim Scopes, and typed bounded redaction receipts.
- Exact held-out identities, truth, expectations, mutations, invalidation decisions, reserve selection, and per-attempt diagnostics belong only in the Owner Evaluation Vault and must never be copied into `.scratch`
- Ordinary Owner-private references are also private. Their identities, paths, metadata, images, text, crops, and direct content digests may enter public evidence only under an explicit repository-inclusion/redistribution decision; otherwise public receipts use bounded non-resolving commitments and typed redactions.

When a workflow says to publish an issue, create the corresponding tracer file. Do not create beads unless the Owner explicitly requests them.
