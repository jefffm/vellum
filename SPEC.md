# Vellum Instrument Intelligence

Status: Current and authoritative next-work specification

Effective: 2026-07-13

## Authority and reading order

This is the only current implementation specification in the repository.

The reading order is:

1. [CONTEXT.md](./CONTEXT.md) defines Vellum's domain language and enduring invariants.
2. Accepted decisions under [docs/adr](./docs/adr/) govern architecture.
3. This document defines the next product outcome, scope, sequencing, and acceptance boundary.
4. The active tracer plan under .scratch, when one exists, may divide this specification into executable slices but may not silently narrow or expand it.
5. Current code and tests are evidence of implementation, not permission to contradict the preceding documents.

Earlier specifications, proposals, audits, blunder hunts, and execution plans are preserved under [docs/archive/specifications/2026-07-13](./docs/archive/specifications/2026-07-13/README.md). They are design history, not a backlog and not an alternative source of current requirements.

### Architectural decision gate

[ADR 0022](./docs/adr/0022-govern-reviewed-knowledge-library.md) is proposed alongside this revision. It must be accepted before Slice 1 writes new canonical Reviewed Knowledge Library records. Until then, accepted ADRs 0002 and 0015 remain authoritative, and no tracer may resolve a conflict by silently treating this specification as an accepted architectural decision.

## Product outcome

Vellum should provide the practical benefit of a personal musicologist and expert arranger without requiring the Owner to supply musicological vocabulary or instrument-specific rules.

Given a musical source, Vellum should ordinarily infer:

- the Principal Voice or the absence of one;
- Texture, Contrapuntal Technique, voice roles, phrases, cadences, and form;
- Continuo Foundation, Figured Bass, and realization obligations when present;
- which source relationships define recognizability;
- a coherent target texture and voice plan;
- idiomatic target-instrument technique by passage;
- playable phrase-level physical realization; and
- what uncertainty or compromise is consequential enough to show the Owner.

The default interaction stays simple: upload source material, choose one or more targets and Notation Layouts, optionally state an intention, then review only material uncertainty and consequential choices. Complete analysis, evidence, alternatives, rejected candidates, and source citations remain available through progressive disclosure.

Five-course baroque guitar, thirteen-course baroque lute, and six-string classical guitar are coequal initial targets. Shared architecture must enable each target without reducing all three to the same technique, search state, notation, or evaluation model.

## Why this is the next work

The accepted prototype baseline already provides:

- local-first Arrangement Workspaces;
- symbolic and optical source ingestion;
- Score-Anchored Review;
- Musicological Analysis;
- purpose-scoped Source Truth;
- Arrangement and Performance Briefs;
- versioned Arrangement Plans;
- independent target Arrangement Searches;
- Preservation Audits and Transformation Reports;
- immutable Arrangement Scores and branching;
- score selection, batch edits, and version history;
- PDF, SVG, LilyPond, MIDI, Audio Preview, and score-following playback;
- reviewed-learning boundaries; and
- a versioned evaluation harness.

That baseline proves the product loop, but not expert-quality target realization. Three exact Owner observations define the present failure boundary:

1. The Greensleeves baroque-guitar result preserves notes but is neither convincing punteado nor valid mixed-style writing. It uses chord and transition choices that are nominally reachable but not idiomatic.
2. The Greensleeves baroque-lute result includes an f/b stopped-course combination spanning frets 1 through 5 on the Owner's approximately 690 mm instrument, despite closer equivalent realizations.
3. The Greensleeves classical-guitar result preserves the Principal Voice but reduces a 59-event source bass to four isolated events, so it is not a coherent two-voice arrangement.

The current knowledge implementation is also too weak for the product promise:

- OwnerReference collapses Work, Edition, Exemplar, Digital Asset, and citation identity.
- HistoricalPracticeClaim mixes historical authority, modern editorial convention, and Vellum heuristics.
- KnowledgePack contains little more than a list of claim IDs.
- documentary classification is incorrectly treated as perfect confidence;
- Arrangement Search records no applied Knowledge Pack identities; and
- labels such as idiom, historical profile, playability, and voice leading are currently proxy scores rather than independently grounded evaluations.

This specification replaces those proxies with a source-backed, reviewable instrument-intelligence pipeline.

## System loop

```mermaid
flowchart LR
    A["Reference Source"] --> B["Source Identity and Page Atlas"]
    B --> C["Modality-specific Extraction"]
    C --> D["Cited Knowledge Candidates"]
    D --> E["Reviewed Pack Release"]
    E --> F["Applied Knowledge Manifest"]
    F --> G["Analysis and Arrangement Plan"]
    G --> H["Target Idiom Compiler"]
    H --> I["Arrangement Candidates"]
    I --> J["Independent Evaluation"]
    J --> K["Workbench and Playtest"]
    K --> L["Reviewed Proposals"]
    L --> D
    L --> M["Ergonomic or Personal Defaults"]
    L --> N["Calibration or Fixture Candidates"]
```

The loop is accumulative but never self-authorizing. Extraction proposes evidence. Review releases knowledge. Arrangement produces candidates. Independent evaluation inspects output. Owner feedback proposes scoped changes. No stage promotes its own output into authority.

## Non-negotiable boundaries

### Authority lanes remain distinct

| Evidence or decision                  | Canonical destination                         | Direct arranging authority                      |
| ------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Cited period prescription             | Historical Practice Pack                      | Only from an applicable released profile        |
| Pattern observed in period repertoire | Descriptive observation                       | No; it may support a reviewed profile           |
| Modern method or editorial synthesis  | Modern Pedagogy or Editorial Pack             | Only with explicit modern authority and scope   |
| Vellum default or heuristic           | Software Profile                              | Yes when selected, but never labeled historical |
| Instrument construction and geometry  | Instrument Model or exact Instrument Instance | Yes for the modeled mechanic                    |
| Owner physical result                 | Owner Playtest or Ergonomic Profile candidate | Only for the reviewed performer and context     |
| Repeated Owner choice                 | Personal Default Candidate                    | Only after Owner approval                       |
| Evaluator disagreement                | Calibration or Fixture Candidate              | Only after separate review and dataset controls |

A HistoricalPracticeClaim may not use modern editorial convention or a Vellum heuristic as its authority. Those belong to separately named record types.

### Uncertainty is data

Unknown, not evaluated, conflicting, and inapplicable are distinct from false. Missing evidence cannot produce a passing score. A useful provisional result may still be offered, but its heuristic or unresolved basis must be visible and must not be described as historically certified.

### Readiness is tiered, not one boolean

Vellum distinguishes five non-interchangeable states:

- **pipeline complete**: the deterministic workflow completed and all required machine contracts ran;
- **provisional result**: an inspectable result exists, but one or more idiom, historical, ergonomic, human, or held-out dimensions remain unknown;
- **capability qualified**: one exact sealed Generation System, target profile, and dependency closure passed its required non-Greensleeves held-out groups;
- **artifact ready**: one exact target result passed its notation, playback, mechanical, relationship, and role-scoped human gates under a compatible current Capability Qualification; and
- **program complete**: all required shared verticals and all three coequal targets reached both capability and exact-artifact readiness boundaries.

Pipeline completion never implies capability or artifact readiness. Capability evidence qualifies a sealed system/profile version; exact-output evidence qualifies an artifact. Changing either side independently stales the corresponding claim. Readiness is claim- and profile-scoped: a dimension deliberately excluded by an editorial profile is `not_applicable` or `not_claimed`, not `unknown`. An applicable unresolved dimension may remain visible on a provisional result, but it cannot support labels such as `ready`, `playable`, `idiomatic`, `historically supported`, or `specialist reviewed`.

A Capability Qualification pins the Generation System digest and transitive dependency closure, target and acceptance profiles, split manifest and contamination history, provider-exposure record, evaluator versions, all attempted groups, and machine results. Artifact Readiness pins the exact Arrangement Score and Deliverable digests, Instrument Instance and Performance Brief, compatible Capability Qualification, independent Evaluation Cards and Adoption Decision, and required human or physical evidence. Either record is immutable; a changed dependency, profile, output, or required-evidence policy creates a new record or an explicit stale state.

### Knowledge activation is explicit

Knowledge lifecycle and arranging authority are separate. The activation policy is:

| Artifact or attestation                      | Permitted use                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Mutable draft                                | Workbench authoring only                                                                                                    |
| Immutable release with test-only attestation | Isolated evaluation or an explicitly enabled provisional research mode                                                      |
| Owner-reviewed-local attestation             | Disclosed local guidance within the attested scope                                                                          |
| Specialist attestation                       | Historical or specialist presentation only within the attested claim, profile, instrument, period, school, and review scope |

A test-only release may exercise the production code path, but it cannot become the default candidate, produce a ready result, or satisfy a historical-readiness gate. Promotion creates a new immutable release or attestation; it never changes an existing release in place.

### Constitutive technique belongs to the score plan

Technique belongs to the Arrangement Plan or Arrangement Score when it changes the musical event, available notes, sounding courses, voice continuity, duration, articulation identity, or notation. Examples include a rasgueado stroke, an alfabeto chord, required course suppression, a campanella fingering that sustains overlapping notes, or a required damping event.

Optional execution detail belongs to Performance Interpretation when changing it leaves the canonical notated and sounding musical obligations intact. The same family of technique may occupy different layers in different passages, so the decision is explicit rather than globally hard-coded.

### Packs contain declarative knowledge, not executable uploads

Knowledge Packs may name registered compiler and evaluator components and provide schema-validated parameters. An imported document or pack cannot supply arbitrary executable code, file paths, shell commands, templates with active content, or provider credentials.

### Old results remain reproducible

A new source, claim, profile, pack release, compiler, or evaluator never rewrites an existing Arrangement Search or Arrangement Score. It may create a Knowledge Reassessment explaining that regeneration could improve or invalidate an earlier readiness claim.

### Data lifecycle and deletion

Immutability does not mean that private content must be retained forever. Every blob and derivative has retention, pinning, reference, rights, backup, and deletion state.

Before deletion, Vellum shows dependent segments, extractions, candidates, releases, fixtures, arrangements, evaluations, reports, caches, backups, and known exports. The Owner may cancel, retain an explicitly pinned encrypted local copy, remove bytes and purge unauthorized derivatives, or preserve non-sensitive tombstone metadata while marking citations and replay unavailable.

Purge follows the complete provenance graph within Vellum-controlled storage and cannot silently leave crops, OCR text, translations, prompts, logs, fixtures, managed exports, or backups whose authorization depended on the deleted material. Immutable records may retain digest, former identity, deletion time, and reason without retaining deleted content. Affected records report `source unavailable`, `partially reproducible`, or `not reproducible`; current resolvers receive an advisory and cannot claim evidence that is no longer available under policy. Vellum cannot recall bytes already copied to an unmanaged device or external recipient. It records that irreversible disclosure, warns the Owner before egress and purge, and retains only the minimum permitted disclosure tombstone.

## Reference-source substrate

### Durable identity graph

Reference identity uses versioned assertions rather than forcing uncertain imports into a falsely complete hierarchy. Immutable bytes, acquisition provenance, bibliographic identity, and rights decisions remain separate.

```ts
type Work = {
  id: string;
  version: number;
  parentVersionRef?: DigestedRef;
  preferredTitle?: string;
  creatorIds: string[];
  workDate?: DateRange;
  identityState: "candidate" | "reviewed" | "disputed";
  digest: string;
};

type SourceManifestation = {
  id: string;
  version: number;
  parentVersionRef?: DigestedRef;
  kind: "edition" | "issue" | "volume" | "part" | "manuscript" | "compilation";
  workRelations: Array<{
    workRef: DigestedRef;
    role: "contains" | "edition_of" | "excerpt_of";
  }>;
  parentRelations: Array<{
    manifestationRef: DigestedRef;
    role: "part_of" | "bound_with" | "supplement_to";
  }>;
  publicationDate?: DateRange;
  publicationStatement?: string;
  language: string[];
  editorIds: string[];
  translatorIds: string[];
  declaredChanges: string[];
  identityState: "candidate" | "reviewed" | "disputed";
  digest: string;
};

type Exemplar = {
  id: string;
  version: number;
  parentVersionRef?: DigestedRef;
  manifestationRefs: DigestedRef[];
  holdingInstitution?: string;
  shelfmark?: string;
  completeness: "complete" | "incomplete" | "unknown";
  exemplarNotes: string[];
  identityState: "candidate" | "reviewed" | "disputed";
  digest: string;
};

type DigitalAsset = {
  id: string;
  sha256: string;
  mediaType: string;
  byteLength: number;
};

type AssetAcquisition = {
  id: string;
  digitalAssetRef: DigestedRef;
  representedExemplarRefs: DigestedRef[];
  sourceKind: "upload" | "stable_url" | "iiif" | "library_object" | "private_scan";
  providerObjectRef?: string;
  redactedRetrievalUri?: string;
  retrievedAt?: string;
  rightsAssertionRefs: DigestedRef[];
  processingPolicyRef: DigestedRef;
};

type SourceSegmentVersion = {
  id: string;
  version: number;
  parentVersionRef?: DigestedRef;
  digitalAssetRef: DigestedRef;
  pageAtlasRef: DigestedRef;
  canvasId: string;
  printedLocator?: string;
  scanLocator: string;
  coordinateSystem: string;
  regionTransforms: PageTransform[];
  regions: PageRegion[];
  musicalRange?: MusicalRange;
  modality: SourceModality;
  sourceImageRef: ContentRef;
  cropDigest: string;
  digest: string;
};

type IdentityRedirect = {
  id: string;
  kind: "alias" | "merge" | "split" | "supersession";
  fromRefs: DigestedRef[];
  toRefs: DigestedRef[];
  evidenceRefs: DigestedRef[];
  digest: string;
};
```

Each entity version is an immutable bibliographic assertion snapshot. An import may begin with incomplete or disputed identity. Filename, repository grouping, and catalog metadata create candidate identity assertions, not placeholder Editions or proof. Correction creates a child or superseding version; merge, split, and alias decisions create an immutable Identity Redirect while preserving every prior record and the asset bytes it described. One Work may occur in many manifestations, a compilation may contain many Works, a manuscript need not pretend to be an Edition, and one digital asset may represent multiple exemplars or provider objects.

Every released claim cites one or more immutable Source Segment Versions. A Page Atlas correction creates new segment versions; it cannot change the canvas, crop, coordinates, or meaning of an existing citation.

### Rights, access, processing, and egress

Rights assertions are evidence-bearing claims, not mutable fields on a byte blob and not legal certainty manufactured by Vellum. The following operations remain separately authorized:

- underlying Work status;
- manifestation, translation, or editorial rights;
- physical Exemplar restrictions;
- scan-provider terms and requested attribution;
- Owner-private access;
- local extraction permission;
- named-provider OCR, OMR, translation, or model-processing permission;
- pack citation and excerpt permission; and
- export or redistribution permission.

A public-domain Work does not imply that every digital scan is unrestricted. A copyrighted Owner-owned method may support local cited candidates without permitting source pages or extracted content to enter a repository pack.

Every operation records an immutable Access Decision over exact source and derivative refs, destination, purpose, policy, supporting assertions, rationale, and time. Unknown rights fail closed for provider egress, fixture inclusion, public export, and redistribution. Private local study may proceed only under an explicit local policy or Owner attestation; Vellum does not present that decision as legal advice.

Before remote processing, Vellum shows and records the exact regions, text, notation, or metadata to be transmitted; named destination and purpose; applicable rights and Owner authorization; provider-policy identity when known; and resulting Access Decision. Every extraction, crop, transcription, translation, candidate, pack entry, fixture, prompt, report, log, and export retains transitive source refs so policy follows derivatives rather than stopping at the original bytes.

### Untrusted-ingestion boundary

Reference files, URLs, IIIF manifests, catalog metadata, OCR text, translations, and imported packs are untrusted input.

- Acquisition permits only supported URI schemes. Redirects are revalidated at every hop; loopback, link-local, private-network, credential-bearing, local-file, and disallowed targets require an explicit local connector rather than a generic fetch.
- DNS resolution and the connected address must satisfy the same policy. Retrieval URIs are sanitized before persistence or display.
- Imports enforce byte, page, pixel, archive-expansion, nesting, time, memory, and output limits. Declared media type is checked against detected content.
- PDF, image, archive, OCR, OMR, and conversion components run with bounded resources and without ambient network, credential, provider-token, or unrestricted filesystem access.
- Imported text and metadata render as inert escaped data under the applicable Content Security Policy. Content refs resolve only through Vellum's content store and cannot embed arbitrary paths or executable URLs.
- Pack bindings resolve only through an exact authorized Component Registry Snapshot. Parameter schemas include units, ranges, collection limits, compatibility, and resource budgets.
- Secrets, callbacks, source content without export authority, and local paths are redacted from logs, diagnostics, snapshots, prompts, and exported state.

### Page atlas

Every paged asset receives a versioned Page Atlas that records:

- scan or canvas order;
- printed pagination, foliation, plate labels, and separate internal sequences;
- missing, duplicate, rotated, cropped, damaged, or blank pages;
- detected regions and their modality;
- links across split text and plate volumes; and
- corrections with provenance.

The atlas is the routing and citation surface. It is not a single OCR transcript.

Atlas generation is bounded, resumable, cancellable, and incremental. Large assets may expose a verified partial Atlas while unprocessed pages remain explicit; failure or resource exhaustion cannot be mistaken for a complete scan inventory.

### Modality-specific extraction

Regions may independently route to:

- modern prose OCR;
- long-s or historical-type OCR;
- Fraktur OCR;
- staff OMR;
- figured-bass symbol recognition aligned to exact bass events, including accidentals, continuation, geometry, and unresolved alternatives;
- printed tablature recognition;
- handwritten tablature recognition;
- alfabeto or diagram extraction;
- handwriting recognition;
- table or parallel-layout alignment;
- translation; or
- visual-only review.

Every Extraction Run records component identity, version, configuration, inputs, outputs, confidence, geometry, logs, and failure state. A crop and extracted text or notation remain projections of the immutable Source Segment Version and asset bytes; neither becomes a freestanding citation authority.

### Cited extraction artifacts

A candidate derived from sources retains:

- one or more exact Source Segment Version refs, asset digests, acquisition provenance, and applicable Access Decisions;
- source crops, coordinate systems, transforms, and geometry;
- original transcription;
- normalized transcription;
- translation when used;
- extraction component and confidence;
- source-identity confidence;
- interpretation confidence;
- applicability confidence;
- reviewer role and review state; and
- unresolved alternatives.

One scalar confidence cannot stand in for these independent uncertainties.

## Reviewed Knowledge Library

The Historical Knowledge Base becomes one authority lane in a broader Reviewed Knowledge Library. Authority and musical subject are orthogonal:

- authority lanes are historical practice, modern pedagogy, editorial convention, software heuristic, and Owner-local reviewed guidance;
- knowledge domains include analysis and counterpoint, continuo and Figured Bass, instrument technique, notation, playback, ergonomics, and evaluation guidance.

A pack release declares one authority lane and one or more domains. A historical continuo pack and a modern-pedagogical continuo pack therefore remain distinguishable instead of competing inside one overloaded kind.

Instrument mechanics, Instrument Instances, Personal Defaults, Owner Ergonomic Profiles, and evaluator datasets remain linked external records rather than being smuggled into a pack kind.

### Knowledge Candidates

Candidate classification uses orthogonal axes rather than one overloaded kind.

```ts
type KnowledgeCandidate = {
  id: string;
  parentVersionRef?: DigestedRef;
  nodeKind: "assertion" | "example" | "validation_guidance" | "conflict" | "research_question";
  authorityLane: KnowledgeAuthorityLane;
  domains: KnowledgeDomain[];
  epistemicForm?:
    | "prescription"
    | "worked_example"
    | "descriptive_observation"
    | "modern_synthesis"
    | "editorial_convention"
    | "software_heuristic";
  evidenceRoles: ("support" | "contradiction" | "qualification" | "counterexample")[];
  proposition?: TypedKnowledgeProposition;
  applicability: ApplicabilityPredicate[];
  evidenceRefs: DigestedRef[];
  relationshipRefs: DigestedRef[];
  derivationRefs: DigestedRef[];
  reviewState: "proposed" | "reviewed" | "rejected" | "superseded";
  assertedBy: ActorRef;
  digest: string;
};
```

A worked example may also be descriptive evidence or a counterexample; those roles do not change its authority lane. A conflict and a research question are graph nodes, not disguised claims. Candidate corrections create a new digested version.

Authority lanes are discriminated, not additive badges. A `historical_practice` candidate cannot use `modern_synthesis`, `editorial_convention`, or `software_heuristic` as its authoritative epistemic form. A release's authoritative entries, profiles, and Constraint Derivations must match its declared authority lane. Cross-lane references are permitted only through typed `evidence_only`, `counterevidence`, or `conflict_context` relations; they cannot activate consequences in the receiving lane or launder software, editorial, pedagogical, or personal judgment into a historical claim.

Claims and observations support many-to-many evidence. Typed relationships include:

- supports;
- contradicts;
- narrows;
- qualifies;
- supersedes;
- derived from;
- exemplifies; and
- counterexample to.

Descriptive repertoire observations retain corpus identity, sampling method, numerator, denominator where meaningful, examples, counterexamples, and coverage limitations. Frequency is not silently converted into prescription.

Converting evidence into a compiler or evaluator consequence requires a separately reviewed Constraint Derivation that records input refs, inference rule, authority lane, applicability, hard/soft/descriptive force, limitations, and reviewer attestations. A profile cannot grant itself precedence over another authority lane. Cross-lane composition belongs to a centrally versioned Knowledge Resolution Policy.

### Drafts, releases, attestations, and advisories

A Knowledge Pack Draft is mutable workbench state. A Knowledge Pack Release is an immutable content-addressed graph snapshot. Review authority and current eligibility are external immutable records; neither mutates release content.

```ts
type KnowledgePackRelease = {
  id: string;
  packId: string;
  sequence: number;
  schemaVersion: string;
  authorityLane: KnowledgeAuthorityLane;
  domains: KnowledgeDomain[];
  entryRefs: DigestedRef[];
  relationshipRefs: DigestedRef[];
  profileRefs: DigestedRef[];
  derivationRefs: DigestedRef[];
  dependencyRelations: Array<{
    targetRef: DigestedRef;
    role: "same_lane_authority" | "evidence_only" | "counterevidence" | "conflict_context";
  }>;
  digestAlgorithm: "sha256";
  digest: string;
};

type ReleaseAttestation = {
  id: string;
  releaseRef: DigestedRef;
  kind: "test_only" | "owner_reviewed_local" | "specialist_reviewed";
  reviewerIdentityRef: EntityRef;
  reviewerRoleRef: DigestedRef;
  reviewScopeRef: DigestedRef;
  signatureRef?: ContentRef;
  evidenceRefs: DigestedRef[];
  issuedAt: string;
  digest: string;
};

type AttestationVerification = {
  id: string;
  attestationRef: DigestedRef;
  verifierPolicyRef: DigestedRef;
  authenticatedReviewerIdentityRef?: EntityRef;
  authorizationScopeRef?: DigestedRef;
  result: "verified_authorized" | "verified_out_of_scope" | "unverified" | "revoked";
  checkedAt: string;
  evidenceRefs: DigestedRef[];
  digest: string;
};

type ReleaseAdvisory = {
  id: string;
  subjectRef: DigestedRef;
  kind: "superseded" | "retracted" | "attestation_revoked" | "rights_restricted";
  issuedBy: ActorRef;
  effectiveAt: string;
  rationale: string;
  evidenceRefs: DigestedRef[];
  replacementRef?: DigestedRef;
  digest: string;
};

type AdvisoryVerification = {
  id: string;
  advisoryRef: DigestedRef;
  verifierPolicyRef: DigestedRef;
  authenticatedIssuerIdentityRef?: EntityRef;
  authorizationScopeRef?: DigestedRef;
  result: "verified_authorized" | "verified_out_of_scope" | "unverified" | "revoked";
  checkedAt: string;
  evidenceRefs: DigestedRef[];
  digest: string;
};

type ActivationDecision = {
  id: string;
  releaseRef: DigestedRef;
  profileRef: DigestedRef;
  attestationRefs: DigestedRef[];
  verificationRefs: DigestedRef[];
  rightsDecisionRefs: DigestedRef[];
  applicableAdvisoryRefs: DigestedRef[];
  advisoryVerificationRefs: DigestedRef[];
  requestedScopeRef: DigestedRef;
  resolutionPolicyRef: DigestedRef;
  mode?: "test_only" | "owner_reviewed_local" | "specialist_reviewed";
  result: "allow" | "deny" | "review_required";
  rationale: string;
  digest: string;
};
```

Canonical serialization, digest domain, schema version, and internal digested references are part of the storage contract. Content changes create a new release. Later review creates an attestation; supersession, retraction, rights restriction, or revocation creates an advisory. Trust is computed by an external Attestation Verification under a pinned verifier policy; advisory issuer identity and authority over the advisory kind, subject, and scope are computed by an external Advisory Verification. Neither is a claimant-controlled field. An imported self-assertion remains unverified and cannot confer specialist authority or change current eligibility.

For brevity, this specification may call a release whose only activating attestation is `test_only` a test-only release; the state belongs to the attestation, not mutable release content.

A test-only attestation is system-issued under a pinned test policy and conveys no human, historical, or specialist authority. Owner-reviewed-local and specialist attestations require the corresponding human reviewer and external scope verification. Owner-reviewed local knowledge may guide local work with explicit disclosure; it is not presented as specialist-reviewed historical practice. AFK automation may build drafts, extraction artifacts, candidates, test-only releases and attestations, and review packages; it may not invent the human authority required for an Owner-local or specialist attestation.

### Profiles and compiler mappings

A pack profile contains:

- applicability predicates;
- scoped claims and observations;
- examples and counterexamples;
- permitted, preferred, discouraged, and prohibited outcomes;
- declarative mappings to registered Analysis, planning, compiler, notation, playback, and evaluator components;
- parameter values and units;
- conflicts requiring the central Knowledge Resolution Policy;
- expected observable consequences; and
- limitations and unevaluated dimensions.

Profiles are not prompt fragments. Prompt summaries may be derived from them, but search constraints and evaluators consume the same typed profile identity.

Every registered component binding pins executable or artifact digest where retainable, interface and parameter-schema digest, unit schema, compatibility range, resource policy, and replay availability. If old executable semantics can no longer be run, Vellum preserves inspection and reports regeneration unavailable rather than pretending that a matching version string is reproducible.

## Applied Knowledge Manifest

Resolution begins from retained immutable inputs, not from an opaque context digest or the subset of packs that a resolver happened to choose.

The Knowledge Library Inventory Snapshot is the independently rebuildable complete release enumeration; the Knowledge Catalog Snapshot is the policy-filtered view derived from it.

```ts
type KnowledgeResolutionContext = {
  id: string;
  passageRef: DigestedRef;
  sourceContextRefs: DigestedRef[];
  analysisRef: DigestedRef;
  arrangementPlanRef: DigestedRef;
  arrangementBriefRef: DigestedRef;
  performanceBriefRef: DigestedRef;
  preservationPolicyRef: DigestedRef;
  instrumentInstanceRef: DigestedRef;
  digest: string;
};

type KnowledgeLibraryInventorySnapshot = {
  id: string;
  configuredRegistryRefs: DigestedRef[];
  allReleaseRefs: DigestedRef[];
  inventoryBuilderRef: DigestedRef;
  inventoryPolicyRef: DigestedRef;
  digest: string;
};

type KnowledgeCatalogSnapshot = {
  id: string;
  inventorySnapshotRef: DigestedRef;
  eligibleReleaseRefs: DigestedRef[];
  inventoryOutcomeRefs: DigestedRef[];
  attestationRefs: DigestedRef[];
  verificationRefs: DigestedRef[];
  advisoryRefs: DigestedRef[];
  advisoryVerificationRefs: DigestedRef[];
  rightsDecisionRefs: DigestedRef[];
  trustPolicyRef: DigestedRef;
  catalogBuilderRef: DigestedRef;
  digest: string;
};

type PredicateResult = {
  predicateRef: DigestedRef;
  result: "true" | "false" | "unknown" | "error";
  evidenceRefs: DigestedRef[];
  rationale: string;
};

type AppliedKnowledgeEntry = {
  releaseRef: DigestedRef;
  profileRef: DigestedRef;
  status: "applicable" | "inapplicable" | "conflicting" | "unknown" | "excluded";
  predicateResults: PredicateResult[];
  consequenceRefs: DigestedRef[];
  evidenceRefs: DigestedRef[];
  conflictRefs: DigestedRef[];
  activationDecisionRef: DigestedRef;
  rationale: string;
};

type AppliedKnowledgeManifest = {
  id: string;
  schemaVersion: string;
  contextRef: DigestedRef;
  inventorySnapshotRef: DigestedRef;
  catalogSnapshotRef: DigestedRef;
  resolverSpecRef: DigestedRef;
  resolutionPolicyRef: DigestedRef;
  componentRegistrySnapshotRef: DigestedRef;
  dependencyClosureRefs: DigestedRef[];
  releaseOutcomeRefs: DigestedRef[];
  entries: AppliedKnowledgeEntry[];
  conflictRefs: DigestedRef[];
  selectionDecisionRefs: DigestedRef[];
  compiledConstraintRefs: DigestedRef[];
  digest: string;
};
```

Manifest completeness is an enforced invariant:

- the Inventory Snapshot is the authoritative enumeration of every release reachable from the pinned configured registries under the pinned inventory builder and policy;
- every release in the Inventory Snapshot has exactly one Catalog inclusion or exclusion outcome, and every included release appears in the Catalog Snapshot;
- every eligible release in the Catalog Snapshot has one retained manifest outcome;
- every reachable profile in every considered release appears exactly once;
- exclusions record typed reasons and every dependency appears in a cycle-valid closure;
- every predicate retains true, false, unknown, or error rather than collapsing missing data into false;
- every profile entry has exactly one Activation Decision: applicable authorized entries receive `allow`, inapplicable or excluded entries receive `deny`, and unresolved or conflicting authority receives `review_required` unless policy resolves it without erasure;
- only applicable entries with an `allow` Activation Decision over matching release, profile, scope, trusted Attestation Verification, rights decisions, verified effective advisories, and Resolution Policy activate ordinary consequences;
- conflicting entries retain separate candidate-family consequences until an explicit resolution selects one; and
- every selected component and parameter set resolves through the exact Component Registry Snapshot.

A manifest that omits an inventoried release, Catalog outcome, profile, dependency, conflict, exclusion reason, Activation Decision, or resolution decision is invalid. Validators independently rebuild the Inventory and Catalog Snapshots from their pinned registries, builders, and policies before recomputing completeness; a generator or catalog builder cannot certify its own completeness by listing only the packs it found or used.

Every Arrangement Search records the exact manifest and referenced immutable records. Unknown applicability cannot be scored as neutral. Materially different historically plausible resolutions produce separate candidate families or a focused review.

## Knowledge reassessment

When a later source or pack release appears, Vellum compares it with existing knowledge and records whether it:

- corroborates;
- narrows;
- qualifies;
- contradicts;
- supersedes;
- leaves unchanged; or
- raises a new research question.

A Knowledge Reassessment identifies affected analyses, plans, searches, scores, and evaluations without mutating them. Retraction or correction preserves prior evidence and changes current readiness honestly.

Uploading or extracting a later source creates candidates and comparison work only. It does not change production readiness, active compiler behavior, or release eligibility.

Each immutable Reassessment records its triggering candidate, release, attestation, advisory, identity correction, or rights decision; exact old and new refs; affected dependency paths; proposed, reviewed, or effective state; resolver, policy, Inventory and Catalog Snapshot identities; reviewer and evidence refs; and remediation or regeneration choices. Only a new Activation Decision over an immutable release, trusted applicable Attestation Verification, verified effective advisories, current rights decisions, and the pinned Resolution Policy changes current resolution. Old outputs retain their original as-of snapshots.

## Shared musical-intelligence contracts

Knowledge becomes useful only when it changes an inspectable musical plan and an observable generated result.

### Source understanding precedes fingering

Before target realization, the current Analysis Record and Arrangement Plan must establish, as applicable:

- Principal Voice and other Preservation Targets;
- source voice identities, continuities, entries, and cadential obligations;
- Continuo Foundation, figures, suspensions, and bass authority;
- Texture and Contrapuntal Technique by passage;
- phrase, cadence, sequence, repetition, climax, repose, and formal-return roles;
- target texture and density;
- target-portable versus target-local transformations;
- allowed octave, duration, omission, redistribution, revoicing, and generated-material operations; and
- what uncertainty would materially change those decisions.

Successful pitch placement cannot compensate for a weak or incoherent musical plan.

### Target Voice and Relationship Plans

Every polyphonic, imitative, continuo, or melody-with-accompaniment passage receives a Target Voice Plan before physical search. Every source relationship promoted to a Preservation Target also receives a Target Relationship; per-voice coverage cannot substitute for preserving a relationship among voices.

```ts
type VoiceActivitySpan = {
  musicalRange: MusicalRange;
  state: "active" | "planned_rest" | "tacet";
  rationale: string;
};

type TargetVoice = {
  id: string;
  role:
    | "principal"
    | "bass"
    | "countervoice"
    | "inner_fill"
    | "continuo_foundation"
    | "generated_realization";
  sourceVoiceRefs: DigestedRef[];
  priority: "invariant" | "structural" | "supporting" | "optional";
  activitySpans: VoiceActivitySpan[];
  continuity: "continuous" | "phrase_bound" | "cadential" | "intermittent";
  allowedTransformations: TransformationKind[];
  cadenceObligations: MusicalObligation[];
  rangeIntent?: PitchRange;
  rhythmicIndependence: "preserve" | "simplify" | "may_merge";
};

type TargetRelationship = {
  id: string;
  kind: RegisteredMusicalRelationshipKind;
  sourceRelationshipRefs: DigestedRef[];
  participantVoiceIds: string[];
  orderedEventGroups: StableEventRef[][];
  protectedFeatures: RelationshipFeature[];
  activityScope: MusicalRange;
  priority: "invariant" | "structural" | "supporting" | "optional";
  allowedTransformations: TransformationKind[];
  validationProfileRef: DigestedRef;
  evaluatorRequirementRefs: DigestedRef[];
};

type TargetRelationshipPlan = {
  id: string;
  passageId: string;
  relationships: TargetRelationship[];
  resolutionPolicyRef: DigestedRef;
  conflictRefs: DigestedRef[];
  digest: string;
};

type TargetVoicePlan = {
  id: string;
  passageId: string;
  texture: Texture;
  voices: TargetVoice[];
  relationshipPlanRef: DigestedRef;
  crossingPolicy: CrossingPolicy;
  omissionPriority: VoiceRole[];
  prominenceObligations: ProminenceObligation[];
  evaluationRequirements: DigestedRef[];
  digest: string;
};
```

Registered relationship kinds initially cover ordered imitative entry, subject interval-rhythm shape, answer relationship, suspension preparation and resolution, cadential relation, bass motion, voice exchange, figure-to-bass constraint, and generated-realization voice leading. A Validation Profile determines whether an interval, doubling, crossing, dissonance, or parallel motion is required, preferred, allowed, or prohibited; no generic counterpoint rule becomes universal merely by entering this schema.

`continuous` means coherent identity and fulfilled obligations throughout declared active spans. It does not forbid composed rests and cannot be tested by event count or non-silence alone. Splits, merges, exchanges, and generated continuations are explicit relationships and source mappings.

Under Faithful Reduction, the Principal Voice's exact pitch mapping under the selected Transposition Plan, rhythm, order, phrase relationships, and required prominence are hard constraints. Uniform transposition and permitted octave relocation remain governed transformations; raw source absolute pitch is not frozen when the policy permits a mapped pitch.

Relationship evaluators recompute protected timing, order, interval-rhythm shape, preparation and resolution, cadence placement, and voice identity from generated output. Generator declarations and event coverage cannot self-certify preservation.

### Continuo Realization and Disposition Plan

A passage containing a Continuo Foundation receives a Continuo Realization Plan before target search. It records every authoritative bass event, figure and accidental, continuation, inferred or unfigured-bass claim with authority and uncertainty, harmonic rhythm, suspension obligation, selected Realization and Validation Profiles, generated-voice range and density, and doubling and spacing policy.

```ts
type ContinuoDisposition =
  | {
      kind: "complete_on_target";
      soundedFoundationEventRefs: StableEventRef[];
      targetInstrumentInstanceRef: DigestedRef;
    }
  | {
      kind: "complete_with_separate_bass";
      soundedFoundationEventRefs: StableEventRef[];
      bassInstrumentInstanceRef: DigestedRef;
    }
  | {
      kind: "continuo_reduction";
      soundedFoundationEventRefs: StableEventRef[];
      unsoundedFoundationEventRefs: StableEventRef[];
      policyExceptionRef?: DigestedRef;
    };

type ContinuoRealizationPlan = {
  passageId: string;
  foundationEventRefs: StableEventRef[];
  figureEventRefs: StableEventRef[];
  relationshipRefs: DigestedRef[];
  realizationProfileRef: DigestedRef;
  validationProfileRef: DigestedRef;
  disposition: ContinuoDisposition;
  generatedVoiceIds: string[];
  spacingAndDoublingPolicyRef: DigestedRef;
  uncertaintyRefs: DigestedRef[];
};
```

A chord symbol, alfabeto shape, re-entrant course, pitch-class implication, or upper-octave doubling never counts as sounding an authoritative foundation bass. An incapable target includes a separate bass or produces a labeled Continuo Reduction. Engraving, playback, lineage, and evaluation retain the same disposition and never synthesize an absent bass while labeling the result complete.

### Intended Technique Plan

Each passage receives an Intended Technique Plan where technique matters.

It identifies:

- technique family and source-scoped profile;
- phrase and event scope;
- transitions into and out of the technique;
- required right- and left-hand resources;
- held, released, damped, and resonating state;
- notation and playback consequences;
- acceptable alternatives;
- applicable historical or editorial evidence; and
- unknown or unevaluated execution dimensions.

Technique selection is a musical choice before it is a fingering choice. A baroque-guitar phrase cannot become mixed style merely because some simultaneous notes happen to fit an alfabeto shape.

### Ergonomic context

Instrument mechanics, general ergonomic models, Intended Performer Profile, and Owner Ergonomic Profile remain separate inputs.

An ergonomic observation records:

- exact Instrument Instance;
- scale length and relevant setup;
- performer or population scope;
- hand and technique context;
- tempo, preparation, and reliability goal;
- passage and transition;
- measured or reported outcome;
- confidence; and
- whether it is a hard personal limit, calibrated estimate, or descriptive observation.

A five-fret span is not a universal unit of difficulty: physical distance varies by scale length and fret location. Likewise, a geometrically reachable chord is not automatically repeatable or performance-reliable at tempo.

### Phrase-level candidate state

Target compilers search phrases rather than greedily selecting each event.

Complete partial state includes, where applicable:

- current and prepared left-hand position;
- finger assignments, shared fingers, barré, releases, and guide fingers;
- right-hand resources, preparation, stroke, and bass access;
- held and resonating notes;
- required damping;
- active target voices and remaining durations;
- harmonic and cadential obligations;
- technique state and legal transitions;
- incoming state from the previous phrase;
- outgoing obligations for the next phrase; and
- active Commitments, Preservation Targets, and policy exceptions.

Visible passage regeneration expands to a musically and physically sufficient context. It may not optimize a selected box while ignoring sustained notes or impossible boundary transitions.

Phrase search remains subordinate to the work- and section-level Arrangement Plan. Repeated themes, planned variation, formal returns, global bass trajectory, technique arc, and cross-section commitments participate in phrase-state dominance and a section- or work-level composition search with backtracking. Post-search checking remains an independent validator, not the only mechanism enforcing global coherence; a locally preferred phrase candidate may not prune the only globally valid solution.

### Candidate output

An Arrangement Candidate includes:

- canonical notes, rhythms, voices, and event identities;
- target positions and exact Instrument Instance;
- constitutive technique events;
- hidden fingering or execution evidence when not engraved;
- Applied Knowledge Manifest and compiled constraints;
- Transformation Report and Preservation Audit;
- generator-visible Search Measurements and exact Selection Policy identity;
- retained non-dominated alternatives plus bounded representative rejection reasons and binding constraints;
- incoming and outgoing state;
- unknown and not-evaluated dimensions; and
- reproducible search identity.

### Search selection and independent evaluation

Search selection and independent evaluation are different stages. Search Measurements are generator-visible facts or estimates used by a versioned Selection Policy; they are search objectives, not independent certification.

Selection rejects hard-constraint violations, compares survivors lexicographically by Preservation Target and Target Voice Plan priority, applies versioned target- and policy-specific preferences, and retains materially different non-dominated candidates when consequential tradeoffs remain. A hidden weighted total may not replace this policy.

The candidate and search ordering are immutable before independent evaluation. Evaluation creates a separate Evaluation Card keyed to the candidate digest and cannot rewrite the Selection Decision. A separate immutable Adoption Decision determines whether a preordered candidate may become the default Arrangement Score. An independent required hard-gate failure blocks adoption and readiness; Vellum evaluates the next candidate in the already committed search order or starts a new search if none survives. Held-out evaluator results qualify or reject a sealed Generation System capability and never select or adopt candidates in the run they judge. A reviewed finding can influence a later compiler, profile, or Selection Policy only through the reviewed-learning boundary.

Every search identity records algorithm and component versions, deterministic seed and tie-breaking, budget, checkpoint, and terminal state. Terminal outcomes distinguish `found`, `unsat_proven`, `budget_exhausted`, `cancelled`, and `infrastructure_failed`. Exhaustion is never presented as proof that no playable realization exists.

## Five-course baroque-guitar compiler

### Orthogonal technique facets

Baroque-guitar technique is represented by compatible facets, not one flat mutually exclusive mode enum:

- attack family and texture: individually plucked attacks, strummed attacks, or an explicit passage containing both;
- chord vocabulary: optional alfabeto chart, symbol, and shape identity;
- course-allocation and resonance strategy: ordinary allocation, campanella, held harmony, and required damping;
- rhythmic gesture vocabulary: single stroke, batterie or battuto pattern, repicco, arpeggiation, and source-scoped variants;
- left-hand state: shape, barré, retained fingers, releases, and preparation; and
- notation, playback, and constitutive-versus-interpretive status.

`mixed style` is the user-facing description of a phrase plan that composes or transitions among plucked and strummed attacks. Alfabeto is a chord vocabulary that may participate in rasgueado; it is not a competing attack mode. Campanella is a course-allocation and sustain strategy that may coexist with punteado. Batterie and repicco are gesture sequences. Applicability and naming remain source- and profile-scoped.

Every selected combination has explicit candidate generation, physical state, notation, playback, and evaluation consequences. Unsupported combinations are conflicts, not silently normalized labels.

### Exact target configuration

The compiler consumes:

- single and doubled course construction;
- unison or octave pairing;
- re-entrant or bourdon stringing;
- tuning and pitch reference;
- exact scale length, fret positions, course spacing, neck width, action and setup, and two-dimensional course-and-fret contact geometry required by the selected evaluator;
- available alfabeto chart releases;
- notation convention; and
- performer and technique context.

No generic five-line fretboard may silently stand in for these facts.

### Punteado

Punteado search tracks individual right-hand allocation, preparation, alternation, repeated-course behavior, simultaneity, held notes, and left-hand transitions.

Right-hand digit resources are source- and profile-scoped. Vellum must not encode a universal three-finger rule: Sanz explicitly permits a fourth right-hand finger in some four-voice contexts. A profile may prefer or limit particular digits for a school, source, texture, or performer, but the scope and evidence remain inspectable.

Large simultaneities cannot be labeled idiomatic punteado merely because the left hand can form them. The compiler either finds a supported plucked allocation, selects a historically and musically valid strummed event, reduces the texture under policy, or reports the conflict.

### Rasgueado and alfabeto

A constitutive strummed or multi-attack event resolves to a Gesture Sequence.

```ts
type PluckedAttack = {
  kind: "pluck";
  onsetOffset: Rational;
  allocations: Array<{
    course: number;
    resolvedConstituentStringIds: string[];
    digit: RightHandDigit;
    exceptionalSelectiveAttackRef?: DigestedRef;
  }>;
};

type StrummedAttack = {
  kind: "strum";
  onsetOffset: Rational;
  direction: StrokeDirection;
  digitOrGesture: RightHandGesture;
  traversedCourses: number[];
  soundedCourses: number[];
  mutedCourses: number[];
  resolvedCourseAttacks: Array<{ course: number; onsetOffset: Rational }>;
};

type DampingGesture = {
  kind: "damp";
  onsetOffset: Rational;
  courseOrStringIds: string[];
};

type GestureSequence = {
  metricalAnchor: MusicalTime;
  duration: Rational;
  gestures: Array<PluckedAttack | StrummedAttack | DampingGesture>;
  preparationStateRef: DigestedRef;
  resultingStateRef: DigestedRef;
};
```

The sequence records beat and subdivision, attack order, exact right-hand allocation, stroke path, sounded, omitted, and muted courses, constituent-string sounding pitches, held state, releases, and damping. A normal course attack derives its complete constituent-string set from the exact Instrument Instance; search cannot selectively pluck one member of a doubled course. Selective constituent attack is legal only through an explicit exceptional-technique ref with applicable evidence, notation, playback, and evaluation semantics. Stroke traversal and simultaneous chord notation do not erase temporal attack order. A batterie or repicco pattern contains its ordered gestures rather than one generic stroke field.

An alfabeto binding separately retains harmonic intent, exact source chart and pack release, symbol and shape identity, tuning and stringing compatibility, left-hand shape and barré, and notation ambiguity. Harmonic-bass or inversion intent remains distinct from the actual lowest sounding constituent string and from Continuo Disposition.

Stroke path and sounding courses are different. Vellum must not assume either that every stroke sounds all five courses or that only edge courses may be omitted. Corbetta and other sources require context-specific course suppression and sometimes ambiguous notation. A selected profile determines which masks are supported, preferred, uncertain, or prohibited.

Computed voicings do not silently replace a known applicable alfabeto vocabulary. Conversely, alfabeto shape lookup does not prove that a chord is appropriate at that point in the musical plan.

### Mixed style

Mixed style is planned across a phrase:

- chordal and linear functions are identified;
- held chord shapes and released notes remain explicit;
- punteado-to-rasgueado transitions are physically evaluated;
- the Principal Voice stays recognizable and perceptually prominent;
- course suppression and re-entrant bass consequences are disclosed; and
- notation and Audio Preview express the selected event kinds rather than flattening them into simultaneous MIDI notes.

### Baroque-guitar acceptance

For the Greensleeves regression:

- every protected Principal Voice event remains correct and perceptually prominent;
- the compiler declares punteado, rasgueado, or mixed style by passage;
- every simultaneity has a supported right-hand or stroke realization;
- alfabeto shapes cite the exact chart release;
- transitions are evaluated across phrase boundaries;
- the observed extreme reach/jump cannot receive an unqualified playable result;
- strum masks and held harmony survive engraving and playback; and
- materially different valid technique plans remain comparable in the workbench.

## Thirteen-course baroque-lute compiler

### Exact target configuration

The compiler consumes:

- all constituent strings and course construction;
- six stopped-course tuning and stringing;
- seven unstopped diapasons and current Bass Tuning;
- exact scale length, two-dimensional course and fret geometry, neck width, and setup;
- notation identity per course;
- right-hand bass access assumptions;
- performer and reliability context; and
- applicable historical, modern-pedagogical, and software profiles.

The current editor default may be a thirteen-course D-minor-tuning configuration. It must not be described as the universal historical default.

### Joint left-hand search

Search tracks:

- physical span in millimeters as well as fret interval;
- assigned left-hand fingers;
- position and hand frame;
- shared or retained fingers;
- barré;
- preparation and release;
- longitudinal shifts;
- simultaneous and successive stretches;
- exact finger-pair contact geometry and transition trajectory;
- stopped-course stringing effects;
- incoming and outgoing phrase state; and
- tempo, preparation, and reliability goal.

The Owner's approximately 690 mm Instrument Instance is a first-class regression context. The Greensleeves f/b combination spanning frets 1 through 5 must fail the applicable personal or calibrated ergonomic gate when a closer valid realization exists.

### Diapasons, resonance, and right hand

Open diapason changes are not left-hand shifts. They require independent modeling of:

- digit allocation and preparation;
- simultaneous stopped-course attacks;
- alternation, repetition, and course crossing;
- thumb behavior and hand position under the applicable profile;
- right-hand preparation and reach;
- bass-course succession;
- stopped-course-to-diapason and diapason-to-stopped-course transitions;
- resonance and overlap;
- required damping;
- voice and harmonic function;
- retuning;
- notational course identity; and
- sounding pitch.

Style brisé, resonance, bass deployment, and contrapuntal distribution apply only under matching profiles. They are not generic rewards for open strings.

### French tablature and unresolved notation

Course identity is independent of pitch. Under currently cited twelve-course evidence from Mace, courses 7 through 12 use:

1. a
2. /a
3. //a
4. ///a
5. 4
6. 5

No slash is prepended to 4 or 5. The thirteenth-course sign is not established by that source. A value such as 6 may be used only as an explicitly named modern editorial or software convention until a directly applicable source supports it. The notation mapping belongs to the exact Notation Configuration or applicable pack profile; unknown remains unknown and is never inferred from sequence alone.

Golden engraving tests separately verify semantic course, rendered sign, below-staff placement, sounding pitch, and playback identity.

### Thirteen-course evidence and readiness

Thirteen-course readiness is dimension-specific:

- `mechanically_modeled` means that the represented thirteen-course configuration and declared deterministic mechanics are complete for the selected evaluator scope; unmeasured resonance, damping, hand access, reliability, and human behavior remain unknown until separately evaluated;
- `editorially_notated` means that every course renders and plays back under an explicitly named modern editorial or software convention whose profile does not claim historical authenticity for unresolved signs; and
- `historically_scoped` applies only to notation, stringing, bass practice, or technique dimensions supported by directly applicable released evidence.

A mechanically modeled course 13 may use `6` under an identified editorial profile; historical authenticity is then `not_claimed`, not silently passed or left as a required unknown. An output that claims historically scoped course-13 notation must instead resolve the historical dimension and remains provisional while it is unknown. Eleven- or twelve-course evidence may support claims that genuinely carry over, but it cannot establish course-13 notation, geometry, or bass access by numerical extrapolation. A repertoire source that omits its lowest available course does not establish the instrument's course count.

Historically scoped readiness for a course-13-specific claim requires resolved source identity, an exact Source Segment Version, reviewed interpretation, applicable profile, released pack, and required attestation. Until then, a historically scoped output keeps that dimension unknown, while an editorial-profile deliverable discloses the convention and records historical authenticity as `not_claimed`.

### Baroque-lute acceptance

For the Greensleeves regression:

- the bundle identifies French-tablature letters `f` and `b`, their courses and event IDs, onset and duration, incoming and outgoing state, Instrument Instance, tempo, and reliability goal;
- the known reach is rejected and the bundle's independently reviewed closer equivalent is generated; `budget_exhausted` or an unverified claim that none exists does not pass;
- left-hand and right-hand costs are not conflated;
- diapason use preserves voice and harmonic intent;
- resonance and damping obligations are explicit;
- the Principal Voice remains recognizable;
- tablature and playback agree on course identity and pitch; and
- the thirteenth sign is disclosed as sourced, editorial, or unresolved.

## Six-string classical-guitar compiler

### Exact target and performer configuration

The compiler consumes:

- six exact constituent strings, tuning, scordatura, capo state, and pitch reference;
- scale length, fret positions, nut and bridge string spacing, neck profile, action, and setup facts required by the selected evaluator;
- left- or right-handed configuration and exact two-dimensional string-and-fret contact geometry;
- Intended Performer Profile, selected Owner Ergonomic Profile, tempo, preparation, and reliability goal;
- notation configuration, including the Classical Guitar Staff written-to-sounding octave; and
- applicable historical, pedagogical, editorial, software, and personal profiles.

No generic six-line fretboard or `EADGBE` label may silently stand in for the exact Target Configuration.

### Joint left- and right-hand realization

Right-hand state includes p-i-m-a allocation where applicable, preparation, simultaneous attacks, alternation, repeated-finger and repeated-string behavior, crossing, thumb/finger independence, arpeggio order, constitutive stroke, articulation, damping, and the state prepared for the next attack. These choices are profile- and performer-scoped rather than one universal pedagogical system.

Left-hand state includes exact fingers, position and hand frame, barré, guide and retained fingers, release, sustain, slur mechanics, shifts, and two-dimensional geometry of simultaneous and successive contacts. Mechanical impossibility is a hard failure; ergonomic reliability and idiomatic preference retain separate evidence.

Right- and left-hand plans remain linked evidence when standard notation omits fingering. A candidate cannot earn an idiomatic or performance-reliable result merely because every pitch has an isolated fretboard position.

### Target Voice Plan is mandatory

For music containing a Principal Voice and meaningful subordinate line, the default plan contains:

- a Principal Voice with explicit active spans and composed rests;
- a coherent Bass or Countervoice with its own activity, cadence, harmonic-function, duration, and relationship obligations;
- optional Inner Fill whose omission priority is lower than either structural voice; and
- explicit inversion, rhythmic, voice-exchange, crossing, and voice-duration obligations.

A sparse or intermittent bass may be valid only when its Voice and Relationship Plans explain its active spans and structural work. Neither continuous sound nor event count proves coherence. Isolated bass events cannot be presented as a successful two-voice arrangement merely because a minimum count was met.

### Joint polyphonic search

Search tracks all planned voices together:

- onset, duration, release, and tie identity;
- voice continuity and crossing;
- bass motion, inversion, cadence, and harmonic function;
- dissonance preparation and resolution;
- sustain and open-string resonance;
- left-hand position, fingers, shifts, guide fingers, and barré;
- right-hand allocation and repeated-string constraints;
- phrase boundary state; and
- policy-authorized omission or redistribution.

Event-local pitch placement cannot erase a voice in order to improve average fret or open-string scores.

### Notation and playback

Classical-guitar standard notation is a first-class Notation Layout, not tablature with labels removed. Canonical voice identities drive spelling, stems, rests, ties, duration, and layout. Hidden fingering plans remain linked evidence even when the printed score omits fingerings.

Audio Preview can isolate every planned target voice. A voice that vanishes during a declared active span or fails its continuity obligations is a hard failure; a planned rest is not.

Isolation verifies lineage and audibility, not perceptual prominence. A deterministic prominence gate checks explicit registral, onset, duration, role, and masking obligations; any remaining perceptual claim requires the declared listening-review authority.

### Classical-guitar acceptance

For the Greensleeves regression:

- the Principal Voice remains note- and rhythm-correct;
- the Bass or Countervoice satisfies its declared continuity and cadence plan;
- the source's substantial bass cannot collapse to four isolated events without an explicit Plan Conflict or policy-authorized disclosure;
- all simultaneous notes and durations are mechanically realizable;
- every attack has compatible left- and right-hand preparation and transition state under the exact target and performer context;
- declared voice activity spans distinguish composed rests from dropped events;
- bass success is evaluated from source mapping, harmonic and cadential obligations, durations, and relationships rather than event count;
- notation displays the intended polyphony clearly;
- isolated playback confirms each voice; and
- alternate reductions expose genuine musical tradeoffs rather than cosmetic fingerings.

## Evaluation and grading

Evaluation answers three separate questions:

1. Did output violate an authoritative invariant?
2. Did observable or reviewed quality improve, regress, or remain uncertain?
3. Is a difference caused by product code, source or pack input, compiler semantics, evaluator semantics, or intentional design?

There is no single overall grade. Hard failures cannot be averaged away, and subjective quality cannot be manufactured from deterministic proxy totals.

### Evaluation layers

The instrument-intelligence program adds the following layers to the existing harness:

1. provenance, identity, rights, and private-export contract tests;
2. Page Atlas and modality-routing fixtures;
3. extraction and cited-segment fixtures;
4. Knowledge Candidate, conflict graph, review, release, and retraction tests;
5. Applied Knowledge Manifest and applicability tests;
6. compiler property, differential, replay, and mutation tests;
7. output-level musical, mechanical, ergonomic, idiom, notation, and playback evaluation;
8. cross-target source-to-deliverable end-to-end cases; and
9. late role-scoped human and physical review.

Component cases may pin reviewed downstream inputs to isolate a stage. End-to-end cases begin with source assets, Arrangement Briefs, and Performance Briefs. Evaluator-only expectations, forbidden outcomes, reference answers, baseline outputs, and held-out labels are unavailable to generation, planning, search, prompts, and profile fitting.

### Independent observable dimensions

Evaluation Cards retain separate dimensions for:

- source authority and unresolved uncertainty;
- Applied Knowledge Manifest completeness;
- Principal Voice and other Preservation Targets;
- Target Voice Plan realization;
- bass, Continuo Foundation, and cadence behavior;
- target mechanics;
- ergonomic estimate and exact personal evidence;
- intended-technique realization;
- historical or editorial evidence;
- notation semantics and legibility;
- literal playback and Performed Form;
- workflow recovery and lineage;
- human or physical evidence; and
- explicit Owner usefulness.

Each dimension records applicability, execution status, completeness, authority, evidence basis, permitted presentation, units, uncertainty, and observations. Unknown is never encoded as zero, neutral, or pass.

Every acceptance sentence has a versioned Requirement Ledger entry naming observable inputs, hard-gate or rubric status, evaluator identity and implementation boundary, outcome vocabulary, units or threshold where meaningful, uncertainty behavior, mutation, contamination role, and authorized human role. Adjectives such as coherent, prominent, supported, idiomatic, equivalent, meaningful, or clear are not executable until such an entry exists.

### Generator and evaluator separation

The same pack may explain why an evaluator applies and provide cited rubric anchors. It may not certify its own output. Evaluators inspect the generated canonical notes, rhythms, voices, positions, technique events, engraving, and playback.

Compiler assertions such as preserved principal voice, idiomatic, playable, historical profile, or coherent bass are hypotheses until the appropriate independent evaluator checks observable output.

Independence includes implementation boundaries. A compiler and evaluator may share immutable normative evidence, but they may not both trust the compiler's success flag or the same unverified derived decision function. Critical invariants use recomputation from canonical output, differential or fixture oracles, mutations, and role-scoped review to expose common-mode errors.

### Enforced evaluation isolation

Isolation is an information-flow boundary, not a naming convention. The evaluation orchestrator may resolve the complete manifest, but generation receives only a serialized Generation Input Envelope containing source input, Briefs, activated pack releases, generation component identities, Instrument Instance, and search budget, seed, and tie-breaking policy.

Expectations, forbidden outcomes, reference answers, baselines, mutations, held-out labels, and human preferences live in an evaluator-only store that generation, planning, prompts, pack resolution, search, and Selection Policy fitting cannot read. The orchestrator persists immutable generated output before loading evaluator-only data.

A Generation System identity pins the transitive closure of source-analysis, planning, prompts, activated packs and examples, compiler and search code, model and provider configuration, fitted parameters, Selection Policy, runtime, and every upstream component capable of revealing or fitting the expected answer. A case is held out only relative to that entire consumer closure, never merely one named compiler.

Contract tests place canaries in serialized case data, environment variables, prompts, filesystem paths, manifests, and evaluator stores and prove that none reaches generation. Passing a complete Evaluation Case or resolved evaluator manifest into the generation process violates this boundary.

### Hard-gate and acceptance status

Every hard-gate definition declares whether it is required for the applicable case. `hardGateStatus` is:

- `pass` only when every required applicable hard gate completed with complete evidence and passed;
- `fail` when any required applicable hard gate fails; or
- `incomplete` when any required gate is unknown, partial, or not evaluated.

The enclosing `acceptanceStatus` is `pass`, `fail`, `blocked`, or `incomplete`. A confirmed product or output violation is `fail`; unavailable source bytes, denied required access, evaluator crash, provider outage, or other infrastructure failure is `blocked`; missing or unfinished evidence while execution remains available is `incomplete`. Neither blocked nor incomplete can be presented as pass.

Unknown is never converted to pass. The UI may say `no failure observed` for incomplete evidence, but not `hard gates pass`. Arrangement Readiness cannot be ready while hard-gate status is incomplete.

### Dataset assignments and contamination groups

A dataset role belongs to the tuple of contamination-group identity, exact Generation System consumer closure or evaluator consumer, exact consumer version, and immutable split-manifest identity. It does not belong globally to a file or one nominal compiler.

```ts
type VaultSplitManifest = {
  id: string;
  generationSystemScopeRef: DigestedRef;
  eligibleContaminationGroupRefs: DigestedRef[];
  coverageAssignmentRefs: DigestedRef[];
  invalidFixturePolicyRef: DigestedRef;
  reserveSelection:
    | { kind: "ordered"; groupRefs: DigestedRef[] }
    | { kind: "seeded"; seed: string; algorithmRef: DigestedRef };
  exhaustionPolicyRef: DigestedRef;
  exposureSnapshotRefs: DigestedRef[];
  curatorIdentityRef: EntityRef;
  frozenAt: string;
  digest: string;
};

type HoldoutAttempt = {
  id: string;
  splitManifestRef: DigestedRef;
  contaminationGroupRef: DigestedRef;
  generationSystemRef: DigestedRef;
  exposureSnapshotRefs: DigestedRef[];
  evaluationCardRefs: DigestedRef[];
  acceptanceStatus: "pass" | "fail" | "blocked" | "incomplete";
  disposition: "still_held_out" | "permanent_regression" | "invalid_with_reason";
  digest: string;
};
```

The Vault Split Manifest and each Holdout Attempt live inside the Owner Evaluation Vault. Ordinary generation receives neither object; the evaluator exposes only the source envelope selected by the committed manifest.

A contamination group includes every artifact that can reveal substantially the same answer to that consumer: all editions and scans of the same Work, excerpts, crops, transcriptions, translations, analyses, arrangements, extracted examples, candidates, and claims or profiles authored from them. A conservative split may additionally group by composer, school, source family, tune family, transposition, near duplicate, or shared editorial derivation.

Roles remain:

- derivation, profile, prompt, compiler, parameter, or Selection Policy fitting and authoring;
- development and debugging;
- evaluator calibration;
- held-out evaluation; or
- post-deployment monitoring.

The same artifact may have different explicit roles for demonstrably unrelated consumers, such as OMR development and a downstream evaluator. A group held out for a Generation System is unavailable to its entire transitive source-analysis, planning, prompt, activated-pack, compiler, parameter-fitting, and Selection Policy closure and to evaluator calibration.

Moving a group creates a new split manifest and invalidates incompatible comparisons. Once a held-out expectation or result informs product, profile, Selection Policy, or evaluator changes, that group becomes permanent disclosed development-regression evidence for every affected successor version. It remains mandatory in addition to—not instead of—fresh held-out-from-development groups.

### Required mutations

The evaluation corpus must detect at least:

- Principal Voice pitch, timing, order, phrase, prominence, or cadence loss;
- a disappearing or rhythmically incoherent classical-guitar bass;
- a false two-voice declaration;
- the known lute f/b stretch;
- an invented or collapsed lute diapason sign;
- a wrong alfabeto chart or shape;
- an unscoped universal three-finger baroque-guitar rule;
- an unsupported strum mask;
- a broken punteado, rasgueado, or mixed-style transition;
- a baroque-guitar reach or transition falsely accepted by fret-only rather than two-dimensional course-and-fret geometry;
- a strummed Gesture Sequence flattened into one simultaneous MIDI chord;
- an impossible lute right-hand digit allocation, simultaneous stopped-course attack, alternation, crossing, thumb behavior, or stopped-course-to-diapason transition;
- held-note, damping, or duration corruption;
- a figured-bass figure, accidental, bass alignment, continuation, or suspension corruption;
- an imitative entry-order, subject-shape, voice-identity, timing, or cadence corruption;
- right- and left-hand cost conflation;
- an applicable pack omitted from search identity;
- an inapplicable or conflicting profile treated as active;
- a test-only profile activated in default or ready output;
- an extraction promoted without review;
- an unknown required hard gate displayed as passed;
- evaluator-only data reaching generation;
- a private source exported without authority;
- private source content sent to a provider without an applicable Access Decision;
- notation and playback disagreement; and
- an evaluator or pack attempting to self-certify.

Mutation success proves sensitivity only to the mutated class. It does not imply general musical correctness.

### Content-addressed regression contracts

Every named regression resolves to an immutable bundle rather than a tune title or anecdote. The bundle pins source and reviewed truth, Analysis, Arrangement and Performance Briefs, Preservation Policy, Applied Knowledge Manifest, Instrument Instance, notation, scoped events, required observations, forbidden outcomes, mutations, evaluators, review roles, and one digest.

Different plausible schools or profiles produce separate candidate families or bundles; a generator may not source-hop among incompatible authorities to pass. Required observations and forbidden outcomes are evaluator-only. Production code may not special-case a Work title, bundle ID, or expected fingering.

The Greensleeves bundles pin the observed baroque-guitar course/fret transition and Gesture Sequences; the lute `f` and `b` letters, course identities, physical context, and reviewed closer realization; and every classical-guitar structural-voice mapping, active span, rest, cadence, function, and duration obligation. Adding incoherent filler, reporting search exhaustion, or finding another cosmetic fingering cannot pass.

### Development regressions and held-out acceptance

Greensleeves is permanently development and regression evidence for all three target compilers. It exercises shared plumbing and the three known failures; it is never held-out evidence and cannot establish generalization.

Visible repository fixtures remain contract and development evidence. Assets held out from Vellum development, prompt authoring, fitting, and evaluator calibration, together with reviewed truth, evaluator-only expectations, and split manifests, live outside Git and outside the ordinary workspace/content-store read capability in the Owner Evaluation Vault. Repository code may retain opaque case IDs, content digests, and coverage requirements, but not the hidden answers. A narrow evaluation orchestrator releases the source input—not its labels—to the sealed generation process only when a held-out run begins; the generation process has no filesystem, database, environment, or API capability that can enumerate the Vault or its reserves.

This is a product-development isolation claim, not a claim that a Work was absent from a pretrained model's corpus. Every run records provider, model, account or project, session, retention and training policy when knowable, prior-call exposure, prompt digest, and whether execution was provider-free. Held-out generation uses either a deterministic provider-free path or a stateless isolated provider context with no cross-run memory or retrieval over prior sessions. Provider and conversation exposure enter the contamination history and may make a comparison ineligible.

Initial release acceptance contains at least two independent, non-Greensleeves contamination groups per target:

- baroque guitar covers supported punteado allocation and a supported rasgueado or mixed-style transition, including exact two-dimensional course-and-fret reach, Gesture Sequences, stroke masks, course masks, and alfabeto applicability;
- baroque lute covers stopped-course polyphony plus explicit digit allocation, simultaneous attacks, alternation, course crossing, thumb behavior, stopped-course-to-diapason transitions, diapason succession, resonance, damping, and exact French tablature;
- classical guitar covers coherent two-voice writing plus independent three-voice or contrapuntal writing.

Dedicated non-Greensleeves shared-contract groups cover a soprano-plus-figured-bass source with an accidental and prepared suspension, and a three-voice imitative source whose identity depends on ordered entries. At least one held-out case per target begins with a legally usable PDF or image and exercises ingestion through deliverables; compiler-isolation cases may begin from independently reviewed canonical transcription.

Holdout selection is a blinded curation task. Sources must be legally usable, absent from derivation, development, fitting, evaluator calibration, prompt examples, and pack examples, and grouped with all near duplicates and derivatives. The source pool deliberately varies key, meter, Texture, technique, stringing or tuning, density, and performance context and includes contrastive cases in which an attractive idiom is inapplicable.

The tracked specification intentionally names coverage classes rather than the exact held-out Works. Publishing their identities, reviewed truth, or expected repairs in the normal repository would make them development targets. Before any system output is observed, an independent curator commits inside the Vault the eligible pool, contamination closures, invalid-fixture policy, reserve order or deterministic selection seed, coverage assignment, and exhaustion rule. The split-manifest digest is frozen before the relevant Generation System versions are run; invalidation requires a documented source-independent reason and preserves the attempted case history.

Generation System, profile, Selection Policy, and evaluator versions are sealed before execution. Every valid failed group remains disclosed in the result history and becomes a mandatory permanent development regression. A repaired successor must pass all accumulated valid failures plus the next precommitted reserve groups; it cannot consume reserves until two convenient groups happen to pass. Those reserves are described as fresh and held out from Vellum development, not guaranteed unseen by a pretrained model.

## Feedback, state, and accumulated learning

Vellum is stateful because useful musical learning requires durable evidence and review, not because chat history should become authority.

Every comment, edit, or comparison is classified as one of:

- Score Transcription correction;
- Analysis Claim correction;
- Arrangement Plan revision;
- Arrangement Score edit;
- Performance Interpretation;
- Editorial or Family Commitment;
- Policy Exception;
- Owner ergonomic observation;
- Personal Default Candidate;
- Knowledge Candidate;
- Calibration Candidate;
- Golden Fixture candidate; or
- research question.

The model may propose a classification, but it cannot silently commit a reusable change.

Repeated outcomes may nominate a candidate. They do not activate one. A physical playtest remains scoped to the exact performer, Instrument Instance, passage, tempo, preparation, and reliability goal. A later primary source does not automatically override a modern method, an Owner preference, or another historical school; it creates a reviewed comparison with explicit authority.

## Owner experience

### Guided Start

The default launcher asks only for:

- source document or documents;
- target instruments and Notation Layouts;
- desired Deliverables; and
- an optional instruction.

For each target, Guided Start selects an explicit saved Instrument Instance and versioned default Performance Brief when available and shows them as concise editable defaults. If exact geometry, performer context, tempo, or reliability goal is missing, generation may proceed provisionally but cannot claim physical readiness. Progressive disclosure exposes complete configuration without turning the launcher into a questionnaire.

The launcher distinguishes arrangement evidence from reusable reference evidence. When appropriate, the Owner may choose:

- arrange this;
- add this to the Owner Reference Library; or
- do both.

There is no IMSLP-specific product coupling. PDF and image upload are first-class; stable library URLs and IIIF objects are acquisition conveniences.

OCR or OMR confidence controls appear only when optical recognition is used. Score-Anchored Review provides sufficient musical and page context, zoom, an overlay that does not obscure the glyph, batch threshold provenance, inline correction, and exact resume without looping over resolved uncertainty.

### Default arrangement view

The default view shows:

- inferred source structure and protected identity;
- proportional Arrangement Plan;
- target texture and intended technique;
- major compromises, conflicts, and unknowns;
- selected notation;
- literal Audio Preview;
- readiness by dimension; and
- meaningful alternatives.

It does not expose solver metadata as a questionnaire.

### Expert disclosure

Expert views expose:

- applied pack releases and digests;
- exact citations and source crops;
- conflicting claims and alternative profiles;
- extraction artifacts and confidence dimensions;
- compiled constraints and evaluator identities;
- rejected candidates and binding constraints;
- target voices and technique layers;
- notation and playback lineage;
- pack history, retractions, and reassessments; and
- all unevaluated dimensions.

Expert mode changes presentation, not canonical semantics.

### Knowledge workbench

The Knowledge Workbench supports:

- streamed local upload and stable-URL acquisition;
- deduplication and source-identity resolution;
- rights and access assertions;
- resumable Page Atlas generation;
- page thumbnails and modality regions;
- side-by-side source crop, transcription, normalization, and translation;
- zoom and accessible navigation;
- citation-range editing;
- candidate classification and conflict linking;
- pack-profile drafting and diff;
- test-only release generation;
- role-scoped review packages;
- pack release and retraction;
- research-question queue;
- affected-arrangement reassessment; and
- private export controls.

Failure at any stage resumes from the exact incomplete step without losing reviewed work.

## Seed source program

Raw binaries remain content-addressed in the Owner Reference Library and outside Git unless their rights and fixture purpose explicitly permit inclusion.

### Five-course baroque guitar

Initial sources, in research order:

1. Gaspar Sanz, [Instrucción de música sobre la guitarra española](https://hdl.handle.net/10481/86789), complete 1697 issue: rasgueado, punteado, alfabeto, campanella, accompaniment, counterpoint, and contextual fourth-finger evidence.
2. Francesco Corbetta, [La Guitarre royalle](https://gallica.bnf.fr/ark:/12148/bpt6k1505774n), 1671: mature mixed style, batteries, held harmony, course suppression, vocal accompaniment, and continuo.
3. Giovanni Paolo Foscarini, [I quattro libri della chitarra spagnola](https://music.library.appstate.edu/guitar/foscarini-c1632), circa 1632–1635: transition from alfabeto and strummed practice into mixed tablature.
4. Angelo Michele Bartolotti, [Libro primo di chitarra spagnola](https://music.library.appstate.edu/guitar/bartolotti-1640), 1640: explicit stroke annotation and systematic harmonic material.
5. Santiago de Murcia, [Resumen de acompañar la parte con la guitarra](https://datos.bne.es/resource/XX2242096), 1714/1717: continuo, Figured Bass, cadences, scales, meter, and accompaniment.

Different editions, compilations, exemplars, and provider scans remain separate identities.

### Thirteen-course baroque lute

Initial sources, in research order:

1. Ernst Gottlieb Baron, [Untersuchung des Instruments der Lauten](https://www.digitale-sammlungen.de/de/details/bsb10598228), 1727: normative technique, posture, fingering, transitions, ornaments, and cantabile practice, explicitly scoped to his eleven-course context where applicable.
2. Thomas Mace, [Musick's Monument](https://archive.org/details/musicksmonumento0000mace), 1676: economical motion, right-hand use, and exact twelve-course diapason notation.
3. Perrine, [Livre de Musique pour le Lut](https://gallica.bnf.fr/ark:/12148/btv1b100756018), 1679/1680: staff-to-lute mapping, style brisé, movement, voice leading, and continuo.
4. Silvius Leopold Weiss, [Dresden manuscripts](https://digital.slub-dresden.de/id508190533): descriptive repertoire evidence for voice leading, texture, bass deployment, resonance, and damping.
5. Verified thirteen-course repertoire or treatise evidence for notation, geometry, and bass practice. Falckenhagen remains quarantined until exemplar and publication identity are resolved.

Modern Serdoura, Satoh, and other Owner-supplied books are valuable modern pedagogy, not primary-source historical authority. Their assets remain private unless redistribution is licensed.

### Six-string classical guitar

Initial sources, in research order:

1. Fernando Sor, [Méthode pour la guitare](https://imslp.org/wiki/M%C3%A9thode_compl%C3%A8te_pour_la_guitare_%28Sor%2C_Fernando%29), 1830 French text plus its separately identified plates: voice preservation, harmony-aware fingering, bass continuity, accompaniment, and reduction.
2. Ferdinando Carulli, [L'Harmonie appliquée à la Guitare](https://img.kb.dk/ma/umus/carulli_harmonie.pdf), 1825: aligned source textures and guitar reductions.
3. Dionisio Aguado, [Nuevo método para guitarra](https://imslp.org/wiki/Nuevo_m%C3%A9todo_para_guitarra_%28Aguado%2C_Dionisio%29), 1843: multi-part execution, right-hand allocation, intervals, barré, harmony, and expression.
4. Ferdinando Carulli, [Méthode pour apprendre à accompagner le chant](https://gallica.bnf.fr/ark:/12148/btv1b100704061), Op. 61: melody-plus-accompaniment corpus.
5. Matteo Carcassi, [Method, Op. 59](https://archive.org/details/newimprovedmeth00carc): graded fingering and multi-voice repertoire.

The 1896 Harrison rewrite of Sor is comparison and edition-history evidence, not a substitute for the 1830 authority.

### Shared Italian keyboard continuo

The canonical seed is Francesco Gasparini, [L'armonico pratico al cimbalo](https://www.loc.gov/item/05004057/) (Venice, 1708), Library of Congress Music Division, LCCN 05004057. Its keyboard dispositions, doublings, economical motion, figured dissonance preparation and resolution, accompaniment density, cadences, and ornamented realizations can support a scoped `continuo.italian-baroque` development profile after cited extraction and review. The 1764 manifestation may assist OCR and comparison but does not replace the 1708 manifestation identity. Gasparini is derivation and development evidence and is excluded, with its contamination group, from held-out Continuo acceptance.

### First extraction fixtures

1. Mace: preserve the exact ordered sequence a, /a, //a, ///a, 4, 5 and refuse to infer a thirteenth symbol.
2. Sanz: extract rules and examples that prevent an unscoped universal three-finger rule.
3. Corbetta: represent stroke path, sounding courses, suppression, held harmony, and notation ambiguity independently.
4. Carulli: align a source texture with its guitar reduction and propose retain, omit, octave, rhythm, and accompaniment transformations.
5. Weiss: retain image geometry while extracting descriptive tablature and bass observations only.
6. Sor: link text assertions to separate plates and distinguish the 1830 edition from the Harrison rewrite.
7. Gasparini: retain Chapters II, IV, and VII–X as separately citable segments and extract keyboard disposition, doubling, motion, density, and figured-dissonance candidates without treating noisy OCR as reviewed truth.

One source per target proves plumbing, not idiomatic authority.

## Execution sequence

Implementation proceeds through production-path tracer bullets. Each tracer begins with a failing output-level or contract-level case, crosses the real canonical path, and ends with a demoable Owner outcome.

### Slice 0 — Specification and baseline guard

- Make this document the sole current specification.
- Review and accept, revise, or reject proposed ADR 0022 before canonical knowledge-schema implementation.
- Freeze earlier documents as history.
- Correct active domain and README claims that overstate historical authority or prototype playability.
- Verify that the completed prototype evidence remains intact.
- Separate tri-state `hardGateStatus` from four-state `acceptanceStatus` and remove every false `hard gates pass` presentation.
- Enforce a first evaluator-input canary so later evaluation work cannot build on the current porous executor boundary.

### Slice 1 — Source identity and safe migration

- Introduce versioned identity assertions, Works, Source Manifestations, Exemplars, immutable Digital Assets, acquisition records, Source Segment Versions, rights assertions, and Access Decisions.
- Preserve each OwnerReference as an immutable legacy record with a permanent mapping, migration journal, collision and unresolved-identity quarantine, and exact byte and hash verification.
- Inventory legacy Historical Practice Claims, Knowledge Packs, and activation paths; map same-lane records where provenance permits, quarantine mixed or self-authorizing authority by default, preserve compatibility reads, and shut down every legacy activation bypass at cutover.
- Make migration transactional, idempotent, resumable, dry-runnable, and rollback-safe through cutover; never manufacture missing Work, date, edition, provenance, rights, or review authority.
- Default migrated private content to no provider egress, fixture inclusion, or redistribution.
- Exercise duplicate bytes with different provenance, incomplete and composite identity, interruption, rollback, rerun, post-cutover referential integrity, compatibility reads, and attempts to reactivate quarantined legacy knowledge through an old code path.
- Remove automatic perfect confidence for documentary classification.
- End with one migrated and one newly uploaded real reference visible through the production Workbench.

### Slice 2 — Mace ingestion vertical

- Upload or acquire the Mace asset.
- Resolve its source identity.
- Build and resume a Page Atlas.
- Create an exact cited segment for printed page 75.
- Stage the twelve-course notation candidate and explicit thirteenth-course research question.
- Exercise malicious or oversized acquisition, parser failure, redacted diagnostics, local-only processing, and denied provider egress.
- Complete the path in the real browser without promoting specialist authority or changing an old citation after an Atlas correction.

### Slice 3 — Release, manifest, and provisional-consequence vertical

- Add orthogonal candidate axes, lane-compatible typed evidence and derivation relations, immutable releases, externally verified scoped attestations, advisories, Activation Decisions, and centrally governed Resolution Policy.
- Produce a test-only release with profiles, examples, counterexamples, derivations, and declarative mappings.
- Resolve it into an Applied Knowledge Manifest.
- Rebuild an authoritative Knowledge Library Inventory, derive an exact Catalog, and recompute manifest completeness against those and the Component Registry Snapshot; detect an omitted inventoried release, eligibility outcome, profile, or dependency.
- Run one visible arrangement consequence only in explicit provisional-research mode and prove that default Guided Start cannot activate it or claim readiness.
- Record exact Inventory, Catalog, Activation Decision, component, and manifest digests in Arrangement Search and Evaluation Run identity.
- Prove that unknown, excluded, conflicting, retracted, and unavailable-source states remain distinct.

### Slice 4 — Evaluation contracts, isolation, and vault

- Migrate old Cards and baselines without reinterpreting prior proxy dimensions; incompatible comparisons say so.
- Enforce the Generation Input Envelope and evaluator-only store in a separate process.
- Add tri-state hard gates, four-state acceptance, Generation-System-scoped contamination groups, split manifests, provider and session exposure history, and precommitted reserve ordering.
- Add Search Measurement and Selection Policy contracts separately from Evaluation Cards.
- Create the Owner Evaluation Vault outside Git and prove with canaries that generation cannot read its labels, mutations, expectations, or reserve assets.
- Validate the framework with synthetic contract cases; target musical evaluators remain owned by their verticals.

### Slice 5 — Shared voice, relationship, and phrase intelligence

- Add separately identified and digested Target Voice, Target Relationship, Continuo Realization and Disposition, and Intended Technique Plans.
- Add exact ergonomic context, activity spans and planned rests, phrase boundary state, and work-level obligations.
- Replace event-local musical selection with bounded phrase search and honest terminal outcomes.
- Compile Principal Voice, bass, counterpoint, figures, Continuo Foundation, cadence, target texture, and technique into observable constraints and independent evaluator requirements.

### Slice 6 — Continuo relationship vertical

- Carry Gasparini source segments and the legally usable soprano-plus-figured-bass Golden Fixture through optical import, reviewed bass and figure truth, a source-backed `continuo.italian-baroque` Realization Profile, Applied Manifest, Voice and Relationship Plans, search, engraving, isolated playback, audit, and independent evaluation.
- Produce a complete soprano-plus-piano realization and policy-contract cases for complete, separate-bass, and correctly rejected or explicitly labeled Continuo Reduction dispositions without presupposing an unrepaired fretted-target compiler.
- Mutate every foundation event, figure, accidental, alignment, continuation, prepared 4-3 suspension, generated voice, and disposition outside generation's view.

### Slice 7 — Imitative-counterpoint relationship vertical

- Carry the legally usable three-voice imitative Golden Fixture through Analysis, Validation Profile, Applied Manifest, Voice and Relationship Plans, the existing six-course Renaissance-lute path, engraving, isolated playback, audit, and independent evaluation.
- Preserve ordered entries, subject interval-rhythm shapes, voice continuities and exchanges, and cadential goals without inventing one permanent Principal Voice.
- Mutate entry order, subject shape, relationship timing, voice identity, and cadence placement outside generation's view.

### Slice 8 — Baroque-guitar development vertical

1. Preserve the exact known-bad Greensleeves output and prove that independent evaluators reject its voice, two-dimensional course-and-fret reach, allocation, stroke-mask, Gesture Sequence, and transition failures.
2. Run one reviewed Sanz or Corbetta path into a test-only release, implement exact two-dimensional left-hand contact and transition geometry plus orthogonal punteado, rasgueado, alfabeto, mixed-style, course-allocation, resonance, and gesture semantics, and repair the production search, engraving, playback, and workbench paths.
3. Apply the shared Continuo disposition contract to baroque guitar and prove that any incomplete foundation receives an explicit separate bass or correctly labeled reduction rather than a false complete realization.
4. Pass the development Regression Bundle without activating test-only knowledge in default Guided Start.

### Slice 9 — Baroque-lute development vertical

1. Preserve the exact known-bad Greensleeves output and prove that independent evaluators reject its pinned `f` and `b` reach, course, transition, notation, and playback failures; add mutations that reject impossible digit allocation, stopped-course simultaneity, alternation, crossing, thumb behavior, and stopped-course-to-diapason transitions.
2. Run Mace plus one normative and one repertoire path into scoped test-only releases, implement two-dimensional left-hand geometry and whole-instrument right-hand allocation, preparation, simultaneity, alternation, crossing, thumb, diapason, transition, resonance, and damping state, and repair the full production path.
3. Re-run the accepted Golden Engraving Fixture for course 10 `///a`/D2, Bass Tuning invariance, the full `a`, `/a`, `//a`, `///a`, `4`, `5` sequence, below-staff glyph placement, MIDI identity, and absence of duplicate playback.
4. Pass the development Regression Bundle while treating course-13 historical notation as `not_claimed` under the editorial profile or unresolved under a historically scoped profile.

### Slice 10 — Classical-guitar development vertical

1. Preserve the disappearing-bass output and prove that evaluators reject its activity-span, relationship, cadence, duration, mechanics, notation, and playback failures.
2. Run Sor plus one Carulli aligned reduction into scoped test-only releases, implement exact joint left- and right-hand polyphonic phrase search, and repair first-class standard notation and isolated playback.
3. Pass the development Regression Bundle without using event count or continuous sound as a proxy for coherent voice.

Slices 8 through 10 are coequal target siblings. Slice 8 steps 1–2 and Slices 9–10 may proceed independently after Slice 5; Slice 8 step 3 depends on the shared Continuo contract in Slice 6, and its step 4 depends on step 3. Each numbered red, repair, and development-acceptance step is a separate tracer committed before its dependent step.

### Slice 11 — Reassessment, reviewed learning, and recovery

- Ingest corroborating and conflicting sources and support comparison, qualification, contradiction, supersession, advisory, retraction, rights change, and research questions.
- Produce affected-arrangement Reassessments without mutation or automatic authority.
- Classify edits, playtests, feedback, and evaluator disagreements and propose—but do not auto-activate—Personal Defaults, Ergonomic Profiles, Knowledge Candidates, Calibration Candidates, and fixtures.
- Add release and attestation diff, advisory and deletion workflow, affected-workspace navigation, exact resume, and derivative purge tests.
- Preserve legacy searches without invented manifests and offer canonical regeneration.

### Slice 12 — Sealed non-Greensleeves machine acceptance

- Before any output is observed, a curator who did not develop the Generation Systems commits the legally usable eligible pool, contamination closures, invalid-fixture policy, reserve order or selection seed, coverage assignment, and exhaustion rule in the Owner Evaluation Vault without exposing evaluator truth to generation.
- Freeze compiler, pack, Resolution and Selection Policy, evaluator, split-manifest, and runtime versions.
- Run at least two non-Greensleeves groups per target plus the dedicated Continuo and imitative groups.
- Include a real PDF-to-three-target Guided Start path with consequential review, alternatives, score following, isolation, manual edit adoption, version history, interruption, reload, retry of incomplete siblings only, and complete deliverable rehydration.
- Every valid failed group remains disclosed and becomes a permanent required regression; after repair, the successor must pass all accumulated failures plus the next precommitted reserve groups held out from Vellum development.
- Emit tri-state hard-gate and four-state acceptance Evaluation Cards plus compatible or explicitly incomparable baseline results.

### Slice 13 — Late human review and release remediation loop

HITL is intentionally concentrated here so AFK implementation can safely reach provisional machine completion first.

The exact-digest review package includes:

- metadata and rights review;
- source transcription and extraction review;
- historical-claim and pack-profile review by declared role;
- target-player physical playtests for all three instruments;
- qualified keyboard-continuo review of the generated soprano-plus-piano realization;
- qualified imitative-intabulation review of the six-course lute output;
- engraving-editor review;
- Owner cross-target usefulness review;
- disagreements and unresolved dimensions;
- exact pack, compiler, evaluator, source, and output digests; and
- rerun instructions.

Review is a closure loop, not one ceremony. A blocking finding creates a tracer at the earliest affected slice. After repair, the impact map invalidates affected deterministic, held-out, and human evidence; every valid holdout that informed the repair becomes a permanent disclosed regression and the next precommitted reserve groups remain required; changed outputs receive a new package; and no attestation transfers to a changed digest.

Content changes create a new release and review creates an attestation; a test-only release never mutates into a stronger state. The loop repeats until release requirements pass or the Owner explicitly accepts provisional closure without relabeling it.

## Completion boundary

The program has two non-compensating closure states:

- **Machine Complete**: deterministic implementation slices, development regressions, isolation and security tests, and sealed non-Greensleeves capability suites pass. Outputs may remain provisional while required human evidence is missing.
- **Release Complete**: Machine Complete plus current compatible Capability Qualifications and every exact-artifact role-scoped human, physical, idiom, historical, notation, relationship, and Owner review required by the selected acceptance profiles.

Unqualified `complete` in this specification means Release Complete. Machine Complete may be accepted as an explicit provisional stopping point, but it does not satisfy the expert-quality product claim.

### Machine Complete

- one real reference travels from upload or safe acquisition through versioned identity, Page Atlas, cited extraction, candidate review, immutable release and attestation, complete applicability resolution, arrangement consequence, and Reassessment;
- migration preserves every legacy ID, byte, hash, and citation through a verified mapping or actionable quarantine without inventing provenance;
- unauthorized provider egress, fixture inclusion, logs, reports, exports, and redistribution are blocked across the complete derivative graph;
- hostile and oversized acquisition, parser, rendering, pack-parameter, and content-reference cases fail safely within resource bounds;
- every Arrangement Search that claims historical, editorial, pedagogical, or software-guided behavior records a complete Applied Knowledge Manifest over an exact Catalog, Resolution Policy, and Component Registry Snapshot;
- omitted eligible packs, dependencies, conflicts, exclusions, activation modes, and rights decisions invalidate a manifest;
- no release activated only by a test-only attestation is active in default or machine-ready output;
- Principal Voice preservation works by default under the exact Transposition Plan without a specialist prompt;
- Target Voice and Relationship Plans prevent structural voices, rests, entries, suspensions, bass functions, and cadential relationships from disappearing silently;
- the figured-bass Golden Fixture traverses the new pack, manifest, Voice, Relationship, Continuo Realization, and Disposition contracts and passes every required mutation;
- the imitative-counterpoint Golden Fixture traverses the same contracts and preserves ordered entries and subject relationships without assuming one Principal Voice;
- instrument mechanics, ergonomics, historical evidence, modern pedagogy, editorial convention, software heuristics, personal preference, and evaluation remain distinct;
- the three exact Greensleeves regressions fail before repair and pass afterward as development evidence;
- each target passes at least two sealed non-Greensleeves contamination groups, and dedicated Continuo and imitative groups pass;
- baroque-guitar output realizes exact two-dimensional course-and-fret contacts and transitions plus supported orthogonal attack, gesture, alfabeto, course-allocation, resonance, and damping facets rather than a mislabeled flat mode;
- baroque-lute output rejects the known reach; realizes explicit right-hand digit allocation, preparation, simultaneity, alternation, crossing, thumb behavior, and stopped-course/diapason transitions; models diapasons independently; and labels every course-13 convention as historical, editorial, or unknown according to direct evidence;
- the Golden Engraving Fixture passes course 10 `///a`/D2, Bass Tuning sign invariance, the full course 7–12 sign sequence, below-staff placement, MIDI identity, and duplicate-playback checks;
- classical-guitar output provides coherent planned voices, exact joint-hand state, and first-class standard notation;
- notation and playback agree with canonical notes, written and sounding pitch, voices, positions, constituent strings, gesture timing, held and damped state, and Performed Form;
- generation is technically unable to read evaluator-only expectations, mutations, baselines, labels, or vault contents outside its sealed source envelope;
- hard-gate status passes only when every required applicable gate completed and passed;
- acceptance remains blocked for required source, access, provider, evaluator, or infrastructure failure and incomplete for missing evidence; neither state is displayed as pass;
- default candidate selection records Search Measurements and Selection Policy rather than using hidden totals or held-out evaluation;
- bounded search distinguishes proven infeasibility, exhaustion, cancellation, and infrastructure failure;
- the real-browser PDF-to-three-target workflow is resumable, rehydrates completed siblings, retries only incomplete work, avoids duplicate versions, and opens the selected score;
- material alternatives, conflicts, compromises, activation modes, and unknowns remain visible; and
- complete typecheck, test, formatting, specification, evaluation, rendering, playback, security, migration, and relevant real-tool gates pass.

### Release Complete

- every historical or specialist presentation has a trusted scope-appropriate attestation over the exact release and claim or profile scope;
- every released target artifact cites a current compatible Capability Qualification over its exact Generation System and profile closure;
- exact-digest target-player playtests are current for all three target outputs under their pinned Instrument Instances and Performance Briefs;
- each target has a separately qualified, profile-specific idiom review; a novice Owner playtest remains personal ergonomic evidence rather than historical authority;
- the Continuo and imitative outputs have qualified profile-specific musical reviews of spacing, doubling, voice leading, disposition, and contrapuntal realization as applicable;
- engraving-editor and Owner cross-target usefulness reviews are current;
- every course-13-specific historical claim has directly applicable released evidence, or an editorial-profile output explicitly makes no historical-authenticity claim for that sign;
- every finding-triggered repair completed impact analysis, fresh deterministic evaluation, replacement of contaminated holdouts, and review of changed digests;
- no required acceptance dimension remains unknown, incomplete, or supported only by test-only knowledge; and
- every tracer is committed and pushed to main before its dependent tracer begins.

## Non-goals

- Training a model on the Owner's library.
- Treating model memory, web search, OCR, OMR, or corpus frequency as historical authority.
- Bulk-importing the entire BLUEUSB volume without selection, identity review, and deduplication.
- Coupling the product to IMSLP or any one repository.
- Redistributing copyrighted books or provider scans merely because the underlying Work is old.
- Establishing one universal baroque-guitar, lute, or classical-guitar technique.
- Calling a source-scoped practice a universal instrument rule.
- Treating one Greensleeves output, one accepted fingering, one method, one performer, or one held-out run as proof of general target-instrument idiom.
- Storing held-out-from-development labels or reserve assets in ordinary repository fixtures where generation or development agents can inspect them.
- Claiming total physical playability from geometry, synthesis, or one evaluator.
- Claiming that an unevaluated ornament, articulation, overholding, attack-release, tone-production, or perceptual-prominence dimension passed merely because notation and MIDI compile.
- Generating realistic historical-instrument audio; Audio Preview remains a checking tool.
- Replacing accepted lineage, Preservation Audit, Arrangement Search, or evaluation architecture.
- Reopening completed historical tracer waves as the execution tracker for this work.

## Research questions that do not block the substrate

- Which directly citable source establishes one or more thirteen-course French-tablature diapason conventions?
- Which baroque-guitar schools and dates support particular right-hand resources, stroke masks, and mixed-style transitions?
- How should historically ambiguous Corbetta suppression marks be represented in engraving and playback?
- Which repertoire sampling protocol can support descriptive idiom observations without circular evaluation?
- Which classical-guitar voice-continuity and right-hand metrics correlate with expert review across difficulty contexts?
- Which lute span and transition models generalize beyond the Owner's Instrument Instance while preserving personal calibration?

Until resolved, Vellum may use explicit modern editorial conventions, software heuristics, separate alternatives, or unknown status. It may not manufacture historical certainty.

## Historical material

The archived snapshot preserves the former product specification, subordinate design specs, proposal suite, source-ingestion draft, tech-debt audit, blunder hunts, open questions, legacy waves, and superseded follow-up tracers in their former repository-relative layout.

The completed Arrangement Intelligence evidence under .scratch/arrangement-intelligence remains in place because its manifest binds exact paths and hashes. It is a frozen prototype closure record, not an active plan. New execution receives a new .scratch namespace and a new manifest.
