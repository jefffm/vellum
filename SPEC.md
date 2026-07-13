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

### Constitutive technique belongs to the score plan

Technique belongs to the Arrangement Plan or Arrangement Score when it changes the musical event, available notes, sounding courses, voice continuity, duration, articulation identity, or notation. Examples include a rasgueado stroke, an alfabeto chord, required course suppression, a campanella fingering that sustains overlapping notes, or a required damping event.

Optional execution detail belongs to Performance Interpretation when changing it leaves the canonical notated and sounding musical obligations intact. The same family of technique may occupy different layers in different passages, so the decision is explicit rather than globally hard-coded.

### Packs contain declarative knowledge, not executable uploads

Knowledge Packs may name registered compiler and evaluator components and provide schema-validated parameters. An imported document or pack cannot supply arbitrary executable code, file paths, shell commands, templates with active content, or provider credentials.

### Old results remain reproducible

A new source, claim, profile, pack release, compiler, or evaluator never rewrites an existing Arrangement Search or Arrangement Score. It may create a Knowledge Reassessment explaining that regeneration could improve or invalidate an earlier readiness claim.

## Reference-source substrate

### Durable identity graph

Reference identity is decomposed into the following immutable or versioned records:

```ts
type Work = {
  id: string;
  title: string;
  creators: AgentIdentity[];
  workDate?: DateRange;
};

type Edition = {
  id: string;
  workId: string;
  publicationStatement: string;
  language: string[];
  editorIds: string[];
  translatorIds: string[];
  declaredChanges: string[];
};

type Exemplar = {
  id: string;
  editionId: string;
  holdingInstitution?: string;
  shelfmark?: string;
  completeness: "complete" | "incomplete" | "unknown";
  exemplarNotes: string[];
};

type DigitalAsset = {
  id: string;
  exemplarId?: string;
  sha256: string;
  mediaType: string;
  byteLength: number;
  sourceKind: "upload" | "stable_url" | "iiif" | "library_object" | "private_scan";
  retrievalUri?: string;
  retrievedAt?: string;
  localAccess: "owner_private" | "redistributable" | "metadata_only";
};

type SourceSegment = {
  id: string;
  digitalAssetId: string;
  printedLocator?: string;
  scanLocator: string;
  region?: PageRegion;
  musicalRange?: MusicalRange;
  modality: SourceModality;
  sourceImageRef: ContentRef;
};
```

An import may begin with incomplete identity. Filename, repository grouping, and catalog metadata are candidate evidence, not proof of edition identity. Review can link or correct identities without changing the immutable asset bytes.

### Rights and access

The following assertions remain separate:

- underlying Work status;
- Edition, translation, or editorial rights;
- physical Exemplar restrictions;
- scan-provider terms and requested attribution;
- Owner-private access;
- local extraction permission;
- pack citation and excerpt permission; and
- export or redistribution permission.

A public-domain Work does not imply that every digital scan is unrestricted. A copyrighted Owner-owned method may support local cited candidates without permitting source pages or extracted content to enter a repository pack.

Rights uncertainty blocks redistribution, not necessarily private local study. The UI must say which operation is allowed and why.

### Page atlas

Every paged asset receives a versioned Page Atlas that records:

- scan or canvas order;
- printed pagination, foliation, plate labels, and separate internal sequences;
- missing, duplicate, rotated, cropped, damaged, or blank pages;
- detected regions and their modality;
- links across split text and plate volumes; and
- corrections with provenance.

The atlas is the routing and citation surface. It is not a single OCR transcript.

### Modality-specific extraction

Regions may independently route to:

- modern prose OCR;
- long-s or historical-type OCR;
- Fraktur OCR;
- staff OMR;
- printed tablature recognition;
- handwritten tablature recognition;
- alfabeto or diagram extraction;
- handwriting recognition;
- table or parallel-layout alignment;
- translation; or
- visual-only review.

Every Extraction Run records component identity, version, configuration, inputs, outputs, confidence, geometry, logs, and failure state. Extracted text or notation never replaces the source crop as citation authority.

### Cited extraction artifacts

A candidate derived from a source retains:

- exact Source Segment identity and asset digest;
- source crop and geometry;
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

The Historical Knowledge Base becomes one lane in a broader Reviewed Knowledge Library.

Initial pack kinds are:

- historical practice;
- analytical and contrapuntal;
- continuo and figured bass;
- modern pedagogy;
- editorial convention;
- software profile; and
- notation convention.

Instrument mechanics, Instrument Instances, Personal Defaults, Owner Ergonomic Profiles, and evaluator datasets remain linked external records rather than being smuggled into a pack kind.

### Knowledge Candidates

A Knowledge Candidate has one explicit kind:

- prescription;
- worked example;
- descriptive observation;
- modern synthesis;
- editorial convention;
- Vellum heuristic;
- counterexample;
- validation guidance;
- unresolved conflict; or
- research question.

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

### Knowledge Pack releases

A released pack is immutable and content-addressed. A new release creates a new identity.

```ts
type KnowledgePackRelease = {
  id: string;
  packId: string;
  version: number;
  digest: string;
  kind: KnowledgePackKind;
  releaseState: "draft" | "test_only" | "owner_reviewed_local" | "specialist_reviewed";
  claimRefs: DigestedRef[];
  observationRefs: DigestedRef[];
  exampleRefs: DigestedRef[];
  counterexampleRefs: DigestedRef[];
  profileRefs: DigestedRef[];
  conflictRefs: DigestedRef[];
  dependencyRefs: DigestedRef[];
  reviewerAssertions: ReviewerAssertion[];
  rightsAssertions: RightsAssertion[];
};
```

Owner-reviewed local knowledge may guide local work with explicit disclosure. It is not presented as specialist-reviewed historical practice. AFK automation may build extraction artifacts, candidates, test-only packs, and review packages; it may not invent the human authority required for a stronger release state.

### Profiles and compiler mappings

A pack profile contains:

- applicability predicates;
- scoped claims and observations;
- examples and counterexamples;
- permitted, preferred, discouraged, and prohibited outcomes;
- declarative mappings to registered Analysis, planning, compiler, notation, playback, and evaluator components;
- parameter values and units;
- conflict and precedence policy;
- expected observable consequences; and
- limitations and unevaluated dimensions.

Profiles are not prompt fragments. Prompt summaries may be derived from them, but search constraints and evaluators consume the same typed profile identity.

## Applied Knowledge Manifest

Analysis and planning resolve knowledge against an exact context:

- source date and uncertainty;
- region and school;
- genre and source type;
- Texture and Contrapuntal Technique;
- intended technique;
- instrument profile and exact Instrument Instance;
- course or string count;
- tuning and stringing;
- ensemble role;
- Performance Brief;
- Preservation Policy; and
- passage scope.

Resolution produces an immutable Applied Knowledge Manifest.

```ts
type AppliedKnowledgeEntry = {
  profileRef: DigestedRef;
  status: "applicable" | "inapplicable" | "conflicting" | "unknown";
  matchedPredicates: string[];
  unmatchedPredicates: string[];
  consequences: ComponentBinding[];
  evidenceRefs: DigestedRef[];
  rationale: string;
};

type AppliedKnowledgeManifest = {
  id: string;
  contextDigest: string;
  packReleaseRefs: DigestedRef[];
  entries: AppliedKnowledgeEntry[];
  unresolvedConflictIds: string[];
  selectedAlternativeIds: string[];
  digest: string;
};
```

Every Arrangement Search records the exact manifest, pack release digests, registered component versions, and compiled constraint digests it used.

Unknown applicability cannot be scored as neutral. Conflicting historically plausible profiles either produce separate candidate families or open a focused review when the choice materially changes the result.

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

### Target Voice Plan

Every polyphonic or melody-with-accompaniment passage receives a Target Voice Plan before physical search.

```ts
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
  continuity: "continuous" | "phrase_bound" | "cadential" | "intermittent";
  allowedTransformations: TransformationKind[];
  cadenceObligations: MusicalObligation[];
  rangeIntent?: PitchRange;
  rhythmicIndependence: "preserve" | "simplify" | "may_merge";
};

type TargetVoicePlan = {
  passageId: string;
  texture: string;
  voices: TargetVoice[];
  crossingPolicy: string;
  omissionPriority: string[];
  perceptualProminence: string[];
  evaluationRequirements: DigestedRef[];
};
```

The Principal Voice is not merely a set of retained pitch classes. Under Faithful Reduction, its pitch, rhythm, order, phrase relationships, and required prominence are hard constraints. Other voices receive explicit continuity and cadence policies instead of disappearing event by event.

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

### Candidate output

An Arrangement Candidate includes:

- canonical notes, rhythms, voices, and event identities;
- target positions and exact Instrument Instance;
- constitutive technique events;
- hidden fingering or execution evidence when not engraved;
- Applied Knowledge Manifest and compiled constraints;
- Transformation Report and Preservation Audit;
- independent evaluation results;
- rejected alternatives and binding constraints;
- incoming and outgoing state;
- unknown and not-evaluated dimensions; and
- reproducible search identity.

## Five-course baroque-guitar compiler

### Required musical modes

The compiler supports passage-level:

- punteado;
- rasgueado;
- mixed style;
- alfabeto;
- campanella;
- battuto or batterie patterns;
- repicco where an applicable profile supports it; and
- explicit transitions among these modes.

Technique names alone are not sufficient. Each mode has its own event semantics, candidate generator, physical state, notation, playback, and evaluator.

### Exact target configuration

The compiler consumes:

- single and doubled course construction;
- unison or octave pairing;
- re-entrant or bourdon stringing;
- tuning and pitch reference;
- scale and fret geometry;
- available alfabeto chart releases;
- notation convention; and
- performer and technique context.

No generic five-line fretboard may silently stand in for these facts.

### Punteado

Punteado search tracks individual right-hand allocation, preparation, alternation, repeated-course behavior, simultaneity, held notes, and left-hand transitions.

Right-hand digit resources are source- and profile-scoped. Vellum must not encode a universal three-finger rule: Sanz explicitly permits a fourth right-hand finger in some four-voice contexts. A profile may prefer or limit particular digits for a school, source, texture, or performer, but the scope and evidence remain inspectable.

Large simultaneities cannot be labeled idiomatic punteado merely because the left hand can form them. The compiler either finds a supported plucked allocation, selects a historically and musically valid strummed event, reduces the texture under policy, or reports the conflict.

### Rasgueado and alfabeto

An alfabeto event retains:

- chord and inversion intention;
- exact source chart and pack release;
- alfabeto symbol and shape identity;
- target tuning and stringing compatibility;
- left-hand shape, barré, and held state;
- physical stroke path and direction;
- stroke digit or gesture where constitutive;
- sounded-course mask;
- omitted-course mask;
- muted-course mask;
- courses held through the event; and
- notation ambiguity.

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
- exact scale length, fret geometry, and setup;
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
- stopped-course stringing effects;
- incoming and outgoing phrase state; and
- tempo, preparation, and reliability goal.

The Owner's approximately 690 mm Instrument Instance is a first-class regression context. The Greensleeves f/b combination spanning frets 1 through 5 must fail the applicable personal or calibrated ergonomic gate when a closer valid realization exists.

### Diapasons, resonance, and right hand

Open diapason changes are not left-hand shifts. They require independent modeling of:

- right-hand preparation and reach;
- bass-course succession;
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

### Baroque-lute acceptance

For the Greensleeves regression:

- the f/b reach is rejected under the exact Owner context;
- at least one musically equivalent closer realization is generated or the search honestly reports why none was found;
- left-hand and right-hand costs are not conflated;
- diapason use preserves voice and harmonic intent;
- resonance and damping obligations are explicit;
- the Principal Voice remains recognizable;
- tablature and playback agree on course identity and pitch; and
- the thirteenth sign is disclosed as sourced, editorial, or unresolved.

## Six-string classical-guitar compiler

### Target Voice Plan is mandatory

For music containing a melody and meaningful subordinate line, the default plan contains:

- a continuous Principal Voice;
- a coherent Bass or Countervoice;
- optional Inner Fill whose omission priority is lower than either structural voice; and
- explicit cadence, inversion, rhythmic, and voice-duration obligations.

Sparse isolated bass notes may be a disclosed reduction choice, but they cannot be presented as a successful two-voice arrangement.

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

Audio Preview can isolate every planned target voice. A voice that is declared continuous but vanishes in playback is a hard failure.

### Classical-guitar acceptance

For the Greensleeves regression:

- the Principal Voice remains note- and rhythm-correct;
- the Bass or Countervoice satisfies its declared continuity and cadence plan;
- the source's substantial bass cannot collapse to four isolated events without an explicit Plan Conflict or policy-authorized disclosure;
- all simultaneous notes and durations are mechanically realizable;
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

### Generator and evaluator separation

The same pack may explain why an evaluator applies and provide cited rubric anchors. It may not certify its own output. Evaluators inspect the generated canonical notes, rhythms, voices, positions, technique events, engraving, and playback.

Compiler assertions such as preserved principal voice, idiomatic, playable, historical profile, or coherent bass are hypotheses until the appropriate independent evaluator checks observable output.

### Dataset roles

Every source segment, repertoire example, playtest, and fixture has one role for a particular component version:

- derivation or profile authoring;
- development and debugging;
- evaluator calibration;
- held-out evaluation; or
- post-deployment monitoring.

A source used to derive a profile cannot be the sole proof that the profile generalizes. Moving evidence between roles creates a new dataset identity and invalidates incompatible comparisons.

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
- held-note, damping, or duration corruption;
- right- and left-hand cost conflation;
- an applicable pack omitted from search identity;
- an inapplicable or conflicting profile treated as active;
- an extraction promoted without review;
- a private source exported without authority;
- notation and playback disagreement; and
- an evaluator or pack attempting to self-certify.

Mutation success proves sensitivity only to the mutated class. It does not imply general musical correctness.

### Fixture strategy

Greensleeves remains the shared cross-target source because it exposes recognizability, reduction, voice continuity, and three distinct physical realizations.

Each target also receives its own legally usable fixture set:

- baroque guitar: exact stringing, alfabeto, stroke masks, punteado allocation, and mixed-style transition;
- baroque lute: stopped-course geometry, diapason succession, resonance, damping, and French tablature;
- classical guitar: reviewed two- and three-voice texture with independent voice-duration and fingering invariants.

The corpus also retains separate Continuo and imitative-counterpoint cases so shared contracts do not collapse into fretted-position logic.

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

### First extraction fixtures

1. Mace: preserve the exact ordered sequence a, /a, //a, ///a, 4, 5 and refuse to infer a thirteenth symbol.
2. Sanz: extract rules and examples that prevent an unscoped universal three-finger rule.
3. Corbetta: represent stroke path, sounding courses, suppression, held harmony, and notation ambiguity independently.
4. Carulli: align a source texture with its guitar reduction and propose retain, omit, octave, rhythm, and accompaniment transformations.
5. Weiss: retain image geometry while extracting descriptive tablature and bass observations only.
6. Sor: link text assertions to separate plates and distinguish the 1830 edition from the Harrison rewrite.

One source per target proves plumbing, not idiomatic authority.

## Execution sequence

Implementation proceeds through production-path tracer bullets. Each tracer begins with a failing output-level or contract-level case, crosses the real canonical path, and ends with a demoable Owner outcome.

### Slice 0 — Specification and baseline guard

- Make this document the sole current specification.
- Freeze earlier documents as history.
- Correct active domain and README claims that overstate historical authority or prototype playability.
- Verify that the completed prototype evidence remains intact.

### Slice 1 — Source identity and safe migration

- Introduce Work, Edition, Exemplar, Digital Asset, rights, and access records.
- Migrate current OwnerReference records without losing IDs, bytes, hashes, or citations.
- Separate historical, modern editorial, software, personal, and evaluator authority lanes.
- Remove automatic perfect confidence for documentary classification.

### Slice 2 — Mace ingestion vertical

- Upload or acquire the Mace asset.
- Resolve its source identity.
- Build and resume a Page Atlas.
- Create an exact cited segment for printed page 75.
- Stage the twelve-course notation candidate and explicit thirteenth-course research question.
- Complete the path in the real browser without promoting specialist authority.

### Slice 3 — Candidate, pack, and applicability vertical

- Add candidate kinds, many-to-many evidence, conflict relations, multidimensional confidence, and release states.
- Produce a test-only pack with profiles, examples, counterexamples, and declarative mappings.
- Resolve it into an Applied Knowledge Manifest.
- Record exact digests in Arrangement Search and Evaluation Run identity.
- Prove that unknown and conflicting applicability remain visible.

### Slice 4 — Shared phrase intelligence

- Add Target Voice Plan and Intended Technique Plan.
- Add exact ergonomic context and phrase boundary state.
- Replace event-local musical selection with phrase-level candidate state.
- Ensure Principal Voice, bass, counterpoint, Continuo Foundation, cadence, and target texture compile into observable constraints.

### Slice 5 — Evaluation substrate

- Add source, extraction, pack, applicability, compiler, and output mutation fixtures.
- Partition derivation, development, calibration, and held-out evidence.
- Remove or relabel proxy scores that lack observable evaluators.
- Add readiness dimensions for historical authority, idiom, target voices, and ergonomics.

### Slice 6 — Baroque-guitar vertical

- Run one reviewed Sanz or Corbetta evidence path into test-only profiles.
- Implement punteado, rasgueado, alfabeto, and mixed-style phrase semantics.
- Model right-hand resources and independent stroke and course masks.
- Fix the exact Greensleeves regression through the production Arrangement Search, engraving, playback, and workbench.

### Slice 7 — Baroque-lute vertical

- Run Mace plus one normative and one repertoire evidence path into scoped test-only profiles.
- Implement scale-aware left-hand geometry and independent right-hand diapason state.
- Make notation identity explicit and refuse unsupported historical claims.
- Fix the exact Greensleeves f/b regression through the full production path.

### Slice 8 — Classical-guitar vertical

- Run Sor plus one Carulli aligned reduction into scoped test-only profiles.
- Implement joint Target Voice Plan realization and polyphonic phrase search.
- Produce first-class standard notation and voice-isolated playback.
- Fix the exact disappearing-bass regression through the full production path.

Slices 6 through 8 are coequal sibling realizations of the shared contracts. They may proceed independently once slices 3 through 5 stabilize, but parity is incomplete until all three pass their own acceptance cases.

### Slice 9 — Source refinement and reassessment

- Ingest corroborating and conflicting sources.
- Support source comparison, narrowing, contradiction, supersession, retraction, and research questions.
- Produce affected-arrangement Knowledge Reassessments without mutation.
- Prove rights-safe behavior for public and private references.

### Slice 10 — Reviewed learning and workbench

- Classify edits, playtests, feedback, and evaluator disagreements.
- Propose but do not auto-activate Personal Defaults, Ergonomic Profiles, Knowledge Candidates, Calibration Candidates, and fixtures.
- Add pack diff, review, release, retraction, and affected-workspace navigation.
- Preserve complete lineage and recovery.

### Slice 11 — Cross-target end-to-end acceptance

- Upload a real PDF through Guided Start.
- Complete consequential Score-Anchored Review.
- Produce all three sibling Arrangement Scores.
- Compare meaningful alternatives.
- Verify notation, Audio Preview, score following, voice or technique isolation, manual edit adoption, and version history.
- Emit Evaluation Cards and a compatible baseline comparison from exact manifests.

### Slice 12 — Late human review and release

HITL is intentionally concentrated here so AFK implementation can safely use test-only or explicitly provisional knowledge.

The review package includes:

- metadata and rights review;
- source transcription and extraction review;
- historical-claim and pack-profile review by declared role;
- target-player physical playtests for all three instruments;
- engraving-editor review;
- Owner cross-target usefulness review;
- disagreements and unresolved dimensions;
- exact pack, compiler, evaluator, source, and output digests; and
- rerun instructions.

Only after the required role-scoped reviews may a test-only profile move to owner-reviewed local or specialist-reviewed status. Missing specialist evidence remains missing; the Owner may accept a provisional local workflow without relabeling its authority.

## Completion boundary

This specification is complete only when all of the following are true:

- one real reference can travel from upload or stable acquisition through identity, Page Atlas, cited extraction, candidate review, pack release, applicability, arrangement consequence, and reassessment;
- later sources can corroborate, narrow, contradict, or supersede knowledge without rewriting history;
- private sources remain local and cannot leak through packs, fixtures, reports, or exports;
- every Arrangement Search records an exact nonempty Applied Knowledge Manifest when historical or editorial behavior is claimed;
- every historically described output links to applicable released evidence;
- Principal Voice preservation works by default without a specialist prompt;
- Target Voice Plans prevent structural subordinate voices from disappearing silently;
- instrument mechanics, ergonomics, historical evidence, modern pedagogy, software heuristics, personal preference, and evaluation remain distinct;
- baroque-guitar output implements a declared and supported punteado, rasgueado, or mixed technique plan;
- baroque-lute output rejects the known reach, models diapasons independently, and does not invent historical notation;
- classical-guitar output provides coherent planned voices in standard notation;
- all three target regressions fail before their fixes and pass afterward at the generated-output level;
- notation and playback agree with canonical notes, voices, positions, technique events, and Performed Form;
- evaluation uses hard gates plus separate dimensions, not a compensating overall score;
- held-out evidence is isolated from derivation and calibration;
- the real-browser PDF-to-three-target workflow is resumable and inspectable;
- material alternatives, conflicts, compromises, and unknowns are visible;
- role-scoped human evidence is complete or explicitly left unevaluated without false certification;
- the complete typecheck, test, formatting, specification, evaluation, rendering, playback, and relevant real-tool gates pass; and
- every completed tracer is committed and pushed to main before its dependent tracer begins.

## Non-goals

- Training a model on the Owner's library.
- Treating model memory, web search, OCR, OMR, or corpus frequency as historical authority.
- Bulk-importing the entire BLUEUSB volume without selection, identity review, and deduplication.
- Coupling the product to IMSLP or any one repository.
- Redistributing copyrighted books or provider scans merely because the underlying Work is old.
- Establishing one universal baroque-guitar, lute, or classical-guitar technique.
- Calling a source-scoped practice a universal instrument rule.
- Claiming total physical playability from geometry, synthesis, or one evaluator.
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
