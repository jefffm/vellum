# ADR 0022: Govern the Reviewed Knowledge Library

## Status

Accepted — Owner approved on 2026-07-13.

## Context

ADRs 0002 and 0015 separate project state, Personal Defaults, Owner references, and a reviewed Historical Knowledge Base. Instrument Intelligence now also requires modern pedagogy, editorial convention, software heuristics, notation guidance, source identity and rights provenance, immutable pack releases, scoped review authority, complete applicability resolution, and safe reassessment.

Treating all of that as historical knowledge would collapse authority lanes. Treating release review as a mutable field would break content addressing and replay. Recording only the packs selected by a resolver would make manifest completeness unverifiable.

## Decision

Vellum will retain the Historical Knowledge Base as the historical-practice authority lane inside a broader local-first Reviewed Knowledge Library.

Knowledge authority lane and musical domain are orthogonal. Authoritative entries, profiles, and derivations must match their Release lane; cross-lane references remain typed evidence or conflict context and cannot activate consequences in the receiving lane. Instrument mechanics, Instrument Instances, Personal Defaults, Owner Ergonomic Profiles, and evaluator datasets remain external linked records.

A mutable Knowledge Pack Draft may produce an immutable content-addressed Knowledge Pack Release. Review authority is expressed by separate typed, digested scoped attestations. Trust and reviewer authorization are computed by external Attestation Verifications under pinned verifier policies; advisory issuer identity and authority are computed by external Advisory Verifications. They are not claimant-controlled fields. Supersession, retraction, rights restriction, and attestation revocation are separate advisories; none mutates a release. An immutable Activation Decision combines scope-matched attestations and verifications, verified advisories, rights decisions, and the Resolution Policy before a profile can affect arranging. Every considered profile receives exactly one allow, deny, or review-required Activation Decision.

Test-only attestations are system-issued under a pinned test policy and convey no human authority. Owner-reviewed-local and specialist attestations require the corresponding human reviewer authority and scope verification.

An authoritative Knowledge Library Inventory Snapshot enumerates every Release reachable from pinned configured registries under an exact inventory builder and policy. A Knowledge Catalog Snapshot records an eligibility outcome for every inventoried Release. An Applied Knowledge Manifest resolves those exact snapshots, Resolution Policy, context, Component Registry Snapshot, Activation Decisions, attestations, Attestation and Advisory Verifications, advisories, and rights decisions. It records an outcome for every eligible release and reachable profile, including exclusions, conflicts, and unknowns. A manifest containing only the packs a catalog builder, resolver, or generator happened to find or use is invalid.

Reference evidence separates immutable versioned bibliographic assertion snapshots with parent and digest identity, immutable bytes, acquisition provenance, Source Segment Versions, identity redirects, rights assertions, and operation-specific Access Decisions. Unreviewed extraction creates candidates only. Private or uncertain content cannot leave the local trust boundary without an applicable destination- and purpose-scoped decision.

Existing Arrangement Searches and Historical Knowledge records remain immutable legacy evidence. Migration maps same-lane records where provenance permits, quarantines mixed or self-authorizing authority by default, retains explicit compatibility reads, and disables old activation paths at cutover. It cannot invent missing source identity, release authority, or manifests.

## Relationship to existing decisions

This decision extends rather than erases ADRs 0002 and 0015: workspace corrections still remain project-local, Personal Defaults remain soft Owner authority, and only reviewed source-backed historical claims enter the Historical Knowledge Base. ADRs 0019 through 0021 continue to govern search, evaluation, and reviewed learning.

## Consequences

- Historical, pedagogical, editorial, software, personal, mechanical, and evaluator authority remain inspectably distinct.
- Pack promotion and retraction preserve immutable history.
- Missing or conflicting applicability cannot disappear from search identity.
- Source deletion or rights change may limit replay without rewriting prior records.
- Implementation requires schema-versioned migration, Inventory and Catalog Snapshots, attestations and external verification, Activation Decisions, advisories, complete manifest validation, and operation-specific access checks.
