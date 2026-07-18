# Vellum Musical Proofs

Status: Current and authoritative next-work specification

This is the only current implementation specification in the repository. It replaces the
high-assurance Instrument Intelligence program archived at
[`docs/archive/specifications/2026-07-16-high-assurance-program`](docs/archive/specifications/2026-07-16-high-assurance-program/README.md).

## Outcome

Prove that Vellum can turn an uploaded score into recognizable, playable, idiomatic,
inspectable arrangements for three coequal targets:

- five-course baroque guitar;
- thirteen-course baroque lute; and
- six-string classical guitar.

Vellum should behave like a personal musicologist and practical arranger. The Owner should
not need to know which historical technique, voice-leading rule, fingering constraint, or
notation convention must be named in a prompt. Expert reasoning and evidence remain
inspectable, but good defaults must work without expert prompting.

The next milestone is not a general certification platform. It is three convincing musical
proofs exercised through the real product.

## Product test

The milestone passes when the Owner can upload one rights-approved, non-Greensleeves PDF,
review uncertain transcription only where necessary, request all three targets, and receive:

1. a recognizable Principal Voice with phrase and cadence identity intact;
2. idiomatic subordinate material rather than pitch coverage masquerading as arrangement;
3. mechanically plausible fingerings and technique for the selected Instrument Instance;
4. readable engraving in the target's expected notation;
5. synchronized literal playback from the same canonical musical events;
6. an understandable explanation of transformations, compromises, and uncertainty; and
7. a saved new version after either a prompted revision or a manual batch edit.

Each target must also pass its target-specific proof below. Passing one target cannot
compensate for another target's failure.

## Product principles

### Musical value before assurance machinery

New infrastructure must be justified by an immediate product proof. Do not build generalized
trust, migration, qualification, publication, or reviewer systems in anticipation of future
deployment. Ordinary Git history, tests, local storage, source citations, and explicit Owner
review are sufficient for this milestone.

### Source understanding before fingering

The Source Voice Graph, musical context, phrases, cadences, Preservation Targets, Target Voice
Plan, Target Harmonic Plan, Target Relationship Plan, and Intended Technique Plan are the
shared musical substrate. They may begin as deliberately narrow structures, but a target
compiler may not infer musical importance solely from pitch height, staff, or event order.

The default reduction policy is Faithful Reduction unless the Owner asks otherwise. A
Principal Voice is a hard Preservation Target under that policy. In polyphonic or continuo
sources, Vellum must preserve the actual relationship structure rather than inventing a
permanent melody role.

### Idiom is constitutive, not decorative

Technique changes which notes may sound, how they are held, which fingers are available, and
how the result is notated. Intended Technique is therefore planned before physical search,
not labeled after a generic voicing has been selected.

### Three coequal targets

Five-course baroque guitar, thirteen-course baroque lute, and six-string classical guitar are
coequal. Shared abstractions may reduce duplication, but no target may define the default
mechanics, texture, notation, or evaluation model for the other two.

### Honest uncertainty

Vellum uses `pass`, `fail`, `blocked`, and `incomplete` where an aggregate status is useful.
A conclusive hard violation is `fail`; an unavailable required external dependency is
`blocked`; missing or unfinished evidence is `incomplete`; only complete passing evidence is
`pass`. No digest-pinned status-policy migration is required for this milestone.

### Local-first, source-backed knowledge

Knowledge remains local to the Owner by default. A usable Knowledge Pack entry needs:

- a stable local ID and schema version;
- an authority lane and musical domain;
- a claim or observation with applicability;
- a citation to a Reference Work and, where available, a Source Segment Version;
- its review state and the Owner decision that permits use; and
- the declarative compiler or evaluator consequence it supports.

For this milestone, an Owner-reviewed local release and a simple versioned activation record
are enough. External reviewer credentials, Merkle publication graphs, complete registry
inventories, attestation verification, advisory verification, and cryptographic publication
ceremonies are deferred until an actual multi-author or externally distributed library needs
them.

Unreviewed extraction may propose Knowledge Candidates but may not silently change generation.
Historical claims, modern pedagogy, editorial convention, software heuristics, instrument
mechanics, and personal ergonomic evidence remain distinguishable.

## Shared musical proof

The first shared vertical must carry one source phrase through import, transcription,
analysis, planning, target search, engraving, playback, and evaluation. It must demonstrate:

- Principal Voice identity across pickup, phrase, cadence, rests, and staff changes;
- continuous subordinate-voice obligations rather than isolated chord snapshots;
- explicit omissions and transformations;
- phrase-level search with bounded outcomes;
- target-specific Intended Technique; and
- score-anchored findings that can drive a prompted revision.

The implementation should deepen existing domain records only where this proof requires it.
It must not create a second parallel planning model.

## Five-course baroque-guitar proof

The target uses the selected five-course Instrument Instance, including re-entrancy and
component-string identity. French tablature is the default output convention unless the
Owner selects another supported convention.

The compiler must plan punteado, rasgueado, alfabeto, or mixed style passage by passage.

- Punteado may not assume classical-guitar right-hand technique. Its default plucking resource
  is thumb, index, and middle, with simultaneous plucked attacks constrained accordingly.
- Larger sonorities must either be a supported strummed gesture or be reduced. A strum crosses
  a contiguous course span; it may omit courses at an edge but may not silently skip an
  interior course.
- Alfabeto is both a physical shape and a historically scoped harmonic/technique choice. A
  generic vertical chord is not alfabeto merely because it can be strummed.
- Mixed style must encode transitions and held-state consequences, not alternate labels over
  one generic realization.
- A Continuo Reduction must disclose unsounded foundation events and may not claim to be a
  complete Continuo Realization.

The proof rejects the previously observed unplayable and non-idiomatic behavior, including
large cross-course reaches chosen merely because every pitch exists somewhere on the fingerboard.

## Thirteen-course baroque-lute proof

The target binds an exact thirteen-course Instrument Instance, including scale length,
stringing, D-minor tuning state, bass-course retuning, and notation identity. French tablature
is the default.

The compiler must jointly plan:

- left-hand positions, fingers, held notes, releases, shifts, and spans;
- right-hand allocation and idiomatic course use;
- stopped courses versus diatonic diapasons;
- resonance, repeated basses, and phrase continuity; and
- sounding pitch, course identity, tablature identity, and playback identity.

A nominal fret difference is not a sufficient playability model. Physical distance depends on
scale length and fret position; the known first-position five-fret span must be rejected or
revoiced for the Owner's 69 cm instrument unless explicit reviewed ergonomic evidence says
otherwise.

The default diapason tablature mapping is:

```text
course 7   a
course 8  /a
course 9 //a
course 10 ///a
course 11 4
course 12 5
course 13 configurable pending source-backed convention
```

Numeric lower-course identities do not acquire leading slashes. Unresolved course-13 notation
must be disclosed and configurable rather than presented as historical fact.

## Six-string classical-guitar proof

The target uses a selected six-string EADGBE Instrument Instance and standard notation by
default. Tablature may be added later but is not required for this proof.

The compiler must create a coherent multi-voice reduction rather than preserve the Principal
Voice while allowing the bass to appear opportunistically. At minimum:

- Principal Voice and bass have explicit activity and rest spans;
- the bass has phrase direction, harmonic function, cadence obligations, and continuity costs;
- omissions and register changes are planned across the phrase, not selected event by event;
- left-hand fingering, right-hand fingering, sustain, release, and voice separation are searched
  jointly; and
- notation and playback preserve independent voice identity.

The proof fails if the bass line pops in and out without musical rationale even when every
individual sonority is mechanically playable.

## PDF, review, and output proof

The real product path begins with an arbitrary uploaded PDF rather than a LilyPond-only fixture.
Audiveris remains the first OMR backend, behind the existing adapter. The immutable source,
native OMR evidence, exported MusicXML, transcription version, uncertainty, and corrections
remain linked.

The OCR auto-accept threshold appears only when OMR evidence is in use and is adjustable before
or during review. Review crops must be large enough to identify the symbol, support zoom, and
must not obscure the symbol with an overlay. Accepting all required uncertainties must advance
the workflow; a downstream musicological finding must not loop the Owner back into completed
OCR review.

The same reviewed source version feeds all three target arrangements. Each output retains its
own plan, search, score, evaluation, engraving, and playback while sharing source analysis.

## Interaction and versions

The arrangement view must support multi-note selection. A prompt may refer to the selection as
explicit score-anchored context. The Owner may also perform supported manual edits. A batch of
prompted or manual edits is saved as a new Arrangement Score version with parentage, rationale,
and a recomputed audit; it never overwrites the prior score.

Playback must follow the rendered score with a restrained, readable play-position marker that
does not obscure tablature or notation. Seeking from notation and selecting during paused
playback must remain usable.

## Evaluation

Evaluation exists to improve musical output, not to certify the execution process.

### Development fixtures

Maintain a small rights-approved corpus containing at least:

- one melody-with-accompaniment or SATB source suitable for all three target reductions;
- one explicit continuo source;
- one imitative-polyphony source;
- target-specific known-bad passages for baroque-guitar technique, lute reach/diapasons, and
  classical-guitar bass continuity.

Greensleeves may remain a regression, but it cannot be the only or primary proof.

### Holdouts

Keep a small Owner-local holdout set outside the repository. It may initially contain one work
per target or one common source plus target-specific passages. Its identity and reviewed truth
remain private. A simple local manifest and ordinary attempt log are sufficient. Do not build
an encrypted Vault, sealed evaluator service, curator role system, or qualification ledger
until real use demonstrates that process isolation is necessary.

### Measures

Evaluation must expose separate results for:

- source and Principal Voice fidelity;
- phrase and cadence preservation;
- subordinate-voice continuity and harmonic function;
- target mechanics and ergonomics;
- historical/idiomatic technique applicability;
- notation correctness and readability;
- playback/engraving identity; and
- Owner playability and usefulness when reviewed.

Hard failures cannot be averaged away. Tests should include mutations that break the property
being claimed. Snapshot similarity alone is not musical evaluation.

## Execution plan

The active tracer-bullet queue is
[`.scratch/musical-proofs/PLAN.md`](.scratch/musical-proofs/PLAN.md). It contains eleven vertical
slices:

1. establish a non-Greensleeves three-target baseline;
2. carry shared phrase and voice obligations end to end;
3. prove the baroque-guitar idiom;
4. prove the thirteen-course lute idiom;
5. prove the classical-guitar two-voice idiom;
6. exercise real PDF-to-three-target Guided Start;
7. complete interactive selection, revision, versions, and score-following playback;
8. prove the incremental source-backed Knowledge Pack loop;
9. consolidate public regressions and simple private holdouts; and
10. perform one late Owner playtest; and
11. autonomously remediate its concrete failures and close the milestone.

Tracer completion uses one implementation commit and ordinary tests. No evidence receipt,
manifest-only commit, remote GraphQL observation, trust bootstrap, temporal execution generation,
or machine/release closure aggregator is required.

## Completion boundary

This specification is complete when:

- the real uploaded source completes the product test for all three targets;
- all target-specific proofs pass automated known-bad and generative regressions;
- the Owner can inspect citations, planning, transformations, and uncertainty;
- prompted and manual revisions save as new versions;
- playback and engraving derive from the same canonical events and stay synchronized; and
- the late Owner playtest finds the outputs useful enough to continue arranging, or its concrete
  failures have been turned into passing regressions and repaired.

This is product completion, not a universal claim of historical authenticity, comfort for every
performer, global search optimality, or readiness for multi-user publication.

## Deferred until triggered by evidence

The following are explicitly outside the critical path:

- external Knowledge Pack registries and third-party release trust;
- cryptographic reviewer credentials, attestations, advisories, and verification graphs;
- complete inventory snapshots and Merkle publication DAGs;
- encrypted Evaluation Vaults and sealed evaluators;
- qualification roles, adjudication rounds, and Machine/Release Complete aggregators;
- per-tracer evidence receipts, trust anchors, and GitHub GraphQL publication checks;
- generalized legacy migration frameworks without deployed legacy data;
- remote multi-owner operation; and
- model training or autonomous learning from unreviewed behavior.

Any deferred capability requires a new concrete use case, an ADR, and a thin product-facing
tracer before implementation.
