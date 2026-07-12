# Source Truth, Performance Brief, and Arrangement Planning

Status: Draft subordinate proposal

## Purpose

This specification governs the path from imported evidence to an approved musical design. It prevents Vellum from precisely arranging incorrect source truth or optimizing a musically weak reduction.

## Source Truth Gate

The gate is iterative:

1. A preliminary assessment after import determines whether Analysis may proceed.
2. Musicological Analysis may discover that an uncertainty changes voice identity, cadence, figure, Texture, form, or a Preservation Target.
3. Such a discovery reopens Score-Anchored Review.
4. A final purpose-scoped Source Truth Assessment authorizes Arrangement Planning for an exact scope.
5. Corrections create new versions and rerun the loop; they never mutate old evidence.

### Stable completion rule

Planning may proceed for a musical scope only when the current Analysis Record introduces no unresolved Critical Uncertainty affecting that scope, downstream purpose, Preservation Policy, Performance Brief, or selected Target Configurations.

The assessment may authorize unaffected passages while blocking others. A target-specific discovery can reopen only the affected scope. Every iteration records the transcription, normalization, analysis, uncertainty set, purpose, and prior assessment it supersedes. The loop is stable when a new analysis introduces no material unresolved source uncertainty for the authorized scope.

### Outcomes

- `authoritative_for_purpose`
- `authoritative_with_disclosed_uncertainty`
- `review_required`
- `best_effort_only`
- `blocked`

The result lists authorized and blocked claims. It is not a global reviewed boolean.

### Consequence model

Uncertainty is evaluated by whether it can change:

- a Preservation Target's pitch, rhythm, order, voice, figure, text, or relationship;
- part, Principal Voice, Continuo Foundation, or imitative voice identity;
- key, meter, repeat, ending, navigation, phrase, cadence, or Performed Form;
- Texture, Contrapuntal Technique, historical profile, or Validation Profile;
- target range, transposition, or feasibility; or
- recognizable identity under the selected policy.

Confidence is evidence, not the decision. High-confidence structural anomalies can require review; low-confidence immaterial readings may remain disclosed but non-blocking.

### Score-Anchored Review

Review must:

- show sufficient page and musical context;
- keep overlays from obscuring the subject;
- provide zoom and accessible navigation;
- show recognized value, alternatives, evidence, and consequence;
- support direct notation correction;
- preserve threshold decisions as batch provenance;
- recover inline from failed corrections;
- resume from the exact outstanding uncertainty; and
- never loop to previously resolved review without new evidence.

## Arrangement Brief and Performance Brief

The Arrangement Brief continues to own requested sources, targets, Notation Layouts, Preservation Policy, and explicit musical instructions.

The Performance Brief adds the intended use and performer demands that make playability and quality meaningful:

```ts
type PerformanceBrief = {
  id: string;
  arrangementBriefId: string;
  intendedUse:
    | "learning"
    | "sight_reading"
    | "prepared_performance"
    | "accompaniment"
    | "study"
    | "edition";
  performerProfile: IntendedPerformerProfile;
  intendedTempo?: TempoRange;
  difficultyIntent: "elementary" | "intermediate" | "advanced" | "unrestricted";
  preparationExpectation?: "immediate" | "practice_expected" | "performance_ready";
  reliabilityGoal?: "possible" | "repeatable" | "performance_reliable";
  allowedTechniques?: string[];
  avoidedTechniques?: string[];
  notationNeeds?: string[];
  ensembleRole?: string;
};
```

Difficulty labels require target-specific definitions and evidence. They are not interchangeable across instruments. Intended Performer Profile describes proficiency and technique familiarity; Owner Ergonomic Profile separately describes personal physical capabilities and preferences. Instrument Instance Configuration owns scale, action, stringing, and tuning.

The same music may produce different valid arrangements for a novice learning context and an expert prepared performance. Evaluation must compare outputs only under compatible Performance Briefs.

## Arrangement Plan

An Arrangement Plan transforms exact reviewed musical understanding into a design for an Arrangement Family.

It records:

- Source Truth Assessment, Normalized Score, and Analysis Record versions;
- Arrangement Brief and Performance Brief versions;
- Preservation Policy;
- formal sections and planning scope;
- Transposition Plan or unresolved choice;
- sectional Texture and density;
- voice, bass, Continuo Foundation, and contrapuntal disposition;
- retained, implied, redistributed, transformed, omitted, and generated material;
- harmonic reduction and inversion priorities;
- cadence, sequence, repetition, climax, repose, and formal-return treatment;
- target-portable decisions and target-local extensions;
- expected compromises and policy consequences;
- alternatives, confidence, and evidence; and
- Owner-confirmation state.

### Proportional plan kinds

Planning must not manufacture bureaucracy. A plan declares one kind:

- `minimal_projection`: retain existing musical structure; search positions, notation, or projection only;
- `sectional_reduction`: reduce voices or density while preserving declared roles and relationships;
- `creative_arrangement`: make material formal, textural, harmonic, or idiomatic design choices;
- `continuo_realization`: realize or reduce a Continuo Foundation under a Realization Profile; or
- `imitative_intabulation`: distribute contrapuntal voices while preserving entries and cadential goals.

A monophonic transcription or literal tablature conversion can use a minimal plan with no artificial alternatives. Materially different plans are required only when the task genuinely admits consequential design alternatives.

### Plan Decisions

Every Plan Decision records:

- musical scope;
- dimension and selected value;
- evidence and rationale;
- viable alternatives;
- confidence and ambiguity;
- target portability;
- policy consequence;
- confirmation requirement; and
- downstream constraint or strategy identities.

The model may propose decisions. It cannot silently correct source truth, approve a Policy Exception, or commit consequential ambiguity.

### Plan lifecycle

- Plan correction creates a new Plan version.
- A new Source Truth Assessment, Analysis Record, Arrangement Brief, or Performance Brief makes dependent Plans stale.
- A target realization can return a Plan Conflict when the plan is infeasible.
- A Plan Conflict may revise a target-local extension, revise the shared plan, change policy, request an exception, or block.
- A Plan Decision governs the current family design; it becomes a Family Commitment only after explicit promotion.
- Existing Arrangement Scores remain preserved as stale derivations after plan change.

### Plan evaluation

Evaluation checks whether:

- every applicable decision was realized, conflicted, or explicitly revised;
- sectional form, Texture, density, voices, harmony, and cadences match the plan;
- target-local compromises did not silently alter shared intent;
- materially different plans produced materially different candidate families; and
- no local fingering score substituted for work-level musical quality.

Subjective judgments remain rubric evidence, not deterministic proof.

## Minimal end-to-end acceptance

One narrow tracer must demonstrate:

1. immutable source input;
2. purpose-scoped Source Truth Assessment;
3. exact Analysis Record;
4. one proportional Arrangement Plan;
5. one compatible Performance Brief;
6. target realization linked to every applicable Plan Decision;
7. correction-induced staleness without mutation; and
8. an Evaluation Case that begins from the source rather than precomputed downstream records.
