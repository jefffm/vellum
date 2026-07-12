# Arrangement Evaluation Harness

Status: Draft subordinate proposal

## Purpose

The harness answers:

1. Did an output violate an authoritative invariant?
2. Did observable or reviewed quality improve, regress, or remain uncertain?
3. Is a difference caused by product code, changed inputs, changed evaluator semantics, intentional design, or incompatibility?

It does not produce one overall grade. Hard failures cannot be averaged away, subjective evidence remains separate, and legitimate musical alternatives remain possible.

## Evaluation case modes

End-to-end and component evaluation are distinct.

```ts
type EndToEndEvaluationCase = {
  mode: "end_to_end";
  id: string;
  version: number;
  sourceArtifact: ContentRef;
  arrangementBrief: ArrangementBriefFixture;
  performanceBrief: PerformanceBriefFixture;
  expectedSourceTruth: ExpectationSet;
  expectedAnalysis: ExpectationSet;
  expectedPlans: ExpectationSet;
  targetExpectations: TargetExpectationSet[];
  mutationRefs: VersionedRef[];
  humanProtocolRef?: VersionedRef;
  provenance: FixtureProvenance;
};

type ComponentEvaluationCase = {
  mode: "component";
  id: string;
  version: number;
  componentUnderTest: ComponentIdentity;
  pinnedInputSnapshots: ContentRef[];
  expectations: ExpectationSet;
  mutationRefs: VersionedRef[];
  provenance: FixtureProvenance;
};
```

An end-to-end case begins with source and briefs. Source Truth Assessment, Analysis Record, Arrangement Plan, searches, scores, and Deliverables are outputs under evaluation. A component case may pin reviewed downstream records to isolate one stage.

Generator-visible inputs exclude evaluator-only expectations, forbidden outcomes, reference answers, baseline outputs, human preference labels, and mutation definitions.

## Authored suite and resolved manifest

The authored suite is convenient versioned configuration:

```ts
type EvaluationSuite = {
  id: string;
  version: number;
  caseRefs: VersionedRef[];
  evaluatorRefs: VersionedRef[];
  comparisonPolicyRef: VersionedRef;
  reportProfileRef: VersionedRef;
};
```

Before execution, Vellum resolves an immutable manifest:

```ts
type ResolvedEvaluationManifest = {
  id: string;
  suiteRef: DigestedRef;
  cases: Array<{
    caseRef: DigestedRef;
    expectationDigests: string[];
    mutationDigests: string[];
    fixtureDigests: string[];
  }>;
  evaluators: DigestedRef[];
  adapters: DigestedRef[];
  profiles: DigestedRef[];
  comparisonPolicyRef: DigestedRef;
  reportProfileRef: DigestedRef;
  humanProtocolRefs: DigestedRef[];
  executionIdentity: ExecutionIdentity;
};
```

Every Evaluation Run points to this manifest. Transitive case, expectation, mutation, evaluator, profile, fixture, and protocol changes therefore cannot alter an old run's meaning.

## Runs and case results

```ts
type EvaluationRun = {
  id: string;
  manifestId: string;
  executionStatus: "running" | "completed" | "cancelled" | "infrastructure_failed";
  caseRunIds: string[];
  startedAt: string;
  completedAt?: string;
};

type EvaluationCaseRun = {
  id: string;
  evaluationRunId: string;
  caseRef: DigestedRef;
  generatedRecordRefs: DigestedRef[];
  deliverableRefs: DigestedRef[];
  dimensionResults: AbsoluteDimensionResult[];
  acceptanceStatus: "pass" | "fail" | "blocked" | "incomplete";
  blockedReason?: EvaluationBlockedReason;
  readiness?: ArrangementReadiness;
  diagnostics: EvaluationDiagnostic[];
};
```

Execution failure, source blocking, incomplete evidence, and hard-gate failure remain separate.

## Absolute results and comparative deltas

An absolute result never contains improved or regressed:

```ts
type AbsoluteDimensionResult = {
  dimensionId: string;
  evaluatorRef: DigestedRef;
  scope: EvaluationScope;
  applicability: "applicable" | "not_applicable";
  execution: "completed" | "failed" | "not_evaluated";
  absoluteOutcome: "pass" | "fail" | "within_range" | "outside_range" | "unknown";
  completeness: EvaluationCompleteness;
  evidenceBasis: EvidenceBasis[];
  authority: EvaluationAuthority;
  permittedPresentation: PermittedPresentation;
  observations: Observation[];
  value?: number | string | boolean;
  units?: string;
  uncertainty?: Uncertainty;
};

type DimensionDelta = {
  dimensionId: string;
  comparability: "comparable" | "changed_semantics" | "incomparable";
  direction: "improved" | "regressed" | "unchanged" | "mixed" | "unknown";
  materiality: "material" | "immaterial" | "undetermined";
  evidenceRefs: DigestedRef[];
  rationale: string;
};
```

Comparison policy defines measurement noise, materiality, uncertainty, minimum evidence, mixed-result handling, and whether a dimension can gate acceptance.

## Baselines

Expected invariants belong to Evaluation Cases. A baseline is only an exact promoted run:

```ts
type EvaluationBaseline = {
  id: string;
  suiteId: string;
  evaluationRunId: string;
  manifestId: string;
  comparisonScope: EvaluationScope;
  knownDefects: KnownDefect[];
  promotedBy: ReviewerIdentity;
  rationale: string;
  promotedAt: string;
};
```

A known-bad current run may be promoted to detect further regression, but its defects remain explicit. Replacing a baseline creates a new record and preserves the old baseline, comparison, reviewer, accepted tradeoffs, and rationale.

## Comparison

Comparison first aligns exact case references and determines manifest compatibility. Cases without compatible identity or an explicit migration mapping are incomparable.

```ts
type EvaluationComparison = {
  id: string;
  baselineId: string;
  proposedRunId: string;
  suiteCompatibility: Compatibility;
  caseAlignment: CaseAlignment[];
  evaluatorCompatibility: Compatibility;
  dimensionDeltas: DimensionDelta[];
  classifications: ComparisonClassification[];
  reviewStatus: "unreviewed" | "accepted" | "changes_requested";
};
```

Classifications:

- hard regression;
- measured regression;
- human-judgment delta;
- improvement;
- intentional difference;
- evaluator change;
- unknown change; or
- incomparable.

`subjective_regression` is not inferred from one preference. Human protocols define the evidence needed for a reviewed comparative conclusion.

## Dimensions and hard gates

Evaluation Cards retain separate families:

- source authority;
- preservation and transformation;
- Arrangement Plan realization;
- mechanical and technique evidence;
- historical and analytical evidence;
- engraving and notation;
- playback and Performed Form;
- workflow and recovery;
- human and physical evidence; and
- explicit Owner usefulness.

Standard hard gates include unauthorized Source Truth, Faithful Reduction failure, incomplete Transformation Report, represented mechanical impossibility, unknown required evaluation shown as passing, hard Plan divergence without conflict, invalid lineage, notation or playback changing canonical music, false infeasibility claims, partial model output mutating canonical state, and trust-boundary failure.

A quality improvement never compensates for a hard failure.

## Expectations

Cases prefer acceptable musical boundaries:

- exact retained events or relationships;
- allowed transformations;
- forbidden omissions or crossings;
- required roles, figures, cadences, voices, or disclosures;
- target-specific mechanical conditions;
- notation and playback semantics;
- expected metric ranges with calibrated materiality; or
- a set of musically equivalent outcomes.

Exact snapshots are limited to identity-sensitive contracts such as serialization, IDs, fixed glyph fragments, and canonical playback events. Reference arrangements are evidence and alternatives, not the only correct solution.

## Evaluation isolation

Fixture evidence has one role per evaluator dataset version:

- calibration or fitting;
- development;
- held-out evaluation; or
- post-deployment monitoring.

Held-out expectations and reference outputs are unavailable to generation, planning, search, prompt construction, and evaluator fitting. Movement between roles creates a new dataset version. Private Owner workspaces never enter a repository suite without deliberate licensed export.

## Mutation evaluation

Mutations deliberately alter Principal Voice, cadence, Continuo Foundation, figures, imitation, instrument positions, baroque-guitar stringing, lute course identity, classical voice duration, Plan Decisions, playback duplication, repeat traversal, artifact handoff, stale validation, or search-outcome truthfulness.

Each authoritative evaluator has mutations it must detect with correct scope and presentation. Mutation success establishes sensitivity to those cases, not universal completeness.

## Render and playback evaluation

Rendered evaluation separates:

1. semantic notation assertions;
2. focused visual regions with declared tolerances; and
3. canonical sounding-event comparison.

Whole-page pixels are supplementary. Audio evaluation compares event identities, pitches, onsets, durations, parts, occurrences, and traversal rather than waveforms unless a stable synthesis contract is explicitly adopted.

Evaluation reports sanitize generated SVG and other active content through the same trust boundary as the workbench. Reports never treat fixture or generated artifacts as trusted HTML.

## Human evaluation

Human protocols are defined in `workbench-playtest-learning.md`. Suites identify required reviewer roles, rubric anchors, minimum evidence, candidate-order balancing, duplicate cases, confidence, disagreement, and adjudication.

One scoped judgment remains one judgment. Owner review establishes personal usefulness. Historical or expert claims require appropriately scoped evidence. Candidate identity is blinded where practical; the specification does not promise impossible full anonymity when notation or style is revealing.

## Model-assisted evaluation

Model judgments are versioned Model Actions. They disclose model, provider, prompt, configuration, candidate order, evidence, uncertainty, and whether the model generated the evaluated output.

Recorded-provider fixtures support deterministic contract tests. Live provider evaluations are dated external evidence: they are re-invocable, not reproducible. They cannot be the sole hard gate for fidelity, history, quality, or physical playability.

## Stochastic evidence

Stochastic suites declare sampling protocol, retained outputs, uncertainty, aggregation, and comparison rules. Individual hard failures are never hidden by aggregation. Deterministic and stochastic gates remain separate.

## Storage and retention

Evaluation records use a store separate from canonical workspace state while retaining typed links.

- Content-addressed artifacts deduplicate identical bytes.
- Promoted baselines and their required evidence are pinned.
- Ordinary runs have an explicit retention class.
- Ephemeral search diagnostics and unpromoted render artifacts may be collected after their retention boundary.
- Deleting a private workspace invalidates or redacts linked private reports according to Owner choice.
- A surviving report cannot retain private bytes after their authorized deletion.
- Repository fixture artifacts remain governed by license provenance.
- Garbage collection never removes bytes required by a pinned baseline without first invalidating that baseline explicitly.

## Commands

```bash
npm run eval:fast
npm run eval:golden
npm run eval:render
npm run eval:playback
npm run eval:omr
npm run eval:model
npm run eval:compare -- --baseline <baseline-id>
npm run eval:report -- --run <run-id>
```

Recorded-provider and retained OMR fixtures test contracts; they are not mislabeled as current live model or OMR quality. Live checks remain explicit opt-in evidence.

Commands emit machine-readable results and fail for infrastructure failure, invalid evaluation data, or suite-defined hard-gate failure. Measured and human-review deltas follow explicit suite policy.

## Continuous integration

The suite-impact map links code, profiles, capabilities, adapters, evaluators, renderers, playback, persistence, and workflows to required suites. Dynamic or unknown impact falls back to broader coverage. The map is itself tested against representative changes and never serves as proof that skipped suites are irrelevant.

Live providers, OMR, specialists, and physical playtests are not hidden CI dependencies. Reports show the date, compatibility, and staleness of their latest reviewed evidence.

## Promotion

A change is promotable only when required deterministic suites complete, hard regressions are resolved or explicitly rejected, evaluator changes are separated from product changes, material measured deltas are reviewed, required human evidence is complete, unknowns remain disclosed, and baseline promotion records reviewer and rationale.

Evaluation cannot commit product code, musical state, defaults, knowledge, or Calibration Candidates.
