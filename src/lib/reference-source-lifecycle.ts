import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import {
  ReferenceAccessDecisionSchema,
  ReferenceAccessDestinationSchema,
  ReferenceAccessOperationSchema,
  ReferenceAssetAcquisitionSchema,
  ReferenceProvenanceSubstitutionSchema,
  ReferenceRecordRefSchema,
  ReferenceSourceDerivationSchema,
  verifyReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAccessDestination,
  type ReferenceAssetAcquisition,
  type ReferenceProvenanceSubstitution,
  type ReferenceRecordRef,
  type ReferenceSourceDerivation,
} from "./reference-source-domain.js";

const Strict = { additionalProperties: false } as const;
const IdSchema = Type.String({ minLength: 1 });
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

export const ReferenceLifecycleReplayabilitySchema = Type.Union([
  Type.Literal("complete"),
  Type.Literal("partial"),
  Type.Literal("unavailable"),
  Type.Literal("legacy_unverifiable"),
]);
export type ReferenceLifecycleReplayability = Static<typeof ReferenceLifecycleReplayabilitySchema>;

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
    acquisitionRef: ReferenceRecordRefSchema,
    derivationRef: Type.Optional(ReferenceRecordRefSchema),
  },
  Strict
);
export type ReferenceLifecycleEndpoint = Static<typeof ReferenceLifecycleEndpointSchema>;

const ReferenceLifecycleAuthorizedPathSchema = Type.Object(
  {
    acquisitionRef: ReferenceRecordRefSchema,
    derivationRef: Type.Optional(ReferenceRecordRefSchema),
    accessDecisionRef: ReferenceRecordRefSchema,
  },
  Strict
);
export type ReferenceLifecycleAuthorizedPath = Static<
  typeof ReferenceLifecycleAuthorizedPathSchema
>;

export const ReferenceLifecycleUseSchema = Type.Object(
  {
    id: IdSchema,
    subjectRef: ReferenceRecordRefSchema,
    provenancePaths: Type.Array(ReferenceLifecycleAuthorizedPathSchema, { minItems: 1 }),
    operation: ReferenceAccessOperationSchema,
    destination: ReferenceAccessDestinationSchema,
    purpose: Type.String({ minLength: 1 }),
    policyRef: ReferenceRecordRefSchema,
    baselineReplayability: ReferenceLifecycleReplayabilitySchema,
    readinessRequirement: Type.Union([
      Type.Literal("required"),
      Type.Literal("advisory"),
      Type.Literal("none"),
    ]),
  },
  Strict
);
export type ReferenceLifecycleUse = Static<typeof ReferenceLifecycleUseSchema>;

export const ReferenceLifecycleStorageSubjectKindSchema = Type.Union([
  Type.Literal("asset_bytes"),
  Type.Literal("segment"),
  Type.Literal("extraction"),
  Type.Literal("candidate"),
  Type.Literal("release"),
  Type.Literal("fixture"),
  Type.Literal("arrangement"),
  Type.Literal("evaluation"),
  Type.Literal("report"),
  Type.Literal("cache"),
  Type.Literal("backup"),
  Type.Literal("managed_export"),
  Type.Literal("unmanaged_disclosure"),
  Type.Literal("other_derivative"),
]);
export type ReferenceLifecycleStorageSubjectKind = Static<
  typeof ReferenceLifecycleStorageSubjectKindSchema
>;

const ReferenceLifecycleStorageProvenancePathSchema = Type.Object(
  {
    acquisitionRefs: Type.Array(ReferenceRecordRefSchema),
    derivationRefs: Type.Array(ReferenceRecordRefSchema),
  },
  Strict
);

export const ReferenceLifecycleStorageSubjectSchema = Type.Object(
  {
    subjectRef: ReferenceRecordRefSchema,
    subjectKind: ReferenceLifecycleStorageSubjectKindSchema,
    provenancePaths: Type.Array(ReferenceLifecycleStorageProvenancePathSchema, { minItems: 1 }),
    control: Type.Union([Type.Literal("vellum_controlled"), Type.Literal("unmanaged_recipient")]),
    retention: Type.Union([
      Type.Literal("unretained"),
      Type.Literal("encrypted_local_pin"),
      Type.Literal("required_hold"),
    ]),
    tombstonePolicy: Type.Union([Type.Literal("preserve"), Type.Literal("discard")]),
    replayRequirement: Type.Union([
      Type.Literal("required"),
      Type.Literal("optional"),
      Type.Literal("none"),
    ]),
    readinessRequirement: Type.Union([
      Type.Literal("required"),
      Type.Literal("advisory"),
      Type.Literal("none"),
    ]),
  },
  Strict
);
export type ReferenceLifecycleStorageSubject = Static<
  typeof ReferenceLifecycleStorageSubjectSchema
>;

export const ReferenceSourceLifecycleActionSchema = Type.Object(
  {
    kind: Type.Union([Type.Literal("restrict_acquisition"), Type.Literal("delete_acquisition")]),
    targetAcquisitionRef: ReferenceRecordRefSchema,
    reason: Type.String({ minLength: 1 }),
  },
  Strict
);
export type ReferenceSourceLifecycleAction = Static<typeof ReferenceSourceLifecycleActionSchema>;

export const ReferenceSourceLifecyclePlannerInputSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    baseSnapshotRef: ReferenceRecordRefSchema,
    effectiveAt: IsoTimestampSchema,
    action: ReferenceSourceLifecycleActionSchema,
    acquisitions: Type.Array(ReferenceAssetAcquisitionSchema, { minItems: 1 }),
    derivations: Type.Array(ReferenceSourceDerivationSchema),
    accessDecisions: Type.Array(ReferenceAccessDecisionSchema),
    substitutions: Type.Array(ReferenceProvenanceSubstitutionSchema),
    storageSubjects: Type.Array(ReferenceLifecycleStorageSubjectSchema),
    uses: Type.Array(ReferenceLifecycleUseSchema),
  },
  Strict
);
export type ReferenceSourceLifecyclePlannerInput = Static<
  typeof ReferenceSourceLifecyclePlannerInputSchema
>;

const ReferenceLifecycleIssueCodeSchema = Type.Union([
  Type.Literal("target_acquisition_not_found"),
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
    targetDigitalAssetRef: ReferenceRecordRefSchema,
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

/**
 * Build a deterministic, non-mutating deletion/restriction plan.
 *
 * Authorization is deliberately path-based. The planner never reads a content
 * hash and never treats two acquisitions of one DigitalAsset as interchangeable.
 * A use survives only through an already-authorized exact path or an exact,
 * scope-matched provenance-substitution record.
 */
export function planReferenceSourceLifecycle(
  input: ReferenceSourceLifecyclePlannerInput
): ReferenceSourceLifecyclePlanResult {
  if (!Value.Check(ReferenceSourceLifecyclePlannerInputSchema, input)) {
    throw new TypeError("Reference-source lifecycle input does not match the closed schema");
  }

  const acquisitions = [...input.acquisitions].sort(compareRecords);
  const derivations = [...input.derivations].sort(compareRecords);
  const accessDecisions = [...input.accessDecisions].sort(compareRecords);
  const substitutions = [...input.substitutions].sort(compareRecords);
  const storageSubjects = [...input.storageSubjects].sort((left, right) =>
    compareRefs(left.subjectRef, right.subjectRef)
  );
  const uses = [...input.uses].sort((left, right) => left.id.localeCompare(right.id));

  const acquisitionByRef = indexRecords(acquisitions);
  const derivationByRef = indexRecords(derivations);
  const accessDecisionByRef = indexRecords(accessDecisions);
  const substitutionByRef = indexRecords(substitutions);
  const issues: ReferenceLifecyclePlanningIssue[] = [];

  collectDuplicateExactRecordIssues(
    [acquisitions, derivations, accessDecisions, substitutions],
    issues
  );
  collectDigestIssues([acquisitions, derivations, accessDecisions, substitutions], issues);
  collectDuplicateSubjectIssues(storageSubjects, uses, issues);
  collectGraphIssues(
    acquisitions,
    derivations,
    accessDecisions,
    substitutions,
    storageSubjects,
    uses,
    acquisitionByRef,
    derivationByRef,
    accessDecisionByRef,
    issues
  );

  const target = acquisitionByRef.get(refKey(input.action.targetAcquisitionRef));
  if (!target) {
    issues.push({
      code: "target_acquisition_not_found",
      subjectRef: input.action.targetAcquisitionRef,
      detail: "The exact target acquisition id and digest are not present in the planning graph.",
    });
  }

  const targetAssetRef = target?.digitalAssetRef;
  const impactedDerivationKeys = target
    ? collectImpactedDerivations(input.action.targetAcquisitionRef, derivations)
    : new Set<string>();
  if (targetAssetRef) {
    const hasSurvivingAcquisition = acquisitions.some(
      (acquisition) =>
        !refsEqual(recordRef(acquisition), input.action.targetAcquisitionRef) &&
        refsEqual(acquisition.digitalAssetRef, targetAssetRef)
    );
    const assetPolicies = storageSubjects.filter(
      (subject) =>
        subject.subjectKind === "asset_bytes" && refsEqual(subject.subjectRef, targetAssetRef)
    );
    if (!hasSurvivingAcquisition && assetPolicies.length === 0) {
      issues.push({
        code: "missing_asset_storage_policy",
        subjectRef: targetAssetRef,
        detail:
          "The last acquisition cannot be removed without an explicit asset-byte retention and tombstone policy.",
      });
    }
    for (const derivation of derivations) {
      const derivationRef = recordRef(derivation);
      if (
        impactedDerivationKeys.has(refKey(derivationRef)) &&
        !storageSubjects.some((subject) =>
          subject.provenancePaths.some((path) => containsRef(path.derivationRefs, derivationRef))
        )
      ) {
        issues.push({
          code: "missing_derivative_storage_policy",
          subjectRef: derivationRef,
          detail:
            "Every affected derivation must be covered by an explicit controlled, pinned, tombstone, or disclosure lifecycle path.",
        });
      }
    }
  }

  const sortedIssues = sortIssues(issues);
  if (!target || sortedIssues.length > 0) {
    return checkedResult({
      schemaVersion: 1,
      mode: "dry_run",
      baseSnapshotRef: input.baseSnapshotRef,
      effectiveAt: input.effectiveAt,
      action: input.action,
      atomicity: "all_or_nothing",
      status: "blocked",
      issues: sortedIssues,
    });
  }

  const consequences = buildStorageConsequences(
    input,
    target,
    acquisitions,
    storageSubjects,
    impactedDerivationKeys
  );
  const permissions = buildPermissionConsequences(
    input,
    uses,
    acquisitionByRef,
    derivationByRef,
    accessDecisionByRef,
    substitutionByRef,
    impactedDerivationKeys,
    consequences
  );
  const allStates = [
    ...consequences.map((consequence) => consequence.state),
    ...permissions.map((permission) => permission.state),
  ];

  return checkedResult({
    schemaVersion: 1,
    mode: "dry_run",
    baseSnapshotRef: input.baseSnapshotRef,
    effectiveAt: input.effectiveAt,
    action: input.action,
    atomicity: "all_or_nothing",
    status: "ready",
    targetDigitalAssetRef: target.digitalAssetRef,
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

function collectDuplicateExactRecordIssues(
  groups: Array<Array<{ id: string; digest: string }>>,
  issues: ReferenceLifecyclePlanningIssue[]
): void {
  for (const records of groups) {
    const seen = new Set<string>();
    for (const record of records) {
      const key = refKey(recordRef(record));
      if (seen.has(key)) {
        issues.push({
          code: "duplicate_exact_record",
          subjectRef: recordRef(record),
          detail: "The same exact immutable record appears more than once.",
        });
      }
      seen.add(key);
    }
  }
}

function collectDigestIssues(
  groups: Array<Array<{ id: string; digest: string }>>,
  issues: ReferenceLifecyclePlanningIssue[]
): void {
  for (const record of groups.flat()) {
    if (!verifyReferenceRecordDigest(record)) {
      issues.push({
        code: "record_digest_invalid",
        subjectRef: recordRef(record),
        detail: "An immutable lifecycle input record does not match its canonical digest.",
      });
    }
  }
}

function collectDuplicateSubjectIssues(
  subjects: ReferenceLifecycleStorageSubject[],
  uses: ReferenceLifecycleUse[],
  issues: ReferenceLifecyclePlanningIssue[]
): void {
  const subjectKeys = new Set<string>();
  for (const subject of subjects) {
    const key = refKey(subject.subjectRef);
    if (subjectKeys.has(key)) {
      issues.push({
        code: "duplicate_storage_subject",
        subjectRef: subject.subjectRef,
        detail: "A storage subject must have one unambiguous lifecycle policy.",
      });
    }
    subjectKeys.add(key);
  }

  const useIds = new Set<string>();
  for (const use of uses) {
    if (useIds.has(use.id)) {
      issues.push({
        code: "duplicate_use",
        subjectRef: use.subjectRef,
        detail: `Lifecycle use ${use.id} appears more than once.`,
      });
    }
    useIds.add(use.id);
  }
}

function collectGraphIssues(
  acquisitions: ReferenceAssetAcquisition[],
  derivations: ReferenceSourceDerivation[],
  accessDecisions: ReferenceAccessDecision[],
  substitutions: ReferenceProvenanceSubstitution[],
  storageSubjects: ReferenceLifecycleStorageSubject[],
  uses: ReferenceLifecycleUse[],
  acquisitionByRef: Map<string, ReferenceAssetAcquisition>,
  derivationByRef: Map<string, ReferenceSourceDerivation>,
  accessDecisionByRef: Map<string, ReferenceAccessDecision>,
  issues: ReferenceLifecyclePlanningIssue[]
): void {
  for (const derivation of derivations) {
    for (const acquisitionRef of derivation.sourceAcquisitionRefs) {
      requireRef(acquisitionByRef, acquisitionRef, "dangling_acquisition_ref", issues);
    }
    for (const derivationRef of derivation.sourceDerivationRefs) {
      requireRef(derivationByRef, derivationRef, "dangling_derivation_ref", issues);
    }
  }
  collectDerivationCycleIssues(derivations, derivationByRef, issues);

  for (const use of uses) {
    for (const path of use.provenancePaths) {
      const acquisition = requireRef(
        acquisitionByRef,
        path.acquisitionRef,
        "dangling_acquisition_ref",
        issues
      );
      const derivation = path.derivationRef
        ? requireRef(derivationByRef, path.derivationRef, "dangling_derivation_ref", issues)
        : undefined;
      requireRef(
        accessDecisionByRef,
        path.accessDecisionRef,
        "dangling_access_decision_ref",
        issues
      );
      if (
        acquisition &&
        derivation &&
        !derivationDependsOnAcquisition(derivation, path.acquisitionRef, derivationByRef, new Set())
      ) {
        issues.push({
          code: "invalid_provenance_endpoint",
          subjectRef: use.subjectRef,
          detail: `Use ${use.id} pairs an acquisition with a derivation that does not descend from it.`,
        });
      }
    }
  }

  for (const substitution of substitutions) {
    const fromAcquisition = requireRef(
      acquisitionByRef,
      substitution.from.acquisitionRef,
      "dangling_acquisition_ref",
      issues
    );
    const toAcquisition = requireRef(
      acquisitionByRef,
      substitution.to.acquisitionRef,
      "dangling_acquisition_ref",
      issues
    );
    const fromDerivation = requireRef(
      derivationByRef,
      substitution.from.derivationRef,
      "dangling_derivation_ref",
      issues
    );
    const toDerivation = requireRef(
      derivationByRef,
      substitution.to.derivationRef,
      "dangling_derivation_ref",
      issues
    );
    const substitutionDecision = requireRef(
      accessDecisionByRef,
      substitution.accessDecisionRef,
      "dangling_access_decision_ref",
      issues
    );

    if (
      substitutionDecision &&
      !accessDecisionAuthorizesSubstitution(substitutionDecision, substitution)
    ) {
      issues.push({
        code: "invalid_substitution_authorization",
        subjectRef: recordRef(substitution),
        detail:
          "The substitution's Access Decision or authority does not authorize its exact endpoints and scope.",
      });
    }

    if (
      fromAcquisition &&
      fromDerivation &&
      !derivationDependsOnAcquisition(
        fromDerivation,
        substitution.from.acquisitionRef,
        derivationByRef,
        new Set()
      )
    ) {
      issues.push({
        code: "invalid_provenance_endpoint",
        subjectRef: recordRef(substitution),
        detail: "The substitution's from endpoint is not an exact acquisition/derivation path.",
      });
    }
    if (
      toAcquisition &&
      toDerivation &&
      !derivationDependsOnAcquisition(
        toDerivation,
        substitution.to.acquisitionRef,
        derivationByRef,
        new Set()
      )
    ) {
      issues.push({
        code: "invalid_provenance_endpoint",
        subjectRef: recordRef(substitution),
        detail: "The substitution's to endpoint is not an exact acquisition/derivation path.",
      });
    }
    if (
      fromAcquisition &&
      toAcquisition &&
      (!refsEqual(fromAcquisition.digitalAssetRef, toAcquisition.digitalAssetRef) ||
        (fromDerivation &&
          toDerivation &&
          !refsEqual(fromDerivation.derivedRef, toDerivation.derivedRef)))
    ) {
      issues.push({
        code: "invalid_provenance_endpoint",
        subjectRef: recordRef(substitution),
        detail:
          "A provenance substitution must preserve the exact DigitalAsset and derived subject identities.",
      });
    }
  }

  for (const subject of storageSubjects) {
    for (const path of subject.provenancePaths) {
      if (path.acquisitionRefs.length === 0 && path.derivationRefs.length === 0) {
        issues.push({
          code: "invalid_provenance_endpoint",
          subjectRef: subject.subjectRef,
          detail:
            "Every storage provenance path must name exact acquisition or derivation provenance.",
        });
      }
      for (const acquisitionRef of path.acquisitionRefs) {
        requireRef(acquisitionByRef, acquisitionRef, "dangling_acquisition_ref", issues);
      }
      for (const derivationRef of path.derivationRefs) {
        requireRef(derivationByRef, derivationRef, "dangling_derivation_ref", issues);
      }
      if (
        path.derivationRefs.length > 0 &&
        path.acquisitionRefs.some((acquisitionRef) =>
          path.derivationRefs.every((derivationRef) => {
            const derivation = derivationByRef.get(refKey(derivationRef));
            return (
              derivation === undefined ||
              !derivationDependsOnAcquisition(
                derivation,
                acquisitionRef,
                derivationByRef,
                new Set()
              )
            );
          })
        )
      ) {
        issues.push({
          code: "invalid_provenance_endpoint",
          subjectRef: subject.subjectRef,
          detail:
            "A storage path pairs an acquisition with derivations that do not descend from it.",
        });
      }
    }
    if (subject.subjectKind === "asset_bytes") {
      const valid =
        subject.provenancePaths.length > 0 &&
        subject.provenancePaths.every(
          (path) =>
            path.derivationRefs.length === 0 &&
            path.acquisitionRefs.length > 0 &&
            path.acquisitionRefs.every((acquisitionRef) => {
              const acquisition = acquisitionByRef.get(refKey(acquisitionRef));
              return acquisition && refsEqual(acquisition.digitalAssetRef, subject.subjectRef);
            })
        );
      if (!valid) {
        issues.push({
          code: "invalid_asset_storage_subject",
          subjectRef: subject.subjectRef,
          detail:
            "Asset-byte storage policy must name only exact acquisitions of that DigitalAsset and no derivations.",
        });
      }
    }
  }

  // Keep the parameter semantically visible: an empty set of Access Decisions is
  // valid, but every referenced decision was checked above.
  void acquisitions;
  void accessDecisions;
}

function collectDerivationCycleIssues(
  derivations: ReferenceSourceDerivation[],
  derivationByRef: Map<string, ReferenceSourceDerivation>,
  issues: ReferenceLifecyclePlanningIssue[]
): void {
  const complete = new Set<string>();
  const visiting = new Set<string>();

  const visit = (derivation: ReferenceSourceDerivation): void => {
    const key = refKey(recordRef(derivation));
    if (complete.has(key)) return;
    if (visiting.has(key)) {
      issues.push({
        code: "derivation_cycle",
        subjectRef: recordRef(derivation),
        detail: "The source-derivation graph contains a cycle.",
      });
      return;
    }
    visiting.add(key);
    for (const sourceRef of derivation.sourceDerivationRefs) {
      const source = derivationByRef.get(refKey(sourceRef));
      if (source) visit(source);
    }
    visiting.delete(key);
    complete.add(key);
  };

  for (const derivation of derivations) visit(derivation);
}

function buildStorageConsequences(
  input: ReferenceSourceLifecyclePlannerInput,
  target: ReferenceAssetAcquisition,
  acquisitions: ReferenceAssetAcquisition[],
  storageSubjects: ReferenceLifecycleStorageSubject[],
  impactedDerivationKeys: Set<string>
): ReferenceLifecycleStorageConsequence[] {
  const consequences: ReferenceLifecycleStorageConsequence[] = [];
  consequences.push({
    subjectRef: recordRef(target),
    subjectKind: "asset_acquisition",
    state: input.action.kind === "delete_acquisition" ? "tombstone" : "restricted",
    affectedByRefs: [input.action.targetAcquisitionRef],
    replayability: input.action.kind === "delete_acquisition" ? "unavailable" : "partial",
    readinessImpact: "advisory",
    irreversibleDisclosure: false,
    reason:
      input.action.kind === "delete_acquisition"
        ? "The acquisition edge is removed while its minimum immutable deletion metadata remains."
        : "The acquisition edge remains recorded but cannot authorize current processing.",
  });

  const assetPolicy = storageSubjects.find(
    (subject) =>
      subject.subjectKind === "asset_bytes" && refsEqual(subject.subjectRef, target.digitalAssetRef)
  );
  const survivingAcquisition = acquisitions.some(
    (acquisition) =>
      !refsEqual(recordRef(acquisition), input.action.targetAcquisitionRef) &&
      refsEqual(acquisition.digitalAssetRef, target.digitalAssetRef)
  );
  if (survivingAcquisition) {
    consequences.push({
      subjectRef: target.digitalAssetRef,
      subjectKind: "asset_bytes",
      state: "accessible",
      affectedByRefs: [input.action.targetAcquisitionRef],
      replayability: "complete",
      readinessImpact: "unchanged",
      irreversibleDisclosure: false,
      reason:
        "Shared bytes remain stored because a distinct exact acquisition edge survives; this does not transfer that edge's permissions.",
    });
  } else if (assetPolicy) {
    consequences.push(storageConsequence(assetPolicy, [input.action.targetAcquisitionRef]));
  }

  for (const subject of storageSubjects) {
    if (subject.subjectKind === "asset_bytes") continue;
    const pathEffects = subject.provenancePaths.map((path) => ({
      affected:
        path.acquisitionRefs.some((ref) => refsEqual(ref, input.action.targetAcquisitionRef)) ||
        path.derivationRefs.some((ref) => impactedDerivationKeys.has(refKey(ref))),
      refs: uniqueSortedRefs([
        ...(path.acquisitionRefs.some((ref) => refsEqual(ref, input.action.targetAcquisitionRef))
          ? [input.action.targetAcquisitionRef]
          : []),
        ...path.derivationRefs.filter((ref) => impactedDerivationKeys.has(refKey(ref))),
      ]),
    }));
    const affectedByRefs = uniqueSortedRefs(pathEffects.flatMap((effect) => effect.refs));
    if (pathEffects.every((effect) => !effect.affected)) {
      consequences.push({
        subjectRef: subject.subjectRef,
        subjectKind: subject.subjectKind,
        state: "accessible",
        affectedByRefs: [],
        replayability: "complete",
        readinessImpact: "unchanged",
        irreversibleDisclosure: false,
        reason:
          "No exact provenance path for this stored subject depends on the target acquisition.",
      });
    } else if (pathEffects.some((effect) => !effect.affected)) {
      consequences.push({
        subjectRef: subject.subjectRef,
        subjectKind: subject.subjectKind,
        state: "accessible",
        affectedByRefs,
        replayability: "complete",
        readinessImpact: "unchanged",
        irreversibleDisclosure: false,
        reason:
          "At least one independently recorded storage provenance path survives; operation-specific permission is evaluated separately.",
      });
    } else {
      consequences.push(storageConsequence(subject, affectedByRefs));
    }
  }

  return consequences.sort((left, right) => {
    const byRef = compareRefs(left.subjectRef, right.subjectRef);
    return byRef || left.subjectKind.localeCompare(right.subjectKind);
  });
}

function storageConsequence(
  subject: ReferenceLifecycleStorageSubject,
  affectedByRefs: ReferenceRecordRef[]
): ReferenceLifecycleStorageConsequence {
  let state: ReferenceLifecycleState;
  let reason: string;
  const irreversibleDisclosure = subject.control === "unmanaged_recipient";

  if (irreversibleDisclosure) {
    state = "tombstone";
    reason =
      "Vellum cannot recall an unmanaged disclosure; controlled copies are removed and a minimum disclosure tombstone remains.";
  } else if (subject.retention !== "unretained") {
    state = "restricted";
    reason =
      "Bytes remain under an explicit encrypted pin or required hold, but the removed provenance path cannot authorize use.";
  } else if (subject.tombstonePolicy === "preserve") {
    state = "tombstone";
    reason =
      "Content bytes are removed while non-sensitive provenance and deletion metadata remain.";
  } else {
    state = "purged";
    reason =
      "The Vellum-controlled subject is purged because its authorization depended on the removed path.";
  }

  return {
    subjectRef: subject.subjectRef,
    subjectKind: subject.subjectKind,
    state,
    affectedByRefs,
    replayability: state === "restricted" ? "partial" : "unavailable",
    readinessImpact: readinessImpactFor(subject.readinessRequirement, state),
    irreversibleDisclosure,
    reason,
  };
}

function buildPermissionConsequences(
  input: ReferenceSourceLifecyclePlannerInput,
  uses: ReferenceLifecycleUse[],
  acquisitionByRef: Map<string, ReferenceAssetAcquisition>,
  derivationByRef: Map<string, ReferenceSourceDerivation>,
  accessDecisionByRef: Map<string, ReferenceAccessDecision>,
  substitutionByRef: Map<string, ReferenceProvenanceSubstitution>,
  impactedDerivationKeys: Set<string>,
  storageConsequences: ReferenceLifecycleStorageConsequence[]
): ReferenceLifecyclePermissionConsequence[] {
  const substitutions = [...substitutionByRef.values()].sort(compareRecords);

  return uses.map((use) => {
    const sortedPaths = [...use.provenancePaths].sort(compareAuthorizedPaths);
    const direct = sortedPaths.find((path) => {
      const decision = accessDecisionByRef.get(refKey(path.accessDecisionRef));
      return (
        endpointSurvives(path, input.action.targetAcquisitionRef, impactedDerivationKeys) &&
        decision !== undefined &&
        accessDecisionAllows(decision, use, path, input.effectiveAt)
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
        reason:
          "An independently allowed exact acquisition/derivation path survives for this operation and destination.",
      };
    }

    const removedPaths = sortedPaths.filter((path) =>
      endpointAffected(path, input.action.targetAcquisitionRef, impactedDerivationKeys)
    );
    const substitution = substitutions.find((candidate) => {
      if (Date.parse(candidate.decidedAt) > Date.parse(input.effectiveAt)) return false;
      if (!removedPaths.some((path) => endpointsEqual(path, candidate.from))) return false;
      if (!substitutionScopeMatches(candidate, use)) return false;
      if (
        !endpointSurvives(candidate.to, input.action.targetAcquisitionRef, impactedDerivationKeys)
      ) {
        return false;
      }
      if (
        !acquisitionByRef.has(refKey(candidate.to.acquisitionRef)) ||
        !derivationByRef.has(refKey(candidate.to.derivationRef))
      ) {
        return false;
      }
      const decision = accessDecisionByRef.get(refKey(candidate.accessDecisionRef));
      return (
        decision !== undefined &&
        accessDecisionAllows(decision, use, candidate.to, input.effectiveAt) &&
        substitutionCoversExactRefs(candidate, use.subjectRef, decision)
      );
    });
    if (substitution) {
      return {
        useId: use.id,
        subjectRef: use.subjectRef,
        state: "accessible" as const,
        authorization: "provenance_substitution" as const,
        activeEndpoint: substitution.to,
        accessDecisionRef: substitution.accessDecisionRef,
        replayability: degradeReplayability(use.baselineReplayability),
        readinessImpact: "advisory" as const,
        sourceAvailability: "partially_reproducible" as const,
        reason:
          "A reviewed substitution authorizes this exact replacement path, operation, destination, purpose, and policy.",
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
        use.baselineReplayability === "legacy_unverifiable" ? "legacy_unverifiable" : "unavailable",
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
        "No independently allowed surviving exact path or scope-matched provenance substitution exists; shared bytes do not transfer permission.",
    };
  });
}

function accessDecisionAllows(
  decision: ReferenceAccessDecision,
  use: ReferenceLifecycleUse,
  endpoint: ReferenceLifecycleEndpoint,
  effectiveAt: string
): boolean {
  if (decision.outcome !== "allow") return false;
  if (Date.parse(decision.decidedAt) > Date.parse(effectiveAt)) return false;
  if (decision.operation !== use.operation) return false;
  if (!destinationsEqual(decision.destination, use.destination)) return false;
  if (decision.purpose !== use.purpose || !refsEqual(decision.policyRef, use.policyRef)) {
    return false;
  }
  if (decision.validUntil && Date.parse(decision.validUntil) < Date.parse(effectiveAt))
    return false;

  const coveredRefs = [...decision.sourceRefs, ...decision.derivativeRefs];
  const requiredRefs = [use.subjectRef, endpoint.acquisitionRef];
  if (endpoint.derivationRef) requiredRefs.push(endpoint.derivationRef);
  return requiredRefs.every((requiredRef) => containsRef(coveredRefs, requiredRef));
}

function accessDecisionAuthorizesSubstitution(
  decision: ReferenceAccessDecision,
  substitution: ReferenceProvenanceSubstitution
): boolean {
  if (
    decision.outcome !== "allow" ||
    decision.operation !== substitution.scope.operation ||
    !destinationsEqual(decision.destination, substitution.scope.destination) ||
    decision.purpose !== substitution.scope.purpose ||
    !refsEqual(decision.policyRef, substitution.scope.policyRef)
  ) {
    return false;
  }

  const endpointRefs = [
    substitution.from.acquisitionRef,
    substitution.from.derivationRef,
    substitution.to.acquisitionRef,
    substitution.to.derivationRef,
  ];
  const decisionRefs = [...decision.sourceRefs, ...decision.derivativeRefs];
  if (
    !endpointRefs.every((endpointRef) =>
      containsRef(substitution.scope.sourceAndDerivativeRefs, endpointRef)
    ) ||
    !substitution.scope.sourceAndDerivativeRefs.every((scopeRef) =>
      containsRef(decisionRefs, scopeRef)
    )
  ) {
    return false;
  }

  return substitution.authority.kind === "policy"
    ? refsEqual(substitution.authority.authorityRef, substitution.scope.policyRef)
    : containsRef(decision.authorityRefs, substitution.authority.authorityRef);
}

function substitutionScopeMatches(
  substitution: ReferenceProvenanceSubstitution,
  use: ReferenceLifecycleUse
): boolean {
  return (
    substitution.scope.operation === use.operation &&
    destinationsEqual(substitution.scope.destination, use.destination) &&
    substitution.scope.purpose === use.purpose &&
    refsEqual(substitution.scope.policyRef, use.policyRef) &&
    containsRef(substitution.scope.sourceAndDerivativeRefs, use.subjectRef)
  );
}

function substitutionCoversExactRefs(
  substitution: ReferenceProvenanceSubstitution,
  subjectRef: ReferenceRecordRef,
  decision: ReferenceAccessDecision
): boolean {
  const endpoints = [
    substitution.from.acquisitionRef,
    substitution.from.derivationRef,
    substitution.to.acquisitionRef,
    substitution.to.derivationRef,
    subjectRef,
  ];
  const scopeRefs = substitution.scope.sourceAndDerivativeRefs;
  const decisionRefs = [...decision.sourceRefs, ...decision.derivativeRefs];
  return endpoints.every(
    (endpointRef) => containsRef(scopeRefs, endpointRef) && containsRef(decisionRefs, endpointRef)
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
      const key = refKey(recordRef(derivation));
      if (impacted.has(key)) continue;
      if (
        containsRef(derivation.sourceAcquisitionRefs, targetAcquisitionRef) ||
        derivation.sourceDerivationRefs.some((sourceRef) => impacted.has(refKey(sourceRef)))
      ) {
        impacted.add(key);
        changed = true;
      }
    }
  }
  return impacted;
}

function derivationDependsOnAcquisition(
  derivation: ReferenceSourceDerivation,
  acquisitionRef: ReferenceRecordRef,
  derivationByRef: Map<string, ReferenceSourceDerivation>,
  visited: Set<string>
): boolean {
  if (containsRef(derivation.sourceAcquisitionRefs, acquisitionRef)) return true;
  const key = refKey(recordRef(derivation));
  if (visited.has(key)) return false;
  visited.add(key);
  return derivation.sourceDerivationRefs.some((sourceRef) => {
    const source = derivationByRef.get(refKey(sourceRef));
    return (
      source !== undefined &&
      derivationDependsOnAcquisition(source, acquisitionRef, derivationByRef, visited)
    );
  });
}

function endpointAffected(
  endpoint: ReferenceLifecycleEndpoint,
  targetAcquisitionRef: ReferenceRecordRef,
  impactedDerivationKeys: Set<string>
): boolean {
  return (
    refsEqual(endpoint.acquisitionRef, targetAcquisitionRef) ||
    (endpoint.derivationRef !== undefined &&
      impactedDerivationKeys.has(refKey(endpoint.derivationRef)))
  );
}

function endpointSurvives(
  endpoint: ReferenceLifecycleEndpoint,
  targetAcquisitionRef: ReferenceRecordRef,
  impactedDerivationKeys: Set<string>
): boolean {
  return !endpointAffected(endpoint, targetAcquisitionRef, impactedDerivationKeys);
}

function endpointsEqual(
  left: ReferenceLifecycleEndpoint,
  right: { acquisitionRef: ReferenceRecordRef; derivationRef: ReferenceRecordRef }
): boolean {
  return (
    left.derivationRef !== undefined &&
    refsEqual(left.acquisitionRef, right.acquisitionRef) &&
    refsEqual(left.derivationRef, right.derivationRef)
  );
}

function endpointOf(path: ReferenceLifecycleAuthorizedPath): ReferenceLifecycleEndpoint {
  return path.derivationRef
    ? { acquisitionRef: path.acquisitionRef, derivationRef: path.derivationRef }
    : { acquisitionRef: path.acquisitionRef };
}

function readinessImpactFor(
  requirement: ReferenceLifecycleStorageSubject["readinessRequirement"],
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
  if (replayability === "complete") return "partial";
  return replayability;
}

function destinationsEqual(
  left: ReferenceAccessDestination,
  right: ReferenceAccessDestination
): boolean {
  return left.kind === right.kind && left.id === right.id;
}

function indexRecords<T extends { id: string; digest: string }>(records: T[]): Map<string, T> {
  const result = new Map<string, T>();
  for (const record of records) result.set(refKey(recordRef(record)), record);
  return result;
}

function requireRef<T>(
  records: Map<string, T>,
  ref: ReferenceRecordRef,
  code: "dangling_acquisition_ref" | "dangling_derivation_ref" | "dangling_access_decision_ref",
  issues: ReferenceLifecyclePlanningIssue[]
): T | undefined {
  const record = records.get(refKey(ref));
  if (!record) {
    issues.push({
      code,
      subjectRef: ref,
      detail: "An exact id-and-digest reference does not resolve in the lifecycle planning graph.",
    });
  }
  return record;
}

function recordRef(record: { id: string; digest: string }): ReferenceRecordRef {
  return { id: record.id, digest: record.digest };
}

function refKey(ref: ReferenceRecordRef): string {
  return `${ref.id}\u0000${ref.digest}`;
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
    compareRefs(left.acquisitionRef, right.acquisitionRef) ||
    compareOptionalRefs(left.derivationRef, right.derivationRef) ||
    compareRefs(left.accessDecisionRef, right.accessDecisionRef)
  );
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

function sortIssues(issues: ReferenceLifecyclePlanningIssue[]): ReferenceLifecyclePlanningIssue[] {
  return [...issues]
    .sort((left, right) => {
      const byCode = left.code.localeCompare(right.code);
      if (byCode) return byCode;
      const byRef = compareOptionalRefs(left.subjectRef, right.subjectRef);
      return byRef || left.detail.localeCompare(right.detail);
    })
    .filter((issue, index, sorted) => {
      if (index === 0) return true;
      const prior = sorted[index - 1];
      return (
        issue.code !== prior.code ||
        compareOptionalRefs(issue.subjectRef, prior.subjectRef) !== 0 ||
        issue.detail !== prior.detail
      );
    });
}

function checkedResult<T extends ReferenceSourceLifecyclePlanResult>(value: T): T {
  if (!Value.Check(ReferenceSourceLifecyclePlanResultSchema, value)) {
    throw new Error("Reference-source lifecycle planner produced an invalid result");
  }
  return value;
}
