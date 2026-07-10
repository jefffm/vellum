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

**Owner**:
The single person whose workspaces, defaults, and reviewed knowledge belong to a Vellum installation.
_Avoid_: User, account

**Provider Authorization**:
The credential grant that permits Vellum to call a model provider without determining ownership of Vellum data.
_Avoid_: Vellum login, user identity

**Provider Connection**:
Vellum's local lifecycle for acquiring, storing, refreshing, reporting, reconnecting, and removing Provider Authorization.
_Avoid_: Imported credentials, API key setting

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

**Arrangement Candidate**:
A complete or sectional proposed realization of an arrangement plan with recorded derivation choices and evaluation results.
_Avoid_: Draft, option

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

**Performance Interpretation**:
An optional, versioned layer of sounding choices—such as ornament realization, arpeggiation, inequality, articulation, tempo shaping, and rubato—applied to an exact Arrangement Score without changing its notation.
_Avoid_: Arrangement Score, when the change exists only in playback

**Critical Uncertainty**:
A transcription uncertainty that could change the Principal Voice, musical form, figured bass, or another preservation target.
_Avoid_: Low confidence without stating its musical consequence

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
- User corrections persist automatically within their **Arrangement Workspace**
- **Personal Defaults** remain separate from source analysis and historical claims
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
- Vellum infers and announces the best-supported **Realization Profile** from source metadata and musical evidence
- Competing **Realization Profiles** remain visible in the **Analysis Record**; Vellum asks only when the choice would materially change the realization
- Unfigured or ambiguous continuo passages produce correctable **Analysis Claims** rather than silent assumptions
- An independent **Principal Voice** remains a simultaneous **Preservation Target** when present above a **Continuo Foundation**
- An arrangement has exactly one **Preservation Policy**
- Every **Arrangement Score** produced under **Faithful Reduction** requires a passing **Preservation Audit**
- An unexplained omission, substitution, rhythmic change, or lost protected relationship fails the **Preservation Audit**
- A necessary deviation becomes a recorded **Policy Exception** and produces a new **Arrangement Score** version
- The complete **Preservation Audit** remains inspectable while its pass/fail summary appears by default
- A supplied source defaults to **Faithful Reduction** unless the request establishes another policy
- **Faithful Reduction** requires at least one resolved **Preservation Target**
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
- **Deliverables** are reproducible projections of an **Arrangement Score**, not canonical musical state
- The selected **Arrangement Score** receives an automatic synthesized **Audio Preview**
- Unselected **Arrangement Candidates** receive **Audio Previews** on demand rather than eagerly
- An **Audio Preview** uses the same sounding pitches, durations, tempo, repeats, and course-dependent octave behavior as the engraved Arrangement Score
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
