# Arrangement Intelligence execution controls

Status: frozen completed prototype evidence; not an active execution wave.

The proposal snapshot that this wave implemented is archived under
`docs/archive/specifications/2026-07-13/repository/docs/proposals/arrangement-intelligence/`.
The current implementation specification is `SPEC.md`. Paths inside the frozen Plan,
ledgers, manifest, and evidence are intentionally preserved as historical identities.

## Authoritative files

- `PLAN.md` defines the dependency-ordered tracer sequence and completion gates.
- `REQUIREMENTS.md` assigns one stable ID, source section, owner tracer, gate,
  machine-evidence obligation, human-evidence obligation, and initial status to
  every atomic normative requirement.
- `AUDIT_TRACEABILITY.md` assigns every audit finding F001-F047 to tracers,
  verification obligations, and allowed final dispositions.
- `completion-manifest.json` links current evidence and closure records without
  rewriting either ledger.
- `issues/` contains the local Markdown tracer bullets.
- `evidence/` retains machine-readable evidence artifacts as tracers close.

## Verification modes

`npm run history:arrangement-intelligence:verify` validates the planning control plane. It
requires complete, unique, gap-free mappings and rejects unknown tracers,
findings, requirements, evidence keys, invalid classifications, and corrupted
renumbering.

`npm run history:arrangement-intelligence:complete` is the historical final goal judge. In
addition to the planning checks, it requires every tracer to be complete, every
requirement to have current passing machine evidence and its declared human
evidence, every audit finding to have an allowed verified closure, and final
suites to have passed at repository HEAD. Dependency content hashes make stale
evidence fail instead of silently surviving a changed input.

These commands preserve the 2026-07-13 prototype closure contract. They do not judge
completion of the current specification.
