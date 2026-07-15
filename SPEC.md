# Vellum Instrument Intelligence

Status: Current and authoritative next-work specification

Effective: 2026-07-13

## Authority and reading order

<!-- II-CLAUSE-0001 --> This is the only current implementation specification in the repository.

<!-- II-CLAUSE-0002 --> The reading order is:

1. <!-- II-CLAUSE-0003 --> [CONTEXT.md](./CONTEXT.md) defines Vellum's domain language and enduring invariants.
2. <!-- II-CLAUSE-0004 --> Accepted decisions under [docs/adr](./docs/adr/) govern architecture.
3. <!-- II-CLAUSE-0005 --> This document defines the next product outcome, scope, sequencing, and acceptance boundary.
4. <!-- II-CLAUSE-0006 --> The active tracer plan under .scratch, when one exists, may divide this specification into executable slices but may not silently narrow or expand it.
5. <!-- II-CLAUSE-0007 --> Current code and tests are evidence of implementation, not permission to contradict the preceding documents.

<!-- II-CLAUSE-0008 --> Earlier specifications, proposals, audits, blunder hunts, and execution plans are preserved under [docs/archive/specifications/2026-07-13](./docs/archive/specifications/2026-07-13/README.md). <!-- II-CLAUSE-0009 --> They are design history, not a backlog and not an alternative source of current requirements.

### Architectural decision

<!-- II-CLAUSE-0010 --> [ADR 0022](./docs/adr/0022-govern-reviewed-knowledge-library.md) is accepted and governs the Reviewed Knowledge Library architecture defined here. <!-- II-CLAUSE-0011 --> ADRs 0002 and 0015 remain compatible authorities for project-local corrections, Personal Defaults, Owner references, and the historical-practice lane.

## Product outcome

<!-- II-CLAUSE-0012 --> Vellum should provide the practical benefit of a personal musicologist and expert arranger without requiring the Owner to supply musicological vocabulary or instrument-specific rules.

<!-- II-CLAUSE-0013 --> Given a musical source, Vellum should ordinarily infer:

- <!-- II-CLAUSE-0014 --> the Principal Voice or the absence of one;
- <!-- II-CLAUSE-0015 --> a Source Voice Graph that distinguishes voices from parts and staves;
- <!-- II-CLAUSE-0016 --> Texture, Contrapuntal Technique, harmonic structure, voice roles, phrases, cadences, changing musical context, and form;
- <!-- II-CLAUSE-0017 --> Continuo Foundation, Figured Bass, and realization obligations when present;
- <!-- II-CLAUSE-0018 --> which source relationships define recognizability;
- <!-- II-CLAUSE-0019 --> a coherent target texture and voice plan;
- <!-- II-CLAUSE-0020 --> idiomatic target-instrument technique by passage;
- <!-- II-CLAUSE-0021 --> playable phrase-level physical realization; and
- <!-- II-CLAUSE-0022 --> what uncertainty or compromise is consequential enough to show the Owner.

<!-- II-CLAUSE-0023 --> The default interaction stays simple: upload source material, choose one or more targets and Notation Layouts, optionally state an intention, then review only material uncertainty and consequential choices. <!-- II-CLAUSE-0024 --> Complete analysis, evidence, alternatives, rejected candidates, and source citations remain available through progressive disclosure.

<!-- II-CLAUSE-0025 --> Five-course baroque guitar, thirteen-course baroque lute, and six-string classical guitar are coequal initial targets. <!-- II-CLAUSE-0026 --> Shared architecture must enable each target without reducing all three to the same technique, search state, notation, or evaluation model.

## Why this is the next work

<!-- II-CLAUSE-0027 --> The accepted prototype baseline already provides:

- <!-- II-CLAUSE-0028 --> local-first Arrangement Workspaces;
- <!-- II-CLAUSE-0029 --> symbolic and optical source ingestion;
- <!-- II-CLAUSE-0030 --> Score-Anchored Review;
- <!-- II-CLAUSE-0031 --> Musicological Analysis;
- <!-- II-CLAUSE-0032 --> purpose-scoped Source Truth;
- <!-- II-CLAUSE-0033 --> Arrangement and Performance Briefs;
- <!-- II-CLAUSE-0034 --> versioned Arrangement Plans;
- <!-- II-CLAUSE-0035 --> independent target Arrangement Searches;
- <!-- II-CLAUSE-0036 --> Preservation Audits and Transformation Reports;
- <!-- II-CLAUSE-0037 --> immutable Arrangement Scores and branching;
- <!-- II-CLAUSE-0038 --> score selection, batch edits, and version history;
- <!-- II-CLAUSE-0039 --> PDF, SVG, LilyPond, MIDI, Audio Preview, and score-following playback;
- <!-- II-CLAUSE-0040 --> reviewed-learning boundaries; and
- <!-- II-CLAUSE-0041 --> a versioned evaluation harness.

<!-- II-CLAUSE-0042 --> That baseline proves the product loop, but not expert-quality target realization. <!-- II-CLAUSE-0043 --> Three exact Owner observations define the present failure boundary:

1. <!-- II-CLAUSE-0044 --> The Greensleeves baroque-guitar result preserves notes but is neither convincing punteado nor valid mixed-style writing. <!-- II-CLAUSE-0045 --> It uses chord and transition choices that are nominally reachable but not idiomatic.
2. <!-- II-CLAUSE-0046 --> The Greensleeves baroque-lute result includes an f/b stopped-course combination spanning frets 1 through 5 on the Owner's approximately 690 mm instrument, despite closer equivalent realizations.
3. <!-- II-CLAUSE-0047 --> The Greensleeves classical-guitar result preserves the Principal Voice but reduces a 59-event source bass to four isolated events, so it is not a coherent two-voice arrangement.

<!-- II-CLAUSE-0048 --> The current knowledge implementation is also too weak for the product promise:

- <!-- II-CLAUSE-0049 --> OwnerReference collapses Work, Edition, Exemplar, Digital Asset, and citation identity.
- <!-- II-CLAUSE-0050 --> HistoricalPracticeClaim mixes historical authority, modern editorial convention, and Vellum heuristics.
- <!-- II-CLAUSE-0051 --> KnowledgePack contains little more than a list of claim IDs.
- <!-- II-CLAUSE-0052 --> documentary classification is incorrectly treated as perfect confidence;
- <!-- II-CLAUSE-0053 --> Arrangement Search records no applied Knowledge Pack identities; and
- <!-- II-CLAUSE-0054 --> labels such as idiom, historical profile, playability, and voice leading are currently proxy scores rather than independently grounded evaluations.

<!-- II-CLAUSE-0055 --> This specification replaces those proxies with a source-backed, reviewable instrument-intelligence pipeline.

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

<!-- II-CLAUSE-0056 --> The loop is accumulative but never self-authorizing. <!-- II-CLAUSE-0057 --> Extraction proposes evidence. <!-- II-CLAUSE-0058 --> Review releases knowledge. <!-- II-CLAUSE-0059 --> Arrangement produces candidates. <!-- II-CLAUSE-0060 --> Independent evaluation inspects output. <!-- II-CLAUSE-0061 --> Owner feedback proposes scoped changes. <!-- II-CLAUSE-0062 --> No stage promotes its own output into authority.

## Non-negotiable boundaries

### Authority lanes remain distinct

| Evidence or decision                                          | Canonical destination                         | Direct arranging authority                      |
| ------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Cited period prescription                                     | Historical Practice Pack                      | Only from an applicable released profile        |
| <!-- II-CLAUSE-0063 --> Pattern observed in period repertoire | Descriptive observation                       | No; it may support a reviewed profile           |
| <!-- II-CLAUSE-0064 --> Modern method or editorial synthesis  | Modern Pedagogy or Editorial Pack             | Only with explicit modern authority and scope   |
| <!-- II-CLAUSE-0065 --> Vellum default or heuristic           | Software Profile                              | Yes when selected, but never labeled historical |
| <!-- II-CLAUSE-0066 --> Instrument construction and geometry  | Instrument Model or exact Instrument Instance | Yes for the modeled mechanic                    |
| <!-- II-CLAUSE-0067 --> Owner physical result                 | Owner Playtest or Ergonomic Profile candidate | Only for the reviewed performer and context     |
| <!-- II-CLAUSE-0068 --> Repeated Owner choice                 | Personal Default Candidate                    | Only after Owner approval                       |
| <!-- II-CLAUSE-0069 --> Evaluator disagreement                | Calibration or Fixture Candidate              | Only after separate review and dataset controls |

<!-- II-CLAUSE-0070 --> A HistoricalPracticeClaim may not use modern editorial convention or a Vellum heuristic as its authority. <!-- II-CLAUSE-0071 --> Those belong to separately named record types.

### Uncertainty is data

<!-- II-CLAUSE-0072 --> Unknown, not evaluated, conflicting, and inapplicable are distinct from false. <!-- II-CLAUSE-0073 --> Missing evidence cannot produce a passing score. <!-- II-CLAUSE-0074 --> A useful provisional result may still be offered, but its heuristic or unresolved basis must be visible and must not be described as historically certified.

### Readiness is tiered, not one boolean

<!-- II-CLAUSE-0075 --> Vellum distinguishes five non-interchangeable states:

- <!-- II-CLAUSE-0076 --> **pipeline complete**: the deterministic workflow completed and all required machine contracts ran;
- <!-- II-CLAUSE-0077 --> **provisional result**: an inspectable result exists, but one or more idiom, historical, ergonomic, human, or held-out dimensions remain unknown;
- <!-- II-CLAUSE-0078 --> **capability qualified**: one exact sealed Generation System, target profile, and dependency closure passed its required non-Greensleeves held-out groups;
- <!-- II-CLAUSE-0079 --> **artifact ready**: one exact target result passed its notation, playback, mechanical, relationship, and role-scoped human gates under a compatible current Capability Qualification; and
- <!-- II-CLAUSE-0080 --> **program complete**: all required shared verticals and all three coequal targets reached both capability and exact-artifact readiness boundaries.

<!-- II-CLAUSE-0081 --> Pipeline completion never implies capability or artifact readiness. <!-- II-CLAUSE-0082 --> Capability evidence qualifies a sealed system/profile version; exact-output evidence qualifies an artifact. <!-- II-CLAUSE-0083 --> Changing either side independently stales the corresponding claim. <!-- II-CLAUSE-0084 --> Readiness is claim- and profile-scoped: a dimension deliberately excluded by an editorial profile is `not_applicable` or `not_claimed`, not `unknown`. <!-- II-CLAUSE-0085 --> An applicable unresolved dimension may remain visible on a provisional result, but it cannot support labels such as `ready`, `playable`, `idiomatic`, `historically supported`, or `specialist reviewed`.

<!-- II-CLAUSE-0086 --> A Capability Qualification pins the Generation System digest and transitive dependency closure, target and acceptance profiles, explicit Qualification Claim Scope, split manifest and contamination history, provider-exposure record, evaluator versions, all attempted groups, and machine results. <!-- II-CLAUSE-0087 --> The Claim Scope names supported source modalities, textures, techniques, instrument configurations, notation and playback dimensions, workload envelope, provider conditions, evaluated coverage, exclusions, and unknown or unclaimed dimensions. <!-- II-CLAUSE-0088 --> Passing two groups cannot authorize the broader label “target qualified” outside that scope. <!-- II-CLAUSE-0089 --> Artifact Readiness pins the exact Arrangement Score and Deliverable digests, Instrument Instance and Performance Brief, compatible Capability Qualification, independent Evaluation Cards and Adoption Decision, and required human or physical evidence. <!-- II-CLAUSE-0090 --> Either record is immutable; a changed dependency, profile, output, or required-evidence policy creates a new record or an explicit stale state.

### Knowledge activation is explicit

<!-- II-CLAUSE-0091 --> Knowledge lifecycle and arranging authority are separate. <!-- II-CLAUSE-0092 --> The activation policy is:

| Artifact or attestation                                              | Permitted use                                                                                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Mutable draft                                                        | Workbench authoring only                                                                                                    |
| <!-- II-CLAUSE-0093 --> Immutable release with test-only attestation | Isolated evaluation or an explicitly enabled provisional research mode                                                      |
| <!-- II-CLAUSE-0094 --> Maintainer-reviewed-system attestation       | Default software heuristics or editorial behavior within an explicitly nonhistorical system scope                           |
| <!-- II-CLAUSE-0095 --> Owner-reviewed-local attestation             | Disclosed local guidance within the attested scope                                                                          |
| <!-- II-CLAUSE-0096 --> Specialist attestation                       | Historical or specialist presentation only within the attested claim, profile, instrument, period, school, and review scope |

<!-- II-CLAUSE-0097 --> A test-only release may exercise the production code path, but it cannot become the default candidate, produce a ready result, or satisfy a historical-readiness gate. <!-- II-CLAUSE-0098 --> A maintainer-reviewed-system attestation authorizes only explicitly classified software heuristics or editorial defaults under a pinned policy; it cannot authorize or imply historical, pedagogical, ergonomic, performer, or specialist claims. <!-- II-CLAUSE-0099 --> Promotion creates a new immutable release or attestation; it never changes an existing release in place.

### Constitutive technique belongs to the score plan

<!-- II-CLAUSE-0100 --> Technique belongs to the Arrangement Plan or Arrangement Score when it changes the musical event, available notes, sounding courses, voice continuity, duration, articulation identity, or notation. <!-- II-CLAUSE-0101 --> Examples include a rasgueado stroke, an alfabeto chord, required course suppression, a campanella fingering that sustains overlapping notes, or a required damping event.

<!-- II-CLAUSE-0102 --> Optional execution detail belongs to Performance Interpretation when changing it leaves the canonical notated and sounding musical obligations intact. <!-- II-CLAUSE-0103 --> The same family of technique may occupy different layers in different passages, so the decision is explicit rather than globally hard-coded.

### Packs contain declarative knowledge, not executable uploads

<!-- II-CLAUSE-0104 --> Knowledge Packs may name registered compiler and evaluator components and provide schema-validated parameters. <!-- II-CLAUSE-0105 --> An imported document or pack cannot supply arbitrary executable code, file paths, shell commands, templates with active content, or provider credentials.

### Old results remain immutable; replayability is explicit

<!-- II-CLAUSE-0106 --> A new source, claim, profile, pack release, compiler, or evaluator never rewrites an existing Arrangement Search or Arrangement Score. <!-- II-CLAUSE-0107 --> Replayability is recorded as complete, partial, unavailable, or legacy-unverifiable according to retained bytes, executable semantics, authority, and rights. <!-- II-CLAUSE-0108 --> A Knowledge Reassessment may explain that regeneration could improve or invalidate an earlier readiness claim without pretending an unreplayable historical result can still be reproduced.

### Data lifecycle and deletion

<!-- II-CLAUSE-0109 --> Immutability does not mean that private content must be retained forever. <!-- II-CLAUSE-0110 --> Every blob and derivative has retention, pinning, reference, rights, backup, and deletion state.

<!-- II-CLAUSE-0111 --> Before deletion, Vellum shows dependent segments, extractions, candidates, releases, fixtures, arrangements, evaluations, reports, caches, backups, and known exports. <!-- II-CLAUSE-0112 --> The Owner may cancel, retain an explicitly pinned encrypted local copy, remove bytes and purge unauthorized derivatives, or preserve non-sensitive tombstone metadata while marking citations and replay unavailable.

<!-- II-CLAUSE-0113 --> Purge follows the complete provenance graph within Vellum-controlled storage and cannot silently leave crops, OCR text, translations, prompts, logs, fixtures, managed exports, or backups whose authorization depended on the deleted material. <!-- II-CLAUSE-0114 --> Immutable records may retain digest, former identity, deletion time, and reason without retaining deleted content. <!-- II-CLAUSE-0115 --> Affected records report `source unavailable`, `partially reproducible`, or `not reproducible`; current resolvers receive an advisory and cannot claim evidence that is no longer available under policy. <!-- II-CLAUSE-0116 --> Vellum cannot recall bytes already copied to an unmanaged device or external recipient. <!-- II-CLAUSE-0117 --> It records that irreversible disclosure, warns the Owner before egress and purge, and retains only the minimum permitted disclosure tombstone.

## Reference-source substrate

### Durable identity graph

<!-- II-CLAUSE-0118 --> Reference identity uses versioned assertions rather than forcing uncertain imports into a falsely complete hierarchy. <!-- II-CLAUSE-0119 --> Immutable bytes, acquisition provenance, bibliographic identity, and rights decisions remain separate.

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

<!-- II-CLAUSE-0120 --> Each entity version is an immutable bibliographic assertion snapshot. <!-- II-CLAUSE-0121 --> An import may begin with incomplete or disputed identity. <!-- II-CLAUSE-0122 --> Filename, repository grouping, and catalog metadata create candidate identity assertions, not placeholder Editions or proof. <!-- II-CLAUSE-0123 --> Correction creates a child or superseding version; merge, split, and alias decisions create an immutable Identity Redirect while preserving every prior record and the asset bytes it described. <!-- II-CLAUSE-0124 --> One Work may occur in many manifestations, a compilation may contain many Works, a manuscript need not pretend to be an Edition, and one digital asset may represent multiple exemplars or provider objects.

<!-- II-CLAUSE-0125 --> Every released claim cites one or more immutable Source Segment Versions. <!-- II-CLAUSE-0126 --> A Page Atlas correction creates new segment versions; it cannot change the canvas, crop, coordinates, or meaning of an existing citation.

<!-- II-CLAUSE-0127 --> Deduplication shares immutable bytes, never acquisition provenance, rights, retention, or authority. <!-- II-CLAUSE-0128 --> Every segment, extraction, candidate, derivative, fixture, prompt, report, and export pins the exact acquisition and provenance path that authorized it. <!-- II-CLAUSE-0129 --> A later, more permissive acquisition of identical bytes cannot retroactively authorize an existing derivative without an explicit reviewed provenance-substitution decision. <!-- II-CLAUSE-0130 --> Deletion first removes or restricts acquisition edges; effective rights are recomputed over surviving authorized paths, and shared bytes are garbage-collected only when no retained acquisition, derivative, or explicit pin requires them.

<!-- II-CLAUSE-0131 --> Guided Start's **arrange this**, **add to Owner Reference Library**, and **do both** choices create role-specific Asset Role Bindings over the same content-addressed Digital Asset and explicit acquisition paths. <!-- II-CLAUSE-0132 --> They do not copy bytes into unrelated stores or let one role borrow another role's access, retention, export, or deletion authority.

### Rights, access, processing, and egress

<!-- II-CLAUSE-0133 --> Rights assertions are evidence-bearing claims, not mutable fields on a byte blob and not legal certainty manufactured by Vellum. <!-- II-CLAUSE-0134 --> The following operations remain separately authorized:

- <!-- II-CLAUSE-0135 --> underlying Work status;
- <!-- II-CLAUSE-0136 --> manifestation, translation, or editorial rights;
- <!-- II-CLAUSE-0137 --> physical Exemplar restrictions;
- <!-- II-CLAUSE-0138 --> scan-provider terms and requested attribution;
- <!-- II-CLAUSE-0139 --> Owner-private access;
- <!-- II-CLAUSE-0140 --> local extraction permission;
- <!-- II-CLAUSE-0141 --> named-provider OCR, OMR, translation, or model-processing permission;
- <!-- II-CLAUSE-0142 --> pack citation and excerpt permission; and
- <!-- II-CLAUSE-0143 --> export or redistribution permission.

<!-- II-CLAUSE-0144 --> A public-domain Work does not imply that every digital scan is unrestricted. <!-- II-CLAUSE-0145 --> A copyrighted Owner-owned method may support local cited candidates without permitting source pages or extracted content to enter a repository pack.

<!-- II-CLAUSE-0146 --> Every operation records an immutable Access Decision over exact source and derivative refs, destination, purpose, policy, supporting assertions, rationale, and time. <!-- II-CLAUSE-0147 --> Unknown rights fail closed for provider egress, fixture inclusion, public export, and redistribution. <!-- II-CLAUSE-0148 --> Private local study may proceed only under an explicit local policy or Owner attestation; <!-- II-CLAUSE-0149 --> Vellum does not present that decision as legal advice.

<!-- II-CLAUSE-0150 --> Before remote processing, Vellum shows and records the exact regions, text, notation, or metadata to be transmitted; named destination and purpose; applicable rights and Owner authorization; provider-policy identity when known; and resulting Access Decision. <!-- II-CLAUSE-0151 --> Every extraction, crop, transcription, translation, candidate, pack entry, fixture, prompt, report, log, and export retains transitive source refs so policy follows derivatives rather than stopping at the original bytes.

<!-- II-CLAUSE-0152 --> Remote model processing is available only through a server-minted Model Action Attempt. <!-- II-CLAUSE-0153 --> A client submits intent and canonical workspace refs; it cannot supply raw provider context, substitute a destination, append source content directly, or widen tool capability. <!-- II-CLAUSE-0154 --> The server reconstructs the exact permitted context and issues an immutable Model Egress Envelope:

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

<!-- II-CLAUSE-0155 --> Every disclosed ref must be authorized for the exact destination and purpose. <!-- II-CLAUSE-0156 --> Provider Authorization authenticates the connection but never authorizes arbitrary data transmission. <!-- II-CLAUSE-0157 --> Imported text, OCR, metadata, notation, and pack prose are quoted as untrusted data and cannot alter system instructions, destination, egress policy, or tool capabilities. <!-- II-CLAUSE-0158 --> A generic client-supplied provider stream is not a production interface.

<!-- II-CLAUSE-0159 --> Completion is also server-bound. <!-- II-CLAUSE-0160 --> The service validates that the provider response and local tool transcript descend from the exact attempt and Egress Envelope, validates the proposed canonical result, and atomically publishes that result with a Model Action Result Commit. <!-- II-CLAUSE-0161 --> A client cannot complete an attempt merely by naming an unrelated pre-existing record in the same workspace.

### Untrusted-ingestion boundary

<!-- II-CLAUSE-0162 --> Reference files, URLs, IIIF manifests, catalog metadata, OCR text, translations, and imported packs are untrusted input.

- <!-- II-CLAUSE-0163 --> Acquisition permits only supported URI schemes. <!-- II-CLAUSE-0164 --> Redirects are revalidated at every hop; loopback, link-local, private-network, credential-bearing, local-file, and disallowed targets require an explicit local connector rather than a generic fetch.
- <!-- II-CLAUSE-0165 --> DNS resolution and the connected address must satisfy the same policy. <!-- II-CLAUSE-0166 --> Retrieval URIs are sanitized before persistence or display.
- <!-- II-CLAUSE-0167 --> Imports enforce byte, page, pixel, archive-expansion, nesting, time, memory, and output limits. <!-- II-CLAUSE-0168 --> Declared media type is checked against detected content.
- <!-- II-CLAUSE-0169 --> PDF, image, archive, OCR, OMR, and conversion components run with bounded resources and without ambient network, credential, provider-token, or unrestricted filesystem access.
- <!-- II-CLAUSE-0170 --> Imported text and metadata render as inert escaped data under the applicable Content Security Policy. <!-- II-CLAUSE-0171 --> Content refs resolve only through Vellum's content store and cannot embed arbitrary paths or executable URLs.
- <!-- II-CLAUSE-0172 --> Pack bindings resolve only through an exact authorized Component Registry Snapshot. <!-- II-CLAUSE-0173 --> Parameter schemas include units, ranges, collection limits, compatibility, and resource budgets.
- <!-- II-CLAUSE-0174 --> Model-facing imported content is delimited as untrusted evidence and receives no instruction authority. <!-- II-CLAUSE-0175 --> Model Actions expose only the least-privilege tool capabilities named by their Egress Envelope; source text cannot request another provider, workspace, filesystem region, secret, callback, or tool.
- <!-- II-CLAUSE-0176 --> Secrets, callbacks, source content without export authority, and local paths are redacted from logs, diagnostics, snapshots, prompts, and exported state.

### Page atlas

<!-- II-CLAUSE-0177 --> Every paged asset receives a versioned Page Atlas that records:

- <!-- II-CLAUSE-0178 --> scan or canvas order;
- <!-- II-CLAUSE-0179 --> printed pagination, foliation, plate labels, and separate internal sequences;
- <!-- II-CLAUSE-0180 --> missing, duplicate, rotated, cropped, damaged, or blank pages;
- <!-- II-CLAUSE-0181 --> detected regions and their modality;
- <!-- II-CLAUSE-0182 --> links across split text and plate volumes; and
- <!-- II-CLAUSE-0183 --> corrections with provenance.

<!-- II-CLAUSE-0184 --> The atlas is the routing and citation surface. <!-- II-CLAUSE-0185 --> It is not a single OCR transcript.

<!-- II-CLAUSE-0186 --> Atlas generation is bounded, resumable, cancellable, and incremental. <!-- II-CLAUSE-0187 --> Large assets may expose a verified partial Atlas while unprocessed pages remain explicit; failure or resource exhaustion cannot be mistaken for a complete scan inventory.

### Modality-specific extraction

<!-- II-CLAUSE-0188 --> Regions may independently route to:

- <!-- II-CLAUSE-0189 --> modern prose OCR;
- <!-- II-CLAUSE-0190 --> long-s or historical-type OCR;
- <!-- II-CLAUSE-0191 --> Fraktur OCR;
- <!-- II-CLAUSE-0192 --> staff OMR;
- <!-- II-CLAUSE-0193 --> figured-bass symbol recognition aligned to exact bass events, including accidentals, continuation, geometry, and unresolved alternatives;
- <!-- II-CLAUSE-0194 --> printed tablature recognition;
- <!-- II-CLAUSE-0195 --> handwritten tablature recognition;
- <!-- II-CLAUSE-0196 --> alfabeto or diagram extraction;
- <!-- II-CLAUSE-0197 --> handwriting recognition;
- <!-- II-CLAUSE-0198 --> table or parallel-layout alignment;
- <!-- II-CLAUSE-0199 --> translation; or
- <!-- II-CLAUSE-0200 --> visual-only review.

<!-- II-CLAUSE-0201 --> Every Extraction Run records component identity, version, configuration, inputs, outputs, confidence, geometry, logs, and failure state. <!-- II-CLAUSE-0202 --> A crop and extracted text or notation remain projections of the immutable Source Segment Version and asset bytes; neither becomes a freestanding citation authority.

### Cited extraction artifacts

<!-- II-CLAUSE-0203 --> A candidate derived from sources retains:

- <!-- II-CLAUSE-0204 --> one or more exact Source Segment Version refs, asset digests, acquisition provenance, and applicable Access Decisions;
- <!-- II-CLAUSE-0205 --> source crops, coordinate systems, transforms, and geometry;
- <!-- II-CLAUSE-0206 --> original transcription;
- <!-- II-CLAUSE-0207 --> normalized transcription;
- <!-- II-CLAUSE-0208 --> translation when used;
- <!-- II-CLAUSE-0209 --> extraction component and confidence;
- <!-- II-CLAUSE-0210 --> source-identity confidence;
- <!-- II-CLAUSE-0211 --> interpretation confidence;
- <!-- II-CLAUSE-0212 --> applicability confidence;
- <!-- II-CLAUSE-0213 --> reviewer role and review state; and
- <!-- II-CLAUSE-0214 --> unresolved alternatives.

<!-- II-CLAUSE-0215 --> One scalar confidence cannot stand in for these independent uncertainties.

## Reviewed Knowledge Library

<!-- II-CLAUSE-0216 --> The Historical Knowledge Base becomes one authority lane in a broader Reviewed Knowledge Library. <!-- II-CLAUSE-0217 --> Authority and musical subject are orthogonal:

- <!-- II-CLAUSE-0218 --> authority lanes are historical practice, modern pedagogy, editorial convention, software heuristic, and Owner-local reviewed guidance;
- <!-- II-CLAUSE-0219 --> knowledge domains include analysis and counterpoint, continuo and Figured Bass, instrument technique, notation, playback, ergonomics, and evaluation guidance.

<!-- II-CLAUSE-0220 --> A pack release declares one authority lane and one or more domains. <!-- II-CLAUSE-0221 --> A historical continuo pack and a modern-pedagogical continuo pack therefore remain distinguishable instead of competing inside one overloaded kind.

<!-- II-CLAUSE-0222 --> Instrument mechanics, Instrument Instances, Personal Defaults, Owner Ergonomic Profiles, and evaluator datasets remain linked external records rather than being smuggled into a pack kind.

### Knowledge Candidates

<!-- II-CLAUSE-0223 --> Candidate classification uses orthogonal axes rather than one overloaded kind.

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

<!-- II-CLAUSE-0224 --> A worked example may also be descriptive evidence or a counterexample; those roles do not change its authority lane. <!-- II-CLAUSE-0225 --> A conflict and a research question are graph nodes, not disguised claims. <!-- II-CLAUSE-0226 --> Candidate corrections create a new digested version. <!-- II-CLAUSE-0227 --> Evidence, relationship, and derivation edges are external immutable records that point to already digested candidate cores; candidate cores do not point back to those edges. <!-- II-CLAUSE-0228 --> A Knowledge Pack Release pins the exact node and edge sets. <!-- II-CLAUSE-0229 --> This Merkle-DAG rule prevents candidate↔edge digest cycles. <!-- II-CLAUSE-0230 --> Applicability predicates have stable identities so evaluation, correction, supersession, and replay can address the exact expression that ran.

<!-- II-CLAUSE-0231 --> Authority lanes are discriminated, not additive badges. <!-- II-CLAUSE-0232 --> A `historical_practice` candidate cannot use `modern_synthesis`, `editorial_convention`, or `software_heuristic` as its authoritative epistemic form. <!-- II-CLAUSE-0233 --> A release's authoritative entries, profiles, and Constraint Derivations must match its declared authority lane. <!-- II-CLAUSE-0234 --> Cross-lane references are permitted only through typed `evidence_only`, `counterevidence`, or `conflict_context` relations; they cannot activate consequences in the receiving lane or launder software, editorial, pedagogical, or personal judgment into a historical claim.

<!-- II-CLAUSE-0235 --> Claims and observations support many-to-many evidence. <!-- II-CLAUSE-0236 --> Typed relationships include:

- <!-- II-CLAUSE-0237 --> supports;
- <!-- II-CLAUSE-0238 --> contradicts;
- <!-- II-CLAUSE-0239 --> narrows;
- <!-- II-CLAUSE-0240 --> qualifies;
- <!-- II-CLAUSE-0241 --> supersedes;
- <!-- II-CLAUSE-0242 --> derived from;
- <!-- II-CLAUSE-0243 --> exemplifies; and
- <!-- II-CLAUSE-0244 --> counterexample to.

<!-- II-CLAUSE-0245 --> Descriptive repertoire observations retain corpus identity, sampling method, numerator, denominator where meaningful, examples, counterexamples, and coverage limitations. <!-- II-CLAUSE-0246 --> Frequency is not silently converted into prescription.

<!-- II-CLAUSE-0247 --> Converting evidence into a compiler or evaluator consequence requires a separately reviewed Constraint Derivation that records input refs, inference rule, authority lane, applicability, hard/soft/descriptive force, limitations, and reviewer attestations. <!-- II-CLAUSE-0248 --> A profile cannot grant itself precedence over another authority lane. <!-- II-CLAUSE-0249 --> Cross-lane composition belongs to a centrally versioned Knowledge Resolution Policy.

### Drafts, releases, attestations, and advisories

<!-- II-CLAUSE-0250 --> A Knowledge Pack Draft is mutable workbench state. <!-- II-CLAUSE-0251 --> A Knowledge Pack Release is an immutable content-addressed graph snapshot. <!-- II-CLAUSE-0252 --> Review authority and current eligibility are external immutable records; neither mutates release content.

<!-- II-CLAUSE-0253 --> Canonical library publication is transactional, not merely file-atomic. <!-- II-CLAUSE-0254 --> Releases, attestations, advisories, identity and authority verifications, Activation Decisions, Inventory and Catalog snapshots, and visible head-state changes are staged in one publication generation and become visible through one compare-and-swap commit. <!-- II-CLAUSE-0255 --> Readers resolve one stable committed generation. <!-- II-CLAUSE-0256 --> A crash leaves either the previous generation current or an unreachable recoverable staging set; concurrent writers use optimistic revision checks or serialization, and recovery is idempotent.

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

<!-- II-CLAUSE-0257 --> Canonical serialization, digest domain, schema version, and internal digested references are part of the storage contract. <!-- II-CLAUSE-0258 --> Content changes create a new release. <!-- II-CLAUSE-0259 --> Later review creates an attestation; supersession, retraction, rights restriction, or revocation creates an advisory. <!-- II-CLAUSE-0260 --> Trust is computed by an external Attestation Verification under a pinned verifier policy; advisory issuer identity and authority over the advisory kind, subject, and scope are computed by an external Advisory Verification. <!-- II-CLAUSE-0261 --> Neither is a claimant-controlled field. <!-- II-CLAUSE-0262 --> A verified or out-of-scope result always pins both the evaluated scope and the authority scope used for comparison; unverified and revoked results cannot carry an authority scope. <!-- II-CLAUSE-0263 --> A verification is trusted only when issued through a verifier authorized by the pinned Trust Policy; importing a verification record cannot confer trust. <!-- II-CLAUSE-0264 --> Every Catalog and Activation Decision pins resolution time, clock policy, and any earliest validity boundary. <!-- II-CLAUSE-0265 --> Current use fails closed after expiry or verified revocation and atomically publishes a replacement `review_required` or `deny` decision before further ordinary activation, while historical outputs retain their original as-of snapshots.

<!-- II-CLAUSE-0266 --> For brevity, this specification may call a release whose only activating attestation is `test_only` a test-only release; the state belongs to the attestation, not mutable release content.

<!-- II-CLAUSE-0267 --> A test-only attestation is system-issued under a pinned test policy and conveys no human, historical, or specialist authority. <!-- II-CLAUSE-0268 --> A maintainer-reviewed-system attestation authorizes only software or editorial consequences inside its explicitly nonhistorical scope. <!-- II-CLAUSE-0269 --> Owner-reviewed-local and specialist attestations require the corresponding human reviewer and external scope verification. <!-- II-CLAUSE-0270 --> Exact-artifact human reviews use the same external Reviewer Authority Verification contract: Owner-usefulness review may use explicit Owner authority, while target-player, idiom, historical, continuo, counterpoint, and engraving claims require matching verified roles. <!-- II-CLAUSE-0271 --> AFK automation may build drafts, extraction artifacts, candidates, test-only releases and attestations, and review packages; it may not invent human authority.

<!-- II-CLAUSE-0272 --> An `allow` Activation Decision without exactly one valid authority variant is schema-invalid. <!-- II-CLAUSE-0273 --> Its authority must agree with the complete attestation and verification closure and remains part of the Manifest, Arrangement Search identity, export policy, readiness calculation, and user disclosure.

### Profiles and compiler mappings

<!-- II-CLAUSE-0274 --> A pack profile contains:

- <!-- II-CLAUSE-0275 --> applicability predicates;
- <!-- II-CLAUSE-0276 --> scoped claims and observations;
- <!-- II-CLAUSE-0277 --> examples and counterexamples;
- <!-- II-CLAUSE-0278 --> permitted, preferred, discouraged, and prohibited outcomes;
- <!-- II-CLAUSE-0279 --> declarative mappings to registered Analysis, planning, compiler, notation, playback, and evaluator components;
- <!-- II-CLAUSE-0280 --> parameter values and units;
- <!-- II-CLAUSE-0281 --> conflicts requiring the central Knowledge Resolution Policy;
- <!-- II-CLAUSE-0282 --> expected observable consequences; and
- <!-- II-CLAUSE-0283 --> limitations and unevaluated dimensions.

<!-- II-CLAUSE-0284 --> Profiles are not prompt fragments. <!-- II-CLAUSE-0285 --> Prompt summaries may be derived from them, but search constraints and evaluators consume the same typed profile identity.

<!-- II-CLAUSE-0286 --> Every registered component binding pins executable or artifact digest where retainable, interface and parameter-schema digest, unit schema, compatibility range, resource policy, and replay availability. <!-- II-CLAUSE-0287 --> If old executable semantics can no longer be run, Vellum preserves inspection and reports regeneration unavailable rather than pretending that a matching version string is reproducible.

## Applied Knowledge Manifest

<!-- II-CLAUSE-0288 --> Resolution begins from retained immutable inputs, not from an opaque context digest or the subset of packs that a resolver happened to choose.

<!-- II-CLAUSE-0289 --> The Knowledge Library Inventory Snapshot is the independently rebuildable complete release enumeration; the Knowledge Catalog Snapshot is the policy-filtered view derived from it.

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

<!-- II-CLAUSE-0290 --> Release dependencies form an acyclic Merkle DAG and may reference only already digested releases. <!-- II-CLAUSE-0291 --> A semantic conflict, mutual comparison, or citation relationship that is not an authority dependency belongs in an external relationship edge pinned by the Inventory or Release graph snapshot. <!-- II-CLAUSE-0292 --> Dependency cycles are schema-invalid rather than being resolved through an unspecified fixed-point hash.

<!-- II-CLAUSE-0293 --> Manifest completeness is an enforced invariant:

- <!-- II-CLAUSE-0294 --> the Inventory Snapshot is the authoritative enumeration of every release reachable from the pinned configured registries under the pinned inventory builder and policy;
- <!-- II-CLAUSE-0295 --> every release in the Inventory Snapshot has exactly one Catalog inclusion or exclusion outcome, and every included release appears in the Catalog Snapshot;
- <!-- II-CLAUSE-0296 --> every eligible release in the Catalog Snapshot has one retained manifest outcome;
- <!-- II-CLAUSE-0297 --> every reachable profile in every considered release appears exactly once;
- <!-- II-CLAUSE-0298 --> exclusions record typed reasons and every dependency appears in a complete acyclic closure;
- <!-- II-CLAUSE-0299 --> every predicate retains true, false, unknown, or error rather than collapsing missing data into false;
- <!-- II-CLAUSE-0300 --> every profile entry has exactly one Activation Decision: applicable authorized entries receive `allow`, inapplicable or excluded entries receive `deny`, and unresolved or conflicting authority receives `review_required` unless policy resolves it without erasure;
- <!-- II-CLAUSE-0301 --> every `allow` decision carries exactly one scope-compatible Activation Authority derived from its complete verified attestation closure; missing or mixed authority invalidates the decision;
- <!-- II-CLAUSE-0302 --> only applicable entries with an `allow` Activation Decision over matching release, profile, scope, trusted Attestation Verification, rights decisions, verified effective advisories, and Resolution Policy activate ordinary consequences;
- <!-- II-CLAUSE-0303 --> conflicting entries retain separate candidate-family consequences until an explicit resolution selects one; and
- <!-- II-CLAUSE-0304 --> every selected component and parameter set resolves through the exact Component Registry Snapshot.

<!-- II-CLAUSE-0305 --> A manifest that omits an inventoried release, Catalog outcome, profile, dependency, conflict, exclusion reason, Activation Decision, or resolution decision is invalid. <!-- II-CLAUSE-0306 --> Validators independently rebuild the Inventory and Catalog Snapshots from their pinned registries, builders, and policies before recomputing completeness; a generator or catalog builder cannot certify its own completeness by listing only the packs it found or used.

<!-- II-CLAUSE-0307 --> Every Arrangement Search records the exact manifest and referenced immutable records. <!-- II-CLAUSE-0308 --> Unknown applicability cannot be scored as neutral. <!-- II-CLAUSE-0309 --> Materially different historically plausible resolutions produce separate candidate families or a focused review.

### Authority Path Inventory

<!-- II-CLAUSE-0310 --> Musical authority does not live only in stored Knowledge Packs. <!-- II-CLAUSE-0311 --> An immutable Authority Path Inventory covers every prompt instruction, prompt example, tool description or default, built-in lookup table or chart, compiler branch, ranker, validator, parameter, profile constant, and presentation label capable of changing musical behavior or the authority claimed for that behavior.

<!-- II-CLAUSE-0312 --> Every path is classified as one of:

- <!-- II-CLAUSE-0313 --> mechanical fact resolved through an Instrument Model or Instrument Instance;
- <!-- II-CLAUSE-0314 --> reviewed Knowledge Pack or profile consequence;
- <!-- II-CLAUSE-0315 --> maintainer-reviewed software heuristic;
- <!-- II-CLAUSE-0316 --> editorial convention;
- <!-- II-CLAUSE-0317 --> Owner-local preference;
- <!-- II-CLAUSE-0318 --> evaluator-only logic; or
- <!-- II-CLAUSE-0319 --> forbidden unregistered bypass.

<!-- II-CLAUSE-0320 --> Each nonmechanical production path resolves through the exact Component Registry Snapshot and Applied Knowledge Manifest or is disabled. <!-- II-CLAUSE-0321 --> Static scans and runtime instrumentation detect newly introduced unregistered paths. <!-- II-CLAUSE-0322 --> A manifest that records an empty pack set while prompt, table, ranker, or compiler behavior still supplies unregistered historical or idiomatic guidance is invalid.

## Knowledge reassessment

<!-- II-CLAUSE-0323 --> When a later source or pack release appears, Vellum compares it with existing knowledge and records whether it:

- <!-- II-CLAUSE-0324 --> corroborates;
- <!-- II-CLAUSE-0325 --> narrows;
- <!-- II-CLAUSE-0326 --> qualifies;
- <!-- II-CLAUSE-0327 --> contradicts;
- <!-- II-CLAUSE-0328 --> supersedes;
- <!-- II-CLAUSE-0329 --> leaves unchanged; or
- <!-- II-CLAUSE-0330 --> raises a new research question.

<!-- II-CLAUSE-0331 --> A Knowledge Reassessment identifies affected analyses, plans, searches, scores, and evaluations without mutating them. <!-- II-CLAUSE-0332 --> Retraction or correction preserves prior evidence and changes current readiness honestly.

<!-- II-CLAUSE-0333 --> Uploading or extracting a later source creates candidates and comparison work only. <!-- II-CLAUSE-0334 --> It does not change production readiness, active compiler behavior, or release eligibility.

<!-- II-CLAUSE-0335 --> Each immutable Reassessment records its triggering candidate, release, attestation, advisory, identity correction, rights decision, or validity expiry; exact old and new refs; affected dependency paths; proposed, reviewed, or effective state; resolver, policy, Inventory and Catalog Snapshot identities; reviewer and evidence refs; and remediation or regeneration choices. <!-- II-CLAUSE-0336 --> Positive authority arises only from a new Activation Decision over an immutable release, trusted applicable Attestation Verification, verified effective advisories, current rights decisions, resolution time and clock policy, and the pinned Resolution Policy. <!-- II-CLAUSE-0337 --> Expiry or verified revocation immediately makes an old `allow` ineligible for current use and requires an atomically published `review_required` or `deny` successor before ordinary activation resumes. <!-- II-CLAUSE-0338 --> Old outputs retain their original as-of snapshots.

## Shared musical-intelligence contracts

<!-- II-CLAUSE-0339 --> Knowledge becomes useful only when it changes an inspectable musical plan and an observable generated result.

### Source understanding precedes fingering

<!-- II-CLAUSE-0340 --> Before target realization, the current Analysis Record and Arrangement Plan must establish, as applicable:

- <!-- II-CLAUSE-0341 --> Principal Voice and other Preservation Targets;
- <!-- II-CLAUSE-0342 --> source voice identities, continuities, entries, and cadential obligations;
- <!-- II-CLAUSE-0343 --> Continuo Foundation, figures, suspensions, and bass authority;
- <!-- II-CLAUSE-0344 --> Texture and Contrapuntal Technique by passage;
- <!-- II-CLAUSE-0345 --> phrase, cadence, sequence, repetition, climax, repose, and formal-return roles;
- <!-- II-CLAUSE-0346 --> target texture and density;
- <!-- II-CLAUSE-0347 --> target-portable versus target-local transformations;
- <!-- II-CLAUSE-0348 --> allowed octave, duration, omission, redistribution, revoicing, and generated-material operations; and
- <!-- II-CLAUSE-0349 --> what uncertainty would materially change those decisions.

<!-- II-CLAUSE-0350 --> Successful pitch placement cannot compensate for a weak or incoherent musical plan.

### Source Voice Graph

<!-- II-CLAUSE-0351 --> A staff, part, tablature system, or MIDI track is not automatically one musical voice. <!-- II-CLAUSE-0352 --> Before target planning, every polyphonic source receives a Source Voice Graph. <!-- II-CLAUSE-0353 --> Identity basis is notated, inferred, or hybrid; resolved, disputed, and unresolved are separate identity states.

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

<!-- II-CLAUSE-0354 --> Every voice-bearing Normalized Score event appears in exactly one resolved Source Voice Occurrence or in `unresolvedEventRefs`. <!-- II-CLAUSE-0355 --> Intentional ambiguous membership uses disputed occurrences that name the same uncertainty and may overlap only under an explicit ambiguity relation; silent omission or unexplained duplicate membership invalidates the graph. <!-- II-CLAUSE-0356 --> Every Target Voice source ref resolves through the pinned Source Voice Graph, never implicitly through a part or visible staff. <!-- II-CLAUSE-0357 --> An uncertainty that could change entry order, continuity, bass identity, Principal Voice identity, or a preserved relationship is Critical Uncertainty.

### Lyrics and text underlay

<!-- II-CLAUSE-0358 --> When a source contains sung text or a requested layout includes a vocal line, lyrics are versioned source truth rather than engraving-only strings.

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

<!-- II-CLAUSE-0359 --> OCR and OMR alignment retain verse order, syllable boundaries, hyphens, elisions, extenders, melismas, and source geometry. <!-- II-CLAUSE-0360 --> Underlay uncertainty is Critical when it affects a requested song deliverable, textual phrase, accent, or preserved vocal identity. <!-- II-CLAUSE-0361 --> Faithful Reduction preserves requested text and alignment or records a Policy Exception. <!-- II-CLAUSE-0362 --> Audio Preview need not synthesize words, but score following and lineage retain syllable anchors.

### Musical context, transposition, and spanners

<!-- II-CLAUSE-0363 --> Key signature, tonal or modal interpretation, meter, clef, tempo, pitch reference, and written-to-sounding transposition are time-varying canonical context, not one score-level string.

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

<!-- II-CLAUSE-0364 --> A uniform musical transposition may still require distinct per-part written-to-sounding mappings. <!-- II-CLAUSE-0365 --> Enharmonic spelling, internal key or meter changes, fixed vocal range, capo, scordatura, and octave-transposing notation remain explicit. <!-- II-CLAUSE-0366 --> One tie chain has one identity and one uninterrupted Playback Occurrence; intermediate written notes do not reattack. <!-- II-CLAUSE-0367 --> Source-notated ornaments remain source truth even when their sounded realization is an optional Performance Interpretation.

### Target Voice and Relationship Plans

<!-- II-CLAUSE-0368 --> Every polyphonic, imitative, continuo, or melody-with-accompaniment passage receives a Target Voice Plan before physical search. <!-- II-CLAUSE-0369 --> Every source relationship promoted to a Preservation Target also receives a Target Relationship; per-voice coverage cannot substitute for preserving a relationship among voices.

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

<!-- II-CLAUSE-0370 --> Registered relationship kinds initially cover ordered imitative entry, subject interval-rhythm shape, answer relationship, suspension preparation and resolution, cadential relation, bass motion, voice exchange, figure-to-bass constraint, and generated-realization voice leading. <!-- II-CLAUSE-0371 --> A Validation Profile determines whether an interval, doubling, crossing, dissonance, or parallel motion is required, preferred, allowed, or prohibited; <!-- II-CLAUSE-0372 --> no generic counterpoint rule becomes universal merely by entering this schema.

<!-- II-CLAUSE-0373 --> `continuous` means coherent identity and fulfilled obligations throughout declared active spans. <!-- II-CLAUSE-0374 --> It does not forbid composed rests and cannot be tested by event count or non-silence alone. <!-- II-CLAUSE-0375 --> Splits, merges, exchanges, and generated continuations are explicit relationships and source mappings.

<!-- II-CLAUSE-0376 --> Under Faithful Reduction, the Principal Voice's exact pitch mapping under the selected Transposition Plan, rhythm, order, phrase relationships, and required prominence are hard constraints. <!-- II-CLAUSE-0377 --> Uniform transposition and permitted octave relocation remain governed transformations; raw source absolute pitch is not frozen when the policy permits a mapped pitch.

<!-- II-CLAUSE-0378 --> Relationship evaluators recompute protected timing, order, interval-rhythm shape, preparation and resolution, cadence placement, and voice identity from generated output. <!-- II-CLAUSE-0379 --> Generator declarations and event coverage cannot self-certify preservation.

### Target Harmonic Plan

<!-- II-CLAUSE-0380 --> Every passage whose recognizability or structural behavior depends on harmony receives a Target Harmonic Plan before physical search. <!-- II-CLAUSE-0381 --> Harmonic interpretation remains Validation-Profile-scoped; <!-- II-CLAUSE-0382 --> Roman-numeral function, modal sonority, chord identity, and dissonance treatment are not assumed to be universal equivalents.

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

<!-- II-CLAUSE-0383 --> Under Faithful Reduction, Vellum protects the source harmonic skeleton—harmonic rhythm, structural bass and inversion, cadential function, and essential dissonance or resolution—unless Analysis establishes that a dimension is nonstructural or a Policy Exception authorizes its change. <!-- II-CLAUSE-0384 --> Correct Principal Voice events cannot compensate for wrong harmony. <!-- II-CLAUSE-0385 --> Baroque-guitar alfabeto selection, lute bass deployment, classical-guitar bass generation, and Continuo planning consume the exact Harmonic Plan.

### Continuo Realization and Disposition Plan

<!-- II-CLAUSE-0386 --> A passage containing a Continuo Foundation receives a Continuo Realization Plan before target search. <!-- II-CLAUSE-0387 --> Canonical Figured Bass preserves source glyph and normalized musical meaning separately, including standalone accidentals, altered or ambiguous signs, stacked order, changes over a held bass, continuation geometry, and uncertainty.

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

<!-- II-CLAUSE-0388 --> A chord symbol, alfabeto shape, re-entrant course, pitch-class implication, or upper-octave doubling never counts as sounding an authoritative foundation bass. <!-- II-CLAUSE-0389 --> Complete dispositions require the sounded-foundation set to equal the complete foundation set. <!-- II-CLAUSE-0390 --> Reduction dispositions require sounded and unsounded sets to be disjoint and their union to equal the complete foundation set. <!-- II-CLAUSE-0391 --> An incapable target includes a separate bass or produces a labeled Continuo Reduction. <!-- II-CLAUSE-0392 --> Engraving, playback, lineage, and evaluation retain the same disposition and never synthesize an absent bass while labeling the result complete.

### Intended Technique Plan

<!-- II-CLAUSE-0393 --> Each passage receives an Intended Technique Plan where technique matters.

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

<!-- II-CLAUSE-0394 --> It identifies:

- <!-- II-CLAUSE-0395 --> technique family and source-scoped profile;
- <!-- II-CLAUSE-0396 --> phrase and event scope;
- <!-- II-CLAUSE-0397 --> transitions into and out of the technique;
- <!-- II-CLAUSE-0398 --> required right- and left-hand resources;
- <!-- II-CLAUSE-0399 --> held, released, damped, and resonating state;
- <!-- II-CLAUSE-0400 --> notation and playback consequences;
- <!-- II-CLAUSE-0401 --> acceptable alternatives;
- <!-- II-CLAUSE-0402 --> applicable historical or editorial evidence; and
- <!-- II-CLAUSE-0403 --> unknown or unevaluated execution dimensions.

<!-- II-CLAUSE-0404 --> Technique selection is a musical choice before it is a fingering choice. <!-- II-CLAUSE-0405 --> A baroque-guitar phrase cannot become mixed style merely because some simultaneous notes happen to fit an alfabeto shape.

### Ergonomic context

<!-- II-CLAUSE-0406 --> Instrument mechanics, general ergonomic models, Intended Performer Profile, and Owner Ergonomic Profile remain separate inputs.

<!-- II-CLAUSE-0407 --> An ergonomic observation records:

- <!-- II-CLAUSE-0408 --> exact Instrument Instance;
- <!-- II-CLAUSE-0409 --> scale length and relevant setup;
- <!-- II-CLAUSE-0410 --> performer or population scope;
- <!-- II-CLAUSE-0411 --> hand and technique context;
- <!-- II-CLAUSE-0412 --> tempo, preparation, and reliability goal;
- <!-- II-CLAUSE-0413 --> passage and transition;
- <!-- II-CLAUSE-0414 --> measured or reported outcome;
- <!-- II-CLAUSE-0415 --> confidence; and
- <!-- II-CLAUSE-0416 --> whether it is a hard personal limit, calibrated estimate, or descriptive observation.

<!-- II-CLAUSE-0417 --> A five-fret span is not a universal unit of difficulty: physical distance varies by scale length and fret location. <!-- II-CLAUSE-0418 --> Likewise, a geometrically reachable chord is not automatically repeatable or performance-reliable at tempo.

### Instrument Instance authoring and calibration

<!-- II-CLAUSE-0419 --> Exact mechanics are useful only if the Owner can create, inspect, select, and version the Instrument Instance that supplies them. <!-- II-CLAUSE-0420 --> Built-in templates are editable starting points, not measured personal instruments.

<!-- II-CLAUSE-0421 --> Every mechanically relevant field records value, unit, provenance, measurement method, uncertainty, and status as `measured`, `manufacturer_supplied`, `template_default`, `inferred`, or `unknown`. <!-- II-CLAUSE-0422 --> The authoring workflow supports:

- <!-- II-CLAUSE-0423 --> constituent strings and courses, spatial order, tuning, pitch reference, capo, and scordatura;
- <!-- II-CLAUSE-0424 --> scale and vibrating lengths, fret positions, neck and nut width, bridge and plucking-zone spacing, action, and setup;
- <!-- II-CLAUSE-0425 --> handedness and exact two-dimensional left-hand contact geometry;
- <!-- II-CLAUSE-0426 --> diapason, extension, or bass-rider layout and right-hand access geometry;
- <!-- II-CLAUSE-0427 --> notation identity and written-to-sounding behavior;
- <!-- II-CLAUSE-0428 --> photographs or diagrams with a scale reference, plausibility checks, repeated measurement, and Owner confirmation; and
- <!-- II-CLAUSE-0429 --> immutable versioning, default selection, diff, and dependency-aware staleness.

<!-- II-CLAUSE-0430 --> A partial Instrument Instance may support provisional generation. <!-- II-CLAUSE-0431 --> A mechanical, ergonomic, playable, or performance-reliable claim remains incomplete whenever a dimension used by its evaluator is defaulted, inferred, or unknown. <!-- II-CLAUSE-0432 --> Calibration creates a new immutable version and stales dependent searches, evaluations, and readiness evidence. <!-- II-CLAUSE-0433 --> Owner Ergonomic Profiles remain separate from instrument measurement.

### Phrase-level candidate state

<!-- II-CLAUSE-0434 --> Target compilers search phrases rather than greedily selecting each event.

<!-- II-CLAUSE-0435 --> Complete partial state includes, where applicable:

- <!-- II-CLAUSE-0436 --> current and prepared left-hand position;
- <!-- II-CLAUSE-0437 --> finger assignments, shared fingers, barré, releases, and guide fingers;
- <!-- II-CLAUSE-0438 --> right-hand resources, preparation, stroke, and bass access;
- <!-- II-CLAUSE-0439 --> held and resonating notes;
- <!-- II-CLAUSE-0440 --> required damping;
- <!-- II-CLAUSE-0441 --> active target voices and remaining durations;
- <!-- II-CLAUSE-0442 --> harmonic and cadential obligations;
- <!-- II-CLAUSE-0443 --> technique state and legal transitions;
- <!-- II-CLAUSE-0444 --> incoming state from the previous phrase;
- <!-- II-CLAUSE-0445 --> outgoing obligations for the next phrase; and
- <!-- II-CLAUSE-0446 --> active Commitments, Preservation Targets, and policy exceptions.

<!-- II-CLAUSE-0447 --> Visible passage regeneration expands to a musically and physically sufficient context. <!-- II-CLAUSE-0448 --> It may not optimize a selected box while ignoring sustained notes or impossible boundary transitions.

<!-- II-CLAUSE-0449 --> Phrase search remains subordinate to the work- and section-level Arrangement Plan. <!-- II-CLAUSE-0450 --> Repeated themes, planned variation, formal returns, global bass trajectory, technique arc, and cross-section commitments participate in phrase-state dominance and a section- or work-level composition search with backtracking. <!-- II-CLAUSE-0451 --> Post-search checking remains an independent validator, not the only mechanism enforcing global coherence; a locally preferred phrase candidate may not prune the only globally valid solution.

### Candidate output

<!-- II-CLAUSE-0452 --> An Arrangement Candidate includes:

- <!-- II-CLAUSE-0453 --> canonical notes, rhythms, voices, and event identities;
- <!-- II-CLAUSE-0454 --> target positions and exact Instrument Instance;
- <!-- II-CLAUSE-0455 --> constitutive technique events;
- <!-- II-CLAUSE-0456 --> hidden fingering or execution evidence when not engraved;
- <!-- II-CLAUSE-0457 --> Applied Knowledge Manifest and compiled constraints;
- <!-- II-CLAUSE-0458 --> Transformation Report and Preservation Audit;
- <!-- II-CLAUSE-0459 --> realized Target Voice, Harmonic, Relationship, Continuo, and Technique mappings;
- <!-- II-CLAUSE-0460 --> generator-visible Search Measurements and exact Selection Policy identity;
- <!-- II-CLAUSE-0461 --> retained non-dominated alternatives plus bounded representative rejection reasons and binding constraints;
- <!-- II-CLAUSE-0462 --> incoming and outgoing state;
- <!-- II-CLAUSE-0463 --> unknown and not-evaluated dimensions; and
- <!-- II-CLAUSE-0464 --> reproducible search identity.

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

<!-- II-CLAUSE-0465 --> Only `adopt` may create the referenced Arrangement Score, and only when every required applicable independent gate is complete and passing. <!-- II-CLAUSE-0466 --> `reject` records a conclusive candidate failure and may advance evaluation to the next committed survivor. <!-- II-CLAUSE-0467 --> `blocked` records unavailable execution or evidence; that candidate remains pending retry, and no later candidate may be adopted merely because infrastructure failed unless the Owner explicitly abandons the pending candidate or starts a new search. <!-- II-CLAUSE-0468 --> Neither outcome rewrites search order. <!-- II-CLAUSE-0469 --> Adoption is a canonical versioned service and workbench action, not an implicit side effect of storing or ranking a candidate.

### Search selection and independent evaluation

<!-- II-CLAUSE-0470 --> Search selection and independent evaluation are different stages. <!-- II-CLAUSE-0471 --> Search Measurements are generator-visible facts or estimates used by a versioned Selection Policy; they are search objectives, not independent certification.

<!-- II-CLAUSE-0472 --> Selection rejects hard-constraint violations, compares survivors lexicographically by Preservation Target and Target Voice Plan priority, applies versioned target- and policy-specific preferences, and retains materially different non-dominated candidates when consequential tradeoffs remain. <!-- II-CLAUSE-0473 --> A hidden weighted total may not replace this policy.

<!-- II-CLAUSE-0474 --> The candidate and search ordering are immutable before independent evaluation. <!-- II-CLAUSE-0475 --> Evaluation creates a separate Evaluation Card keyed to the candidate digest and cannot rewrite the Selection Decision. <!-- II-CLAUSE-0476 --> A separate immutable Adoption Decision determines whether a preordered candidate may become the default Arrangement Score. <!-- II-CLAUSE-0477 --> An independent required hard-gate failure blocks adoption and readiness; <!-- II-CLAUSE-0478 --> Vellum evaluates the next candidate in the already committed search order or starts a new search if none survives. <!-- II-CLAUSE-0479 --> Held-out evaluator results qualify or reject a sealed Generation System capability and never select or adopt candidates in the run they judge. <!-- II-CLAUSE-0480 --> A reviewed finding can influence a later compiler, profile, or Selection Policy only through the reviewed-learning boundary.

<!-- II-CLAUSE-0481 --> Every search identity records algorithm and component versions, deterministic seed and tie-breaking, budget, checkpoint, and terminal state. <!-- II-CLAUSE-0482 --> Terminal outcomes distinguish `found`, `unsat_proven`, `budget_exhausted`, `cancelled`, and `infrastructure_failed`. <!-- II-CLAUSE-0483 --> Exhaustion is never presented as proof that no playable realization exists.

## Five-course baroque-guitar compiler

### Orthogonal technique facets

<!-- II-CLAUSE-0484 --> Baroque-guitar technique is represented by compatible facets, not one flat mutually exclusive mode enum:

- <!-- II-CLAUSE-0485 --> attack family and texture: individually plucked attacks, strummed attacks, or an explicit passage containing both;
- <!-- II-CLAUSE-0486 --> chord vocabulary: optional alfabeto chart, symbol, and shape identity;
- <!-- II-CLAUSE-0487 --> course-allocation and resonance strategy: ordinary allocation, campanella, held harmony, and required damping;
- <!-- II-CLAUSE-0488 --> rhythmic gesture vocabulary: single stroke, batterie or battuto pattern, repicco, arpeggiation, and source-scoped variants;
- <!-- II-CLAUSE-0489 --> left-hand state: shape, barré, retained fingers, releases, and preparation; and
- <!-- II-CLAUSE-0490 --> notation, playback, and constitutive-versus-interpretive status.

<!-- II-CLAUSE-0491 --> `mixed style` is the user-facing description of a phrase plan that composes or transitions among plucked and strummed attacks. <!-- II-CLAUSE-0492 --> Alfabeto is a chord vocabulary that may participate in rasgueado; it is not a competing attack mode. <!-- II-CLAUSE-0493 --> Campanella is a course-allocation and sustain strategy that may coexist with punteado. <!-- II-CLAUSE-0494 --> Batterie and repicco are gesture sequences. <!-- II-CLAUSE-0495 --> Applicability and naming remain source- and profile-scoped.

<!-- II-CLAUSE-0496 --> Every selected combination has explicit candidate generation, physical state, notation, playback, and evaluation consequences. <!-- II-CLAUSE-0497 --> Unsupported combinations are conflicts, not silently normalized labels.

### Exact target configuration

<!-- II-CLAUSE-0498 --> The compiler consumes:

- <!-- II-CLAUSE-0499 --> single and doubled course construction;
- <!-- II-CLAUSE-0500 --> unison or octave pairing;
- <!-- II-CLAUSE-0501 --> re-entrant or bourdon stringing;
- <!-- II-CLAUSE-0502 --> tuning and pitch reference;
- <!-- II-CLAUSE-0503 --> exact scale length, fret positions, course spacing, neck width, action and setup, and two-dimensional course-and-fret contact geometry required by the selected evaluator;
- <!-- II-CLAUSE-0504 --> available alfabeto chart releases;
- <!-- II-CLAUSE-0505 --> notation convention; and
- <!-- II-CLAUSE-0506 --> performer and technique context.

<!-- II-CLAUSE-0507 --> No generic five-line fretboard may silently stand in for these facts.

### Punteado

<!-- II-CLAUSE-0508 --> Punteado search tracks individual right-hand allocation, preparation, alternation, repeated-course behavior, simultaneity, held notes, and left-hand transitions.

<!-- II-CLAUSE-0509 --> Right-hand digit resources are source- and profile-scoped. <!-- II-CLAUSE-0510 --> Vellum must not encode a universal three-finger rule: Sanz explicitly permits a fourth right-hand finger in some four-voice contexts. <!-- II-CLAUSE-0511 --> A profile may prefer or limit particular digits for a school, source, texture, or performer, but the scope and evidence remain inspectable.

<!-- II-CLAUSE-0512 --> Large simultaneities cannot be labeled idiomatic punteado merely because the left hand can form them. <!-- II-CLAUSE-0513 --> The compiler either finds a supported plucked allocation, selects a historically and musically valid strummed event, reduces the texture under policy, or reports the conflict.

### Rasgueado and alfabeto

<!-- II-CLAUSE-0514 --> A constitutive strummed or multi-attack event resolves to a Gesture Sequence.

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

<!-- II-CLAUSE-0515 --> The sequence records beat and subdivision, attack order, exact right-hand allocation, stroke path, sounded, omitted, and muted courses, constituent-string sounding pitches, held state, releases, and damping. <!-- II-CLAUSE-0516 --> `traversedCourses` is ordered in physical stroke order; sounded and muted sets are disjoint subsets of it, and every sounded course has exactly one Resolved Course Attack. <!-- II-CLAUSE-0517 --> A normal course attack's constituent set equals the exact Instrument Instance construction; search cannot selectively pluck one member of a doubled course. <!-- II-CLAUSE-0518 --> Selective constituent attack is legal only through an explicit exceptional-technique ref with applicable evidence, notation, playback, and evaluation semantics. <!-- II-CLAUSE-0519 --> Playback consumes canonical constituent attacks rather than independently expanding course numbers. <!-- II-CLAUSE-0520 --> Stroke traversal and simultaneous chord notation do not erase temporal attack order. <!-- II-CLAUSE-0521 --> A batterie or repicco pattern contains its ordered gestures rather than one generic stroke field.

<!-- II-CLAUSE-0522 --> An alfabeto binding separately retains harmonic intent, exact source chart and pack release, symbol and shape identity, tuning and stringing compatibility, left-hand shape and barré, and notation ambiguity. <!-- II-CLAUSE-0523 --> Harmonic-bass or inversion intent remains distinct from the actual lowest sounding constituent string and from Continuo Disposition.

<!-- II-CLAUSE-0524 --> Stroke path and sounding courses are different. <!-- II-CLAUSE-0525 --> Vellum must not assume either that every stroke sounds all five courses or that only edge courses may be omitted. <!-- II-CLAUSE-0526 --> Corbetta and other sources require context-specific course suppression and sometimes ambiguous notation. <!-- II-CLAUSE-0527 --> A selected profile determines which masks are supported, preferred, uncertain, or prohibited.

<!-- II-CLAUSE-0528 --> Computed voicings do not silently replace a known applicable alfabeto vocabulary. <!-- II-CLAUSE-0529 --> Conversely, alfabeto shape lookup does not prove that a chord is appropriate at that point in the musical plan.

### Mixed style

<!-- II-CLAUSE-0530 --> Mixed style is planned across a phrase:

- <!-- II-CLAUSE-0531 --> chordal and linear functions are identified;
- <!-- II-CLAUSE-0532 --> held chord shapes and released notes remain explicit;
- <!-- II-CLAUSE-0533 --> punteado-to-rasgueado transitions are physically evaluated;
- <!-- II-CLAUSE-0534 --> the Principal Voice stays recognizable and perceptually prominent;
- <!-- II-CLAUSE-0535 --> course suppression and re-entrant bass consequences are disclosed; and
- <!-- II-CLAUSE-0536 --> notation and Audio Preview express the selected event kinds rather than flattening them into simultaneous MIDI notes.

### Baroque-guitar acceptance

<!-- II-CLAUSE-0537 --> For the Greensleeves regression:

- <!-- II-CLAUSE-0538 --> every protected Principal Voice event remains correct and perceptually prominent;
- <!-- II-CLAUSE-0539 --> the compiler declares punteado, rasgueado, or mixed style by passage;
- <!-- II-CLAUSE-0540 --> every simultaneity has a supported right-hand or stroke realization;
- <!-- II-CLAUSE-0541 --> alfabeto shapes cite the exact chart release;
- <!-- II-CLAUSE-0542 --> transitions are evaluated across phrase boundaries;
- <!-- II-CLAUSE-0543 --> the observed extreme reach/jump cannot receive an unqualified playable result;
- <!-- II-CLAUSE-0544 --> strum masks and held harmony survive engraving and playback; and
- <!-- II-CLAUSE-0545 --> materially different valid technique plans remain comparable in the workbench.

## Thirteen-course baroque-lute compiler

### Exact target configuration

<!-- II-CLAUSE-0546 --> The compiler consumes:

- <!-- II-CLAUSE-0547 --> all constituent strings and course construction;
- <!-- II-CLAUSE-0548 --> six stopped-course tuning and stringing;
- <!-- II-CLAUSE-0549 --> seven unstopped diapasons and current Bass Tuning;
- <!-- II-CLAUSE-0550 --> exact stopped-string vibrating lengths and fret positions;
- <!-- II-CLAUSE-0551 --> exact constituent-string and course order and spacing at nut, bridge, and every modeled plucking zone;
- <!-- II-CLAUSE-0552 --> diapason, bass-rider, or extension layout, attachment path, and spatial access;
- <!-- II-CLAUSE-0553 --> neck width, action, setup, pitch reference, and temperament or fret-placement assumptions used by evaluation;
- <!-- II-CLAUSE-0554 --> notation identity per course;
- <!-- II-CLAUSE-0555 --> exact right-hand position and reach inputs rather than an undifferentiated bass-access flag;
- <!-- II-CLAUSE-0556 --> performer and reliability context; and
- <!-- II-CLAUSE-0557 --> applicable historical, modern-pedagogical, and software profiles.

<!-- II-CLAUSE-0558 --> The current editor default may be a thirteen-course D-minor-tuning configuration. <!-- II-CLAUSE-0559 --> It must not be described as the universal historical default.

<!-- II-CLAUSE-0560 --> When plucking-zone or diapason-access geometry is absent, right-hand reach, crossing, and transition readiness remain incomplete. <!-- II-CLAUSE-0561 --> Contrastive tests vary course spacing and bass layout while retaining the same tuning so pitch identity cannot masquerade as physical access.

### Joint left-hand search

<!-- II-CLAUSE-0562 --> Search tracks:

- <!-- II-CLAUSE-0563 --> physical span in millimeters as well as fret interval;
- <!-- II-CLAUSE-0564 --> assigned left-hand fingers;
- <!-- II-CLAUSE-0565 --> position and hand frame;
- <!-- II-CLAUSE-0566 --> shared or retained fingers;
- <!-- II-CLAUSE-0567 --> barré;
- <!-- II-CLAUSE-0568 --> preparation and release;
- <!-- II-CLAUSE-0569 --> longitudinal shifts;
- <!-- II-CLAUSE-0570 --> simultaneous and successive stretches;
- <!-- II-CLAUSE-0571 --> exact finger-pair contact geometry and transition trajectory;
- <!-- II-CLAUSE-0572 --> stopped-course stringing effects;
- <!-- II-CLAUSE-0573 --> incoming and outgoing phrase state; and
- <!-- II-CLAUSE-0574 --> tempo, preparation, and reliability goal.

<!-- II-CLAUSE-0575 --> The Owner's approximately 690 mm Instrument Instance is a first-class regression context. <!-- II-CLAUSE-0576 --> The Greensleeves f/b combination spanning frets 1 through 5 must fail the applicable personal or calibrated ergonomic gate when a closer valid realization exists.

### Diapasons, resonance, and right hand

<!-- II-CLAUSE-0577 --> Open diapason changes are not left-hand shifts. <!-- II-CLAUSE-0578 --> They require independent modeling of:

- <!-- II-CLAUSE-0579 --> digit allocation and preparation;
- <!-- II-CLAUSE-0580 --> simultaneous stopped-course attacks;
- <!-- II-CLAUSE-0581 --> alternation, repetition, and course crossing;
- <!-- II-CLAUSE-0582 --> thumb behavior and hand position under the applicable profile;
- <!-- II-CLAUSE-0583 --> right-hand preparation and reach;
- <!-- II-CLAUSE-0584 --> bass-course succession;
- <!-- II-CLAUSE-0585 --> stopped-course-to-diapason and diapason-to-stopped-course transitions;
- <!-- II-CLAUSE-0586 --> resonance and overlap;
- <!-- II-CLAUSE-0587 --> required damping;
- <!-- II-CLAUSE-0588 --> voice and harmonic function;
- <!-- II-CLAUSE-0589 --> retuning;
- <!-- II-CLAUSE-0590 --> notational course identity; and
- <!-- II-CLAUSE-0591 --> sounding pitch.

<!-- II-CLAUSE-0592 --> Style brisé, resonance, bass deployment, and contrapuntal distribution apply only under matching profiles. <!-- II-CLAUSE-0593 --> They are not generic rewards for open strings.

### French tablature and unresolved notation

<!-- II-CLAUSE-0594 --> Course identity is independent of pitch. <!-- II-CLAUSE-0595 --> Under currently cited twelve-course evidence from Mace, courses 7 through 12 use:

1. <!-- II-CLAUSE-0596 --> a
2. <!-- II-CLAUSE-0597 --> /a
3. <!-- II-CLAUSE-0598 --> //a
4. <!-- II-CLAUSE-0599 --> ///a
5. <!-- II-CLAUSE-0600 --> 4
6. <!-- II-CLAUSE-0601 --> 5

<!-- II-CLAUSE-0602 --> No slash is prepended to 4 or 5. <!-- II-CLAUSE-0603 --> The thirteenth-course sign is not established by that source. <!-- II-CLAUSE-0604 --> A value such as 6 may be used only as an explicitly named modern editorial or software convention until a directly applicable source supports it. <!-- II-CLAUSE-0605 --> The notation mapping belongs to the exact Notation Configuration or applicable pack profile; unknown remains unknown and is never inferred from sequence alone.

<!-- II-CLAUSE-0606 --> Golden engraving tests separately verify semantic course, rendered sign, below-staff placement, sounding pitch, and playback identity.

### Thirteen-course evidence and readiness

<!-- II-CLAUSE-0607 --> Thirteen-course readiness is dimension-specific:

- <!-- II-CLAUSE-0608 --> `mechanically_modeled` means that the represented thirteen-course configuration and declared deterministic mechanics are complete for the selected evaluator scope; unmeasured resonance, damping, hand access, reliability, and human behavior remain unknown until separately evaluated;
- <!-- II-CLAUSE-0609 --> `editorially_notated` means that every course renders and plays back under an explicitly named modern editorial or software convention whose profile does not claim historical authenticity for unresolved signs; and
- <!-- II-CLAUSE-0610 --> `historically_scoped` applies only to notation, stringing, bass practice, or technique dimensions supported by directly applicable released evidence.

<!-- II-CLAUSE-0611 --> A mechanically modeled course 13 may use `6` under an identified editorial profile; historical authenticity is then `not_claimed`, not silently passed or left as a required unknown. <!-- II-CLAUSE-0612 --> An output that claims historically scoped course-13 notation must instead resolve the historical dimension and remains provisional while it is unknown. <!-- II-CLAUSE-0613 --> Eleven- or twelve-course evidence may support claims that genuinely carry over, but it cannot establish course-13 notation, geometry, or bass access by numerical extrapolation. <!-- II-CLAUSE-0614 --> A repertoire source that omits its lowest available course does not establish the instrument's course count.

<!-- II-CLAUSE-0615 --> Historically scoped readiness for a course-13-specific claim requires resolved source identity, an exact Source Segment Version, reviewed interpretation, applicable profile, released pack, and required attestation. <!-- II-CLAUSE-0616 --> Until then, a historically scoped output keeps that dimension unknown, while an editorial-profile deliverable discloses the convention and records historical authenticity as `not_claimed`.

### Baroque-lute acceptance

<!-- II-CLAUSE-0617 --> For the Greensleeves regression:

- <!-- II-CLAUSE-0618 --> the bundle identifies French-tablature letters `f` and `b`, their courses and event IDs, onset and duration, incoming and outgoing state, Instrument Instance, tempo, and reliability goal;
- <!-- II-CLAUSE-0619 --> the known reach is rejected and the bundle's independently reviewed closer equivalent is generated; <!-- II-CLAUSE-0620 --> `budget_exhausted` or an unverified claim that none exists does not pass;
- <!-- II-CLAUSE-0621 --> left-hand and right-hand costs are not conflated;
- <!-- II-CLAUSE-0622 --> diapason use preserves voice and harmonic intent;
- <!-- II-CLAUSE-0623 --> resonance and damping obligations are explicit;
- <!-- II-CLAUSE-0624 --> the Principal Voice remains recognizable;
- <!-- II-CLAUSE-0625 --> tablature and playback agree on course identity and pitch; and
- <!-- II-CLAUSE-0626 --> the thirteenth sign is disclosed as sourced, editorial, or unresolved.

## Six-string classical-guitar compiler

### Exact target and performer configuration

<!-- II-CLAUSE-0627 --> The compiler consumes:

- <!-- II-CLAUSE-0628 --> six exact constituent strings, tuning, scordatura, capo state, and pitch reference;
- <!-- II-CLAUSE-0629 --> scale length, fret positions, nut and bridge string spacing, neck profile, action, and setup facts required by the selected evaluator;
- <!-- II-CLAUSE-0630 --> left- or right-handed configuration and exact two-dimensional string-and-fret contact geometry;
- <!-- II-CLAUSE-0631 --> Intended Performer Profile, selected Owner Ergonomic Profile, tempo, preparation, and reliability goal;
- <!-- II-CLAUSE-0632 --> notation configuration, including the Classical Guitar Staff written-to-sounding octave; and
- <!-- II-CLAUSE-0633 --> applicable historical, pedagogical, editorial, software, and personal profiles.

<!-- II-CLAUSE-0634 --> No generic six-line fretboard or `EADGBE` label may silently stand in for the exact Target Configuration.

### Joint left- and right-hand realization

<!-- II-CLAUSE-0635 --> Right-hand state includes p-i-m-a allocation where applicable, preparation, simultaneous attacks, alternation, repeated-finger and repeated-string behavior, crossing, thumb/finger independence, arpeggio order, constitutive stroke, articulation, damping, and the state prepared for the next attack. <!-- II-CLAUSE-0636 --> These choices are profile- and performer-scoped rather than one universal pedagogical system.

<!-- II-CLAUSE-0637 --> Left-hand state includes exact fingers, position and hand frame, barré, guide and retained fingers, release, sustain, slur mechanics, shifts, and two-dimensional geometry of simultaneous and successive contacts. <!-- II-CLAUSE-0638 --> Mechanical impossibility is a hard failure; ergonomic reliability and idiomatic preference retain separate evidence.

<!-- II-CLAUSE-0639 --> Right- and left-hand plans remain linked evidence when standard notation omits fingering. <!-- II-CLAUSE-0640 --> A candidate cannot earn an idiomatic or performance-reliable result merely because every pitch has an isolated fretboard position.

### Target Voice Plan is mandatory

<!-- II-CLAUSE-0641 --> For music containing a Principal Voice and meaningful subordinate line, the default plan contains:

- <!-- II-CLAUSE-0642 --> a Principal Voice with explicit active spans and composed rests;
- <!-- II-CLAUSE-0643 --> a coherent Bass or Countervoice with its own activity, cadence, harmonic-function, duration, and relationship obligations;
- <!-- II-CLAUSE-0644 --> optional Inner Fill whose omission priority is lower than either structural voice; and
- <!-- II-CLAUSE-0645 --> explicit inversion, rhythmic, voice-exchange, crossing, and voice-duration obligations.

<!-- II-CLAUSE-0646 --> A sparse or intermittent bass may be valid only when its Voice and Relationship Plans explain its active spans and structural work. <!-- II-CLAUSE-0647 --> Neither continuous sound nor event count proves coherence. <!-- II-CLAUSE-0648 --> Isolated bass events cannot be presented as a successful two-voice arrangement merely because a minimum count was met.

### Joint polyphonic search

<!-- II-CLAUSE-0649 --> Search tracks all planned voices together:

- <!-- II-CLAUSE-0650 --> onset, duration, release, and tie identity;
- <!-- II-CLAUSE-0651 --> voice continuity and crossing;
- <!-- II-CLAUSE-0652 --> bass motion, inversion, cadence, and harmonic function;
- <!-- II-CLAUSE-0653 --> dissonance preparation and resolution;
- <!-- II-CLAUSE-0654 --> sustain and open-string resonance;
- <!-- II-CLAUSE-0655 --> left-hand position, fingers, shifts, guide fingers, and barré;
- <!-- II-CLAUSE-0656 --> right-hand allocation and repeated-string constraints;
- <!-- II-CLAUSE-0657 --> phrase boundary state; and
- <!-- II-CLAUSE-0658 --> policy-authorized omission or redistribution.

<!-- II-CLAUSE-0659 --> Event-local pitch placement cannot erase a voice in order to improve average fret or open-string scores.

### Notation and playback

<!-- II-CLAUSE-0660 --> Classical-guitar standard notation is a first-class Notation Layout, not tablature with labels removed. <!-- II-CLAUSE-0661 --> Canonical voice identities drive spelling, stems, rests, ties, duration, and layout. <!-- II-CLAUSE-0662 --> Hidden fingering plans remain linked evidence even when the printed score omits fingerings.

<!-- II-CLAUSE-0663 --> Audio Preview can isolate every planned target voice. <!-- II-CLAUSE-0664 --> A voice that vanishes during a declared active span or fails its continuity obligations is a hard failure; a planned rest is not.

<!-- II-CLAUSE-0665 --> Isolation verifies lineage and audibility, not perceptual prominence. <!-- II-CLAUSE-0666 --> A deterministic prominence gate checks explicit registral, onset, duration, role, and masking obligations; any remaining perceptual claim requires the declared listening-review authority.

### Classical-guitar acceptance

<!-- II-CLAUSE-0667 --> For the Greensleeves regression:

- <!-- II-CLAUSE-0668 --> the Principal Voice remains note- and rhythm-correct;
- <!-- II-CLAUSE-0669 --> the Bass or Countervoice satisfies its declared continuity and cadence plan;
- <!-- II-CLAUSE-0670 --> the source's substantial bass cannot collapse to four isolated events without an explicit Plan Conflict or policy-authorized disclosure;
- <!-- II-CLAUSE-0671 --> all simultaneous notes and durations are mechanically realizable;
- <!-- II-CLAUSE-0672 --> every attack has compatible left- and right-hand preparation and transition state under the exact target and performer context;
- <!-- II-CLAUSE-0673 --> declared voice activity spans distinguish composed rests from dropped events;
- <!-- II-CLAUSE-0674 --> bass success is evaluated from source mapping, harmonic and cadential obligations, durations, and relationships rather than event count;
- <!-- II-CLAUSE-0675 --> notation displays the intended polyphony clearly;
- <!-- II-CLAUSE-0676 --> isolated playback confirms each voice; and
- <!-- II-CLAUSE-0677 --> alternate reductions expose genuine musical tradeoffs rather than cosmetic fingerings.

## Evaluation and grading

<!-- II-CLAUSE-0678 --> Evaluation answers three separate questions:

1. <!-- II-CLAUSE-0679 --> Did output violate an authoritative invariant?
2. <!-- II-CLAUSE-0680 --> Did observable or reviewed quality improve, regress, or remain uncertain?
3. <!-- II-CLAUSE-0681 --> Is a difference caused by product code, source or pack input, compiler semantics, evaluator semantics, or intentional design?

<!-- II-CLAUSE-0682 --> There is no single overall grade. <!-- II-CLAUSE-0683 --> Hard failures cannot be averaged away, and subjective quality cannot be manufactured from deterministic proxy totals.

### Evaluation layers

<!-- II-CLAUSE-0684 --> The instrument-intelligence program adds the following layers to the existing harness:

1. <!-- II-CLAUSE-0685 --> provenance, identity, rights, and private-export contract tests;
2. <!-- II-CLAUSE-0686 --> Page Atlas and modality-routing fixtures;
3. <!-- II-CLAUSE-0687 --> extraction and cited-segment fixtures;
4. <!-- II-CLAUSE-0688 --> Knowledge Candidate, conflict graph, review, release, and retraction tests;
5. <!-- II-CLAUSE-0689 --> Applied Knowledge Manifest and applicability tests;
6. <!-- II-CLAUSE-0690 --> compiler property, differential, replay, and mutation tests;
7. <!-- II-CLAUSE-0691 --> output-level musical, mechanical, ergonomic, idiom, notation, and playback evaluation;
8. <!-- II-CLAUSE-0692 --> cross-target source-to-deliverable end-to-end cases; and
9. <!-- II-CLAUSE-0693 --> late role-scoped human and physical review.

<!-- II-CLAUSE-0694 --> Component cases may pin reviewed downstream inputs to isolate a stage. <!-- II-CLAUSE-0695 --> End-to-end cases begin with source assets, Arrangement Briefs, and Performance Briefs. <!-- II-CLAUSE-0696 --> Evaluator-only expectations, forbidden outcomes, reference answers, baseline outputs, and held-out labels are unavailable to generation, planning, search, prompts, and profile fitting.

### Independent observable dimensions

<!-- II-CLAUSE-0697 --> Evaluation Cards retain separate dimensions for:

- <!-- II-CLAUSE-0698 --> source authority and unresolved uncertainty;
- <!-- II-CLAUSE-0699 --> Applied Knowledge Manifest completeness;
- <!-- II-CLAUSE-0700 --> Principal Voice and other Preservation Targets;
- <!-- II-CLAUSE-0701 --> Target Voice Plan realization;
- <!-- II-CLAUSE-0702 --> bass, Continuo Foundation, and cadence behavior;
- <!-- II-CLAUSE-0703 --> target mechanics;
- <!-- II-CLAUSE-0704 --> ergonomic estimate and exact personal evidence;
- <!-- II-CLAUSE-0705 --> intended-technique realization;
- <!-- II-CLAUSE-0706 --> historical or editorial evidence;
- <!-- II-CLAUSE-0707 --> notation semantics and legibility;
- <!-- II-CLAUSE-0708 --> literal playback and Performed Form;
- <!-- II-CLAUSE-0709 --> workflow recovery and lineage;
- <!-- II-CLAUSE-0710 --> human or physical evidence; and
- <!-- II-CLAUSE-0711 --> explicit Owner usefulness.

<!-- II-CLAUSE-0712 --> Each dimension records applicability, execution status, completeness, authority, evidence basis, permitted presentation, units, uncertainty, and observations. <!-- II-CLAUSE-0713 --> Unknown is never encoded as zero, neutral, or pass.

<!-- II-CLAUSE-0714 --> Every acceptance sentence has a versioned Requirement Ledger entry naming observable inputs, hard-gate or rubric status, evaluator identity and implementation boundary, outcome vocabulary, units or threshold where meaningful, uncertainty behavior, contamination role, and authorized human role. <!-- II-CLAUSE-0715 --> Adjectives such as coherent, prominent, supported, idiomatic, equivalent, meaningful, or clear are not executable until such an entry exists. <!-- II-CLAUSE-0716 --> Public repository ledgers may name development mutations directly, but held-out-specific expectations, forbidden outcomes, mutations, reserve order, and exact case identity live only in a Vault Requirement Ledger. <!-- II-CLAUSE-0717 --> The public ledger retains random non-resolving IDs, public coverage classes, keyed non-resolving Vault commitments, digests only of bytes already authorized for public disclosure, bounded aggregate states, and schema-constrained redaction receipts. <!-- II-CLAUSE-0718 --> It never publishes a direct digest of hidden truth, a hidden source, or other guessable private material.

### Generator and evaluator separation

<!-- II-CLAUSE-0719 --> The same pack may explain why an evaluator applies and provide cited rubric anchors. <!-- II-CLAUSE-0720 --> It may not certify its own output. <!-- II-CLAUSE-0721 --> Evaluators inspect the generated canonical notes, rhythms, voices, positions, technique events, engraving, and playback.

<!-- II-CLAUSE-0722 --> Compiler assertions such as preserved principal voice, idiomatic, playable, historical profile, or coherent bass are hypotheses until the appropriate independent evaluator checks observable output.

<!-- II-CLAUSE-0723 --> Independence includes implementation boundaries. <!-- II-CLAUSE-0724 --> A compiler and evaluator may share immutable normative evidence, but they may not both trust the compiler's success flag or the same unverified derived decision function. <!-- II-CLAUSE-0725 --> Critical invariants use recomputation from canonical output, differential or fixture oracles, mutations, and role-scoped review to expose common-mode errors.

### Enforced evaluation isolation

<!-- II-CLAUSE-0726 --> Isolation is an information-flow boundary, not a naming convention. <!-- II-CLAUSE-0727 --> The evaluation orchestrator may resolve the complete manifest, but generation receives only a serialized Generation Input Envelope containing source input, Briefs, activated pack releases, generation component identities, Instrument Instance, and search budget, seed, and tie-breaking policy.

<!-- II-CLAUSE-0728 --> Expectations, forbidden outcomes, reference answers, baselines, mutations, held-out labels, and human preferences live in an evaluator-only store that generation, planning, prompts, pack resolution, search, and Selection Policy fitting cannot read. <!-- II-CLAUSE-0729 --> The orchestrator persists immutable generated output before loading evaluator-only data.

<!-- II-CLAUSE-0730 --> A Generation System identity pins the transitive closure of source-analysis, planning, prompts, activated packs and examples, compiler and search code, model and provider configuration, fitted parameters, Selection Policy, runtime, and every upstream component capable of revealing or fitting the expected answer. <!-- II-CLAUSE-0731 --> A case is held out only relative to that entire consumer closure, never merely one named compiler.

<!-- II-CLAUSE-0732 --> Contract tests place canaries in serialized case data, environment variables, prompts, filesystem paths, manifests, and evaluator stores and prove that none reaches generation. <!-- II-CLAUSE-0733 --> Passing a complete Evaluation Case or resolved evaluator manifest into the generation process violates this boundary.

### Hard-gate and acceptance status

<!-- II-CLAUSE-0734 --> Every hard-gate definition declares whether it is required for the applicable case. <!-- II-CLAUSE-0735 --> Per-gate execution status, evidence completeness, and result remain orthogonal. <!-- II-CLAUSE-0736 --> Aggregate status uses this precedence:

- <!-- II-CLAUSE-0737 --> `fail` when any required applicable gate conclusively establishes a product or output violation;
- <!-- II-CLAUSE-0738 --> otherwise `blocked` at the enclosing acceptance level when required execution cannot proceed because a source, Access Decision, provider, evaluator, Vault, or infrastructure dependency is unavailable;
- <!-- II-CLAUSE-0739 --> otherwise `incomplete` when any required gate has unfinished, partial, unknown, or unevaluated evidence; and
- <!-- II-CLAUSE-0740 --> `pass` only when every required applicable gate completed with complete evidence and passed.

<!-- II-CLAUSE-0741 --> `hardGateStatus` is `pass`, `fail`, or `incomplete`; blocking execution is recorded on the affected gate and aggregated as `acceptanceStatus: blocked` unless a conclusive required failure already establishes `fail`. <!-- II-CLAUSE-0742 --> The enclosing `acceptanceStatus` is `pass`, `fail`, `blocked`, or `incomplete`. <!-- II-CLAUSE-0743 --> Neither blocked nor incomplete can be presented as pass.

<!-- II-CLAUSE-0744 --> Unknown is never converted to pass. <!-- II-CLAUSE-0745 --> The UI may say `no failure observed` for incomplete evidence, but not `hard gates pass`. <!-- II-CLAUSE-0746 --> Arrangement Readiness cannot be ready while hard-gate status is incomplete.

### Dataset assignments and contamination groups

<!-- II-CLAUSE-0747 --> A dataset role belongs to the tuple of contamination-group identity, exact Generation System consumer closure or evaluator consumer, exact consumer version, and immutable split-manifest identity. <!-- II-CLAUSE-0748 --> It does not belong globally to a file or one nominal compiler.

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

<!-- II-CLAUSE-0749 --> The Vault Split Manifest precommits exactly one Holdout Run Ledger genesis. <!-- II-CLAUSE-0750 --> The Vault enforces one compare-and-swap current head for that manifest; <!-- II-CLAUSE-0751 --> every ledger version descends from the genesis through a required predecessor ref, every fork remains retained, and an unreconciled fork invalidates qualification. <!-- II-CLAUSE-0752 --> The Vault Requirement Ledger, Holdout Attempts, invalidation decisions, genesis, ledger versions, and head live inside the Owner Evaluation Vault. <!-- II-CLAUSE-0753 --> Ordinary generation receives none of them; the evaluator exposes only the source envelope selected by the committed manifest. <!-- II-CLAUSE-0754 --> Every attempt, including blocked, incomplete, failed, and invalid attempts, is appended in manifest-derived order. <!-- II-CLAUSE-0755 --> A valid failure references a permanent regression; invalid attempts cannot count as passes. <!-- II-CLAUSE-0756 --> Capability Qualification pins a finalized head proven to descend from the precommitted genesis. <!-- II-CLAUSE-0757 --> A successor manifest inherits accumulated regressions and the predecessor's unconsumed reserve cursor and cannot reseed or reorder that remainder.

<!-- II-CLAUSE-0758 --> A contamination group includes every artifact that can reveal substantially the same answer to that consumer: all editions and scans of the same Work, excerpts, crops, transcriptions, translations, analyses, arrangements, extracted examples, candidates, and claims or profiles authored from them. <!-- II-CLAUSE-0759 --> A conservative split may additionally group by composer, school, source family, tune family, transposition, near duplicate, or shared editorial derivation.

<!-- II-CLAUSE-0760 --> Roles remain:

- <!-- II-CLAUSE-0761 --> derivation, profile, prompt, compiler, parameter, or Selection Policy fitting and authoring;
- <!-- II-CLAUSE-0762 --> development and debugging;
- <!-- II-CLAUSE-0763 --> evaluator calibration;
- <!-- II-CLAUSE-0764 --> held-out evaluation; or
- <!-- II-CLAUSE-0765 --> post-deployment monitoring.

<!-- II-CLAUSE-0766 --> The same artifact may have different explicit roles for demonstrably unrelated consumers, such as OMR development and a downstream evaluator. <!-- II-CLAUSE-0767 --> A group held out for a Generation System is unavailable to its entire transitive source-analysis, planning, prompt, activated-pack, compiler, parameter-fitting, and Selection Policy closure and to evaluator calibration.

<!-- II-CLAUSE-0768 --> Moving a group creates a new split manifest and invalidates incompatible comparisons. <!-- II-CLAUSE-0769 --> Once a held-out expectation or result informs product, profile, Selection Policy, or evaluator changes, that group becomes permanent disclosed development-regression evidence for every affected successor version. <!-- II-CLAUSE-0770 --> It remains mandatory in addition to—not instead of—fresh held-out-from-development groups.

### Required mutations

<!-- II-CLAUSE-0771 --> The evaluation corpus must detect at least:

- <!-- II-CLAUSE-0772 --> Principal Voice pitch, timing, order, phrase, prominence, or cadence loss;
- <!-- II-CLAUSE-0773 --> collapse of two source voices sharing one part or staff, cross-staff identity loss, or a wrong voice exchange;
- <!-- II-CLAUSE-0774 --> harmonic-rhythm, bass, inversion, essential-dissonance, tendency-resolution, or cadence corruption despite a preserved melody;
- <!-- II-CLAUSE-0775 --> a wrong part-scoped written-to-sounding mapping, internal key or meter change, capo, or scordatura mapping;
- <!-- II-CLAUSE-0776 --> a multi-segment tie retrigger, lost slur, or source-notated ornament silently discarded;
- <!-- II-CLAUSE-0777 --> lyric verse, syllable, hyphen, elision, melisma, or event-alignment corruption when text is in scope;
- <!-- II-CLAUSE-0778 --> a disappearing or rhythmically incoherent classical-guitar bass;
- <!-- II-CLAUSE-0779 --> a false two-voice declaration;
- <!-- II-CLAUSE-0780 --> the known lute f/b stretch;
- <!-- II-CLAUSE-0781 --> an invented or collapsed lute diapason sign;
- <!-- II-CLAUSE-0782 --> a wrong alfabeto chart or shape;
- <!-- II-CLAUSE-0783 --> an unscoped universal three-finger baroque-guitar rule;
- <!-- II-CLAUSE-0784 --> an unsupported strum mask;
- <!-- II-CLAUSE-0785 --> a broken punteado, rasgueado, or mixed-style transition;
- <!-- II-CLAUSE-0786 --> a baroque-guitar reach or transition falsely accepted by fret-only rather than two-dimensional course-and-fret geometry;
- <!-- II-CLAUSE-0787 --> a strummed Gesture Sequence flattened into one simultaneous MIDI chord;
- <!-- II-CLAUSE-0788 --> a course mask with missing, duplicated, or octave-corrupted constituent-string attacks;
- <!-- II-CLAUSE-0789 --> an impossible lute right-hand digit allocation, simultaneous stopped-course attack, alternation, crossing, thumb behavior, or stopped-course-to-diapason transition;
- <!-- II-CLAUSE-0790 --> held-note, damping, or duration corruption;
- <!-- II-CLAUSE-0791 --> a figured-bass figure, accidental, bass alignment, continuation, or suspension corruption;
- <!-- II-CLAUSE-0792 --> an imitative entry-order, subject-shape, voice-identity, timing, or cadence corruption;
- <!-- II-CLAUSE-0793 --> right- and left-hand cost conflation;
- <!-- II-CLAUSE-0794 --> an applicable pack omitted from search identity;
- <!-- II-CLAUSE-0795 --> an inapplicable or conflicting profile treated as active;
- <!-- II-CLAUSE-0796 --> a test-only profile activated in default or ready output;
- <!-- II-CLAUSE-0797 --> an extraction promoted without review;
- <!-- II-CLAUSE-0798 --> an unknown required hard gate displayed as passed;
- <!-- II-CLAUSE-0799 --> evaluator-only data reaching generation;
- <!-- II-CLAUSE-0800 --> a private source exported without authority;
- <!-- II-CLAUSE-0801 --> private source content sent to a provider without an applicable Access Decision;
- <!-- II-CLAUSE-0802 --> notation and playback disagreement; and
- <!-- II-CLAUSE-0803 --> an evaluator or pack attempting to self-certify.

<!-- II-CLAUSE-0804 --> Mutation success proves sensitivity only to the mutated class. <!-- II-CLAUSE-0805 --> It does not imply general musical correctness.

### Coequal Golden Engraving and Playback Fixtures

<!-- II-CLAUSE-0806 --> Each initial target has an exact semantic-to-rendered-to-sounding fixture:

- <!-- II-CLAUSE-0807 --> **baroque guitar**: punteado allocation, alfabeto binding, ordered up- and down-strokes, course suppression, octave-paired constituent pitches, held harmony, release, and damping;
- <!-- II-CLAUSE-0808 --> **baroque lute**: the accepted diapason fixture plus a stopped doubled-course and stopped-course-to-diapason right-hand transition; and
- <!-- II-CLAUSE-0809 --> **classical guitar**: independent voices with planned rests, stems, multi-segment ties, voice crossing, written-to-sounding octave identity, and isolated Playback Parts.

<!-- II-CLAUSE-0810 --> Tests inspect canonical semantic events, generated notation semantics, rendered PDF or SVG glyphs and placement, Playback Occurrences, sounding pitches, held and damped state, and duplicate prevention. <!-- II-CLAUSE-0811 --> Non-empty notation, matching pitch classes, or successful LilyPond compilation is insufficient.

### Content-addressed regression contracts

<!-- II-CLAUSE-0812 --> Every named regression resolves to an immutable bundle rather than a tune title or anecdote. <!-- II-CLAUSE-0813 --> The bundle pins source and reviewed truth, Analysis, Arrangement and Performance Briefs, Preservation Policy, Applied Knowledge Manifest, Instrument Instance, notation, scoped events, required observations, forbidden outcomes, mutations, evaluators, review roles, and one digest.

<!-- II-CLAUSE-0814 --> Different plausible schools or profiles produce separate candidate families or bundles; a generator may not source-hop among incompatible authorities to pass. <!-- II-CLAUSE-0815 --> Required observations and forbidden outcomes are evaluator-only. <!-- II-CLAUSE-0816 --> Production code may not special-case a Work title, bundle ID, or expected fingering.

<!-- II-CLAUSE-0817 --> The Greensleeves bundles pin the observed baroque-guitar course/fret transition and Gesture Sequences; the lute `f` and `b` letters, course identities, physical context, and reviewed closer realization; and every classical-guitar structural-voice mapping, active span, rest, cadence, function, and duration obligation. <!-- II-CLAUSE-0818 --> Adding incoherent filler, reporting search exhaustion, or finding another cosmetic fingering cannot pass.

### Development regressions and held-out acceptance

<!-- II-CLAUSE-0819 --> Greensleeves is permanently development and regression evidence for all three target compilers. <!-- II-CLAUSE-0820 --> It exercises shared plumbing and the three known failures; it is never held-out evidence and cannot establish generalization.

<!-- II-CLAUSE-0821 --> Visible repository fixtures remain contract and development evidence. <!-- II-CLAUSE-0822 --> Assets held out from Vellum development, prompt authoring, fitting, and evaluator calibration, together with reviewed truth, evaluator-only expectations, mutations, invalidation decisions, reserve order or seed, per-attempt diagnostics, and split manifests, live outside Git and outside the ordinary workspace/content-store read capability in the Owner Evaluation Vault. <!-- II-CLAUSE-0823 --> Repository code and public tracer artifacts may retain only random non-resolving case IDs, public coverage requirements, keyed non-resolving Vault commitments, digests of already-public artifacts, bounded aggregate statuses, exact public Claim Scopes, and schema-constrained redaction receipts—not hidden answers, identities, direct private-content digests, or arbitrary nested diagnostics. <!-- II-CLAUSE-0824 --> Public manifests bind Vault artifacts through keyed commitments that cannot be resolved or tested without the Vault capability. <!-- II-CLAUSE-0825 --> Repository verification rejects reserve identities, hidden expectations, mutations, answers, direct hidden-source or truth digests, and unbounded held-out diagnostics. <!-- II-CLAUSE-0826 --> A narrow evaluation orchestrator releases the source input—not its labels—to the sealed generation process only when a held-out run begins; the generation process has no filesystem, database, environment, or API capability that can enumerate the Vault or its reserves.

<!-- II-CLAUSE-0827 --> The Vault has a separate least-privilege capability boundary, authenticated encryption at rest, atomic durable writes, versioned schema migrations, integrity scans, an explicit encrypted-backup and backup-exclusion policy, restore verification, retention and purge controls, and redacted operational telemetry. <!-- II-CLAUSE-0828 --> Ordinary workspace, development-agent, search-index, backup, logging, and diagnostic capabilities cannot enumerate it. <!-- II-CLAUSE-0829 --> Corruption, unavailable keys, failed migration, or unavailable storage produces blocked acceptance, never an empty-pool pass. <!-- II-CLAUSE-0830 --> Every released source envelope and administrative read enters the exposure ledger.

<!-- II-CLAUSE-0831 --> This is a product-development isolation claim, not a claim that a Work was absent from a pretrained model's corpus. <!-- II-CLAUSE-0832 --> Every run records provider, model, account or project, session, retention and training policy when knowable, prior-call exposure, prompt digest, and whether execution was provider-free. <!-- II-CLAUSE-0833 --> Every Capability Qualification pins a Qualification Execution Policy declaring deterministic/provider-free or stochastic execution. <!-- II-CLAUSE-0834 --> Stochastic execution precommits sample count, seeds or isolated sessions, retry treatment, retained-output policy, confidence rule, and tolerated hard-failure rate; <!-- II-CLAUSE-0835 --> every attempt counts and is retained, and one favorable sample cannot qualify capability. <!-- II-CLAUSE-0836 --> If a provider exposes no immutable deployment revision, qualification is explicitly time- or sentinel-bounded. <!-- II-CLAUSE-0837 --> Semantic drift, deployment change, failed sentinel checks, or changed retention or session behavior stales qualification and requires fresh precommitted evaluation.

<!-- II-CLAUSE-0838 --> Initial release acceptance contains at least two independent, non-Greensleeves contamination groups per target:

- <!-- II-CLAUSE-0839 --> baroque guitar covers supported punteado allocation and a supported rasgueado or mixed-style transition, including exact two-dimensional course-and-fret reach, Gesture Sequences, stroke masks, course masks, and alfabeto applicability;
- <!-- II-CLAUSE-0840 --> baroque lute covers stopped-course polyphony plus explicit digit allocation, simultaneous attacks, alternation, course crossing, thumb behavior, stopped-course-to-diapason transitions, diapason succession, resonance, damping, and exact French tablature;
- <!-- II-CLAUSE-0841 --> classical guitar covers coherent two-voice writing plus independent three-voice or contrapuntal writing.

<!-- II-CLAUSE-0842 --> Dedicated non-Greensleeves shared-contract groups cover a soprano-plus-figured-bass source with an accidental and prepared suspension, and a three-voice imitative source whose identity depends on ordered entries. <!-- II-CLAUSE-0843 --> At least one held-out case per target begins with a legally usable PDF or image and exercises ingestion through deliverables; compiler-isolation cases may begin from independently reviewed canonical transcription.

<!-- II-CLAUSE-0844 --> Holdout selection is a blinded curation task. <!-- II-CLAUSE-0845 --> Sources must be legally usable, absent from derivation, development, fitting, evaluator calibration, prompt examples, and pack examples, and grouped with all near duplicates and derivatives. <!-- II-CLAUSE-0846 --> The source pool deliberately varies key, meter, Texture, technique, stringing or tuning, density, and performance context and includes contrastive cases in which an attractive idiom is inapplicable.

<!-- II-CLAUSE-0847 --> Holdout independence and musical authority are separate. <!-- II-CLAUSE-0848 --> The split curator controls eligibility and coverage but does not thereby certify musical truth. <!-- II-CLAUSE-0849 --> Every gate and reviewed expectation identifies a scope-qualified truth reviewer, evaluator implementer, evaluator calibrator, and run operator under a conflict-of-role policy. <!-- II-CLAUSE-0850 --> Target idiom truth requires corresponding target-instrument authority; <!-- II-CLAUSE-0851 --> Continuo, counterpoint, lyrics, and engraving truth require their corresponding musical or editorial authority. <!-- II-CLAUSE-0852 --> Calibration consumes calibration-role evidence only. <!-- II-CLAUSE-0853 --> Unresolved reviewer disagreement yields incomplete evidence, never a passing gate.

<!-- II-CLAUSE-0854 --> The tracked specification intentionally names coverage classes rather than the exact held-out Works. <!-- II-CLAUSE-0855 --> Publishing their identities, reviewed truth, or expected repairs in the normal repository would make them development targets. <!-- II-CLAUSE-0856 --> Before any system output is observed, an independent curator commits inside the Vault the eligible pool, contamination closures, invalid-fixture policy, reserve order or deterministic selection seed, coverage assignment, and exhaustion rule. <!-- II-CLAUSE-0857 --> The split-manifest digest is frozen before the relevant Generation System versions are run. <!-- II-CLAUSE-0858 --> Invalidation requires a reason permitted by the frozen policy and independent of the candidate output or observed evaluation outcome. <!-- II-CLAUSE-0859 --> The reason may concern source corruption, identity, rights, reviewed truth, or evaluator validity. <!-- II-CLAUSE-0860 --> An immutable decision records adjudicator, policy, evidence, time, and affected attempt; the attempt remains in history and replacement follows the precommitted reserve sequence.

<!-- II-CLAUSE-0861 --> Generation System, profile, Selection Policy, and evaluator versions are sealed before execution. <!-- II-CLAUSE-0862 --> Every valid failed group remains disclosed in the result history and becomes a mandatory permanent development regression. <!-- II-CLAUSE-0863 --> A repaired successor must pass all accumulated valid failures plus the next precommitted reserve groups; it cannot consume reserves until two convenient groups happen to pass. <!-- II-CLAUSE-0864 --> Those reserves are described as fresh and held out from Vellum development, not guaranteed unseen by a pretrained model.

## Feedback, state, and accumulated learning

<!-- II-CLAUSE-0865 --> Vellum is stateful because useful musical learning requires durable evidence and review, not because chat history should become authority.

<!-- II-CLAUSE-0866 --> Every comment, edit, or comparison is classified as one of:

- <!-- II-CLAUSE-0867 --> Score Transcription correction;
- <!-- II-CLAUSE-0868 --> Analysis Claim correction;
- <!-- II-CLAUSE-0869 --> Arrangement Plan revision;
- <!-- II-CLAUSE-0870 --> Arrangement Score edit;
- <!-- II-CLAUSE-0871 --> Performance Interpretation;
- <!-- II-CLAUSE-0872 --> Editorial or Family Commitment;
- <!-- II-CLAUSE-0873 --> Policy Exception;
- <!-- II-CLAUSE-0874 --> Owner ergonomic observation;
- <!-- II-CLAUSE-0875 --> Personal Default Candidate;
- <!-- II-CLAUSE-0876 --> Knowledge Candidate;
- <!-- II-CLAUSE-0877 --> Calibration Candidate;
- <!-- II-CLAUSE-0878 --> Golden Fixture candidate; or
- <!-- II-CLAUSE-0879 --> research question.

<!-- II-CLAUSE-0880 --> The model may propose a classification, but it cannot silently commit a reusable change.

<!-- II-CLAUSE-0881 --> Repeated outcomes may nominate a candidate. <!-- II-CLAUSE-0882 --> They do not activate one. <!-- II-CLAUSE-0883 --> A physical playtest remains scoped to the exact performer, Instrument Instance, passage, tempo, preparation, and reliability goal. <!-- II-CLAUSE-0884 --> A later primary source does not automatically override a modern method, an Owner preference, or another historical school; it creates a reviewed comparison with explicit authority.

## Owner experience

### Guided Start

<!-- II-CLAUSE-0885 --> The default launcher asks only for:

- <!-- II-CLAUSE-0886 --> source document or documents;
- <!-- II-CLAUSE-0887 --> target instruments and Notation Layouts;
- <!-- II-CLAUSE-0888 --> desired Deliverables; and
- <!-- II-CLAUSE-0889 --> an optional instruction.

<!-- II-CLAUSE-0890 --> For each target, Guided Start selects an explicit saved Instrument Instance and versioned default Performance Brief when available and shows them as concise editable defaults. <!-- II-CLAUSE-0891 --> If exact geometry, performer context, tempo, or reliability goal is missing, generation may proceed provisionally but cannot claim physical readiness. <!-- II-CLAUSE-0892 --> Progressive disclosure exposes complete configuration without turning the launcher into a questionnaire.

<!-- II-CLAUSE-0893 --> The launcher distinguishes arrangement evidence from reusable reference evidence. <!-- II-CLAUSE-0894 --> When appropriate, the Owner may choose:

- <!-- II-CLAUSE-0895 --> arrange this;
- <!-- II-CLAUSE-0896 --> add this to the Owner Reference Library; or
- <!-- II-CLAUSE-0897 --> do both.

<!-- II-CLAUSE-0898 --> There is no IMSLP-specific product coupling. <!-- II-CLAUSE-0899 --> PDF and image upload are first-class; stable library URLs and IIIF objects are acquisition conveniences.

<!-- II-CLAUSE-0900 --> OCR or OMR confidence controls appear only when optical recognition is used. <!-- II-CLAUSE-0901 --> Score-Anchored Review provides sufficient musical and page context, zoom, an overlay that does not obscure the glyph, batch threshold provenance, inline correction, and exact resume without looping over resolved uncertainty.

### Default arrangement view

<!-- II-CLAUSE-0902 --> The default view shows:

- <!-- II-CLAUSE-0903 --> inferred source structure and protected identity;
- <!-- II-CLAUSE-0904 --> proportional Arrangement Plan;
- <!-- II-CLAUSE-0905 --> target texture and intended technique;
- <!-- II-CLAUSE-0906 --> major compromises, conflicts, and unknowns;
- <!-- II-CLAUSE-0907 --> selected notation;
- <!-- II-CLAUSE-0908 --> literal Audio Preview;
- <!-- II-CLAUSE-0909 --> readiness by dimension; and
- <!-- II-CLAUSE-0910 --> meaningful alternatives.

<!-- II-CLAUSE-0911 --> It does not expose solver metadata as a questionnaire.

### Expert disclosure

<!-- II-CLAUSE-0912 --> Expert views expose:

- <!-- II-CLAUSE-0913 --> applied pack releases and digests;
- <!-- II-CLAUSE-0914 --> exact citations and source crops;
- <!-- II-CLAUSE-0915 --> conflicting claims and alternative profiles;
- <!-- II-CLAUSE-0916 --> extraction artifacts and confidence dimensions;
- <!-- II-CLAUSE-0917 --> compiled constraints and evaluator identities;
- <!-- II-CLAUSE-0918 --> rejected candidates and binding constraints;
- <!-- II-CLAUSE-0919 --> target voices and technique layers;
- <!-- II-CLAUSE-0920 --> notation and playback lineage;
- <!-- II-CLAUSE-0921 --> pack history, retractions, and reassessments; and
- <!-- II-CLAUSE-0922 --> all unevaluated dimensions.

<!-- II-CLAUSE-0923 --> Expert mode changes presentation, not canonical semantics.

### Knowledge workbench

<!-- II-CLAUSE-0924 --> The Knowledge Workbench supports:

- <!-- II-CLAUSE-0925 --> streamed local upload and stable-URL acquisition;
- <!-- II-CLAUSE-0926 --> deduplication and source-identity resolution;
- <!-- II-CLAUSE-0927 --> rights and access assertions;
- <!-- II-CLAUSE-0928 --> resumable Page Atlas generation;
- <!-- II-CLAUSE-0929 --> page thumbnails and modality regions;
- <!-- II-CLAUSE-0930 --> side-by-side source crop, transcription, normalization, and translation;
- <!-- II-CLAUSE-0931 --> zoom and accessible navigation;
- <!-- II-CLAUSE-0932 --> citation-range editing;
- <!-- II-CLAUSE-0933 --> candidate classification and conflict linking;
- <!-- II-CLAUSE-0934 --> pack-profile drafting and diff;
- <!-- II-CLAUSE-0935 --> test-only release generation;
- <!-- II-CLAUSE-0936 --> role-scoped review packages;
- <!-- II-CLAUSE-0937 --> pack release and retraction;
- <!-- II-CLAUSE-0938 --> research-question queue;
- <!-- II-CLAUSE-0939 --> affected-arrangement reassessment; and
- <!-- II-CLAUSE-0940 --> private export controls.

<!-- II-CLAUSE-0941 --> Failure at any stage resumes from the exact incomplete step without losing reviewed work.

## Seed source program

<!-- II-CLAUSE-0942 --> Raw binaries remain content-addressed in the Owner Reference Library and outside Git unless their rights and fixture purpose explicitly permit inclusion.

### Five-course baroque guitar

<!-- II-CLAUSE-0943 --> Initial sources, in research order:

1. <!-- II-CLAUSE-0944 --> Gaspar Sanz, [Instrucción de música sobre la guitarra española](https://hdl.handle.net/10481/86789), complete 1697 issue: rasgueado, punteado, alfabeto, campanella, accompaniment, counterpoint, and contextual fourth-finger evidence.
2. <!-- II-CLAUSE-0945 --> Francesco Corbetta, [La Guitarre royalle](https://gallica.bnf.fr/ark:/12148/bpt6k1505774n), 1671: mature mixed style, batteries, held harmony, course suppression, vocal accompaniment, and continuo.
3. <!-- II-CLAUSE-0946 --> Giovanni Paolo Foscarini, [I quattro libri della chitarra spagnola](https://music.library.appstate.edu/guitar/foscarini-c1632), circa 1632–1635: transition from alfabeto and strummed practice into mixed tablature.
4. <!-- II-CLAUSE-0947 --> Angelo Michele Bartolotti, [Libro primo di chitarra spagnola](https://music.library.appstate.edu/guitar/bartolotti-1640), 1640: explicit stroke annotation and systematic harmonic material.
5. <!-- II-CLAUSE-0948 --> Santiago de Murcia, [Resumen de acompañar la parte con la guitarra](https://datos.bne.es/resource/XX2242096), 1714/1717: continuo, Figured Bass, cadences, scales, meter, and accompaniment.

<!-- II-CLAUSE-0949 --> Different editions, compilations, exemplars, and provider scans remain separate identities.

### Thirteen-course baroque lute

<!-- II-CLAUSE-0950 --> Initial sources, in research order:

1. <!-- II-CLAUSE-0951 --> Ernst Gottlieb Baron, [Untersuchung des Instruments der Lauten](https://www.digitale-sammlungen.de/de/details/bsb10598228), 1727: normative technique, posture, fingering, transitions, ornaments, and cantabile practice, explicitly scoped to his eleven-course context where applicable.
2. <!-- II-CLAUSE-0952 --> Thomas Mace, [Musick's Monument](https://archive.org/details/musicksmonumento0000mace), 1676: economical motion, right-hand use, and exact twelve-course diapason notation.
3. <!-- II-CLAUSE-0953 --> Perrine, [Livre de Musique pour le Lut](https://gallica.bnf.fr/ark:/12148/btv1b100756018), 1679/1680: staff-to-lute mapping, style brisé, movement, voice leading, and continuo.
4. <!-- II-CLAUSE-0954 --> Silvius Leopold Weiss, [Dresden manuscripts](https://digital.slub-dresden.de/id508190533): descriptive repertoire evidence for voice leading, texture, bass deployment, resonance, and damping.
5. <!-- II-CLAUSE-0955 --> Verified thirteen-course repertoire or treatise evidence for notation, geometry, and bass practice. <!-- II-CLAUSE-0956 --> Falckenhagen remains quarantined until exemplar and publication identity are resolved.

<!-- II-CLAUSE-0957 --> Modern Serdoura, Satoh, and other Owner-supplied books are valuable modern pedagogy, not primary-source historical authority. <!-- II-CLAUSE-0958 --> Their assets remain private unless redistribution is licensed.

### Six-string classical guitar

<!-- II-CLAUSE-0959 --> Initial sources, in research order:

1. <!-- II-CLAUSE-0960 --> Fernando Sor, [Méthode pour la guitare](https://imslp.org/wiki/M%C3%A9thode_compl%C3%A8te_pour_la_guitare_%28Sor%2C_Fernando%29), 1830 French text plus its separately identified plates: voice preservation, harmony-aware fingering, bass continuity, accompaniment, and reduction.
2. <!-- II-CLAUSE-0961 --> Ferdinando Carulli, [L'Harmonie appliquée à la Guitare](https://img.kb.dk/ma/umus/carulli_harmonie.pdf), 1825: aligned source textures and guitar reductions.
3. <!-- II-CLAUSE-0962 --> Dionisio Aguado, [Nuevo método para guitarra](https://imslp.org/wiki/Nuevo_m%C3%A9todo_para_guitarra_%28Aguado%2C_Dionisio%29), 1843: multi-part execution, right-hand allocation, intervals, barré, harmony, and expression.
4. <!-- II-CLAUSE-0963 --> Ferdinando Carulli, [Méthode pour apprendre à accompagner le chant](https://gallica.bnf.fr/ark:/12148/btv1b100704061), Op. 61: melody-plus-accompaniment corpus.
5. <!-- II-CLAUSE-0964 --> Matteo Carcassi, [Method, Op. 59](https://archive.org/details/newimprovedmeth00carc): graded fingering and multi-voice repertoire.

<!-- II-CLAUSE-0965 --> The 1896 Harrison rewrite of Sor is comparison and edition-history evidence, not a substitute for the 1830 authority.

### Shared Italian keyboard continuo

<!-- II-CLAUSE-0966 --> The canonical seed is Francesco Gasparini, [L'armonico pratico al cimbalo](https://www.loc.gov/item/05004057/) (Venice, 1708), Library of Congress Music Division, LCCN 05004057. <!-- II-CLAUSE-0967 --> Its keyboard dispositions, doublings, economical motion, figured dissonance preparation and resolution, accompaniment density, cadences, and ornamented realizations can support a scoped `continuo.italian-baroque.cembalo` development profile after cited extraction and review. <!-- II-CLAUSE-0968 --> The first exact target is a harpsichord or cembalo Instrument Instance; spinet and organ behavior require separately scoped profiles. <!-- II-CLAUSE-0969 --> A modern-piano result is an explicitly named editorial adaptation that may compose historical harmonic constraints with modern-piano mechanics but cannot inherit Gasparini's target-instrument authority. <!-- II-CLAUSE-0970 --> The 1764 manifestation may assist OCR and comparison but does not replace the 1708 manifestation identity. <!-- II-CLAUSE-0971 --> Gasparini is derivation and development evidence and is excluded, with its contamination group, from held-out Continuo acceptance.

### First extraction fixtures

1. <!-- II-CLAUSE-0972 --> Mace: preserve the exact ordered sequence a, /a, //a, ///a, 4, 5 and refuse to infer a thirteenth symbol.
2. <!-- II-CLAUSE-0973 --> Sanz: extract rules and examples that prevent an unscoped universal three-finger rule.
3. <!-- II-CLAUSE-0974 --> Corbetta: represent stroke path, sounding courses, suppression, held harmony, and notation ambiguity independently.
4. <!-- II-CLAUSE-0975 --> Carulli: align a source texture with its guitar reduction and propose retain, omit, octave, rhythm, and accompaniment transformations.
5. <!-- II-CLAUSE-0976 --> Weiss: retain image geometry while extracting descriptive tablature and bass observations only.
6. <!-- II-CLAUSE-0977 --> Sor: link text assertions to separate plates and distinguish the 1830 edition from the Harrison rewrite.
7. <!-- II-CLAUSE-0978 --> Gasparini: retain Chapters II, IV, and VII–X as separately citable segments and extract keyboard disposition, doubling, motion, density, and figured-dissonance candidates without treating noisy OCR as reviewed truth.

<!-- II-CLAUSE-0979 --> One source per target proves plumbing, not idiomatic authority.

## Performance and operability acceptance

<!-- II-CLAUSE-0980 --> Correctness on short fixtures does not establish usefulness on a real score or an accumulated library. <!-- II-CLAUSE-0981 --> Versioned Performance Acceptance Profiles bind exact hardware/runtime classes, reference and stress workloads, thresholds, measurement methods, and result digests.

<!-- II-CLAUSE-0982 --> The initial workload set includes:

- <!-- II-CLAUSE-0983 --> a short interactive excerpt through PDF review and all three target siblings;
- <!-- II-CLAUSE-0984 --> a multi-page SATB source with changing context, repeats, lyrics where present, and all three targets;
- <!-- II-CLAUSE-0985 --> a complete representative work exercising section-level backtracking, interruption, checkpoint, reload, and resume;
- <!-- II-CLAUSE-0986 --> a mature Reviewed Knowledge Library containing enough releases, profiles, conflicts, advisories, and inapplicable entries to exercise complete enumeration rather than an empty or toy catalog; and
- <!-- II-CLAUSE-0987 --> adversarial high-density passages and an oversized library that may legitimately exhaust a declared budget.

<!-- II-CLAUSE-0988 --> Each profile records maximum wall time by workflow stage, peak memory, persisted bytes, Inventory, Catalog and Manifest size, candidate frontier and checkpoint size, cancellation response, checkpoint interval, resume overhead, and redacted diagnostic limits. <!-- II-CLAUSE-0989 --> Before measuring a baseline, Slice 0 commits the release-floor derivation algorithm, safety margins, supported hardware classes, workload generators, and measurement method. <!-- II-CLAUSE-0990 --> It then applies that policy exactly to the recorded clean baseline and pins `performance.release-floor.v1` before optimization or qualification output is observed. <!-- II-CLAUSE-0991 --> A later profile may support a narrower claim, but it cannot replace or satisfy that mandatory release floor. <!-- II-CLAUSE-0992 --> Changing the floor after results exist requires an explicit Owner-approved specification decision, preserves the original failure and comparison, and invalidates any broader claim rather than shopping for a passing threshold.

<!-- II-CLAUSE-0993 --> Inventory and Catalog Snapshots are shared by digest across passages. <!-- II-CLAUSE-0994 --> Context-specific manifests may factor shared snapshots and reusable completeness proofs but cannot weaken authoritative enumeration. <!-- II-CLAUSE-0995 --> Applicability evaluation is incremental over immutable dependency closures, and phrase or section search retains bounded frontiers and resumable checkpoints. <!-- II-CLAUSE-0996 --> Reference workloads must complete or return an actionable musical conflict within their profile. <!-- II-CLAUSE-0997 --> Stress exhaustion is acceptable only when `budget_exhausted`, cancellation, checkpointing, resume, retained alternatives, and user presentation remain correct; exhaustion cannot masquerade as infeasibility or success.

## Execution sequence

<!-- II-CLAUSE-0998 --> Implementation proceeds through production-path tracer bullets. <!-- II-CLAUSE-0999 --> Each tracer begins with a failing output-level or contract-level case, crosses the real canonical path, and ends with a demoable Owner outcome.

### Slice 0 — Specification and baseline guard

- <!-- II-CLAUSE-1000 --> Treat the checked-in schema-5 completion manifest as an evidence-empty execution lock, not as completion machinery. <!-- II-CLAUSE-1001 --> It rejects every mutable receipt and every evidence file beyond `.gitkeep`. <!-- II-CLAUSE-1002 --> Establish its initial trust only through an explicit Owner-reviewed bootstrap ceremony over the exact pushed tip and an atomic Owner-local three-ref checkpoint tuple: the immutable reviewed-bootstrap commit, the immutable canonical-publication-policy blob, and the mutable trusted-main compare-and-swap head. <!-- II-CLAUSE-1003 --> The publication remote is explicitly unprotected (`remoteProtectionAssumed: false`); hosted branch protection is neither claimed nor required.
- <!-- II-CLAUSE-1004 --> Before producing T01 evidence or beginning any product tracer, land a governance-only pre-registration transaction that atomizes the clause ledger and installs a next-schema verifier covering pre-push pending evidence, automatic post-publication manifest-only receipt recording, exact start/authority/subject snapshots and predicate witnesses, owner-before-contributor clause claims, direct trusted-tip implementation ancestry, command-bound gates, exact result dispositions, cumulative remediation obligations, a governed historical public-key review-authority catalog, predecessor-authored role-package subjects, signed decisions/reviews, privacy aggregation and sanitization, historical authority migrations, global evidence closure, and current-product-tree closure. <!-- II-CLAUSE-1005 --> Push and strictly verify that transaction first; then T01 uses the ordinary implementation/evidence and receipt commits.
- <!-- II-CLAUSE-1006 --> Make this document the sole current specification.
- <!-- II-CLAUSE-1007 --> Align `CONTEXT.md`, ADRs 0004, 0015, and 0018–0022, `AGENTS.md`, and issue-tracker guidance with this specification before deriving the wave.
- <!-- II-CLAUSE-1008 --> Freeze earlier documents as history.
- <!-- II-CLAUSE-1009 --> Correct active domain and README claims that overstate historical authority or prototype playability.
- <!-- II-CLAUSE-1010 --> Verify that the completed prototype evidence remains intact.
- <!-- II-CLAUSE-1011 --> Disable the generic client-supplied production provider stream or bind it to server-minted Model Action, Egress Envelope, and Result Commit enforcement before private reference ingestion; add forged-context, cross-workspace, prompt-injection, destination-substitution, tool-capability escalation, denied-egress, mismatched-response, and unrelated-canonical-result tests.
- <!-- II-CLAUSE-1012 --> Inventory tracked source-derived code, tests, fixtures, prompts, and Git history. <!-- II-CLAUSE-1013 --> Quarantine the Tyler-derived universal chart and Foscarini overlay from production defaults pending exact repository-inclusion and redistribution decisions, record already-pushed copies as irreversible prior disclosure, and prefer reviewed public-domain primary-source data or an authorized local pack.
- <!-- II-CLAUSE-1014 --> Add red contract guards for one-part/multiple-voice source data, changing key or meter, per-part written-to-sounding mapping, multi-segment ties, figure changes and continuations, and the current semitone-only Transposition Plan.
- <!-- II-CLAUSE-1015 --> Separate tri-state `hardGateStatus` from four-state `acceptanceStatus`, enforce aggregate precedence, and remove every false `hard gates pass` presentation.
- <!-- II-CLAUSE-1016 --> Enforce evaluator-input and public-repository held-out-data canaries so later evaluation work cannot build on the current porous executor or ledger boundary.
- <!-- II-CLAUSE-1017 --> Commit the release-floor derivation policy before measuring, then deterministically derive and commit `performance.release-floor.v1`, its supported hardware classes and numeric thresholds, and the per-tracer gate-matrix schema from the recorded clean baseline before optimization begins.

### Slice 1 — Source identity and safe migration

- <!-- II-CLAUSE-1018 --> Introduce versioned identity assertions, Works, Source Manifestations, Exemplars, immutable Digital Assets, acquisition records, Source Segment Versions, rights assertions, and Access Decisions.
- <!-- II-CLAUSE-1019 --> Implement shared content-addressed bytes with acquisition-edge provenance and role-specific Arrangement Source, Owner Reference, and Evaluation Source bindings; deletion and rights resolution operate on provenance paths rather than whichever identical byte arrived last.
- <!-- II-CLAUSE-1020 --> Preserve each OwnerReference as an immutable legacy record with a permanent mapping, migration journal, collision and unresolved-identity quarantine, and exact byte and hash verification.
- <!-- II-CLAUSE-1021 --> Build the immutable Authority Path Inventory over legacy claims and packs plus prompts, tool descriptions and defaults, built-in tables and charts, compiler branches, rankers, validators, constants, and presentation labels. <!-- II-CLAUSE-1022 --> Classify or quarantine each path and add old/new compatibility readers and shadow resolution without changing production activation.
- <!-- II-CLAUSE-1023 --> Establish the transactional publication-generation store, stable snapshot reads, concurrent-writer protection, crash recovery, and compare-and-swap head before canonical writers rely on it.
- <!-- II-CLAUSE-1024 --> Make migration transactional, idempotent, resumable, dry-runnable, and rollback-safe; never manufacture missing Work, date, edition, provenance, rights, or review authority, and prove rollback before cutover.
- <!-- II-CLAUSE-1025 --> Default migrated private content to no provider egress, fixture inclusion, or redistribution.
- <!-- II-CLAUSE-1026 --> Exercise both acquisition orderings for duplicate bytes with different rights, deletion of either acquisition, incomplete and composite identity, interruption, rollback, rerun, stable snapshot reads, compatibility reads, and attempts to reactivate quarantined legacy knowledge through an old code path.
- <!-- II-CLAUSE-1027 --> Remove automatic perfect confidence for documentary classification.
- <!-- II-CLAUSE-1028 --> End with one migrated and one newly uploaded real reference visible through the production Workbench.

### Slice 2 — Mace ingestion vertical

- <!-- II-CLAUSE-1029 --> Upload or acquire the Mace asset.
- <!-- II-CLAUSE-1030 --> Resolve its source identity.
- <!-- II-CLAUSE-1031 --> Build and resume a Page Atlas.
- <!-- II-CLAUSE-1032 --> Create an exact cited segment for printed page 75.
- <!-- II-CLAUSE-1033 --> Stage the twelve-course notation candidate and explicit thirteenth-course research question.
- <!-- II-CLAUSE-1034 --> Exercise malicious or oversized acquisition, parser failure, redacted diagnostics, local-only processing, and denied provider egress.
- <!-- II-CLAUSE-1035 --> Complete the path in the real browser without promoting specialist authority or changing an old citation after an Atlas correction.

### Slice 3 — Release, manifest, and provisional-consequence vertical

- <!-- II-CLAUSE-1036 --> Add typed evidence edges and stable predicate identities, orthogonal candidate axes, lane-compatible derivation relations, immutable releases, credential-backed external reviewer and verifier authority, advisories, required discriminated Activation Authority, Activation Decisions, and centrally governed Resolution Policy.
- <!-- II-CLAUSE-1037 --> Produce a test-only release with profiles, examples, counterexamples, derivations, and declarative mappings.
- <!-- II-CLAUSE-1038 --> Resolve it into an Applied Knowledge Manifest.
- <!-- II-CLAUSE-1039 --> Rebuild an authoritative Knowledge Library Inventory, derive an exact Catalog, and recompute manifest completeness against those and the Component Registry Snapshot; detect an omitted inventoried release, eligibility outcome, profile, or dependency.
- <!-- II-CLAUSE-1040 --> Run one visible arrangement consequence only in explicit provisional-research mode and prove that default Guided Start cannot activate it or claim readiness.
- <!-- II-CLAUSE-1041 --> Record exact Inventory, Catalog, Activation Decision, component, and manifest digests in Arrangement Search and Evaluation Run identity.
- <!-- II-CLAUSE-1042 --> Prove that unknown, excluded, conflicting, retracted, and unavailable-source states remain distinct.
- <!-- II-CLAUSE-1043 --> Prove that verified and out-of-scope authority always carries evaluated and authorization scopes, unverified or revoked records carry none, and missing scope, credential intersection, expiry, revocation, or clock-policy mismatch fails closed and publishes the required successor decision.
- <!-- II-CLAUSE-1044 --> Reconcile every Authority Path Inventory entry against the Component Registry and Applied Knowledge Manifest; disable any nonmechanical path absent from both and add static and runtime bypass detection.
- <!-- II-CLAUSE-1045 --> Activate the new resolver and disable legacy activation in one transactional cutover only after compatible readers, migration validation, shadow comparison, post-cutover integrity checks, and tested rollback pass. <!-- II-CLAUSE-1046 --> No tracer may introduce a canonical writer before compatible readers and migration exist or disable a production path before its replacement is active.
- <!-- II-CLAUSE-1047 --> Crash after every staged publication write and before and after head commit; test concurrent upload, review, advisory, and activation writers, stale-head rejection, orphan recovery, and snapshot-consistent Inventory and Catalog rebuilding.
- <!-- II-CLAUSE-1048 --> Prove that maintainer-reviewed-system authority enables an explicitly nonhistorical software or editorial default while absent, mixed, test-only, Owner-local, or out-of-scope authority cannot produce an ordinary or historically presented result.

### Slice 4 — Evaluation contracts, isolation, and vault

- <!-- II-CLAUSE-1049 --> Migrate old Cards and baselines without reinterpreting prior proxy dimensions; incompatible comparisons say so.
- <!-- II-CLAUSE-1050 --> Enforce the Generation Input Envelope and evaluator-only store in a separate process.
- <!-- II-CLAUSE-1051 --> Add tri-state hard gates, precedence-governed four-state acceptance, Generation-System-scoped contamination groups, split manifests, append-only Holdout Run Ledgers, provider and session exposure history, and inherited precommitted reserve ordering.
- <!-- II-CLAUSE-1052 --> Add Search Measurement and Selection Policy contracts separately from Evaluation Cards, plus canonical Adoption Decision storage and workflow.
- <!-- II-CLAUSE-1053 --> Create the encrypted, schema-versioned Owner Evaluation Vault outside Git under a separate capability boundary; prove canary isolation from generation, workspaces, development agents, indexing, backups, logs, and diagnostics and verify integrity, restore, key failure, migration, retention, and purge behavior.
- <!-- II-CLAUSE-1054 --> Enforce the public-ledger/Vault-ledger split and repository leak scanner.
- <!-- II-CLAUSE-1055 --> Add qualified truth-reviewer, curator, evaluator-implementer, calibrator, and run-operator role contracts plus deterministic and stochastic Qualification Execution Policies and opaque-provider drift expiry.
- <!-- II-CLAUSE-1056 --> Add evaluator contracts and mutations for Source Voice identity, Harmonic Plans, exact Transposition, Figure spans, lyrics, spanners, constituent-string attacks, and all three target engraving fixtures.
- <!-- II-CLAUSE-1057 --> Validate the framework with synthetic contract cases; target musical evaluators remain owned by their verticals.

### Slice 5 — Shared voice, relationship, and phrase intelligence

- <!-- II-CLAUSE-1058 --> Add Source Voice Graphs, Lyric Underlays, time-varying Musical Context maps, exact Transposition Plans, canonical spanners and source-notated ornaments.
- <!-- II-CLAUSE-1059 --> Add separately identified and digested Target Voice, Target Harmonic, Target Relationship, Continuo Realization and Disposition, and Intended Technique Plans plus realized candidate mappings.
- <!-- II-CLAUSE-1060 --> Add Instrument Instance authoring, measurement, calibration, versioning, default selection, exact ergonomic context, activity spans and planned rests, phrase boundary state, and work-level obligations.
- <!-- II-CLAUSE-1061 --> Replace event-local musical selection with bounded phrase search and honest terminal outcomes.
- <!-- II-CLAUSE-1062 --> Compile Principal Voice, source and target voice identity, harmonic skeleton, bass, counterpoint, figures, Continuo Foundation, cadence, lyrics where applicable, target texture, and technique into observable constraints and independent evaluator requirements.
- <!-- II-CLAUSE-1063 --> Implement explicit candidate Adoption Decisions so ranking or persistence cannot promote a candidate before independent required gates pass.

### Slice 6 — Continuo relationship vertical

- <!-- II-CLAUSE-1064 --> Carry Gasparini source segments and the legally usable soprano-plus-figured-bass Golden Fixture through optical import, reviewed bass and figure truth, a source-backed `continuo.italian-baroque.cembalo` Realization Profile, Applied Manifest, Voice, Harmonic, Relationship, and Continuo Plans, search, engraving, isolated playback, audit, and independent evaluation.
- <!-- II-CLAUSE-1065 --> Produce a complete soprano-plus-harpsichord realization for an exact Instrument Instance and policy-contract cases for complete, separate-bass, and correctly rejected or explicitly labeled Continuo Reduction dispositions without presupposing an unrepaired fretted-target compiler. <!-- II-CLAUSE-1066 --> Treat any piano deliverable as a separately named modern editorial adaptation.
- <!-- II-CLAUSE-1067 --> Implement canonical Figure Signs, Groups, continuation spans, constraint segments, and generated-realization mappings. <!-- II-CLAUSE-1068 --> Mutate every foundation event, figure, accidental, alignment, change over a held bass, continuation, prepared 4-3 suspension, generated voice, and disposition outside generation's view.

### Slice 7 — Imitative-counterpoint relationship vertical

- <!-- II-CLAUSE-1069 --> Carry the legally usable three-voice imitative Golden Fixture through Analysis, Validation Profile, Applied Manifest, Voice and Relationship Plans, the existing six-course Renaissance-lute path, engraving, isolated playback, audit, and independent evaluation.
- <!-- II-CLAUSE-1070 --> Preserve ordered entries, subject interval-rhythm shapes, voice continuities and exchanges, and cadential goals without inventing one permanent Principal Voice.
- <!-- II-CLAUSE-1071 --> Mutate entry order, subject shape, relationship timing, voice identity, and cadence placement outside generation's view.

### Slice 8 — Baroque-guitar development vertical

1. <!-- II-CLAUSE-1072 --> Preserve the exact known-bad Greensleeves output and prove that independent evaluators reject its voice, two-dimensional course-and-fret reach, allocation, stroke-mask, Gesture Sequence, and transition failures.
2. <!-- II-CLAUSE-1073 --> Run one reviewed Sanz or Corbetta path into a test-only historical release and a separately classified maintainer-reviewed nonhistorical production consequence, implement exact two-dimensional left-hand contact and transition geometry plus orthogonal punteado, rasgueado, alfabeto, mixed-style, course-allocation, resolved constituent attacks, resonance, and gesture semantics, and repair the production search, engraving, playback, and workbench paths.
3. <!-- II-CLAUSE-1074 --> Apply the shared Continuo disposition contract to baroque guitar and prove that any incomplete foundation receives an explicit separate bass or correctly labeled reduction rather than a false complete realization.
4. <!-- II-CLAUSE-1075 --> Pass the development Regression Bundle and baroque-guitar Golden Engraving and Playback Fixture without activating test-only knowledge in default Guided Start.

### Slice 9 — Baroque-lute development vertical

1. <!-- II-CLAUSE-1076 --> Preserve the exact known-bad Greensleeves output and prove that independent evaluators reject its pinned `f` and `b` reach, course, transition, notation, and playback failures; add mutations that reject impossible digit allocation, stopped-course simultaneity, alternation, crossing, thumb behavior, and stopped-course-to-diapason transitions.
2. <!-- II-CLAUSE-1077 --> Run Mace plus one normative and one repertoire path into scoped test-only historical releases and a separately classified maintainer-reviewed nonhistorical production consequence; implement two-dimensional left-hand geometry and calibrated plucking-zone, course-spacing, diapason or bass-rider geometry plus whole-instrument right-hand allocation, preparation, simultaneity, alternation, crossing, thumb, transition, resonance, and damping state.
3. <!-- II-CLAUSE-1078 --> Re-run the accepted Golden Engraving Fixture for course 10 `///a`/D2, Bass Tuning invariance, the full `a`, `/a`, `//a`, `///a`, `4`, `5` sequence, below-staff glyph placement, MIDI identity, absence of duplicate playback, a stopped doubled-course attack, and a stopped-course-to-diapason transition.
4. <!-- II-CLAUSE-1079 --> Pass the development Regression Bundle while treating course-13 historical notation as `not_claimed` under the editorial profile or unresolved under a historically scoped profile.

### Slice 10 — Classical-guitar development vertical

1. <!-- II-CLAUSE-1080 --> Preserve the disappearing-bass output and prove that evaluators reject its activity-span, relationship, cadence, duration, mechanics, notation, and playback failures.
2. <!-- II-CLAUSE-1081 --> Run Sor plus one Carulli aligned reduction into scoped test-only historical releases and a separately classified maintainer-reviewed nonhistorical production consequence, implement exact joint left- and right-hand polyphonic phrase search, and repair first-class standard notation and isolated playback.
3. <!-- II-CLAUSE-1082 --> Pass the development Regression Bundle and classical-guitar Golden Engraving and Playback Fixture, including planned rests, stems, multi-segment ties, voice crossing, and written-to-sounding octave identity, without using event count or continuous sound as a proxy for coherent voice.

<!-- II-CLAUSE-1083 --> Slices 8 through 10 are coequal target siblings. <!-- II-CLAUSE-1084 --> Slice 8 steps 1–2 and Slices 9–10 may proceed independently after Slice 5; <!-- II-CLAUSE-1085 --> Slice 8 step 3 depends on the shared Continuo contract in Slice 6, and its step 4 depends on step 3. <!-- II-CLAUSE-1086 --> Each numbered red, repair, and development-acceptance step is a separate tracer committed before its dependent step.

### Slice 11 — Reassessment, reviewed learning, and recovery

- <!-- II-CLAUSE-1087 --> Ingest corroborating and conflicting sources and support comparison, qualification, contradiction, supersession, advisory, retraction, rights change, and research questions.
- <!-- II-CLAUSE-1088 --> Produce affected-arrangement Reassessments without mutation or automatic authority.
- <!-- II-CLAUSE-1089 --> Classify edits, playtests, feedback, and evaluator disagreements and propose—but do not auto-activate—Personal Defaults, Ergonomic Profiles, Knowledge Candidates, Calibration Candidates, and fixtures.
- <!-- II-CLAUSE-1090 --> Add release and attestation diff, advisory and deletion workflow, affected-workspace navigation, exact resume, and derivative purge tests.
- <!-- II-CLAUSE-1091 --> Preserve legacy searches without invented manifests and offer canonical regeneration.

### Slice 12 — Qualification infrastructure and sealed-run readiness

- <!-- II-CLAUSE-1092 --> Complete every machine-executable implementation, development regression, isolation, security, migration, target-specific engraving and playback, and mandatory release-floor performance gate.
- <!-- II-CLAUSE-1093 --> Exercise the complete sealed-run protocol with synthetic and disclosed development cases, including ledger genesis and CAS head enforcement, invalidation, fork detection, inherited regressions and reserve cursor, stochastic policy, provider-drift sentinel, cancellation, retry, and redacted reporting.
- <!-- II-CLAUSE-1094 --> Exercise the real PDF-to-three-target Guided Start path with consequential review, alternatives, score following, isolation, manual edit adoption, version history, interruption, reload, retry of incomplete siblings only, and complete deliverable rehydration using development evidence.
- <!-- II-CLAUSE-1095 --> Produce a `ready-for-human` Vault curation and truth-review package containing role requirements, conflict-of-role policy, coverage classes, acquisition and rights workflow, review tooling, invalidation policy, reserve protocol, and exact frozen candidate Generation System and evaluator identities without preselecting or exposing future held-out Works to development.
- <!-- II-CLAUSE-1096 --> Prove that no real held-out attempt can begin until the independent Slice 13 commitments exist.

### Slice 13 — Late holdout curation and sealed machine qualification

<!-- II-CLAUSE-1097 --> This is the first HITL boundary. <!-- II-CLAUSE-1098 --> All machine-executable implementation work is sequenced before it; after the required independent commitments, the sealed run and reporting proceed automatically.

- <!-- II-CLAUSE-1099 --> Before any candidate output is observed, an independent curator commits the legally usable eligible pool, contamination closures, output-independent invalid-fixture policy, reserve order or selection seed, coverage assignment, exhaustion rule, role-conflict policy, ledger genesis, and inherited regression and reserve state in the Owner Evaluation Vault without exposing evaluator truth to generation or development.
- <!-- II-CLAUSE-1100 --> Scope-qualified truth reviewers independently review case truth and gate definitions; they are verified separately from the curator, evaluator implementer, calibrator, and run operator.
- <!-- II-CLAUSE-1101 --> After those human decisions are durably recorded, automatic verification either routes a nonpassing decision to a fresh review generation or freezes compiler, pack, Resolution and Selection Policy, evaluator, Qualification Execution Policy, split-manifest, provider or provider-free runtime, and performance-profile versions. <!-- II-CLAUSE-1102 --> The sealed run cannot begin until the current decision generations are sufficient and the machine freeze completes.
- <!-- II-CLAUSE-1103 --> Run at least two non-Greensleeves groups per target plus the dedicated Continuo and imitative groups.
- <!-- II-CLAUSE-1104 --> Every attempted group enters the append-only ledger. <!-- II-CLAUSE-1105 --> Every valid failed group remains disclosed and becomes a permanent required regression; after repair, the successor inherits all accumulated failures and the unconsumed reserve cursor and must pass those failures plus the next precommitted reserve groups held out from Vellum development.
- <!-- II-CLAUSE-1106 --> Emit tri-state hard-gate and four-state acceptance Evaluation Cards plus compatible or explicitly incomparable baseline results, exact Qualification Claim Scopes, and provider or deterministic-execution validity boundaries.
- <!-- II-CLAUSE-1107 --> Machine Complete is reached only when the sealed qualifications and all mandatory release-floor gates pass.

<!-- II-CLAUSE-1108 --> Finding-triggered remediation never mutates an old tracer definition to create a loop. <!-- II-CLAUSE-1109 --> Appending its new issue definition and PLAN row is an authorized post-progress registry transaction only when every prior definition, authority narrative, specification byte, and requirement-ledger byte remains unchanged. <!-- II-CLAUSE-1110 --> T69, T84, T85, T87, T103, or T106 first emits a closed-schema, digest-bound dispatch artifact naming an opaque finding, the next repair ID, exact actual invalidation edges/scopes, earliest safe `rejoinAt: { tracerId, generation }`, and nonempty `closureTargets: [{ tracerId, generation }]`; a repair cannot self-certify a weaker contract. <!-- II-CLAUSE-1111 --> `invalidatesMachineComplete` is derived from the actual edge scopes, not trusted as an independent assertion. <!-- II-CLAUSE-1112 --> These fields reserve exact future generation identities when the repair is finalized; an unmaterialized reservation is valid only while closure remains pending and keeps it blocked. <!-- II-CLAUSE-1113 --> The fresh rejoin must be a strict temporal descendant of the passing repair, and each materialized target must descend from that rejoin. <!-- II-CLAUSE-1114 --> Current closure must cover the targets of every historical remediation generation, including a superseded or tombstoned generation; each unresolved reservation blocks its corresponding closure transition. <!-- II-CLAUSE-1115 --> `rejoinAt` is never T85 or T87. <!-- II-CLAUSE-1116 --> T87 is always targeted; <!-- II-CLAUSE-1117 --> T85 is targeted exactly when actual invalidation scope reaches Machine Complete, so a release-only review repair blocks Release Complete without revoking an otherwise current Machine Complete receipt. <!-- II-CLAUSE-1118 --> An invalidation of issue, evidence, or requirement state requires a current active replacement generation and replacement requirement evidence downstream of the invalidating repair; <!-- II-CLAUSE-1119 --> Machine/Release closure must itself descend from every edge that names its scope. <!-- II-CLAUSE-1120 --> Static definitions remain immutable and acyclic while the Owner-local checkpoint tuple anchors append-only registry, execution, state-edge, and evidence histories and each freshly fetched `origin/main` plus its preceding manifest-changing first-parent revision is verified as a descendant observation of that anchor.

<!-- II-CLAUSE-1121 --> The trust model is client-enforced and fail-closed. <!-- II-CLAUSE-1122 --> One serialized publisher pins the normalized publication-remote identity and uses ordinary fast-forward pushes only. <!-- II-CLAUSE-1123 --> After the Owner bootstrap, the publisher must not merge, force-push, delete, amend, or rebase pushed history. <!-- II-CLAUSE-1124 --> The checkpoint is one atomic Git transaction over `refs/vellum/instrument-intelligence/bootstrap-anchor` (the immutable reviewed bootstrap commit), `refs/vellum/instrument-intelligence/trust-policy` (the immutable canonical policy blob), and `refs/vellum/instrument-intelligence/trusted-main` (the mutable trusted-main compare-and-swap head). <!-- II-CLAUSE-1125 --> Before a tracer starts and again after each push, strict verification fetches `origin/main`, independently queries authenticated GitHub GraphQL for `refs/heads/main` in repository node `R_kgDOSNEx6w`, requires both observations to name the same commit at the beginning and end of verification, proves first-parent descent from the preceding observation and checkpoint tuple, verifies the exact committed bytes and clean local tip, and only then atomically advances the mutable ref while verifying both immutable refs. <!-- II-CLAUSE-1126 --> This independent head observation requires GitHub authentication but no hosted protection or paid repository setting. <!-- II-CLAUSE-1127 --> Divergence, rewind, deletion, remote substitution, GraphQL identity/head disagreement, concurrent movement, or partial checkpoint loss/mismatch stops execution as `ready-for-human`; automation never resets, reconstructs, or re-bootstraps trust.

<!-- II-CLAUSE-1128 --> Before that checkpoint exists, the one explicit Owner-authorized, evidence-empty pre-trust correction has this literal path allowlist and no implicit directory or dependency expansion:

- <!-- II-CLAUSE-1129 --> `.scratch/instrument-intelligence/completion-manifest.json`
- <!-- II-CLAUSE-1130 --> `SPEC.md`
- <!-- II-CLAUSE-1131 --> `AGENTS.md`
- <!-- II-CLAUSE-1132 --> `.scratch/instrument-intelligence/PLAN.md`
- <!-- II-CLAUSE-1133 --> `.scratch/instrument-intelligence/README.md`
- <!-- II-CLAUSE-1134 --> `.scratch/instrument-intelligence/REQUIREMENTS.md`
- <!-- II-CLAUSE-1135 --> `.scratch/instrument-intelligence/issues/01-governing-contract-baseline-guard.md`
- <!-- II-CLAUSE-1136 --> `docs/agents/issue-tracker.md`
- <!-- II-CLAUSE-1137 --> `flake.nix`
- <!-- II-CLAUSE-1138 --> `scripts/nix-podman`
- <!-- II-CLAUSE-1139 --> `scripts/lib/instrument-intelligence-trust.mjs`
- <!-- II-CLAUSE-1140 --> `scripts/verify-instrument-intelligence-plan.mjs`
- <!-- II-CLAUSE-1141 --> `test/instrument-intelligence/bootstrap-trust-policy.test.ts`

<!-- II-CLAUSE-1142 --> Within that list, the Podman work is limited to the repo-tracked Nix proxy and the exact `flake.nix` corrections needed to make the pinned execution/music shell and explicit nested LilyPond sandbox gate runnable. <!-- II-CLAUSE-1143 --> The strict publication verifier and Owner ceremony run on the macOS host with the Owner's existing authenticated `gh` keychain session; the Nix proxy neither mounts nor forwards GitHub credentials. <!-- II-CLAUSE-1144 --> Product code, product tests, package manifests/lockfiles, and arbitrary dependency additions are forbidden. <!-- II-CLAUSE-1145 --> The correction does not establish trust or permit product work. <!-- II-CLAUSE-1146 --> After the one-time Owner bootstrap, this exception closes permanently: schema downgrade, bootstrap reconstruction, and re-bootstrap remain forbidden.

<!-- II-CLAUSE-1147 --> This policy detects destructive remote changes before dependency advancement but cannot prevent an unprotected host from accepting them. <!-- II-CLAUSE-1148 --> It does not defend against an actor controlling both publication credentials and the executor filesystem. <!-- II-CLAUSE-1149 --> Partial checkpoint loss or mismatch is diagnosable and requires human adjudication. <!-- II-CLAUSE-1150 --> Total loss of all three local refs is indistinguishable from a fresh clone, but still cannot trigger autonomous bootstrap: only the explicit Owner ceremony may establish a checkpoint. <!-- II-CLAUSE-1151 --> Those are declared residual risks, not evidence of protected-remote guarantees.

<!-- II-CLAUSE-1152 --> Machine closure evaluation is itself a finalized adjudication, not a pass-only operation that can strand a newly discovered failure outside the immutable lineage. <!-- II-CLAUSE-1153 --> A successfully executed T85 audit records exactly `machine_complete`, `machine_closure_failed_repair_dispatched`, `machine_closure_blocked`, or `machine_closure_incomplete`. <!-- II-CLAUSE-1154 --> Only `machine_complete` agrees with product acceptance `pass`, publishes a Machine Complete receipt, and unlocks exact-artifact package generation. <!-- II-CLAUSE-1155 --> The repair-dispatched result carries at least one typed append-only obligation with fresh T85 and T87 closure targets; blocked and incomplete results remain retryable nonpassing attempts and neither fabricate repair findings nor advance closure.

<!-- II-CLAUSE-1156 --> Release closure evaluation follows the same non-deadlocking rule. <!-- II-CLAUSE-1157 --> A successfully executed T87 audit records exactly `release_complete`, `release_closure_failed_repair_dispatched`, `release_closure_blocked`, or `release_closure_incomplete`. <!-- II-CLAUSE-1158 --> Only `release_complete` agrees with product acceptance `pass`, publishes a Release Complete receipt, and satisfies the program goal. <!-- II-CLAUSE-1159 --> A release-only dispatched repair reserves a fresh T87 target without revoking a current Machine Complete receipt; a Machine-impacting repair reserves both T85 and T87. <!-- II-CLAUSE-1160 --> Blocked and incomplete T87 results remain immutable retryable nonpasses and cannot fabricate dispatch authority.

### Slice 14 — Late human review and release remediation loop

<!-- II-CLAUSE-1161 --> The exact-digest artifact review package includes:

- <!-- II-CLAUSE-1162 --> metadata and rights review;
- <!-- II-CLAUSE-1163 --> source transcription and extraction review;
- <!-- II-CLAUSE-1164 --> historical-claim and pack-profile review by declared role;
- <!-- II-CLAUSE-1165 --> verified reviewer identity, credential, scope, freshness, and revocation evidence for every authority-bearing review;
- <!-- II-CLAUSE-1166 --> Source Voice, Harmonic, Transposition, lyric and spanner review wherever those dimensions are in scope;
- <!-- II-CLAUSE-1167 --> target-player physical playtests for all three instruments;
- <!-- II-CLAUSE-1168 --> qualified historical keyboard-continuo review of the exact soprano-plus-harpsichord realization and separate modern-piano review only if that editorial adaptation is produced;
- <!-- II-CLAUSE-1169 --> qualified imitative-intabulation review of the six-course lute output;
- <!-- II-CLAUSE-1170 --> engraving-editor review;
- <!-- II-CLAUSE-1171 --> Owner cross-target usefulness review;
- <!-- II-CLAUSE-1172 --> disagreements and unresolved dimensions;
- <!-- II-CLAUSE-1173 --> exact pack, compiler, evaluator, source, and output digests; and
- <!-- II-CLAUSE-1174 --> rerun instructions.

<!-- II-CLAUSE-1175 --> Review is a closure loop, not one ceremony. <!-- II-CLAUSE-1176 --> A blocking finding creates a tracer at the earliest affected slice. <!-- II-CLAUSE-1177 --> After repair, the impact map invalidates affected deterministic, held-out, and human evidence; <!-- II-CLAUSE-1178 --> every valid holdout that informed the repair becomes a permanent disclosed regression and the next precommitted reserve groups remain required; changed outputs receive a new package; and no attestation transfers to a changed digest.

<!-- II-CLAUSE-1179 --> Lyric-review applicability is adjudicated by machine before opening its conditional human review. <!-- II-CLAUSE-1180 --> The decision emits exactly one of `lyrics_applicable`, `lyrics_not_applicable`, `lyrics_applicability_blocked`, or `lyrics_applicability_incomplete`. <!-- II-CLAUSE-1181 --> Only `lyrics_applicable` opens the lyric HITL; the not-applicable result records bounded clause-specific proof, while blocked and incomplete results bypass that HITL and enter the ordinary nonpassing aggregation/remediation path. <!-- II-CLAUSE-1182 --> Neither N/A nor an unresolved applicability result is a human acceptance pass.

<!-- II-CLAUSE-1183 --> Content changes create a new release and review creates an attestation; a test-only release never mutates into a stronger state. <!-- II-CLAUSE-1184 --> The loop repeats until release requirements pass or the Owner explicitly accepts provisional closure without relabeling it.

## Completion boundary

<!-- II-CLAUSE-1185 --> The program has two non-compensating closure states:

- <!-- II-CLAUSE-1186 --> **Machine Complete**: deterministic implementation slices, development regressions, isolation and security tests, and sealed non-Greensleeves capability suites pass. <!-- II-CLAUSE-1187 --> Outputs may remain provisional while required human evidence is missing.
- <!-- II-CLAUSE-1188 --> **Release Complete**: Machine Complete plus current compatible Capability Qualifications and every exact-artifact role-scoped human, physical, idiom, historical, notation, relationship, and Owner review required by the selected acceptance profiles.

<!-- II-CLAUSE-1189 --> Unqualified `complete` in this specification means Release Complete. <!-- II-CLAUSE-1190 --> Machine Complete may be accepted as an explicit provisional stopping point, but it does not satisfy the expert-quality product claim.

### Machine Complete

- <!-- II-CLAUSE-1191 --> one real reference travels from upload or safe acquisition through versioned identity, Page Atlas, cited extraction, candidate review, immutable release and attestation, complete applicability resolution, arrangement consequence, and Reassessment;
- <!-- II-CLAUSE-1192 --> migration preserves every legacy ID, byte, hash, and citation through a verified mapping or actionable quarantine without inventing provenance;
- <!-- II-CLAUSE-1193 --> unauthorized provider egress, fixture inclusion, logs, reports, exports, and redistribution are blocked across the complete derivative graph; <!-- II-CLAUSE-1194 --> every remote request is reconstructed from a server-minted Egress Envelope rather than arbitrary client context, and every committed provider result is bound to the exact attempt, response, tools, validation, inputs, and canonical output by a server-issued Result Commit;
- <!-- II-CLAUSE-1195 --> no tracked code, test, fixture, prompt example, or built-in table contains source-derived material without an exact provenance path and repository-inclusion and redistribution decision;
- <!-- II-CLAUSE-1196 --> hostile and oversized acquisition, parser, rendering, pack-parameter, and content-reference cases fail safely within resource bounds;
- <!-- II-CLAUSE-1197 --> every Arrangement Search that claims historical, editorial, pedagogical, or software-guided behavior records a complete Applied Knowledge Manifest over an exact Catalog, Resolution Policy, and Component Registry Snapshot;
- <!-- II-CLAUSE-1198 --> every authority-affecting prompt, table, default, compiler branch, ranker, validator, and presentation label appears in the exact Authority Path Inventory and resolves through the Component Registry and Applied Knowledge Manifest or is mechanically classified with evidence;
- <!-- II-CLAUSE-1199 --> omitted eligible packs, dependencies, conflicts, exclusions, Activation Authorities, rights decisions, or authority paths invalidate a manifest;
- <!-- II-CLAUSE-1200 --> no release activated only by a test-only attestation is active in default or machine-ready output;
- <!-- II-CLAUSE-1201 --> explicitly nonhistorical maintainer-reviewed software or editorial defaults can power ordinary output without being mislabeled historical or specialist-reviewed;
- <!-- II-CLAUSE-1202 --> Source Voice Graphs distinguish voices from parts and staves, and Principal Voice preservation works by default under the exact time- and part-scoped Transposition Plan without a specialist prompt;
- <!-- II-CLAUSE-1203 --> Target Voice, Harmonic, and Relationship Plans prevent structural voices, rests, entries, harmony, inversion, suspensions, bass functions, and cadential relationships from disappearing silently;
- <!-- II-CLAUSE-1204 --> requested song outputs preserve versioned lyric underlay, and canonical ties, slurs, and source-notated ornaments retain notation, lineage, and playback semantics;
- <!-- II-CLAUSE-1205 --> the figured-bass Golden Fixture traverses canonical Figure Signs, Groups, continuation spans, constraint segments, generated mappings, the new pack, manifest, Voice, Harmonic, Relationship, Continuo Realization, and Disposition contracts and passes every required mutation;
- <!-- II-CLAUSE-1206 --> the imitative-counterpoint Golden Fixture traverses the same contracts and preserves ordered entries and subject relationships without assuming one Principal Voice;
- <!-- II-CLAUSE-1207 --> instrument mechanics, ergonomics, historical evidence, modern pedagogy, editorial convention, software heuristics, personal preference, and evaluation remain distinct;
- <!-- II-CLAUSE-1208 --> the Owner can author, calibrate, version, select, and inspect exact Instrument Instances; a missing evaluator input produces incomplete physical evidence rather than a default-derived pass;
- <!-- II-CLAUSE-1209 --> the three immutable Greensleeves known-bad output bundles remain failing evidence, while separate generative regressions prove each pinned old system fails and each repaired system produces a distinct passing output under unchanged evaluators;
- <!-- II-CLAUSE-1210 --> each target passes at least two sealed non-Greensleeves contamination groups, and dedicated Continuo and imitative groups pass;
- <!-- II-CLAUSE-1211 --> every Capability Qualification and UI label states its exact Claim Scope, exclusions, provider conditions, workload envelope, and unclaimed dimensions rather than implying universal target qualification;
- <!-- II-CLAUSE-1212 --> baroque-guitar output realizes exact two-dimensional course-and-fret contacts and transitions plus supported orthogonal attack, gesture, alfabeto, course-allocation, constituent-string, resonance, and damping facets rather than a mislabeled flat mode;
- <!-- II-CLAUSE-1213 --> baroque-lute output rejects the known reach; realizes explicit right-hand digit allocation, preparation, simultaneity, alternation, crossing, thumb behavior, calibrated plucking-zone and diapason access, and stopped-course/diapason transitions; models diapasons independently; and labels every course-13 convention as historical, editorial, or unknown according to direct evidence;
- <!-- II-CLAUSE-1214 --> the three coequal Golden Engraving and Playback Fixtures pass target-specific semantic, glyph, placement, constituent-string, written-to-sounding, voice-layer, tie, MIDI identity, and duplicate-playback checks;
- <!-- II-CLAUSE-1215 --> classical-guitar output provides coherent planned voices, exact joint-hand state, multi-voice rests and spanners, and first-class standard notation;
- <!-- II-CLAUSE-1216 --> notation and playback agree with canonical notes, written and sounding pitch, voices, positions, constituent strings, gesture timing, held and damped state, and Performed Form;
- <!-- II-CLAUSE-1217 --> generation is technically unable to read evaluator-only expectations, mutations, baselines, labels, or vault contents outside its sealed source envelope;
- <!-- II-CLAUSE-1218 --> the public repository contains no resolvable held-out identity, truth, mutation, invalidation, reserve order, or diagnostic, and the encrypted Vault passes isolation, integrity, backup, restore, migration, retention, purge, and exposure-ledger tests;
- <!-- II-CLAUSE-1219 --> every held-out attempt appears in a finalized append-only ledger, every valid failure remains a permanent regression, successors inherit the unconsumed reserve cursor, and qualified truth and evaluator roles are independently verified;
- <!-- II-CLAUSE-1220 --> stochastic qualifications satisfy their precommitted repeated-trial and confidence policy, and opaque-provider qualifications remain within their pinned sentinel or expiry boundary;
- <!-- II-CLAUSE-1221 --> hard-gate status passes only when every required applicable gate completed and passed;
- <!-- II-CLAUSE-1222 --> aggregate acceptance precedence reports conclusive violations as fail, otherwise unavailable required dependencies as blocked, otherwise unfinished evidence as incomplete; none is displayed as pass;
- <!-- II-CLAUSE-1223 --> default candidate selection records Search Measurements and Selection Policy rather than using hidden totals or held-out evaluation, and only a passing immutable Adoption Decision creates the default Arrangement Score;
- <!-- II-CLAUSE-1224 --> bounded search distinguishes `unsat_proven`, `budget_exhausted`, `cancelled`, and `infrastructure_failed` from `found`;
- <!-- II-CLAUSE-1225 --> all pinned Performance Acceptance Profiles and tracer-applicable build, browser, evaluation, rendering, playback, security, migration, and real-tool gates pass;
- <!-- II-CLAUSE-1226 --> the real-browser PDF-to-three-target workflow is resumable, rehydrates completed siblings, retries only incomplete work, avoids duplicate versions, and opens the selected score;
- <!-- II-CLAUSE-1227 --> material alternatives, conflicts, compromises, activation modes, and unknowns remain visible; and
- <!-- II-CLAUSE-1228 --> complete typecheck, test, formatting, specification, evaluation, rendering, playback, security, migration, and relevant real-tool gates pass.

### Release Complete

- <!-- II-CLAUSE-1229 --> every historical or specialist presentation has a current credential-backed, externally verified, scope-appropriate attestation over the exact release and claim or profile scope;
- <!-- II-CLAUSE-1230 --> every consequential source transcription/extraction used by a release has a current independently scoped exact-package review;
- <!-- II-CLAUSE-1231 --> every historical claim, pack, and profile used by a release has a current independently scoped exact-package review;
- <!-- II-CLAUSE-1232 --> every release package has a current metadata/rights review over its exact source, derivative, export, and redistribution state;
- <!-- II-CLAUSE-1233 --> every released target artifact cites a current compatible Capability Qualification over its exact Generation System and profile closure;
- <!-- II-CLAUSE-1234 --> exact-digest target-player playtests are current for all three target outputs under their pinned Instrument Instances and Performance Briefs;
- <!-- II-CLAUSE-1235 --> each target has a separately qualified, profile-specific idiom review; a novice Owner playtest remains personal ergonomic evidence rather than historical authority;
- <!-- II-CLAUSE-1236 --> the harpsichord Continuo and imitative outputs have qualified profile- and target-specific musical reviews of source voices, harmonic plan, spacing, doubling, voice leading, disposition, and contrapuntal realization as applicable;
- <!-- II-CLAUSE-1237 --> requested sung-text outputs have qualified underlay review when textual alignment is a claimed dimension;
- <!-- II-CLAUSE-1238 --> every in-scope Source Voice, Harmonic, Relationship, Transposition, tie, slur, phrase, and source-ornament dimension has a current source-to-output musical-fidelity review independent of target idiom and engraving review;
- <!-- II-CLAUSE-1239 --> engraving-editor and Owner cross-target usefulness reviews are current;
- <!-- II-CLAUSE-1240 --> every course-13-specific historical claim has directly applicable released evidence, or an editorial-profile output explicitly makes no historical-authenticity claim for that sign;
- <!-- II-CLAUSE-1241 --> every finding-triggered repair completed impact analysis, fresh deterministic evaluation, replacement of contaminated holdouts, and review of changed digests;
- <!-- II-CLAUSE-1242 --> no required acceptance dimension remains unknown, incomplete, or supported only by test-only knowledge; and
- <!-- II-CLAUSE-1243 --> every tracer is committed and pushed to main before its dependent tracer begins.

## Non-goals

- <!-- II-CLAUSE-1244 --> Training a model on the Owner's library.
- <!-- II-CLAUSE-1245 --> Treating model memory, web search, OCR, OMR, or corpus frequency as historical authority.
- <!-- II-CLAUSE-1246 --> Bulk-importing the entire BLUEUSB volume without selection, identity review, and deduplication.
- <!-- II-CLAUSE-1247 --> Coupling the product to IMSLP or any one repository.
- <!-- II-CLAUSE-1248 --> Redistributing copyrighted books or provider scans merely because the underlying Work is old.
- <!-- II-CLAUSE-1249 --> Establishing one universal baroque-guitar, lute, or classical-guitar technique.
- <!-- II-CLAUSE-1250 --> Calling a source-scoped practice a universal instrument rule.
- <!-- II-CLAUSE-1251 --> Treating one Greensleeves output, one accepted fingering, one method, one performer, or one held-out run as proof of general target-instrument idiom.
- <!-- II-CLAUSE-1252 --> Storing held-out-from-development labels or reserve assets in ordinary repository fixtures where generation or development agents can inspect them.
- <!-- II-CLAUSE-1253 --> Claiming total physical playability from geometry, synthesis, or one evaluator.
- <!-- II-CLAUSE-1254 --> Claiming that an unevaluated ornament, articulation, overholding, attack-release, tone-production, or perceptual-prominence dimension passed merely because notation and MIDI compile.
- <!-- II-CLAUSE-1255 --> Generating realistic historical-instrument audio; <!-- II-CLAUSE-1256 --> Audio Preview remains a checking tool.
- <!-- II-CLAUSE-1257 --> Replacing accepted lineage, Preservation Audit, Arrangement Search, or evaluation architecture.
- <!-- II-CLAUSE-1258 --> Reopening completed historical tracer waves as the execution tracker for this work.

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
