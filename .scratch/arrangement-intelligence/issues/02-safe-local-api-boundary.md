# Safe local API boundary

Status: complete

Type: AFK

User stories: U1

## What to build

Make the Local-First Runtime safe by default while preserving an explicit path for future authenticated remote use.

## Acceptance criteria

- [x] The API binds loopback by default and rejects unknown browser origins.
- [x] Expected and unexpected errors use one typed, redacted envelope.
- [x] Remote exposure requires explicit configuration and an authorization boundary. Non-loopback exposure fails closed until a focused ADR accepts that boundary.
- [x] Hostile-origin and non-loopback regression tests cover all sensitive route families.

## Verification

See `../evidence/T02/verification.json`.

## Blocked by

- 01
