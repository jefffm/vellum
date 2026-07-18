# Focused ADR preparation and validated legacy migration

Status: complete

Type: AFK

User stories: U1, U9

## What to build

Prepare focused accepted-decision documents from implemented evidence and remove or explicitly quarantine canonical-looking legacy paths.

## Acceptance criteria

- [x] Focused ADR drafts cover truth convergence, planning, instrument instances, constraints/search, evaluation, and playtest learning.
- [x] Every decision cites production and evaluation evidence rather than aspiration.
- [x] Legacy flat arrangements are migrated, retired, or explicitly labeled noncanonical.
- [x] Specification reconciliation and prompts describe actual supported surfaces.

## Delivered

- Six focused ADRs document Source Truth convergence, versioned Brief/Plan lineage, exact Instrument Instances, serializable bounded search, versioned evaluation/promotion, and reviewed Playtest learning. The Owner accepted them as the prototype architecture baseline at T44 on 2026-07-13.
- A canonical-ownership and migration inventory names one owner for every decision/evidence family and lists every intentionally retained legacy surface.
- The flat `/api/arrangements` store now labels new and pre-boundary records `noncanonical_legacy_projection` and requires real workspace import before canonical use. No migration fabricates source provenance, review authority, Analysis, Plan, Search, audit, or lineage.
- CONTEXT and the model system prompt describe the actual workspace pipeline, three priority target families, contextual continuo, imitative intabulation, and the noncanonical compatibility boundary.
- An M19 architecture test requires all focused ADR sections and evidence links, successful T36–T38 dependency evidence, retained-surface documentation, and prompt reconciliation.

## Verification

- Route tests cover create/get/list canonicality disclosure and on-read labeling of a pre-boundary flat JSON file.
- Architecture tests fail if an ADR claims acceptance early, loses production/evaluation grounding, omits cross-domain evidence, or lets the prompt present the flat store as canonical.
- Full gates and dependency hashes are recorded in `evidence/T39/verification.json`.

## Honest limits

- This tracer prepared and verified the decisions without self-authorizing H9/H10 Owner acceptance; the later T44 Owner decision accepted the prototype architecture baseline while waiving the remaining role-scoped attestations for this wave.
- The flat compatibility store is quarantined rather than automatically converted. A canonical import needs the real source and reviewed decisions, which cannot be reconstructed honestly from generated LilyPond alone.
- Stateless compile/engrave tools remain supported for projection and diagnostics, but their success is not Arrangement Readiness.

## Blocked by

- 36
- 37
- 38
