# Arrangement Intelligence execution controls

This directory is the executable control plane for the draft specification in
`docs/proposals/arrangement-intelligence/`.

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

`npm run spec:arrangement-intelligence` validates the planning control plane. It
requires complete, unique, gap-free mappings and rejects unknown tracers,
findings, requirements, evidence keys, invalid classifications, and corrupted
renumbering.

`npm run spec:arrangement-intelligence:complete` is the final goal judge. In
addition to the planning checks, it requires every tracer to be complete, every
requirement to have current passing machine evidence and its declared human
evidence, every audit finding to have an allowed verified closure, and final
suites to have passed at repository HEAD. Dependency content hashes make stale
evidence fail instead of silently surviving a changed input.

The completion command is expected to fail during implementation. A green
planning command is not a product-completion claim.
