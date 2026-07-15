import { createHash } from "node:crypto";
import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import bundledPolicyJson from "./data/release-floor-derivation-policy.v1.json" with { type: "json" };

const IdentifierSchema = Type.String({
  minLength: 1,
  maxLength: 128,
  pattern: "^[a-z0-9][a-z0-9._-]*$",
});
const Sha256Schema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const ClauseIdSchema = Type.String({ pattern: "^II-[A-Z0-9]+-[A-Z0-9]+$" });
const RepositoryPathSchema = Type.String({
  minLength: 1,
  maxLength: 240,
  pattern:
    "^(?!/)(?!~)(?!.*(?:^|/)\\.{1,2}(?:/|$))(?!.*\\\\)(?!.*(?:^|/)(?:Users|Volumes|home|private|vault|heldout|reserve)(?:/|$))[^\\u0000]+$",
});

const ResourceClassSchema = Type.Union([
  Type.Literal("podman-vm"),
  Type.Literal("audiveris"),
  Type.Literal("fixed-port"),
  Type.Literal("mutable-store"),
  Type.Literal("vault-writer"),
  Type.Literal("performance-hardware"),
]);

const WorkloadGeneratorSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("tracked-fixture"),
      identity: IdentifierSchema,
      version: Type.Integer({ minimum: 1 }),
      sourceSha256: Sha256Schema,
      requirements: Type.Array(IdentifierSchema, { minItems: 1 }),
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      kind: Type.Literal("deterministic-generator"),
      identity: IdentifierSchema,
      version: Type.Integer({ minimum: 1 }),
      requirements: Type.Array(IdentifierSchema, { minItems: 1 }),
    },
    { additionalProperties: false }
  ),
]);

const WorkloadSchema = Type.Object(
  {
    id: IdentifierSchema,
    kind: Type.Union([Type.Literal("reference"), Type.Literal("stress")]),
    description: Type.String({ minLength: 1, maxLength: 512 }),
    generator: WorkloadGeneratorSchema,
    stages: Type.Array(IdentifierSchema, { minItems: 1 }),
  },
  { additionalProperties: false }
);

const HardwareClassSchema = Type.Object(
  {
    id: IdentifierSchema,
    os: Type.Union([Type.Literal("darwin"), Type.Literal("linux")]),
    architecture: Type.Union([Type.Literal("arm64"), Type.Literal("x64")]),
    comparison: Type.Literal("exact-recorded-host"),
  },
  { additionalProperties: false }
);

export const MetricFamilyIdSchema = Type.Union([
  Type.Literal("stage-time"),
  Type.Literal("peak-rss"),
  Type.Literal("persisted-bytes"),
  Type.Literal("inventory-bytes"),
  Type.Literal("catalog-bytes"),
  Type.Literal("manifest-bytes"),
  Type.Literal("frontier-bytes"),
  Type.Literal("checkpoint-bytes"),
  Type.Literal("cancellation-response"),
  Type.Literal("checkpoint-interval"),
  Type.Literal("resume-overhead"),
  Type.Literal("redacted-diagnostic-bytes"),
]);

export type MetricFamilyId = Static<typeof MetricFamilyIdSchema>;

const MetricFamilyPolicySchema = Type.Object(
  {
    id: MetricFamilyIdSchema,
    unit: Type.Union([Type.Literal("ms"), Type.Literal("bytes")]),
    safetyMargin: Type.Object(
      {
        numerator: Type.Integer({ minimum: 1 }),
        denominator: Type.Integer({ minimum: 1 }),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
);

export const ReleaseFloorDerivationPolicySchema = Type.Object(
  {
    schemaId: Type.Literal("vellum.instrument-intelligence.release-floor-derivation-policy.v1"),
    policyId: Type.Literal("release-floor-derivation-policy.v1"),
    workloads: Type.Array(WorkloadSchema, { minItems: 1 }),
    cleanState: Type.Object(
      {
        steps: Type.Array(IdentifierSchema, { minItems: 1 }),
        forbidSharedWarmCaches: Type.Literal(true),
        requireFreshMutableStore: Type.Literal(true),
        requireOrphanAbsenceProof: Type.Literal(true),
        requireCleanRerunAfterOrphanCleanup: Type.Literal(true),
      },
      { additionalProperties: false }
    ),
    hardwareClasses: Type.Array(HardwareClassSchema, { minItems: 1 }),
    toolchainRequirements: Type.Array(
      Type.Object(
        {
          component: IdentifierSchema,
          applicability: Type.Union([Type.Literal("required"), Type.Literal("conditional")]),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    measurement: Type.Object(
      {
        warmupRepetitions: Type.Integer({ minimum: 1 }),
        measuredRepetitions: Type.Integer({ minimum: 3 }),
        aggregation: Type.Literal("median"),
        clock: Type.Literal("monotonic"),
        memory: Type.Literal("peak-rss-sampled"),
        filesystem: Type.Literal("before-after-byte-accounting"),
        rounding: Type.Literal("ceil"),
        requireCompleteRepetitionSet: Type.Literal(true),
      },
      { additionalProperties: false }
    ),
    metricFamilies: Type.Array(MetricFamilyPolicySchema, { minItems: 1 }),
    diagnostics: Type.Object(
      {
        contentPolicy: Type.Literal("bounded-redacted-tail-only"),
        forbidPrivatePaths: Type.Literal(true),
        forbidSourceBytes: Type.Literal(true),
        forbidProviderPayloads: Type.Literal(true),
        thresholdFamily: Type.Literal("redacted-diagnostic-bytes"),
      },
      { additionalProperties: false }
    ),
    resourceClasses: Type.Array(ResourceClassSchema, { minItems: 1 }),
    resourceCommandMatchers: Type.Array(
      Type.Object(
        {
          resource: ResourceClassSchema,
          tokens: Type.Array(Type.String({ minLength: 1, maxLength: 64 }), { minItems: 1 }),
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    ),
    resultRules: Type.Object(
      {
        unsupportedHardware: Type.Literal("blocked"),
        differentRecordedHost: Type.Literal("incomparable"),
        toolchainMismatch: Type.Literal("incomparable"),
        missingMetric: Type.Literal("blocked"),
        referenceBudgetExhaustion: Type.Literal("fail"),
        stressBudgetExhaustion: Type.Literal("actionable-only"),
      },
      { additionalProperties: false }
    ),
    replacementRules: Type.Object(
      {
        identity: Type.Literal("immutable-content-digest"),
        requireNewPolicyIdentity: Type.Literal(true),
        requireOwnerApprovedSpecificationDecision: Type.Literal(true),
        preservePriorMeasurementsAndFailures: Type.Literal(true),
        invalidateBroaderClaims: Type.Literal(true),
        forbidThresholdLooseningInPlace: Type.Literal(true),
        forbidNarrowerProfileAsReleaseFloorReplacement: Type.Literal(true),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
);

export type ReleaseFloorDerivationPolicy = Static<typeof ReleaseFloorDerivationPolicySchema>;

export const ToolIdentitySchema = Type.Object(
  {
    component: IdentifierSchema,
    applicability: Type.Union([Type.Literal("applicable"), Type.Literal("not_applicable")]),
    identity: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
    rationale: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
  },
  { additionalProperties: false }
);

export type ToolIdentity = Static<typeof ToolIdentitySchema>;

export const HardwareIdentitySchema = Type.Object(
  {
    hardwareClassId: IdentifierSchema,
    os: Type.Union([Type.Literal("darwin"), Type.Literal("linux")]),
    architecture: Type.Union([Type.Literal("arm64"), Type.Literal("x64")]),
    cpuModel: Type.String({ minLength: 1, maxLength: 256 }),
    logicalCores: Type.Integer({ minimum: 1 }),
    memoryBytes: Type.Integer({ minimum: 1 }),
    osRelease: Type.String({ minLength: 1, maxLength: 256 }),
    nixSystem: Type.String({ minLength: 1, maxLength: 256 }),
  },
  { additionalProperties: false }
);

export type HardwareIdentity = Static<typeof HardwareIdentitySchema>;

export const ReleaseFloorEnvironmentSchema = Type.Object(
  {
    hardware: HardwareIdentitySchema,
    toolchains: Type.Array(ToolIdentitySchema, { minItems: 1 }),
  },
  { additionalProperties: false }
);

export type ReleaseFloorEnvironment = Static<typeof ReleaseFloorEnvironmentSchema>;

const MeasurementObservationSchema = Type.Object(
  {
    metricFamily: MetricFamilyIdSchema,
    qualifier: Type.Optional(IdentifierSchema),
    values: Type.Array(Type.Number({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }), {
      minItems: 1,
    }),
  },
  { additionalProperties: false }
);

export const RawMeasurementSetSchema = Type.Object(
  {
    schemaId: Type.Literal("vellum.instrument-intelligence.raw-measurement-set.v1"),
    policyId: Type.Literal("release-floor-derivation-policy.v1"),
    policyDigest: Sha256Schema,
    workloadId: IdentifierSchema,
    workloadBindingDigest: Sha256Schema,
    environment: ReleaseFloorEnvironmentSchema,
    observations: Type.Array(MeasurementObservationSchema, { minItems: 1 }),
  },
  { additionalProperties: false }
);

export type RawMeasurementSet = Static<typeof RawMeasurementSetSchema>;

const DerivedThresholdSchema = Type.Object(
  {
    workloadId: IdentifierSchema,
    metricFamily: MetricFamilyIdSchema,
    qualifier: Type.Optional(IdentifierSchema),
    unit: Type.Union([Type.Literal("ms"), Type.Literal("bytes")]),
    observedAggregate: Type.Number({ minimum: 0 }),
    limit: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  },
  { additionalProperties: false }
);

export const PerformanceReleaseFloorProfileSchema = Type.Object(
  {
    schemaId: Type.Literal("performance.release-floor.v1"),
    policyId: Type.Literal("release-floor-derivation-policy.v1"),
    policyDigest: Sha256Schema,
    rawMeasurementDigest: Sha256Schema,
    environment: ReleaseFloorEnvironmentSchema,
    thresholds: Type.Array(DerivedThresholdSchema, { minItems: 1 }),
  },
  { additionalProperties: false }
);

export type PerformanceReleaseFloorProfile = Static<typeof PerformanceReleaseFloorProfileSchema>;

const GateSchema = Type.Object(
  {
    gateId: IdentifierSchema,
    applicability: Type.Union([
      Type.Literal("required"),
      Type.Literal("conditional"),
      Type.Literal("not_applicable"),
    ]),
    command: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
    clauseIds: Type.Array(ClauseIdSchema, { minItems: 1 }),
    resourceLeaseKeys: Type.Array(IdentifierSchema),
    rationale: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
  },
  { additionalProperties: false }
);

const ObservableOutcomeSchema = Type.Object(
  {
    outcomeId: IdentifierSchema,
    kind: Type.Union([
      Type.Literal("api-response"),
      Type.Literal("browser-state"),
      Type.Literal("artifact"),
      Type.Literal("render"),
      Type.Literal("playback"),
      Type.Literal("process-exit"),
      Type.Literal("state-transition"),
    ]),
    predicate: Type.String({ minLength: 1, maxLength: 1024 }),
  },
  { additionalProperties: false }
);

export const ResourceLeaseDeclarationSchema = Type.Object(
  {
    resource: ResourceClassSchema,
    key: IdentifierSchema,
    mode: Type.Literal("exclusive"),
    cleanupPolicy: Type.Literal("prove-owner-absent-then-clean-rerun"),
  },
  { additionalProperties: false }
);

export const TracerGateMatrixSchema = Type.Object(
  {
    schemaId: Type.Literal("vellum.instrument-intelligence.tracer-gate-matrix.v1"),
    tracerId: Type.String({ pattern: "^T(?:0[1-9]|[1-9][0-9]?|10[0-7])$" }),
    definitionDigest: Sha256Schema,
    executionProfile: Type.Union([Type.Literal("afk"), Type.Literal("hitl")]),
    baseGates: Type.Array(GateSchema, { minItems: 1 }),
    conditionalGates: Type.Array(GateSchema),
    observableOutcomes: Type.Array(ObservableOutcomeSchema, { minItems: 1 }),
    toolIdentities: Type.Array(ToolIdentitySchema, { minItems: 1 }),
    evidencePath: RepositoryPathSchema,
    resourceLeases: Type.Array(ResourceLeaseDeclarationSchema),
  },
  { additionalProperties: false }
);

export type TracerGateMatrix = Static<typeof TracerGateMatrixSchema>;
export type ResourceLeaseDeclaration = Static<typeof ResourceLeaseDeclarationSchema>;

const REQUIRED_METRIC_FAMILIES: MetricFamilyId[] = [
  "stage-time",
  "peak-rss",
  "persisted-bytes",
  "inventory-bytes",
  "catalog-bytes",
  "manifest-bytes",
  "frontier-bytes",
  "checkpoint-bytes",
  "cancellation-response",
  "checkpoint-interval",
  "resume-overhead",
  "redacted-diagnostic-bytes",
];

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function resourceLeaseIdForDeclaration(declaration: ResourceLeaseDeclaration): string {
  return `${declaration.resource}.${declaration.key}`;
}

export function parseReleaseFloorPolicy(value: unknown): ReleaseFloorDerivationPolicy {
  assertSchema(ReleaseFloorDerivationPolicySchema, value, "release-floor policy");
  const policy = structuredClone(value) as ReleaseFloorDerivationPolicy;
  assertUnique(
    policy.workloads.map(({ id }) => id),
    "workload id"
  );
  for (const workload of policy.workloads) {
    assertUnique(workload.stages, `stage in workload ${workload.id}`);
    assertUnique(workload.generator.requirements, `generator requirement in ${workload.id}`);
  }
  assertUnique(
    policy.hardwareClasses.map(({ id }) => id),
    "hardware class id"
  );
  assertUnique(
    policy.toolchainRequirements.map(({ component }) => component),
    "toolchain requirement"
  );
  assertUnique(
    policy.metricFamilies.map(({ id }) => id),
    "metric family id"
  );
  assertUnique(policy.resourceClasses, "resource class");
  assertUnique(
    policy.resourceCommandMatchers.map(({ resource }) => resource),
    "resource command matcher"
  );
  for (const matcher of policy.resourceCommandMatchers) {
    assertUnique(matcher.tokens, `command token for ${matcher.resource}`);
    if (!policy.resourceClasses.includes(matcher.resource)) {
      throw new Error(`resource matcher names undeclared ${matcher.resource}`);
    }
  }
  const metricIds = new Set(policy.metricFamilies.map(({ id }) => id));
  for (const required of REQUIRED_METRIC_FAMILIES) {
    if (!metricIds.has(required)) throw new Error(`release-floor policy omits ${required}`);
  }
  if (metricIds.size !== REQUIRED_METRIC_FAMILIES.length) {
    throw new Error("release-floor policy contains an unrecognized metric family");
  }
  if (containsForbiddenBaselineField(policy)) {
    throw new Error("derivation policy must not contain observations, profiles, or thresholds");
  }
  return policy;
}

export function parseTracerGateMatrix(
  value: unknown,
  policyValue: unknown = bundledReleaseFloorPolicy
): TracerGateMatrix {
  const policy = parseReleaseFloorPolicy(policyValue);
  assertCanonicalPolicyIdentity(policy);
  assertSchema(TracerGateMatrixSchema, value, "tracer gate matrix");
  const matrix = structuredClone(value) as TracerGateMatrix;
  const allGates = [...matrix.baseGates, ...matrix.conditionalGates];
  assertUnique(
    allGates.map(({ gateId }) => gateId),
    "gate id"
  );
  assertUnique(
    matrix.observableOutcomes.map(({ outcomeId }) => outcomeId),
    "outcome id"
  );
  assertUnique(
    matrix.toolIdentities.map(({ component }) => component),
    "tool component"
  );
  assertUnique(
    matrix.resourceLeases.map(({ key }) => key),
    "resource lease key"
  );
  const leaseByKey = new Map(matrix.resourceLeases.map((lease) => [lease.key, lease]));
  for (const gate of matrix.baseGates) {
    assertUnique(gate.resourceLeaseKeys, `resource lease key on ${gate.gateId}`);
    if (gate.applicability !== "required" || !gate.command) {
      throw new Error(`base gate ${gate.gateId} must be required and executable`);
    }
  }
  for (const gate of matrix.conditionalGates) {
    assertUnique(gate.resourceLeaseKeys, `resource lease key on ${gate.gateId}`);
    if (gate.applicability === "required") {
      throw new Error(`conditional gate ${gate.gateId} cannot be unconditionally required`);
    }
    if (gate.applicability === "conditional" && !gate.command) {
      throw new Error(`conditional gate ${gate.gateId} requires a command`);
    }
    if (gate.applicability === "not_applicable" && (!gate.rationale || gate.command)) {
      throw new Error(`not-applicable gate ${gate.gateId} requires a rationale and cannot execute`);
    }
    if (gate.applicability === "not_applicable" && gate.resourceLeaseKeys.length > 0) {
      throw new Error(`not-applicable gate ${gate.gateId} cannot acquire resources`);
    }
  }
  for (const gate of allGates) {
    for (const key of gate.resourceLeaseKeys) {
      if (!leaseByKey.has(key)) throw new Error(`gate ${gate.gateId} names unknown lease ${key}`);
    }
    if (!gate.command) continue;
    const command = gate.command.toLowerCase();
    for (const matcher of policy.resourceCommandMatchers) {
      if (!matcher.tokens.some((token) => command.includes(token.toLowerCase()))) continue;
      const hasRequiredLease = gate.resourceLeaseKeys.some(
        (key) => leaseByKey.get(key)?.resource === matcher.resource
      );
      if (!hasRequiredLease) {
        throw new Error(`gate ${gate.gateId} requires a ${matcher.resource} resource lease`);
      }
    }
  }
  validateToolIdentities(matrix.toolIdentities, policy);
  return matrix;
}

export function deriveReleaseFloorProfile(
  rawSetsValue: unknown,
  policyValue: unknown = bundledReleaseFloorPolicy
): PerformanceReleaseFloorProfile {
  const policy = parseReleaseFloorPolicy(policyValue);
  assertCanonicalPolicyIdentity(policy);
  if (!Array.isArray(rawSetsValue)) throw new Error("raw measurement sets must be an array");
  const rawSets = rawSetsValue.map((value) => {
    assertSchema(RawMeasurementSetSchema, value, "raw measurement set");
    return structuredClone(value) as RawMeasurementSet;
  });
  assertUnique(
    rawSets.map(({ workloadId }) => workloadId),
    "raw workload id"
  );
  const expectedWorkloads = policy.workloads.map(({ id }) => id).sort();
  const actualWorkloads = rawSets.map(({ workloadId }) => workloadId).sort();
  if (canonicalJson(expectedWorkloads) !== canonicalJson(actualWorkloads)) {
    throw new Error("raw measurements must cover every policy workload exactly once");
  }
  const policyDigest = sha256Canonical(policy);
  for (const raw of rawSets) {
    if (raw.policyId !== policy.policyId || raw.policyDigest !== policyDigest) {
      throw new Error(`measurement ${raw.workloadId} is bound to a different policy`);
    }
    const workload = policy.workloads.find(({ id }) => id === raw.workloadId);
    if (!workload || raw.workloadBindingDigest !== sha256Canonical(workload)) {
      throw new Error(`measurement ${raw.workloadId} is bound to a different workload`);
    }
    validateEnvironment(raw.environment, policy);
  }
  const normalizedRawSets = rawSets
    .map(normalizeRawMeasurementSet)
    .sort((left, right) => left.workloadId.localeCompare(right.workloadId));
  const environment = normalizedRawSets[0]?.environment;
  if (!environment) throw new Error("raw measurement sets cannot be empty");
  for (const raw of normalizedRawSets.slice(1)) {
    if (canonicalJson(raw.environment) !== canonicalJson(environment)) {
      throw new Error("all release-floor workloads must use one exact recorded environment");
    }
  }

  const metricPolicy = new Map(policy.metricFamilies.map((metric) => [metric.id, metric]));
  const workloadPolicy = new Map(policy.workloads.map((workload) => [workload.id, workload]));
  const thresholds: PerformanceReleaseFloorProfile["thresholds"] = [];
  for (const raw of normalizedRawSets) {
    assertUnique(
      raw.observations.map(({ metricFamily, qualifier }) => `${metricFamily}:${qualifier ?? ""}`),
      `observation key for ${raw.workloadId}`
    );
    const presentFamilies = new Set(raw.observations.map(({ metricFamily }) => metricFamily));
    for (const required of REQUIRED_METRIC_FAMILIES) {
      if (!presentFamilies.has(required)) {
        throw new Error(`${raw.workloadId} omits required ${required} observation`);
      }
    }
    const expectedStages = [...(workloadPolicy.get(raw.workloadId)?.stages ?? [])].sort();
    const observedStages = raw.observations
      .filter(({ metricFamily }) => metricFamily === "stage-time")
      .map(({ qualifier }) => qualifier)
      .filter((qualifier): qualifier is string => Boolean(qualifier))
      .sort();
    if (canonicalJson(expectedStages) !== canonicalJson(observedStages)) {
      throw new Error(`${raw.workloadId} must measure every declared workflow stage exactly once`);
    }
    for (const observation of [...raw.observations].sort((left, right) =>
      `${left.metricFamily}:${left.qualifier ?? ""}`.localeCompare(
        `${right.metricFamily}:${right.qualifier ?? ""}`
      )
    )) {
      if (observation.metricFamily === "stage-time" && !observation.qualifier) {
        throw new Error(`${raw.workloadId} stage-time observation requires a stage qualifier`);
      }
      if (observation.metricFamily !== "stage-time" && observation.qualifier) {
        throw new Error(
          `${raw.workloadId} ${observation.metricFamily} cannot use a stage qualifier`
        );
      }
      if (observation.values.length !== policy.measurement.measuredRepetitions) {
        throw new Error(
          `${raw.workloadId} ${observation.metricFamily} requires exactly ${policy.measurement.measuredRepetitions} repetitions`
        );
      }
      if (observation.values.some((value) => !Number.isFinite(value))) {
        throw new Error(`${raw.workloadId} contains a non-finite observation`);
      }
      const family = metricPolicy.get(observation.metricFamily);
      if (!family) throw new Error(`missing policy for ${observation.metricFamily}`);
      const observedAggregate = median(observation.values);
      const limit = Math.ceil(
        (observedAggregate * family.safetyMargin.numerator) / family.safetyMargin.denominator
      );
      if (!Number.isSafeInteger(limit)) {
        throw new Error(`${raw.workloadId} ${observation.metricFamily} exceeds numeric bounds`);
      }
      thresholds.push({
        workloadId: raw.workloadId,
        metricFamily: observation.metricFamily,
        ...(observation.qualifier ? { qualifier: observation.qualifier } : {}),
        unit: family.unit,
        observedAggregate,
        limit,
      });
    }
  }

  return {
    schemaId: "performance.release-floor.v1",
    policyId: policy.policyId,
    policyDigest,
    rawMeasurementDigest: sha256Canonical(normalizedRawSets),
    environment,
    thresholds,
  };
}

export type EnvironmentComparison = {
  status: "pass" | "blocked" | "incomparable";
  reason: string;
};

export function compareReleaseFloorEnvironment(
  candidateValue: unknown,
  baselineValue: unknown,
  policyValue: unknown = bundledReleaseFloorPolicy
): EnvironmentComparison {
  const policy = parseReleaseFloorPolicy(policyValue);
  assertCanonicalPolicyIdentity(policy);
  assertSchema(ReleaseFloorEnvironmentSchema, candidateValue, "candidate environment");
  assertSchema(ReleaseFloorEnvironmentSchema, baselineValue, "baseline environment");
  const candidate = normalizeEnvironment(
    structuredClone(candidateValue) as ReleaseFloorEnvironment
  );
  const baseline = normalizeEnvironment(structuredClone(baselineValue) as ReleaseFloorEnvironment);
  try {
    validateEnvironment(candidate, policy);
    validateEnvironment(baseline, policy);
  } catch (error) {
    return { status: "blocked", reason: errorMessage(error) };
  }
  if (candidate.hardware.hardwareClassId !== baseline.hardware.hardwareClassId) {
    return { status: "incomparable", reason: "hardware class differs from release floor" };
  }
  if (canonicalJson(candidate.hardware) !== canonicalJson(baseline.hardware)) {
    return { status: "incomparable", reason: "recorded host identity differs" };
  }
  if (canonicalJson(candidate.toolchains) !== canonicalJson(baseline.toolchains)) {
    return { status: "incomparable", reason: "toolchain identity differs" };
  }
  return { status: "pass", reason: "exact supported environment match" };
}

function validateEnvironment(
  environment: ReleaseFloorEnvironment,
  policy: ReleaseFloorDerivationPolicy
): void {
  const hardwareClass = policy.hardwareClasses.find(
    ({ id }) => id === environment.hardware.hardwareClassId
  );
  if (!hardwareClass) {
    throw new Error(`unsupported hardware class ${environment.hardware.hardwareClassId}`);
  }
  if (
    hardwareClass.os !== environment.hardware.os ||
    hardwareClass.architecture !== environment.hardware.architecture
  ) {
    throw new Error(`hardware identity does not satisfy ${hardwareClass.id}`);
  }
  validateToolIdentities(environment.toolchains, policy);
}

function normalizeRawMeasurementSet(raw: RawMeasurementSet): RawMeasurementSet {
  return {
    ...raw,
    environment: normalizeEnvironment(raw.environment),
    observations: [...raw.observations].sort((left, right) =>
      `${left.metricFamily}:${left.qualifier ?? ""}`.localeCompare(
        `${right.metricFamily}:${right.qualifier ?? ""}`
      )
    ),
  };
}

function normalizeEnvironment(environment: ReleaseFloorEnvironment): ReleaseFloorEnvironment {
  return {
    hardware: environment.hardware,
    toolchains: [...environment.toolchains].sort((left, right) =>
      left.component.localeCompare(right.component)
    ),
  };
}

function validateToolIdentities(
  toolchains: ToolIdentity[],
  policy: ReleaseFloorDerivationPolicy
): void {
  assertUnique(
    toolchains.map(({ component }) => component),
    "tool component"
  );
  const requirements = new Map(
    policy.toolchainRequirements.map((requirement) => [requirement.component, requirement])
  );
  const actualComponents = [...toolchains.map(({ component }) => component)].sort();
  const expectedComponents = [...requirements.keys()].sort();
  if (canonicalJson(actualComponents) !== canonicalJson(expectedComponents)) {
    throw new Error("toolchain identities must cover the exact policy component set");
  }
  for (const tool of toolchains) {
    const requirement = requirements.get(tool.component);
    if (!requirement) throw new Error(`unsupported toolchain component ${tool.component}`);
    if (requirement.applicability === "required" && tool.applicability !== "applicable") {
      throw new Error(`required tool ${tool.component} cannot be not-applicable`);
    }
    if (tool.applicability === "applicable" && (!tool.identity || tool.rationale)) {
      throw new Error(`applicable tool ${tool.component} requires identity and no N/A rationale`);
    }
    if (tool.applicability === "not_applicable" && (!tool.rationale || tool.identity)) {
      throw new Error(`not-applicable tool ${tool.component} requires rationale and no identity`);
    }
  }
}

function assertCanonicalPolicyIdentity(policy: ReleaseFloorDerivationPolicy): void {
  if (
    policy.policyId === "release-floor-derivation-policy.v1" &&
    sha256Canonical(policy) !== RELEASE_FLOOR_POLICY_V1_DIGEST
  ) {
    throw new Error("release-floor policy v1 content changed; publish a new policy identity");
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function assertSchema<T extends TSchema>(schema: T, value: unknown, label: string): void {
  if (Value.Check(schema, value)) return;
  const detail = [...Value.Errors(schema, value)]
    .slice(0, 3)
    .map((error) => `${error.path || "/"}: ${error.message}`)
    .join("; ");
  throw new Error(`invalid ${label}: ${detail}`);
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${label}`);
}

function containsForbiddenBaselineField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  for (const [key, nested] of Object.entries(value)) {
    if (
      ["observation", "observations", "profile", "profiles", "threshold", "thresholds"].includes(
        key
      )
    ) {
      return true;
    }
    if (containsForbiddenBaselineField(nested)) return true;
  }
  return false;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const RELEASE_FLOOR_POLICY_V1_DIGEST =
  "e4423f904eea29bbef96e98676026fa1fe213e7580958b0211fc2a0c43015774";
export const TRACER_GATE_MATRIX_SCHEMA_V1_DIGEST =
  "09f071885e8bacdbf60b21ebce33a1c167ce2c60efd0936f77b47fd612f8be30";

export const bundledReleaseFloorPolicy = deepFreeze(parseReleaseFloorPolicy(bundledPolicyJson));
export const releaseFloorPolicyDigest = sha256Canonical(bundledReleaseFloorPolicy);
export const tracerGateMatrixSchemaDigest = sha256Canonical(TracerGateMatrixSchema);

if (releaseFloorPolicyDigest !== RELEASE_FLOOR_POLICY_V1_DIGEST) {
  throw new Error("release-floor policy v1 changed in place; publish a new policy identity");
}
if (tracerGateMatrixSchemaDigest !== TRACER_GATE_MATRIX_SCHEMA_V1_DIGEST) {
  throw new Error("tracer gate-matrix schema v1 changed in place; publish a new schema identity");
}
