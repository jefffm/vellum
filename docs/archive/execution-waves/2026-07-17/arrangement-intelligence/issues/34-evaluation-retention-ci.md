# Evaluation retention, CI impact, and promotion

Status: complete

Type: AFK

User stories: U1, U6, U9

## What to build

Operate the Evaluation Harness safely through storage lifecycle, change-impact selection, commands, reports, and reviewed baseline promotion.

## Acceptance criteria

- [x] Content deduplication, baseline pinning, retention classes, private deletion, and garbage collection are explicit.
- [x] Safe suite-impact mapping falls back broadly when impact is unknown.
- [x] All specified `eval:*` commands emit machine-readable results and correct exit status.
- [x] Promotion records exact run, reviewer, known defects, tradeoffs, and rationale.

## Delivered

- A separate Evaluation Artifact Store content-addresses bytes by SHA-256, deduplicates identical content, retains multiple references, requires explicit ordinary/ephemeral expiry, and requires license provenance for repository fixture artifacts.
- Baseline pins are separate references. Clock-controlled garbage collection drops expired unpinned references but cannot remove pinned bytes until the Baseline pin is explicitly invalidated.
- Private workspace deletion removes every reference and the shared content-addressed blob when any private link exists, preventing a copied report reference from retaining private canary bytes.
- Suite-impact mapping covers domain/schema, arrangers, playback, OMR/import, evaluators, UI/workflow, profiles, and fixtures. Unknown or dynamically registered paths select the broad offline suite set. Every selection report states that skipped suites are not proven irrelevant.
- The full command family now exists: `eval:fast`, `eval:golden`, `eval:render`, `eval:playback`, `eval:omr`, `eval:model`, `eval:compare`, and `eval:report`. Commands emit one machine-readable JSON result and use nonzero exit status for invalid arguments, infrastructure/data failure, or hard-gate failure.
- `eval:compare -- --baseline …` compares a new mutation run against the exact stored Baseline; without that argument it creates a self-contained development baseline. `eval:report -- --run …` reports the exact Run/Cards plus separately labeled external evidence with observation date, compatibility, reproducibility, and clock-derived staleness. Missing live evidence is not inferred from offline success.
- Every Baseline promotion now creates and cites an immutable Promotion Review. It records exact Run, product-versus-evaluator classification, mandatory deterministic suites, hard-regression disposition/authority, material-delta review, required human evidence, disclosed unknowns, promoter, rationale, and blockers.
- Hard failures cannot become ordinary Known Defects. Incomplete deterministic suites, unauthorized hard rejection, unreviewed material deltas, missing human evidence, and undisclosed unknowns block promotion.
- Baselines still retain exact known defects, evidence, accepted tradeoffs, reviewer, and rationale; supersession creates a new Baseline and leaves old evidence byte-stable.

## Verification

- Artifact lifecycle tests prove byte deduplication, reference counts, expiry, pin-safe GC, explicit invalidation, license enforcement, and deletion of a shared private canary blob.
- Impact-map tests prove representative narrow selection, dynamic fallback, unknown-path fallback, and the non-irrelevance disclaimer.
- Promotion tests prove a passing development review is cited by the Baseline and an evaluator change with missing material/human review remains blocked.
- Command-contract tests enumerate every required script. All commands are exercised during verification, including a generated Run passed into `eval:report`.
- Existing comparison/report security tests retain sanitized output, compatibility, known defects, tradeoffs, immutable supersession, and evaluation-root isolation from canonical product state.
- Full quality gates and evaluation evidence are recorded in `evidence/T34/verification.json`.

## Honest limits

- The current `eval:golden` scope is the first-loop promoted baseline. T35 expands it into the licensed multi-work, multi-target corpus; T34 establishes the command and lifecycle contract.
- Real baseline promotion authority, material-delta review, and required human evidence remain late HITL. Automated tests prove blocking semantics without supplying those authorities.
- Private deletion is deliberately conservative: if identical bytes have any private-workspace link, the shared blob and all references are removed rather than risking residual private bytes.
- Impact mapping is maintained routing policy, not a proof of test independence; unknown and dynamic changes intentionally pay the broader-suite cost.

## Blocked by

- 07
- 30
- 32
- 33
