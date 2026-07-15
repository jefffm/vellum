import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import {
  ReferenceLifecycleAuthorizedPathSchema,
  ReferenceLifecycleReplayabilitySchema,
  ReferenceLifecycleStoragePolicySchema,
  ReferenceLifecycleStorageSubjectKindSchema,
  ReferenceLifecycleUseSchema,
  ReferenceRecordRefSchema,
  ReferenceSourceStagingSnapshotSchema,
  referenceSourceDigest,
  verifyReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAccessDestination,
  type ReferenceAssetAcquisition,
  type ReferenceAssetRoleBinding,
  type ReferenceLifecycleAuthorizedPath,
  type ReferenceLifecycleReplayability,
  type ReferenceLifecycleStoragePolicy,
  type ReferenceLifecycleStorageSubjectKind,
  type ReferenceLifecycleUse,
  type ReferenceInvalidation,
  type ReferenceProvenanceSubstitution,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceDerivation,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingSnapshot,
} from "./reference-source-domain.js";

export {
  ReferenceLifecycleAuthorizedPathSchema,
  ReferenceLifecycleReplayabilitySchema,
  ReferenceLifecycleStoragePolicySchema as ReferenceLifecycleStorageSubjectSchema,
  ReferenceLifecycleStorageSubjectKindSchema,
  ReferenceLifecycleUseSchema,
};
export type {
  ReferenceLifecycleAuthorizedPath,
  ReferenceLifecycleReplayability,
  ReferenceLifecycleStoragePolicy as ReferenceLifecycleStorageSubject,
  ReferenceLifecycleStorageSubjectKind,
  ReferenceLifecycleUse,
};

const Strict = { additionalProperties: false } as const;
const IdSchema = Type.String({ minLength: 1 });
const DigestSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const IsoTimestampSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

export const ReferenceLifecycleStateSchema = Type.Union([
  Type.Literal("accessible"),
  Type.Literal("restricted"),
  Type.Literal("tombstone"),
  Type.Literal("purged"),
]);
export type ReferenceLifecycleState = Static<typeof ReferenceLifecycleStateSchema>;

export const ReferenceLifecycleReadinessImpactSchema = Type.Union([
  Type.Literal("unchanged"),
  Type.Literal("advisory"),
  Type.Literal("blocked"),
]);
export type ReferenceLifecycleReadinessImpact = Static<
  typeof ReferenceLifecycleReadinessImpactSchema
>;

const ReferenceLifecycleEndpointSchema = Type.Object(
  {
    acquisitionRefs: Type.Array(ReferenceRecordRefSchema, { minItems: 1 }),
    derivationRefs: Type.Array(ReferenceRecordRefSchema),
  },
  Strict
);
export type ReferenceLifecycleEndpoint = Static<typeof ReferenceLifecycleEndpointSchema>;

export const ReferenceSourceLifecycleActionSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("delete_acquisition"),
      targetAcquisitionRef: ReferenceRecordRefSchema,
      reason: Type.String({ minLength: 1 }),
    },
    Strict
  ),
  Type.Object(
    {
      kind: Type.Literal("restrict_access"),
      targetAccessDecisionRef: ReferenceRecordRefSchema,
      reason: Type.String({ minLength: 1 }),
    },
    Strict
  ),
]);
export type ReferenceSourceLifecycleAction = Static<typeof ReferenceSourceLifecycleActionSchema>;

export const ReferenceSourceLifecyclePlannerInputSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    baseSnapshot: ReferenceSourceStagingSnapshotSchema,
    effectiveAt: IsoTimestampSchema,
    action: ReferenceSourceLifecycleActionSchema,
  },
  Strict
);
export type ReferenceSourceLifecyclePlannerInput = Static<
  typeof ReferenceSourceLifecyclePlannerInputSchema
>;

const ReferenceLifecycleIssueCodeSchema = Type.Union([
  Type.Literal("invalid_snapshot_digest"),
  Type.Literal("target_acquisition_not_found"),
  Type.Literal("target_access_decision_not_found"),
  Type.Literal("record_digest_invalid"),
  Type.Literal("duplicate_exact_record"),
  Type.Literal("duplicate_storage_subject"),
  Type.Literal("duplicate_use"),
  Type.Literal("dangling_acquisition_ref"),
  Type.Literal("dangling_derivation_ref"),
  Type.Literal("dangling_access_decision_ref"),
  Type.Literal("derivation_cycle"),
  Type.Literal("invalid_provenance_endpoint"),
  Type.Literal("invalid_substitution_authorization"),
  Type.Literal("invalid_asset_storage_subject"),
  Type.Literal("missing_asset_storage_policy"),
  Type.Literal("missing_derivative_storage_policy"),
  Type.Literal("incomplete_lifecycle_inventory"),
  Type.Literal("invalid_rights_basis"),
  Type.Literal("invalid_role_binding"),
  Type.Literal("superseded_record"),
  Type.Literal("operation_destination_mismatch"),
  Type.Literal("retroactive_provenance"),
]);

const ReferenceLifecyclePlanningIssueSchema = Type.Object(
  {
    code: ReferenceLifecycleIssueCodeSchema,
    subjectRef: Type.Optional(ReferenceRecordRefSchema),
    detail: Type.String({ minLength: 1 }),
  },
  Strict
);
export type ReferenceLifecyclePlanningIssue = Static<typeof ReferenceLifecyclePlanningIssueSchema>;

const ReferenceLifecycleConsequenceSubjectKindSchema = Type.Union([
  Type.Literal("asset_acquisition"),
  ReferenceLifecycleStorageSubjectKindSchema,
]);

const ReferenceLifecycleStorageConsequenceSchema = Type.Object(
  {
    subjectRef: ReferenceRecordRefSchema,
    subjectKind: ReferenceLifecycleConsequenceSubjectKindSchema,
    state: ReferenceLifecycleStateSchema,
    affectedByRefs: Type.Array(ReferenceRecordRefSchema),
    replayability: ReferenceLifecycleReplayabilitySchema,
    readinessImpact: ReferenceLifecycleReadinessImpactSchema,
    irreversibleDisclosure: Type.Boolean(),
    reason: Type.String({ minLength: 1 }),
  },
  Strict
);
export type ReferenceLifecycleStorageConsequence = Static<
  typeof ReferenceLifecycleStorageConsequenceSchema
>;

const ReferenceLifecyclePermissionConsequenceSchema = Type.Object(
  {
    useId: IdSchema,
    subjectRef: ReferenceRecordRefSchema,
    state: Type.Union([Type.Literal("accessible"), Type.Literal("restricted")]),
    authorization: Type.Union([
      Type.Literal("direct"),
      Type.Literal("provenance_substitution"),
      Type.Literal("none"),
    ]),
    activeEndpoint: Type.Optional(ReferenceLifecycleEndpointSchema),
    accessDecisionRef: Type.Optional(ReferenceRecordRefSchema),
    replayability: ReferenceLifecycleReplayabilitySchema,
    readinessImpact: ReferenceLifecycleReadinessImpactSchema,
    sourceAvailability: Type.Union([
      Type.Literal("available"),
      Type.Literal("partially_reproducible"),
      Type.Literal("source_unavailable"),
      Type.Literal("not_reproducible"),
    ]),
    reason: Type.String({ minLength: 1 }),
  },
  Strict
);
export type ReferenceLifecyclePermissionConsequence = Static<
  typeof ReferenceLifecyclePermissionConsequenceSchema
>;

const ReferenceSourceLifecyclePlanCore = {
  schemaVersion: Type.Literal(1),
  id: IdSchema,
  digest: DigestSchema,
  mode: Type.Literal("dry_run"),
  baseSnapshotRef: ReferenceRecordRefSchema,
  effectiveAt: IsoTimestampSchema,
  action: ReferenceSourceLifecycleActionSchema,
  atomicity: Type.Literal("all_or_nothing"),
};

const ReferenceSourceLifecycleReadyPlanSchema = Type.Object(
  {
    ...ReferenceSourceLifecyclePlanCore,
    status: Type.Literal("ready"),
    targetRef: ReferenceRecordRefSchema,
    targetDigitalAssetRef: Type.Optional(ReferenceRecordRefSchema),
    consequences: Type.Array(ReferenceLifecycleStorageConsequenceSchema),
    permissions: Type.Array(ReferenceLifecyclePermissionConsequenceSchema),
    aggregate: Type.Object(
      {
        accessible: Type.Integer({ minimum: 0 }),
        restricted: Type.Integer({ minimum: 0 }),
        tombstone: Type.Integer({ minimum: 0 }),
        purged: Type.Integer({ minimum: 0 }),
        readinessBlocked: Type.Integer({ minimum: 0 }),
        irreversibleDisclosures: Type.Integer({ minimum: 0 }),
      },
      Strict
    ),
  },
  Strict
);

const ReferenceSourceLifecycleBlockedPlanSchema = Type.Object(
  {
    ...ReferenceSourceLifecyclePlanCore,
    status: Type.Literal("blocked"),
    issues: Type.Array(ReferenceLifecyclePlanningIssueSchema, { minItems: 1 }),
  },
  Strict
);

export const ReferenceSourceLifecyclePlanResultSchema = Type.Union([
  ReferenceSourceLifecycleReadyPlanSchema,
  ReferenceSourceLifecycleBlockedPlanSchema,
]);
export type ReferenceSourceLifecyclePlanResult = Static<
  typeof ReferenceSourceLifecyclePlanResultSchema
>;

type LifecycleContext = {
  effectiveAt: string;
  action: ReferenceSourceLifecycleAction;
  records: ReferenceSourceStagingRecord[];
  recordByRef: Map<string, ReferenceSourceStagingRecord>;
  acquisitions: ReferenceAssetAcquisition[];
  acquisitionByRef: Map<string, ReferenceAssetAcquisition>;
  derivations: ReferenceSourceDerivation[];
  derivationByRef: Map<string, ReferenceSourceDerivation>;
  accessDecisions: ReferenceAccessDecision[];
  accessDecisionByRef: Map<string, ReferenceAccessDecision>;
  rightsAssertions: ReferenceRightsAssertion[];
  rightsAssertionByRef: Map<string, ReferenceRightsAssertion>;
  substitutions: ReferenceProvenanceSubstitution[];
  roleBindings: ReferenceAssetRoleBinding[];
  policies: ReferenceLifecycleStoragePolicy[];
  uses: ReferenceLifecycleUse[];
  invalidatedRefs: Set<string>;
  issues: ReferenceLifecyclePlanningIssue[];
};

type ExactClosure = {
  acquisitions: ReferenceAssetAcquisition[];
  derivations: ReferenceSourceDerivation[];
  terminal: ReferenceSourceDerivation | null;
};

/**
 * Produces a deterministic, digest-bound, non-mutating lifecycle plan from one
 * complete immutable staging snapshot. Callers cannot select record arrays.
 */
export function planReferenceSourceLifecycle(
  input: ReferenceSourceLifecyclePlannerInput
): ReferenceSourceLifecyclePlanResult {
  if (!Value.Check(ReferenceSourceLifecyclePlannerInputSchema, input)) {
    throw new TypeError("Reference-source lifecycle input does not match the closed schema");
  }

  const snapshot = input.baseSnapshot;
  const records = [...snapshot.records].sort(compareRecords);
  const ctx = buildContext(records, input.effectiveAt, input.action);

  if (!verifySnapshotDigest(snapshot)) {
    addIssue(
      ctx,
      "invalid_snapshot_digest",
      recordRef(snapshot),
      "The complete base snapshot does not match its canonical digest."
    );
  }
  validateRecordIdentity(ctx);
  validateLifecycleInventory(ctx);

  const targetAcquisition =
    input.action.kind === "delete_acquisition"
      ? ctx.acquisitionByRef.get(refKey(input.action.targetAcquisitionRef))
      : undefined;
  const targetDecision =
    input.action.kind === "restrict_access"
      ? ctx.accessDecisionByRef.get(refKey(input.action.targetAccessDecisionRef))
      : undefined;

  if (input.action.kind === "delete_acquisition" && !targetAcquisition) {
    addIssue(
      ctx,
      "target_acquisition_not_found",
      input.action.targetAcquisitionRef,
      "The exact target acquisition is not present in the complete base snapshot."
    );
  }
  if (input.action.kind === "restrict_access" && !targetDecision) {
    addIssue(
      ctx,
      "target_access_decision_not_found",
      input.action.targetAccessDecisionRef,
      "The exact target Access Decision is not present in the complete base snapshot."
    );
  }

  const impactedDerivations = targetAcquisition
    ? collectImpactedDerivations(recordRef(targetAcquisition), ctx.derivations)
    : new Set<string>();
  validateInventoryCompleteness(ctx, targetAcquisition, targetDecision, impactedDerivations);

  const issues = sortIssues(ctx.issues);
  const base = {
    schemaVersion: 1 as const,
    mode: "dry_run" as const,
    baseSnapshotRef: recordRef(snapshot),
    effectiveAt: input.effectiveAt,
    action: input.action,
    atomicity: "all_or_nothing" as const,
  };
  if ((!targetAcquisition && !targetDecision) || issues.length > 0) {
    return sealPlan({ ...base, status: "blocked" as const, issues });
  }

  const consequences = buildStorageConsequences(
    ctx,
    targetAcquisition,
    targetDecision,
    impactedDerivations
  );
  const permissions = buildPermissionConsequences(ctx, impactedDerivations, consequences);
  const allStates = [
    ...consequences.map((consequence) => consequence.state),
    ...permissions.map((permission) => permission.state),
  ];
  const targetRef =
    input.action.kind === "delete_acquisition"
      ? input.action.targetAcquisitionRef
      : input.action.targetAccessDecisionRef;

  return sealPlan({
    ...base,
    status: "ready" as const,
    targetRef,
    ...(targetAcquisition ? { targetDigitalAssetRef: targetAcquisition.digitalAssetRef } : {}),
    consequences,
    permissions,
    aggregate: {
      accessible: allStates.filter((state) => state === "accessible").length,
      restricted: allStates.filter((state) => state === "restricted").length,
      tombstone: allStates.filter((state) => state === "tombstone").length,
      purged: allStates.filter((state) => state === "purged").length,
      readinessBlocked: [...consequences, ...permissions].filter(
        (consequence) => consequence.readinessImpact === "blocked"
      ).length,
      irreversibleDisclosures: consequences.filter(
        (consequence) => consequence.irreversibleDisclosure
      ).length,
    },
  });
}

function buildContext(
  records: ReferenceSourceStagingRecord[],
  effectiveAt: string,
  action: ReferenceSourceLifecycleAction
): LifecycleContext {
  const acquisitions = records.filter(isAssetAcquisition);
  const derivations = records.filter(isSourceDerivation);
  const accessDecisions = records.filter(isAccessDecision);
  const rightsAssertions = records.filter(isRightsAssertion);
  return {
    effectiveAt,
    action,
    records,
    recordByRef: indexRecords(records),
    acquisitions,
    acquisitionByRef: indexRecords(acquisitions),
    derivations,
    derivationByRef: indexRecords(derivations),
    accessDecisions,
    accessDecisionByRef: indexRecords(accessDecisions),
    rightsAssertions,
    rightsAssertionByRef: indexRecords(rightsAssertions),
    substitutions: records.filter(isProvenanceSubstitution),
    roleBindings: records.filter(isRoleBinding),
    policies: selectEffectiveVersions(records.filter(isLifecycleStoragePolicy), effectiveAt),
    uses: selectEffectiveVersions(records.filter(isLifecycleUse), effectiveAt),
    invalidatedRefs: new Set(
      records
        .filter(
          (record): record is ReferenceInvalidation =>
            record.recordKind === "invalidation" &&
            Date.parse(record.invalidatedAt) <= Date.parse(effectiveAt)
        )
        .map((record) => refKey(record.invalidatedRef))
    ),
    issues: [],
  };
}

function validateRecordIdentity(ctx: LifecycleContext): void {
  const exact = new Set<string>();
  const logicalVersions = new Set<string>();
  for (const record of ctx.records) {
    const key = refKey(record);
    if (exact.has(key)) {
      addIssue(
        ctx,
        "duplicate_exact_record",
        recordRef(record),
        "The complete snapshot repeats an exact immutable record."
      );
    }
    exact.add(key);
    if (!verifyReferenceRecordDigest(record)) {
      addIssue(
        ctx,
        "record_digest_invalid",
        recordRef(record),
        "An immutable snapshot record does not match its canonical digest."
      );
    }
    if ("version" in record) {
      const logical = record.recordKind + "\u0000" + record.id + "\u0000" + record.version;
      if (logicalVersions.has(logical)) {
        addIssue(
          ctx,
          "duplicate_exact_record",
          recordRef(record),
          "The snapshot contains two records for one logical version."
        );
      }
      logicalVersions.add(logical);
    }
  }
}

function validateLifecycleInventory(ctx: LifecycleContext): void {
  const subjects = new Set<string>();
  for (const policy of ctx.policies) {
    const subjectKey = refKey(policy.subjectRef);
    if (subjects.has(subjectKey)) {
      addIssue(
        ctx,
        "duplicate_storage_subject",
        policy.subjectRef,
        "One effective storage subject has more than one lifecycle policy."
      );
    }
    subjects.add(subjectKey);
    validateStoragePolicy(ctx, policy);
  }

  const useIds = new Set<string>();
  for (const use of ctx.uses) {
    if (useIds.has(use.id)) {
      addIssue(ctx, "duplicate_use", use.subjectRef, "One effective lifecycle use is ambiguous.");
    }
    useIds.add(use.id);
    validateUse(ctx, use);
  }
}

function validateStoragePolicy(
  ctx: LifecycleContext,
  policy: ReferenceLifecycleStoragePolicy
): void {
  const unmanaged = policy.custody.kind === "unmanaged_recipient";
  if ((policy.subjectKind === "unmanaged_disclosure") !== unmanaged) {
    addIssue(
      ctx,
      "invalid_provenance_endpoint",
      policy.subjectRef,
      "Unmanaged disclosure requires unmanaged custody, and unmanaged custody is disclosure-only."
    );
  }
  for (const path of policy.provenancePaths) {
    exactClosure(
      ctx,
      policy.subjectRef,
      path.acquisitionRefs,
      path.derivationRefs,
      policy.createdAt
    );
  }
  if (hasDuplicatePaths(policy.provenancePaths)) {
    addIssue(
      ctx,
      "invalid_provenance_endpoint",
      policy.subjectRef,
      "Lifecycle storage policy repeats an exact provenance path."
    );
  }
  if (policy.custody.kind === "unmanaged_recipient") {
    const decision = ctx.accessDecisionByRef.get(
      refKey(policy.custody.disclosureAccessDecisionRef)
    );
    if (
      !decision ||
      decision.outcome !== "allow" ||
      !["export", "redistribution"].includes(decision.operation) ||
      decision.destination.kind !== "recipient" ||
      decision.destination.id !== policy.custody.recipientRef.id ||
      !containsRef(decision.derivativeRefs, policy.subjectRef) ||
      Date.parse(decision.decidedAt) > Date.parse(policy.custody.disclosedAt) ||
      Date.parse(policy.custody.disclosedAt) > Date.parse(policy.createdAt)
    ) {
      addIssue(
        ctx,
        "invalid_rights_basis",
        policy.subjectRef,
        "Unmanaged disclosure is not pinned to its exact prior authorized recipient decision."
      );
    }
  }
  validateVersionPathEvolution(ctx, policy);
}

function validateUse(ctx: LifecycleContext, use: ReferenceLifecycleUse): void {
  for (const path of use.provenancePaths) {
    const closure = exactClosure(
      ctx,
      use.subjectRef,
      path.acquisitionRefs,
      path.derivationRefs,
      use.createdAt
    );
    const decision = ctx.accessDecisionByRef.get(refKey(path.accessDecisionRef));
    if (!decision) {
      addIssue(
        ctx,
        "dangling_access_decision_ref",
        path.accessDecisionRef,
        "Lifecycle use references an Access Decision outside the complete snapshot."
      );
      continue;
    }
    if (!operationDestinationCompatible(decision.operation, decision.destination)) {
      addIssue(
        ctx,
        "operation_destination_mismatch",
        recordRef(decision),
        "Access Decision operation and exact destination are incompatible."
      );
    }
    const requiredRefs = [...path.acquisitionRefs, ...path.derivationRefs, use.subjectRef];
    const authorizedRefs = [...decision.sourceRefs, ...decision.derivativeRefs];
    if (
      decision.operation !== use.operation ||
      !destinationsEqual(decision.destination, use.destination) ||
      decision.purpose !== use.purpose ||
      !refsEqual(decision.policyRef, use.policyRef) ||
      decision.assetRole !== use.assetRole ||
      Date.parse(decision.decidedAt) > Date.parse(use.createdAt) ||
      requiredRefs.some((ref) => !containsRef(authorizedRefs, ref))
    ) {
      addIssue(
        ctx,
        "invalid_provenance_endpoint",
        use.subjectRef,
        "Lifecycle use is not pinned to its decision's complete path, role, operation, destination, purpose, and policy."
      );
    }
    if (closure && use.assetRole && !hasExactRoleBinding(ctx, use, decision, closure)) {
      addIssue(
        ctx,
        "invalid_role_binding",
        use.subjectRef,
        "Lifecycle use cannot borrow authority from another Asset Role Binding."
      );
    }
  }
  if (hasDuplicatePaths(use.provenancePaths)) {
    addIssue(
      ctx,
      "invalid_provenance_endpoint",
      use.subjectRef,
      "Lifecycle use repeats an exact provenance path."
    );
  }
  validateVersionPathEvolution(ctx, use);
  validateNoRetroactivePath(ctx, use);
}

function exactClosure(
  ctx: LifecycleContext,
  subjectRef: ReferenceRecordRef,
  acquisitionRefs: ReferenceRecordRef[],
  derivationRefs: ReferenceRecordRef[],
  recordedAt: string
): ExactClosure | null {
  const acquisitions = acquisitionRefs
    .map((ref) => ctx.acquisitionByRef.get(refKey(ref)))
    .filter((record): record is ReferenceAssetAcquisition => record !== undefined);
  if (acquisitions.length !== acquisitionRefs.length) {
    const missing = acquisitionRefs.find((ref) => !ctx.acquisitionByRef.has(refKey(ref)));
    addIssue(
      ctx,
      "dangling_acquisition_ref",
      missing,
      "Lifecycle path references an acquisition outside the complete snapshot."
    );
    return null;
  }
  if (derivationRefs.length === 0) {
    const subject = ctx.recordByRef.get(refKey(subjectRef));
    if (
      subject?.recordKind !== "digital_asset" ||
      acquisitions.length !== 1 ||
      !refsEqual(acquisitions[0]!.digitalAssetRef, subjectRef)
    ) {
      addIssue(
        ctx,
        "invalid_asset_storage_subject",
        subjectRef,
        "A direct lifecycle path must name one exact acquisition of its Digital Asset."
      );
      return null;
    }
    if (Date.parse(acquisitions[0]!.acquiredAt) > Date.parse(recordedAt)) {
      addIssue(
        ctx,
        "retroactive_provenance",
        subjectRef,
        "Lifecycle provenance cannot predate its acquisition."
      );
    }
    return { acquisitions, derivations: [], terminal: null };
  }

  const declared = derivationRefs
    .map((ref) => ctx.derivationByRef.get(refKey(ref)))
    .filter((record): record is ReferenceSourceDerivation => record !== undefined);
  if (declared.length !== derivationRefs.length) {
    const missing = derivationRefs.find((ref) => !ctx.derivationByRef.has(refKey(ref)));
    addIssue(
      ctx,
      "dangling_derivation_ref",
      missing,
      "Lifecycle path references a derivation outside the complete snapshot."
    );
    return null;
  }
  const terminals = declared.filter((derivation) => refsEqual(derivation.derivedRef, subjectRef));
  if (terminals.length !== 1) {
    addIssue(
      ctx,
      "invalid_provenance_endpoint",
      subjectRef,
      "Lifecycle path must end in exactly one derivation of its exact subject."
    );
    return null;
  }
  const closure = deriveClosure(ctx, terminals[0]!, new Set<string>());
  if (!closure) return null;
  if (
    !sameRefSet(acquisitionRefs, closure.acquisitions.map(recordRef)) ||
    !sameRefSet(derivationRefs, closure.derivations.map(recordRef))
  ) {
    addIssue(
      ctx,
      "invalid_provenance_endpoint",
      subjectRef,
      "Lifecycle path must pin its complete transitive acquisition and derivation closure."
    );
    return null;
  }
  if (
    closure.acquisitions.some(
      (acquisition) => Date.parse(acquisition.acquiredAt) > Date.parse(recordedAt)
    ) ||
    closure.derivations.some(
      (derivation) => Date.parse(derivation.createdAt) > Date.parse(recordedAt)
    )
  ) {
    addIssue(
      ctx,
      "retroactive_provenance",
      subjectRef,
      "Lifecycle provenance cannot cite a source or derivation created later."
    );
  }
  return closure;
}

function deriveClosure(
  ctx: LifecycleContext,
  terminal: ReferenceSourceDerivation,
  visiting: Set<string>
): ExactClosure | null {
  const key = refKey(terminal);
  if (visiting.has(key)) {
    addIssue(
      ctx,
      "derivation_cycle",
      recordRef(terminal),
      "Lifecycle provenance contains a derivation cycle."
    );
    return null;
  }
  visiting.add(key);
  const acquisitions = new Map<string, ReferenceAssetAcquisition>();
  const derivations = new Map<string, ReferenceSourceDerivation>([[key, terminal]]);
  for (const acquisitionRef of terminal.sourceAcquisitionRefs) {
    const acquisition = ctx.acquisitionByRef.get(refKey(acquisitionRef));
    if (!acquisition) {
      addIssue(
        ctx,
        "dangling_acquisition_ref",
        acquisitionRef,
        "Source Derivation references an acquisition outside the complete snapshot."
      );
      return null;
    }
    acquisitions.set(refKey(acquisition), acquisition);
  }
  for (const sourceRef of terminal.sourceDerivationRefs) {
    const source = ctx.derivationByRef.get(refKey(sourceRef));
    if (!source) {
      addIssue(
        ctx,
        "dangling_derivation_ref",
        sourceRef,
        "Source Derivation references a predecessor outside the complete snapshot."
      );
      return null;
    }
    const nested = deriveClosure(ctx, source, new Set(visiting));
    if (!nested) return null;
    for (const acquisition of nested.acquisitions) {
      acquisitions.set(refKey(acquisition), acquisition);
    }
    for (const derivation of nested.derivations) {
      derivations.set(refKey(derivation), derivation);
    }
  }
  return {
    acquisitions: [...acquisitions.values()].sort(compareRecords),
    derivations: [...derivations.values()].sort(compareRecords),
    terminal,
  };
}

function validateVersionPathEvolution(
  ctx: LifecycleContext,
  record: ReferenceLifecycleStoragePolicy | ReferenceLifecycleUse
): void {
  if (!record.parentVersionRef) return;
  const parent = ctx.recordByRef.get(refKey(record.parentVersionRef));
  if (!parent || parent.recordKind !== record.recordKind || parent.id !== record.id) {
    addIssue(
      ctx,
      "retroactive_provenance",
      recordRef(record),
      "Lifecycle version does not resolve its exact same-kind parent."
    );
    return;
  }
  const priorKeys = new Set(parent.provenancePaths.map(pathKey));
  for (const path of record.provenancePaths) {
    if (priorKeys.has(pathKey(path))) continue;
    if (!pathHasReviewedSubstitution(ctx, path, parent.provenancePaths, record)) {
      addIssue(
        ctx,
        "retroactive_provenance",
        record.subjectRef,
        "A lifecycle version cannot add provenance without an exact reviewed substitution."
      );
    }
  }
}

function validateNoRetroactivePath(ctx: LifecycleContext, use: ReferenceLifecycleUse): void {
  for (const path of use.provenancePaths) {
    const terminal = terminalForPath(ctx, path, use.subjectRef);
    if (!terminal) continue;
    const earlier = ctx.derivations.filter(
      (candidate) =>
        refsEqual(candidate.derivedRef, use.subjectRef) &&
        !refsEqual(recordRef(candidate), recordRef(terminal)) &&
        Date.parse(candidate.createdAt) < Date.parse(terminal.createdAt)
    );
    if (earlier.length === 0) continue;
    const priorPaths = earlier
      .map((candidate) => deriveClosure(ctx, candidate, new Set<string>()))
      .filter((closure): closure is ExactClosure => closure !== null)
      .map((closure) => ({
        acquisitionRefs: closure.acquisitions.map(recordRef),
        derivationRefs: closure.derivations.map(recordRef),
      }));
    if (!pathHasReviewedSubstitution(ctx, path, priorPaths, use)) {
      addIssue(
        ctx,
        "retroactive_provenance",
        use.subjectRef,
        "A later acquisition cannot retroactively authorize an existing exact derivative."
      );
    }
  }
}

function pathHasReviewedSubstitution(
  ctx: LifecycleContext,
  next: { acquisitionRefs: ReferenceRecordRef[]; derivationRefs: ReferenceRecordRef[] },
  priorPaths: Array<{
    acquisitionRefs: ReferenceRecordRef[];
    derivationRefs: ReferenceRecordRef[];
  }>,
  record: ReferenceLifecycleStoragePolicy | ReferenceLifecycleUse
): boolean {
  const nextTerminal = terminalForPath(ctx, next, record.subjectRef);
  if (!nextTerminal) return false;
  return next.acquisitionRefs.every((nextAcquisition) =>
    priorPaths.some((prior) => {
      const priorTerminal = terminalForPath(ctx, prior, record.subjectRef);
      if (!priorTerminal) return false;
      return prior.acquisitionRefs.some((priorAcquisition) =>
        ctx.substitutions.some(
          (substitution) =>
            Date.parse(substitution.decidedAt) <= Date.parse(record.createdAt) &&
            refsEqual(substitution.from.acquisitionRef, priorAcquisition) &&
            refsEqual(substitution.from.derivationRef, recordRef(priorTerminal)) &&
            refsEqual(substitution.to.acquisitionRef, nextAcquisition) &&
            refsEqual(substitution.to.derivationRef, recordRef(nextTerminal)) &&
            refsEqual(substitution.scope.policyRef, record.policyRef) &&
            containsRef(substitution.scope.sourceAndDerivativeRefs, record.subjectRef) &&
            (record.recordKind === "lifecycle_storage_policy" ||
              (substitution.scope.operation === record.operation &&
                destinationsEqual(substitution.scope.destination, record.destination) &&
                substitution.scope.purpose === record.purpose))
        )
      );
    })
  );
}

function validateInventoryCompleteness(
  ctx: LifecycleContext,
  targetAcquisition: ReferenceAssetAcquisition | undefined,
  targetDecision: ReferenceAccessDecision | undefined,
  impactedDerivations: Set<string>
): void {
  if (targetAcquisition) {
    const assetPolicies = ctx.policies.filter(
      (policy) =>
        policy.subjectKind === "asset_bytes" &&
        refsEqual(policy.subjectRef, targetAcquisition.digitalAssetRef)
    );
    if (assetPolicies.length !== 1) {
      addIssue(
        ctx,
        "missing_asset_storage_policy",
        targetAcquisition.digitalAssetRef,
        "Deletion requires one complete effective policy for the shared Digital Asset bytes."
      );
    }
    for (const derivation of ctx.derivations) {
      if (!impactedDerivations.has(refKey(derivation))) continue;
      const represented = ctx.policies.some(
        (policy) =>
          refsEqual(policy.subjectRef, derivation.derivedRef) &&
          policy.provenancePaths.some((path) =>
            containsRef(path.derivationRefs, recordRef(derivation))
          )
      );
      if (!represented) {
        addIssue(
          ctx,
          "missing_derivative_storage_policy",
          recordRef(derivation),
          "Every affected derivative must have an exact lifecycle storage policy."
        );
      }
    }
  }

  const decision = targetDecision;
  if (
    decision &&
    !ctx.uses.some((use) =>
      use.provenancePaths.some((path) => refsEqual(path.accessDecisionRef, recordRef(decision)))
    )
  ) {
    addIssue(
      ctx,
      "incomplete_lifecycle_inventory",
      recordRef(decision),
      "Restricting an Access Decision requires every exact recorded use in the snapshot inventory."
    );
  }

  for (const binding of ctx.roleBindings) {
    const relevant =
      targetAcquisition &&
      binding.acquisitionRefs.some((ref) => refsEqual(ref, recordRef(targetAcquisition)));
    if (!relevant) continue;
    for (const accessDecisionRef of binding.accessDecisionRefs) {
      if (
        !ctx.uses.some((use) =>
          use.provenancePaths.some((path) => refsEqual(path.accessDecisionRef, accessDecisionRef))
        )
      ) {
        addIssue(
          ctx,
          "incomplete_lifecycle_inventory",
          recordRef(binding),
          "Every role-bound access edge affected by deletion must have an immutable lifecycle use."
        );
      }
    }
  }
}

function buildStorageConsequences(
  ctx: LifecycleContext,
  targetAcquisition: ReferenceAssetAcquisition | undefined,
  targetDecision: ReferenceAccessDecision | undefined,
  impactedDerivations: Set<string>
): ReferenceLifecycleStorageConsequence[] {
  const consequences: ReferenceLifecycleStorageConsequence[] = [];
  if (targetAcquisition) {
    consequences.push({
      subjectRef: recordRef(targetAcquisition),
      subjectKind: "asset_acquisition",
      state: "tombstone",
      affectedByRefs: [recordRef(targetAcquisition)],
      replayability: "unavailable",
      readinessImpact: "advisory",
      irreversibleDisclosure: false,
      reason:
        "The acquisition edge is deleted while minimum non-sensitive deletion metadata remains.",
    });
  }

  for (const policy of ctx.policies) {
    const effects = policy.provenancePaths.map((path) => ({
      affected: storagePathAffected(
        ctx,
        policy,
        path,
        targetAcquisition,
        targetDecision,
        impactedDerivations
      ),
      refs: affectedPathRefs(path, targetAcquisition, targetDecision, impactedDerivations),
      survives:
        !storagePathAffected(
          ctx,
          policy,
          path,
          targetAcquisition,
          targetDecision,
          impactedDerivations
        ) && path.acquisitionRefs.every((ref) => acquisitionRefIsActive(ctx, ref)),
    }));
    const affectedByRefs = uniqueSortedRefs(effects.flatMap((effect) => effect.refs));
    const irreversible =
      policy.custody.kind === "unmanaged_recipient" && effects.some((effect) => effect.affected);
    if (effects.some((effect) => effect.survives)) {
      consequences.push({
        subjectRef: policy.subjectRef,
        subjectKind: policy.subjectKind,
        state: "accessible",
        affectedByRefs,
        replayability: "complete",
        readinessImpact: "unchanged",
        irreversibleDisclosure: irreversible,
        reason: irreversible
          ? "An independent path survives, but Vellum cannot recall the affected prior disclosure."
          : "At least one independently recorded exact storage path survives.",
      });
    } else if (effects.every((effect) => !effect.affected)) {
      consequences.push({
        subjectRef: policy.subjectRef,
        subjectKind: policy.subjectKind,
        state: "accessible",
        affectedByRefs: [],
        replayability: "complete",
        readinessImpact: "unchanged",
        irreversibleDisclosure: false,
        reason: "No exact storage path depends on the lifecycle action.",
      });
    } else {
      consequences.push(storageConsequence(policy, affectedByRefs));
    }
  }

  if (targetAcquisition) {
    preserveAssetForRetentionRoots(ctx, targetAcquisition, consequences);
  }
  return consequences.sort((left, right) => {
    const byRef = compareRefs(left.subjectRef, right.subjectRef);
    return byRef || left.subjectKind.localeCompare(right.subjectKind);
  });
}

function storagePathAffected(
  ctx: LifecycleContext,
  policy: ReferenceLifecycleStoragePolicy,
  path: { acquisitionRefs: ReferenceRecordRef[]; derivationRefs: ReferenceRecordRef[] },
  targetAcquisition: ReferenceAssetAcquisition | undefined,
  targetDecision: ReferenceAccessDecision | undefined,
  impactedDerivations: Set<string>
): boolean {
  if (
    targetDecision &&
    policy.custody.kind === "unmanaged_recipient" &&
    refsEqual(policy.custody.disclosureAccessDecisionRef, recordRef(targetDecision))
  ) {
    return true;
  }
  if (!targetAcquisition) return false;
  return (
    containsRef(path.acquisitionRefs, recordRef(targetAcquisition)) ||
    path.derivationRefs.some((ref) => impactedDerivations.has(refKey(ref)))
  );
}

function affectedPathRefs(
  path: { acquisitionRefs: ReferenceRecordRef[]; derivationRefs: ReferenceRecordRef[] },
  targetAcquisition: ReferenceAssetAcquisition | undefined,
  targetDecision: ReferenceAccessDecision | undefined,
  impactedDerivations: Set<string>
): ReferenceRecordRef[] {
  return uniqueSortedRefs([
    ...(targetAcquisition && containsRef(path.acquisitionRefs, recordRef(targetAcquisition))
      ? [recordRef(targetAcquisition)]
      : []),
    ...path.derivationRefs.filter((ref) => impactedDerivations.has(refKey(ref))),
    ...(targetDecision ? [recordRef(targetDecision)] : []),
  ]);
}

function storageConsequence(
  policy: ReferenceLifecycleStoragePolicy,
  affectedByRefs: ReferenceRecordRef[]
): ReferenceLifecycleStorageConsequence {
  if (policy.custody.kind === "unmanaged_recipient") {
    return {
      subjectRef: policy.subjectRef,
      subjectKind: policy.subjectKind,
      state: "tombstone",
      affectedByRefs,
      replayability: "unavailable",
      readinessImpact: readinessImpactFor(policy.readinessRequirement, "tombstone"),
      irreversibleDisclosure: true,
      reason:
        "Vellum cannot recall an unmanaged disclosure; controlled copies are removed and a minimum disclosure tombstone remains.",
    };
  }
  const retained = policy.custody.retention !== "unretained";
  const state: ReferenceLifecycleState = retained
    ? "restricted"
    : policy.custody.tombstonePolicy === "preserve"
      ? "tombstone"
      : "purged";
  return {
    subjectRef: policy.subjectRef,
    subjectKind: policy.subjectKind,
    state,
    affectedByRefs,
    replayability: retained && policy.replayRequirement !== "none" ? "partial" : "unavailable",
    readinessImpact: readinessImpactFor(policy.readinessRequirement, state),
    irreversibleDisclosure: false,
    reason: retained
      ? "An explicit encrypted pin or required hold retains bytes without retaining use authority."
      : state === "tombstone"
        ? "Content bytes are removed while permitted non-sensitive tombstone metadata remains."
        : "The Vellum-controlled subject is purged because every exact path was affected.",
  };
}

function preserveAssetForRetentionRoots(
  ctx: LifecycleContext,
  target: ReferenceAssetAcquisition,
  consequences: ReferenceLifecycleStorageConsequence[]
): void {
  const asset = consequences.find(
    (consequence) =>
      consequence.subjectKind === "asset_bytes" &&
      refsEqual(consequence.subjectRef, target.digitalAssetRef)
  );
  if (!asset || asset.state === "accessible" || asset.state === "restricted") return;
  const retainedRoot = ctx.policies.some((policy) => {
    if (
      policy.subjectKind === "asset_bytes" ||
      policy.custody.kind !== "vellum_controlled" ||
      policy.custody.retention === "unretained" ||
      policy.replayRequirement !== "required"
    ) {
      return false;
    }
    return (
      policy.provenancePaths.some((path) => containsRef(path.acquisitionRefs, recordRef(target))) &&
      consequences.some(
        (consequence) =>
          refsEqual(consequence.subjectRef, policy.subjectRef) && consequence.state === "restricted"
      )
    );
  });
  if (retainedRoot) {
    asset.state = "restricted";
    asset.replayability = "partial";
    asset.readinessImpact = "advisory";
    asset.reason =
      "Shared bytes remain restricted because an explicit retained replay root still pins them.";
  }
}

function buildPermissionConsequences(
  ctx: LifecycleContext,
  impactedDerivations: Set<string>,
  storageConsequences: ReferenceLifecycleStorageConsequence[]
): ReferenceLifecyclePermissionConsequence[] {
  return [...ctx.uses]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((use) => {
      const paths = [...use.provenancePaths].sort(compareAuthorizedPaths);
      const direct = paths.find((path) => {
        const decision = ctx.accessDecisionByRef.get(refKey(path.accessDecisionRef));
        return (
          !authorizedPathAffected(ctx, path, impactedDerivations) &&
          decision !== undefined &&
          accessDecisionAllows(ctx, decision, use, path)
        );
      });
      if (direct) {
        return {
          useId: use.id,
          subjectRef: use.subjectRef,
          state: "accessible" as const,
          authorization: "direct" as const,
          activeEndpoint: endpointOf(direct),
          accessDecisionRef: direct.accessDecisionRef,
          replayability: use.baselineReplayability,
          readinessImpact: "unchanged" as const,
          sourceAvailability: "available" as const,
          reason: "An independently allowed exact complete provenance path survives.",
        };
      }

      const substitution = findAuthorizedSubstitution(ctx, use, paths, impactedDerivations);
      if (substitution) {
        return {
          useId: use.id,
          subjectRef: use.subjectRef,
          state: "accessible" as const,
          authorization: "provenance_substitution" as const,
          activeEndpoint: endpointOf(substitution.path),
          accessDecisionRef: substitution.path.accessDecisionRef,
          replayability: degradeReplayability(use.baselineReplayability),
          readinessImpact: "advisory" as const,
          sourceAvailability: "partially_reproducible" as const,
          reason:
            "An exact reviewed substitution authorizes the complete replacement provenance path.",
        };
      }

      const subjectState = storageConsequences.find((consequence) =>
        refsEqual(consequence.subjectRef, use.subjectRef)
      )?.state;
      return {
        useId: use.id,
        subjectRef: use.subjectRef,
        state: "restricted" as const,
        authorization: "none" as const,
        replayability:
          use.baselineReplayability === "legacy_unverifiable"
            ? "legacy_unverifiable"
            : "unavailable",
        readinessImpact:
          use.readinessRequirement === "required"
            ? ("blocked" as const)
            : use.readinessRequirement === "advisory"
              ? ("advisory" as const)
              : ("unchanged" as const),
        sourceAvailability:
          subjectState === "purged" || subjectState === "tombstone"
            ? ("not_reproducible" as const)
            : ("source_unavailable" as const),
        reason:
          "No independently allowed complete path or scope-matched reviewed substitution survives.",
      };
    });
}

function authorizedPathAffected(
  ctx: LifecycleContext,
  path: ReferenceLifecycleAuthorizedPath,
  impactedDerivations: Set<string>
): boolean {
  if (ctx.action.kind === "restrict_access") {
    return refsEqual(path.accessDecisionRef, ctx.action.targetAccessDecisionRef);
  }
  return (
    containsRef(path.acquisitionRefs, ctx.action.targetAcquisitionRef) ||
    path.derivationRefs.some((ref) => impactedDerivations.has(refKey(ref)))
  );
}

function accessDecisionAllows(
  ctx: LifecycleContext,
  decision: ReferenceAccessDecision,
  use: ReferenceLifecycleUse,
  path: ReferenceLifecycleAuthorizedPath
): boolean {
  if (
    decision.outcome !== "allow" ||
    !isCurrentAccessDecision(ctx, decision) ||
    ctx.invalidatedRefs.has(refKey(decision)) ||
    Date.parse(decision.decidedAt) > Date.parse(ctx.effectiveAt) ||
    (decision.validUntil !== undefined &&
      Date.parse(decision.validUntil) <= Date.parse(ctx.effectiveAt)) ||
    decision.operation !== use.operation ||
    !destinationsEqual(decision.destination, use.destination) ||
    !operationDestinationCompatible(decision.operation, decision.destination) ||
    decision.purpose !== use.purpose ||
    !refsEqual(decision.policyRef, use.policyRef) ||
    decision.assetRole !== use.assetRole
  ) {
    return false;
  }
  const requiredRefs = [...path.acquisitionRefs, ...path.derivationRefs, use.subjectRef];
  const decisionRefs = [...decision.sourceRefs, ...decision.derivativeRefs];
  if (requiredRefs.some((ref) => !containsRef(decisionRefs, ref))) return false;
  const closure = exactClosureForAuthorization(ctx, use.subjectRef, path);
  if (!closure) return false;
  if (use.assetRole && !hasExactRoleBinding(ctx, use, decision, closure)) return false;
  return accessDecisionHasCurrentAuthority(ctx, decision);
}

function accessDecisionHasCurrentAuthority(
  ctx: LifecycleContext,
  decision: ReferenceAccessDecision
): boolean {
  const assertions = decision.rightsAssertionRefs
    .map((ref) => ctx.rightsAssertionByRef.get(refKey(ref)))
    .filter((record): record is ReferenceRightsAssertion => record !== undefined);
  const affirmative = assertions.some(
    (assertion) =>
      isCurrentRightsAssertion(ctx, assertion) &&
      !ctx.invalidatedRefs.has(refKey(assertion)) &&
      ["public_domain", "licensed", "permitted"].includes(assertion.status) &&
      rightsKindSupportsOperation(assertion.rightsKind, decision.operation) &&
      (!assertion.validFrom || Date.parse(assertion.validFrom) <= Date.parse(ctx.effectiveAt)) &&
      (!assertion.validUntil || Date.parse(assertion.validUntil) > Date.parse(ctx.effectiveAt)) &&
      rightsAssertionConcernsDecision(ctx, assertion, decision)
  );
  if (affirmative) return true;
  const localOnly =
    decision.destination.kind === "local_runtime" &&
    ["owner_private_study", "local_extraction"].includes(decision.operation);
  return localOnly && decision.authorityRefs.length > 0;
}

function rightsKindSupportsOperation(
  rightsKind: ReferenceRightsAssertion["rightsKind"],
  operation: ReferenceAccessDecision["operation"]
): boolean {
  const required: Record<
    ReferenceAccessDecision["operation"],
    readonly ReferenceRightsAssertion["rightsKind"][]
  > = {
    underlying_work_use: ["underlying_work_status"],
    manifestation_use: ["manifestation_editorial"],
    exemplar_access: ["exemplar_restriction"],
    scan_provider_use: ["scan_provider_terms"],
    owner_private_study: ["owner_private_access"],
    local_extraction: ["local_extraction"],
    provider_ocr: ["named_provider_processing"],
    provider_omr: ["named_provider_processing"],
    provider_translation: ["named_provider_processing", "translation"],
    provider_model_processing: ["named_provider_processing"],
    pack_citation: ["pack_citation_excerpt"],
    pack_excerpt: ["pack_citation_excerpt"],
    fixture_inclusion: ["pack_citation_excerpt", "export_redistribution"],
    repository_inclusion: ["pack_citation_excerpt", "export_redistribution"],
    export: ["export_redistribution"],
    redistribution: ["export_redistribution"],
  };
  return required[operation].includes(rightsKind);
}

function rightsAssertionConcernsDecision(
  ctx: LifecycleContext,
  assertion: ReferenceRightsAssertion,
  decision: ReferenceAccessDecision
): boolean {
  const authorizedRefs = [...decision.sourceRefs, ...decision.derivativeRefs];
  if (containsRef(authorizedRefs, assertion.subjectRef)) return true;
  for (const authorizedRef of authorizedRefs) {
    const record = ctx.recordByRef.get(refKey(authorizedRef));
    if (
      record?.recordKind === "asset_acquisition" &&
      assertion.subjectKind === "digital_asset" &&
      refsEqual(record.digitalAssetRef, assertion.subjectRef)
    ) {
      return true;
    }
    if (record?.recordKind === "source_derivation") {
      if (
        assertion.subjectKind === "asset_acquisition" &&
        containsRef(record.sourceAcquisitionRefs, assertion.subjectRef)
      ) {
        return true;
      }
      if (
        assertion.subjectKind === "digital_asset" &&
        record.sourceAcquisitionRefs.some((ref) => {
          const acquisition = ctx.acquisitionByRef.get(refKey(ref));
          return acquisition && refsEqual(acquisition.digitalAssetRef, assertion.subjectRef);
        })
      ) {
        return true;
      }
    }
  }
  return false;
}

function findAuthorizedSubstitution(
  ctx: LifecycleContext,
  use: ReferenceLifecycleUse,
  removedPaths: ReferenceLifecycleAuthorizedPath[],
  impactedDerivations: Set<string>
): {
  substitution: ReferenceProvenanceSubstitution;
  path: ReferenceLifecycleAuthorizedPath;
} | null {
  if (ctx.action.kind !== "delete_acquisition") return null;
  for (const substitution of [...ctx.substitutions].sort(compareRecords)) {
    if (
      Date.parse(substitution.decidedAt) > Date.parse(ctx.effectiveAt) ||
      !removedPaths.some(
        (path) =>
          containsRef(path.acquisitionRefs, substitution.from.acquisitionRef) &&
          containsRef(path.derivationRefs, substitution.from.derivationRef) &&
          authorizedPathAffected(ctx, path, impactedDerivations)
      ) ||
      substitution.scope.operation !== use.operation ||
      !destinationsEqual(substitution.scope.destination, use.destination) ||
      substitution.scope.purpose !== use.purpose ||
      !refsEqual(substitution.scope.policyRef, use.policyRef) ||
      !containsRef(substitution.scope.sourceAndDerivativeRefs, use.subjectRef)
    ) {
      continue;
    }
    const terminal = ctx.derivationByRef.get(refKey(substitution.to.derivationRef));
    if (!terminal || !refsEqual(terminal.derivedRef, use.subjectRef)) continue;
    const closure = deriveClosure(ctx, terminal, new Set<string>());
    if (!closure) continue;
    const decision = ctx.accessDecisionByRef.get(refKey(substitution.accessDecisionRef));
    if (!decision) continue;
    const path: ReferenceLifecycleAuthorizedPath = {
      acquisitionRefs: closure.acquisitions.map(recordRef),
      derivationRefs: closure.derivations.map(recordRef),
      accessDecisionRef: recordRef(decision),
    };
    const requiredRefs = [
      substitution.from.acquisitionRef,
      substitution.from.derivationRef,
      substitution.to.acquisitionRef,
      substitution.to.derivationRef,
      ...path.acquisitionRefs,
      ...path.derivationRefs,
      use.subjectRef,
    ];
    const decisionRefs = [...decision.sourceRefs, ...decision.derivativeRefs];
    if (
      !containsRef(path.acquisitionRefs, substitution.to.acquisitionRef) ||
      requiredRefs.some(
        (ref) =>
          !containsRef(substitution.scope.sourceAndDerivativeRefs, ref) ||
          !containsRef(decisionRefs, ref)
      ) ||
      !substitutionAuthorityMatches(substitution, decision) ||
      !accessDecisionAllows(ctx, decision, use, path)
    ) {
      continue;
    }
    return { substitution, path };
  }
  return null;
}

function substitutionAuthorityMatches(
  substitution: ReferenceProvenanceSubstitution,
  decision: ReferenceAccessDecision
): boolean {
  return substitution.authority.kind === "policy"
    ? refsEqual(substitution.authority.authorityRef, substitution.scope.policyRef)
    : containsRef(decision.authorityRefs, substitution.authority.authorityRef);
}

function exactClosureForAuthorization(
  ctx: LifecycleContext,
  subjectRef: ReferenceRecordRef,
  path: ReferenceLifecycleAuthorizedPath
): ExactClosure | null {
  if (path.derivationRefs.length === 0) {
    const acquisition = ctx.acquisitionByRef.get(refKey(path.acquisitionRefs[0]!));
    return acquisition &&
      path.acquisitionRefs.length === 1 &&
      refsEqual(acquisition.digitalAssetRef, subjectRef)
      ? { acquisitions: [acquisition], derivations: [], terminal: null }
      : null;
  }
  const terminals = path.derivationRefs
    .map((ref) => ctx.derivationByRef.get(refKey(ref)))
    .filter(
      (record): record is ReferenceSourceDerivation =>
        record !== undefined && refsEqual(record.derivedRef, subjectRef)
    );
  if (terminals.length !== 1) return null;
  const closure = deriveClosure(ctx, terminals[0]!, new Set<string>());
  if (
    !closure ||
    !sameRefSet(path.acquisitionRefs, closure.acquisitions.map(recordRef)) ||
    !sameRefSet(path.derivationRefs, closure.derivations.map(recordRef))
  ) {
    return null;
  }
  return closure;
}

function hasExactRoleBinding(
  ctx: LifecycleContext,
  use: ReferenceLifecycleUse,
  decision: ReferenceAccessDecision,
  closure: ExactClosure
): boolean {
  if (!use.assetRole) return decision.assetRole === undefined;
  const kind =
    use.assetRole === "arrangement_source"
      ? "arrangement_source_binding"
      : use.assetRole === "owner_reference"
        ? "owner_reference_binding"
        : "evaluation_source_binding";
  return ctx.roleBindings.some(
    (binding) =>
      binding.recordKind === kind &&
      containsRef(binding.accessDecisionRefs, recordRef(decision)) &&
      closure.acquisitions.every((acquisition) =>
        containsRef(binding.acquisitionRefs, recordRef(acquisition))
      ) &&
      closure.acquisitions.every((acquisition) =>
        refsEqual(binding.digitalAssetRef, acquisition.digitalAssetRef)
      )
  );
}

function operationDestinationCompatible(
  operation: ReferenceAccessDecision["operation"],
  destination: ReferenceAccessDestination
): boolean {
  if (destination.kind === "local_runtime" ? destination.id !== undefined : !destination.id) {
    return false;
  }
  const permitted: Record<
    ReferenceAccessDecision["operation"],
    readonly ReferenceAccessDestination["kind"][]
  > = {
    underlying_work_use: ["local_runtime"],
    manifestation_use: ["local_runtime"],
    exemplar_access: ["local_runtime"],
    scan_provider_use: ["local_runtime"],
    owner_private_study: ["local_runtime"],
    local_extraction: ["local_runtime"],
    provider_ocr: ["provider"],
    provider_omr: ["provider"],
    provider_translation: ["provider"],
    provider_model_processing: ["provider"],
    pack_citation: ["repository"],
    pack_excerpt: ["repository"],
    fixture_inclusion: ["repository"],
    repository_inclusion: ["repository"],
    export: ["export", "recipient"],
    redistribution: ["recipient", "repository", "export"],
  };
  return permitted[operation].includes(destination.kind);
}

function isCurrentAccessDecision(
  ctx: LifecycleContext,
  decision: ReferenceAccessDecision
): boolean {
  const current = latestVersion(
    ctx.accessDecisions.filter(
      (candidate) =>
        candidate.id === decision.id &&
        Date.parse(candidate.decidedAt) <= Date.parse(ctx.effectiveAt)
    )
  );
  return current !== undefined && refsEqual(recordRef(current), recordRef(decision));
}

function isCurrentRightsAssertion(
  ctx: LifecycleContext,
  assertion: ReferenceRightsAssertion
): boolean {
  const current = latestVersion(
    ctx.rightsAssertions.filter(
      (candidate) =>
        candidate.id === assertion.id &&
        Date.parse(candidate.assertedAt) <= Date.parse(ctx.effectiveAt)
    )
  );
  return current !== undefined && refsEqual(recordRef(current), recordRef(assertion));
}

function acquisitionRefIsActive(ctx: LifecycleContext, ref: ReferenceRecordRef): boolean {
  const acquisition = ctx.acquisitionByRef.get(refKey(ref));
  return acquisition !== undefined && acquisitionIsActive(ctx, acquisition);
}

function acquisitionIsActive(
  ctx: LifecycleContext,
  acquisition: ReferenceAssetAcquisition
): boolean {
  if (Date.parse(acquisition.acquiredAt) > Date.parse(ctx.effectiveAt)) return false;
  if (
    ctx.action.kind === "delete_acquisition" &&
    refsEqual(recordRef(acquisition), ctx.action.targetAcquisitionRef)
  ) {
    return false;
  }
  return !ctx.acquisitions.some(
    (candidate) =>
      candidate.supersedesAcquisitionRef !== undefined &&
      refsEqual(candidate.supersedesAcquisitionRef, recordRef(acquisition)) &&
      Date.parse(candidate.acquiredAt) <= Date.parse(ctx.effectiveAt)
  );
}

function collectImpactedDerivations(
  targetAcquisitionRef: ReferenceRecordRef,
  derivations: ReferenceSourceDerivation[]
): Set<string> {
  const impacted = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const derivation of derivations) {
      const key = refKey(derivation);
      if (impacted.has(key)) continue;
      if (
        containsRef(derivation.sourceAcquisitionRefs, targetAcquisitionRef) ||
        derivation.sourceDerivationRefs.some((ref) => impacted.has(refKey(ref)))
      ) {
        impacted.add(key);
        changed = true;
      }
    }
  }
  return impacted;
}

function terminalForPath(
  ctx: LifecycleContext,
  path: { derivationRefs: ReferenceRecordRef[] },
  subjectRef: ReferenceRecordRef
): ReferenceSourceDerivation | null {
  const terminals = path.derivationRefs
    .map((ref) => ctx.derivationByRef.get(refKey(ref)))
    .filter(
      (record): record is ReferenceSourceDerivation =>
        record !== undefined && refsEqual(record.derivedRef, subjectRef)
    );
  return terminals.length === 1 ? terminals[0]! : null;
}

function selectEffectiveVersions<
  T extends { id: string; version: number; createdAt: string; digest: string },
>(records: T[], effectiveAt: string): T[] {
  const byId = new Map<string, T>();
  for (const record of records) {
    if (Date.parse(record.createdAt) > Date.parse(effectiveAt)) continue;
    const current = byId.get(record.id);
    if (
      !current ||
      record.version > current.version ||
      (record.version === current.version && record.digest.localeCompare(current.digest) > 0)
    ) {
      byId.set(record.id, record);
    }
  }
  return [...byId.values()].sort(compareRecords);
}

function latestVersion<T extends { version: number; digest: string }>(records: T[]): T | undefined {
  return [...records].sort(
    (left, right) => right.version - left.version || right.digest.localeCompare(left.digest)
  )[0];
}

function verifySnapshotDigest(snapshot: ReferenceSourceStagingSnapshot): boolean {
  const { digest, ...core } = snapshot;
  return referenceSourceDigest(core) === digest;
}

function sealPlan(value: Record<string, unknown>): ReferenceSourceLifecyclePlanResult {
  const seed = referenceSourceDigest(value);
  const withId = {
    ...value,
    id: "reference-lifecycle-plan." + seed.slice(0, 24),
  };
  const result = {
    ...withId,
    digest: referenceSourceDigest(withId),
  };
  if (!Value.Check(ReferenceSourceLifecyclePlanResultSchema, result)) {
    throw new Error("Reference-source lifecycle planner produced an invalid result");
  }
  return result as ReferenceSourceLifecyclePlanResult;
}

function readinessImpactFor(
  requirement: ReferenceLifecycleStoragePolicy["readinessRequirement"],
  state: ReferenceLifecycleState
): ReferenceLifecycleReadinessImpact {
  if (state === "accessible") return "unchanged";
  if (requirement === "required") return "blocked";
  if (requirement === "advisory") return "advisory";
  return "unchanged";
}

function degradeReplayability(
  replayability: ReferenceLifecycleReplayability
): ReferenceLifecycleReplayability {
  return replayability === "complete" ? "partial" : replayability;
}

function endpointOf(path: {
  acquisitionRefs: ReferenceRecordRef[];
  derivationRefs: ReferenceRecordRef[];
}): ReferenceLifecycleEndpoint {
  return {
    acquisitionRefs: uniqueSortedRefs(path.acquisitionRefs),
    derivationRefs: uniqueSortedRefs(path.derivationRefs),
  };
}

function pathKey(path: {
  acquisitionRefs: ReferenceRecordRef[];
  derivationRefs: ReferenceRecordRef[];
}): string {
  return (
    path.acquisitionRefs.map(refKey).sort().join("\u0001") +
    "\u0000" +
    path.derivationRefs.map(refKey).sort().join("\u0001")
  );
}

function hasDuplicatePaths(
  paths: Array<{ acquisitionRefs: ReferenceRecordRef[]; derivationRefs: ReferenceRecordRef[] }>
): boolean {
  const keys = paths.map(pathKey);
  return new Set(keys).size !== keys.length;
}

function sameRefSet(left: ReferenceRecordRef[], right: ReferenceRecordRef[]): boolean {
  if (left.length !== right.length) return false;
  const leftKeys = new Set(left.map(refKey));
  const rightKeys = new Set(right.map(refKey));
  if (leftKeys.size !== left.length || rightKeys.size !== right.length) return false;
  return [...leftKeys].every((key) => rightKeys.has(key));
}

function destinationsEqual(
  left: ReferenceAccessDestination,
  right: ReferenceAccessDestination
): boolean {
  return left.kind === right.kind && left.id === right.id;
}

function addIssue(
  ctx: LifecycleContext,
  code: ReferenceLifecyclePlanningIssue["code"],
  subjectRef: ReferenceRecordRef | undefined,
  detail: string
): void {
  ctx.issues.push({ code, ...(subjectRef ? { subjectRef } : {}), detail });
}

function sortIssues(issues: ReferenceLifecyclePlanningIssue[]): ReferenceLifecyclePlanningIssue[] {
  return [...issues]
    .sort((left, right) => {
      const code = left.code.localeCompare(right.code);
      if (code) return code;
      const ref = compareOptionalRefs(left.subjectRef, right.subjectRef);
      return ref || left.detail.localeCompare(right.detail);
    })
    .filter((issue, index, sorted) => {
      const prior = sorted[index - 1];
      return (
        !prior ||
        issue.code !== prior.code ||
        compareOptionalRefs(issue.subjectRef, prior.subjectRef) !== 0 ||
        issue.detail !== prior.detail
      );
    });
}

function indexRecords<T extends { id: string; digest: string }>(records: T[]): Map<string, T> {
  return new Map(records.map((record) => [refKey(record), record]));
}

function recordRef(record: { id: string; digest: string }): ReferenceRecordRef {
  return { id: record.id, digest: record.digest };
}

function refKey(ref: ReferenceRecordRef): string {
  return ref.id + "\u0000" + ref.digest;
}

function refsEqual(left: ReferenceRecordRef, right: ReferenceRecordRef): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function containsRef(refs: ReferenceRecordRef[], target: ReferenceRecordRef): boolean {
  return refs.some((ref) => refsEqual(ref, target));
}

function uniqueSortedRefs(refs: ReferenceRecordRef[]): ReferenceRecordRef[] {
  return [...new Map(refs.map((ref) => [refKey(ref), ref])).values()].sort(compareRefs);
}

function compareRefs(left: ReferenceRecordRef, right: ReferenceRecordRef): number {
  return left.id.localeCompare(right.id) || left.digest.localeCompare(right.digest);
}

function compareOptionalRefs(
  left: ReferenceRecordRef | undefined,
  right: ReferenceRecordRef | undefined
): number {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return compareRefs(left, right);
}

function compareRecords(
  left: { id: string; digest: string },
  right: { id: string; digest: string }
): number {
  return compareRefs(recordRef(left), recordRef(right));
}

function compareAuthorizedPaths(
  left: ReferenceLifecycleAuthorizedPath,
  right: ReferenceLifecycleAuthorizedPath
): number {
  return (
    pathKey(left).localeCompare(pathKey(right)) ||
    compareRefs(left.accessDecisionRef, right.accessDecisionRef)
  );
}

function isAssetAcquisition(
  record: ReferenceSourceStagingRecord
): record is ReferenceAssetAcquisition {
  return record.recordKind === "asset_acquisition";
}

function isSourceDerivation(
  record: ReferenceSourceStagingRecord
): record is ReferenceSourceDerivation {
  return record.recordKind === "source_derivation";
}

function isAccessDecision(record: ReferenceSourceStagingRecord): record is ReferenceAccessDecision {
  return record.recordKind === "access_decision";
}

function isRightsAssertion(
  record: ReferenceSourceStagingRecord
): record is ReferenceRightsAssertion {
  return record.recordKind === "rights_assertion";
}

function isProvenanceSubstitution(
  record: ReferenceSourceStagingRecord
): record is ReferenceProvenanceSubstitution {
  return record.recordKind === "provenance_substitution";
}

function isRoleBinding(record: ReferenceSourceStagingRecord): record is ReferenceAssetRoleBinding {
  return [
    "arrangement_source_binding",
    "owner_reference_binding",
    "evaluation_source_binding",
  ].includes(record.recordKind);
}

function isLifecycleStoragePolicy(
  record: ReferenceSourceStagingRecord
): record is ReferenceLifecycleStoragePolicy {
  return record.recordKind === "lifecycle_storage_policy";
}

function isLifecycleUse(record: ReferenceSourceStagingRecord): record is ReferenceLifecycleUse {
  return record.recordKind === "lifecycle_use";
}
