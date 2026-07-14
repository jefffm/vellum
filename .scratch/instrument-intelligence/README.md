# Instrument Intelligence execution wave

Status: bootstrap-active — only tracer 01 has an eligible initial execution declaration

Authority: [SPEC.md](../../SPEC.md)

This is the only active implementation wave. It is an append-only, dependency- and typed-result-predicate-ordered set of locally tracked tracer bullets derived from the Vellum Instrument Intelligence specification. Numeric IDs are stable locators, not execution sequence.

## Contents

- [PLAN.md](PLAN.md) — execution order, dependencies, concurrency, and closure rules
- [REQUIREMENTS.md](REQUIREMENTS.md) — honest requirement-family planning index; tracer 01 replaces it with the clause-level digest/evidence ledger before any dependent work starts
- [completion-manifest.json](completion-manifest.json) — machine-readable tracer graph, definition digests, mutable evidence state, and closure state
- `issues/` — one independently grabbable tracer per Markdown file
- `evidence/TNN/` — public typed bounded verification receipts produced by tracer `NN`

## Execution contract

- Schema 5 is a static, evidence-empty bootstrap guard, not the finished execution judge. It rejects every execution generation, requirement-evidence record, tombstone, closure claim, and evidence file other than `evidence/.gitkeep`. T01 first lands and strictly verifies a governance-only schema/ledger/verifier pre-registration transaction; only the upgraded protocol may accept T01's later implementation/evidence and receipt commits.

- Every issue's parser-facing `Initial execution eligibility` field describes only the committed bootstrap snapshot; it is never mutable workflow state. Only tracer 01 declares `eligible` initially. Current runtime eligibility is computed from the current execution generations, blockers, typed result predicates, invalidation state, and remote-reachability evidence.
- Human commitments and reviews remain late, but automatic sealed execution, remediation, package generation, and closure aggregation are AFK nodes after the required human commitments. AFK work is not hidden inside HITL tickets merely to keep numeric ranges contiguous.
- A dependent tracer begins only after every blocker is tested, its implementation and typed evidence bytes are committed and pushed to `main`, its separate receipt-manifest commit is pushed, strict verification proves the canonical manifest byte-identical to `origin/main`, and every declared result predicate holds.
- Independent tracers may run in parallel only when their file ownership is reconciled and each still lands as its own focused commit.
- Every tracer runs the base quality gates and every applicable conditional gate named in its issue. `verification.json` is closed-schema public JSON: it binds the exact commands, sanitized artifact closure, toolchain identifiers, outcome, definition, authority snapshot, and predecessors; unknown fields and unlisted files fail closed. The later receipt-manifest transaction binds those evidence bytes to the reachable implementation/evidence commit without asking a Git commit to contain its own hash.
- For `implementation-pass` and `closure-pass-required`, a failed or blocked mandatory gate prevents tracer completion and dependency advancement.
- For `attempt-finalized`, successful execution of the evaluation/review protocol and the product result are separate: an immutable failed, blocked, or incomplete result may complete the attempt tracer and make remediation eligible, but can never satisfy Machine Complete or Release Complete.
- `not_applicable` is an applicability result, never an acceptance pass, and is allowed only with a recorded clause-specific rationale.
- New remediation tracers transactionally allocate the next unused numeric ID under the manifest registry head. Their issue and PLAN row may be appended after progress only when prior definitions and authority narrative are byte-stable. Deleted definitions retain tombstones and no existing ID, evidence path, or receipt is renumbered or reused; a dynamic tombstone retains any unresolved closure obligation.
- Re-execution appends immutable `(tracer ID, execution generation)` nodes with exact temporal predecessors and typed supersession/invalidation edges, allowing repair/rerun loops without cycles in the static definition graph. Historical evidence is read from each generation's reachable implementation/evidence commit; the canonical `evidence/TNN/verification.json` working path represents the latest generation and may be replaced only by a new immutable commit. Every appended remediation execution generation is bound to an exact typed dispatcher artifact from T69, T84, T85, T87, T103, or T106 and carries its prescribed `rejoinAt: { tracerId, generation }`, actual invalidation edges/scopes, a derived `invalidatesMachineComplete` flag, and nonempty `closureTargets: [{ tracerId, generation }]`. These exact identities are reserved when the repair is finalized and may remain unmaterialized only while the corresponding closure is pending. A materialized `rejoinAt` must be a strict temporal descendant of the passing repair and each materialized target must descend from it. Current closure must cover every target from every historical remediation generation; supersession or a tombstone cannot discard an obligation. T87 is mandatory, and T85 is present exactly when actual invalidation edges reach Machine Complete.

## Confidentiality boundary

Public files in this directory may contain only rights-approved development-fixture details and typed bounded receipts. Hidden material uses random non-resolving case IDs, public coverage classes, keyed non-resolving Vault commitments, bounded aggregate statuses, exact public claim scopes, and schema-constrained redactions. Bare hidden-source/truth digests and free-form `redacted_evidence` are forbidden.

Exact held-out Works, truth, expected observations, forbidden outcomes, mutations, invalidation decisions, reserve order or seed, and per-attempt diagnostics stay exclusively in the Owner Evaluation Vault. Ordinary Owner-private references are also private: source identities, paths, metadata, crops, images, text, and direct content digests require an explicit public-inclusion decision or remain behind typed non-resolving receipts.

Run `npm run plan:instrument-intelligence:manifest` after changing the wave and `npm run spec:verify` for draft/precommit validation. Establish the initial local trust checkpoint only after independently checking the pushed, evidence-empty bootstrap with `npm run plan:instrument-intelligence:trust-bootstrap`; protected linear `main` is a prerequisite. T01 uniquely begins with a governance-only pre-registration commit and strict verification. After that upgrade, ordinary execution uses two pushed commits because a commit cannot truthfully contain a receipt naming its own hash: first implementation plus prevalidated canonical evidence, then a manifest-only receipt commit that names its parent commit and evidence digest. Strict mode fetches fail-closed, requires local `HEAD` and all governed bytes to equal current `origin/main` in a clean worktree, verifies the transition against the preceding manifest-changing first-parent revision, and advances an Owner-local monotonic trust ref. Authority or definition changes may not retain prior current evidence without an explicit governed migration/invalidation.

The frozen `.scratch/arrangement-intelligence` wave remains historical prototype evidence and must not be modified or used as this wave's tracker.
