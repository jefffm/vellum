# Reviewed calibration and learning loop

Status: complete

Type: AFK

User stories: U7, U9

## What to build

Turn recurrence and prediction-versus-reality disagreement into reviewable proposals without self-evaluation or silent global learning.

## Acceptance criteria

- [x] Evidence roles separate fitting, development, held-out evaluation, and monitoring.
- [x] Calibration Candidates retain supporting and conflicting evidence.
- [x] Personal Defaults, ergonomic changes, Knowledge Candidates, and fixtures use their existing approval boundaries.
- [x] An example cannot both fit an evaluator and prove its generalization.

## Delivered

- Immutable Reviewed Learning Proposals retain typed adopted/rejected candidate decisions, Owner Playtests, Human Evaluations, edits/repairs, source/Analysis corrections, prediction disagreements, recurring choices, and explicit Owner-usefulness evidence as supporting or conflicting evidence.
- Every evidence item has exactly one fitting, development, held-out, or monitoring role for one exact evaluator version. Calibration acceptance requires both fitting and held-out inputs plus supporting and conflicting evidence.
- Proposal kinds route to explicit authorities: Owner Personal Default, Owner Ergonomic Profile, historical-specialist Knowledge Candidate, evaluation-maintainer calibration, or fixture-maintainer export. A wrong role cannot accept or reject across boundaries.
- Rejection creates an immutable decision and no output. Acceptance creates only the next existing candidate boundary: a Personal Default Candidate (not an active default), cited Knowledge Candidate (not Historical Knowledge), personal ergonomic candidate, reviewed fixture/counterexample candidate, or a new evaluator dataset/revision.
- Private workspace evidence cannot produce even a fixture candidate without an explicit private-export review flag and license. No code writes repository fixtures.
- Evaluator Dataset Manifests enforce one role per evidence identity, hide held-out assignments from the generator/fitting accessor, create a new version when roles move, and require incompatible comparison IDs when a role move changes comparison meaning.
- Evaluator Revisions bind disjoint fitting and held-out refs, exact parent evaluator, dataset manifest, target scope, known limitations, and historical prediction disagreements. Prior proposal/evidence bytes remain unchanged.

## Verification

- Focused tests prove inert and rejected proposals leave Owner behavior unchanged, wrong authority fails, and accepted defaults/knowledge remain candidates rather than silently active state.
- Tests cover personal ergonomic and private fixture candidates, private-export blocking, supporting/conflicting calibration evidence, hidden held-out inputs, disjoint fitting/held-out enforcement, role-move versioning, and comparison invalidation.
- Immutable byte checks prove proposal evidence is not rewritten by rejection or evaluator revision acceptance.
- Full quality gates and evaluation evidence are recorded in `evidence/T31/verification.json`.

## Honest limits

- A newly accepted Evaluator Revision is a versioned input for a subsequent Evaluation; T34 still owns retained cross-version comparison execution and proves that old Runs/Cards remain byte-stable under CI retention.
- T32 owns OMR model evaluation, held-out secret-canary execution, and metric calibration. T31 isolates references and access paths but does not claim that a held-out corpus has been reviewed.
- Actual Owner, specialist, evaluation-maintainer, and fixture-maintainer decisions remain late HITL evidence. Automated tests exercise authority boundaries without impersonating those humans.
- Owner-store candidate records predate the immutable Evaluation Store and retain their existing candidate approval semantics; Reviewed Learning decisions preserve the exact output snapshot digest that entered that boundary.

## Blocked by

- 26
- 29
- 30
