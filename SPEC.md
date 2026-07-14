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

### Architectural decision

[ADR 0022](./docs/adr/0022-govern-reviewed-knowledge-library.md) is accepted and governs the Reviewed Knowledge Library architecture defined here. ADRs 0002 and 0015 remain compatible authorities for project-local corrections, Personal Defaults, Owner references, and the historical-practice lane.

## Product outcome

Vellum should provide the practical benefit of a personal musicologist and expert arranger without requiring the Owner to supply musicological vocabulary or instrument-specific rules.

Given a musical source, Vellum should ordinarily infer:

- the Principal Voice or the absence of one;
- a Source Voice Graph that distinguishes voices from parts and staves;
- Texture, Contrapuntal Technique, harmonic structure, voice roles, phrases, cadences, changing musical context, and form;
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

A Capability Qualification pins the Generation System digest and transitive dependency closure, target and acceptance profiles, explicit Qualification Claim Scope, split manifest and contamination history, provider-exposure record, evaluator versions, all attempted groups, and machine results. The Claim Scope names supported source modalities, textures, techniques, instrument configurations, notation and playback dimensions, workload envelope, provider conditions, evaluated coverage, exclusions, and unknown or unclaimed dimensions. Passing two groups cannot authorize the broader label “target qualified” outside that scope. Artifact Readiness pins the exact Arrangement Score and Deliverable digests, Instrument Instance and Performance Brief, compatible Capability Qualification, independent Evaluation Cards and Adoption Decision, and required human or physical evidence. Either record is immutable; a changed dependency, profile, output, or required-evidence policy creates a new record or an explicit stale state.

### Knowledge activation is explicit

Knowledge lifecycle and arranging authority are separate. The activation policy is:

| Artifact or attestation                      | Permitted use                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Mutable draft                                | Workbench authoring only                                                                                                    |
| Immutable release with test-only attestation | Isolated evaluation or an explicitly enabled provisional research mode                                                      |
| Maintainer-reviewed-system attestation       | Default software heuristics or editorial behavior within an explicitly nonhistorical system scope                           |
| Owner-reviewed-local attestation             | Disclosed local guidance within the attested scope                                                                          |
| Specialist attestation                       | Historical or specialist presentation only within the attested claim, profile, instrument, period, school, and review scope |

A test-only release may exercise the production code path, but it cannot become the default candidate, produce a ready result, or satisfy a historical-readiness gate. A maintainer-reviewed-system attestation authorizes only explicitly classified software heuristics or editorial defaults under a pinned policy; it cannot authorize or imply historical, pedagogical, ergonomic, performer, or specialist claims. Promotion creates a new immutable release or attestation; it never changes an existing release in place.

### Constitutive technique belongs to the score plan

Technique belongs to the Arrangement Plan or Arrangement Score when it changes the musical event, available notes, sounding courses, voice continuity, duration, articulation identity, or notation. Examples include a rasgueado stroke, an alfabeto chord, required course suppression, a campanella fingering that sustains overlapping notes, or a required damping event.

Optional execution detail belongs to Performance Interpretation when changing it leaves the canonical notated and sounding musical obligations intact. The same family of technique may occupy different layers in different passages, so the decision is explicit rather than globally hard-coded.

### Packs contain declarative knowledge, not executable uploads

Knowledge Packs may name registered compiler and evaluator components and provide schema-validated parameters. An imported document or pack cannot supply arbitrary executable code, file paths, shell commands, templates with active content, or provider credentials.

### Old results remain immutable; replayability is explicit

A new source, claim, profile, pack release, compiler, or evaluator never rewrites an existing Arrangement Search or Arrangement Score. Replayability is recorded as complete, partial, unavailable, or legacy-unverifiable according to retained bytes, executable semantics, authority, and rights. A Knowledge Reassessment may explain that regeneration could improve or invalidate an earlier readiness claim without pretending an unreplayable historical result can still be reproduced.

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
  digest: string;
};

type AssetAcquisition = {
  id: string;
  digitalAssetRef: DigestedRef;
  representedExemplarRefs: DigestedRef[];
  sourceKind: "upload" | "stable_url" | "iiif" | "library_object" | "private_scan";
  providerObjectRef?: string;
  redactedRetrievalUri?: string;
  acquiredAt: string;
  rightsAssertionRefs: DigestedRef[];
  processingPolicyRef: DigestedRef;
  supersedesAcquisitionRef?: DigestedRef;
  digest: string;
};

type SourceSegmentVersion = {
  id: string;
  version: number;
  parentVersionRef?: DigestedRef;
  digitalAssetRef: DigestedRef;
  acquisitionRefs: DigestedRef[];
  provenancePathRefs: DigestedRef[];
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

type AssetRoleBinding = {
  id: string;
  digitalAssetRef: DigestedRef;
  acquisitionRefs: DigestedRef[];
  role: "arrangement_source" | "owner_reference" | "evaluation_source";
  workspaceRef?: DigestedRef;
  ownerLibraryRef?: DigestedRef;
  accessDecisionRefs: DigestedRef[];
  retentionPolicyRef: DigestedRef;
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

Deduplication shares immutable bytes, never acquisition provenance, rights, retention, or authority. Every segment, extraction, candidate, derivative, fixture, prompt, report, and export pins the exact acquisition and provenance path that authorized it. A later, more permissive acquisition of identical bytes cannot retroactively authorize an existing derivative without an explicit reviewed provenance-substitution decision. Deletion first removes or restricts acquisition edges; effective rights are recomputed over surviving authorized paths, and shared bytes are garbage-collected only when no retained acquisition, derivative, or explicit pin requires them.

Guided Start's **arrange this**, **add to Owner Reference Library**, and **do both** choices create role-specific Asset Role Bindings over the same content-addressed Digital Asset and explicit acquisition paths. They do not copy bytes into unrelated stores or let one role borrow another role's access, retention, export, or deletion authority.

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

Remote model processing is available only through a server-minted Model Action Attempt. A client submits intent and canonical workspace refs; it cannot supply raw provider context, substitute a destination, append source content directly, or widen tool capability. The server reconstructs the exact permitted context and issues an immutable Model Egress Envelope:

```ts
type ModelEgressEnvelope = {
  id: string;
  workspaceRef: DigestedRef;
  modelActionAttemptRef: DigestedRef;
  inputVersionRefs: DigestedRef[];
  disclosedSourceAndDerivativeRefs: DigestedRef[];
  accessDecisionRefs: DigestedRef[];
  destination: {
    providerRef: DigestedRef;
    modelRef: DigestedRef;
    accountScopeRef?: DigestedRef;
  };
  purposeRef: DigestedRef;
  promptTemplateRef: DigestedRef;
  serializedRequestDigest: string;
  allowedToolCapabilityRefs: DigestedRef[];
  resourcePolicyRef: DigestedRef;
  issuedAt: string;
  digest: string;
};

type ModelActionResultCommit = {
  id: string;
  modelActionAttemptRef: DigestedRef;
  egressEnvelopeRef: DigestedRef;
  exactInputVersionRefs: DigestedRef[];
  providerResponseRef: ContentRef;
  providerResponseDigest: string;
  completedToolResultRefs: DigestedRef[];
  validationEvidenceRefs: DigestedRef[];
  canonicalResultRef: DigestedRef;
  canonicalResultDigest: string;
  committedAt: string;
  digest: string;
};
```

Every disclosed ref must be authorized for the exact destination and purpose. Provider Authorization authenticates the connection but never authorizes arbitrary data transmission. Imported text, OCR, metadata, notation, and pack prose are quoted as untrusted data and cannot alter system instructions, destination, egress policy, or tool capabilities. A generic client-supplied provider stream is not a production interface.

Completion is also server-bound. The service validates that the provider response and local tool transcript descend from the exact attempt and Egress Envelope, validates the proposed canonical result, and atomically publishes that result with a Model Action Result Commit. A client cannot complete an attempt merely by naming an unrelated pre-existing record in the same workspace.

### Untrusted-ingestion boundary

Reference files, URLs, IIIF manifests, catalog metadata, OCR text, translations, and imported packs are untrusted input.

- Acquisition permits only supported URI schemes. Redirects are revalidated at every hop; loopback, link-local, private-network, credential-bearing, local-file, and disallowed targets require an explicit local connector rather than a generic fetch.
- DNS resolution and the connected address must satisfy the same policy. Retrieval URIs are sanitized before persistence or display.
- Imports enforce byte, page, pixel, archive-expansion, nesting, time, memory, and output limits. Declared media type is checked against detected content.
- PDF, image, archive, OCR, OMR, and conversion components run with bounded resources and without ambient network, credential, provider-token, or unrestricted filesystem access.
- Imported text and metadata render as inert escaped data under the applicable Content Security Policy. Content refs resolve only through Vellum's content store and cannot embed arbitrary paths or executable URLs.
- Pack bindings resolve only through an exact authorized Component Registry Snapshot. Parameter schemas include units, ranges, collection limits, compatibility, and resource budgets.
- Model-facing imported content is delimited as untrusted evidence and receives no instruction authority. Model Actions expose only the least-privilege tool capabilities named by their Egress Envelope; source text cannot request another provider, workspace, filesystem region, secret, callback, or tool.
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
type KnowledgeEvidenceEdge = {
  id: string;
  sourceRef: DigestedRef;
  targetRef: DigestedRef;
  role: "support" | "contradiction" | "qualification" | "counterexample";
  scopeRef?: DigestedRef;
  rationale: string;
  digest: string;
};

type ApplicabilityPredicateRecord = {
  id: string;
  schemaVersion: string;
  expression: TypedApplicabilityExpression;
  requiredContextRefs: DigestedRef[];
  unknownPolicy: "preserve_unknown" | "review_required";
  unitSchemaRef?: DigestedRef;
  digest: string;
};

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
  proposition?: TypedKnowledgeProposition;
  applicabilityPredicateRefs: DigestedRef[];
  reviewState: "proposed" | "reviewed" | "rejected" | "superseded";
  assertedBy: ActorRef;
  digest: string;
};
```

A worked example may also be descriptive evidence or a counterexample; those roles do not change its authority lane. A conflict and a research question are graph nodes, not disguised claims. Candidate corrections create a new digested version. Evidence, relationship, and derivation edges are external immutable records that point to already digested candidate cores; candidate cores do not point back to those edges. A Knowledge Pack Release pins the exact node and edge sets. This Merkle-DAG rule prevents candidate↔edge digest cycles. Applicability predicates have stable identities so evaluation, correction, supersession, and replay can address the exact expression that ran.

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

Canonical library publication is transactional, not merely file-atomic. Releases, attestations, advisories, identity and authority verifications, Activation Decisions, Inventory and Catalog snapshots, and visible head-state changes are staged in one publication generation and become visible through one compare-and-swap commit. Readers resolve one stable committed generation. A crash leaves either the previous generation current or an unreachable recoverable staging set; concurrent writers use optimistic revision checks or serialization, and recovery is idempotent.

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
  kind: "test_only" | "maintainer_reviewed_system" | "owner_reviewed_local" | "specialist_reviewed";
  reviewerIdentitySnapshotRef: DigestedRef;
  reviewerRoleRef: DigestedRef;
  reviewScopeRef: DigestedRef;
  signatureRef?: ContentRef;
  evidenceRefs: DigestedRef[];
  issuedAt: string;
  digest: string;
};

type ReviewerIdentitySnapshot = {
  id: string;
  subjectRef: EntityRef;
  assertedAttributes: Record<string, unknown>;
  evidenceRefs: DigestedRef[];
  capturedAt: string;
  digest: string;
};

type CredentialAssertion = {
  id: string;
  reviewerIdentitySnapshotRef: DigestedRef;
  issuerIdentityRef: DigestedRef;
  roleRef: DigestedRef;
  scopeRef: DigestedRef;
  validFrom: string;
  validUntil?: string;
  revocationSourceRefs: DigestedRef[];
  signatureRef?: ContentRef;
  digest: string;
};

type AttestationVerificationBase = {
  id: string;
  attestationRef: DigestedRef;
  verifierPolicyRef: DigestedRef;
  verifierIdentityRef: DigestedRef;
  verifierComponentRef?: DigestedRef;
  reviewerIdentitySnapshotRef: DigestedRef;
  credentialAssertionRefs: DigestedRef[];
  verificationMethodRef: DigestedRef;
  revocationSnapshotRefs: DigestedRef[];
  validUntil?: string;
  receiptOrSignatureRef?: ContentRef;
  checkedAt: string;
  evidenceRefs: DigestedRef[];
  digest: string;
};

type AttestationVerification = AttestationVerificationBase &
  (
    | {
        result: "verified_authorized" | "verified_out_of_scope";
        evaluatedScopeRef: DigestedRef;
        authorizationScopeRef: DigestedRef;
      }
    | {
        result: "unverified" | "revoked";
        evaluatedScopeRef?: never;
        authorizationScopeRef?: never;
      }
  );

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

type AdvisoryVerificationBase = {
  id: string;
  advisoryRef: DigestedRef;
  verifierPolicyRef: DigestedRef;
  verifierIdentityRef: DigestedRef;
  verifierComponentRef?: DigestedRef;
  issuerIdentitySnapshotRef: DigestedRef;
  credentialAssertionRefs: DigestedRef[];
  verificationMethodRef: DigestedRef;
  revocationSnapshotRefs: DigestedRef[];
  validUntil?: string;
  receiptOrSignatureRef?: ContentRef;
  checkedAt: string;
  evidenceRefs: DigestedRef[];
  digest: string;
};

type AdvisoryVerification = AdvisoryVerificationBase &
  (
    | {
        result: "verified_authorized" | "verified_out_of_scope";
        evaluatedScopeRef: DigestedRef;
        authorizationScopeRef: DigestedRef;
      }
    | {
        result: "unverified" | "revoked";
        evaluatedScopeRef?: never;
        authorizationScopeRef?: never;
      }
  );

type ActivationAuthority =
  | {
      kind: "test_only";
      testPolicyRef: DigestedRef;
      permittedUse: "isolated_evaluation" | "provisional_research";
    }
  | {
      kind: "maintainer_reviewed_system";
      authorityVerificationRef: DigestedRef;
      permittedUse: "software_default" | "editorial_default";
      nonHistoricalScopeRef: DigestedRef;
    }
  | {
      kind: "owner_reviewed_local";
      authorityVerificationRef: DigestedRef;
      permittedUse: "disclosed_local_guidance";
    }
  | {
      kind: "specialist_reviewed";
      authorityVerificationRefs: DigestedRef[];
      presentationScopeRef: DigestedRef;
    };

type ActivationDecisionBase = {
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
  resolutionTimeRef: DigestedRef;
  clockPolicyRef: DigestedRef;
  validThrough?: string;
  rationale: string;
  digest: string;
};

type ActivationDecision = ActivationDecisionBase &
  (
    | { result: "allow"; authority: ActivationAuthority }
    | { result: "deny" | "review_required"; authority?: never }
  );
```

Canonical serialization, digest domain, schema version, and internal digested references are part of the storage contract. Content changes create a new release. Later review creates an attestation; supersession, retraction, rights restriction, or revocation creates an advisory. Trust is computed by an external Attestation Verification under a pinned verifier policy; advisory issuer identity and authority over the advisory kind, subject, and scope are computed by an external Advisory Verification. Neither is a claimant-controlled field. A verified or out-of-scope result always pins both the evaluated scope and the authority scope used for comparison; unverified and revoked results cannot carry an authority scope. A verification is trusted only when issued through a verifier authorized by the pinned Trust Policy; importing a verification record cannot confer trust. Every Catalog and Activation Decision pins resolution time, clock policy, and any earliest validity boundary. Current use fails closed after expiry or verified revocation and atomically publishes a replacement `review_required` or `deny` decision before further ordinary activation, while historical outputs retain their original as-of snapshots.

For brevity, this specification may call a release whose only activating attestation is `test_only` a test-only release; the state belongs to the attestation, not mutable release content.

A test-only attestation is system-issued under a pinned test policy and conveys no human, historical, or specialist authority. A maintainer-reviewed-system attestation authorizes only software or editorial consequences inside its explicitly nonhistorical scope. Owner-reviewed-local and specialist attestations require the corresponding human reviewer and external scope verification. Exact-artifact human reviews use the same external Reviewer Authority Verification contract: Owner-usefulness review may use explicit Owner authority, while target-player, idiom, historical, continuo, counterpoint, and engraving claims require matching verified roles. AFK automation may build drafts, extraction artifacts, candidates, test-only releases and attestations, and review packages; it may not invent human authority.

An `allow` Activation Decision without exactly one valid authority variant is schema-invalid. Its authority must agree with the complete attestation and verification closure and remains part of the Manifest, Arrangement Search identity, export policy, readiness calculation, and user disclosure.

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
  resolutionTimeRef: DigestedRef;
  clockPolicyRef: DigestedRef;
  eligibleReleaseRefs: DigestedRef[];
  inventoryOutcomeRefs: DigestedRef[];
  attestationRefs: DigestedRef[];
  verificationRefs: DigestedRef[];
  advisoryRefs: DigestedRef[];
  advisoryVerificationRefs: DigestedRef[];
  rightsDecisionRefs: DigestedRef[];
  trustPolicyRef: DigestedRef;
  catalogBuilderRef: DigestedRef;
  validThrough?: string;
  digest: string;
};

type PredicateResult = {
  predicateRef: DigestedRef;
  evaluatedContextRef: DigestedRef;
  evaluatorComponentRef: DigestedRef;
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

Release dependencies form an acyclic Merkle DAG and may reference only already digested releases. A semantic conflict, mutual comparison, or citation relationship that is not an authority dependency belongs in an external relationship edge pinned by the Inventory or Release graph snapshot. Dependency cycles are schema-invalid rather than being resolved through an unspecified fixed-point hash.

Manifest completeness is an enforced invariant:

- the Inventory Snapshot is the authoritative enumeration of every release reachable from the pinned configured registries under the pinned inventory builder and policy;
- every release in the Inventory Snapshot has exactly one Catalog inclusion or exclusion outcome, and every included release appears in the Catalog Snapshot;
- every eligible release in the Catalog Snapshot has one retained manifest outcome;
- every reachable profile in every considered release appears exactly once;
- exclusions record typed reasons and every dependency appears in a complete acyclic closure;
- every predicate retains true, false, unknown, or error rather than collapsing missing data into false;
- every profile entry has exactly one Activation Decision: applicable authorized entries receive `allow`, inapplicable or excluded entries receive `deny`, and unresolved or conflicting authority receives `review_required` unless policy resolves it without erasure;
- every `allow` decision carries exactly one scope-compatible Activation Authority derived from its complete verified attestation closure; missing or mixed authority invalidates the decision;
- only applicable entries with an `allow` Activation Decision over matching release, profile, scope, trusted Attestation Verification, rights decisions, verified effective advisories, and Resolution Policy activate ordinary consequences;
- conflicting entries retain separate candidate-family consequences until an explicit resolution selects one; and
- every selected component and parameter set resolves through the exact Component Registry Snapshot.

A manifest that omits an inventoried release, Catalog outcome, profile, dependency, conflict, exclusion reason, Activation Decision, or resolution decision is invalid. Validators independently rebuild the Inventory and Catalog Snapshots from their pinned registries, builders, and policies before recomputing completeness; a generator or catalog builder cannot certify its own completeness by listing only the packs it found or used.

Every Arrangement Search records the exact manifest and referenced immutable records. Unknown applicability cannot be scored as neutral. Materially different historically plausible resolutions produce separate candidate families or a focused review.

### Authority Path Inventory

Musical authority does not live only in stored Knowledge Packs. An immutable Authority Path Inventory covers every prompt instruction, prompt example, tool description or default, built-in lookup table or chart, compiler branch, ranker, validator, parameter, profile constant, and presentation label capable of changing musical behavior or the authority claimed for that behavior.

Every path is classified as one of:

- mechanical fact resolved through an Instrument Model or Instrument Instance;
- reviewed Knowledge Pack or profile consequence;
- maintainer-reviewed software heuristic;
- editorial convention;
- Owner-local preference;
- evaluator-only logic; or
- forbidden unregistered bypass.

Each nonmechanical production path resolves through the exact Component Registry Snapshot and Applied Knowledge Manifest or is disabled. Static scans and runtime instrumentation detect newly introduced unregistered paths. A manifest that records an empty pack set while prompt, table, ranker, or compiler behavior still supplies unregistered historical or idiomatic guidance is invalid.

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

Each immutable Reassessment records its triggering candidate, release, attestation, advisory, identity correction, rights decision, or validity expiry; exact old and new refs; affected dependency paths; proposed, reviewed, or effective state; resolver, policy, Inventory and Catalog Snapshot identities; reviewer and evidence refs; and remediation or regeneration choices. Positive authority arises only from a new Activation Decision over an immutable release, trusted applicable Attestation Verification, verified effective advisories, current rights decisions, resolution time and clock policy, and the pinned Resolution Policy. Expiry or verified revocation immediately makes an old `allow` ineligible for current use and requires an atomically published `review_required` or `deny` successor before ordinary activation resumes. Old outputs retain their original as-of snapshots.

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

### Source Voice Graph

A staff, part, tablature system, or MIDI track is not automatically one musical voice. Before target planning, every polyphonic source receives a Source Voice Graph. Identity basis is notated, inferred, or hybrid; resolved, disputed, and unresolved are separate identity states.

```ts
type SourceVoice = {
  id: string;
  sourcePartRefs: DigestedRef[];
  identityBasis: "notated" | "inferred" | "hybrid";
  identityState: "resolved" | "disputed" | "unresolved";
  occurrenceRefs: DigestedRef[];
  roleClaimRefs: DigestedRef[];
  evidenceRefs: DigestedRef[];
  uncertaintyRefs: DigestedRef[];
};

type SourceVoiceOccurrence = {
  id: string;
  sourceVoiceId: string;
  eventRefs: StableEventRef[];
  musicalRange: MusicalRange;
  state: "sounding" | "notated_rest" | "inferred_inactive" | "tacet" | "disputed";
  evidenceRefs: DigestedRef[];
  uncertaintyRefs: DigestedRef[];
  digest: string;
};

type SourceVoiceRelation = {
  id: string;
  kind: "continuation" | "split" | "merge" | "exchange" | "cross_staff" | "ambiguity";
  fromVoiceIds: string[];
  toVoiceIds: string[];
  scope: MusicalRange;
  evidenceRefs: DigestedRef[];
  uncertaintyRefs: DigestedRef[];
};

type SourceVoiceGraph = {
  id: string;
  normalizedScoreRef: DigestedRef;
  voices: SourceVoice[];
  occurrenceRefs: DigestedRef[];
  relations: SourceVoiceRelation[];
  unresolvedEventRefs: StableEventRef[];
  unresolvedIdentityRefs: DigestedRef[];
  digest: string;
};
```

Every voice-bearing Normalized Score event appears in exactly one resolved Source Voice Occurrence or in `unresolvedEventRefs`. Intentional ambiguous membership uses disputed occurrences that name the same uncertainty and may overlap only under an explicit ambiguity relation; silent omission or unexplained duplicate membership invalidates the graph. Every Target Voice source ref resolves through the pinned Source Voice Graph, never implicitly through a part or visible staff. An uncertainty that could change entry order, continuity, bass identity, Principal Voice identity, or a preserved relationship is Critical Uncertainty.

### Lyrics and text underlay

When a source contains sung text or a requested layout includes a vocal line, lyrics are versioned source truth rather than engraving-only strings.

```ts
type LyricSyllable = {
  id: string;
  verseId: string;
  text: string;
  sourceVoiceRef: DigestedRef;
  anchorEventRefs: StableEventRef[];
  boundaryAfter: "word_end" | "hyphen" | "elision" | "none";
  noteExtension: "single_note" | "melisma";
  extenderEndEventRef?: StableEventRef;
  extenderGeometryRef?: DigestedRef;
  language?: string;
  sourceRegionRef: DigestedRef;
  confidence: number;
  uncertaintyRefs: DigestedRef[];
};

type LyricUnderlay = {
  id: string;
  sourceVoiceRef: DigestedRef;
  verseRefs: DigestedRef[];
  syllableRefs: DigestedRef[];
  digest: string;
};
```

OCR and OMR alignment retain verse order, syllable boundaries, hyphens, elisions, extenders, melismas, and source geometry. Underlay uncertainty is Critical when it affects a requested song deliverable, textual phrase, accent, or preserved vocal identity. Faithful Reduction preserves requested text and alignment or records a Policy Exception. Audio Preview need not synthesize words, but score following and lineage retain syllable anchors.

### Musical context, transposition, and spanners

Key signature, tonal or modal interpretation, meter, clef, tempo, pitch reference, and written-to-sounding transposition are time-varying canonical context, not one score-level string.

```ts
type MusicalContextChange = {
  id: string;
  kind:
    | "key_signature"
    | "tonal_or_modal_context"
    | "meter"
    | "clef"
    | "tempo"
    | "pitch_reference"
    | "written_to_sounding";
  scope: MusicalRange;
  valueRef: DigestedRef;
  evidenceRefs: DigestedRef[];
  uncertaintyRefs: DigestedRef[];
};

type PitchMapping = {
  sourceVoiceRefs: DigestedRef[];
  targetVoiceIds: string[];
  scope: MusicalRange;
  chromaticSemitones: number;
  diatonicIntervalRef?: DigestedRef;
  octaveDisplacement: number;
  sourceWrittenToSounding: number;
  targetWrittenToSounding: number;
  capoRef?: DigestedRef;
  scordaturaRef?: DigestedRef;
  fixedPitchConstraintRefs: DigestedRef[];
};

type TranspositionPlan = {
  id: string;
  sourceContextMapRef: DigestedRef;
  targetContextMapRef: DigestedRef;
  mappings: PitchMapping[];
  conflictRefs: DigestedRef[];
  digest: string;
};

type MusicalSpanner = {
  id: string;
  kind: "tie" | "slur" | "phrase" | "arpeggiation";
  startEventRef: StableEventRef;
  intermediateEventRefs: StableEventRef[];
  endEventRef: StableEventRef;
  sourceGeometryRefs: DigestedRef[];
  semanticLayer: "source_notated" | "arrangement_score";
  uncertaintyRefs: DigestedRef[];
  digest: string;
};

type NotatedOrnament = {
  id: string;
  anchorEventRefs: StableEventRef[];
  markRef: DigestedRef;
  requiredNotation: boolean;
  realizationPolicyRef?: DigestedRef;
  uncertaintyRefs: DigestedRef[];
  digest: string;
};
```

A uniform musical transposition may still require distinct per-part written-to-sounding mappings. Enharmonic spelling, internal key or meter changes, fixed vocal range, capo, scordatura, and octave-transposing notation remain explicit. One tie chain has one identity and one uninterrupted Playback Occurrence; intermediate written notes do not reattack. Source-notated ornaments remain source truth even when their sounded realization is an optional Performance Interpretation.

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

type SourceRelationshipObligationGroup = {
  id: string;
  sourceEventRefs: StableEventRef[];
  orderIndex: number;
  timingRelationRef?: DigestedRef;
  requiredTargetSlotIds: string[];
  digest: string;
};

type TargetRelationship = {
  id: string;
  kind: RegisteredMusicalRelationshipKind;
  sourceRelationshipRefs: DigestedRef[];
  participantVoiceIds: string[];
  sourceObligationGroupRefs: DigestedRef[];
  protectedFeatures: RelationshipFeature[];
  activityScope: MusicalRange;
  priority: "invariant" | "structural" | "supporting" | "optional";
  allowedTransformations: TransformationKind[];
  validationProfileRef: DigestedRef;
  evaluatorRequirementRefs: DigestedRef[];
};

type RealizedRelationshipMapping = {
  id: string;
  targetRelationshipRef: DigestedRef;
  sourceObligationGroupRef: DigestedRef;
  targetEventRefs: StableEventRef[];
  targetVoiceIds: string[];
  digest: string;
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
  harmonicPlanRef?: DigestedRef;
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

### Target Harmonic Plan

Every passage whose recognizability or structural behavior depends on harmony receives a Target Harmonic Plan before physical search. Harmonic interpretation remains Validation-Profile-scoped; Roman-numeral function, modal sonority, chord identity, and dissonance treatment are not assumed to be universal equivalents.

```ts
type HarmonicObligation = {
  id: string;
  scope: MusicalRange;
  sourceEventRefs: StableEventRef[];
  interpretationRef: DigestedRef;
  protectedFeatures: Array<
    | "tonal_or_modal_context"
    | "harmonic_rhythm"
    | "bass"
    | "inversion"
    | "sonority"
    | "function"
    | "essential_dissonance"
    | "tendency_resolution"
    | "cadence"
  >;
  priority: "invariant" | "structural" | "supporting" | "optional";
  allowedTransformations: TransformationKind[];
  validationProfileRef: DigestedRef;
  evaluatorRequirementRefs: DigestedRef[];
};

type TargetHarmonicPlan = {
  id: string;
  passageId: string;
  obligations: HarmonicObligation[];
  reharmonizationPolicy: "preserve" | "bounded" | "free";
  conflictRefs: DigestedRef[];
  digest: string;
};
```

Under Faithful Reduction, Vellum protects the source harmonic skeleton—harmonic rhythm, structural bass and inversion, cadential function, and essential dissonance or resolution—unless Analysis establishes that a dimension is nonstructural or a Policy Exception authorizes its change. Correct Principal Voice events cannot compensate for wrong harmony. Baroque-guitar alfabeto selection, lute bass deployment, classical-guitar bass generation, and Continuo planning consume the exact Harmonic Plan.

### Continuo Realization and Disposition Plan

A passage containing a Continuo Foundation receives a Continuo Realization Plan before target search. Canonical Figured Bass preserves source glyph and normalized musical meaning separately, including standalone accidentals, altered or ambiguous signs, stacked order, changes over a held bass, continuation geometry, and uncertainty.

```ts
type FiguredBassSign = {
  id: string;
  sourceGlyphRef: ContentRef;
  normalizedKind:
    | "interval"
    | "accidental_only"
    | "altered_interval"
    | "slash_or_cross"
    | "unknown";
  interval?: number;
  alteration?: "sharp" | "flat" | "natural" | "raised" | "lowered";
  stackIndex: number;
  evidenceRefs: DigestedRef[];
  uncertaintyRefs: DigestedRef[];
  digest: string;
};

type FiguredBassGroup = {
  id: string;
  bassEventRef: StableEventRef;
  onsetOffset: Rational;
  duration?: Rational;
  signRefs: DigestedRef[];
  continuationSpanRefs: DigestedRef[];
  geometryRef: DigestedRef;
  digest: string;
};

type FiguredBassContinuationSpan = {
  id: string;
  sourceGroupRef: DigestedRef;
  bassEventRefs: StableEventRef[];
  scope: MusicalRange;
  geometryRef: DigestedRef;
  uncertaintyRefs: DigestedRef[];
  digest: string;
};

type ContinuoConstraintSegment = {
  id: string;
  scope: MusicalRange;
  foundationEventRefs: StableEventRef[];
  figureGroupRefs: DigestedRef[];
  inferredConstraintRefs: DigestedRef[];
  suspensionObligationRefs: DigestedRef[];
  uncertaintyRefs: DigestedRef[];
  digest: string;
};

type GeneratedRealizationMapping = {
  id: string;
  segmentRef: DigestedRef;
  generatedEventRefs: StableEventRef[];
  generatedVoiceIds: string[];
  satisfiedConstraintRefs: DigestedRef[];
  digest: string;
};

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
  id: string;
  passageId: string;
  foundationEventRefs: StableEventRef[];
  figureGroupRefs: DigestedRef[];
  constraintSegmentRefs: DigestedRef[];
  realizationMappings: GeneratedRealizationMapping[];
  relationshipRefs: DigestedRef[];
  realizationProfileRef: DigestedRef;
  validationProfileRef: DigestedRef;
  disposition: ContinuoDisposition;
  generatedVoiceIds: string[];
  spacingAndDoublingPolicyRef: DigestedRef;
  uncertaintyRefs: DigestedRef[];
  digest: string;
};
```

A chord symbol, alfabeto shape, re-entrant course, pitch-class implication, or upper-octave doubling never counts as sounding an authoritative foundation bass. Complete dispositions require the sounded-foundation set to equal the complete foundation set. Reduction dispositions require sounded and unsounded sets to be disjoint and their union to equal the complete foundation set. An incapable target includes a separate bass or produces a labeled Continuo Reduction. Engraving, playback, lineage, and evaluation retain the same disposition and never synthesize an absent bass while labeling the result complete.

### Intended Technique Plan

Each passage receives an Intended Technique Plan where technique matters.

```ts
type IntendedTechniquePlan = {
  id: string;
  passageId: string;
  techniqueFamilyRef: DigestedRef;
  profileRef: DigestedRef;
  scope: MusicalRange;
  transitionRefs: DigestedRef[];
  requiredResourceRefs: DigestedRef[];
  stateObligationRefs: DigestedRef[];
  notationConsequenceRefs: DigestedRef[];
  playbackConsequenceRefs: DigestedRef[];
  alternativeRefs: DigestedRef[];
  evidenceRefs: DigestedRef[];
  unknownDimensionRefs: DigestedRef[];
  digest: string;
};
```

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

### Instrument Instance authoring and calibration

Exact mechanics are useful only if the Owner can create, inspect, select, and version the Instrument Instance that supplies them. Built-in templates are editable starting points, not measured personal instruments.

Every mechanically relevant field records value, unit, provenance, measurement method, uncertainty, and status as `measured`, `manufacturer_supplied`, `template_default`, `inferred`, or `unknown`. The authoring workflow supports:

- constituent strings and courses, spatial order, tuning, pitch reference, capo, and scordatura;
- scale and vibrating lengths, fret positions, neck and nut width, bridge and plucking-zone spacing, action, and setup;
- handedness and exact two-dimensional left-hand contact geometry;
- diapason, extension, or bass-rider layout and right-hand access geometry;
- notation identity and written-to-sounding behavior;
- photographs or diagrams with a scale reference, plausibility checks, repeated measurement, and Owner confirmation; and
- immutable versioning, default selection, diff, and dependency-aware staleness.

A partial Instrument Instance may support provisional generation. A mechanical, ergonomic, playable, or performance-reliable claim remains incomplete whenever a dimension used by its evaluator is defaulted, inferred, or unknown. Calibration creates a new immutable version and stales dependent searches, evaluations, and readiness evidence. Owner Ergonomic Profiles remain separate from instrument measurement.

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
- realized Target Voice, Harmonic, Relationship, Continuo, and Technique mappings;
- generator-visible Search Measurements and exact Selection Policy identity;
- retained non-dominated alternatives plus bounded representative rejection reasons and binding constraints;
- incoming and outgoing state;
- unknown and not-evaluated dimensions; and
- reproducible search identity.

```ts
type AdoptionDecision = {
  id: string;
  arrangementSearchRef: DigestedRef;
  candidateRef: DigestedRef;
  committedOrderIndex: number;
  evaluationCardRefs: DigestedRef[];
  requiredGatePolicyRef: DigestedRef;
  result: "adopt" | "reject" | "blocked";
  resultingArrangementScoreRef?: DigestedRef;
  rationale: string;
  decidedAt: string;
  digest: string;
};
```

Only `adopt` may create the referenced Arrangement Score, and only when every required applicable independent gate is complete and passing. `reject` records a conclusive candidate failure and may advance evaluation to the next committed survivor. `blocked` records unavailable execution or evidence; that candidate remains pending retry, and no later candidate may be adopted merely because infrastructure failed unless the Owner explicitly abandons the pending candidate or starts a new search. Neither outcome rewrites search order. Adoption is a canonical versioned service and workbench action, not an implicit side effect of storing or ranking a candidate.

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

type ResolvedConstituentAttack = {
  canonicalEventRef: StableEventRef;
  constituentStringId: string;
  soundingPitch: Pitch;
  onsetOffset: Rational;
};

type ResolvedCourseAttack = {
  course: number;
  onsetOffset: Rational;
  constituentAttacks: ResolvedConstituentAttack[];
  exceptionalSelectiveAttackRef?: DigestedRef;
};

type StrummedAttack = {
  kind: "strum";
  onsetOffset: Rational;
  direction: StrokeDirection;
  digitOrGesture: RightHandGesture;
  traversedCourses: number[];
  soundedCourses: number[];
  mutedCourses: number[];
  resolvedCourseAttacks: ResolvedCourseAttack[];
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

The sequence records beat and subdivision, attack order, exact right-hand allocation, stroke path, sounded, omitted, and muted courses, constituent-string sounding pitches, held state, releases, and damping. `traversedCourses` is ordered in physical stroke order; sounded and muted sets are disjoint subsets of it, and every sounded course has exactly one Resolved Course Attack. A normal course attack's constituent set equals the exact Instrument Instance construction; search cannot selectively pluck one member of a doubled course. Selective constituent attack is legal only through an explicit exceptional-technique ref with applicable evidence, notation, playback, and evaluation semantics. Playback consumes canonical constituent attacks rather than independently expanding course numbers. Stroke traversal and simultaneous chord notation do not erase temporal attack order. A batterie or repicco pattern contains its ordered gestures rather than one generic stroke field.

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
- exact stopped-string vibrating lengths and fret positions;
- exact constituent-string and course order and spacing at nut, bridge, and every modeled plucking zone;
- diapason, bass-rider, or extension layout, attachment path, and spatial access;
- neck width, action, setup, pitch reference, and temperament or fret-placement assumptions used by evaluation;
- notation identity per course;
- exact right-hand position and reach inputs rather than an undifferentiated bass-access flag;
- performer and reliability context; and
- applicable historical, modern-pedagogical, and software profiles.

The current editor default may be a thirteen-course D-minor-tuning configuration. It must not be described as the universal historical default.

When plucking-zone or diapason-access geometry is absent, right-hand reach, crossing, and transition readiness remain incomplete. Contrastive tests vary course spacing and bass layout while retaining the same tuning so pitch identity cannot masquerade as physical access.

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

Every acceptance sentence has a versioned Requirement Ledger entry naming observable inputs, hard-gate or rubric status, evaluator identity and implementation boundary, outcome vocabulary, units or threshold where meaningful, uncertainty behavior, contamination role, and authorized human role. Adjectives such as coherent, prominent, supported, idiomatic, equivalent, meaningful, or clear are not executable until such an entry exists. Public repository ledgers may name development mutations directly, but held-out-specific expectations, forbidden outcomes, mutations, reserve order, and exact case identity live only in a Vault Requirement Ledger. The public ledger retains opaque IDs, coverage classes, and digests without resolving hidden truth.

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

Every hard-gate definition declares whether it is required for the applicable case. Per-gate execution status, evidence completeness, and result remain orthogonal. Aggregate status uses this precedence:

- `fail` when any required applicable gate conclusively establishes a product or output violation;
- otherwise `blocked` at the enclosing acceptance level when required execution cannot proceed because a source, Access Decision, provider, evaluator, Vault, or infrastructure dependency is unavailable;
- otherwise `incomplete` when any required gate has unfinished, partial, unknown, or unevaluated evidence; and
- `pass` only when every required applicable gate completed with complete evidence and passed.

`hardGateStatus` is `pass`, `fail`, or `incomplete`; blocking execution is recorded on the affected gate and aggregated as `acceptanceStatus: blocked` unless a conclusive required failure already establishes `fail`. The enclosing `acceptanceStatus` is `pass`, `fail`, `blocked`, or `incomplete`. Neither blocked nor incomplete can be presented as pass.

Unknown is never converted to pass. The UI may say `no failure observed` for incomplete evidence, but not `hard gates pass`. Arrangement Readiness cannot be ready while hard-gate status is incomplete.

### Dataset assignments and contamination groups

A dataset role belongs to the tuple of contamination-group identity, exact Generation System consumer closure or evaluator consumer, exact consumer version, and immutable split-manifest identity. It does not belong globally to a file or one nominal compiler.

```ts
type QualificationClaimScope = {
  id: string;
  targetProfileRefs: DigestedRef[];
  sourceModalityRefs: DigestedRef[];
  textureAndTechniqueRefs: DigestedRef[];
  instrumentConfigurationRefs: DigestedRef[];
  notationAndPlaybackDimensionRefs: DigestedRef[];
  performanceAcceptanceProfileRefs: DigestedRef[];
  providerConditionRefs: DigestedRef[];
  coveredRequirementRefs: DigestedRef[];
  exclusionRefs: DigestedRef[];
  unknownOrUnclaimedDimensionRefs: DigestedRef[];
  digest: string;
};

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
  curatorIdentityRef: DigestedRef;
  predecessorManifestRef?: DigestedRef;
  inheritedRegressionRefs: DigestedRef[];
  inheritedReserveCursorRef?: DigestedRef;
  holdoutRunLedgerGenesisRef: DigestedRef;
  frozenAt: string;
  digest: string;
};

type HoldoutRunLedgerGenesis = {
  id: string;
  splitManifestId: string;
  createdAt: string;
  digest: string;
};

type HoldoutAttempt = {
  id: string;
  splitManifestRef: DigestedRef;
  selectionOrdinal: number;
  contaminationGroupRef: DigestedRef;
  previousAttemptRef?: DigestedRef;
  generationSystemRef: DigestedRef;
  generatedOutputRefs: DigestedRef[];
  exposureSnapshotRefs: DigestedRef[];
  evaluationCardRefs: DigestedRef[];
  startedAt: string;
  completedAt?: string;
  acceptanceStatus: "pass" | "fail" | "blocked" | "incomplete";
  validity: { kind: "valid" } | { kind: "invalid"; invalidationDecisionRef: DigestedRef };
  regressionDisposition:
    | { kind: "still_held_out" }
    | { kind: "permanent_regression"; regressionCaseRef: DigestedRef };
  digest: string;
};

type HoldoutRunLedger = {
  id: string;
  splitManifestRef: DigestedRef;
  genesisRef: DigestedRef;
  previousLedgerOrGenesisRef: DigestedRef;
  orderedAttemptRefs: DigestedRef[];
  finalizedAt?: string;
  digest: string;
};
```

The Vault Split Manifest precommits exactly one Holdout Run Ledger genesis. The Vault enforces one compare-and-swap current head for that manifest; every ledger version descends from the genesis through a required predecessor ref, every fork remains retained, and an unreconciled fork invalidates qualification. The Vault Requirement Ledger, Holdout Attempts, invalidation decisions, genesis, ledger versions, and head live inside the Owner Evaluation Vault. Ordinary generation receives none of them; the evaluator exposes only the source envelope selected by the committed manifest. Every attempt, including blocked, incomplete, failed, and invalid attempts, is appended in manifest-derived order. A valid failure references a permanent regression; invalid attempts cannot count as passes. Capability Qualification pins a finalized head proven to descend from the precommitted genesis. A successor manifest inherits accumulated regressions and the predecessor's unconsumed reserve cursor and cannot reseed or reorder that remainder.

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
- collapse of two source voices sharing one part or staff, cross-staff identity loss, or a wrong voice exchange;
- harmonic-rhythm, bass, inversion, essential-dissonance, tendency-resolution, or cadence corruption despite a preserved melody;
- a wrong part-scoped written-to-sounding mapping, internal key or meter change, capo, or scordatura mapping;
- a multi-segment tie retrigger, lost slur, or source-notated ornament silently discarded;
- lyric verse, syllable, hyphen, elision, melisma, or event-alignment corruption when text is in scope;
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
- a course mask with missing, duplicated, or octave-corrupted constituent-string attacks;
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

### Coequal Golden Engraving and Playback Fixtures

Each initial target has an exact semantic-to-rendered-to-sounding fixture:

- **baroque guitar**: punteado allocation, alfabeto binding, ordered up- and down-strokes, course suppression, octave-paired constituent pitches, held harmony, release, and damping;
- **baroque lute**: the accepted diapason fixture plus a stopped doubled-course and stopped-course-to-diapason right-hand transition; and
- **classical guitar**: independent voices with planned rests, stems, multi-segment ties, voice crossing, written-to-sounding octave identity, and isolated Playback Parts.

Tests inspect canonical semantic events, generated notation semantics, rendered PDF or SVG glyphs and placement, Playback Occurrences, sounding pitches, held and damped state, and duplicate prevention. Non-empty notation, matching pitch classes, or successful LilyPond compilation is insufficient.

### Content-addressed regression contracts

Every named regression resolves to an immutable bundle rather than a tune title or anecdote. The bundle pins source and reviewed truth, Analysis, Arrangement and Performance Briefs, Preservation Policy, Applied Knowledge Manifest, Instrument Instance, notation, scoped events, required observations, forbidden outcomes, mutations, evaluators, review roles, and one digest.

Different plausible schools or profiles produce separate candidate families or bundles; a generator may not source-hop among incompatible authorities to pass. Required observations and forbidden outcomes are evaluator-only. Production code may not special-case a Work title, bundle ID, or expected fingering.

The Greensleeves bundles pin the observed baroque-guitar course/fret transition and Gesture Sequences; the lute `f` and `b` letters, course identities, physical context, and reviewed closer realization; and every classical-guitar structural-voice mapping, active span, rest, cadence, function, and duration obligation. Adding incoherent filler, reporting search exhaustion, or finding another cosmetic fingering cannot pass.

### Development regressions and held-out acceptance

Greensleeves is permanently development and regression evidence for all three target compilers. It exercises shared plumbing and the three known failures; it is never held-out evidence and cannot establish generalization.

Visible repository fixtures remain contract and development evidence. Assets held out from Vellum development, prompt authoring, fitting, and evaluator calibration, together with reviewed truth, evaluator-only expectations, mutations, invalidation decisions, reserve order or seed, per-attempt diagnostics, and split manifests, live outside Git and outside the ordinary workspace/content-store read capability in the Owner Evaluation Vault. Repository code and public tracer artifacts may retain only opaque case IDs, content digests, coverage requirements, aggregate statuses, and redacted evidence—not hidden answers or identities. Public manifests bind Vault artifacts by digest without resolving them. Repository verification rejects reserve identities, hidden expectations, mutations, answers, or unredacted held-out diagnostics. A narrow evaluation orchestrator releases the source input—not its labels—to the sealed generation process only when a held-out run begins; the generation process has no filesystem, database, environment, or API capability that can enumerate the Vault or its reserves.

The Vault has a separate least-privilege capability boundary, authenticated encryption at rest, atomic durable writes, versioned schema migrations, integrity scans, an explicit encrypted-backup and backup-exclusion policy, restore verification, retention and purge controls, and redacted operational telemetry. Ordinary workspace, development-agent, search-index, backup, logging, and diagnostic capabilities cannot enumerate it. Corruption, unavailable keys, failed migration, or unavailable storage produces blocked acceptance, never an empty-pool pass. Every released source envelope and administrative read enters the exposure ledger.

This is a product-development isolation claim, not a claim that a Work was absent from a pretrained model's corpus. Every run records provider, model, account or project, session, retention and training policy when knowable, prior-call exposure, prompt digest, and whether execution was provider-free. Every Capability Qualification pins a Qualification Execution Policy declaring deterministic/provider-free or stochastic execution. Stochastic execution precommits sample count, seeds or isolated sessions, retry treatment, retained-output policy, confidence rule, and tolerated hard-failure rate; every attempt counts and is retained, and one favorable sample cannot qualify capability. If a provider exposes no immutable deployment revision, qualification is explicitly time- or sentinel-bounded. Semantic drift, deployment change, failed sentinel checks, or changed retention or session behavior stales qualification and requires fresh precommitted evaluation.

Initial release acceptance contains at least two independent, non-Greensleeves contamination groups per target:

- baroque guitar covers supported punteado allocation and a supported rasgueado or mixed-style transition, including exact two-dimensional course-and-fret reach, Gesture Sequences, stroke masks, course masks, and alfabeto applicability;
- baroque lute covers stopped-course polyphony plus explicit digit allocation, simultaneous attacks, alternation, course crossing, thumb behavior, stopped-course-to-diapason transitions, diapason succession, resonance, damping, and exact French tablature;
- classical guitar covers coherent two-voice writing plus independent three-voice or contrapuntal writing.

Dedicated non-Greensleeves shared-contract groups cover a soprano-plus-figured-bass source with an accidental and prepared suspension, and a three-voice imitative source whose identity depends on ordered entries. At least one held-out case per target begins with a legally usable PDF or image and exercises ingestion through deliverables; compiler-isolation cases may begin from independently reviewed canonical transcription.

Holdout selection is a blinded curation task. Sources must be legally usable, absent from derivation, development, fitting, evaluator calibration, prompt examples, and pack examples, and grouped with all near duplicates and derivatives. The source pool deliberately varies key, meter, Texture, technique, stringing or tuning, density, and performance context and includes contrastive cases in which an attractive idiom is inapplicable.

Holdout independence and musical authority are separate. The split curator controls eligibility and coverage but does not thereby certify musical truth. Every gate and reviewed expectation identifies a scope-qualified truth reviewer, evaluator implementer, evaluator calibrator, and run operator under a conflict-of-role policy. Target idiom truth requires corresponding target-instrument authority; Continuo, counterpoint, lyrics, and engraving truth require their corresponding musical or editorial authority. Calibration consumes calibration-role evidence only. Unresolved reviewer disagreement yields incomplete evidence, never a passing gate.

The tracked specification intentionally names coverage classes rather than the exact held-out Works. Publishing their identities, reviewed truth, or expected repairs in the normal repository would make them development targets. Before any system output is observed, an independent curator commits inside the Vault the eligible pool, contamination closures, invalid-fixture policy, reserve order or deterministic selection seed, coverage assignment, and exhaustion rule. The split-manifest digest is frozen before the relevant Generation System versions are run. Invalidation requires a reason permitted by the frozen policy and independent of the candidate output or observed evaluation outcome. The reason may concern source corruption, identity, rights, reviewed truth, or evaluator validity. An immutable decision records adjudicator, policy, evidence, time, and affected attempt; the attempt remains in history and replacement follows the precommitted reserve sequence.

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

The canonical seed is Francesco Gasparini, [L'armonico pratico al cimbalo](https://www.loc.gov/item/05004057/) (Venice, 1708), Library of Congress Music Division, LCCN 05004057. Its keyboard dispositions, doublings, economical motion, figured dissonance preparation and resolution, accompaniment density, cadences, and ornamented realizations can support a scoped `continuo.italian-baroque.cembalo` development profile after cited extraction and review. The first exact target is a harpsichord or cembalo Instrument Instance; spinet and organ behavior require separately scoped profiles. A modern-piano result is an explicitly named editorial adaptation that may compose historical harmonic constraints with modern-piano mechanics but cannot inherit Gasparini's target-instrument authority. The 1764 manifestation may assist OCR and comparison but does not replace the 1708 manifestation identity. Gasparini is derivation and development evidence and is excluded, with its contamination group, from held-out Continuo acceptance.

### First extraction fixtures

1. Mace: preserve the exact ordered sequence a, /a, //a, ///a, 4, 5 and refuse to infer a thirteenth symbol.
2. Sanz: extract rules and examples that prevent an unscoped universal three-finger rule.
3. Corbetta: represent stroke path, sounding courses, suppression, held harmony, and notation ambiguity independently.
4. Carulli: align a source texture with its guitar reduction and propose retain, omit, octave, rhythm, and accompaniment transformations.
5. Weiss: retain image geometry while extracting descriptive tablature and bass observations only.
6. Sor: link text assertions to separate plates and distinguish the 1830 edition from the Harrison rewrite.
7. Gasparini: retain Chapters II, IV, and VII–X as separately citable segments and extract keyboard disposition, doubling, motion, density, and figured-dissonance candidates without treating noisy OCR as reviewed truth.

One source per target proves plumbing, not idiomatic authority.

## Performance and operability acceptance

Correctness on short fixtures does not establish usefulness on a real score or an accumulated library. Versioned Performance Acceptance Profiles bind exact hardware/runtime classes, reference and stress workloads, thresholds, measurement methods, and result digests.

The initial workload set includes:

- a short interactive excerpt through PDF review and all three target siblings;
- a multi-page SATB source with changing context, repeats, lyrics where present, and all three targets;
- a complete representative work exercising section-level backtracking, interruption, checkpoint, reload, and resume;
- a mature Reviewed Knowledge Library containing enough releases, profiles, conflicts, advisories, and inapplicable entries to exercise complete enumeration rather than an empty or toy catalog; and
- adversarial high-density passages and an oversized library that may legitimately exhaust a declared budget.

Each profile records maximum wall time by workflow stage, peak memory, persisted bytes, Inventory, Catalog and Manifest size, candidate frontier and checkpoint size, cancellation response, checkpoint interval, resume overhead, and redacted diagnostic limits. Before measuring a baseline, Slice 0 commits the release-floor derivation algorithm, safety margins, supported hardware classes, workload generators, and measurement method. It then applies that policy exactly to the recorded clean baseline and pins `performance.release-floor.v1` before optimization or qualification output is observed. A later profile may support a narrower claim, but it cannot replace or satisfy that mandatory release floor. Changing the floor after results exist requires an explicit Owner-approved specification decision, preserves the original failure and comparison, and invalidates any broader claim rather than shopping for a passing threshold.

Inventory and Catalog Snapshots are shared by digest across passages. Context-specific manifests may factor shared snapshots and reusable completeness proofs but cannot weaken authoritative enumeration. Applicability evaluation is incremental over immutable dependency closures, and phrase or section search retains bounded frontiers and resumable checkpoints. Reference workloads must complete or return an actionable musical conflict within their profile. Stress exhaustion is acceptable only when `budget_exhausted`, cancellation, checkpointing, resume, retained alternatives, and user presentation remain correct; exhaustion cannot masquerade as infeasibility or success.

## Execution sequence

Implementation proceeds through production-path tracer bullets. Each tracer begins with a failing output-level or contract-level case, crosses the real canonical path, and ends with a demoable Owner outcome.

### Slice 0 — Specification and baseline guard

- Make this document the sole current specification.
- Align `CONTEXT.md`, ADRs 0004, 0015, and 0018–0022, `AGENTS.md`, and issue-tracker guidance with this specification before deriving the wave.
- Freeze earlier documents as history.
- Correct active domain and README claims that overstate historical authority or prototype playability.
- Verify that the completed prototype evidence remains intact.
- Disable the generic client-supplied production provider stream or bind it to server-minted Model Action, Egress Envelope, and Result Commit enforcement before private reference ingestion; add forged-context, cross-workspace, prompt-injection, destination-substitution, tool-capability escalation, denied-egress, mismatched-response, and unrelated-canonical-result tests.
- Inventory tracked source-derived code, tests, fixtures, prompts, and Git history. Quarantine the Tyler-derived universal chart and Foscarini overlay from production defaults pending exact repository-inclusion and redistribution decisions, record already-pushed copies as irreversible prior disclosure, and prefer reviewed public-domain primary-source data or an authorized local pack.
- Add red contract guards for one-part/multiple-voice source data, changing key or meter, per-part written-to-sounding mapping, multi-segment ties, figure changes and continuations, and the current semitone-only Transposition Plan.
- Separate tri-state `hardGateStatus` from four-state `acceptanceStatus`, enforce aggregate precedence, and remove every false `hard gates pass` presentation.
- Enforce evaluator-input and public-repository held-out-data canaries so later evaluation work cannot build on the current porous executor or ledger boundary.
- Commit the release-floor derivation policy before measuring, then deterministically derive and commit `performance.release-floor.v1`, its supported hardware classes and numeric thresholds, and the per-tracer gate-matrix schema from the recorded clean baseline before optimization begins.

### Slice 1 — Source identity and safe migration

- Introduce versioned identity assertions, Works, Source Manifestations, Exemplars, immutable Digital Assets, acquisition records, Source Segment Versions, rights assertions, and Access Decisions.
- Implement shared content-addressed bytes with acquisition-edge provenance and role-specific Arrangement Source, Owner Reference, and Evaluation Source bindings; deletion and rights resolution operate on provenance paths rather than whichever identical byte arrived last.
- Preserve each OwnerReference as an immutable legacy record with a permanent mapping, migration journal, collision and unresolved-identity quarantine, and exact byte and hash verification.
- Build the immutable Authority Path Inventory over legacy claims and packs plus prompts, tool descriptions and defaults, built-in tables and charts, compiler branches, rankers, validators, constants, and presentation labels. Classify or quarantine each path and add old/new compatibility readers and shadow resolution without changing production activation.
- Establish the transactional publication-generation store, stable snapshot reads, concurrent-writer protection, crash recovery, and compare-and-swap head before canonical writers rely on it.
- Make migration transactional, idempotent, resumable, dry-runnable, and rollback-safe; never manufacture missing Work, date, edition, provenance, rights, or review authority, and prove rollback before cutover.
- Default migrated private content to no provider egress, fixture inclusion, or redistribution.
- Exercise both acquisition orderings for duplicate bytes with different rights, deletion of either acquisition, incomplete and composite identity, interruption, rollback, rerun, stable snapshot reads, compatibility reads, and attempts to reactivate quarantined legacy knowledge through an old code path.
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

- Add typed evidence edges and stable predicate identities, orthogonal candidate axes, lane-compatible derivation relations, immutable releases, credential-backed external reviewer and verifier authority, advisories, required discriminated Activation Authority, Activation Decisions, and centrally governed Resolution Policy.
- Produce a test-only release with profiles, examples, counterexamples, derivations, and declarative mappings.
- Resolve it into an Applied Knowledge Manifest.
- Rebuild an authoritative Knowledge Library Inventory, derive an exact Catalog, and recompute manifest completeness against those and the Component Registry Snapshot; detect an omitted inventoried release, eligibility outcome, profile, or dependency.
- Run one visible arrangement consequence only in explicit provisional-research mode and prove that default Guided Start cannot activate it or claim readiness.
- Record exact Inventory, Catalog, Activation Decision, component, and manifest digests in Arrangement Search and Evaluation Run identity.
- Prove that unknown, excluded, conflicting, retracted, and unavailable-source states remain distinct.
- Prove that verified and out-of-scope authority always carries evaluated and authorization scopes, unverified or revoked records carry none, and missing scope, credential intersection, expiry, revocation, or clock-policy mismatch fails closed and publishes the required successor decision.
- Reconcile every Authority Path Inventory entry against the Component Registry and Applied Knowledge Manifest; disable any nonmechanical path absent from both and add static and runtime bypass detection.
- Activate the new resolver and disable legacy activation in one transactional cutover only after compatible readers, migration validation, shadow comparison, post-cutover integrity checks, and tested rollback pass. No tracer may introduce a canonical writer before compatible readers and migration exist or disable a production path before its replacement is active.
- Crash after every staged publication write and before and after head commit; test concurrent upload, review, advisory, and activation writers, stale-head rejection, orphan recovery, and snapshot-consistent Inventory and Catalog rebuilding.
- Prove that maintainer-reviewed-system authority enables an explicitly nonhistorical software or editorial default while absent, mixed, test-only, Owner-local, or out-of-scope authority cannot produce an ordinary or historically presented result.

### Slice 4 — Evaluation contracts, isolation, and vault

- Migrate old Cards and baselines without reinterpreting prior proxy dimensions; incompatible comparisons say so.
- Enforce the Generation Input Envelope and evaluator-only store in a separate process.
- Add tri-state hard gates, precedence-governed four-state acceptance, Generation-System-scoped contamination groups, split manifests, append-only Holdout Run Ledgers, provider and session exposure history, and inherited precommitted reserve ordering.
- Add Search Measurement and Selection Policy contracts separately from Evaluation Cards, plus canonical Adoption Decision storage and workflow.
- Create the encrypted, schema-versioned Owner Evaluation Vault outside Git under a separate capability boundary; prove canary isolation from generation, workspaces, development agents, indexing, backups, logs, and diagnostics and verify integrity, restore, key failure, migration, retention, and purge behavior.
- Enforce the public-ledger/Vault-ledger split and repository leak scanner.
- Add qualified truth-reviewer, curator, evaluator-implementer, calibrator, and run-operator role contracts plus deterministic and stochastic Qualification Execution Policies and opaque-provider drift expiry.
- Add evaluator contracts and mutations for Source Voice identity, Harmonic Plans, exact Transposition, Figure spans, lyrics, spanners, constituent-string attacks, and all three target engraving fixtures.
- Validate the framework with synthetic contract cases; target musical evaluators remain owned by their verticals.

### Slice 5 — Shared voice, relationship, and phrase intelligence

- Add Source Voice Graphs, Lyric Underlays, time-varying Musical Context maps, exact Transposition Plans, canonical spanners and source-notated ornaments.
- Add separately identified and digested Target Voice, Target Harmonic, Target Relationship, Continuo Realization and Disposition, and Intended Technique Plans plus realized candidate mappings.
- Add Instrument Instance authoring, measurement, calibration, versioning, default selection, exact ergonomic context, activity spans and planned rests, phrase boundary state, and work-level obligations.
- Replace event-local musical selection with bounded phrase search and honest terminal outcomes.
- Compile Principal Voice, source and target voice identity, harmonic skeleton, bass, counterpoint, figures, Continuo Foundation, cadence, lyrics where applicable, target texture, and technique into observable constraints and independent evaluator requirements.
- Implement explicit candidate Adoption Decisions so ranking or persistence cannot promote a candidate before independent required gates pass.

### Slice 6 — Continuo relationship vertical

- Carry Gasparini source segments and the legally usable soprano-plus-figured-bass Golden Fixture through optical import, reviewed bass and figure truth, a source-backed `continuo.italian-baroque.cembalo` Realization Profile, Applied Manifest, Voice, Harmonic, Relationship, and Continuo Plans, search, engraving, isolated playback, audit, and independent evaluation.
- Produce a complete soprano-plus-harpsichord realization for an exact Instrument Instance and policy-contract cases for complete, separate-bass, and correctly rejected or explicitly labeled Continuo Reduction dispositions without presupposing an unrepaired fretted-target compiler. Treat any piano deliverable as a separately named modern editorial adaptation.
- Implement canonical Figure Signs, Groups, continuation spans, constraint segments, and generated-realization mappings. Mutate every foundation event, figure, accidental, alignment, change over a held bass, continuation, prepared 4-3 suspension, generated voice, and disposition outside generation's view.

### Slice 7 — Imitative-counterpoint relationship vertical

- Carry the legally usable three-voice imitative Golden Fixture through Analysis, Validation Profile, Applied Manifest, Voice and Relationship Plans, the existing six-course Renaissance-lute path, engraving, isolated playback, audit, and independent evaluation.
- Preserve ordered entries, subject interval-rhythm shapes, voice continuities and exchanges, and cadential goals without inventing one permanent Principal Voice.
- Mutate entry order, subject shape, relationship timing, voice identity, and cadence placement outside generation's view.

### Slice 8 — Baroque-guitar development vertical

1. Preserve the exact known-bad Greensleeves output and prove that independent evaluators reject its voice, two-dimensional course-and-fret reach, allocation, stroke-mask, Gesture Sequence, and transition failures.
2. Run one reviewed Sanz or Corbetta path into a test-only historical release and a separately classified maintainer-reviewed nonhistorical production consequence, implement exact two-dimensional left-hand contact and transition geometry plus orthogonal punteado, rasgueado, alfabeto, mixed-style, course-allocation, resolved constituent attacks, resonance, and gesture semantics, and repair the production search, engraving, playback, and workbench paths.
3. Apply the shared Continuo disposition contract to baroque guitar and prove that any incomplete foundation receives an explicit separate bass or correctly labeled reduction rather than a false complete realization.
4. Pass the development Regression Bundle and baroque-guitar Golden Engraving and Playback Fixture without activating test-only knowledge in default Guided Start.

### Slice 9 — Baroque-lute development vertical

1. Preserve the exact known-bad Greensleeves output and prove that independent evaluators reject its pinned `f` and `b` reach, course, transition, notation, and playback failures; add mutations that reject impossible digit allocation, stopped-course simultaneity, alternation, crossing, thumb behavior, and stopped-course-to-diapason transitions.
2. Run Mace plus one normative and one repertoire path into scoped test-only historical releases and a separately classified maintainer-reviewed nonhistorical production consequence; implement two-dimensional left-hand geometry and calibrated plucking-zone, course-spacing, diapason or bass-rider geometry plus whole-instrument right-hand allocation, preparation, simultaneity, alternation, crossing, thumb, transition, resonance, and damping state.
3. Re-run the accepted Golden Engraving Fixture for course 10 `///a`/D2, Bass Tuning invariance, the full `a`, `/a`, `//a`, `///a`, `4`, `5` sequence, below-staff glyph placement, MIDI identity, absence of duplicate playback, a stopped doubled-course attack, and a stopped-course-to-diapason transition.
4. Pass the development Regression Bundle while treating course-13 historical notation as `not_claimed` under the editorial profile or unresolved under a historically scoped profile.

### Slice 10 — Classical-guitar development vertical

1. Preserve the disappearing-bass output and prove that evaluators reject its activity-span, relationship, cadence, duration, mechanics, notation, and playback failures.
2. Run Sor plus one Carulli aligned reduction into scoped test-only historical releases and a separately classified maintainer-reviewed nonhistorical production consequence, implement exact joint left- and right-hand polyphonic phrase search, and repair first-class standard notation and isolated playback.
3. Pass the development Regression Bundle and classical-guitar Golden Engraving and Playback Fixture, including planned rests, stems, multi-segment ties, voice crossing, and written-to-sounding octave identity, without using event count or continuous sound as a proxy for coherent voice.

Slices 8 through 10 are coequal target siblings. Slice 8 steps 1–2 and Slices 9–10 may proceed independently after Slice 5; Slice 8 step 3 depends on the shared Continuo contract in Slice 6, and its step 4 depends on step 3. Each numbered red, repair, and development-acceptance step is a separate tracer committed before its dependent step.

### Slice 11 — Reassessment, reviewed learning, and recovery

- Ingest corroborating and conflicting sources and support comparison, qualification, contradiction, supersession, advisory, retraction, rights change, and research questions.
- Produce affected-arrangement Reassessments without mutation or automatic authority.
- Classify edits, playtests, feedback, and evaluator disagreements and propose—but do not auto-activate—Personal Defaults, Ergonomic Profiles, Knowledge Candidates, Calibration Candidates, and fixtures.
- Add release and attestation diff, advisory and deletion workflow, affected-workspace navigation, exact resume, and derivative purge tests.
- Preserve legacy searches without invented manifests and offer canonical regeneration.

### Slice 12 — Qualification infrastructure and sealed-run readiness

- Complete every machine-executable implementation, development regression, isolation, security, migration, target-specific engraving and playback, and mandatory release-floor performance gate.
- Exercise the complete sealed-run protocol with synthetic and disclosed development cases, including ledger genesis and CAS head enforcement, invalidation, fork detection, inherited regressions and reserve cursor, stochastic policy, provider-drift sentinel, cancellation, retry, and redacted reporting.
- Exercise the real PDF-to-three-target Guided Start path with consequential review, alternatives, score following, isolation, manual edit adoption, version history, interruption, reload, retry of incomplete siblings only, and complete deliverable rehydration using development evidence.
- Produce a `ready-for-human` Vault curation and truth-review package containing role requirements, conflict-of-role policy, coverage classes, acquisition and rights workflow, review tooling, invalidation policy, reserve protocol, and exact frozen candidate Generation System and evaluator identities without preselecting or exposing future held-out Works to development.
- Prove that no real held-out attempt can begin until the independent Slice 13 commitments exist.

### Slice 13 — Late holdout curation and sealed machine qualification

This is the first HITL boundary. All machine-executable implementation work is sequenced before it; after the required independent commitments, the sealed run and reporting proceed automatically.

- Before any candidate output is observed, an independent curator commits the legally usable eligible pool, contamination closures, output-independent invalid-fixture policy, reserve order or selection seed, coverage assignment, exhaustion rule, role-conflict policy, ledger genesis, and inherited regression and reserve state in the Owner Evaluation Vault without exposing evaluator truth to generation or development.
- Scope-qualified truth reviewers independently review case truth and gate definitions; they are verified separately from the curator, evaluator implementer, calibrator, and run operator.
- Freeze compiler, pack, Resolution and Selection Policy, evaluator, Qualification Execution Policy, split-manifest, provider or provider-free runtime, and performance-profile versions.
- Run at least two non-Greensleeves groups per target plus the dedicated Continuo and imitative groups.
- Every attempted group enters the append-only ledger. Every valid failed group remains disclosed and becomes a permanent required regression; after repair, the successor inherits all accumulated failures and the unconsumed reserve cursor and must pass those failures plus the next precommitted reserve groups held out from Vellum development.
- Emit tri-state hard-gate and four-state acceptance Evaluation Cards plus compatible or explicitly incomparable baseline results, exact Qualification Claim Scopes, and provider or deterministic-execution validity boundaries.
- Machine Complete is reached only when the sealed qualifications and all mandatory release-floor gates pass.

### Slice 14 — Late human review and release remediation loop

The exact-digest artifact review package includes:

- metadata and rights review;
- source transcription and extraction review;
- historical-claim and pack-profile review by declared role;
- verified reviewer identity, credential, scope, freshness, and revocation evidence for every authority-bearing review;
- Source Voice, Harmonic, Transposition, lyric and spanner review wherever those dimensions are in scope;
- target-player physical playtests for all three instruments;
- qualified historical keyboard-continuo review of the exact soprano-plus-harpsichord realization and separate modern-piano review only if that editorial adaptation is produced;
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
- unauthorized provider egress, fixture inclusion, logs, reports, exports, and redistribution are blocked across the complete derivative graph; every remote request is reconstructed from a server-minted Egress Envelope rather than arbitrary client context, and every committed provider result is bound to the exact attempt, response, tools, validation, inputs, and canonical output by a server-issued Result Commit;
- no tracked code, test, fixture, prompt example, or built-in table contains source-derived material without an exact provenance path and repository-inclusion and redistribution decision;
- hostile and oversized acquisition, parser, rendering, pack-parameter, and content-reference cases fail safely within resource bounds;
- every Arrangement Search that claims historical, editorial, pedagogical, or software-guided behavior records a complete Applied Knowledge Manifest over an exact Catalog, Resolution Policy, and Component Registry Snapshot;
- every authority-affecting prompt, table, default, compiler branch, ranker, validator, and presentation label appears in the exact Authority Path Inventory and resolves through the Component Registry and Applied Knowledge Manifest or is mechanically classified with evidence;
- omitted eligible packs, dependencies, conflicts, exclusions, Activation Authorities, rights decisions, or authority paths invalidate a manifest;
- no release activated only by a test-only attestation is active in default or machine-ready output;
- explicitly nonhistorical maintainer-reviewed software or editorial defaults can power ordinary output without being mislabeled historical or specialist-reviewed;
- Source Voice Graphs distinguish voices from parts and staves, and Principal Voice preservation works by default under the exact time- and part-scoped Transposition Plan without a specialist prompt;
- Target Voice, Harmonic, and Relationship Plans prevent structural voices, rests, entries, harmony, inversion, suspensions, bass functions, and cadential relationships from disappearing silently;
- requested song outputs preserve versioned lyric underlay, and canonical ties, slurs, and source-notated ornaments retain notation, lineage, and playback semantics;
- the figured-bass Golden Fixture traverses canonical Figure Signs, Groups, continuation spans, constraint segments, generated mappings, the new pack, manifest, Voice, Harmonic, Relationship, Continuo Realization, and Disposition contracts and passes every required mutation;
- the imitative-counterpoint Golden Fixture traverses the same contracts and preserves ordered entries and subject relationships without assuming one Principal Voice;
- instrument mechanics, ergonomics, historical evidence, modern pedagogy, editorial convention, software heuristics, personal preference, and evaluation remain distinct;
- the Owner can author, calibrate, version, select, and inspect exact Instrument Instances; a missing evaluator input produces incomplete physical evidence rather than a default-derived pass;
- the three exact Greensleeves regressions fail before repair and pass afterward as development evidence;
- each target passes at least two sealed non-Greensleeves contamination groups, and dedicated Continuo and imitative groups pass;
- every Capability Qualification and UI label states its exact Claim Scope, exclusions, provider conditions, workload envelope, and unclaimed dimensions rather than implying universal target qualification;
- baroque-guitar output realizes exact two-dimensional course-and-fret contacts and transitions plus supported orthogonal attack, gesture, alfabeto, course-allocation, constituent-string, resonance, and damping facets rather than a mislabeled flat mode;
- baroque-lute output rejects the known reach; realizes explicit right-hand digit allocation, preparation, simultaneity, alternation, crossing, thumb behavior, calibrated plucking-zone and diapason access, and stopped-course/diapason transitions; models diapasons independently; and labels every course-13 convention as historical, editorial, or unknown according to direct evidence;
- the three coequal Golden Engraving and Playback Fixtures pass target-specific semantic, glyph, placement, constituent-string, written-to-sounding, voice-layer, tie, MIDI identity, and duplicate-playback checks;
- classical-guitar output provides coherent planned voices, exact joint-hand state, multi-voice rests and spanners, and first-class standard notation;
- notation and playback agree with canonical notes, written and sounding pitch, voices, positions, constituent strings, gesture timing, held and damped state, and Performed Form;
- generation is technically unable to read evaluator-only expectations, mutations, baselines, labels, or vault contents outside its sealed source envelope;
- the public repository contains no resolvable held-out identity, truth, mutation, invalidation, reserve order, or diagnostic, and the encrypted Vault passes isolation, integrity, backup, restore, migration, retention, purge, and exposure-ledger tests;
- every held-out attempt appears in a finalized append-only ledger, every valid failure remains a permanent regression, successors inherit the unconsumed reserve cursor, and qualified truth and evaluator roles are independently verified;
- stochastic qualifications satisfy their precommitted repeated-trial and confidence policy, and opaque-provider qualifications remain within their pinned sentinel or expiry boundary;
- hard-gate status passes only when every required applicable gate completed and passed;
- aggregate acceptance precedence reports conclusive violations as fail, otherwise unavailable required dependencies as blocked, otherwise unfinished evidence as incomplete; none is displayed as pass;
- default candidate selection records Search Measurements and Selection Policy rather than using hidden totals or held-out evaluation, and only a passing immutable Adoption Decision creates the default Arrangement Score;
- bounded search distinguishes `unsat_proven`, `budget_exhausted`, `cancelled`, and `infrastructure_failed` from `found`;
- all pinned Performance Acceptance Profiles and tracer-applicable build, browser, evaluation, rendering, playback, security, migration, and real-tool gates pass;
- the real-browser PDF-to-three-target workflow is resumable, rehydrates completed siblings, retries only incomplete work, avoids duplicate versions, and opens the selected score;
- material alternatives, conflicts, compromises, activation modes, and unknowns remain visible; and
- complete typecheck, test, formatting, specification, evaluation, rendering, playback, security, migration, and relevant real-tool gates pass.

### Release Complete

- every historical or specialist presentation has a current credential-backed, externally verified, scope-appropriate attestation over the exact release and claim or profile scope;
- every released target artifact cites a current compatible Capability Qualification over its exact Generation System and profile closure;
- exact-digest target-player playtests are current for all three target outputs under their pinned Instrument Instances and Performance Briefs;
- each target has a separately qualified, profile-specific idiom review; a novice Owner playtest remains personal ergonomic evidence rather than historical authority;
- the harpsichord Continuo and imitative outputs have qualified profile- and target-specific musical reviews of source voices, harmonic plan, spacing, doubling, voice leading, disposition, and contrapuntal realization as applicable;
- requested sung-text outputs have qualified underlay review when textual alignment is a claimed dimension;
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
