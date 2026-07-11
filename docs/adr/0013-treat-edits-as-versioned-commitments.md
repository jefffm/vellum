# ADR 0013: Treat edits as versioned commitments

## Status

Accepted

## Context

An upstream transcription correction can invalidate analysis, arrangements, and exported files. A user edit to an arrangement is also musical intent, not merely a changed byte. Rebuilding everything silently would destroy both the prior result and the user's judgement; retaining everything silently could conceal a preservation failure.

## Decision

Vellum keeps derived records immutable and records staleness separately. Every stale record names both the input version it used and the current input version. A transcription correction creates a new transcription, normalized score, and analysis record, then marks dependent Arrangement Scores and Deliverables stale without changing their bytes.

User-approved local choices become narrow Editorial Commitments. Only target-portable musical commitments may be promoted to Family Commitments; notation and course/fingering choices remain target-local. Conservative regeneration creates a new Arrangement Branch and Score version in the existing Arrangement Family, retains active commitments, reruns arrangement and Preservation Audit, and records which events were regenerated or retained.

When changed source material intersects an active commitment, Vellum creates a Commitment Conflict and blocks regeneration. The available resolutions are explicit: release the commitment, revise the source correction, or approve a scoped Policy Exception. A localized, owner-approved exception remains inspectable. A critical exception is Policy Drift and cannot be disguised as local editorial variance.

## Consequences

- Old arrangements and exports remain reproducible and inspectable.
- The UI can explain why an output is stale instead of presenting an ambiguous warning.
- Direct edits accumulate durable musical intent without making the system blindly repeat an obsolete choice.
- Regeneration requires more lineage records, but every consequential choice has an owner and scope.
