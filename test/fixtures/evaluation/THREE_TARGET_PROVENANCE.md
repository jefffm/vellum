# Three-target Golden corpus provenance

The target-specific transition, diapason, and classical-guitar studies are
original Vellum test fixtures. Their authors dedicate them to the public domain
under CC0 1.0; each source carries an `SPDX-License-Identifier: CC0-1.0`
header. They contain no private workspace export or third-party reference
arrangement.

The shared Greensleeves case is the separately documented public-domain
Mutopia fixture in `test/fixtures/greensleeves/PROVENANCE.md`.

## Dataset role

Version 1 of `dataset.three-target-golden` assigns every case exactly one
`held_out` role. Generator-visible inputs are the cited source artifacts and
Owner briefs only. Reviewed truth, invariants, mutations, acceptable
alternatives, and reference evidence are evaluator-side material and must not
be passed into planning, search, prompting, or model context.

## Reference-output policy

The corpus intentionally records two acceptable alternatives for each case.
They are reviewed boundary examples, not snapshots and not unique answers. A
candidate passes by satisfying the declared musical and target-specific
invariants; byte equality with either description is neither required nor
sufficient.

## Private material

The `privateWorkspaceExports` manifest is empty. Adding an Owner workspace
requires deliberate export, explicit license provenance, privacy review, a new
dataset version, and review of any comparisons invalidated by the role change.
