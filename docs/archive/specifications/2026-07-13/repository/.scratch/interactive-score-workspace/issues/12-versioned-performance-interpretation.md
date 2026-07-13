# Versioned Performance Interpretation

Status: complete

Type: AFK

## What to build

Add an optional Performance Interpretation linked to an exact Arrangement Score version for playback-only ornament realization, arpeggiation, inequality, articulation, tempo shaping, and similar choices. Literal Audio Preview remains the default and can be compared instantly with the interpretation.

## Acceptance criteria

- [x] Literal playback remains unchanged and clearly labeled.
- [x] Interpretation changes create an immutable version linked to one Arrangement Score version.
- [x] Users can toggle literal and interpreted playback and inspect the applied choices.
- [x] Interpretation never changes notation, Arrangement Events, Transformation Report, or Preservation Audit.
- [x] A stale parent Arrangement Score makes the interpretation visibly stale without deleting it.

## Blocked by

- Tracer 05.
- Tracer 10.
