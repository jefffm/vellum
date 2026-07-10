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

**Local-First Runtime**:
The Owner's machine running Vellum's browser interface, services, musical toolchain, data stores, and provider callback as the primary deployment.
_Avoid_: Local mode

**Historical Knowledge Base**:
The reviewed, versioned collection of cited Historical Practice Claims and reusable historical profiles.
_Avoid_: Memory, model knowledge

**Knowledge Pack**:
A versioned, reviewed collection of Historical Practice Claims, profiles, examples, and validation guidance for a defined musical domain.
_Avoid_: Prompt, preset

**Owner Reference Library**:
The Owner's local collection of treatises, books, articles, scores, and notes from which cited Knowledge Candidates may be extracted.
_Avoid_: Training data, uploads

**Knowledge Candidate**:
A potentially reusable claim proposed from project work but not yet admitted to the Historical Knowledge Base.
_Avoid_: Learned fact

**Musicological Analysis**:
A structured, evidence-bearing interpretation of a source's form, voices, Texture, Contrapuntal Techniques, harmony, phrases, cadences, and Preservation Targets.
_Avoid_: LLM summary, chord analysis

**Musicological Engine**:
The hybrid system that combines symbolic analysis, curated historical knowledge, model judgment, and constraint verification to produce Musicological Analysis and arrangements.
_Avoid_: LLM, theory helper

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

**OMR Run**:
A versioned, reproducible recognition attempt that links a PDF or image Source Artifact to a Score Transcription and retains the recognition backend, version, configuration, logs, page mappings, native project data, and interchange exports.
_Avoid_: Import result, MusicXML file

**Normalized Score**:
A source-format-neutral temporal and voice graph derived from a specific Score Transcription version for analysis and planning.
_Avoid_: Source, arrangement

**Arrangement Score**:
A versioned musical result derived from exact source, transcription, normalization, analysis, and planning versions.
_Avoid_: LilyPond file, rendered score

**Target Configuration**:
The exact set of instruments, ensemble roles, tunings, stringing choices, and relevant capabilities for which an Arrangement Score is generated and validated.
_Avoid_: Output format, instrument name without its configuration

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
A complete or sectional proposed realization of an arrangement plan with recorded derivation choices and evaluation results.
_Avoid_: Draft, option

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
The below-staff sign that identifies which Diapason sounds, using the historical default sequence `a`, `/a`, `//a`, `///a`, `4`, `/4`, `//4` for courses 7–13.
_Avoid_: Fret letter, because a Diapason is not stopped at a fret

**13-Course Baroque Lute**:
The default D-minor lute configuration with six stopped courses and seven open Diapasons.
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
- Curated historical knowledge consists of cited **Historical Practice Claims**, not unsourced universal rules
- Conflicting **Historical Practice Claims** remain distinct alternatives with their own scope and authority
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
- The primary **Provider Connection** uses local ChatGPT OAuth through Pi's public provider API; API keys remain a fallback
- A **Provider Connection** exposes connected, refreshing, expired, and disconnected states plus explicit reconnect and logout actions
- Provider availability gates only **Model Actions**; source import, Score-Anchored Review, direct editing, deterministic analysis, validation, engraving, workspace access, and Audio Preview remain locally available while disconnected
- A Model Action records its exact workspace inputs and last confirmed version boundary before provider work begins
- Provider failure or logout never commits incomplete model output to a Score Transcription, Analysis Record, Arrangement Candidate, Arrangement Score, or Historical Knowledge Base
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
- Surviving **Arrangement Candidates** are ranked by applicable historical profiles, playability, idiom, voice leading, and soft preferences
- The selected **Arrangement Candidate** becomes the next **Arrangement Score** version; unselected candidates remain available for audition or branching
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
- Its primary acceptance path is generic PDF upload, OMR Run, Score-Anchored Review where needed, Principal Voice identification, Faithful Reduction, five-course baroque-guitar Arrangement Search, French-Letter Tablature with French Stringing, engraving, Preservation Audit, and Audio Preview
- Acceptance compares every protected Greensleeves Principal Voice pitch, rhythm, order, and phrase relationship against the reviewed Score Transcription; recognizability is not inferred from successful compilation or a subjective claim alone
- The selected guitar arrangement must keep the Principal Voice perceptually prominent as the top line, pass instrument constraints, avoid duplicated playback events, and produce valid notation and audio
- The same source then produces sibling 13-course baroque-lute and classical-guitar Arrangement Scores with independent search, validation, and Preservation Audits
- The second Golden Arrangement Fixture is a short, legally redistributable public-domain soprano-plus-figured-bass PDF containing an independent Principal Voice, a complete Continuo Foundation, and at least one prepared suspension
- Its reviewed transcription identifies every bass event, figure, accidental, soprano event, cadence, and suspension relationship so figure recognition and realization can be tested independently
- A target capable of sounding the bass must produce a complete Continuo Realization under an explicit Realization Profile; a target that cannot must produce a separate bass part or labeled Continuo Reduction with every unsounded foundation event reported
- The fixture verifies that contextual validation accepts the source-supported suspension treatment rather than applying a blanket dissonance or parallel-motion prohibition
- Audio Preview exposes separate Principal Voice, Continuo Foundation, and generated realization Playback Parts for isolated verification
- The third Golden Arrangement Fixture is a short, legally redistributable public-domain three-voice imitative passage whose musical identity depends on ordered entries rather than a single permanent Principal Voice
- Its Analysis Record must classify the Texture as imitative polyphony, identify the applicable Contrapuntal Techniques and Validation Profile, and promote voice entries, subject interval-rhythm shapes, cadential goals, and required voice continuities to Preservation Targets
- The initial intabulation target is the six-course Renaissance lute in French tablature; candidate search may redistribute playable notes across courses and registers but cannot erase or reorder protected imitation
- The Preservation Audit verifies every protected entry and relationship, not merely pitch coverage or the highest source voice
- Audio Preview and Lineage Navigation allow each source voice and its arrangement descendants to be isolated even when the intabulation interleaves them on one tablature staff
- A dedicated **Golden Engraving Fixture** verifies that open course 10 on the default 13-course D-minor baroque lute renders as `///a` below the French tablature staff and sounds D2
- The fixture checks the structured course assignment, generated LilyPond semantics, rendered glyph and placement, MIDI pitch, and absence of duplicate playback; non-empty SVG output is insufficient
- The diapason sign remains `///a` when a Bass Tuning changes course 10's pitch, proving that course identity and sounding pitch are independent
- A companion sequence verifies the historical default signs `a`, `/a`, `//a`, `///a`, `4`, `/4`, and `//4` for courses 7 through 13
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
