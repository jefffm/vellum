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
