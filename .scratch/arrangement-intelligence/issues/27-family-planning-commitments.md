# Family planning, transposition, and commitments

Status: complete

Type: AFK

User stories: U3, U4, U5

## What to build

Compile one target-portable family intention into independent target solutions without leaking instrument-specific mechanics.

## Acceptance criteria

- [x] Shared Plan Decisions link to distinct target-specific constraints and evidence.
- [x] Complete transposition plans compare full target solutions rather than first fit.
- [x] Target-local compromise never silently changes sibling intent.
- [x] Family Commitment conflicts block regeneration with explicit resolutions.

## Delivered

- Target-portable decisions carry stable family decision keys across the baroque-guitar, 13-course-lute, and classical-guitar Plan projections. Every applicable Plan Decision names a distinct target constraint whose provenance cites the exact decision and evidence.
- Uniform transposition no longer stops at the first interval whose Principal Voice lies in range. The arranger realizes and audits the first two policy-eligible complete solutions, compares them by the faithful policy and target mechanics, and persists selected and rejected alternatives with pitch coverage, total position motion, average fret, and rationale.
- Manual edits create immutable Arrangement Score versions without silently becoming commitments. Explicit endpoints separately promote a narrow edited dimension or a target-portable Plan Decision.
- Target-local notation and course-fingering choices cannot become Family Commitments. Portable edited intent is translated to source-event lineage, not copied as target event IDs, and applies only to explicitly named sibling targets.
- Family Commitments are versioned and cite their source Editorial Commitment or Plan Decision plus source arrangement. Promotion stales only affected target configurations; release creates the next commitment version.
- Conservative regeneration now checks applicable Family Commitments as well as Editorial Commitments. An intersecting source correction creates a typed Commitment Conflict and blocks with the existing explicit release, source-revision, or scoped-exception resolutions.

## Verification

- The three Greensleeves siblings prove shared portable decision keys, distinct per-target constraint identities, exact decision/evidence provenance, independent searches and audits, and preserved sibling records.
- Baroque-guitar and classical-guitar fixtures prove multiple complete transposition solutions are evaluated while retaining the policy-selected historical key.
- Edit and commitment tests prove ordinary edits add no commitment, target-local promotion is rejected, source-semantic family scope reaches selected siblings only, conflict blocks regeneration, and release is versioned.
- Full quality gates and evaluation evidence are recorded in `evidence/T27/verification.json`.

## Honest limits

- Family intent is currently represented by stable portable decision keys across target-specific Plan projections, not yet by a single separately persisted family-level Plan record. That broader canonical consolidation remains partial under AI-PROD-038.
- Complete transposition comparison is deliberately bounded to the first two intervals in the declared target key policy. The record does not claim exhaustive key search.
- Machine tests prove promotion and conflict semantics; the deferred human gate still owns whether the promotion controls and conflict language are understandable.
- The service/API supports explicit Plan and edit promotion. T28 owns the complete workbench selection, proposal, adoption, and promotion presentation.

## Blocked by

- 23
- 24
- 25
- 26
