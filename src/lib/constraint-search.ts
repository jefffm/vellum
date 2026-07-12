import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const Id = Type.String({ pattern: "^[a-z0-9][a-z0-9._:-]*$", minLength: 1 });
const Digest = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoDate = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

export const JsonValueSchema = Type.Recursive((Self) =>
  Type.Union([
    Type.Null(),
    Type.Boolean(),
    Type.Number(),
    Type.String(),
    Type.Array(Self),
    Type.Record(Type.String(), Self),
  ])
);
export type JsonValue = Static<typeof JsonValueSchema>;

export const ExecutionComponentIdentitySchema = Type.Object(
  {
    id: Id,
    version: Type.String({ minLength: 1 }),
    digest: Digest,
  },
  { additionalProperties: false }
);

export const SearchExecutionIdentitySchema = Type.Object(
  {
    digest: Digest,
    adapter: ExecutionComponentIdentitySchema,
    compiler: ExecutionComponentIdentitySchema,
    evaluators: Type.Array(ExecutionComponentIdentitySchema, { minItems: 1 }),
    arrangementPlanId: Id,
    performanceBriefId: Id,
    targetConfigurationId: Id,
    instrumentInstanceDigest: Type.Optional(Digest),
    constraintDigests: Type.Array(Digest),
    attemptConfigurationDigest: Digest,
  },
  { additionalProperties: false }
);
export type SearchExecutionIdentity = Static<typeof SearchExecutionIdentitySchema>;

export const ConstraintScopeSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("whole_target"),
      Type.Literal("section"),
      Type.Literal("passage"),
      Type.Literal("voice"),
      Type.Literal("event"),
      Type.Literal("transition"),
    ]),
    targetConfigurationId: Id,
    subjectIds: Type.Array(Id),
  },
  { additionalProperties: false }
);

const ProvenanceKindSchema = Type.Union([
  Type.Literal("preservation_target"),
  Type.Literal("instrument_mechanics"),
  Type.Literal("analysis_claim"),
  Type.Literal("historical_profile"),
  Type.Literal("plan_decision"),
  Type.Literal("commitment"),
  Type.Literal("personal_default"),
  Type.Literal("owner_instruction"),
  Type.Literal("policy_exception"),
]);

export const ConstraintProvenanceSchema = Type.Object(
  {
    kind: ProvenanceKindSchema,
    sourceRecordId: Id,
    evidenceIds: Type.Array(Id, { minItems: 1 }),
    observationDigest: Digest,
  },
  { additionalProperties: false }
);

export const ConstraintEnforcementSchema = Type.Object(
  {
    rejection: Type.Union([
      Type.Literal("reject"),
      Type.Literal("retain_with_penalty"),
      Type.Literal("observe_only"),
    ]),
    comparisonPriority: Type.Integer({ minimum: 0 }),
    exceptionPolicy: Type.Union([
      Type.Literal("forbidden"),
      Type.Literal("policy_exception_required"),
      Type.Literal("allowed_and_disclosed"),
    ]),
    confirmationPolicy: Type.Union([
      Type.Literal("none"),
      Type.Literal("owner_confirmation_required"),
      Type.Literal("specialist_review_required"),
    ]),
    rationale: Type.String({ minLength: 1 }),
    evaluationPhase: Type.Union([
      Type.Literal("incremental"),
      Type.Literal("complete_candidate"),
      Type.Literal("both"),
    ]),
  },
  { additionalProperties: false }
);

export const ConstraintApplicabilitySchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("applicable"),
      Type.Literal("not_applicable"),
      Type.Literal("unknown"),
    ]),
    rationale: Type.String({ minLength: 1 }),
    requiredCapabilityIds: Type.Array(Id),
  },
  { additionalProperties: false }
);

export const ConstraintSpecificationSchema = Type.Object(
  {
    id: Id,
    schemaVersion: Type.Integer({ minimum: 1 }),
    evaluatorId: Id,
    evaluatorVersion: Type.String({ minLength: 1 }),
    scope: ConstraintScopeSchema,
    parameters: JsonValueSchema,
    provenance: ConstraintProvenanceSchema,
    enforcement: ConstraintEnforcementSchema,
    applicability: ConstraintApplicabilitySchema,
    compilerIdentity: ExecutionComponentIdentitySchema,
  },
  { additionalProperties: false }
);
export type ConstraintSpecification = Static<typeof ConstraintSpecificationSchema>;

export const EvaluatorConclusionSchema = Type.Object(
  {
    constraintId: Id,
    modeledProperty: Type.String({ minLength: 1 }),
    result: Type.Union([
      Type.Literal("pass"),
      Type.Literal("fail"),
      Type.Literal("unknown"),
      Type.Literal("not_applicable"),
    ]),
    completeness: Type.Union([
      Type.Literal("complete"),
      Type.Literal("bounded"),
      Type.Literal("heuristic"),
      Type.Literal("unknown"),
      Type.Literal("not_evaluated"),
    ]),
    evidenceBasis: Type.Array(
      Type.Union([
        Type.Literal("mechanical"),
        Type.Literal("source_derived"),
        Type.Literal("historical"),
        Type.Literal("analytical"),
        Type.Literal("ergonomic"),
        Type.Literal("model_assisted"),
        Type.Literal("owner_statement"),
      ]),
      { minItems: 1 }
    ),
    authority: Type.Union([
      Type.Literal("system_derived"),
      Type.Literal("owner_confirmed"),
      Type.Literal("owner_excepted"),
      Type.Literal("advisory"),
    ]),
    presentation: Type.Union([
      Type.Literal("certified"),
      Type.Literal("audited"),
      Type.Literal("evidence_supported"),
      Type.Literal("estimated"),
      Type.Literal("descriptive"),
      Type.Literal("undetermined"),
    ]),
    evidenceIds: Type.Array(Id),
    rationale: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);
export type EvaluatorConclusion = Static<typeof EvaluatorConclusionSchema>;

export const SearchAttemptConfigurationSchema = Type.Object(
  {
    schemaVersion: Type.Integer({ minimum: 1 }),
    seed: Type.Integer({ minimum: 0 }),
    width: Type.Integer({ minimum: 1 }),
    maximumExpandedStates: Type.Integer({ minimum: 1 }),
    maximumCandidates: Type.Integer({ minimum: 1 }),
    pruningPolicy: Type.String({ minLength: 1 }),
    resourcePolicy: Type.Object(
      {
        timeoutMilliseconds: Type.Integer({ minimum: 1 }),
        diagnosticFrontierLimit: Type.Integer({ minimum: 0 }),
        rejectionEvidenceLimit: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
);
export type SearchAttemptConfiguration = Static<typeof SearchAttemptConfigurationSchema>;

export const SearchCheckpointSchema = Type.Object(
  {
    schemaVersion: Type.Integer({ minimum: 1 }),
    executionIdentity: SearchExecutionIdentitySchema,
    expandedStates: Type.Integer({ minimum: 0 }),
    frontier: JsonValueSchema,
    adapterState: JsonValueSchema,
    createdAt: IsoDate,
  },
  { additionalProperties: false }
);
export type SearchCheckpoint = Static<typeof SearchCheckpointSchema>;

export const CompletenessCertificateSchema = Type.Object(
  {
    schemaVersion: Type.Integer({ minimum: 1 }),
    executionIdentity: SearchExecutionIdentitySchema,
    finiteModeledUniverse: Type.String({ minLength: 1 }),
    completeSuccessorRule: Type.String({ minLength: 1 }),
    evaluatedConstraintIds: Type.Array(Id, { minItems: 1 }),
    omittedDimensions: Type.Array(Type.String({ minLength: 1 })),
    pruningRules: Type.Array(Type.String({ minLength: 1 })),
    stateMergingRationale: Type.String({ minLength: 1 }),
    stateMergingEvidenceIds: Type.Array(Id, { minItems: 1 }),
  },
  { additionalProperties: false }
);
export type CompletenessCertificate = Static<typeof CompletenessCertificateSchema>;

const OutcomeBase = {
  executionIdentity: SearchExecutionIdentitySchema,
  diagnosticEvidenceIds: Type.Array(Id),
};
export const SearchOutcomeSchema = Type.Union([
  Type.Object(
    {
      ...OutcomeBase,
      kind: Type.Literal("candidate_found"),
      candidateIds: Type.Array(Id, { minItems: 1 }),
      selectedCandidateId: Type.Optional(Id),
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      ...OutcomeBase,
      kind: Type.Literal("exhaustively_infeasible"),
      certificate: CompletenessCertificateSchema,
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      ...OutcomeBase,
      kind: Type.Literal("search_exhausted"),
      reason: Type.String({ minLength: 1 }),
      checkpoint: Type.Optional(SearchCheckpointSchema),
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      ...OutcomeBase,
      kind: Type.Literal("blocked_by_uncertainty"),
      uncertaintyIds: Type.Array(Id, { minItems: 1 }),
      reason: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      ...OutcomeBase,
      kind: Type.Literal("cancelled"),
      checkpoint: Type.Optional(SearchCheckpointSchema),
      reason: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      ...OutcomeBase,
      kind: Type.Literal("failed"),
      errorCode: Id,
      message: Type.String({ minLength: 1 }),
      retryable: Type.Boolean(),
    },
    { additionalProperties: false }
  ),
]);
export type SearchOutcome = Static<typeof SearchOutcomeSchema>;

export const SearchAdapterDeclarationSchema = Type.Object(
  {
    identity: ExecutionComponentIdentitySchema,
    supportedInstrumentProfileIds: Type.Array(Id, { minItems: 1 }),
    supportedTextures: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    supportedPlanKinds: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    performanceBriefApplicability: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    stateSchemaId: Id,
    stateSchemaVersion: Type.Integer({ minimum: 1 }),
    equivalenceRelation: Type.String({ minLength: 1 }),
    dominanceRelation: Type.String({ minLength: 1 }),
    completenessClaim: Type.Union([
      Type.Literal("none"),
      Type.Literal("bounded_only"),
      Type.Literal("exhaustive_when_certified"),
    ]),
  },
  { additionalProperties: false }
);
export type SearchAdapterDeclaration = Static<typeof SearchAdapterDeclarationSchema>;

export interface SearchAdapter<State, Candidate> {
  readonly declaration: SearchAdapterDeclaration;
  readonly stateSchema: TSchema;
  initialState(): State;
  successors(state: State): readonly State[];
  equivalent(left: State, right: State): boolean;
  dominates(left: State, right: State): boolean;
  evaluateIncrementally(state: State): readonly EvaluatorConclusion[];
  buildCandidate(state: State): Candidate | undefined;
  checkpoint(state: State, identity: SearchExecutionIdentity): SearchCheckpoint;
}

export function decodeConstraintSpecification(value: unknown): ConstraintSpecification {
  assertJsonValue(value);
  return Value.Decode(ConstraintSpecificationSchema, value);
}

export function decodeSearchOutcome(value: unknown): SearchOutcome {
  const outcome = Value.Decode(SearchOutcomeSchema, value);
  if (
    outcome.kind === "exhaustively_infeasible" &&
    !searchExecutionIdentitiesEqual(
      outcome.certificate.executionIdentity,
      outcome.executionIdentity
    )
  ) {
    throw new Error("Completeness certificate execution identity does not match search outcome");
  }
  if (
    (outcome.kind === "search_exhausted" || outcome.kind === "cancelled") &&
    outcome.checkpoint &&
    !searchExecutionIdentitiesEqual(outcome.checkpoint.executionIdentity, outcome.executionIdentity)
  ) {
    throw new Error("Search checkpoint execution identity does not match search outcome");
  }
  return outcome;
}

export function decodeEvaluatorConclusion(value: unknown): EvaluatorConclusion {
  const conclusion = Value.Decode(EvaluatorConclusionSchema, value);
  if (conclusion.presentation === "certified" && conclusion.completeness !== "complete") {
    throw new Error(
      "Certified presentation requires complete evidence for the exact modeled property"
    );
  }
  return conclusion;
}

export function assertCheckpointCompatible(
  checkpoint: SearchCheckpoint,
  identity: SearchExecutionIdentity
): void {
  if (!searchExecutionIdentitiesEqual(checkpoint.executionIdentity, identity)) {
    throw new Error("Search checkpoint is incompatible with the requested execution identity");
  }
}

export function searchExecutionIdentitiesEqual(
  left: SearchExecutionIdentity,
  right: SearchExecutionIdentity
): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

export function searchOutcomeDescription(outcome: SearchOutcome): string {
  switch (outcome.kind) {
    case "candidate_found":
      return "Candidate found";
    case "exhaustively_infeasible":
      return "Impossible within the certified modeled universe";
    case "search_exhausted":
      return `Search exhausted: ${outcome.reason}`;
    case "blocked_by_uncertainty":
      return `Search blocked by uncertainty: ${outcome.reason}`;
    case "cancelled":
      return `Search cancelled: ${outcome.reason}`;
    case "failed":
      return `Search failed: ${outcome.message}`;
  }
}

function assertJsonValue(value: unknown, path = "$"): asserts value is JsonValue {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) assertJsonValue(item, `${path}.${key}`);
    return;
  }
  throw new Error(
    `Constraint Specification must be JSON-serializable; found ${typeof value} at ${path}`
  );
}
