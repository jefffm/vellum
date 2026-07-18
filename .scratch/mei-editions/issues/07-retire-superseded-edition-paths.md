# 07 — Retire superseded edition paths

Status: ready-for-agent

Type: AFK

Blocked by: 06

## What to build

After the accepted page-9 vertical and Attested Realization prove the replacement, inventory and
delete the proof-only, duplicate, unreachable, or compatibility edition paths that it supersedes.
Prefer one canonical implementation and its focused tests over adapters that perpetuate the old
model.

This is deletion work, not a broad rewrite. An older arrangement, export, or LilyPond path remains
when it still provides a capability the MEI edition vertical does not replace.

## Acceptance criteria

- [ ] A caller-and-route inventory classifies each candidate as superseded, still required, or
      deliberately deferred, with a concrete reason.
- [ ] Superseded UI launchers, proof fixtures, routes, adapters, domain types, styles, and tests are
      deleted through their full dependency chain; no dead compatibility shim remains by default.
- [ ] Production entry points no longer expose the development-proof edition surface or duplicate
      canonical-write paths.
- [ ] Tests that only certify deleted implementations are removed. Retained behavioral properties
      are covered at the accepted MEI boundary without duplicative snapshots or implementation
      tests.
- [ ] Repository search, typecheck, builds, and the applicable browser/render/playback gates prove
      there are no dangling imports, routes, query flags, or fixture references.
- [ ] Still-required arrangement and LilyPond deliverable paths are explicitly named and remain
      operational.

## Blocked by

- 06 — First accepted Attested Realization
