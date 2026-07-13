# Instrument Representation and Musical Constraint Compiler

Status: Draft subordinate proposal

## Purpose

This specification governs exact instrument representation, capability composition, target-specific search, evaluation semantics, and honest candidate selection.

## Instrument Instance Configuration

Target mechanics require an immutable exact instrument instance rather than a name plus one pitch per course.

```ts
type InstrumentInstanceConfiguration = {
  id: string;
  profileId: string;
  profileVersion: string;
  scaleLength?: Measurement;
  physicalSetup?: Record<string, JsonValue>;
  courses: CourseConfiguration[];
  tuningState: TuningState;
  notationConfiguration: NotationConfiguration;
  contentDigest: string;
};

type CourseConfiguration = {
  course: number;
  stopped: boolean;
  strings: Array<{
    id: string;
    openPitch: string;
    fretsWithCourse: boolean;
  }>;
  notationIdentity: string;
};
```

The model supports single strings, single first courses, unison pairs, octave pairs, bourdons, paired or single stopped lute courses, and unstopped diapasons. Course identity, constituent strings, sounding pitch set, fretting behavior, and notation identity remain distinct.

Changing scale, setup, stringing, tuning, or course construction creates a new target input and invalidates dependent mechanical and ergonomic evidence.

## Capability composition

Reusable capabilities include:

- single- and multi-string course sounding;
- stopped courses and diapasons;
- re-entrant and monotonic tuning;
- finger occupation and barré mechanics;
- sustain, resonance, and damping;
- right-hand technique families;
- alfabeto and other historical chord vocabularies;
- polyphonic voice duration;
- standard notation and tablature semantics;
- complete, separate, or reduced bass disposition; and
- instrument-instance physical facts.

A capability declares data, evaluators, evidence vocabulary, and compatibility. Search Adapters consume composed capabilities but own search state and successor generation where the musical problem differs. Capability reuse never authorizes false defaults or a universal lowest-common-denominator state.

## Constraint Specifications

Constraints are serializable, versioned data:

```ts
type ConstraintSpecification = {
  id: string;
  schemaVersion: number;
  evaluatorId: string;
  evaluatorVersion: string;
  scope: ConstraintScope;
  parameters: JsonValue;
  provenance: ConstraintProvenance;
  enforcement: ConstraintEnforcement;
  applicability: ConstraintApplicability;
  compilerIdentity: ExecutionComponentIdentity;
};
```

Provenance distinguishes Preservation Targets, instrument mechanics, Analysis Claims, historical profiles, Plan Decisions, Commitments, Personal Defaults, Owner instructions, and Policy Exceptions. Search width, pruning, seed, and resource policy belong to the Search Attempt, not musical provenance.

Enforcement records rejection behavior, comparison priority, exception policy, confirmation policy, rationale, and incremental versus complete applicability. The same observation may have different enforcement under different Preservation Policies without changing its evidence.

## Evaluation semantics

Every conclusion records independent dimensions:

- completeness: complete, bounded, heuristic, unknown, or not evaluated;
- evidence basis: mechanical, source-derived, historical, analytical, ergonomic, model-assisted, or Owner statement;
- authority: system-derived, Owner-confirmed, Owner-excepted, or advisory; and
- permitted presentation: certified, audited, evidence-supported, estimated, descriptive, or undetermined.

Certification applies only to the exact modeled property. It never silently expands to comfort, beauty, historical correctness, or total performance feasibility.

## Search Outcomes

- `candidate_found`
- `exhaustively_infeasible`
- `search_exhausted`
- `blocked_by_uncertainty`
- `cancelled`
- `failed`

Only exhaustive infeasibility may be described as impossible, and only with a certificate declaring the finite modeled universe, complete successor rule, evaluated constraints, omitted dimensions, pruning rules, and why state merging preserves completeness. Bounded or heuristic search reports exhaustion.

## Search Adapter contract

An adapter owns:

- supported Target Configurations, Textures, plan kinds, and Performance Briefs;
- complete partial state;
- initial and successor generation;
- safe equivalence and dominance;
- incremental pruning;
- complete candidate construction;
- progress, cancellation, and checkpoints;
- completeness claims; and
- diagnostic frontier and rejection evidence.

State merging requires a documented sufficient relation, exhaustive differential comparison against an unpruned reference on small spaces, property-based testing, and adversarial counterexamples. Heuristic merging forfeits completeness claims.

## Candidate comparison

1. Reject hard failures.
2. Reject missing required evaluation.
3. Apply policy-defined lexicographic priorities.
4. Remove Pareto-dominated candidates only over mutually applicable dimensions.
5. Cluster cosmetic variants.
6. Present materially different survivors.
7. Use weighted totals only for calibrated, documented, commensurable dimensions.

Every metric declares units, direction, normalization, uncertainty, applicability, and missing-value behavior. Unknown is never zero or neutral. Automatic selection requires a sole lexicographic survivor, strict dominance on authoritative dimensions, or an Owner-approved deterministic tie-break rule.

## Initial targets

### Five-course baroque guitar

The adapter models exact single or doubled course construction, re-entrant tuning, bourdons, alfabeto shape identity and sounding set, barrés, rasgueado and punteado applicability, campanella, damping, and honest bass limitation. Greensleeves must preserve its recognizable Principal Voice and reject the observed extreme transition as an unqualified playable result.

### Thirteen-course baroque lute

The adapter models D-minor tuning, exact stopped-course stringing, diapason tuning, course identity, right-hand bass access, preparation, resonance, damping, French tablature, and style brisé only when context supports it. Open bass changes are not described as left-hand shifts. Course 10 retains `///a` notation and D2 sounding identity under the default configuration.

### Six-string classical guitar

The adapter models six single strings, left-hand position, fingers, barré, guide fingers, sustain, voice duration, and disclosed right-hand coverage. Standard notation is not tablature with labels removed. Hidden physical fingering evidence remains persisted even when not engraved. Spelling, stems, ties, and voice layout derive from canonical voice semantics rather than fingering alone.

## Performance context

Search and evaluation consume the Performance Brief. A transition may be geometrically possible yet inappropriate for the intended tempo, proficiency, preparation, or reliability goal. Intended Performer Profile affects difficulty and technique estimates but never rewrites instrument mechanics.

Owner Ergonomic Profile records personal capabilities separately. A hard personal limitation can reject candidates for that Owner without becoming a universal instrument impossibility.

## Phrase boundaries

Regeneration expands visible selection to include incoming and outgoing state, sustained notes, harmonic obligations, phrase and cadence context, repeated form, and active Commitments. Boundary derivation records the Analysis Claims used. Material ambiguity blocks or produces conservative alternative scopes. The complete Arrangement Score receives a new Transformation Report and Preservation Audit after adoption.

## Recomputability

Every search and evaluation records compiler, adapter, evaluator, profile, capability, Knowledge Pack, dependency, configuration, ordering, pruning, and seed identities and digests. Historical results are recomputable only when the exact implementations and inputs remain available; otherwise they remain inspectable.
