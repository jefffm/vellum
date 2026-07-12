# Safe local API boundary

Status: ready-for-agent

Type: AFK

User stories: U1

## What to build

Make the Local-First Runtime safe by default while preserving an explicit path for future authenticated remote use.

## Acceptance criteria

- [ ] The API binds loopback by default and rejects unknown browser origins.
- [ ] Expected and unexpected errors use one typed, redacted envelope.
- [ ] Remote exposure requires explicit configuration and an authorization boundary.
- [ ] Hostile-origin and non-loopback regression tests cover all sensitive route families.

## Blocked by

- 01
