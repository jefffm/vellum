# Passage-level Arrangement Candidate adoption

Status: complete

Type: AFK

## What to build

Use Selection Context to request, audition, compare, and adopt alternative arrangement candidates for a bounded passage. Adopting an alternative creates one new Arrangement Score version, preserves unaffected events, records transformation and commitment consequences, and reruns the complete audit.

## Acceptance criteria

- [x] A selected passage can request ranked alternatives using its exact musical and historical context.
- [x] Alternatives can be auditioned and visually compared before adoption.
- [x] Adoption changes only the selected dependency region unless disclosed constraints require broader change.
- [x] One adoption creates one new version and retains the prior candidate/version.
- [x] Rejected candidates show the hard constraint or audit reason that rejected them.

## Blocked by

- Tracer 04.
- Tracer 06.
