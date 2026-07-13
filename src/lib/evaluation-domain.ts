import { Type, type Static } from "@sinclair/typebox";

const Id = Type.String({ minLength: 1 });
const Version = Type.Integer({ minimum: 1 });
const Digest = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoDate = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

export const VersionedRefSchema = Type.Object(
  { id: Id, version: Version },
  { additionalProperties: false }
);
export type VersionedRef = Static<typeof VersionedRefSchema>;

export const DigestedRefSchema = Type.Object(
  { id: Id, version: Version, digest: Digest },
  { additionalProperties: false }
);
export type DigestedRef = Static<typeof DigestedRefSchema>;

export const ContentRefSchema = Type.Object(
  {
    id: Id,
    digest: Digest,
    mediaType: Type.String({ minLength: 1 }),
    byteLength: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false }
);
export type ContentRef = Static<typeof ContentRefSchema>;

export const FixtureProvenanceSchema = Type.Object(
  {
    origin: Type.String({ minLength: 1 }),
    license: Type.String({ minLength: 1 }),
    datasetRole: Type.Union([
      Type.Literal("fitting"),
      Type.Literal("development"),
      Type.Literal("held_out"),
      Type.Literal("monitoring"),
    ]),
    datasetVersion: Version,
  },
  { additionalProperties: false }
);

export const EndToEndEvaluationCaseSchema = Type.Object(
  {
    mode: Type.Literal("end_to_end"),
    id: Id,
    version: Version,
    sourceArtifact: ContentRefSchema,
    arrangementBriefRef: VersionedRefSchema,
    performanceBriefRef: VersionedRefSchema,
    expectedSourceTruthRef: VersionedRefSchema,
    expectedAnalysisRef: VersionedRefSchema,
    expectedPlanRefs: Type.Array(VersionedRefSchema, { minItems: 1 }),
    targetExpectationRefs: Type.Array(VersionedRefSchema, { minItems: 1 }),
    mutationRefs: Type.Array(VersionedRefSchema),
    humanProtocolRef: Type.Optional(VersionedRefSchema),
    provenance: FixtureProvenanceSchema,
  },
  { additionalProperties: false }
);
export type EndToEndEvaluationCase = Static<typeof EndToEndEvaluationCaseSchema>;

export const ComponentEvaluationCaseSchema = Type.Object(
  {
    mode: Type.Literal("component"),
    id: Id,
    version: Version,
    componentUnderTest: Type.String({ minLength: 1 }),
    pinnedInputSnapshots: Type.Array(ContentRefSchema, { minItems: 1 }),
    expectationRefs: Type.Array(VersionedRefSchema, { minItems: 1 }),
    mutationRefs: Type.Array(VersionedRefSchema),
    provenance: FixtureProvenanceSchema,
  },
  { additionalProperties: false }
);
export type ComponentEvaluationCase = Static<typeof ComponentEvaluationCaseSchema>;

export const EvaluationCaseSchema = Type.Union([
  EndToEndEvaluationCaseSchema,
  ComponentEvaluationCaseSchema,
]);
export type EvaluationCase = Static<typeof EvaluationCaseSchema>;

export const EvaluationSuiteSchema = Type.Object(
  {
    id: Id,
    version: Version,
    caseRefs: Type.Array(VersionedRefSchema, { minItems: 1 }),
    evaluatorRefs: Type.Array(VersionedRefSchema, { minItems: 1 }),
    adapterRefs: Type.Array(VersionedRefSchema),
    profileRefs: Type.Array(VersionedRefSchema),
    comparisonPolicyRef: VersionedRefSchema,
    reportProfileRef: VersionedRefSchema,
  },
  { additionalProperties: false }
);
export type EvaluationSuite = Static<typeof EvaluationSuiteSchema>;

export const HumanReviewerRoleSchema = Type.Union([
  Type.Literal("owner_usability"),
  Type.Literal("target_player"),
  Type.Literal("historical_specialist"),
  Type.Literal("editor_engraver"),
  Type.Literal("independent_listener"),
  Type.Literal("other_declared"),
]);
export type HumanReviewerRole = Static<typeof HumanReviewerRoleSchema>;

export const HumanEvidenceDimensionSchema = Type.Union([
  Type.Literal("personal_adoption"),
  Type.Literal("personal_calibration"),
  Type.Literal("physical_execution"),
  Type.Literal("historical_practice"),
  Type.Literal("engraving_notation"),
  Type.Literal("musical_identity"),
  Type.Literal("listening_clarity"),
]);

export const HumanComparisonProtocolSchema = Type.Object(
  {
    requiredRolesByDimension: Type.Array(
      Type.Object(
        {
          dimension: HumanEvidenceDimensionSchema,
          authorizedRoles: Type.Array(HumanReviewerRoleSchema, {
            minItems: 1,
            uniqueItems: true,
          }),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    rubricAnchors: Type.Array(
      Type.Object(
        {
          id: Id,
          dimension: HumanEvidenceDimensionSchema,
          label: Type.String({ minLength: 1 }),
          description: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    minimumJudgmentsForComparativeConclusion: Type.Integer({ minimum: 2 }),
    evidenceBasis: Type.Array(
      Type.Union([
        Type.Literal("notation"),
        Type.Literal("listening"),
        Type.Literal("physical_playing"),
      ]),
      { minItems: 1, uniqueItems: true }
    ),
    ordering: Type.Object(
      {
        method: Type.Literal("randomized_balanced"),
        retainedSeedRequired: Type.Literal(true),
      },
      { additionalProperties: false }
    ),
    blinding: Type.Object(
      {
        candidateIdentity: Type.Literal("blinded_where_practical"),
        implementationIdentity: Type.Literal("blinded_where_practical"),
        limitations: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false }
    ),
    duplicates: Type.Object(
      {
        required: Type.Boolean(),
        minimumCount: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false }
    ),
    confidenceRequired: Type.Literal(true),
    conflictDisclosureRequired: Type.Literal(true),
    disagreement: Type.Object(
      {
        policy: Type.Union([
          Type.Literal("retain_unresolved"),
          Type.Literal("adjudicate_when_threshold_met"),
        ]),
        threshold: Type.Number({ minimum: 0, maximum: 1 }),
      },
      { additionalProperties: false }
    ),
    adjudication: Type.Object(
      {
        requiredRole: HumanReviewerRoleSchema,
        rationaleRequired: Type.Literal(true),
      },
      { additionalProperties: false }
    ),
    privacyAndConsent: Type.Object(
      {
        consentRequired: Type.Literal(true),
        storage: Type.Literal("local_first"),
        retentionPolicy: Type.String({ minLength: 1 }),
        accessPolicy: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
);
export type HumanComparisonProtocol = Static<typeof HumanComparisonProtocolSchema>;

const HumanCandidateContextSchema = Type.Object(
  {
    candidateRef: DigestedRefSchema,
    arrangementSearchRef: DigestedRefSchema,
    performanceBriefRef: DigestedRefSchema,
    instrumentInstanceDigest: Digest,
    candidateEventIds: Type.Array(Id, { minItems: 1 }),
    arrangementScoreEventIds: Type.Array(Id, { minItems: 1 }),
    sourceEventIds: Type.Array(Id, { minItems: 1 }),
    playbackOccurrenceIds: Type.Array(Id, { minItems: 1 }),
  },
  { additionalProperties: false }
);

export const HumanEvaluationSchema = Type.Object(
  {
    id: Id,
    protocolRef: DigestedRefSchema,
    reviewer: Type.Object(
      {
        pseudonymousId: Id,
        role: HumanReviewerRoleSchema,
        qualifications: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
        confidence: Type.Number({ minimum: 0, maximum: 1 }),
        conflictsOfInterest: Type.Array(Type.String({ minLength: 1 })),
        consented: Type.Literal(true),
      },
      { additionalProperties: false }
    ),
    evidenceBasis: Type.Array(
      Type.Union([
        Type.Literal("notation"),
        Type.Literal("listening"),
        Type.Literal("physical_playing"),
      ]),
      { minItems: 1, uniqueItems: true }
    ),
    ownerPlaytestIds: Type.Array(Id),
    pairwise: Type.Object(
      {
        left: HumanCandidateContextSchema,
        right: HumanCandidateContextSchema,
        retainedRandomizationSeed: Type.String({ minLength: 1 }),
        presentedOrder: Type.Union([
          Type.Tuple([Type.Literal("left"), Type.Literal("right")]),
          Type.Tuple([Type.Literal("right"), Type.Literal("left")]),
        ]),
        duplicateAssignmentId: Type.Optional(Id),
        practicalBlindingApplied: Type.Boolean(),
        blindingLimitations: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false }
    ),
    judgments: Type.Array(
      Type.Object(
        {
          dimension: HumanEvidenceDimensionSchema,
          rubricAnchorId: Id,
          preference: Type.Union([
            Type.Literal("left"),
            Type.Literal("right"),
            Type.Literal("tie"),
            Type.Literal("insufficient_evidence"),
          ]),
          rationale: Type.String({ minLength: 1 }),
          citedEvidenceIds: Type.Array(Id),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    conclusion: Type.Object(
      {
        status: Type.Union([
          Type.Literal("single_scoped_judgment"),
          Type.Literal("unresolved"),
          Type.Literal("adjudicated"),
        ]),
        winner: Type.Optional(Type.Union([Type.Literal("left"), Type.Literal("right")])),
        rationale: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false }
    ),
    learningDisposition: Type.Literal("scoped_judgment_only"),
    regressionEligible: Type.Literal(false),
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type HumanEvaluation = Static<typeof HumanEvaluationSchema>;

export const HumanComparisonConclusionSchema = Type.Object(
  {
    id: Id,
    protocolRef: DigestedRefSchema,
    humanEvaluationIds: Type.Array(Id, { minItems: 1, uniqueItems: true }),
    status: Type.Union([
      Type.Literal("insufficient_evidence"),
      Type.Literal("unresolved_disagreement"),
      Type.Literal("concluded"),
      Type.Literal("adjudicated"),
    ]),
    winner: Type.Optional(Type.Union([Type.Literal("left"), Type.Literal("right")])),
    adjudicatorEvaluationId: Type.Optional(Id),
    rationale: Type.String({ minLength: 1 }),
    regressionEligible: Type.Literal(false),
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type HumanComparisonConclusion = Static<typeof HumanComparisonConclusionSchema>;

export const CalibrationDatasetRoleSchema = Type.Union([
  Type.Literal("fitting"),
  Type.Literal("development"),
  Type.Literal("held_out"),
  Type.Literal("monitoring"),
]);

export const ReviewedLearningEvidenceSchema = Type.Object(
  {
    ref: DigestedRefSchema,
    kind: Type.Union([
      Type.Literal("candidate_decision"),
      Type.Literal("owner_playtest"),
      Type.Literal("human_evaluation"),
      Type.Literal("manual_edit_or_repair"),
      Type.Literal("source_or_analysis_correction"),
      Type.Literal("prediction_disagreement"),
      Type.Literal("recurring_choice"),
      Type.Literal("owner_usefulness"),
    ]),
    relation: Type.Union([Type.Literal("supporting"), Type.Literal("conflicting")]),
    datasetRole: CalibrationDatasetRoleSchema,
    evaluatorRef: DigestedRefSchema,
    privateWorkspaceEvidence: Type.Boolean(),
  },
  { additionalProperties: false }
);

export const ReviewedLearningProposalSchema = Type.Object(
  {
    id: Id,
    kind: Type.Union([
      Type.Literal("personal_default"),
      Type.Literal("owner_ergonomic_profile"),
      Type.Literal("knowledge_candidate"),
      Type.Literal("evaluator_calibration"),
      Type.Literal("golden_fixture"),
      Type.Literal("minimal_counterexample"),
    ]),
    targetScope: Type.Array(Id, { minItems: 1 }),
    evidence: Type.Array(ReviewedLearningEvidenceSchema, { minItems: 1 }),
    rationale: Type.String({ minLength: 1 }),
    proposedValue: Type.Unknown(),
    reviewBoundary: Type.Union([
      Type.Literal("owner_personal_default"),
      Type.Literal("owner_ergonomic_profile"),
      Type.Literal("historical_specialist_knowledge"),
      Type.Literal("evaluation_maintainer_calibration"),
      Type.Literal("fixture_maintainer_export"),
    ]),
    status: Type.Literal("proposed"),
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type ReviewedLearningProposal = Static<typeof ReviewedLearningProposalSchema>;

export const ReviewedLearningDecisionSchema = Type.Object(
  {
    id: Id,
    proposalRef: DigestedRefSchema,
    decision: Type.Union([Type.Literal("accepted"), Type.Literal("rejected")]),
    reviewerRole: Type.Union([
      Type.Literal("owner"),
      Type.Literal("historical_specialist"),
      Type.Literal("evaluation_maintainer"),
      Type.Literal("fixture_maintainer"),
    ]),
    rationale: Type.String({ minLength: 1 }),
    outputRef: Type.Optional(DigestedRefSchema),
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type ReviewedLearningDecision = Static<typeof ReviewedLearningDecisionSchema>;

export const EvaluatorDatasetManifestSchema = Type.Object(
  {
    id: Id,
    version: Version,
    evaluatorRef: DigestedRefSchema,
    assignments: Type.Array(
      Type.Object(
        { evidenceRef: DigestedRefSchema, role: CalibrationDatasetRoleSchema },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    supersedesManifestRef: Type.Optional(DigestedRefSchema),
    incompatibleComparisonIds: Type.Array(Id),
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type EvaluatorDatasetManifest = Static<typeof EvaluatorDatasetManifestSchema>;

export const EvaluatorRevisionSchema = Type.Object(
  {
    id: Id,
    version: Version,
    parentEvaluatorRef: DigestedRefSchema,
    datasetManifestRef: DigestedRefSchema,
    fittingInputRefs: Type.Array(DigestedRefSchema, { minItems: 1 }),
    heldOutInputRefs: Type.Array(DigestedRefSchema, { minItems: 1 }),
    targetScope: Type.Array(Id, { minItems: 1 }),
    knownLimitations: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    historicalDisagreementRefs: Type.Array(DigestedRefSchema),
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type EvaluatorRevision = Static<typeof EvaluatorRevisionSchema>;

export const ReviewedLearningOutputCandidateSchema = Type.Object(
  {
    id: Id,
    version: Version,
    proposalId: Id,
    kind: Type.Union([
      Type.Literal("owner_ergonomic_profile"),
      Type.Literal("golden_fixture"),
      Type.Literal("minimal_counterexample"),
    ]),
    payload: Type.Unknown(),
    provenance: Type.Object(
      {
        license: Type.String({ minLength: 1 }),
        sourceEvidenceRefs: Type.Array(DigestedRefSchema, { minItems: 1 }),
        privateExportReviewed: Type.Boolean(),
      },
      { additionalProperties: false }
    ),
    status: Type.Literal("candidate"),
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type ReviewedLearningOutputCandidate = Static<typeof ReviewedLearningOutputCandidateSchema>;

export const ExternalEvaluationEvidenceSchema = Type.Object(
  {
    id: Id,
    kind: Type.Union([Type.Literal("omr"), Type.Literal("model_judge")]),
    mode: Type.Union([Type.Literal("recorded_contract"), Type.Literal("live_current")]),
    reproducibility: Type.Union([
      Type.Literal("deterministic_recorded_fixture"),
      Type.Literal("external_not_reproducible"),
    ]),
    provider: Type.String({ minLength: 1 }),
    modelOrBackend: Type.String({ minLength: 1 }),
    fixtureOrRequestDigest: Digest,
    compatibility: Type.Object(
      {
        productVersion: Type.String({ minLength: 1 }),
        adapterVersion: Type.String({ minLength: 1 }),
        compatible: Type.Boolean(),
        limitations: Type.Array(Type.String({ minLength: 1 })),
      },
      { additionalProperties: false }
    ),
    observedAt: IsoDate,
    staleAfter: Type.Optional(IsoDate),
    result: Type.Unknown(),
  },
  { additionalProperties: false }
);
export type ExternalEvaluationEvidence = Static<typeof ExternalEvaluationEvidenceSchema>;

export const ModelJudgeActionSchema = Type.Object(
  {
    id: Id,
    version: Version,
    provider: Type.String({ minLength: 1 }),
    model: Type.String({ minLength: 1 }),
    prompt: Type.String({ minLength: 1 }),
    configuration: Type.Record(Type.String(), Type.Unknown()),
    candidateOrder: Type.Array(Id, { minItems: 1 }),
    evidenceRefs: Type.Array(DigestedRefSchema, { minItems: 1 }),
    generatorRelationship: Type.Union([
      Type.Literal("independent_judge"),
      Type.Literal("same_model_self_evaluation"),
      Type.Literal("unknown_relationship"),
    ]),
    uncertainty: Type.Object(
      {
        confidence: Type.Number({ minimum: 0, maximum: 1 }),
        limitations: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
      },
      { additionalProperties: false }
    ),
    output: Type.Unknown(),
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type ModelJudgeAction = Static<typeof ModelJudgeActionSchema>;

export const StochasticEvaluationAggregateSchema = Type.Object(
  {
    sampling: Type.Object(
      {
        sampleCount: Type.Integer({ minimum: 1 }),
        temperature: Type.Number({ minimum: 0 }),
        retainedOutputs: Type.Literal(true),
      },
      { additionalProperties: false }
    ),
    samples: Type.Array(
      Type.Object(
        {
          id: Id,
          hardGateStatus: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
          measuredValue: Type.Number(),
          uncertainty: Type.Number({ minimum: 0 }),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    deterministicGateStatus: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
    stochasticStatus: Type.Union([
      Type.Literal("pass"),
      Type.Literal("fail"),
      Type.Literal("inconclusive"),
    ]),
    mean: Type.Number(),
    uncertainty: Type.Number({ minimum: 0 }),
    compatibilityLimitations: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false }
);
export type StochasticEvaluationAggregate = Static<typeof StochasticEvaluationAggregateSchema>;

export const EvaluationDefinitionSchema = Type.Object(
  {
    id: Id,
    version: Version,
    kind: Type.Union([
      Type.Literal("arrangement_brief"),
      Type.Literal("performance_brief"),
      Type.Literal("expectation"),
      Type.Literal("mutation"),
      Type.Literal("evaluator"),
      Type.Literal("adapter"),
      Type.Literal("profile"),
      Type.Literal("comparison_policy"),
      Type.Literal("report_profile"),
      Type.Literal("human_protocol"),
    ]),
    payload: Type.Unknown(),
  },
  { additionalProperties: false }
);
export type EvaluationDefinition = Static<typeof EvaluationDefinitionSchema>;

export const ExecutionIdentitySchema = Type.Object(
  {
    productVersion: Type.String({ minLength: 1 }),
    runtime: Type.String({ minLength: 1 }),
    platform: Type.String({ minLength: 1 }),
    architecture: Type.String({ minLength: 1 }),
    command: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const ResolvedEvaluationManifestSchema = Type.Object(
  {
    id: Id,
    digest: Digest,
    suiteRef: DigestedRefSchema,
    cases: Type.Array(
      Type.Object(
        {
          caseRef: DigestedRefSchema,
          expectationRefs: Type.Array(DigestedRefSchema),
          mutationRefs: Type.Array(DigestedRefSchema),
          fixtureRefs: Type.Array(ContentRefSchema),
          briefRefs: Type.Array(DigestedRefSchema),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    evaluators: Type.Array(DigestedRefSchema, { minItems: 1 }),
    adapters: Type.Array(DigestedRefSchema),
    profiles: Type.Array(DigestedRefSchema),
    comparisonPolicyRef: DigestedRefSchema,
    reportProfileRef: DigestedRefSchema,
    humanProtocolRefs: Type.Array(DigestedRefSchema),
    executionIdentity: ExecutionIdentitySchema,
  },
  { additionalProperties: false }
);
export type ResolvedEvaluationManifest = Static<typeof ResolvedEvaluationManifestSchema>;

export const EvaluationScopeSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("case"),
      Type.Literal("work"),
      Type.Literal("target"),
      Type.Literal("passage"),
      Type.Literal("event"),
    ]),
    ids: Type.Array(Id, { minItems: 1 }),
  },
  { additionalProperties: false }
);
export type EvaluationScope = Static<typeof EvaluationScopeSchema>;

export const AbsoluteDimensionResultSchema = Type.Object(
  {
    dimensionId: Id,
    evaluatorRef: DigestedRefSchema,
    scope: EvaluationScopeSchema,
    applicability: Type.Union([Type.Literal("applicable"), Type.Literal("not_applicable")]),
    execution: Type.Union([
      Type.Literal("completed"),
      Type.Literal("failed"),
      Type.Literal("not_evaluated"),
    ]),
    absoluteOutcome: Type.Union([
      Type.Literal("pass"),
      Type.Literal("fail"),
      Type.Literal("within_range"),
      Type.Literal("outside_range"),
      Type.Literal("unknown"),
    ]),
    completeness: Type.Union([
      Type.Literal("complete"),
      Type.Literal("partial"),
      Type.Literal("missing"),
    ]),
    evidenceBasis: Type.Array(
      Type.Union([
        Type.Literal("deterministic"),
        Type.Literal("recorded_fixture"),
        Type.Literal("external_observation"),
        Type.Literal("human_review"),
        Type.Literal("model_judgment"),
      ])
    ),
    authority: Type.Union([
      Type.Literal("mechanical"),
      Type.Literal("source_review"),
      Type.Literal("owner"),
      Type.Literal("target_player"),
      Type.Literal("specialist"),
      Type.Literal("none"),
    ]),
    permittedPresentation: Type.Union([
      Type.Literal("hard_gate"),
      Type.Literal("measured_evidence"),
      Type.Literal("rubric_evidence"),
      Type.Literal("observation_only"),
      Type.Literal("unknown_only"),
    ]),
    observations: Type.Array(
      Type.Object(
        {
          code: Type.String({ minLength: 1 }),
          message: Type.String({ minLength: 1 }),
          evidenceRefs: Type.Array(DigestedRefSchema),
        },
        { additionalProperties: false }
      )
    ),
    value: Type.Optional(Type.Union([Type.Number(), Type.String(), Type.Boolean()])),
    units: Type.Optional(Type.String({ minLength: 1 })),
    uncertainty: Type.Optional(
      Type.Object(
        { kind: Type.String({ minLength: 1 }), description: Type.String({ minLength: 1 }) },
        { additionalProperties: false }
      )
    ),
  },
  { additionalProperties: false }
);
export type AbsoluteDimensionResult = Static<typeof AbsoluteDimensionResultSchema>;

export const EvaluationDiagnosticSchema = Type.Object(
  {
    severity: Type.Union([Type.Literal("info"), Type.Literal("warning"), Type.Literal("error")]),
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const ArrangementReadinessSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("ready"),
      Type.Literal("blocked"),
      Type.Literal("incomplete"),
    ]),
    evidenceRefs: Type.Array(DigestedRefSchema),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);
export type ArrangementReadiness = Static<typeof ArrangementReadinessSchema>;

export const EvaluationCaseRunSchema = Type.Object(
  {
    id: Id,
    evaluationRunId: Id,
    caseRef: DigestedRefSchema,
    generatedRecordRefs: Type.Array(DigestedRefSchema),
    deliverableRefs: Type.Array(DigestedRefSchema),
    dimensionResults: Type.Array(AbsoluteDimensionResultSchema, { minItems: 1 }),
    readiness: ArrangementReadinessSchema,
    acceptanceStatus: Type.Union([
      Type.Literal("pass"),
      Type.Literal("fail"),
      Type.Literal("blocked"),
      Type.Literal("incomplete"),
    ]),
    blockedReason: Type.Optional(
      Type.Union([
        Type.Literal("source_blocked"),
        Type.Literal("infrastructure_failed"),
        Type.Literal("required_evidence_missing"),
        Type.Literal("hard_gate_failed"),
      ])
    ),
    diagnostics: Type.Array(EvaluationDiagnosticSchema),
  },
  { additionalProperties: false }
);
export type EvaluationCaseRun = Static<typeof EvaluationCaseRunSchema>;

export const EvaluationRunSchema = Type.Object(
  {
    id: Id,
    manifestId: Id,
    executionStatus: Type.Union([
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("cancelled"),
      Type.Literal("infrastructure_failed"),
    ]),
    caseRunIds: Type.Array(Id),
    startedAt: IsoDate,
    completedAt: Type.Optional(IsoDate),
  },
  { additionalProperties: false }
);
export type EvaluationRun = Static<typeof EvaluationRunSchema>;

export const EvaluationCardSchema = Type.Object(
  {
    id: Id,
    evaluationRunId: Id,
    caseRunId: Id,
    hardGateStatus: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
    acceptanceStatus: Type.Union([
      Type.Literal("pass"),
      Type.Literal("fail"),
      Type.Literal("blocked"),
      Type.Literal("incomplete"),
    ]),
    dimensions: Type.Array(AbsoluteDimensionResultSchema, { minItems: 1 }),
    generatedAt: IsoDate,
  },
  { additionalProperties: false }
);
export type EvaluationCard = Static<typeof EvaluationCardSchema>;

export const KnownDefectSchema = Type.Object(
  {
    id: Id,
    dimensionId: Id,
    scope: EvaluationScopeSchema,
    description: Type.String({ minLength: 1 }),
    evidenceRefs: Type.Array(DigestedRefSchema),
    acceptedTradeoff: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);
export type KnownDefect = Static<typeof KnownDefectSchema>;

export const ReviewerIdentitySchema = Type.Object(
  {
    id: Id,
    role: Type.String({ minLength: 1 }),
    displayName: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const EvaluationBaselineSchema = Type.Object(
  {
    id: Id,
    version: Version,
    suiteRef: DigestedRefSchema,
    evaluationRunId: Id,
    manifestId: Id,
    comparisonScope: EvaluationScopeSchema,
    knownDefects: Type.Array(KnownDefectSchema),
    promotedBy: ReviewerIdentitySchema,
    rationale: Type.String({ minLength: 1 }),
    promotedAt: IsoDate,
    supersedesBaselineId: Type.Optional(Id),
  },
  { additionalProperties: false }
);
export type EvaluationBaseline = Static<typeof EvaluationBaselineSchema>;

export const CompatibilitySchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("compatible"),
      Type.Literal("migrated"),
      Type.Literal("changed_semantics"),
      Type.Literal("incomparable"),
    ]),
    rationale: Type.String({ minLength: 1 }),
    migrationRef: Type.Optional(DigestedRefSchema),
  },
  { additionalProperties: false }
);
export type Compatibility = Static<typeof CompatibilitySchema>;

export const CaseAlignmentSchema = Type.Object(
  {
    baselineCaseRef: DigestedRefSchema,
    proposedCaseRef: Type.Optional(DigestedRefSchema),
    compatibility: CompatibilitySchema,
  },
  { additionalProperties: false }
);
export type CaseAlignment = Static<typeof CaseAlignmentSchema>;

export const DimensionDeltaSchema = Type.Object(
  {
    dimensionId: Id,
    comparability: Type.Union([
      Type.Literal("comparable"),
      Type.Literal("changed_semantics"),
      Type.Literal("incomparable"),
    ]),
    direction: Type.Union([
      Type.Literal("improved"),
      Type.Literal("regressed"),
      Type.Literal("unchanged"),
      Type.Literal("mixed"),
      Type.Literal("unknown"),
    ]),
    materiality: Type.Union([
      Type.Literal("material"),
      Type.Literal("immaterial"),
      Type.Literal("undetermined"),
    ]),
    evidenceRefs: Type.Array(DigestedRefSchema),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);
export type DimensionDelta = Static<typeof DimensionDeltaSchema>;

export const EvaluationComparisonSchema = Type.Object(
  {
    id: Id,
    version: Version,
    baselineId: Id,
    proposedRunId: Id,
    baselineManifestId: Id,
    proposedManifestId: Id,
    suiteCompatibility: CompatibilitySchema,
    caseAlignment: Type.Array(CaseAlignmentSchema, { minItems: 1 }),
    evaluatorCompatibility: CompatibilitySchema,
    dimensionDeltas: Type.Array(DimensionDeltaSchema, { minItems: 1 }),
    classifications: Type.Array(
      Type.Union([
        Type.Literal("hard_regression"),
        Type.Literal("measured_regression"),
        Type.Literal("human_judgment_delta"),
        Type.Literal("improvement"),
        Type.Literal("intentional_difference"),
        Type.Literal("evaluator_change"),
        Type.Literal("unknown_change"),
        Type.Literal("incomparable"),
      ]),
      { minItems: 1 }
    ),
    attributions: Type.Array(
      Type.Union([
        Type.Literal("product_code"),
        Type.Literal("changed_inputs"),
        Type.Literal("evaluator_semantics"),
        Type.Literal("intentional_design"),
        Type.Literal("incompatibility"),
        Type.Literal("unknown"),
      ]),
      { minItems: 1 }
    ),
    reviewStatus: Type.Union([
      Type.Literal("unreviewed"),
      Type.Literal("accepted"),
      Type.Literal("changes_requested"),
    ]),
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type EvaluationComparison = Static<typeof EvaluationComparisonSchema>;

export const EvaluationReportSchema = Type.Object(
  {
    id: Id,
    version: Version,
    comparisonId: Id,
    baselineId: Id,
    proposedRunId: Id,
    cardRefs: Type.Array(DigestedRefSchema, { minItems: 1 }),
    musicalScopes: Type.Array(EvaluationScopeSchema, { minItems: 1 }),
    artifactRefs: Type.Array(DigestedRefSchema),
    reviewNeeds: Type.Array(Type.String({ minLength: 1 })),
    sanitizedMarkup: Type.String({ minLength: 1 }),
    sanitizerPolicyVersion: Type.String({ minLength: 1 }),
    generatedAt: IsoDate,
  },
  { additionalProperties: false }
);
export type EvaluationReport = Static<typeof EvaluationReportSchema>;
