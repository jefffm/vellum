import { Static, Type } from "@sinclair/typebox";
import {
  ConstraintSpecificationSchema,
  SearchAttemptConfigurationSchema,
  SearchExecutionIdentitySchema,
  SearchOutcomeSchema,
} from "./constraint-search.js";
import { InstrumentInstanceConfigurationSchema } from "./instrument-instance.js";
import {
  CandidateMeasurementSchema,
  ComparisonMetricDefinitionSchema,
} from "./candidate-comparison.js";

const IdSchema = Type.String({ pattern: "^[a-z0-9][a-z0-9._:-]*$", minLength: 1 });
const IsoDateSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

export const RationalSchema = Type.Object(
  {
    numerator: Type.Integer(),
    denominator: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false }
);

export type Rational = Static<typeof RationalSchema>;

export const SourceRegionSchema = Type.Object(
  {
    coordinateSpace: Type.Optional(
      Type.Union([Type.Literal("source_document"), Type.Literal("omr_raster")])
    ),
    page: Type.Integer({ minimum: 1 }),
    x: Type.Number({ minimum: 0 }),
    y: Type.Number({ minimum: 0 }),
    width: Type.Number({ exclusiveMinimum: 0 }),
    height: Type.Number({ exclusiveMinimum: 0 }),
  },
  { additionalProperties: false }
);

export type SourceRegion = Static<typeof SourceRegionSchema>;

export const SourceProvenanceSchema = Type.Object(
  {
    license: Type.String({ minLength: 1 }),
    sourceUrl: Type.Optional(Type.String({ minLength: 1 })),
    catalogUrl: Type.Optional(Type.String({ minLength: 1 })),
    attribution: Type.Optional(Type.String({ minLength: 1 })),
    notes: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false }
);

export const SourceArtifactSchema = Type.Object(
  {
    id: IdSchema,
    kind: Type.Union([
      Type.Literal("pdf"),
      Type.Literal("image"),
      Type.Literal("musicxml"),
      Type.Literal("lilypond"),
      Type.Literal("abc"),
      Type.Literal("mei"),
      Type.Literal("mscz"),
      Type.Literal("lead_sheet"),
      Type.Literal("tablature"),
      Type.Literal("natural_language"),
    ]),
    filename: Type.String({ minLength: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    byteLength: Type.Integer({ minimum: 1 }),
    storedPath: Type.String({ minLength: 1 }),
    provenance: SourceProvenanceSchema,
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type SourceArtifact = Static<typeof SourceArtifactSchema>;

export const TargetConfigurationSchema = Type.Object(
  {
    id: IdSchema,
    instrumentId: Type.String({ minLength: 1 }),
    role: Type.Union([
      Type.Literal("solo"),
      Type.Literal("accompaniment"),
      Type.Literal("ensemble"),
    ]),
    tuningId: Type.Optional(Type.String({ minLength: 1 })),
    stringing: Type.Optional(Type.String({ minLength: 1 })),
    instrumentInstance: Type.Optional(InstrumentInstanceConfigurationSchema),
    realizationProfileId: Type.Optional(Type.String({ minLength: 1 })),
    continuoTreatment: Type.Optional(
      Type.Union([
        Type.Literal("auto"),
        Type.Literal("complete"),
        Type.Literal("separate_bass"),
        Type.Literal("reduction"),
      ])
    ),
    continuoBassInstrumentId: Type.Optional(Type.String({ minLength: 1 })),
    notationLayouts: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    deliverables: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  },
  { additionalProperties: false }
);

export type TargetConfiguration = Static<typeof TargetConfigurationSchema>;

export const ArrangementBriefSchema = Type.Object(
  {
    targetConfigurations: Type.Array(TargetConfigurationSchema),
    instruction: Type.Optional(Type.String()),
    personalDefaultApplications: Type.Optional(
      Type.Array(
        Type.Object(
          {
            defaultId: IdSchema,
            targetConfigurationId: IdSchema,
            status: Type.Union([Type.Literal("applied"), Type.Literal("yielded")]),
            reason: Type.String({ minLength: 1 }),
          },
          { additionalProperties: false }
        )
      )
    ),
  },
  { additionalProperties: false }
);
export type ArrangementBrief = Static<typeof ArrangementBriefSchema>;

export const ArrangementWorkspaceSchema = Type.Object(
  {
    schemaVersion: Type.Integer({ minimum: 8 }),
    revision: Type.Integer({ minimum: 1 }),
    id: IdSchema,
    title: Type.String({ minLength: 1 }),
    brief: ArrangementBriefSchema,
    sourceArtifactIds: Type.Array(IdSchema),
    omrRunIds: Type.Array(IdSchema),
    scoreTranscriptionIds: Type.Array(IdSchema),
    normalizedScoreIds: Type.Array(IdSchema),
    analysisRecordIds: Type.Array(IdSchema),
    arrangementScoreIds: Type.Array(IdSchema),
    modelActionIds: Type.Array(IdSchema),
    guidedWorkflowIds: Type.Array(IdSchema),
    sourceTruthAssessmentIds: Type.Array(IdSchema),
    performanceBriefIds: Type.Array(IdSchema),
    arrangementPlanIds: Type.Array(IdSchema),
    planConflictIds: Type.Array(IdSchema),
    arrangementBranchIds: Type.Array(IdSchema),
    arrangementSearchIds: Type.Array(IdSchema),
    passageSearchIds: Type.Array(IdSchema),
    ownerPlaytestIds: Type.Array(IdSchema),
    arrangementCandidateIds: Type.Array(IdSchema),
    arrangementFamilyIds: Type.Array(IdSchema),
    deliverableIds: Type.Array(IdSchema),
    staleDerivationIds: Type.Array(IdSchema),
    editorialCommitmentIds: Type.Array(IdSchema),
    familyCommitmentIds: Type.Array(IdSchema),
    commitmentConflictIds: Type.Array(IdSchema),
    policyExceptionIds: Type.Array(IdSchema),
    performanceInterpretationIds: Type.Array(IdSchema),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type ArrangementWorkspace = Static<typeof ArrangementWorkspaceSchema>;

const PerformanceBriefInputProperties = {
  intendedUse: Type.Union([
    Type.Literal("learning"),
    Type.Literal("sight_reading"),
    Type.Literal("prepared_performance"),
    Type.Literal("accompaniment"),
    Type.Literal("study"),
    Type.Literal("edition"),
  ]),
  performerProfile: Type.Object(
    {
      proficiency: Type.Union([
        Type.Literal("elementary"),
        Type.Literal("intermediate"),
        Type.Literal("advanced"),
        Type.Literal("expert"),
      ]),
      assumptionSource: Type.Union([
        Type.Literal("guided_start_default_pending_owner_review"),
        Type.Literal("owner_declared"),
      ]),
      techniqueFamiliarity: Type.Array(Type.String({ minLength: 1 })),
    },
    { additionalProperties: false }
  ),
  tempoContext: Type.Union([
    Type.Object({ status: Type.Literal("not_specified") }, { additionalProperties: false }),
    Type.Object(
      {
        status: Type.Literal("specified"),
        minimumBpm: Type.Integer({ minimum: 1 }),
        maximumBpm: Type.Integer({ minimum: 1 }),
      },
      { additionalProperties: false }
    ),
  ]),
  difficultyIntent: Type.Union([
    Type.Literal("elementary"),
    Type.Literal("intermediate"),
    Type.Literal("advanced"),
    Type.Literal("unrestricted"),
  ]),
  preparationExpectation: Type.Union([
    Type.Literal("immediate"),
    Type.Literal("practice_expected"),
    Type.Literal("performance_ready"),
  ]),
  reliabilityGoal: Type.Union([
    Type.Literal("possible"),
    Type.Literal("repeatable"),
    Type.Literal("performance_reliable"),
  ]),
  techniqueContext: Type.Union([
    Type.Object({ status: Type.Literal("unspecified") }, { additionalProperties: false }),
    Type.Object(
      {
        status: Type.Literal("specified"),
        allowed: Type.Array(Type.String({ minLength: 1 })),
        avoided: Type.Array(Type.String({ minLength: 1 })),
      },
      { additionalProperties: false }
    ),
  ]),
  notationContext: Type.Object(
    {
      needs: Type.Array(Type.String({ minLength: 1 })),
      ensembleRole: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false }
  ),
};

export const PerformanceBriefInputSchema = Type.Object(PerformanceBriefInputProperties, {
  additionalProperties: false,
});
export type PerformanceBriefInput = Static<typeof PerformanceBriefInputSchema>;

export const GuidedWorkflowTargetSchema = Type.Object(
  {
    targetConfigurationId: IdSchema,
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("searching"),
      Type.Literal("projecting"),
      Type.Literal("complete"),
      Type.Literal("failed"),
    ]),
    arrangementSearchId: Type.Optional(IdSchema),
    arrangementScoreId: Type.Optional(IdSchema),
    arrangementScoreVersion: Type.Optional(Type.Integer({ minimum: 1 })),
    deliverableIds: Type.Array(IdSchema),
    errorCode: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false }
);

export const GuidedWorkflowSchema = Type.Object(
  {
    id: IdSchema,
    workspaceId: IdSchema,
    status: Type.Union([
      Type.Literal("active"),
      Type.Literal("interrupted"),
      Type.Literal("complete"),
      Type.Literal("cancelled"),
    ]),
    stage: Type.Union([
      Type.Literal("source_saved"),
      Type.Literal("recognizing"),
      Type.Literal("transcription_review"),
      Type.Literal("analysis_review"),
      Type.Literal("target_search"),
      Type.Literal("projection"),
      Type.Literal("complete"),
    ]),
    sourceArtifactId: IdSchema,
    optical: Type.Boolean(),
    ocrAutoAcceptConfidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    preservationPolicy: Type.Union([
      Type.Literal("faithful_reduction"),
      Type.Literal("idiomatic_adaptation"),
      Type.Literal("free_paraphrase"),
    ]),
    performanceBrief: Type.Optional(PerformanceBriefInputSchema),
    omrRunId: Type.Optional(IdSchema),
    scoreTranscriptionId: Type.Optional(IdSchema),
    scoreTranscriptionVersion: Type.Optional(Type.Integer({ minimum: 1 })),
    normalizedScoreId: Type.Optional(IdSchema),
    normalizedScoreVersion: Type.Optional(Type.Integer({ minimum: 1 })),
    analysisRecordId: Type.Optional(IdSchema),
    analysisRecordVersion: Type.Optional(Type.Integer({ minimum: 1 })),
    targets: Type.Array(GuidedWorkflowTargetSchema, { minItems: 1 }),
    resumeCount: Type.Integer({ minimum: 0 }),
    failureCode: Type.Optional(Type.String({ minLength: 1 })),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type GuidedWorkflow = Static<typeof GuidedWorkflowSchema>;

export const SourceTruthScopeSchema = Type.Object(
  {
    kind: Type.Union([Type.Literal("whole_score"), Type.Literal("passage")]),
    partIds: Type.Array(IdSchema),
    measureIds: Type.Array(IdSchema),
    eventIds: Type.Array(IdSchema),
  },
  { additionalProperties: false }
);
export type SourceTruthScope = Static<typeof SourceTruthScopeSchema>;

export const SourceTruthConsequenceSchema = Type.Object(
  {
    uncertaintyId: IdSchema,
    discoveredBy: Type.Union([Type.Literal("transcription"), Type.Literal("analysis")]),
    dimensions: Type.Array(
      Type.Union([
        Type.Literal("pitch"),
        Type.Literal("rhythm"),
        Type.Literal("order"),
        Type.Literal("voice"),
        Type.Literal("figure"),
        Type.Literal("text"),
        Type.Literal("relationship"),
        Type.Literal("identity"),
        Type.Literal("key_meter_form"),
        Type.Literal("texture_technique_profile"),
        Type.Literal("target_feasibility"),
        Type.Literal("recognizable_identity"),
      ]),
      { minItems: 1 }
    ),
    affectedPartIds: Type.Array(IdSchema),
    affectedMeasureIds: Type.Array(IdSchema),
    affectedEventIds: Type.Array(IdSchema),
    affectedTargetConfigurationIds: Type.Array(IdSchema),
    critical: Type.Boolean(),
    material: Type.Boolean(),
    unresolved: Type.Boolean(),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);
export type SourceTruthConsequence = Static<typeof SourceTruthConsequenceSchema>;

export const SourceTruthAssessmentSchema = Type.Object(
  {
    id: IdSchema,
    sourceArtifactId: IdSchema,
    scoreTranscriptionId: IdSchema,
    scoreTranscriptionVersion: Type.Integer({ minimum: 1 }),
    normalizedScoreId: IdSchema,
    normalizedScoreVersion: Type.Integer({ minimum: 1 }),
    analysisRecordId: IdSchema,
    analysisRecordVersion: Type.Integer({ minimum: 1 }),
    purpose: Type.Literal("arrangement_planning"),
    scope: SourceTruthScopeSchema,
    preservationPolicy: Type.Union([
      Type.Literal("faithful_reduction"),
      Type.Literal("idiomatic_adaptation"),
      Type.Literal("free_paraphrase"),
    ]),
    performanceBriefId: Type.Optional(IdSchema),
    targetConfigurationIds: Type.Array(IdSchema, { minItems: 1 }),
    outcome: Type.Union([
      Type.Literal("authoritative_for_purpose"),
      Type.Literal("authoritative_with_disclosed_uncertainty"),
      Type.Literal("review_required"),
      Type.Literal("best_effort_only"),
      Type.Literal("blocked"),
    ]),
    authorizedClaimIds: Type.Array(IdSchema),
    blockedClaimIds: Type.Array(IdSchema),
    consideredUncertaintyIds: Type.Array(IdSchema),
    unresolvedUncertaintyIds: Type.Array(IdSchema),
    blockingUncertaintyIds: Type.Array(IdSchema),
    consequences: Type.Array(SourceTruthConsequenceSchema),
    stability: Type.Object(
      {
        iteration: Type.Integer({ minimum: 1 }),
        newMaterialUncertaintyIds: Type.Array(IdSchema),
        stable: Type.Boolean(),
      },
      { additionalProperties: false }
    ),
    supersedesAssessmentId: Type.Optional(IdSchema),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);
export type SourceTruthAssessment = Static<typeof SourceTruthAssessmentSchema>;

export const PerformanceBriefSchema = Type.Object(
  {
    id: IdSchema,
    arrangementBriefRevision: Type.Integer({ minimum: 1 }),
    arrangementBriefDigest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    arrangementBriefSnapshot: ArrangementBriefSchema,
    targetConfigurationId: IdSchema,
    difficultyContext: Type.Object(
      {
        targetConfigurationId: IdSchema,
        definitionId: IdSchema,
        evidenceIds: Type.Array(IdSchema, { minItems: 1 }),
      },
      { additionalProperties: false }
    ),
    ...PerformanceBriefInputProperties,
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);
export type PerformanceBrief = Static<typeof PerformanceBriefSchema>;

export const PlanDecisionSchema = Type.Object(
  {
    id: IdSchema,
    familyDecisionKey: Type.Optional(IdSchema),
    scope: Type.Object(
      {
        kind: Type.Union([
          Type.Literal("whole_score"),
          Type.Literal("section"),
          Type.Literal("passage"),
        ]),
        sectionIds: Type.Array(IdSchema),
        passageIds: Type.Array(IdSchema),
        measureIds: Type.Array(IdSchema),
        eventIds: Type.Array(IdSchema),
      },
      { additionalProperties: false }
    ),
    dimension: Type.String({ minLength: 1 }),
    selectedValue: Type.String({ minLength: 1 }),
    rationale: Type.String({ minLength: 1 }),
    evidenceIds: Type.Array(IdSchema, { minItems: 1 }),
    alternatives: Type.Array(
      Type.Object(
        {
          value: Type.String({ minLength: 1 }),
          consequence: Type.String({ minLength: 1 }),
          viable: Type.Boolean(),
        },
        { additionalProperties: false }
      )
    ),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    ambiguity: Type.Union([
      Type.Object({ status: Type.Literal("none") }, { additionalProperties: false }),
      Type.Object(
        { status: Type.Literal("material"), description: Type.String({ minLength: 1 }) },
        { additionalProperties: false }
      ),
    ]),
    targetConfigurationIds: Type.Array(IdSchema, { minItems: 1 }),
    portability: Type.Union([Type.Literal("target_portable"), Type.Literal("target_local")]),
    policyConsequence: Type.Object(
      {
        preservationPolicy: Type.Union([
          Type.Literal("faithful_reduction"),
          Type.Literal("idiomatic_adaptation"),
          Type.Literal("free_paraphrase"),
        ]),
        expectedCompromise: Type.Optional(Type.String({ minLength: 1 })),
        requiresPolicyException: Type.Boolean(),
      },
      { additionalProperties: false }
    ),
    confirmation: Type.Union([
      Type.Object(
        { requirement: Type.Literal("not_required"), status: Type.Literal("not_required") },
        { additionalProperties: false }
      ),
      Type.Object(
        {
          requirement: Type.Literal("owner"),
          status: Type.Union([Type.Literal("proposed"), Type.Literal("confirmed")]),
          confirmedAt: Type.Optional(IsoDateSchema),
        },
        { additionalProperties: false }
      ),
    ]),
    downstreamConstraintIds: Type.Array(IdSchema),
    downstreamStrategyIds: Type.Array(IdSchema),
  },
  { additionalProperties: false }
);
export type PlanDecision = Static<typeof PlanDecisionSchema>;

export const PhraseObligationSchema = Type.Object(
  {
    passageId: IdSchema,
    targetVoices: Type.Array(
      Type.Object(
        {
          id: IdSchema,
          sourceVoiceId: IdSchema,
          sourcePartId: IdSchema,
          role: Type.Union([
            Type.Literal("principal_voice"),
            Type.Literal("bass"),
            Type.Literal("subordinate"),
          ]),
          sourceEventIds: Type.Array(IdSchema, { minItems: 1 }),
          phraseIds: Type.Array(IdSchema),
          restEventIds: Type.Array(IdSchema),
          continuity: Type.Union([Type.Literal("required"), Type.Literal("advisory")]),
          omissionPolicy: Type.Union([
            Type.Literal("forbidden"),
            Type.Literal("explicit_transformation_only"),
          ]),
          allowedTransformations: Type.Array(
            Type.Union([
              Type.Literal("uniform_transposition"),
              Type.Literal("octave_relocation"),
              Type.Literal("rhythmic_simplification"),
            ])
          ),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    harmonicPlan: Type.Object(
      {
        bassVoiceId: Type.Optional(IdSchema),
        cadenceGoalEventIds: Type.Array(IdSchema),
        preserveSourceBassFunction: Type.Boolean(),
      },
      { additionalProperties: false }
    ),
    relationshipPlan: Type.Array(
      Type.Object(
        {
          id: IdSchema,
          kind: Type.Union([
            Type.Literal("phrase_contour"),
            Type.Literal("cadential_goal"),
            Type.Literal("voice_continuity"),
          ]),
          sourceTargetId: Type.Optional(IdSchema),
          sourceEventGroups: Type.Array(Type.Array(IdSchema, { minItems: 1 }), { minItems: 1 }),
          required: Type.Boolean(),
        },
        { additionalProperties: false }
      )
    ),
  },
  { additionalProperties: false }
);
export type PhraseObligation = Static<typeof PhraseObligationSchema>;

export const ArrangementPlanSchema = Type.Object(
  {
    id: IdSchema,
    version: Type.Integer({ minimum: 1 }),
    supersedesPlanId: Type.Optional(IdSchema),
    kind: Type.Union([
      Type.Literal("minimal_projection"),
      Type.Literal("sectional_reduction"),
      Type.Literal("creative_arrangement"),
      Type.Literal("continuo_realization"),
      Type.Literal("imitative_intabulation"),
    ]),
    sourceTruthAssessmentId: IdSchema,
    normalizedScoreId: IdSchema,
    normalizedScoreVersion: Type.Integer({ minimum: 1 }),
    analysisRecordId: IdSchema,
    analysisRecordVersion: Type.Integer({ minimum: 1 }),
    arrangementBriefRevision: Type.Integer({ minimum: 1 }),
    arrangementBriefDigest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    performanceBriefId: IdSchema,
    targetConfigurationId: IdSchema,
    preservationPolicy: Type.Union([
      Type.Literal("faithful_reduction"),
      Type.Literal("idiomatic_adaptation"),
      Type.Literal("free_paraphrase"),
    ]),
    planningScope: Type.Object(
      {
        sectionIds: Type.Array(IdSchema),
        passageIds: Type.Array(IdSchema, { minItems: 1 }),
        declaredOverlapPassageIds: Type.Array(IdSchema),
      },
      { additionalProperties: false }
    ),
    phraseObligations: Type.Optional(Type.Array(PhraseObligationSchema, { minItems: 1 })),
    transpositionPlan: Type.Union([
      Type.Object(
        { status: Type.Literal("resolved"), semitones: Type.Integer(), rationale: Type.String() },
        { additionalProperties: false }
      ),
      Type.Object(
        {
          status: Type.Literal("unresolved"),
          alternatives: Type.Array(Type.Integer(), { minItems: 2 }),
        },
        { additionalProperties: false }
      ),
    ]),
    sectionalIntent: Type.Array(
      Type.Object(
        {
          passageId: IdSchema,
          texture: Type.String({ minLength: 1 }),
          density: Type.Union([
            Type.Literal("retain"),
            Type.Literal("reduce"),
            Type.Literal("expand"),
          ]),
          voiceDisposition: Type.String({ minLength: 1 }),
          bassDisposition: Type.String({ minLength: 1 }),
          contrapuntalDisposition: Type.String({ minLength: 1 }),
          harmonicPriority: Type.String({ minLength: 1 }),
          formalFunctionTreatment: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    materialDisposition: Type.Array(
      Type.Object(
        {
          sourceObjectIds: Type.Array(IdSchema, { minItems: 1 }),
          disposition: Type.Union([
            Type.Literal("retained"),
            Type.Literal("implied"),
            Type.Literal("redistributed"),
            Type.Literal("transformed"),
            Type.Literal("omitted"),
            Type.Literal("generated"),
          ]),
          rationale: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    specialistIntent: Type.Union([
      Type.Object({ kind: Type.Literal("none") }, { additionalProperties: false }),
      Type.Object(
        {
          kind: Type.Literal("creative_arrangement"),
          formalDesign: Type.String({ minLength: 1 }),
          texturalDesign: Type.String({ minLength: 1 }),
          harmonicDesign: Type.String({ minLength: 1 }),
          idiomaticDesign: Type.String({ minLength: 1 }),
          generatedMaterialDecisionIds: Type.Array(IdSchema, { minItems: 1 }),
          candidateStrategies: Type.Array(
            Type.Union([
              Type.Literal("ornamented-paraphrase"),
              Type.Literal("idiomatic-revoicing"),
            ]),
            { minItems: 1 }
          ),
        },
        { additionalProperties: false }
      ),
      Type.Object(
        {
          kind: Type.Literal("continuo_realization"),
          realizationProfileId: IdSchema,
          foundationDisposition: Type.Union([
            Type.Literal("complete"),
            Type.Literal("separate_bass"),
            Type.Literal("reduced"),
          ]),
          figureTreatment: Type.String({ minLength: 1 }),
          voiceLeadingPriority: Type.String({ minLength: 1 }),
          foundationTargetIds: Type.Array(IdSchema, { minItems: 1 }),
          candidateStrategies: Type.Array(
            Type.Union([
              Type.Literal("complete-realization"),
              Type.Literal("lean-realization"),
              Type.Literal("separate-bass-realization"),
              Type.Literal("continuo-reduction"),
            ]),
            { minItems: 1 }
          ),
        },
        { additionalProperties: false }
      ),
      Type.Object(
        {
          kind: Type.Literal("imitative_intabulation"),
          voiceDistribution: Type.String({ minLength: 1 }),
          overlapPolicy: Type.String({ minLength: 1 }),
          entryTargetIds: Type.Array(IdSchema, { minItems: 1 }),
          cadenceTargetIds: Type.Array(IdSchema, { minItems: 1 }),
          candidateStrategies: Type.Array(
            Type.Union([Type.Literal("low-fret-polyphony"), Type.Literal("voice-continuity")]),
            { minItems: 1 }
          ),
        },
        { additionalProperties: false }
      ),
    ]),
    decisions: Type.Array(PlanDecisionSchema, { minItems: 1 }),
    status: Type.Union([
      Type.Literal("ready"),
      Type.Literal("confirmation_required"),
      Type.Literal("blocked_by_unresolved_transposition"),
    ]),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);
export type ArrangementPlan = Static<typeof ArrangementPlanSchema>;

export const PlanConflictSchema = Type.Object(
  {
    id: IdSchema,
    arrangementPlanId: IdSchema,
    targetConfigurationId: IdSchema,
    scope: PlanDecisionSchema.properties.scope,
    conflictingDecisionIds: Type.Array(IdSchema, { minItems: 1 }),
    reasonCode: Type.String({ minLength: 1 }),
    consequence: Type.String({ minLength: 1 }),
    evidenceIds: Type.Array(IdSchema, { minItems: 1 }),
    resolutionOptions: Type.Array(
      Type.Union([
        Type.Literal("revise_target_local_extension"),
        Type.Literal("revise_shared_plan"),
        Type.Literal("change_policy"),
        Type.Literal("request_policy_exception"),
        Type.Literal("block"),
      ]),
      { minItems: 1 }
    ),
    status: Type.Union([
      Type.Literal("unresolved"),
      Type.Literal("resolution_selected"),
      Type.Literal("resolved"),
    ]),
    selectedResolution: Type.Optional(
      Type.Union([
        Type.Literal("revise_target_local_extension"),
        Type.Literal("revise_shared_plan"),
        Type.Literal("change_policy"),
        Type.Literal("request_policy_exception"),
        Type.Literal("block"),
      ])
    ),
    createdAt: IsoDateSchema,
    resolvedAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);
export type PlanConflict = Static<typeof PlanConflictSchema>;

export const CreateWorkspaceSchema = Type.Object(
  {
    title: Type.String({ minLength: 1 }),
    brief: Type.Optional(ArrangementBriefSchema),
  },
  { additionalProperties: false }
);

export type CreateWorkspace = Static<typeof CreateWorkspaceSchema>;

export const ArrangementFamilySchema = Type.Object(
  {
    id: IdSchema,
    normalizedScoreId: IdSchema,
    analysisRecordId: IdSchema,
    brief: ArrangementBriefSchema,
    arrangementScoreIds: Type.Array(IdSchema),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type ArrangementFamily = Static<typeof ArrangementFamilySchema>;

export const DeliverableSchema = Type.Object(
  {
    id: IdSchema,
    arrangementScoreId: IdSchema,
    arrangementScoreVersion: Type.Integer({ minimum: 1 }),
    notationLayout: Type.String({ minLength: 1 }),
    kind: Type.Union([
      Type.Literal("browser_preview"),
      Type.Literal("pdf"),
      Type.Literal("midi"),
      Type.Literal("lilypond"),
      Type.Literal("musicxml"),
      Type.Literal("audio_preview"),
    ]),
    mimeType: Type.String({ minLength: 1 }),
    artifactPolicyVersion: Type.Optional(Type.String({ minLength: 1 })),
    sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    byteLength: Type.Integer({ minimum: 0 }),
    storedPath: Type.String({ minLength: 1 }),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type Deliverable = Static<typeof DeliverableSchema>;

export const CommitmentScopeSchema = Type.Object(
  {
    objectIds: Type.Array(IdSchema, { minItems: 1 }),
    measureIds: Type.Optional(Type.Array(IdSchema)),
    dimension: Type.Union([
      Type.Literal("principal_voice_pitch"),
      Type.Literal("rhythm"),
      Type.Literal("harmony"),
      Type.Literal("bass"),
      Type.Literal("texture"),
      Type.Literal("counterpoint"),
      Type.Literal("ornament"),
      Type.Literal("notation"),
      Type.Literal("course_fingering"),
    ]),
  },
  { additionalProperties: false }
);

export const EditorialCommitmentSchema = Type.Object(
  {
    id: IdSchema,
    arrangementScoreId: IdSchema,
    arrangementFamilyId: IdSchema,
    scope: CommitmentScopeSchema,
    value: Type.Unknown(),
    origin: Type.Union([Type.Literal("user_edit"), Type.Literal("approved_model_choice")]),
    status: Type.Union([Type.Literal("active"), Type.Literal("released")]),
    createdAt: IsoDateSchema,
    releasedAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);
export type EditorialCommitment = Static<typeof EditorialCommitmentSchema>;

export const FamilyCommitmentSchema = Type.Object(
  {
    id: IdSchema,
    version: Type.Integer({ minimum: 1 }),
    arrangementFamilyId: IdSchema,
    sourceCommitmentId: Type.Optional(IdSchema),
    sourcePlanDecisionId: Type.Optional(IdSchema),
    sourceArrangementScoreId: IdSchema,
    scope: CommitmentScopeSchema,
    value: Type.Unknown(),
    targetConfigurationIds: Type.Array(IdSchema, { minItems: 1 }),
    status: Type.Union([Type.Literal("active"), Type.Literal("released")]),
    createdAt: IsoDateSchema,
    releasedAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);
export type FamilyCommitment = Static<typeof FamilyCommitmentSchema>;

const LineageInputVersionSchema = Type.Object(
  {
    recordType: Type.String({ minLength: 1 }),
    recordId: IdSchema,
    version: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false }
);

export const StaleDerivationSchema = Type.Object(
  {
    id: IdSchema,
    recordType: Type.Union([
      Type.Literal("arrangement_plan"),
      Type.Literal("arrangement_search"),
      Type.Literal("arrangement_candidate"),
      Type.Literal("arrangement_score"),
      Type.Literal("deliverable"),
    ]),
    recordId: IdSchema,
    reason: Type.String({ minLength: 1 }),
    priorInputVersions: Type.Array(LineageInputVersionSchema, { minItems: 1 }),
    currentInputVersions: Type.Array(LineageInputVersionSchema, { minItems: 1 }),
    changedObjectIds: Type.Optional(Type.Array(IdSchema)),
    acknowledged: Type.Boolean(),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);
export type StaleDerivation = Static<typeof StaleDerivationSchema>;

export const CommitmentConflictSchema = Type.Object(
  {
    id: IdSchema,
    arrangementScoreId: IdSchema,
    commitmentId: IdSchema,
    scope: CommitmentScopeSchema,
    conflictingObjectIds: Type.Array(IdSchema, { minItems: 1 }),
    affectedPreservationTargetIds: Type.Array(IdSchema),
    consequence: Type.String({ minLength: 1 }),
    status: Type.Union([
      Type.Literal("unresolved"),
      Type.Literal("commitment_released"),
      Type.Literal("source_revised"),
      Type.Literal("exception_approved"),
    ]),
    createdAt: IsoDateSchema,
    resolvedAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);
export type CommitmentConflict = Static<typeof CommitmentConflictSchema>;

export const PolicyExceptionSchema = Type.Object(
  {
    id: IdSchema,
    arrangementScoreId: IdSchema,
    conflictId: IdSchema,
    scope: CommitmentScopeSchema,
    affectedPreservationTargetIds: Type.Array(IdSchema, { minItems: 1 }),
    musicalConsequence: Type.String({ minLength: 1 }),
    rationale: Type.String({ minLength: 1 }),
    severity: Type.Union([Type.Literal("localized"), Type.Literal("critical")]),
    ownerApproved: Type.Literal(true),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);
export type PolicyException = Static<typeof PolicyExceptionSchema>;

export const ModelActionInputVersionSchema = Type.Object(
  {
    recordType: Type.String({ minLength: 1 }),
    recordId: IdSchema,
    version: Type.Integer({ minimum: 1 }),
    sha256: Type.Optional(Type.String({ pattern: "^[a-f0-9]{64}$" })),
  },
  { additionalProperties: false }
);

const ModelActionDigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const ModelEgressDisclosureSchema = Type.Object(
  {
    id: IdSchema,
    actionId: IdSchema,
    attemptId: IdSchema,
    provider: Type.Literal("openai-codex"),
    model: Type.Literal("gpt-5.3-codex"),
    purpose: Type.Literal("interactive_musicological_guidance"),
    policyDigest: ModelActionDigestSchema,
    systemPromptDigest: ModelActionDigestSchema,
    serializedRequestDigest: ModelActionDigestSchema,
    ownerIntent: Type.String({ minLength: 1 }),
    ownerIntentDigest: ModelActionDigestSchema,
    dataClasses: Type.Array(
      Type.Union([
        Type.Literal("owner_intent"),
        Type.Literal("canonical_workspace_record"),
        Type.Literal("source_content"),
        Type.Literal("private_owner_knowledge"),
      ]),
      { minItems: 1, uniqueItems: true }
    ),
    sourceReferences: Type.Array(ModelActionInputVersionSchema, { uniqueItems: true }),
    toolCapabilities: Type.Array(Type.String({ minLength: 1 }), { maxItems: 0 }),
    policyDecision: Type.Union([Type.Literal("allow"), Type.Literal("deny")]),
    policyReason: Type.String({ minLength: 1 }),
    requiresOwnerAuthorization: Type.Literal(true),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const ModelEgressAccessDecisionSchema = Type.Object(
  {
    id: IdSchema,
    disclosureDigest: ModelActionDigestSchema,
    decision: Type.Union([
      Type.Literal("authorize"),
      Type.Literal("deny"),
      Type.Literal("withdraw"),
    ]),
    effectiveDecision: Type.Union([Type.Literal("authorized"), Type.Literal("denied")]),
    decidedAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const ModelEgressEnvelopeSchema = Type.Object(
  {
    id: IdSchema,
    actionId: IdSchema,
    attemptId: IdSchema,
    disclosureDigest: ModelActionDigestSchema,
    accessDecisionId: IdSchema,
    provider: Type.Literal("openai-codex"),
    model: Type.Literal("gpt-5.3-codex"),
    purpose: Type.Literal("interactive_musicological_guidance"),
    policyDigest: ModelActionDigestSchema,
    systemPromptDigest: ModelActionDigestSchema,
    serializedRequestDigest: ModelActionDigestSchema,
    ownerIntentDigest: ModelActionDigestSchema,
    requestCreatedAt: IsoDateSchema,
    systemPrompt: Type.String({ minLength: 1 }),
    ownerIntent: Type.String({ minLength: 1 }),
    inputVersions: Type.Array(ModelActionInputVersionSchema),
    toolCapabilities: Type.Array(Type.String({ minLength: 1 }), { maxItems: 0 }),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const ModelActionCanonicalResultSchema = Type.Object(
  {
    id: IdSchema,
    actionId: IdSchema,
    attemptId: IdSchema,
    envelopeDigest: ModelActionDigestSchema,
    providerResponseId: IdSchema,
    content: Type.String({ minLength: 1 }),
    provider: Type.Literal("openai-codex"),
    model: Type.Literal("gpt-5.3-codex"),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const ModelActionResultCommitSchema = Type.Object(
  {
    id: IdSchema,
    actionId: IdSchema,
    attemptId: IdSchema,
    envelopeDigest: ModelActionDigestSchema,
    responseDigest: ModelActionDigestSchema,
    toolResultDigests: Type.Array(ModelActionDigestSchema, { maxItems: 0 }),
    validationDigest: ModelActionDigestSchema,
    canonicalResultDigest: ModelActionDigestSchema,
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const ModelActionPublicationSchema = Type.Object(
  {
    id: IdSchema,
    actionId: IdSchema,
    attemptId: IdSchema,
    result: ModelActionCanonicalResultSchema,
    commit: ModelActionResultCommitSchema,
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const ModelActionAttemptSchema = Type.Object(
  {
    id: IdSchema,
    number: Type.Integer({ minimum: 1 }),
    mode: Type.Union([
      Type.Literal("initial"),
      Type.Literal("current_version"),
      Type.Literal("original_snapshot_branch"),
    ]),
    status: Type.Union([
      Type.Literal("awaiting_authorization"),
      Type.Literal("authorized"),
      Type.Literal("running"),
      Type.Literal("denied"),
      Type.Literal("interrupted"),
      Type.Literal("completed"),
      Type.Literal("cancelled"),
    ]),
    inputVersions: Type.Array(ModelActionInputVersionSchema),
    inputDifferenceSummary: Type.Optional(Type.String({ minLength: 1 })),
    arrangementBranchId: Type.Optional(IdSchema),
    completedLocalToolResults: Type.Array(
      Type.Object(
        {
          toolName: Type.String({ minLength: 1 }),
          resultReference: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false }
      )
    ),
    partialProgressSummary: Type.Optional(Type.String({ minLength: 1 })),
    diagnosticPartialOutput: Type.Optional(Type.String({ minLength: 1 })),
    interruptionReason: Type.Optional(Type.String({ minLength: 1 })),
    lastConfirmedBoundary: Type.String({ minLength: 1 }),
    canonicalResultReference: Type.Optional(Type.String({ minLength: 1 })),
    disclosure: Type.Optional(ModelEgressDisclosureSchema),
    disclosureDigest: Type.Optional(ModelActionDigestSchema),
    accessDecision: Type.Optional(ModelEgressAccessDecisionSchema),
    egressEnvelope: Type.Optional(ModelEgressEnvelopeSchema),
    envelopeDigest: Type.Optional(ModelActionDigestSchema),
    publicationReference: Type.Optional(IdSchema),
    startedAt: IsoDateSchema,
    finishedAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);

export const ModelActionSchema = Type.Object(
  {
    id: IdSchema,
    kind: Type.String({ minLength: 1 }),
    intent: Type.String({ minLength: 1 }),
    idempotencyKey: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    status: Type.Union([
      Type.Literal("awaiting_authorization"),
      Type.Literal("authorized"),
      Type.Literal("running"),
      Type.Literal("denied"),
      Type.Literal("interrupted"),
      Type.Literal("completed"),
      Type.Literal("cancelled"),
    ]),
    originalInputVersions: Type.Array(ModelActionInputVersionSchema),
    attempts: Type.Array(ModelActionAttemptSchema, { minItems: 1 }),
    publicationReference: Type.Optional(IdSchema),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type ModelActionInputVersion = Static<typeof ModelActionInputVersionSchema>;
export type ModelEgressDisclosure = Static<typeof ModelEgressDisclosureSchema>;
export type ModelEgressAccessDecision = Static<typeof ModelEgressAccessDecisionSchema>;
export type ModelEgressEnvelope = Static<typeof ModelEgressEnvelopeSchema>;
export type ModelActionCanonicalResult = Static<typeof ModelActionCanonicalResultSchema>;
export type ModelActionResultCommit = Static<typeof ModelActionResultCommitSchema>;
export type ModelActionPublication = Static<typeof ModelActionPublicationSchema>;
export type ModelActionAttempt = Static<typeof ModelActionAttemptSchema>;
export type ModelAction = Static<typeof ModelActionSchema>;

export const ArrangementBranchSchema = Type.Object(
  {
    id: IdSchema,
    label: Type.String({ minLength: 1 }),
    rationale: Type.Optional(Type.String({ minLength: 1 })),
    rootInputVersions: Type.Array(ModelActionInputVersionSchema, { minItems: 1 }),
    createdByModelActionId: Type.Optional(IdSchema),
    createdByAttemptId: Type.Optional(IdSchema),
    createdFromCandidateId: Type.Optional(IdSchema),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type ArrangementBranch = Static<typeof ArrangementBranchSchema>;

export const UploadSourceArtifactSchema = Type.Object(
  {
    filename: Type.String({ minLength: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    contentBase64: Type.String({ minLength: 1 }),
    provenance: SourceProvenanceSchema,
  },
  { additionalProperties: false }
);

export type UploadSourceArtifact = Static<typeof UploadSourceArtifactSchema>;

export const OmrBackendRecordSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    version: Type.String({ minLength: 1 }),
    configuration: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false }
);

export const OmrDiagnosticSchema = Type.Object(
  {
    severity: Type.Union([Type.Literal("info"), Type.Literal("warning"), Type.Literal("error")]),
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    region: Type.Optional(SourceRegionSchema),
  },
  { additionalProperties: false }
);

export const OmrPageMappingSchema = Type.Object(
  {
    sourcePage: Type.Integer({ minimum: 1 }),
    recognizedPage: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false }
);

export const OmrRunSchema = Type.Object(
  {
    id: IdSchema,
    sourceArtifactId: IdSchema,
    backend: OmrBackendRecordSchema,
    status: Type.Union([
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("failed"),
    ]),
    nativeArtifactPaths: Type.Array(Type.String({ minLength: 1 })),
    interchangeArtifactPaths: Type.Array(Type.String({ minLength: 1 })),
    pageMappings: Type.Array(OmrPageMappingSchema),
    diagnostics: Type.Array(OmrDiagnosticSchema),
    logPath: Type.Optional(Type.String({ minLength: 1 })),
    createdAt: IsoDateSchema,
    completedAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);

export type OmrRun = Static<typeof OmrRunSchema>;

export const ScorePartSchema = Type.Object(
  {
    id: IdSchema,
    name: Type.String({ minLength: 1 }),
    role: Type.Optional(
      Type.Union([
        Type.Literal("soprano"),
        Type.Literal("alto"),
        Type.Literal("tenor"),
        Type.Literal("bass"),
        Type.Literal("principal_voice"),
        Type.Literal("continuo_foundation"),
        Type.Literal("harmony"),
        Type.Literal("other"),
      ])
    ),
  },
  { additionalProperties: false }
);

export type ScorePart = Static<typeof ScorePartSchema>;

export const ScoreMeasureSchema = Type.Object(
  {
    id: IdSchema,
    index: Type.Integer({ minimum: 0 }),
    displayNumber: Type.String({ minLength: 1 }),
    duration: RationalSchema,
  },
  { additionalProperties: false }
);

export type ScoreMeasure = Static<typeof ScoreMeasureSchema>;

const ScoreEventBaseProperties = {
  id: IdSchema,
  partId: IdSchema,
  measureId: IdSchema,
  onset: RationalSchema,
  duration: RationalSchema,
  confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  sourceRegion: Type.Optional(SourceRegionSchema),
  rhythmicNotation: Type.Optional(
    Type.Object(
      {
        writtenDuration: RationalSchema,
        dots: Type.Integer({ minimum: 0, maximum: 3 }),
        tuplet: Type.Optional(
          Type.Object(
            {
              groupId: IdSchema,
              actualNotes: Type.Integer({ minimum: 2 }),
              normalNotes: Type.Integer({ minimum: 1 }),
              boundary: Type.Union([
                Type.Literal("start"),
                Type.Literal("continue"),
                Type.Literal("stop"),
                Type.Literal("start_stop"),
              ]),
            },
            { additionalProperties: false }
          )
        ),
      },
      { additionalProperties: false }
    )
  ),
};

export const NoteEventSchema = Type.Object(
  {
    ...ScoreEventBaseProperties,
    type: Type.Literal("note"),
    pitch: Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" }),
    tie: Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("stop")])),
    tablature: Type.Optional(
      Type.Object(
        {
          course: Type.Integer({ minimum: 1 }),
          fret: Type.Integer({ minimum: 0 }),
          notation: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false }
      )
    ),
  },
  { additionalProperties: false }
);

export const RestEventSchema = Type.Object(
  {
    ...ScoreEventBaseProperties,
    type: Type.Literal("rest"),
  },
  { additionalProperties: false }
);

export const FiguredBassTokenSchema = Type.Object(
  {
    interval: Type.Integer({ minimum: 2, maximum: 13 }),
    accidental: Type.Optional(
      Type.Union([Type.Literal("#"), Type.Literal("b"), Type.Literal("natural")])
    ),
  },
  { additionalProperties: false }
);

export const FiguredBassEventSchema = Type.Object(
  {
    ...ScoreEventBaseProperties,
    type: Type.Literal("figured_bass"),
    bassEventId: IdSchema,
    figures: Type.Array(FiguredBassTokenSchema, { minItems: 1 }),
  },
  { additionalProperties: false }
);

export const ChordSymbolEventSchema = Type.Object(
  {
    ...ScoreEventBaseProperties,
    type: Type.Literal("chord_symbol"),
    symbol: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const ScoreEventSchema = Type.Union([
  NoteEventSchema,
  RestEventSchema,
  FiguredBassEventSchema,
  ChordSymbolEventSchema,
]);

export type ScoreEvent = Static<typeof ScoreEventSchema>;

export const NotationIssueSchema = Type.Object(
  {
    id: IdSchema,
    severity: Type.Union([Type.Literal("warning"), Type.Literal("error")]),
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    measureIds: Type.Array(IdSchema, { minItems: 1 }),
    eventIds: Type.Array(IdSchema),
  },
  { additionalProperties: false }
);
export type NotationIssue = Static<typeof NotationIssueSchema>;

export const TranscriptionUncertaintySchema = Type.Object(
  {
    id: IdSchema,
    eventIds: Type.Array(IdSchema),
    critical: Type.Boolean(),
    category: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    alternatives: Type.Array(Type.String({ minLength: 1 })),
    region: Type.Optional(SourceRegionSchema),
    resolved: Type.Boolean(),
  },
  { additionalProperties: false }
);

export type TranscriptionUncertainty = Static<typeof TranscriptionUncertaintySchema>;

export const TranscriptionCorrectionRecordSchema = Type.Object(
  {
    correctionId: Type.Optional(IdSchema),
    uncertaintyId: IdSchema,
    eventIds: Type.Array(IdSchema, { minItems: 1 }),
    rationale: Type.String({ minLength: 1 }),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export const TranscriptionAcceptanceBatchSchema = Type.Object(
  {
    id: IdSchema,
    policy: Type.Literal("ocr_confidence_threshold"),
    threshold: Type.Number({ minimum: 0, maximum: 1 }),
    scope: Type.Literal("noncritical_pitch_recognition"),
    omrRunId: IdSchema,
    backendId: Type.String({ minLength: 1 }),
    backendVersion: Type.String({ minLength: 1 }),
    accepted: Type.Array(
      Type.Object(
        {
          uncertaintyId: IdSchema,
          eventIds: Type.Array(IdSchema, { minItems: 1 }),
          minimumConfidence: Type.Number({ minimum: 0, maximum: 1 }),
        },
        { additionalProperties: false }
      )
    ),
    notAccepted: Type.Array(
      Type.Object(
        {
          uncertaintyId: IdSchema,
          eventIds: Type.Array(IdSchema),
          reason: Type.Union([
            Type.Literal("critical"),
            Type.Literal("below_threshold"),
            Type.Literal("missing_confidence"),
            Type.Literal("not_pitch_recognition"),
          ]),
        },
        { additionalProperties: false }
      )
    ),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type TranscriptionAcceptanceBatch = Static<typeof TranscriptionAcceptanceBatchSchema>;

export const PerformedMeasureOccurrenceSchema = Type.Object(
  {
    id: IdSchema,
    measureId: IdSchema,
    iteration: Type.Integer({ minimum: 1 }),
    repeatIteration: Type.Optional(Type.Integer({ minimum: 1 })),
    ending: Type.Optional(Type.Integer({ minimum: 1 })),
    jump: Type.Optional(
      Type.Union([
        Type.Literal("da_capo"),
        Type.Literal("dal_segno"),
        Type.Literal("to_coda"),
        Type.Literal("fine"),
      ])
    ),
  },
  { additionalProperties: false }
);

export const PerformedFormSchema = Type.Object(
  {
    id: IdSchema,
    measureOccurrences: Type.Array(PerformedMeasureOccurrenceSchema, { minItems: 1 }),
    traversalDecisions: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false }
);

export const ScoreTranscriptionSchema = Type.Object(
  {
    id: IdSchema,
    sourceArtifactId: IdSchema,
    omrRunId: Type.Optional(IdSchema),
    ingestion: Type.Optional(
      Type.Object(
        {
          method: Type.Union([
            Type.Literal("optical_recognition"),
            Type.Literal("deterministic_parse"),
            Type.Literal("interchange_conversion"),
            Type.Literal("best_effort"),
          ]),
          sourceFormat: Type.String({ minLength: 1 }),
          diagnostics: Type.Array(
            Type.Object(
              {
                severity: Type.Union([
                  Type.Literal("info"),
                  Type.Literal("warning"),
                  Type.Literal("error"),
                ]),
                code: Type.String({ minLength: 1 }),
                message: Type.String({ minLength: 1 }),
              },
              { additionalProperties: false }
            )
          ),
        },
        { additionalProperties: false }
      )
    ),
    version: Type.Integer({ minimum: 1 }),
    parentId: Type.Optional(IdSchema),
    status: Type.Union([
      Type.Literal("needs_review"),
      Type.Literal("reviewed"),
      Type.Literal("best_effort"),
    ]),
    title: Type.Optional(Type.String({ minLength: 1 })),
    key: Type.Optional(Type.String({ minLength: 1 })),
    timeSignature: Type.Optional(Type.String({ pattern: "^\\d+/\\d+$" })),
    parts: Type.Array(ScorePartSchema, { minItems: 1 }),
    measures: Type.Array(ScoreMeasureSchema, { minItems: 1 }),
    events: Type.Array(ScoreEventSchema, { minItems: 1 }),
    performedForm: Type.Optional(PerformedFormSchema),
    notationIssues: Type.Optional(Type.Array(NotationIssueSchema)),
    uncertainties: Type.Array(TranscriptionUncertaintySchema),
    corrections: Type.Optional(Type.Array(TranscriptionCorrectionRecordSchema)),
    acceptanceBatches: Type.Optional(Type.Array(TranscriptionAcceptanceBatchSchema)),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type ScoreTranscription = Static<typeof ScoreTranscriptionSchema>;

export const RecognizedScoreSchema = Type.Object(
  {
    title: Type.Optional(Type.String({ minLength: 1 })),
    key: Type.Optional(Type.String({ minLength: 1 })),
    timeSignature: Type.Optional(Type.String({ pattern: "^\\d+/\\d+$" })),
    parts: Type.Array(ScorePartSchema, { minItems: 1 }),
    measures: Type.Array(ScoreMeasureSchema, { minItems: 1 }),
    events: Type.Array(ScoreEventSchema, { minItems: 1 }),
    performedForm: Type.Optional(PerformedFormSchema),
    notationIssues: Type.Optional(Type.Array(NotationIssueSchema)),
    uncertainties: Type.Array(TranscriptionUncertaintySchema),
  },
  { additionalProperties: false }
);

export type RecognizedScore = Static<typeof RecognizedScoreSchema>;

export const TranscriptionEventEditSchema = Type.Object(
  {
    eventId: IdSchema,
    pitch: Type.Optional(Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" })),
    partId: Type.Optional(IdSchema),
    partName: Type.Optional(Type.String({ minLength: 1 })),
    partRole: Type.Optional(
      Type.Union([
        Type.Literal("soprano"),
        Type.Literal("alto"),
        Type.Literal("tenor"),
        Type.Literal("bass"),
        Type.Literal("principal_voice"),
        Type.Literal("continuo_foundation"),
        Type.Literal("harmony"),
        Type.Literal("other"),
      ])
    ),
  },
  { additionalProperties: false }
);

export const TranscriptionCorrectionSchema = Type.Object(
  {
    correctionId: Type.Optional(IdSchema),
    uncertaintyId: IdSchema,
    eventEdits: Type.Array(TranscriptionEventEditSchema, { minItems: 1 }),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export type TranscriptionCorrection = Static<typeof TranscriptionCorrectionSchema>;

export const NormalizedScoreSchema = Type.Object(
  {
    id: IdSchema,
    scoreTranscriptionId: IdSchema,
    version: Type.Integer({ minimum: 1 }),
    title: Type.Optional(Type.String({ minLength: 1 })),
    key: Type.Optional(Type.String({ minLength: 1 })),
    timeSignature: Type.Optional(Type.String({ pattern: "^\\d+/\\d+$" })),
    parts: Type.Array(ScorePartSchema, { minItems: 1 }),
    measures: Type.Array(ScoreMeasureSchema, { minItems: 1 }),
    events: Type.Array(ScoreEventSchema, { minItems: 1 }),
    performedForm: Type.Optional(PerformedFormSchema),
    notationIssues: Type.Optional(Type.Array(NotationIssueSchema)),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type NormalizedScore = Static<typeof NormalizedScoreSchema>;

export const PreservationTargetSchema = Type.Object(
  {
    id: IdSchema,
    kind: Type.Union([
      Type.Literal("principal_voice"),
      Type.Literal("continuo_foundation"),
      Type.Literal("voice"),
      Type.Literal("relationship"),
    ]),
    partId: Type.Optional(IdSchema),
    eventIds: Type.Array(IdSchema),
    relationshipType: Type.Optional(
      Type.Union([
        Type.Literal("principal_sequence"),
        Type.Literal("phrase_contour"),
        Type.Literal("ordered_entries"),
        Type.Literal("cadential_goal"),
        Type.Literal("prepared_suspension"),
      ])
    ),
    eventGroups: Type.Optional(Type.Array(Type.Array(IdSchema, { minItems: 1 }), { minItems: 1 })),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export type PreservationTarget = Static<typeof PreservationTargetSchema>;

export const AnalysisClaimSchema = Type.Object(
  {
    id: IdSchema,
    kind: Type.String({ minLength: 1 }),
    subjectIds: Type.Array(IdSchema),
    statement: Type.String({ minLength: 1 }),
    basis: Type.Union([
      Type.Literal("observation"),
      Type.Literal("inference"),
      Type.Literal("user_correction"),
    ]),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    scope: Type.Optional(
      Type.Object(
        {
          measureIds: Type.Array(IdSchema),
          eventIds: Type.Array(IdSchema),
        },
        { additionalProperties: false }
      )
    ),
    evidence: Type.Optional(
      Type.Array(
        Type.Object(
          {
            kind: Type.Union([
              Type.Literal("score_observation"),
              Type.Literal("source_metadata"),
              Type.Literal("historical_profile"),
              Type.Literal("owner_correction"),
            ]),
            sourceIds: Type.Array(IdSchema),
            explanation: Type.String({ minLength: 1 }),
          },
          { additionalProperties: false }
        ),
        { minItems: 1 }
      )
    ),
    alternatives: Type.Optional(
      Type.Array(
        Type.Object(
          {
            id: IdSchema,
            statement: Type.String({ minLength: 1 }),
            subjectIds: Type.Optional(Type.Array(IdSchema, { minItems: 1 })),
            confidence: Type.Number({ minimum: 0, maximum: 1 }),
            arrangementConsequence: Type.String({ minLength: 1 }),
          },
          { additionalProperties: false }
        )
      )
    ),
    correctedClaimId: Type.Optional(IdSchema),
  },
  { additionalProperties: false }
);

export type AnalysisClaim = Static<typeof AnalysisClaimSchema>;

export const PassageAnalysisSchema = Type.Object(
  {
    id: IdSchema,
    measureIds: Type.Array(IdSchema, { minItems: 1 }),
    eventIds: Type.Array(IdSchema),
    texture: Type.String({ minLength: 1 }),
    contrapuntalTechniques: Type.Array(Type.String({ minLength: 1 })),
    claimIds: Type.Array(IdSchema),
    boundaries: Type.Object(
      {
        startReason: Type.String({ minLength: 1 }),
        endReason: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false }
    ),
    roles: Type.Array(
      Type.Object(
        {
          partId: IdSchema,
          role: Type.Union([
            Type.Literal("principal_voice"),
            Type.Literal("continuo_foundation"),
            Type.Literal("bass"),
            Type.Literal("imitative_voice"),
            Type.Literal("accompaniment"),
          ]),
          evidenceEventIds: Type.Array(IdSchema, { minItems: 1 }),
        },
        { additionalProperties: false }
      )
    ),
    phrases: Type.Array(
      Type.Object(
        {
          id: IdSchema,
          partId: IdSchema,
          eventIds: Type.Array(IdSchema, { minItems: 1 }),
        },
        { additionalProperties: false }
      )
    ),
    cadences: Type.Array(
      Type.Object(
        {
          id: IdSchema,
          kind: Type.Union([Type.Literal("sectional_goal"), Type.Literal("final_goal")]),
          measureId: IdSchema,
          goalEventIds: Type.Array(IdSchema, { minItems: 1 }),
          confidence: Type.Number({ minimum: 0, maximum: 1 }),
        },
        { additionalProperties: false }
      )
    ),
  },
  { additionalProperties: false }
);

export const AnalysisProfileSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    label: Type.String({ minLength: 1 }),
    status: Type.Union([Type.Literal("selected"), Type.Literal("alternative")]),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    scope: Type.Object(
      {
        period: Type.String({ minLength: 1 }),
        region: Type.String({ minLength: 1 }),
        genre: Type.String({ minLength: 1 }),
        instruments: Type.Array(Type.String({ minLength: 1 })),
        ensembleRole: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false }
    ),
    evidenceClaimIds: Type.Array(IdSchema),
    arrangementConsequence: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const AnalysisAmbiguitySchema = Type.Object(
  {
    id: IdSchema,
    claimId: IdSchema,
    critical: Type.Boolean(),
    question: Type.String({ minLength: 1 }),
    alternativeIds: Type.Array(IdSchema, { minItems: 1 }),
    resolution: Type.Optional(Type.String({ minLength: 1 })),
    sourceUncertaintyIds: Type.Optional(Type.Array(IdSchema, { minItems: 1 })),
    affectedEventIds: Type.Optional(Type.Array(IdSchema)),
    affectedTargetConfigurationIds: Type.Optional(Type.Array(IdSchema)),
    consequenceDimensions: Type.Optional(
      Type.Array(
        Type.Union([
          Type.Literal("pitch"),
          Type.Literal("rhythm"),
          Type.Literal("order"),
          Type.Literal("voice"),
          Type.Literal("figure"),
          Type.Literal("text"),
          Type.Literal("relationship"),
          Type.Literal("identity"),
          Type.Literal("key_meter_form"),
          Type.Literal("texture_technique_profile"),
          Type.Literal("target_feasibility"),
          Type.Literal("recognizable_identity"),
        ]),
        { minItems: 1 }
      )
    ),
  },
  { additionalProperties: false }
);

export const SourceVoiceGraphSchema = Type.Object(
  {
    voices: Type.Array(
      Type.Object(
        {
          id: IdSchema,
          partId: IdSchema,
          notationCarrierPartId: IdSchema,
          identityBasis: Type.Literal("event_continuity_within_notation_carrier"),
          eventIds: Type.Array(IdSchema, { minItems: 1 }),
          restEventIds: Type.Array(IdSchema),
          activitySpans: Type.Array(
            Type.Object(
              {
                id: IdSchema,
                passageId: IdSchema,
                phraseId: IdSchema,
                eventIds: Type.Array(IdSchema, { minItems: 1 }),
              },
              { additionalProperties: false }
            )
          ),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    identityIndependentOfPitchHeight: Type.Literal(true),
    identityIndependentOfNotationCarrier: Type.Literal(true),
  },
  { additionalProperties: false }
);
export type SourceVoiceGraph = Static<typeof SourceVoiceGraphSchema>;

export const AnalysisRecordSchema = Type.Object(
  {
    id: IdSchema,
    normalizedScoreId: IdSchema,
    version: Type.Integer({ minimum: 1 }),
    texture: Type.String({ minLength: 1 }),
    principalVoicePartId: Type.Optional(IdSchema),
    validationProfileId: Type.Optional(Type.String({ minLength: 1 })),
    contrapuntalTechniques: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    summary: Type.Optional(Type.String({ minLength: 1 })),
    sourceVoiceGraph: Type.Optional(SourceVoiceGraphSchema),
    passages: Type.Optional(Type.Array(PassageAnalysisSchema, { minItems: 1 })),
    profiles: Type.Optional(Type.Array(AnalysisProfileSchema)),
    ambiguities: Type.Optional(Type.Array(AnalysisAmbiguitySchema)),
    claims: Type.Array(AnalysisClaimSchema),
    preservationTargets: Type.Array(PreservationTargetSchema, { minItems: 1 }),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type AnalysisRecord = Static<typeof AnalysisRecordSchema>;

export const ArrangementPositionSchema = Type.Object(
  {
    course: Type.Integer({ minimum: 1 }),
    fret: Type.Integer({ minimum: 0 }),
    pitch: Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" }),
    quality: Type.Union([
      Type.Literal("open"),
      Type.Literal("low_fret"),
      Type.Literal("high_fret"),
      Type.Literal("diapason"),
    ]),
    leftHandFinger: Type.Optional(Type.Integer({ minimum: 1, maximum: 4 })),
    handPosition: Type.Optional(Type.Integer({ minimum: 1, maximum: 19 })),
    barreId: Type.Optional(IdSchema),
    guideFromPreviousEventId: Type.Optional(IdSchema),
    sustainThroughEventId: Type.Optional(IdSchema),
  },
  { additionalProperties: false }
);

export type ArrangementPosition = Static<typeof ArrangementPositionSchema>;

export const ArrangementEventSchema = Type.Object(
  {
    id: IdSchema,
    type: Type.Union([Type.Literal("note"), Type.Literal("chord"), Type.Literal("rest")]),
    measureId: IdSchema,
    onset: RationalSchema,
    duration: RationalSchema,
    pitches: Type.Array(Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" })),
    positions: Type.Array(ArrangementPositionSchema),
    sourceEventIds: Type.Array(IdSchema),
    principalVoiceSourceEventId: Type.Optional(IdSchema),
    role: Type.Optional(
      Type.Union([
        Type.Literal("principal_voice"),
        Type.Literal("continuo_foundation"),
        Type.Literal("realization"),
        Type.Literal("accompaniment"),
        Type.Literal("source_voice"),
      ])
    ),
    voiceId: Type.Optional(IdSchema),
    instrumentId: Type.Optional(Type.String({ minLength: 1 })),
    baroqueGuitarGesture: Type.Optional(
      Type.Object(
        {
          technique: Type.Union([
            Type.Literal("punteado"),
            Type.Literal("rasgueado"),
            Type.Literal("alfabeto"),
          ]),
          attackCourses: Type.Array(Type.Integer({ minimum: 1, maximum: 5 }), {
            minItems: 1,
            maxItems: 5,
          }),
          contiguousAttack: Type.Boolean(),
          soundingPitches: Type.Array(Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" }), {
            minItems: 1,
          }),
          rightHandFingers: Type.Array(
            Type.Object(
              {
                course: Type.Integer({ minimum: 1, maximum: 5 }),
                finger: Type.Union([
                  Type.Literal("p"),
                  Type.Literal("i"),
                  Type.Literal("m"),
                  Type.Literal("a"),
                ]),
              },
              { additionalProperties: false }
            )
          ),
          strokeDirection: Type.Optional(Type.Union([Type.Literal("down"), Type.Literal("up")])),
          notationAttack: Type.Union([Type.Literal("simultaneous"), Type.Literal("successive")]),
          appliedKnowledge: Type.Optional(
            Type.Object(
              {
                packId: IdSchema,
                version: Type.Integer({ minimum: 1 }),
                authorityLane: Type.Union([
                  Type.Literal("software_heuristic"),
                  Type.Literal("historical_practice"),
                ]),
                citationLocator: Type.String({ minLength: 1 }),
              },
              { additionalProperties: false }
            )
          ),
          alfabeto: Type.Optional(
            Type.Object(
              {
                symbol: Type.String({ minLength: 1 }),
                chordName: Type.String({ minLength: 1 }),
                shapeFrets: Type.Tuple([
                  Type.Integer({ minimum: 0 }),
                  Type.Integer({ minimum: 0 }),
                  Type.Integer({ minimum: 0 }),
                  Type.Integer({ minimum: 0 }),
                  Type.Integer({ minimum: 0 }),
                ]),
                historicalClaimId: IdSchema,
                citationLocator: Type.String({ minLength: 1 }),
              },
              { additionalProperties: false }
            )
          ),
        },
        { additionalProperties: false }
      )
    ),
    baroqueLuteGesture: Type.Optional(
      Type.Object(
        {
          stoppedReachMillimeters: Type.Number({ minimum: 0 }),
          maximumStoppedReachMillimeters: Type.Number({ exclusiveMinimum: 0 }),
          rightHandAssignments: Type.Array(
            Type.Object(
              {
                course: Type.Integer({ minimum: 1, maximum: 13 }),
                finger: Type.Union([Type.Literal("p"), Type.Literal("i"), Type.Literal("m")]),
              },
              { additionalProperties: false }
            ),
            { minItems: 1 }
          ),
          notationIdentities: Type.Array(
            Type.Object(
              {
                course: Type.Integer({ minimum: 1, maximum: 13 }),
                identity: Type.String({ minLength: 1 }),
              },
              { additionalProperties: false }
            ),
            { minItems: 1 }
          ),
          course13IdentityStatus: Type.Union([
            Type.Literal("unresolved"),
            Type.Literal("configured"),
          ]),
          allocationBasis: Type.Literal("instrument_profile_mechanics"),
        },
        { additionalProperties: false }
      )
    ),
    classicalGuitarGesture: Type.Optional(
      Type.Object(
        {
          rightHandAssignments: Type.Array(
            Type.Object(
              {
                course: Type.Integer({ minimum: 1, maximum: 6 }),
                finger: Type.Union([
                  Type.Literal("p"),
                  Type.Literal("i"),
                  Type.Literal("m"),
                  Type.Literal("a"),
                ]),
                voiceId: IdSchema,
                voiceRole: Type.Union([Type.Literal("principal_voice"), Type.Literal("bass")]),
              },
              { additionalProperties: false }
            ),
            { minItems: 1 }
          ),
          attackCourses: Type.Array(Type.Integer({ minimum: 1, maximum: 6 }), {
            minItems: 1,
          }),
          heldCourses: Type.Array(Type.Integer({ minimum: 1, maximum: 6 })),
          allocationBasis: Type.Literal("independent_voice_mechanics"),
        },
        { additionalProperties: false }
      )
    ),
    notationSemantics: Type.Optional(
      Type.Object(
        {
          voiceId: IdSchema,
          voiceLayer: Type.Integer({ minimum: 1, maximum: 4 }),
          stemDirection: Type.Union([Type.Literal("up"), Type.Literal("down")]),
          writtenPitches: Type.Array(Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" })),
          soundingPitches: Type.Array(Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" })),
          writtenToSoundingSemitones: Type.Integer({ minimum: -24, maximum: 24 }),
          duration: RationalSchema,
          tie: Type.Union([Type.Literal("none"), Type.Literal("start"), Type.Literal("stop")]),
        },
        { additionalProperties: false }
      )
    ),
    voiceConstituents: Type.Optional(
      Type.Array(
        Type.Object(
          {
            id: IdSchema,
            sourceEventId: IdSchema,
            voiceId: IdSchema,
            role: Type.Union([Type.Literal("principal_voice"), Type.Literal("source_voice")]),
            pitch: Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" }),
            position: ArrangementPositionSchema,
            onset: RationalSchema,
            duration: RationalSchema,
            voiceLayer: Type.Integer({ minimum: 1, maximum: 4 }),
            stemDirection: Type.Union([Type.Literal("up"), Type.Literal("down")]),
            writtenPitch: Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" }),
            writtenToSoundingSemitones: Type.Integer({ minimum: -24, maximum: 24 }),
            tie: Type.Union([Type.Literal("none"), Type.Literal("start"), Type.Literal("stop")]),
          },
          { additionalProperties: false }
        ),
        { minItems: 1 }
      )
    ),
  },
  { additionalProperties: false }
);

export type ArrangementEvent = Static<typeof ArrangementEventSchema>;

export const TransformationEntrySchema = Type.Object(
  {
    id: Type.Optional(IdSchema),
    entryType: Type.Optional(Type.Union([Type.Literal("event"), Type.Literal("relationship")])),
    sourceEventId: Type.Optional(IdSchema),
    sourceEventIds: Type.Optional(Type.Array(IdSchema)),
    sourceRelationshipId: Type.Optional(IdSchema),
    preservationTargetIds: Type.Optional(Type.Array(IdSchema)),
    relationshipType: Type.Optional(Type.String({ minLength: 1 })),
    sourceEventGroups: Type.Optional(Type.Array(Type.Array(IdSchema))),
    arrangementEventIds: Type.Array(IdSchema),
    arrangementEventGroups: Type.Optional(Type.Array(Type.Array(IdSchema))),
    classification: Type.Union([
      Type.Literal("retained"),
      Type.Literal("transposed"),
      Type.Literal("octave_relocated"),
      Type.Literal("revoiced"),
      Type.Literal("reharmonized"),
      Type.Literal("rhythm_changed"),
      Type.Literal("omitted"),
      Type.Literal("generated"),
    ]),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export type TransformationEntry = Static<typeof TransformationEntrySchema>;

export const PreservationAuditFindingSchema = Type.Object(
  {
    targetId: IdSchema,
    sourceEventId: Type.Optional(IdSchema),
    arrangementEventId: Type.Optional(IdSchema),
    severity: Type.Union([Type.Literal("hard"), Type.Literal("soft"), Type.Literal("observation")]),
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const PreservationAuditSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("pass"),
      Type.Literal("pass_with_exceptions"),
      Type.Literal("fail"),
    ]),
    targetIds: Type.Array(IdSchema, { minItems: 1 }),
    findings: Type.Array(PreservationAuditFindingSchema),
  },
  { additionalProperties: false }
);

export type PreservationAudit = Static<typeof PreservationAuditSchema>;

export const ArrangementCandidateSchema = Type.Object(
  {
    id: IdSchema,
    strategy: Type.String({ minLength: 1 }),
    status: Type.Union([
      Type.Literal("rejected"),
      Type.Literal("survived"),
      Type.Literal("selected"),
    ]),
    events: Type.Array(ArrangementEventSchema, { minItems: 1 }),
    audit: PreservationAuditSchema,
    metrics: Type.Object(
      {
        sourcePitchClassCoverage: Type.Number({ minimum: 0, maximum: 1 }),
        averageFret: Type.Number({ minimum: 0 }),
        openStringCount: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false }
    ),
    phraseSearchEvidence: Type.Optional(
      Type.Object(
        {
          schemaVersion: Type.Integer({ minimum: 1 }),
          arrangementPlanId: Type.Optional(IdSchema),
          performanceBriefId: Type.Optional(IdSchema),
          instrumentInstanceDigest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
          completeness: Type.Literal("bounded"),
          expandedStates: Type.Integer({ minimum: 0 }),
          maximumExpandedStates: Type.Integer({ minimum: 1 }),
          frontierWidth: Type.Integer({ minimum: 1 }),
          stateDimensions: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
          techniqueApplicability: Type.Array(
            Type.Object(
              {
                technique: Type.String({ minLength: 1 }),
                status: Type.Union([
                  Type.Literal("applicable"),
                  Type.Literal("not_applicable"),
                  Type.Literal("unknown"),
                ]),
                evidenceIds: Type.Array(IdSchema, { minItems: 1 }),
              },
              { additionalProperties: false }
            ),
            { minItems: 1 }
          ),
          bassCapability: Type.Optional(
            Type.Object(
              {
                status: Type.Union([
                  Type.Literal("bourdon_available"),
                  Type.Literal("reentrant_limited"),
                  Type.Literal("unknown"),
                ]),
                lowestSoundingPitch: Type.String({ pattern: "^[A-G](?:#|b)?-?\\d+$" }),
                bourdonCourses: Type.Array(Type.Integer({ minimum: 1 })),
                rationale: Type.String({ minLength: 1 }),
              },
              { additionalProperties: false }
            )
          ),
          luteTechniqueEvidence: Type.Optional(
            Type.Object(
              {
                stoppedCourseCount: Type.Integer({ minimum: 1 }),
                diapasonCount: Type.Integer({ minimum: 1 }),
                rightHandBassAccess: Type.Union([
                  Type.Literal("represented"),
                  Type.Literal("unknown"),
                ]),
                bassPreparation: Type.Union([Type.Literal("represented"), Type.Literal("unknown")]),
                resonance: Type.Union([Type.Literal("represented"), Type.Literal("unknown")]),
                damping: Type.Union([Type.Literal("represented"), Type.Literal("unknown")]),
                sustain: Type.Union([Type.Literal("represented"), Type.Literal("unknown")]),
                voiceLineage: Type.Literal("represented"),
                styleBrise: Type.Object(
                  {
                    status: Type.Union([Type.Literal("applied"), Type.Literal("not_applied")]),
                    planDecisionIds: Type.Array(IdSchema),
                    historicalClaimIds: Type.Array(IdSchema),
                    rationale: Type.String({ minLength: 1 }),
                  },
                  { additionalProperties: false }
                ),
              },
              { additionalProperties: false }
            )
          ),
          classicalTechniqueEvidence: Type.Optional(
            Type.Object(
              {
                leftHandScope: Type.Literal("represented"),
                rightHandScope: Type.Union([Type.Literal("unknown"), Type.Literal("represented")]),
                rightHandRationale: Type.String({ minLength: 1 }),
                independentVoiceDuration: Type.Literal("represented"),
                standardNotationVoices: Type.Literal("represented"),
              },
              { additionalProperties: false }
            )
          ),
          referenceComparison: Type.Optional(
            Type.Object(
              {
                reference: Type.Literal("event_local_first_fit"),
                selectedTotalMotion: Type.Number({ minimum: 0 }),
                referenceTotalMotion: Type.Number({ minimum: 0 }),
                selectedMaximumHandShift: Type.Number({ minimum: 0 }),
                referenceMaximumHandShift: Type.Number({ minimum: 0 }),
                selectedDiapasonPreparations: Type.Integer({ minimum: 0 }),
                referenceDiapasonPreparations: Type.Integer({ minimum: 0 }),
              },
              { additionalProperties: false }
            )
          ),
          transitions: Type.Array(
            Type.Object(
              {
                fromEventId: Type.Optional(IdSchema),
                toEventId: IdSchema,
                principalFrom: Type.Optional(
                  Type.Object(
                    {
                      course: Type.Integer({ minimum: 1 }),
                      fret: Type.Integer({ minimum: 0 }),
                    },
                    { additionalProperties: false }
                  )
                ),
                principalTo: Type.Object(
                  {
                    course: Type.Integer({ minimum: 1 }),
                    fret: Type.Integer({ minimum: 0 }),
                  },
                  { additionalProperties: false }
                ),
                fretDisplacement: Type.Integer({ minimum: 0 }),
                courseDisplacement: Type.Integer({ minimum: 0 }),
                handPositionFrom: Type.Optional(Type.Number({ minimum: 0 })),
                handPositionTo: Type.Number({ minimum: 0 }),
                handPositionDelta: Type.Number({ minimum: 0 }),
                retainedCourses: Type.Array(Type.Integer({ minimum: 1 })),
                introducedCourses: Type.Array(Type.Integer({ minimum: 1 })),
                releasedCourses: Type.Array(Type.Integer({ minimum: 1 })),
                heldPitchCount: Type.Integer({ minimum: 0 }),
                barreChanged: Type.Boolean(),
                technique: Type.String({ minLength: 1 }),
                violentCrossNeckJump: Type.Boolean(),
                attackCourses: Type.Optional(
                  Type.Array(Type.Integer({ minimum: 1, maximum: 5 }), {
                    minItems: 1,
                    maxItems: 5,
                  })
                ),
                contiguousAttack: Type.Optional(Type.Boolean()),
                rightHandFingerCount: Type.Optional(Type.Integer({ minimum: 0, maximum: 3 })),
                alfabetoSymbol: Type.Optional(Type.String({ minLength: 1 })),
                stoppedCourseFretDelta: Type.Optional(Type.Integer({ minimum: 0 })),
                stoppedCourseReachMillimeters: Type.Optional(Type.Number({ minimum: 0 })),
                diapasonCourses: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
                preparedBassCourses: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
                resonatingBassCourses: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
                dampingRequiredCourses: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
                rightHandBassAccessCount: Type.Optional(Type.Integer({ minimum: 0 })),
                styleBriseApplied: Type.Optional(Type.Boolean()),
                activeVoiceDurations: Type.Optional(
                  Type.Array(
                    Type.Object(
                      {
                        voiceId: IdSchema,
                        duration: RationalSchema,
                      },
                      { additionalProperties: false }
                    )
                  )
                ),
                guideFingerCount: Type.Optional(Type.Integer({ minimum: 0 })),
                sustainedPositionCount: Type.Optional(Type.Integer({ minimum: 0 })),
              },
              { additionalProperties: false }
            )
          ),
        },
        { additionalProperties: false }
      )
    ),
    arrangementSearchId: Type.Optional(IdSchema),
    derivationChoices: Type.Optional(
      Type.Array(
        Type.Object(
          {
            dimension: Type.String({ minLength: 1 }),
            value: Type.String({ minLength: 1 }),
            rationale: Type.String({ minLength: 1 }),
          },
          { additionalProperties: false }
        )
      )
    ),
    evaluation: Type.Optional(
      Type.Object(
        {
          hardConstraintResults: Type.Array(
            Type.Object(
              {
                category: Type.Union([
                  Type.Literal("preservation"),
                  Type.Literal("instrument"),
                  Type.Literal("figured_bass"),
                  Type.Literal("validation"),
                ]),
                status: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
                evidenceIds: Type.Array(IdSchema),
                rationale: Type.String({ minLength: 1 }),
              },
              { additionalProperties: false }
            )
          ),
          scores: Type.Object(
            {
              historicalProfile: Type.Number({ minimum: 0, maximum: 1 }),
              idiom: Type.Number({ minimum: 0, maximum: 1 }),
              playability: Type.Number({ minimum: 0, maximum: 1 }),
              voiceLeading: Type.Number({ minimum: 0, maximum: 1 }),
              notationClarity: Type.Number({ minimum: 0, maximum: 1 }),
              softPreferences: Type.Number({ minimum: 0, maximum: 1 }),
            },
            { additionalProperties: false }
          ),
          weightedTotal: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
          measurements: Type.Optional(Type.Array(CandidateMeasurementSchema, { minItems: 1 })),
          selectionBasis: Type.Optional(
            Type.Object(
              {
                method: Type.Literal("policy_lexicographic"),
                decisiveMetricId: Type.Optional(IdSchema),
                status: Type.Union([
                  Type.Literal("selected"),
                  Type.Literal("survived"),
                  Type.Literal("rejected"),
                  Type.Literal("ambiguous"),
                ]),
              },
              { additionalProperties: false }
            )
          ),
          rationale: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false }
      )
    ),
    rank: Type.Optional(Type.Integer({ minimum: 1 })),
    rejectionReason: Type.Optional(Type.String({ minLength: 1 })),
    createdAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);

export type ArrangementCandidate = Static<typeof ArrangementCandidateSchema>;

export const ArrangementSearchSchema = Type.Object(
  {
    id: IdSchema,
    normalizedScoreId: IdSchema,
    analysisRecordId: IdSchema,
    performanceBriefId: IdSchema,
    arrangementFamilyId: Type.Optional(IdSchema),
    targetConfiguration: TargetConfigurationSchema,
    preservationPolicy: Type.Union([
      Type.Literal("faithful_reduction"),
      Type.Literal("idiomatic_adaptation"),
      Type.Literal("free_paraphrase"),
    ]),
    branchId: Type.Optional(IdSchema),
    constraintSpecifications: Type.Array(ConstraintSpecificationSchema, { minItems: 1 }),
    attemptConfiguration: SearchAttemptConfigurationSchema,
    executionIdentity: SearchExecutionIdentitySchema,
    outcome: Type.Optional(SearchOutcomeSchema),
    status: Type.Union([
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("failed"),
    ]),
    candidateIds: Type.Array(IdSchema),
    selectedCandidateId: Type.Optional(IdSchema),
    selectedArrangementScoreId: Type.Optional(IdSchema),
    rankingWeights: Type.Object(
      {
        historicalProfile: Type.Number({ minimum: 0, maximum: 1 }),
        idiom: Type.Number({ minimum: 0, maximum: 1 }),
        playability: Type.Number({ minimum: 0, maximum: 1 }),
        voiceLeading: Type.Number({ minimum: 0, maximum: 1 }),
        notationClarity: Type.Number({ minimum: 0, maximum: 1 }),
        softPreferences: Type.Number({ minimum: 0, maximum: 1 }),
      },
      { additionalProperties: false }
    ),
    comparisonPolicy: Type.Optional(
      Type.Object(
        {
          method: Type.Literal("policy_lexicographic"),
          metricDefinitions: Type.Array(ComparisonMetricDefinitionSchema, { minItems: 1 }),
          priorityMetricIds: Type.Array(IdSchema, { minItems: 1 }),
          automaticTieBreak: Type.Literal("none"),
        },
        { additionalProperties: false }
      )
    ),
    createdAt: IsoDateSchema,
    completedAt: Type.Optional(IsoDateSchema),
  },
  { additionalProperties: false }
);

export type ArrangementSearch = Static<typeof ArrangementSearchSchema>;

export const PassageDependencyContextSchema = Type.Object(
  {
    requestedEventIds: Type.Array(IdSchema, { minItems: 1 }),
    expandedEventIds: Type.Array(IdSchema, { minItems: 1 }),
    incomingStateEventIds: Type.Array(IdSchema),
    outgoingStateEventIds: Type.Array(IdSchema),
    sustainedEventIds: Type.Array(IdSchema),
    harmonyEventIds: Type.Array(IdSchema),
    phraseAndCadenceTargetIds: Type.Array(IdSchema),
    repeatMeasureIds: Type.Array(IdSchema),
    activeCommitmentIds: Type.Array(IdSchema),
    derivationEvidenceIds: Type.Array(IdSchema, { minItems: 1 }),
  },
  { additionalProperties: false }
);
export type PassageDependencyContext = Static<typeof PassageDependencyContextSchema>;

export const PassageSearchRecordSchema = Type.Object(
  {
    id: IdSchema,
    digest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    arrangementScoreId: IdSchema,
    arrangementScoreVersion: Type.Integer({ minimum: 1 }),
    arrangementPlanId: IdSchema,
    arrangementSearchId: IdSchema,
    analysisRecordId: IdSchema,
    targetConfigurationId: IdSchema,
    dependencyContext: PassageDependencyContextSchema,
    sourceCandidateIds: Type.Array(IdSchema, { minItems: 1 }),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);
export type PassageSearchRecord = Static<typeof PassageSearchRecordSchema>;

export const OwnerPlaytestObservationSchema = Type.Object(
  {
    dimension: Type.Union([
      Type.Literal("mechanics"),
      Type.Literal("technique"),
      Type.Literal("clarity"),
      Type.Literal("identity"),
      Type.Literal("history"),
      Type.Literal("notation"),
    ]),
    code: Type.Union([
      Type.Literal("reach"),
      Type.Literal("shift_reliability"),
      Type.Literal("held_note_conflict"),
      Type.Literal("right_hand_difficulty"),
      Type.Literal("damping"),
      Type.Literal("voice_clarity"),
      Type.Literal("cadence"),
      Type.Literal("source_identity"),
      Type.Literal("historical_practice"),
      Type.Literal("notation"),
    ]),
    outcome: Type.Union([
      Type.Literal("supports"),
      Type.Literal("concern"),
      Type.Literal("blocks"),
      Type.Literal("not_applicable"),
    ]),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const OwnerPlaytestSchema = Type.Object(
  {
    id: IdSchema,
    arrangementScoreId: IdSchema,
    arrangementScoreVersion: Type.Integer({ minimum: 1 }),
    arrangementScoreDigest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    candidateId: Type.Optional(IdSchema),
    candidateDigest: Type.Optional(Type.String({ pattern: "^[a-f0-9]{64}$" })),
    arrangementEventIds: Type.Array(IdSchema, { minItems: 1 }),
    playbackOccurrenceIds: Type.Array(IdSchema, { minItems: 1 }),
    instrumentInstanceDigest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    performanceBriefId: IdSchema,
    performanceBriefDigest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    actualContext: Type.Object(
      {
        tempoBpm: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
        practiceContext: Type.String({ minLength: 1 }),
        evidenceBasis: Type.Array(
          Type.Union([
            Type.Literal("notation"),
            Type.Literal("listening"),
            Type.Literal("physical_playing"),
          ]),
          { minItems: 1, uniqueItems: true }
        ),
      },
      { additionalProperties: false }
    ),
    outcome: Type.Union([
      Type.Literal("comfortable"),
      Type.Literal("practice_playable"),
      Type.Literal("marginal"),
      Type.Literal("unplayable"),
      Type.Literal("unclear_unmusical"),
      Type.Literal("historically_questionable"),
      Type.Literal("notation_problem"),
      Type.Literal("not_tested"),
    ]),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    observations: Type.Array(OwnerPlaytestObservationSchema),
    rationale: Type.String({ minLength: 1 }),
    proposedConsequences: Type.Array(
      Type.Union([
        Type.Literal("adoption"),
        Type.Literal("rejection"),
        Type.Literal("correction"),
        Type.Literal("commitment"),
        Type.Literal("ergonomic_profile"),
        Type.Literal("calibration_candidate"),
        Type.Literal("fixture_nomination"),
      ]),
      { uniqueItems: true }
    ),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);
export type OwnerPlaytest = Static<typeof OwnerPlaytestSchema>;

export const ArrangementReadinessViewSchema = Type.Object(
  {
    arrangementScoreId: IdSchema,
    arrangementScoreVersion: Type.Integer({ minimum: 1 }),
    status: Type.Union([
      Type.Literal("inspection_only"),
      Type.Literal("playtest_available"),
      Type.Literal("owner_tested"),
      Type.Literal("blocked"),
      Type.Literal("stale"),
    ]),
    currentPlaytestIds: Type.Array(IdSchema),
    stalePlaytestIds: Type.Array(IdSchema),
    blockingPlaytestIds: Type.Array(IdSchema),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);
export type ArrangementReadinessView = Static<typeof ArrangementReadinessViewSchema>;

export const ArrangementScoreSchema = Type.Object(
  {
    id: IdSchema,
    version: Type.Optional(Type.Integer({ minimum: 1 })),
    arrangementSearchId: Type.Optional(IdSchema),
    branchId: Type.Optional(IdSchema),
    arrangementFamilyId: Type.Optional(IdSchema),
    parentArrangementScoreId: Type.Optional(IdSchema),
    arrangementPlanId: Type.Optional(IdSchema),
    realizedPlanDecisionIds: Type.Optional(Type.Array(IdSchema)),
    editorialCommitmentIds: Type.Optional(Type.Array(IdSchema)),
    familyCommitmentIds: Type.Optional(Type.Array(IdSchema)),
    policyExceptionIds: Type.Optional(Type.Array(IdSchema)),
    regeneration: Type.Optional(
      Type.Object(
        {
          kind: Type.Literal("conservative"),
          staleArrangementScoreId: IdSchema,
          changedSourceEventIds: Type.Array(IdSchema),
          regeneratedArrangementEventIds: Type.Array(IdSchema),
          retainedArrangementEventIds: Type.Array(IdSchema),
        },
        { additionalProperties: false }
      )
    ),
    analysisRecordId: IdSchema,
    selectedCandidateId: IdSchema,
    targetConfiguration: TargetConfigurationSchema,
    transpositionPlan: Type.Object(
      {
        sourceKey: Type.Optional(Type.String({ minLength: 1 })),
        targetKey: Type.Optional(Type.String({ minLength: 1 })),
        semitones: Type.Integer({ minimum: -24, maximum: 24 }),
        rationale: Type.String({ minLength: 1 }),
        alternatives: Type.Optional(
          Type.Array(
            Type.Object(
              {
                semitones: Type.Integer({ minimum: -24, maximum: 24 }),
                targetKey: Type.Optional(Type.String({ minLength: 1 })),
                status: Type.Union([Type.Literal("complete_solution"), Type.Literal("rejected")]),
                selected: Type.Boolean(),
                sourcePitchClassCoverage: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
                totalPositionMotion: Type.Optional(Type.Number({ minimum: 0 })),
                averageFret: Type.Optional(Type.Number({ minimum: 0 })),
                reason: Type.String({ minLength: 1 }),
              },
              { additionalProperties: false }
            ),
            { minItems: 1 }
          )
        ),
      },
      { additionalProperties: false }
    ),
    preservationPolicy: Type.Union([
      Type.Literal("faithful_reduction"),
      Type.Literal("idiomatic_adaptation"),
      Type.Literal("free_paraphrase"),
    ]),
    events: Type.Array(ArrangementEventSchema, { minItems: 1 }),
    transformationReport: Type.Array(TransformationEntrySchema),
    preservationAudit: PreservationAuditSchema,
    continuoDisposition: Type.Optional(
      Type.Object(
        {
          kind: Type.Union([
            Type.Literal("complete_realization"),
            Type.Literal("separate_bass_realization"),
            Type.Literal("continuo_reduction"),
          ]),
          label: Type.String({ minLength: 1 }),
          soundedFoundationEventIds: Type.Array(IdSchema),
          unsoundedFoundationEventIds: Type.Array(IdSchema),
          bassInstrumentId: Type.Optional(Type.String({ minLength: 1 })),
        },
        { additionalProperties: false }
      )
    ),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type ArrangementScore = Static<typeof ArrangementScoreSchema>;

export const PerformanceInterpretationSchema = Type.Object(
  {
    id: IdSchema,
    arrangementScoreId: IdSchema,
    arrangementScoreVersion: Type.Integer({ minimum: 1 }),
    version: Type.Integer({ minimum: 1 }),
    parentInterpretationId: Type.Optional(IdSchema),
    choices: Type.Object(
      {
        tempo: Type.Integer({ minimum: 30, maximum: 240 }),
        arpeggiationMs: Type.Integer({ minimum: 0, maximum: 250 }),
        inequality: Type.Number({ minimum: 0, maximum: 0.4 }),
        articulation: Type.Number({ minimum: 0.1, maximum: 1 }),
        principalVoiceOrnament: Type.Union([Type.Literal("none"), Type.Literal("upper_neighbor")]),
      },
      { additionalProperties: false }
    ),
    rationale: Type.String({ minLength: 1 }),
    createdAt: IsoDateSchema,
  },
  { additionalProperties: false }
);

export type PerformanceInterpretation = Static<typeof PerformanceInterpretationSchema>;

export function rational(numerator: number, denominator = 1): Rational {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new Error(`Invalid rational ${numerator}/${denominator}`);
  }

  const divisor = greatestCommonDivisor(Math.abs(numerator), denominator);
  const sign = numerator < 0 ? -1 : 1;

  return {
    numerator: sign * (Math.abs(numerator) / divisor),
    denominator: denominator / divisor,
  };
}

export function addRational(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator
  );
}

export function compareRational(left: Rational, right: Rational): number {
  return left.numerator * right.denominator - right.numerator * left.denominator;
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left;
  let b = right;

  while (b !== 0) {
    [a, b] = [b, a % b];
  }

  return a === 0 ? 1 : a;
}
