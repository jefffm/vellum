# Vellum Music Arrangement

Vellum turns an existing musical source into a playable arrangement while making the intended balance between source fidelity and target-instrument idiom explicit.

## Language

**Principal Voice**:
The source voice whose musical identity is intentionally carried through the arrangement.
_Avoid_: Lead voice, lead line, melody, soprano when the specific role has not yet been established

**Preservation Target**:
A source element or musical relationship whose identity the selected Preservation Policy protects during arrangement.
_Avoid_: Important material, thing to preserve

**Texture**:
The relationship among sounding voices in a passage, such as monophony, melody with accompaniment, homophony, free polyphony, imitative polyphony, or continuo texture.
_Avoid_: Counterpoint type

**Contrapuntal Technique**:
A compositional procedure relating voices, such as imitation, canon, fugue, invertible counterpoint, ground bass, sequence, or a suspension chain.
_Avoid_: Texture

**Cadential Hemiola**:
A metric regrouping near a cadence in which triple-meter events temporarily articulate two-beat groupings across the notated meter.
_Avoid_: Meter change when the notated meter is unchanged, any syncopation near a cadence

**Species Counterpoint**:
The first-through-fifth-species pedagogical framework for controlled counterpoint exercises.
_Avoid_: General label for contrapuntal repertoire

**Figured Bass**:
A bass line with written interval and alteration signs that constrain the harmony above it.
_Avoid_: Chord symbols

**Continuo Foundation**:
The authoritative bass line and Figured Bass signs from which a continuo part is realized.
_Avoid_: Accompaniment

**Continuo Realization**:
Generated upper-voice material that fulfills a Continuo Foundation according to historical, contrapuntal, and instrumental context.
_Avoid_: Source harmony

**Continuo Reduction**:
An arrangement for a target that cannot sound the complete Continuo Foundation, with unsounded bass events explicitly mapped and disclosed rather than represented as a complete Continuo Realization.
_Avoid_: Continuo Realization, simplified continuo

**Realization Profile**:
A historically scoped set of continuo practices associated with a period, region, genre, ensemble role, and target instrument.
_Avoid_: Style when the historical constraints matter

**Realization Context**:
A passage-level analytical abstraction of musical conditions such as phrase function, cadence, Texture, voices, harmony, meter, and available technique, used to compare instrumental treatments without asserting a reconstructed source.
_Avoid_: Reconstructed source, original version, instrument-neutral source

**Attested Realization**:
A cited observation that an exact instrumental treatment occurs in one passage under a stated Realization Context, without claiming that the treatment is typical or preferred.
_Avoid_: Idiom, rule, default

**Idiom Evidence Lineage**:
The reviewed relationship among observations that may derive from the same underlying passage or treatment and therefore cannot be counted as independent merely because they occur in different assets, editions, or transcriptions.
_Avoid_: File count, occurrence count, evaluation Contamination Group

**Recurring Idiom**:
A reviewed, scoped generalization supported by sufficiently independent Attested Realizations or stronger explicit evidence.
_Avoid_: Any recurring-looking fragment, universal instrument rule

**Musical Idiom**:
A scoped Recurring Idiom concerning composition or musical practice, such as genre, dance, regional, formal, contrapuntal, rhythmic, or harmonic behavior, independently of target-instrument mechanics.
_Avoid_: Instrument idiom when the evidence concerns broader musical practice

**Instrumental Idiom**:
A scoped Recurring Idiom concerning how a Realization Context is treated using the resources, technique, mechanics, resonance, or notation of an instrument or Instrument Instance.
_Avoid_: Musical idiom merely observed in instrumental repertoire

**Historical Practice Claim**:
A source-backed assertion about historical musical practice with an explicit period, region, genre, instrument, and ensemble scope.
_Avoid_: Rule, best practice

**Validation Profile**:
The historically and texturally scoped set of constraints, preferences, and observations used to evaluate a passage or arrangement.
_Avoid_: Music theory rules, lint configuration

**Validation Finding**:
A score-anchored result classified as a hard constraint failure, soft preference, or descriptive observation under a named Validation Profile.
_Avoid_: Error when the finding is not prohibitive

**Arrangement Workspace**:
The durable project record containing Source Artifacts, Score Transcriptions, Analysis Records, corrections, plans, arrangements, Deliverables, and provenance.
_Avoid_: Session, chat

**Personal Defaults**:
User-specific instrument, notation, stringing, and workflow preferences that apply across Arrangement Workspaces.
_Avoid_: Historical knowledge

**Personal Default Candidate**:
A proposed scoped preference inferred from repeated Owner choices across distinct Arrangement Workspaces that has no effect until explicitly approved.
_Avoid_: Learned default, automatic personalization

**Owner**:
The single person whose workspaces, defaults, and reviewed knowledge belong to a Vellum installation.
_Avoid_: User, account

**Provider Authorization**:
The credential grant that permits Vellum to call a model provider without determining ownership of Vellum data.
_Avoid_: Vellum login, user identity

**Provider Connection**:
Vellum's local lifecycle for acquiring, storing, refreshing, reporting, reconnecting, and removing Provider Authorization.
_Avoid_: Imported credentials, API key setting

**Model Action**:
A durable, retryable request for provider-dependent analysis, judgment, or generation, linked to exact input versions and committed to canonical musical state only after a complete validated result exists.
_Avoid_: Chat message, background job

**Egress Envelope**:
A server-minted immutable authorization for one Model Action attempt that binds the exact source and derivative versions permitted to leave the local trust boundary, named provider and model, purpose, Access Decisions, prompt and tool-capability identities, and redaction policy. Provider requests are reconstructed from this envelope rather than accepting arbitrary client-supplied context.
_Avoid_: Browser request body as provider authorization, Provider Connection as consent to transmit data

**Model Action Result Commit**:
A server-issued immutable binding from one Model Action attempt and Egress Envelope through the exact provider response, completed local tool results, validation evidence, input versions, and canonical result digest, published atomically with that result.
_Avoid_: Marking an attempt complete by naming any existing workspace record

**Local-First Runtime**:
The Owner's machine running Vellum's browser interface, services, musical toolchain, data stores, and provider callback as the primary deployment.
_Avoid_: Local mode

**Historical Knowledge Base**:
The reviewed, versioned collection of cited Historical Practice Claims and reusable historical profiles.
_Avoid_: Memory, model knowledge

**Reviewed Knowledge Library**:
The local-first collection of versioned Knowledge Packs whose orthogonal authority lanes and musical domains distinguish historical practice, modern pedagogy, editorial convention, software heuristics, analysis and counterpoint, continuo and Figured Bass, instrument technique, and notation.
_Avoid_: Training data, memory, one undifferentiated knowledge base

**Knowledge Pack**:
A versioned collection of typed claims or observations, scoped profiles, examples, counterexamples, applicability predicates, and declarative compiler and validation guidance for a defined musical domain.
_Avoid_: Prompt, preset

**Knowledge Pack Release**:
An immutable content-addressed graph snapshot of one Knowledge Pack authority lane and its typed entries, profiles, derivations, relationships, dependencies, schema, and digest. Review status and current eligibility are external attestations and advisories.
_Avoid_: Current pack, mutable profile

**Release Attestation**:
An immutable, reviewer-identified assertion that one exact Knowledge Pack Release was reviewed for a typed, digested claim or profile scope. Its trust and authorization are established separately by an Attestation Verification under a pinned verifier policy.
_Avoid_: Mutable release state, self-certified specialist pack

**Attestation Verification**:
An immutable external decision that authenticates a Release Attestation's reviewer when possible, tests authorization against a typed review scope, and records verified, out-of-scope, unverified, or revoked under an exact verifier policy.
_Avoid_: Reviewer-controlled trust field, attestation signature alone

**Release Advisory**:
An immutable notice that a Knowledge Pack Release or attestation is superseded, retracted, revoked, or rights-restricted without mutating its historical bytes.
_Avoid_: Delete release, change release status

**Advisory Verification**:
An immutable external decision that authenticates a Release Advisory issuer and tests authority over the exact advisory kind, subject, and scope under a pinned verifier policy.
_Avoid_: Trusting an `issuedBy` reference, advisory self-activation

**Activation Decision**:
An immutable allow, deny, or review-required decision over one exact release and profile, pinned attestations and verifications, rights decisions, effective advisories, requested scope, and Resolution Policy.
_Avoid_: Activation flag on a pack, strongest-attestation wins

**Knowledge Library Inventory Snapshot**:
The complete immutable enumeration of every Knowledge Pack Release reachable from pinned configured registries under an exact inventory builder and policy, before trust, rights, advisory, or applicability filtering.
_Avoid_: Packs selected by the resolver, directory listing without builder identity

**Applied Knowledge Manifest**:
The immutable, completeness-validated resolution of an exact Knowledge Library Inventory Snapshot, derived Knowledge Catalog Snapshot, and Resolution Policy against one passage, source context, Arrangement Plan, Performance Brief, and Instrument Instance, including an inventory and eligibility outcome for every release and an applicability outcome for every reachable profile plus conflicts, exclusions, unknowns, dependencies, Activation Decisions, and compiled consequences.
_Avoid_: Historical profile score, prompt context

**Owner Reference Library**:
The Owner's local collection of treatises, books, articles, scores, and notes from which cited Knowledge Candidates may be extracted.
_Avoid_: Training data, uploads

**Knowledge Candidate**:
A versioned cited node proposed for review but not yet admitted to a Knowledge Pack Release, classified independently by graph-node kind, authority lane, musical domain, epistemic form, evidence role, applicability, and review state.
_Avoid_: Learned fact

**Guided Knowledge Session**:
A user-directed collaboration in which a model analyzes selected evidence, proposes an inactive executable Knowledge Candidate, and auditions its consequences without granting it authority or activation.
_Avoid_: Automatic learning, chat as historical authority, prompt-only rule

**Realization Strategy**:
A typed, versioned, declarative operation that matches a Realization Context and proposes bounded Arrangement Plan changes, expected preservation effects, target requirements, and validation predicates without containing arbitrary executable code.
_Avoid_: Copied passage, prompt-only instruction, executable script in a Knowledge Pack

**Strategy Use Policy**:
The scoped authority granted to one Realization Strategy to remain research-only, generate candidate-only alternatives, compete as selection-eligible, or receive an explicit preference.
_Avoid_: Binary activation, historical prevalence, implicit ranking boost

**Strategy Refinement Candidate**:
A versioned proposed change to a Realization Strategy's scope, operation, composition, or preference derived from reviewed use while preserving the authority and identity of the strategy that inspired it.
_Avoid_: Mutating historical evidence, automatic learning from an edit

**Reference Work**:
The abstract authored work represented in the Owner Reference Library independently from any edition, exemplar, or scan.
_Avoid_: PDF title

**Reference Edition**:
A publication of a Reference Work with explicit date, language, editor, translator, and declared changes.
_Avoid_: Scan, repository record

**Reference Source Manifestation**:
A versioned edition, issue, volume, part, manuscript, or compilation object whose reviewed or disputed relationships may involve zero, one, or many Reference Works and other manifestations.
_Avoid_: Assuming every source object is one complete edition of one work

**Reference Exemplar**:
A physical copy or bound object associated with one or more Reference Source Manifestations and identified by holding institution, shelfmark, completeness, and exemplar-specific features.
_Avoid_: Manifestation, digital file

**Reference Digital Asset**:
Immutable uploaded or acquired bytes identified by content digest, media type, and length. Acquisition provenance, represented Exemplars, access, and rights are separate linked records.
_Avoid_: Reference Work, acquisition event, mutable rights field

**Asset Acquisition**:
An immutable record of how a Reference Digital Asset was obtained, from which provider object or local action, what it represents, and which rights and processing decisions apply.
_Avoid_: Byte identity, permission inferred from deduplication

**Source Segment Version**:
An immutable citable page or musical region bound to exact asset bytes, Page Atlas version, canvas, coordinate space, transforms, crop digest, printed and scan locators, modality, and extraction provenance.
_Avoid_: Mutable crop, page number without asset and Atlas identity

**Knowledge Reassessment**:
A versioned comparison that explains how a later source or Knowledge Pack Release corroborates, narrows, qualifies, contradicts, supersedes, or leaves existing knowledge and dependent arrangements unchanged without mutating them.
_Avoid_: Automatic learning, silent pack upgrade

**Target Voice Plan**:
A passage-level plan that maps source voices to explicit target roles, activity spans and rests, continuity, cadence, transformation, prominence, and omission obligations before physical realization.
_Avoid_: Preserve melody, pitch-class coverage

**Source Voice Graph**:
The immutable, evidence-bearing identity graph of source voices and occurrences, including event membership, activity and rest spans, notated or inferred identity, cross-staff movement, splits, merges, exchanges, and uncertainty before target planning.
_Avoid_: Part ID as voice identity, visible staff as a permanent voice

**Target Relationship Plan**:
A passage-level set of machine-readable obligations among Target Voices, such as ordered imitation, subject shape, suspension preparation and resolution, figure-to-bass constraint, cadence, voice exchange, or generated voice leading, each bound to a Validation Profile.
_Avoid_: Per-voice coverage as proof that counterpoint survived

**Target Harmonic Plan**:
A passage-level plan for tonal or modal context, harmonic rhythm, bass and inversion obligations, required sonorities and tendency tones, essential dissonances, cadences, and the exact reharmonization freedom permitted by the Preservation Policy.
_Avoid_: Chord labels as proof that harmony survived, alfabeto shape as harmonic intent

**Continuo Realization Plan**:
A passage-level plan linking every authoritative Continuo Foundation and figure event to generated voices, Realization and Validation Profiles, spacing and doubling policy, uncertainty, and an explicit complete, separate-bass, or reduction disposition.
_Avoid_: Chord implication as a sounded foundation bass

**Intended Technique Plan**:
A passage-level declaration of the target technique, transitions, constitutive hand resources, sounding and held state, notation and playback consequences, alternatives, and applicable evidence.
_Avoid_: Instrument-wide technique default

**Owner Ergonomic Profile**:
Reviewed personal evidence about the Owner's capabilities or limitations for an exact instrument and performance context, kept separate from instrument mechanics and universal playability claims.
_Avoid_: Instrument constraint, historical practice

**Musicological Analysis**:
A structured, evidence-bearing interpretation of a source's form, voices, Texture, Contrapuntal Techniques, harmony, phrases, cadences, and Preservation Targets.
_Avoid_: LLM summary, chord analysis

**Musicological Engine**:
The hybrid system that combines symbolic analysis, curated historical knowledge, model judgment, and constraint verification to produce Musicological Analysis and arrangements.
_Avoid_: LLM, theory helper

**Musicology Core**:
The curated, source-backed analytical vocabulary, retrieval features, typed musical operations, and validation concepts that ground corpus study and model collaboration without purporting to contain every historical or instrumental practice.
_Avoid_: Model training, universal style pack, opaque system prompt

**Analysis Summary**:
A concise plain-language account of the findings and arrangement consequences most relevant to the current request.
_Avoid_: Simplified analysis

**Analysis Record**:
The complete inspectable set of musical observations, inferences, evidence, confidence judgments, uncertainties, and arrangement rationale produced by Musicological Analysis.
_Avoid_: Chain of thought, debug trace

**Analysis Claim**:
A correctable musical assertion scoped to score locations and accompanied by evidence, confidence, and viable alternative interpretations.
_Avoid_: Model opinion

**Preservation Policy**:
The user-visible choice that determines which source material is invariant and which transformations the arranger may make.
_Avoid_: Preserve the melody, keep it recognizable

**Preservation Audit**:
A machine-readable mapping from every Preservation Target to its arrangement counterpart, allowed transformations, and any deviations.
_Avoid_: Fidelity summary, visual check

**Transformation Report**:
The policy-independent source-to-arrangement provenance map classifying retained, transposed, octave-relocated, revoiced, reharmonized, omitted, and newly generated events and relationships with their rationale.
_Avoid_: Preservation Audit, when no source-fidelity gate is being applied

**Provenance Overlay**:
An optional workbench visualization of the Transformation Report on linked source and arrangement notation, using accessible visual markers for retained, transformed, omitted, and generated material.
_Avoid_: Engraving style, permanent score annotation

**Policy Exception**:
A user-approved, versioned deviation from the transformations allowed by the active Preservation Policy.
_Avoid_: Warning dismissal

**Faithful Reduction**:
A preservation policy under which the Principal Voice is a hard constraint while subordinate material absorbs target-instrument compromises.
_Avoid_: Literal transcription

**Idiomatic Adaptation**:
A preservation policy that retains recognizable phrases, contour, and cadences while permitting local melodic or rhythmic changes for the target instrument.
_Avoid_: Loose reduction

**Free Paraphrase**:
A preservation policy that treats the source as thematic material without requiring note-level fidelity.
_Avoid_: Arrangement when the degree of freedom is unstated

**Score Transcription**:
A reviewable musical representation extracted from a source artifact together with its uncertainties and validation results.
_Avoid_: Source score when referring to unverified OMR output

**Diplomatic Tablature Transcription**:
A facsimile-anchored symbolic record, canonically serialized in Vellum's constrained MEI 5.1 profile, of visible historical tablature tokens, layout locations, and unresolved glyph alternatives before sounding-pitch, voice, duration, tuning, or musical interpretation is imposed.
_Avoid_: MusicXML conversion, interpreted score, modernized edition, co-authoritative JSON transcription

**Transcription Acceptance**:
The Owner's whole-page approval of one schema-valid, facsimile-linked Diplomatic Tablature Transcription version after deterministic checks pass and every Critical Uncertainty affecting visible source evidence is resolved.
_Avoid_: Per-token approval requirement, OCR confidence threshold, interpretation approval, implied source infallibility

**Tablature Interpretation**:
A versioned, evidence-bearing mapping from one Diplomatic Tablature Transcription through an instrument, tuning, notation convention, and rhythmic reading to sounding musical events, retaining viable alternatives where the source is ambiguous.
_Avoid_: Diplomatic transcription, silently assumed tuning

**Interpretation Acceptance**:
The Owner's approval of one Tablature Interpretation version for a stated purpose such as literal playback, analysis, or idiom study, without altering or re-attesting its Diplomatic Tablature Transcription.
_Avoid_: Transcription Acceptance, universal correctness, silent choice among viable readings

**Transcription Correction**:
A correction to Vellum's record of what is visibly present in a source region.
_Avoid_: Editorial emendation, interpretation change

**Correction Batch**:
A named, atomic set of typed Transcription Corrections staged against one exact Diplomatic Tablature Transcription parent version and committed together as one new canonical version.
_Avoid_: Autosave mutation, mixed interpretation or editorial changes, unversioned undo stack

**Interpretation Revision**:
A new reading of unchanged visible source tokens under a tuning, rhythmic, notational, or musical hypothesis.
_Avoid_: Transcription correction, silent reinterpretation

**Editorial Emendation**:
A disclosed editorial departure from a reviewed source reading adopted because the source is judged anomalous, erroneous, damaged, or impractical.
_Avoid_: Transcription correction, silent repair

**Retypeset Edition**:
A same-instrument engraved publication derived from a Score Transcription without passing through arrangement planning or target search.
_Avoid_: Arrangement Score, facsimile reproduction

**Diplomatic Edition**:
A Retypeset Edition that preserves the source's reviewed notation semantics and irregularities while permitting modern page layout.
_Avoid_: Pixel-faithful facsimile, silently corrected edition

**Reading Edition**:
A Retypeset Edition that regularizes presentation for legibility while preserving musical content and disclosing every editorial normalization.
_Avoid_: Diplomatic Edition, undocumented modernization

**Interactive Edition Surface**:
A Vellum-owned browser projection of an exact canonical score or transcription version, rendered through a pinned notation engine and connected to selection, Lineage Navigation, editorial state, and synchronized playback without becoming canonical musical state itself.
_Avoid_: Hosted notation-app embed, canonical MEI, static SVG preview

**OMR Run**:
A versioned, reproducible recognition attempt that links a PDF or image Source Artifact to a Score Transcription and retains the recognition backend, version, configuration, logs, page mappings, native project data, and interchange exports.
_Avoid_: Import result, MusicXML file

**Notation Recognition Profile**:
A scoped, versioned collection of reviewed glyph examples, correction-derived priors, notation vocabulary, and recognition settings for a notation system, source family, typeface, manuscript hand, or image condition.
_Avoid_: Knowledge Pack, historical claim, universal OCR rule

**Normalized Score**:
A source-format-neutral temporal and voice graph derived from a specific Score Transcription version for analysis and planning.
_Avoid_: Source, arrangement

**Arrangement Score**:
A versioned musical result derived from exact source, transcription, normalization, analysis, and planning versions.
_Avoid_: LilyPond file, rendered score

**Target Configuration**:
The exact set of instruments, ensemble roles, tunings, stringing choices, and relevant capabilities for which an Arrangement Score is generated and validated.
_Avoid_: Output format, instrument name without its configuration

**Instrument Instance**:
An immutable exact physical and notational configuration of one target instrument, including construction, strings or courses, tuning, geometry, setup, and notation identities.
_Avoid_: Instrument name, generic profile

**Instrument Calibration**:
A versioned measurement or reviewed estimate of one exact Instrument Instance's physical values, units, geometry, setup, uncertainty, and measurement method. Evaluators compose it with separate performer, tempo, preparation, and reliability context at invocation.
_Avoid_: Generic difficulty, fret span alone, one performer's result as universal playability

**Arrangement Family**:
Sibling Arrangement Scores that share an Arrangement Brief and source-analysis lineage but realize different Target Configurations.
_Avoid_: Multiple layouts of one Arrangement Score

**Arrangement Branch**:
A divergent version lineage inside an Arrangement Workspace, rooted at exact prior musical-state versions so an earlier intention can continue without overwriting the current lineage.
_Avoid_: Git branch, copied workspace

**Family Commitment**:
An explicitly promoted, target-portable musical constraint that applies across selected Arrangement Scores in an Arrangement Family.
_Avoid_: Personal Default, source correction, instrument-specific fingering

**Arrangement Candidate**:
A complete or sectional proposed realization of an Arrangement Plan with recorded derivation choices, Search Measurements, and Selection Policy identity. Independent evaluation produces a separate Card keyed to the immutable candidate.
_Avoid_: Draft, option

**Search Measurement**:
A generator-visible fact or estimate used by an exact Selection Policy to reject, compare, or retain Arrangement Candidates without claiming independent quality certification.
_Avoid_: Evaluation score, historical or physical proof

**Selection Policy**:
The versioned hard-gate, lexicographic-priority, target-preference, and non-dominated-alternative policy used by Arrangement Search before independent evaluation.
_Avoid_: Hidden weighted total, held-out evaluator

**Adoption Decision**:
An immutable decision that adopts or blocks a preordered Arrangement Candidate after independent required evaluation without rewriting the search order; a failed candidate yields to the next already ordered survivor or a new search.
_Avoid_: Evaluation changing the Selection Decision, held-out candidate selection

**Evaluation Card**:
Immutable independent evidence about one exact generated candidate or Arrangement Score, exposing required hard gates, separate dimensions, unknowns, authority, and observations without mutating or selecting the music.
_Avoid_: Candidate score, overall grade

**Generation System**:
The exact transitive consumer closure capable of generating or fitting an arrangement: source analysis, plans, prompts, activated packs and examples, model and provider configuration, compiler and search code, fitted parameters, Selection Policy, runtime, and dependencies.
_Avoid_: Compiler name alone, current deployment

**Capability Qualification**:
Immutable evidence that one sealed Generation System passed held-out suites for one explicit claim scope naming covered source modalities, textures, techniques, target configurations, notation and playback dimensions, workload envelope, provider conditions, exclusions, and unknowns.
_Avoid_: Exact arrangement approval, claim of absence from model pretraining

**Artifact Readiness**:
The claim-scoped state of one exact Arrangement Score and its Deliverables after required notation, playback, mechanics, relationships, and role-scoped human evidence pass under a compatible current Capability Qualification.
_Avoid_: Pipeline completed, capability suite alone

**Contamination Group**:
The complete Generation-System- or evaluator-consumer-scoped evidence lineage that could reveal substantially the same expected answer, including editions, scans, excerpts, transcriptions, translations, analyses, arrangements, examples, candidates, derived claims, prompts, fitted parameters, and Selection Policies.
_Avoid_: Dataset role on one file

**Owner Evaluation Vault**:
The local evaluator-only store outside Git that holds source assets held out from Vellum development and fitting, reviewed truth, expectations, mutations, precommitted reserve groups, provider and session exposure history, and split manifests; generation can receive a source envelope but cannot inspect its answers or reserves.
_Avoid_: Repository fixture directory, prompt context

**Vault Split Manifest**:
The immutable pre-output commitment to one Generation System scope, eligible Contamination Groups, coverage assignments, invalid-fixture policy, deterministic reserve order or seed, exhaustion policy, exposure snapshots, and curator identity.
_Avoid_: Choosing the next passing fixture after seeing output

**Golden Arrangement Fixture**:
A legally redistributable, provenance-bearing source artifact plus reviewed transcription and expected musical invariants used to test the complete Vellum workflow across selected Target Configurations.
_Avoid_: Demo, compile fixture

**Golden Engraving Fixture**:
A minimal notation case with exact semantic, rendered-glyph, placement, and sounding-pitch expectations for a historically significant engraving feature.
_Avoid_: Compile smoke test

**Provider Contract Fixture**:
A deterministic fake provider and opt-in real-provider smoke protocol used to verify the complete Provider Connection lifecycle without making personal credentials a CI dependency.
_Avoid_: Unit test of token parsing alone

**Arrangement Search**:
The generate, reject, rank, compare, and select process that produces an Arrangement Score from competing Arrangement Candidates.
_Avoid_: Model response, retry loop

**Source Artifact**:
An uploaded or linked document that supplies musical notation, text, metadata, or other source material for an arrangement.
_Avoid_: Document when its role in the arrangement matters

**Arrangement Brief**:
A structured summary of Source Artifacts, target instruments, desired outputs, and explicit arrangement choices.
_Avoid_: Prompt text

**Performance Brief**:
A versioned statement of intended use, performer capability, tempo, difficulty, preparation, reliability, allowed technique, notation need, and ensemble role that makes target evaluation meaningful.
_Avoid_: Difficulty label without context

**Arrangement Plan**:
A versioned musical design linking exact source truth and Analysis to sectional Texture, target voices, material disposition, technique intention, transformations, alternatives, and expected compromises before target-specific search.
_Avoid_: Fingering result, prompt

**Guided Start**:
An optional, dismissible launcher that helps a user assemble an initial Arrangement Brief and begin a suitable Vellum workflow.
_Avoid_: Required setup, wizard

**Notation Layout**:
The musical presentation of an output score, such as French tablature, voice with tablature, Classical Guitar Staff, or Learning Layout.
_Avoid_: Output format

**Deliverable**:
The file or interactive artifact produced from a Notation Layout, such as browser preview, PDF, MIDI, LilyPond source, or MusicXML.
_Avoid_: Output format

**Audio Preview**:
An interactive synthesized playback projection of an Arrangement Score or Arrangement Candidate, intended for musical checking rather than as a historically convincing performance.
_Avoid_: Recording, performance rendering

**Playback Part**:
A named semantic stream of sounding events in an Audio Preview, derived from a musical role such as Principal Voice, Continuo Foundation, or accompaniment rather than from the number of engraved staves.
_Avoid_: MIDI track or staff when either could duplicate the same musical events

**Playback Occurrence**:
One sounding occurrence of a canonical musical event on the performed timeline, including repeat and ending iteration context.
_Avoid_: Note event, when the same written event sounds more than once

**Performed Form**:
The ordered sounding traversal derived from written repeats, volta endings, da capo or dal segno instructions, segnos, codas, and related navigation signs.
_Avoid_: Measure order, which does not describe repeated or jumped playback

**Practice State**:
Temporary playback-only controls such as a loop range and speed multiplier that help inspect or rehearse music without changing musical state.
_Avoid_: Performance Interpretation, tempo edit

**Lineage Navigation**:
Bidirectional selection and highlighting across linked Source Artifact regions, Score Transcription objects, Arrangement Score events, Playback Occurrences, Analysis Claims, and Preservation Audit findings.
_Avoid_: Playback cursor, when navigation crosses multiple musical layers

**Passage Selection**:
A version-bound contiguous musical-time range, explicit noncontiguous set of canonical musical object identifiers, or combination of both, with optional facsimile regions, chosen for prompting, playback, review, editing, analysis, or idiom study independently of rendered page coordinates.
_Avoid_: SVG rectangle, browser text selection, unversioned note list

**Selection Context Envelope**:
A deterministic, inspectable expansion of one Passage Selection with the minimum versioned musical context required for a stated action, such as meter, tuning, measure boundaries, active voices, nearby cadence context, and linked evidence.
_Avoid_: Whole-score prompt by default, model-selected hidden context, Egress Envelope

**Performance Interpretation**:
An optional, versioned layer of sounding choices—such as ornament realization, arpeggiation, inequality, articulation, tempo shaping, and rubato—applied to an exact Arrangement Score without changing its notation.
_Avoid_: Arrangement Score, when the change exists only in playback

**Stale Derivation**:
A preserved downstream version whose recorded inputs are no longer the current upstream versions and which must not be presented as current without regeneration or explicit acknowledgement.
_Avoid_: Invalid, when the prior result remains inspectable and usable

**Editorial Commitment**:
A user-authored or explicitly approved arrangement choice that Conservative Regeneration must preserve unless it conflicts with corrected source material or a hard constraint.
_Avoid_: Preference, when the choice is local to a particular Arrangement Score

**Commitment Scope**:
The score-anchored musical region and semantic dimension protected by an Editorial Commitment, such as Principal Voice pitch, rhythm, harmony, bass, Texture, ornament, or course and fingering assignment.
_Avoid_: Lock, without stating what musical property and region are protected

**Commitment Conflict**:
A hard, score-anchored conflict in which an Editorial Commitment cannot coexist with corrected source evidence, a Preservation Target, or another hard arrangement constraint.
_Avoid_: Warning, because completion requires an explicit resolution

**Policy Drift**:
A hard finding that one or more Policy Exceptions, considered by musical consequence rather than count alone, materially compromise a Preservation Target or the recognizable identity promised by the current Preservation Policy.
_Avoid_: Too many exceptions, because one critical exception may matter more than many local ones

**Transposition Plan**:
An explicit mapping from a source key and sounding-pitch context to a target key, interval, and affected parts, with its playability rationale and any fixed-pitch, range, scordatura, or edition constraints.
_Avoid_: Change key, without preserving and auditing the exact intervallic mapping

**Conservative Regeneration**:
Regeneration that branches from a stale Arrangement Score, carries forward its Editorial Commitments, and limits changes to the musical dependency region affected by corrected upstream state.
_Avoid_: Fresh arrangement, patching the stale version in place

**Critical Uncertainty**:
A transcription uncertainty that could change the Principal Voice, musical form, figured bass, or another preservation target.
_Avoid_: Low confidence without stating its musical consequence

**Score-Anchored Review**:
A correction interaction that presents the relevant Source Artifact region beside its recognized notation, uncertainty evidence, and editable or suggested alternatives.
_Avoid_: Asking the user to describe a visible notation error only in chat

**French Tablature**:
Letter-based lute notation with rhythm signs above the main staff and open bass courses represented by signs below it.
_Avoid_: Lute tab when the notation system matters

**Diapason**:
An open bass course outside the lute's six stopped courses.
_Avoid_: Bass string when course function matters

**Diapason Sign**:
The below-staff sign that identifies which Diapason sounds independently from its pitch. The source-backed twelve-course sequence is `a`, `/a`, `//a`, `///a`, `4`, `5` for courses 7–12; any course-13 sign requires an explicit historical, editorial, or software Notation Configuration.
_Avoid_: Fret letter, because a Diapason is not stopped at a fret

**13-Course Baroque Lute**:
Vellum's initial thirteen-course target profile, normally instantiated in D-minor tuning with six stopped courses and seven open Diapasons; the editor default is not represented as one universal historical standard.
_Avoid_: Baroque lute when the number of courses affects the arrangement

**Bass Tuning**:
The per-piece assignment of pitches to a lute's Diapasons without changing their course identities or signs.
_Avoid_: Instrument tuning when only the open bass courses change

**Native Tablature Layout**:
The target instrument's historically appropriate tablature presented without a duplicate standard-notation staff.
_Avoid_: Solo tab when the distinction from a learning layout matters

**Learning Layout**:
Synchronized standard notation and native tablature for the same instrumental part.
_Avoid_: Tab and staff without stating that both represent the same music

**Classical Guitar Staff**:
Standard guitar notation on a transposing treble staff that sounds one octave below its written pitch.
_Avoid_: Standard notation when the instrument-specific clef and sounding octave matter

**French-Letter Tablature**:
A notation system that represents stopped frets with letters, independently of how the instrument is strung or played.
_Avoid_: French when stringing or musical style could be meant

**French Stringing**:
A baroque-guitar course configuration favoring re-entrant sonority and campanella without the Italian fifth-course bourdon.
_Avoid_: French tab

## Relationships

- A source may contain zero, one, or more candidates for **Principal Voice**
- A **Principal Voice** is one possible **Preservation Target**, not a universal requirement
- The **Musicological Engine** produces **Musicological Analysis** before an arrangement plan is made
- Symbolic facts, historical practices, interpretive judgments, and validation results remain distinguishable within the **Musicological Engine**
- The **Musicology Core** supplies stable concepts and operations to a generic model, while repertoire evidence and reviewed Knowledge Packs supply specialist practice the model may not know from training
- Feature-based corpus discovery may surface recurring structures before their historical terminology or interpretation is known
- The **Musicology Core** contains analytical definitions, feature vocabularies, typed operations, and validation primitives; historically contingent applicability, prevalence, preference, and prohibition remain reviewed Knowledge Pack content
- The **Musicology Core** is deliberately small and demand-driven: concepts and operations are added only when an actual analysis, strategy, or evaluation needs them, while the model remains the primary interpretive collaborator
- Modern analytical labels may provide a working vocabulary while historical terms, translations, and claimed equivalences remain separately cited and may be disputed
- Curated historical knowledge consists of cited **Historical Practice Claims**, not unsourced universal rules
- Conflicting **Historical Practice Claims** remain distinct alternatives with their own scope and authority
- Target-only repertoire yields cited observations within a **Realization Context**, never a reconstructed source; any claim about transformation from an earlier source requires independent source evidence
- One **Attested Realization** may support an optional generated alternative after Owner review, but cannot alone establish a default preference
- An **Attested Realization** distinguishes directly notated observation, interpretation-dependent analytical inference, performance-practice hypothesis, and reviewed playtest evidence; one form cannot silently assume the authority of another
- A **Recurring Idiom** preserves the supporting observations, their independence assessment, counterevidence, applicability boundaries, and uncertainty
- Recurrence strength is assessed through **Idiom Evidence Lineages** and scope diversity rather than raw passage, file, or occurrence counts
- Repetition within one work, across works by one composer, and across independent composers or transmission lineages support progressively different possible scopes rather than one undifferentiated confidence total
- Method statements and repertoire observations remain distinct evidence kinds even when they corroborate one another
- **Musical Idiom** and **Instrumental Idiom** are distinct but may be linked; observing a musical practice in instrumental repertoire does not by itself make that practice instrument-specific
- Idiom applicability may independently constrain composer or circle, period, region, genre or dance, formal location, Texture, Realization Context, instrument configuration, technique, and Preservation Policy
- An applicable idiom may propose a candidate outside the active **Preservation Policy**, but that candidate remains visibly ineligible for adoption until the Owner changes policy or approves a score-anchored **Policy Exception**
- An idiom's declared preservation effects guide proposal and explanation; the resulting **Transformation Report** and **Preservation Audit** determine what actually changed
- Idiom evaluation separates corpus recognition from generative usefulness: recognizing an attested practice does not prove that a new arrangement applies it well, and useful generation does not manufacture historical evidence
- Held-out evaluation tests positive contexts, near misses, counterexamples, non-applicable targets, preservation effects, mechanics, and musical dimensions rather than relying on whole-score similarity
- Claims that a treatment is typical, preferred, obligatory, or prohibited require stronger evidence than one **Attested Realization**
- A descriptive observation or frequency count cannot change generation until a separate reviewed derivation authorizes an explicit compiler consequence
- A **Guided Knowledge Session** may draft and audition executable consequences, but neither model output nor a successful preview activates the resulting **Knowledge Candidate**
- Owner review of passage analysis, optional-strategy use, and default preference are distinct decisions and may occur separately
- Corpus-wide provisional analysis may suggest research leads, but an **Attested Realization** requires purpose-scoped review of the exact cited passage and every musical dimension material to the observation
- Uncertainty elsewhere in a source does not block a passage-scoped observation; later correction of relied-upon evidence invalidates dependent candidates and triggers **Knowledge Reassessment**
- Imported repertoire may be indexed locally and provisionally without creating or activating Knowledge Candidates; interpretive comparison and promotion begin through a user-initiated **Guided Knowledge Session**
- Vellum may later suggest reassessment when new evidence materially corroborates, contradicts, or narrows reviewed knowledge, but speculative background discovery does not interrupt ordinary arranging
- The repertoire corpus is a derived searchable index over scores and segments in the **Owner Reference Library**, not a parallel source library or independent authority store
- Idiom discovery retrieves actual indexed passages through deterministic musical and bibliographic facets before model interpretation; every claimed example resolves to a citable corpus passage
- A model may refine retrieval queries and interpret returned passages, but model memory or an unsupported similarity assertion cannot become corpus evidence
- A remote **Guided Knowledge Session** receives reviewed symbolic excerpts by default; facsimile crops require an explicit purpose-scoped selection or Access Decision, and whole books or folders are never silently transmitted
- Compact or derived symbolic source content remains subject to source rights and privacy decisions rather than becoming unrestricted merely because it is cheaper to transmit
- Passage selection from facsimile-linked or symbolic notation is the primary entry point to a **Guided Knowledge Session**; topic-first research must retrieve and expose concrete corpus evidence before proposing reusable knowledge
- Historical-tablature import defaults to transcription, uncertainty review, retypesetting, and literal playback; idiom study and Knowledge Candidate creation are optional follow-on actions
- The first MEI-native historical-tablature proof uses page 9 of de Visée's 1686 _Pièces pour la guittare_: facsimile import, Diplomatic Tablature Transcription, uncertainty correction, Verovio rendering, selection, and synchronized literal playback form one reviewable vertical
- No passage from that proof may support idiom extraction or a Knowledge Candidate until the exact Diplomatic Tablature Transcription version and its applicable Tablature Interpretation have passed their transcription acceptance gate; later corrections invalidate dependent observations rather than being absorbed silently
- **Transcription Acceptance** requires valid constrained MEI, a facsimile region for every diplomatic token, passing deterministic structural and consistency checks, no unresolved Critical Uncertainty in visible source evidence, and one complete-page Owner review of the rendered transcription beside its facsimile
- High-confidence tokens do not require individual confirmation; recognition confidence prioritizes review, while whole-page Transcription Acceptance remains the explicit authorization boundary
- **Transcription Acceptance** and **Interpretation Acceptance** are separate version-bound decisions even when one review session presents them together; approval that visible tokens match the facsimile does not approve tuning, rhythm, sounding events, or analytical use
- An **Interpretation Acceptance** names its exact Diplomatic Tablature Transcription and Tablature Interpretation versions plus its authorized purposes; an Interpretation Revision requires a new acceptance rather than inheriting the prior decision
- An unaccepted **Tablature Interpretation** may produce clearly labeled provisional playback for audition and correction, but it cannot authorize analysis, Attested Realizations, idiom evidence, Knowledge Candidates, or publication as an accepted Reading Edition
- Provisional playback records the exact interpretation version and never converts repeated audition, absence of correction, or playback plausibility into implicit **Interpretation Acceptance**
- **Interpretation Acceptance** is non-exclusive: accepting one viable reading for a purpose preserves other readings and their evidence for comparison unless the Owner explicitly rejects or withdraws them
- Explicit interpretation rejection records the rejected version, reason, evidence, and scope without deleting it or implying that every other interpretation is accepted
- An executable idiom uses a **Realization Strategy** interpreted by Vellum; it branches or specializes the existing **Arrangement Plan** rather than bypassing planning or directly emitting an Arrangement Score
- Target compilers remain responsible for exact pitches, courses, fingers, held state, notation, and mechanics produced from a **Realization Strategy**
- A **Strategy Use Policy** distinguishes research-only, candidate-only, selection-eligible, and preferred authority; permission to audition never implies permission to select automatically
- A single reviewed **Attested Realization** may justify candidate-only use, while broader selection or preference authority requires scope-appropriate evidence and validation
- A **Personal Default** may prefer a historically rare strategy for the Owner without converting personal taste into a claim of historical prevalence
- Owner edits and playtests may produce attributed **Strategy Refinement Candidates**, but never mutate the source-backed strategy or establish historical authority without independent evidence
- Rejection of one generated realization may identify an applicability, implementation, ergonomic, or contextual failure without refuting the underlying idiom
- A **Musical Idiom** is independently available to sibling target arrangements by default; it becomes mandatory across an **Arrangement Family** only through an explicit **Family Commitment**
- **Instrumental Idioms** enter target specialization, and any resulting divergence among sibling arrangements remains explained and inspectable
- A **Diplomatic Tablature Transcription** precedes interpreted normalization for historical tablature and preserves notation-specific evidence that a pitch-only or MusicXML representation may lose
- Every diplomatic token remains linked to its facsimile region; consistency checks may flag suspected errors but cannot silently alter visible source evidence
- Typed editor commands mutate validated canonical MEI into a new transcription version; browser, spatial, interpretation, analysis, playback, and engraving projections are rebuildable views pinned to that MEI version
- Vellum pins and validates one constrained MEI version and deterministic serialization; MEI does not replace the separate domain records for analysis, planning, knowledge, arranging, or playtest evidence
- Pinned Verovio is the primary renderer and interactive-notation foundation for MEI-native **Diplomatic Editions** and **Reading Editions**; its SVG, pagination, element lookup, and timing products are rebuildable projections rather than canonical musical state
- Vellum owns the **Interactive Edition Surface** and adapts proven Verovio App navigation and playback-synchronization patterns; it does not embed or remotely import the hosted Verovio App, inherit its storage or UI state, or load its runtime dependencies from public CDNs
- The **Interactive Edition Surface** renders through a locally bundled, pinned Verovio WASM runtime in a Web Worker so layout, reflow, zoom, element lookup, and timing work do not block the browser interface
- The Verovio Web Worker is projection-only and never owns canonical MEI; it may render an explicitly labeled optimistic edit preview, but its transient state cannot be accepted, exported, analyzed, or used as evidence
- Every transcription edit crosses a typed server command boundary, is validated against the expected parent version, and atomically produces a new canonical Diplomatic Tablature Transcription version or no change
- The editor may stage and optimistically preview multiple typed Transcription Corrections as one **Correction Batch**; committing validates the complete batch against its expected parent and creates exactly one named transcription version, while cancel discards all staged state
- A **Correction Batch** contains transcription-evidence changes only and cannot mix Interpretation Revisions or Editorial Emendations; those actions create independently reviewable versions in their own layers
- Undoing a committed **Correction Batch** creates a new inverse batch and canonical version rather than deleting or mutating accepted history
- If the expected parent is no longer current, batch commit fails without partial application and offers rebase-by-review against the new canonical version rather than silently replaying commands
- Acceptance, interpretation, analysis, idiom study, and Deliverables may reference only the server-acknowledged canonical version; a stale or rejected optimistic preview is discarded and rerendered from canonical MEI
- Reproducible PDF and other publication exports use the same pinned Verovio version and versioned rendering profile on the local server; SVG-to-publication conversion remains a Deliverable projection rather than browser state
- Browser and server rendering paths share representative parity fixtures and may not silently diverge in selected editorial reading, element identity, pagination policy, tablature semantics, or engraving profile
- Canonical MEI identifiers survive into the rendered surface through an explicit versioned mapping so selection, facsimile linkage, editor commands, uncertainty review, and **Lineage Navigation** address musical objects rather than page coordinates
- A **Passage Selection** binds exact canonical MEI object identifiers, transcription or score version, selection purpose, and any linked facsimile regions; zoom, reflow, pagination, and rerendering do not change its identity
- A Passage Selection may describe a contiguous time interval, explicitly selected noncontiguous objects, or both; it can therefore isolate a voice, bass line, suspension chain, chord members, ornaments, or other musical relationship across intervening unselected material
- Visual drag, shift-click, voice or role filters, facsimile gestures, and playback-range gestures are interchangeable selection inputs only after they resolve to the same canonical Passage Selection representation
- When a new canonical version supersedes selected elements, Vellum remaps a Passage Selection only through explicit unambiguous lineage; ambiguous, partial, or deleted lineage marks it stale and requests targeted review rather than guessing from geometry or pitch
- Prompting, playback loops, Correction Batches, analysis, and Guided Knowledge Sessions record the exact Passage Selection version they consumed so later selection remapping cannot rewrite prior actions
- A model action over a Passage Selection receives a purpose-specific **Selection Context Envelope** constructed by deterministic versioned rules before prompt assembly; the model cannot silently retrieve or infer additional workspace context
- The Owner can inspect the exact selected objects, automatically included context, linked evidence, and proposed remote payload before dispatch, and may explicitly expand or narrow that envelope
- Default context expansion remains local and symbolic; facsimile crops or other source bytes still require their applicable purpose-scoped Access Decision and inclusion is never implied by selecting linked notation
- The resulting Egress Envelope pins the exact Passage Selection and Selection Context Envelope versions actually authorized for transmission
- A model may return typed proposed Transcription Corrections, Interpretation Revisions, or Editorial Emendations, but it cannot write canonical MEI, accept an interpretation, or publish an edition directly
- Model-proposed changes are staged in their proper layer against exact parent versions, rendered as optimistic previews with rationale and affected evidence visible, and require explicit Owner commit through the same validated command boundary as manual changes
- The Owner may accept, reject, or revise individual proposed changes before commit; only the surviving approved changes form the final typed batch, which still validates and commits atomically as one new version
- Per-change review never partially mutates canonical state, and changing one proposal rerenders the complete staged result so interactions among surviving changes remain visible before commit
- A committed model-assisted version retains compact provenance linking its exact Model Action Result Commit, original typed proposal, per-change Owner decisions, final approved batch, and resulting canonical version
- Rejected suggestions and model rationale remain inspectable proposal history but never enter canonical MEI or masquerade as source, interpretation, or editorial content
- One model proposal cannot mix transcription evidence, interpretation, and editorial emendation into an opaque edit; cross-layer advice is split into independently reviewable proposed actions with disclosed dependencies
- Verovio-generated SVG passes through a dedicated constrained security profile that permits only the local fragment references and interaction metadata required by pinned output; direct unsanitized `innerHTML` mounting is forbidden
- Vellum remains authoritative for **Tablature Interpretation**, tuning, performed-form decisions, semantic **Playback Parts**, and playback timing; Verovio MIDI and timemaps are rendering and synchronization aids, not independent source truth
- LilyPond remains available for Arrangement Score deliverables and as a provisional fallback or comparison renderer; a workflow may remove that dependency only after representative real-source and target-specific visual, interaction, and playback fixtures establish Verovio parity
- One **Diplomatic Tablature Transcription** may have multiple **Tablature Interpretations**; playback, musical analysis, idiom extraction, and interpretation-dependent editions name the exact version they use
- Correcting a **Tablature Interpretation** does not rewrite the visible-token evidence in its **Diplomatic Tablature Transcription**
- **Transcription Correction**, **Interpretation Revision**, and **Editorial Emendation** are distinct versioned actions; mechanical implausibility may motivate review but cannot choose among them automatically
- A **Diplomatic Edition** follows the reviewed visible source, while a **Reading Edition** may apply disclosed Editorial Emendations
- Interpretation uncertainty is assessed per musical dimension; it blocks only observations whose required evidence differs across viable **Tablature Interpretations**
- An observation invariant across every viable interpretation may proceed with that fact recorded, while interpretation-dependent observations remain conditional or incomplete
- Reviewed transcription corrections may improve a scoped **Notation Recognition Profile**, but they do not become idiom knowledge or silently rewrite existing transcriptions
- Reapplying a **Notation Recognition Profile** creates a new recognition or transcription version, and use beyond its demonstrated notation or source scope remains reviewable
- The initial historical-tablature recognizer is source-adaptive: it detects page and staff geometry, extracts and clusters uninterpreted glyph images, and applies a scoped **Notation Recognition Profile** of reviewed examples, vocabulary, and spatial rules; optional multimodal-model suggestions may assist cluster labeling, structural hypotheses, or exceptional-region diagnosis but cannot establish source truth
- Historical-tablature review assumes expert verification of every proposed chord or event and optimizes that pass around a keyboard-driven event editor, cluster-level propagation, and recoverable local drafts rather than per-token forms; the completed first pass publishes MEI version 1 through one named, digest-bound initial review batch tied to its immutable recognition run, while every later manual edit uses an ordinary **Correction Batch** and creates a successor version
- Visible rhythm and gesture marks belong to the **Diplomatic Tablature Transcription** as glyph evidence; duration, simultaneity, strumming action, and sounding result belong to a **Tablature Interpretation**
- Recognition confidence thresholds control provisional transcription and review-queue workload only; they do not establish source-truth authorization, evidentiary readiness, or Knowledge Candidate approval
- Claim-critical glyphs or dimensions may require review despite exceeding an ordinary auto-accept threshold
- A **Retypeset Edition** reuses Vellum's engraving and Deliverable pipeline but does not require an Arrangement Plan, Preservation Policy, or Arrangement Search
- A **Diplomatic Edition** preserves reviewed notation semantics rather than original pixels or exact page geometry; the facsimile remains the authority for historical typography
- A **Reading Edition** records its editorial normalizations separately from transcription corrections
- A **Guided Knowledge Session** may compose only supported typed musical operations; introducing a genuinely new kind of operation requires an explicit implementation and validation change
- New idiom definitions that use existing operations are reviewed knowledge data, not arranger code changes
- A selection-eligible **Realization Strategy** matches typed, versioned Realization Context facts deterministically; live model-only applicability remains research-only or candidate-only and is disclosed in the candidate derivation
- Multiple **Realization Strategies** compose automatically only when their compatibility is explicit or their affected musical dimensions do not conflict
- Incompatible applicable strategies produce distinct inspectable **Arrangement Candidates** rather than an implicit winner; Owner input is deferred unless surviving alternatives materially change musical identity or no eligible candidate remains
- A **Knowledge Pack Release** has one authority lane and one or more musical domains; subject matter never substitutes for authority
- Authoritative entries, profiles, and derivations match their Release authority lane; cross-lane references are typed evidence or conflict context and cannot launder authority
- Knowledge Pack content changes create a new immutable Release, review creates a scoped **Release Attestation**, and retraction or revocation creates a **Release Advisory**
- A **Release Attestation** or **Release Advisory** confers no authority by self-assertion; external **Attestation Verification** or **Advisory Verification** plus a scope-matched **Activation Decision** govern use
- A test-only attestation authorizes isolated evaluation or explicit provisional research only; it cannot support default activation, readiness, or historical presentation
- A maintainer-reviewed-system attestation may authorize an explicitly nonhistorical software or editorial default but cannot authorize historical, pedagogical, ergonomic, performer, or specialist claims
- An **Applied Knowledge Manifest** is invalid unless its pinned **Knowledge Library Inventory Snapshot** enumerates every reachable Release, its Catalog records an eligibility outcome for each, and the Manifest records an outcome for every eligible Release and reachable profile
- A descriptive observation cannot become a compiler prohibition or preference without a separately reviewed derivation and centrally governed Resolution Policy
- The **Analysis Record** distinguishes documented practice, modern editorial convention, and Vellum heuristics
- Every counterpoint and voice-leading evaluation uses an explicit **Validation Profile** selected from the passage's Texture, Contrapuntal Techniques, historical scope, and task
- A **Validation Finding** identifies the **Validation Profile** and Historical Practice Claims that made it applicable
- The same musical feature may be a hard failure, soft preference, or descriptive observation under different **Validation Profiles**
- Every arrangement belongs to an **Arrangement Workspace** that persists independently of a browser session or chat
- A Vellum installation has exactly one **Owner** for the foreseeable product scope
- The **Local-First Runtime** is Vellum's primary deployment and trust boundary
- Private remote access may expose a **Local-First Runtime** without moving ownership or provider credentials to a hosted service
- **Provider Authorization** is independent of the **Owner** and does not determine ownership of stored musical data
- Vellum owns its **Provider Connection** and never treats another application's credential file as an integration contract
- A **Provider Connection** authenticates calls but does not authorize data egress; every remote **Model Action** uses a server-minted **Egress Envelope** over exact permitted inputs, destination, purpose, and tool capabilities
- The primary **Provider Connection** uses local ChatGPT OAuth through Pi's public provider API; API keys remain a fallback
- A **Provider Connection** exposes connected, refreshing, expired, and disconnected states plus explicit reconnect and logout actions
- Provider availability gates only **Model Actions**; source import, Score-Anchored Review, direct editing, deterministic analysis, validation, engraving, workspace access, and Audio Preview remain locally available while disconnected
- Owner-private reference content cannot enter a Model Action or any remote processor without an operation-, destination-, and purpose-scoped Access Decision
- A Model Action records its exact workspace inputs and last confirmed version boundary before provider work begins
- Provider failure or logout never commits incomplete model output to a Score Transcription, Analysis Record, Arrangement Candidate, Arrangement Score, or any canonical Reviewed Knowledge Library release, attestation, verification, advisory, Activation Decision, or authority-lane record; partial output may remain only in clearly noncanonical draft or diagnostic state
- An interrupted Model Action remains inspectable, cancellable, and safely retryable after reconnection without duplicating already committed canonical state
- Reconnection never automatically resumes an interrupted creative Model Action or sends a new provider request
- The workspace surfaces an interrupted action with explicit **Retry** and **Cancel** controls plus its original inputs, completed local tool results, partial progress summary, interruption reason, and last confirmed boundary
- Partial model text may be retained as diagnostic history but cannot become canonical musical state until an explicit retry completes and passes validation
- Retry uses the interrupted action's durable identity and idempotency boundary so already committed results are not duplicated
- Before retry, Vellum compares the Model Action's recorded input versions with current workspace versions
- If inputs changed, **Retry on current version** is the default and creates a revalidated attempt against current state while retaining the original intent and an input-difference summary
- **Retry original snapshot as a branch** creates an **Arrangement Branch** rooted at the action's exact prior inputs and continues there without overwriting or reverting the current lineage
- A retry choice and every resulting attempt remain linked to the interrupted Model Action for provenance
- Provider errors never delete, lock, or invalidate locally stored musical work
- The **Provider Contract Fixture** has an automated fake-provider layer covering connect initiation, callback validation, state mismatch, refresh, expiry, single-flight concurrency, interrupted Model Actions, retry, reconnect, logout, atomic credential writes, and secret redaction
- Automated Provider Connection tests run without a real ChatGPT account, never read Pi or Codex credential files, and assert that tokens cannot appear in logs, errors, snapshots, or exported workspace state
- An opt-in real ChatGPT subscription smoke test verifies the current OAuth flow, connected status, one minimal model request, local disconnect, and reconnect behavior
- The real-provider smoke test is never required in CI, never records credentials or callback parameters, and reports only redacted lifecycle results
- Failure of the real smoke test identifies provider-contract drift separately from failures in Vellum's deterministic connection state machine
- User corrections persist automatically within their **Arrangement Workspace**
- **Personal Defaults** remain separate from source analysis and historical claims
- Vellum may create a **Personal Default Candidate** when an equivalent user choice recurs across distinct Arrangement Workspaces
- A Personal Default Candidate shows the repeated choices that motivated it and proposes an explicit scope such as target instrument, tuning, Notation Layout, task, or repertoire context
- A Personal Default Candidate never changes behavior until the Owner explicitly approves it
- Approved Personal Defaults are visible, editable, releasable, and removable; rejecting a candidate suppresses repeated prompting for the same inferred preference unless new evidence materially changes its scope
- Applying a Personal Default is disclosed in the Arrangement Brief and remains a soft preference rather than source evidence, historical authority, an Editorial Commitment, or a hard constraint
- A Personal Default automatically yields to source evidence, applicable Historical Practice Claims, Preservation Targets, Editorial or Family Commitments, and hard instrument or validation constraints
- An unapplied Personal Default remains available for other contexts and is shown with the exact score-anchored or profile-backed reason it did not apply
- A Personal Default conflict does not block arrangement unless the Owner explicitly makes that choice an Editorial or Family Commitment in the current Arrangement Family
- Overriding an applicable historical or preservation constraint requires changing the relevant profile, policy, or commitment explicitly; editing the Personal Default alone cannot do so
- Personal Defaults never auto-promote into the Historical Knowledge Base and remain in the local Owner trust boundary
- Reusable project findings enter the **Historical Knowledge Base** only through an explicitly reviewed **Knowledge Candidate**
- OMR output and unreviewed model inferences cannot be promoted directly to the **Historical Knowledge Base**
- The **Historical Knowledge Base** combines built-in **Knowledge Packs** with reviewed claims promoted from the **Owner Reference Library**
- Material imported into the **Owner Reference Library** produces cited **Knowledge Candidates**, not automatic global truth
- Uncited model memory and live web results cannot substitute for a **Knowledge Pack** or reviewed library claim
- **Musicological Analysis** identifies candidate **Preservation Targets** before an arrangement plan is made
- **Musicological Analysis** always produces both an **Analysis Summary** and an **Analysis Record**
- The **Analysis Summary** is shown by default; the complete **Analysis Record** remains available to users who want to investigate
- An **Analysis Record** contains score-anchored **Analysis Claims** that distinguish observation from inference
- A user correction to an **Analysis Claim** becomes authoritative for the current arrangement and remains in its **Analysis Record**
- Critical ambiguity is surfaced for review while non-critical detail remains accessible without blocking the workflow
- **Texture** may change between passages within one source
- A passage may exhibit zero or more **Contrapuntal Techniques** independently of its **Texture**
- A **Cadential Hemiola** may be part of a passage's **Realization Context** even when the notated time signature does not change
- Every preserved relation among voices is represented by a **Target Relationship Plan**; retaining the participating pitches does not prove that entry order, subject shape, suspension, cadence, or figure relation survived
- **Species Counterpoint** is applied only when the source or request belongs to that pedagogical tradition
- A **Continuo Foundation** is a **Preservation Target** whose bass and figures cannot be silently contradicted
- A **Continuo Realization** is generated material and remains distinguishable from its **Continuo Foundation**
- A **Continuo Realization** may change doublings and spacing for the target instrument while preserving the bass and figures
- A **Continuo Realization** follows an explicit or inferred **Realization Profile**
- A result is a complete **Continuo Realization** only when the Arrangement Score sounds the authoritative Continuo Foundation, either on the target instrument or on a separate bass staff or instrument
- When the target instrument cannot sound the authoritative bass, Vellum may preserve it as a separate part or produce a clearly labeled **Continuo Reduction**
- A **Continuo Reduction** retains the complete Continuo Foundation in its source lineage and maps every unsounded bass event in the Preservation Audit
- Under **Faithful Reduction**, systematic omission of Continuo Foundation events requires a Policy Exception and may become Policy Drift; it cannot pass merely because the implied harmony has the same chord root
- Audio Preview and notation never synthesize or imply an absent bass while labeling the target part a complete Continuo Realization
- Vellum infers and announces the best-supported **Realization Profile** from source metadata and musical evidence
- Competing **Realization Profiles** remain visible in the **Analysis Record**; Vellum asks only when the choice would materially change the realization
- Unfigured or ambiguous continuo passages produce correctable **Analysis Claims** rather than silent assumptions
- An independent **Principal Voice** remains a simultaneous **Preservation Target** when present above a **Continuo Foundation**
- An arrangement has exactly one **Preservation Policy**
- Every Arrangement Score contains a complete **Transformation Report** regardless of Preservation Policy
- The Transformation Report maps source events and relationships to their arrangement descendants and identifies all omitted, changed, and newly generated material with rationale
- The workbench exposes the Transformation Report through a toggleable **Provenance Overlay** while keeping the normal score uncluttered
- Provenance Overlay markers use text, icons, or patterns in addition to color and support many-to-many source-to-arrangement mappings
- Omitted material is marked at its source or timeline location even when no corresponding arrangement glyph exists
- Selecting a Provenance Overlay marker opens the linked source and arrangement objects, transformation class, rationale, evidence, applicable policy, and audit result
- The Provenance Overlay is interactive diagnostic state and does not alter the Arrangement Score or normal Deliverables
- Under **Faithful Reduction**, the Preservation Audit evaluates the Transformation Report as a hard completion gate
- Under **Idiomatic Adaptation** and **Free Paraphrase**, the Transformation Report is informative and inspectable rather than a note-level fidelity gate; hard instrument, commitment, and contextual validation constraints still apply independently
- Every **Arrangement Score** produced under **Faithful Reduction** requires a passing **Preservation Audit**
- An unexplained omission, substitution, rhythmic change, or lost protected relationship fails the **Preservation Audit**
- Relationship Preservation Targets use machine-readable relationship types and ordered event groups; a passing audit recomputes timing, order, interval-rhythm shape, phrase contour, voice identity, suspension treatment, and cadential placement as applicable rather than accepting a generated success statement
- Golden-fixture mutation tests deliberately break each protected relationship and must produce hard findings, so fixture success cannot be inferred solely from event coverage or compilation
- A necessary deviation becomes a recorded **Policy Exception** and produces a new **Arrangement Score** version
- The complete **Preservation Audit** remains inspectable while its pass/fail summary appears by default
- A supplied source defaults to **Faithful Reduction** unless the request establishes another policy
- **Faithful Reduction** requires at least one resolved **Preservation Target**
- A uniform whole-work **Transposition Plan** is compatible with **Faithful Reduction** when it preserves protected intervals, rhythm, contour, harmonic function, form, and cadential relationships
- Vellum may automatically select the best playable target key and announces the complete Transposition Plan before generation without blocking
- Automatic transposition is blocked for review when absolute pitch or key is constrained by a fixed voice or instrument, vocal range, source-specific scordatura, edition matching, or another identified dependency
- Under **Faithful Reduction**, Vellum cannot independently transpose an isolated passage unless that transposition exists in the source or the Owner approves a score-anchored Policy Exception
- Before proposing a passage-level transposition, Arrangement Search must exhaust viable octave placement, revoicing, Texture reduction, and accompaniment simplification that preserve the Transposition Plan
- An unapproved passage-level transposition fails the Preservation Audit because it changes the work's tonal relationships rather than merely fitting it to the target instrument
- A uniform octave relocation of the complete **Principal Voice** is permitted under **Faithful Reduction** when Vellum announces and records it in the Transposition Plan
- Local octave displacement of Principal Voice events is permitted only when the Preservation Audit proves that pitch-class order, phrase contour, registral emphasis, cadence approach, rhythmic identity, and perceptual prominence remain intact
- A local octave displacement that folds, fragments, obscures, or changes the recognizable shape of the Principal Voice requires a score-anchored Policy Exception
- The Preservation Audit verifies the exact source-to-target pitch mapping and reports any note or relationship that departs from the Transposition Plan
- Under **Faithful Reduction**, accompaniment, inner voices, bass detail, and chord completeness yield before the **Principal Voice**
- **Idiomatic Adaptation** preserves recognizable musical identity without making every Principal Voice event invariant
- **Free Paraphrase** permits departure from the source's note-level identity
- Vellum announces the inferred **Principal Voice** and **Preservation Policy** without blocking when both are unambiguous
- Vellum asks before arranging when the **Principal Voice** is ambiguous, the request implies a different policy, or **Faithful Reduction** is infeasible for the target
- PDF and image import produces a **Score Transcription**, not an unquestioned source of truth
- Source acquisition supports generic PDF upload without coupling the product to a specific score repository
- Optical recognition is accessed through a backend-neutral adapter contract; Audiveris is the first supported backend, not part of Vellum's canonical score model
- Every PDF or image transcription records an **OMR Run** and preserves the original artifact, backend-native project data such as Audiveris `.omr`, exported MusicXML, backend version and configuration, logs, and page/region mappings
- MusicXML is an interchange projection of an **OMR Run**, not the sole evidence for a Score Transcription, because it may omit recognition and layout information
- Re-running recognition with a new backend or configuration creates a new **OMR Run** and Score Transcription version without rewriting the earlier result
- A **Source Artifact** is immutable after ingestion
- Corrections create a new **Score Transcription** version rather than rewriting prior transcription history
- A **Normalized Score** identifies the exact **Score Transcription** version from which it was derived
- An **Analysis Record** identifies the exact **Normalized Score** version it interprets
- An **Arrangement Score** records the exact source, analysis, Preservation Policy, and plan versions from which it was derived
- A new Score Transcription automatically recomputes deterministic normalization and analysis against the new version
- Applicable user-authored Analysis Claim corrections are carried forward explicitly; corrections whose score anchors no longer resolve require review rather than being silently discarded
- Existing Arrangement Scores, Performance Interpretations, and Deliverables remain preserved but become **Stale Derivations** when an upstream version changes
- Vellum never silently replaces a stale Arrangement Score; regeneration is an explicit action that creates a new Arrangement Score version
- The workspace shows why a derivation is stale and offers regeneration and comparison with the preserved prior version
- **Conservative Regeneration** is the default action for a stale Arrangement Score
- **Conservative Regeneration** creates a new version descended from the stale arrangement, preserves its **Editorial Commitments**, and changes only the dependency region affected by corrected upstream material
- If an **Editorial Commitment** conflicts with corrected source material or a hard constraint, Vellum presents the conflict for resolution rather than silently dropping the commitment
- Every direct user edit to an Arrangement Score becomes an **Editorial Commitment** by default
- A model-generated choice becomes an **Editorial Commitment** only when the user edits or explicitly approves it
- An **Editorial Commitment** records a **Commitment Scope** using stable musical object or relationship IDs, a temporal region where needed, and the specific semantic dimension being preserved
- Direct edits create the narrowest **Commitment Scope** implied by the edit; changing a fingering does not freeze unrelated pitch, rhythm, harmony, or articulation
- Users may explicitly broaden a **Commitment Scope** to a note group, voice, phrase, measure range, section, or complete arrangement
- Semantic commitments may protect Principal Voice material, rhythm, harmony, bass, Texture, contrapuntal relationships, ornaments, notation, or course and fingering choices
- When upstream changes make a Commitment Scope ambiguous or unresolvable, Vellum requests targeted review rather than expanding, discarding, or guessing the commitment
- **Let Vellum reconsider** releases an Editorial Commitment for future generation without reverting the current Arrangement Score or erasing its history
- Source-transcription corrections are versioned corrections to musical evidence, not Editorial Commitments in an arrangement
- A **Commitment Conflict** blocks completion and cannot be resolved by silently preferring source fidelity or the Editorial Commitment
- A **Commitment Conflict** offers exactly the applicable explicit resolutions: release the commitment, revise the Score Transcription when the evidence is wrong, or approve a versioned Policy Exception
- Revising the Score Transcription creates a new evidence-layer version and triggers dependency-aware recomputation; it is not an arrangement-level workaround
- A Policy Exception records the conflicting Commitment Scope, affected Preservation Target or hard constraint, musical consequence, rationale, and Owner approval in a new Arrangement Score version
- Commitment Conflicts and Policy Exceptions remain visible in the Preservation Audit and cannot be hidden by bulk approval
- A localized, Owner-approved Policy Exception may remain compatible with **Faithful Reduction** and yields a disclosed pass-with-exceptions result
- The Preservation Audit evaluates Policy Exceptions cumulatively by their effect on Preservation Targets and recognizable musical identity, not by a fixed exception count
- A single critical exception or accumulated exceptions that materially compromise a Preservation Target produce **Policy Drift** and fail **Faithful Reduction**
- **Policy Drift** blocks completion until the arrangement is revised or the Owner explicitly changes the Preservation Policy, producing a new Arrangement Score version and audit
- Every conservatively regenerated arrangement reruns its complete Preservation Audit and applicable validation; locality limits generation, not verification
- A fresh **Arrangement Search** remains an explicit alternative when the user wants Vellum to reconsider the arrangement broadly
- **Deliverables** are reproducible projections of an **Arrangement Score**, not canonical musical state
- The selected **Arrangement Score** receives an automatic synthesized **Audio Preview**
- Unselected **Arrangement Candidates** receive **Audio Previews** on demand rather than eagerly
- An **Audio Preview** uses the same sounding pitches, durations, tempo, repeats, and course-dependent octave behavior as the engraved Arrangement Score
- Audio Preview is divided into named **Playback Parts** for the Principal Voice, Continuo Foundation, accompaniment, and other musically distinct voices or instruments
- Every Playback Part supports independent mute, solo, and level controls
- Playback Parts derive from canonical sounding events and musical roles, not visible staves; standard notation and tablature showing the same events never create duplicate playback
- Preservation Targets and Preservation Audit findings link to the Playback Parts that sound them so the user can verify protected material in isolation
- **Lineage Navigation** is bidirectional: selecting linked notation, a source facsimile region, an Analysis Claim, or an audit finding seeks to the corresponding playback time
- During playback, Vellum highlights simultaneous sounding events in the Arrangement Score and their linked Score Transcription objects, Source Artifact regions, Analysis Claims, and audit mappings
- A repeated written event has a distinct **Playback Occurrence** for each performed iteration while retaining one canonical event identity
- Playback highlighting and seeking use canonical event lineage plus Playback Occurrence context rather than page coordinates or MIDI note matching alone
- Audio Preview follows the complete **Performed Form** by default, including repeats, volta endings, da capo or dal segno instructions, and codas
- A **Skip repeats** practice toggle creates a temporary condensed playback timeline without changing canonical score structure, the Arrangement Score, or a Performance Interpretation
- **Practice State** may loop a selected Playback Occurrence range and scale playback speed without changing pitch or relative rhythmic proportions
- Practice controls never modify tempo markings, Arrangement Scores, Performance Interpretations, Preservation Audits, MIDI exports, or other Deliverables
- Practice State can be reset independently and is not part of musical version lineage
- Critical uncertainty in a repeat, ending, or navigation sign blocks authoritative Performed Form generation and opens Score-Anchored Review
- The Performed Form records its traversal decisions so Playback Occurrences, exports, duration, and diagnostics remain reproducible
- Basic playback is explicitly synthetic; realistic historical instrument timbres and interpretive performance are not implied
- Literal playback of the **Arrangement Score** is the default **Audio Preview**
- Stylistic playback choices belong to a separate, versioned **Performance Interpretation** linked to an exact Arrangement Score version
- Applying or editing a **Performance Interpretation** never silently changes the Arrangement Score or its Preservation Audit
- Interpretive playback is labeled and toggleable against literal playback
- **Arrangement Search** generates alternatives for musically consequential choices rather than accepting a single first attempt
- An **Arrangement Candidate** that fails a Preservation Audit, instrument constraint, figure, or hard Validation Finding is rejected
- Before independent evaluation, surviving **Arrangement Candidates** are preordered by the exact versioned **Selection Policy** using generator-visible Search Measurements, lexicographic preservation obligations, and disclosed target preferences; this order is not evidence that a candidate is historically correct, idiomatic, comfortable, or ready
- Independent **Evaluation Cards** inspect candidates in that committed order without rewriting it; a separate immutable **Adoption Decision** may adopt a candidate only after every required applicable independent hard gate passes
- A rejected candidate yields to the next already ordered survivor or a new Arrangement Search; a candidate blocked only by unavailable evaluation remains pending retry and cannot be skipped merely because infrastructure failed; unadopted candidates remain available for disclosed audition or branching but never become the default Arrangement Score merely by ranking first
- An **Arrangement Brief** may contain one or more **Source Artifacts**
- Each **Arrangement Score** realizes exactly one **Target Configuration**, which may itself be a solo target or a defined ensemble such as voice and lute
- Multiple Notation Layouts and Deliverables for the same Target Configuration project the same Arrangement Score
- Changing an instrument, ensemble role, tuning, stringing, or other playability-relevant Target Configuration creates a sibling Arrangement Score in the same **Arrangement Family**
- Every sibling Arrangement Score runs its own Arrangement Search, playability validation, Preservation Audit, and candidate ranking
- Arrangement Family members share source-analysis lineage and the originating Arrangement Brief but remain independently versioned musical solutions
- Editorial Commitments remain local to one Target Configuration by default
- A user may explicitly promote a target-portable Editorial Commitment, such as retaining a countermelody or cadence, to a **Family Commitment** for selected or future family members
- Instrument-specific mechanics such as course, fret, fingering, diapason, or stringing choices cannot silently constrain sibling Target Configurations
- If a proposed Family Commitment is actually a correction to the source evidence, Vellum routes it to the Score Transcription or Analysis Record rather than duplicating it across arrangements
- Creating, editing, or releasing a Family Commitment marks affected family members stale and offers Conservative Regeneration independently for each Target Configuration
- A Family Commitment that is infeasible for one Target Configuration produces a target-local Commitment Conflict without invalidating feasible sibling arrangements
- The primary **Golden Arrangement Fixture** is a repository-stored, public-domain four-part Greensleeves PDF with explicit source and license provenance
- Greensleeves is development and regression evidence, never held-out evidence for the compiler work that is explicitly designed to repair it
- Non-Greensleeves acceptance uses **Contamination Groups** scoped to the complete **Generation System** and stored in the **Owner Evaluation Vault**; this means held out from Vellum development and fitting, not guaranteed absent from model pretraining
- The Vault commits eligibility, output-independent invalid-fixture rules, reserve order or deterministic seed, and exhaustion policy before output; every attempt enters an append-only ledger, every valid failure remains disclosed and becomes a permanent regression, and successors inherit the unconsumed reserve cursor before fresh groups qualify them
- Generation receives only a sealed source and Brief envelope and cannot read evaluator expectations, mutations, baselines, labels, or reserve assets
- Public tracer artifacts retain only opaque held-out IDs, coverage classes, digests, aggregate status, and redacted evidence; exact identities, truth, mutations, invalidations, reserve selection, and attempt diagnostics remain Vault-only
- A required `hardGateStatus` is pass only when every applicable required gate completed and passed; missing, unknown, or partial evidence is incomplete, while source, access, provider, evaluator, or infrastructure unavailability makes the enclosing acceptance blocked rather than passed
- An independent hard-gate failure blocks an **Adoption Decision**; evaluation may advance to the next preordered survivor or require a new search but cannot rewrite the Selection Decision
- A **Capability Qualification** applies to one sealed Generation System and target profile, while **Artifact Readiness** applies to one exact output; both must be current and compatible for release
- Implementation sequencing is defined only by the current `SPEC.md`; this enduring context requires production-path tracer bullets, shared substrate before dependent verticals, and coequal five-course baroque-guitar, thirteen-course baroque-lute, and six-string classical-guitar target obligations
- A subsystem is not integrated merely because its isolated API works; each tracer must exercise its affected persisted domain, API, UI, validation, evaluation, and deliverable contracts through a real vertical path
- A fixture-led tracer may implement only the generic capability needed by its fixture, but production behavior cannot hard-code the Work title, pitches, voice count, expected target decisions, hidden evaluation truth, or reserve identities
- The Greensleeves development fixture's baroque-guitar path covers generic PDF upload, OMR Run, Score-Anchored Review where needed, Principal Voice identification, Faithful Reduction, five-course baroque-guitar Arrangement Search, French-Letter Tablature with French Stringing, engraving, Preservation Audit, and Audio Preview without prescribing target execution order
- Acceptance compares every protected Greensleeves Principal Voice pitch, rhythm, order, and phrase relationship against the reviewed Score Transcription; recognizability is not inferred from successful compilation or a subjective claim alone
- The selected guitar arrangement must keep the Principal Voice perceptually prominent as the top line, pass instrument constraints, avoid duplicated playback events, and produce valid notation and audio
- The same source also produces coequal sibling 13-course baroque-lute and classical-guitar Arrangement Scores with independent search, validation, and Preservation Audits
- The second Golden Arrangement Fixture is a short, legally redistributable public-domain soprano-plus-figured-bass PDF containing an independent Principal Voice, a complete Continuo Foundation, and at least one prepared suspension
- Its reviewed transcription identifies every bass event, figure, accidental, soprano event, cadence, and suspension relationship so figure recognition and realization can be tested independently
- Its first historically scoped complete target is soprano plus an exact harpsichord Instrument Instance under the explicit `continuo.italian-baroque.cembalo` Realization Profile, engraved as a soprano staff above a keyboard grand staff with the source figures retained; a piano realization is a separately labeled modern editorial adaptation and does not inherit historical keyboard-instrument authority
- A target capable of sounding the bass must produce a complete Continuo Realization under an explicit Realization Profile; a target that cannot must produce a separate bass part or labeled Continuo Reduction with every unsounded foundation event reported
- The fixture verifies that contextual validation accepts the source-supported suspension treatment rather than applying a blanket dissonance or parallel-motion prohibition
- Audio Preview exposes separate Principal Voice, Continuo Foundation, and generated realization Playback Parts for isolated verification
- The third Golden Arrangement Fixture is a short, legally redistributable public-domain three-voice imitative passage whose musical identity depends on ordered entries rather than a single permanent Principal Voice
- Its Analysis Record must classify the Texture as imitative polyphony, identify the applicable Contrapuntal Techniques and Validation Profile, and promote voice entries, subject interval-rhythm shapes, cadential goals, and required voice continuities to Preservation Targets
- The canonical product path runs inside an **Arrangement Workspace** from source evidence through purpose-scoped Source Truth, Analysis, compatible Briefs, proportional Plan, bounded Search, adopted Arrangement Score, audit, evaluation, and reproducible Deliverables
- The flat `/api/arrangements` LilyPond store is a retained noncanonical compatibility projection; compilation or storage there does not establish reviewed Source Truth, an adopted Arrangement Score, or Arrangement Readiness
- Existing flat files are not automatically migrated because reconstructing canonical lineage would invent missing provenance and decisions; canonical reuse begins by importing the actual source into an Arrangement Workspace
- Focused Arrangement Intelligence ADRs 0016 through 0021 are accepted architecture; their prototype evidence remains preserved even when later work supersedes an implementation detail
- The initial intabulation target is the six-course Renaissance lute in French tablature; candidate search may redistribute playable notes across courses and registers but cannot erase or reorder protected imitation
- The Preservation Audit verifies every protected entry and relationship, not merely pitch coverage or the highest source voice
- Audio Preview and Lineage Navigation allow each source voice and its arrangement descendants to be isolated even when the intabulation interleaves them on one tablature staff
- A dedicated **Golden Engraving Fixture** verifies that open course 10 on the default 13-course D-minor baroque lute renders as `///a` below the French tablature staff and sounds D2
- The fixture checks the structured course assignment, generated LilyPond semantics, rendered glyph and placement, MIDI pitch, and absence of duplicate playback; non-empty SVG output is insufficient
- The diapason sign remains `///a` when a Bass Tuning changes course 10's pitch, proving that course identity and sounding pitch are independent
- A companion sequence verifies the source-backed twelve-course signs `a`, `/a`, `//a`, `///a`, `4`, and `5` for courses 7 through 12; the course-13 sign remains an explicit editorial or software convention until directly applicable historical evidence establishes it
- Coequal baroque-guitar engraving fixtures verify alfabeto binding, stroke direction and order, course masks, omitted and muted courses, held and damped state, constituent-string playback, and notation timing
- Coequal classical-guitar engraving fixtures verify independent voice layers, stem direction, rests, ties and spanners, written-to-sounding octave identity, isolated Playback Parts, and absence of duplicated sounding events
- Golden fixtures include reviewed canonical musical data so OMR backend drift can be distinguished from arrangement-engine regressions
- An **Arrangement Brief** selects one or more **Notation Layouts** independently from one or more **Deliverables**
- A **Notation Layout** may produce multiple **Deliverables**
- **Guided Start** may seed the conversation with an initial **Arrangement Brief**
- **Guided Start** never gates conversation and may be skipped entirely
- **Guided Start** is limited to Source Artifacts, target instruments, Notation Layouts, Deliverables, and an optional free-text instruction
- Expert choices such as Preservation Policy, tuning variants, and transcription review appear later only when relevant
- The **Arrangement Brief** is refined by later user choices rather than becoming a separate source of truth
- A **Score Transcription** may proceed automatically when validation passes and it contains no **Critical Uncertainty**
- **Critical Uncertainty** requires targeted review; non-critical uncertainty is disclosed without necessarily blocking the arrangement
- A user may explicitly approve a best-effort **Score Transcription**
- A **Critical Uncertainty** opens a **Score-Anchored Review** at the exact affected source region and recognized musical object
- **Score-Anchored Review** presents the source facsimile beside editable recognized notation and ranked correction suggestions with their evidence
- Accepting a correction creates a new **Score Transcription** version; it never edits the immutable Source Artifact or silently rewrites the prior transcription
- Chat may explain an uncertainty or accept a textual correction, but it is not the primary interface for visible score correction
- **French Tablature** places **Diapason Signs** below the main six-course staff
- A **Diapason Sign** identifies an open bass course independently of its retuned pitch
- In the default 13-course D-minor tuning, low D on course 10 uses the **Diapason Sign** `///a`
- The default **13-Course Baroque Lute** uses stopped courses F4–D4–A3–F3–D3–A2 and Diapasons G2–F2–E♭2–D2–C2–B♭1–A1
- A piece may select a different **Bass Tuning** while retaining the same **Diapason Signs**
- Solo baroque lute and solo baroque guitar arrangements default to a **Native Tablature Layout**
- Songs default to a standard melody or voice staff above the accompaniment's native tablature
- **Learning Layout** is available on request; standard notation alone is not the default for a historical plucked-string part
- Classical guitar arrangements support a **Classical Guitar Staff** without requiring tablature
- Classical guitar defaults to a **Classical Guitar Staff**; **Learning Layout** and tablature-only output require an explicit choice
- **French-Letter Tablature** and **French Stringing** are independent choices
- Baroque guitar defaults to both **French-Letter Tablature** and **French Stringing**, each independently overridable

## Example dialogue

> **Arranger:** "This Greensleeves source has four voices. Which material must survive the five-course guitar reduction?"
> **Domain expert:** "Use the soprano as the **Principal Voice** and choose **Faithful Reduction**. Keep it perceptible as the top line; simplify the other voices first."

## Flagged ambiguities

- "lead voice," "lead line," "melody," and "soprano" were used interchangeably; resolved: **Principal Voice** names the preservation role, while soprano is only one possible source voice.
- "preserve" did not state which transformations were permitted; resolved: the **Preservation Policy** makes that choice explicit, and **Faithful Reduction** must be supported as a hard-constraint mode.
- A single **Principal Voice** could not describe continuo or imitative counterpoint; resolved: arrangements protect one or more **Preservation Targets**, of which Principal Voice is one possible kind.
- "PDF import" could imply that optical recognition is authoritative; resolved: artifact import produces a confidence-bearing **Score Transcription** and blocks only on **Critical Uncertainty** unless the user approves best effort.
- IMSLP was considered as an example source rather than an integration boundary; resolved: support generic PDF upload and retain supplied provenance without an IMSLP-specific workflow.
- A direct Audiveris integration could make its MusicXML export look canonical; resolved: use a backend-neutral OMR adapter and retain the complete OMR Run, with Audiveris as the first implementation.
- "French" can refer to baroque-guitar notation, stringing, or musical style; resolved default: use both **French-Letter Tablature** and **French Stringing**, while naming and overriding them independently.
