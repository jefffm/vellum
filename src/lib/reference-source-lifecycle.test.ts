import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ReferenceSourceLifecycleComputationResultSchema,
  ReferenceSourceLifecyclePlanResultSchema,
  ReferenceSourceLifecyclePlannerInputSchema,
  planReferenceSourceLifecycle,
  type ReferenceLifecycleStorageSubject,
  type ReferenceLifecycleUse,
  type ReferenceSourceLifecyclePlannerInput,
} from "./reference-source-lifecycle.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAccessDestination,
  type ReferenceAccessOperation,
  type ReferenceAssetAcquisition,
  type ReferenceAssetRole,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceDerivation,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingSnapshot,
} from "./reference-source-domain.js";

const EARLY = "2026-07-15T08:00:00.000Z";
const MID = "2026-07-15T10:00:00.000Z";
const NOW = "2026-07-15T12:00:00.000Z";
const POLICY_REF = ref("policy.access", "b");
const LIFECYCLE_POLICY_REF = ref("policy.lifecycle", "c");
const SUBJECT_REF = ref("derivative.arrangement", "d");

function ref(id: string, fill = "e"): ReferenceRecordRef {
  return { id, digest: fill.repeat(64) };
}

function recordRef(record: { id: string; digest: string }): ReferenceRecordRef {
  return { id: record.id, digest: record.digest };
}

function uniqueRecordRefs(refs: ReferenceRecordRef[]): ReferenceRecordRef[] {
  return [...new Map(refs.map((item) => [`${item.id}\u0000${item.digest}`, item])).values()];
}

function asset(id = "asset.shared", fill = "a"): ReferenceDigitalAsset {
  return withReferenceRecordDigest({
    recordKind: "digital_asset",
    id,
    sha256: fill.repeat(64),
    mediaType: "application/pdf",
    byteLength: 2048,
  }) as ReferenceDigitalAsset;
}

function rights(options: {
  id: string;
  asset: ReferenceDigitalAsset;
  kind?: ReferenceRightsAssertion["rightsKind"];
  status?: ReferenceRightsAssertion["status"];
  version?: number;
  parent?: ReferenceRightsAssertion;
  assertedAt?: string;
}): ReferenceRightsAssertion {
  return withReferenceRecordDigest({
    recordKind: "rights_assertion",
    id: options.id,
    version: options.version ?? 1,
    ...(options.parent
      ? {
          parentVersionRef: {
            ...recordRef(options.parent),
            version: options.parent.version,
          },
        }
      : {}),
    subjectRef: recordRef(options.asset),
    subjectKind: "digital_asset",
    rightsKind: options.kind ?? "export_redistribution",
    status: options.status ?? "permitted",
    claimant: { kind: "reviewer", claimantRef: ref("reviewer.rights") },
    evidenceRefs: [ref("evidence.rights")],
    assertedAt: options.assertedAt ?? EARLY,
  }) as ReferenceRightsAssertion;
}

function acquisition(options: {
  id: string;
  asset: ReferenceDigitalAsset;
  rights: ReferenceRightsAssertion;
  acquiredAt?: string;
}): ReferenceAssetAcquisition {
  return withReferenceRecordDigest({
    recordKind: "asset_acquisition",
    id: options.id,
    digitalAssetRef: recordRef(options.asset),
    representedExemplarRefs: [],
    origin: { sourceKind: "upload", ownerActionRef: ref("owner-action." + options.id) },
    acquiredAt: options.acquiredAt ?? EARLY,
    rightsAssertionRefs: [recordRef(options.rights)],
    processingPolicyRef: POLICY_REF,
  }) as ReferenceAssetAcquisition;
}

function derivation(options: {
  id: string;
  acquisitions: ReferenceAssetAcquisition[];
  derivedRef?: ReferenceRecordRef;
  sources?: ReferenceSourceDerivation[];
  kind?: ReferenceSourceDerivation["derivationKind"];
  createdAt?: string;
}): ReferenceSourceDerivation {
  return withReferenceRecordDigest({
    recordKind: "source_derivation",
    id: options.id,
    derivationKind: options.kind ?? "extraction",
    inputRefs:
      options.sources && options.sources.length > 0
        ? options.sources.map((source) => source.derivedRef)
        : options.acquisitions.map((item) => item.digitalAssetRef),
    sourceAcquisitionRefs: options.acquisitions.map(recordRef),
    sourceDerivationRefs: (options.sources ?? []).map(recordRef),
    derivedRef: options.derivedRef ?? SUBJECT_REF,
    componentRef: ref("component.extractor"),
    configurationDigest: "f".repeat(64),
    createdAt: options.createdAt ?? MID,
  }) as ReferenceSourceDerivation;
}

function closurePath(
  acquisitions: ReferenceAssetAcquisition[],
  derivations: ReferenceSourceDerivation[]
): { acquisitionRefs: ReferenceRecordRef[]; derivationRefs: ReferenceRecordRef[] } {
  return {
    acquisitionRefs: acquisitions.map(recordRef),
    derivationRefs: derivations.map(recordRef),
  };
}

function accessDecision(options: {
  id: string;
  rights: ReferenceRightsAssertion[];
  acquisitions: ReferenceAssetAcquisition[];
  derivations?: ReferenceSourceDerivation[];
  subjectRef?: ReferenceRecordRef;
  operation?: ReferenceAccessOperation;
  destination?: ReferenceAccessDestination;
  purpose?: string;
  assetRole?: ReferenceAssetRole;
  validUntil?: string;
}): ReferenceAccessDecision {
  return withReferenceRecordDigest({
    recordKind: "access_decision",
    id: options.id,
    version: 1,
    outcome: "allow",
    operation: options.operation ?? "repository_inclusion",
    sourceRefs: uniqueRecordRefs([
      ...options.acquisitions.map(recordRef),
      ...options.acquisitions.map((item) => item.digitalAssetRef),
    ]),
    derivativeRefs: [
      ...(options.derivations ?? []).map(recordRef),
      options.subjectRef ?? SUBJECT_REF,
    ],
    destination: options.destination ?? { kind: "repository", id: "repo.vellum" },
    purpose: options.purpose ?? "Publish reviewed development fixture",
    ...(options.assetRole ? { assetRole: options.assetRole } : {}),
    policyRef: POLICY_REF,
    rightsAssertionRefs: options.rights.map(recordRef),
    authorityRefs: [ref("reviewer.rights")],
    rationale: "Exact operation and full provenance closure were reviewed",
    decidedAt: MID,
    ...(options.validUntil ? { validUntil: options.validUntil } : {}),
  }) as ReferenceAccessDecision;
}

function storagePolicy(options: {
  id: string;
  subjectRef: ReferenceRecordRef;
  subjectKind: ReferenceLifecycleStorageSubject["subjectKind"];
  paths: ReferenceLifecycleStorageSubject["provenancePaths"];
  custody?: ReferenceLifecycleStorageSubject["custody"];
  replayRequirement?: ReferenceLifecycleStorageSubject["replayRequirement"];
  readinessRequirement?: ReferenceLifecycleStorageSubject["readinessRequirement"];
}): ReferenceLifecycleStorageSubject {
  return withReferenceRecordDigest({
    recordKind: "lifecycle_storage_policy",
    id: options.id,
    version: 1,
    subjectRef: options.subjectRef,
    subjectKind: options.subjectKind,
    provenancePaths: options.paths,
    policyRef: LIFECYCLE_POLICY_REF,
    custody:
      options.custody ??
      ({
        kind: "vellum_controlled",
        storeIds: ["reference-source-staging"],
        retention: "unretained",
        tombstonePolicy: "discard",
      } as const),
    replayRequirement: options.replayRequirement ?? "required",
    readinessRequirement: options.readinessRequirement ?? "required",
    createdAt: NOW,
  }) as ReferenceLifecycleStorageSubject;
}

function lifecycleUse(options: {
  id: string;
  subjectRef: ReferenceRecordRef;
  path: ReturnType<typeof closurePath>;
  decision: ReferenceAccessDecision;
  operation?: ReferenceAccessOperation;
  destination?: ReferenceAccessDestination;
  purpose?: string;
  assetRole?: ReferenceAssetRole;
  roleBindingRef?: ReferenceRecordRef;
  readinessRequirement?: ReferenceLifecycleUse["readinessRequirement"];
}): ReferenceLifecycleUse {
  return withReferenceRecordDigest({
    recordKind: "lifecycle_use",
    id: options.id,
    version: 1,
    subjectRef: options.subjectRef,
    provenancePaths: [
      {
        ...options.path,
        accessDecisionRef: recordRef(options.decision),
        ...(options.roleBindingRef ? { roleBindingRef: options.roleBindingRef } : {}),
      },
    ],
    operation: options.operation ?? "repository_inclusion",
    destination: options.destination ?? { kind: "repository", id: "repo.vellum" },
    purpose: options.purpose ?? "Publish reviewed development fixture",
    ...(options.assetRole ? { assetRole: options.assetRole } : {}),
    policyRef: POLICY_REF,
    baselineReplayability: "complete",
    readinessRequirement: options.readinessRequirement ?? "required",
    createdAt: NOW,
  }) as ReferenceLifecycleUse;
}

function assetPolicy(
  digitalAsset: ReferenceDigitalAsset,
  acquisitions: ReferenceAssetAcquisition[],
  custody?: ReferenceLifecycleStorageSubject["custody"]
): ReferenceLifecycleStorageSubject {
  return storagePolicy({
    id: "storage." + digitalAsset.id,
    subjectRef: recordRef(digitalAsset),
    subjectKind: "asset_bytes",
    paths: acquisitions.map((item) => closurePath([item], [])),
    ...(custody ? { custody } : {}),
  });
}

function snapshot(records: ReferenceSourceStagingRecord[]): ReferenceSourceStagingSnapshot {
  const core = {
    schemaVersion: 1 as const,
    id: "reference-source-snapshot.test",
    revision: 1,
    publicationState: "staging_only" as const,
    createdAt: NOW,
    recordObservations: records.map((record) => ({
      recordRef: recordRef(record),
      firstObservedRevision: 1,
      observedAt: NOW,
      orderingTrust: "server_observed" as const,
    })),
    records,
  };
  return { ...core, digest: referenceSourceDigest(core) };
}

function plannerInput(
  records: ReferenceSourceStagingRecord[],
  action: ReferenceSourceLifecyclePlannerInput["action"],
  observedRevisions: Readonly<Record<string, number>> = {}
): ReferenceSourceLifecyclePlannerInput {
  const revision = Math.max(1, ...Object.values(observedRevisions));
  const baseSnapshot = snapshot(records);
  const snapshotCore = {
    ...baseSnapshot,
    revision,
    recordObservations: records.map((record) => ({
      recordRef: recordRef(record),
      firstObservedRevision: observedRevisions[record.id] ?? 1,
      observedAt: NOW,
      orderingTrust: "server_observed" as const,
    })),
  };
  const { digest: _digest, ...core } = snapshotCore;
  return {
    schemaVersion: 1,
    baseSnapshot: { ...core, digest: referenceSourceDigest(core) },
    effectiveAt: NOW,
    action,
    retentionOutcomes: [],
  };
}

function selfAuthoredEvidence() {
  const core = {
    schemaVersion: 1 as const,
    validatedAt: NOW,
    requiredStoreRegistryRef: ref("registry.test", "1"),
    inventoryWitnessRef: ref("inventory.test", "2"),
    stores: [
      {
        storeId: "reference-source-staging",
        storeGeneration: 1,
        storeStateDigest: "3".repeat(64),
        enumerationDigest: "4".repeat(64),
      },
    ],
    authorityEvaluations: [],
    retentionEvaluations: [],
  };
  const seed = referenceSourceDigest(core);
  const identified = {
    ...core,
    id: `reference-lifecycle-preflight.${seed.slice(0, 24)}`,
  };
  return { ...identified, digest: referenceSourceDigest(identified) };
}

function deleteAction(
  target: ReferenceAssetAcquisition
): ReferenceSourceLifecyclePlannerInput["action"] {
  return {
    kind: "delete_acquisition",
    targetAcquisitionRef: recordRef(target),
    reason: "Owner requested a rights-safe lifecycle dry run",
  };
}

describe("reference-source lifecycle planner", () => {
  it("cannot be induced to emit a ready plan with self-authored digest-only evidence", () => {
    const digitalAsset = asset();
    const assertion = rights({ id: "rights.preflight", asset: digitalAsset });
    const acquisitionRecord = acquisition({
      id: "acquisition.preflight",
      asset: digitalAsset,
      rights: assertion,
    });
    const input = plannerInput(
      [digitalAsset, assertion, acquisitionRecord, assetPolicy(digitalAsset, [acquisitionRecord])],
      deleteAction(acquisitionRecord)
    );
    const result = planReferenceSourceLifecycle(input);

    expect((result as { status: string }).status).not.toBe("ready");
    expect(result.status).toBe("computed");
    expect("verifiedEvidence" in result).toBe(false);
    expect(Value.Check(ReferenceSourceLifecycleComputationResultSchema, result)).toBe(true);
    expect(Value.Check(ReferenceSourceLifecyclePlanResultSchema, result)).toBe(false);
    expect(() =>
      planReferenceSourceLifecycle({
        ...input,
        verifiedEvidence: selfAuthoredEvidence(),
      } as ReferenceSourceLifecyclePlannerInput)
    ).toThrow(/closed schema/);
  });

  it("is closed-schema, digest-bound, deterministic, and non-mutating", () => {
    const digitalAsset = asset();
    const assertion = rights({ id: "rights.asset", asset: digitalAsset });
    const only = acquisition({ id: "acquisition.only", asset: digitalAsset, rights: assertion });
    const input = plannerInput(
      [
        digitalAsset,
        assertion,
        only,
        assetPolicy(digitalAsset, [only], {
          kind: "vellum_controlled",
          storeIds: ["reference-source-staging"],
          retention: "unretained",
          tombstonePolicy: "preserve",
        }),
      ],
      deleteAction(only)
    );
    const before = structuredClone(input);
    const first = planReferenceSourceLifecycle(input);
    const second = planReferenceSourceLifecycle(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      mode: "dry_run",
      status: "computed",
      atomicity: "all_or_nothing",
    });
    expect(Value.Check(ReferenceSourceLifecycleComputationResultSchema, first)).toBe(true);
    const { digest, ...sealed } = first;
    expect(referenceSourceDigest(sealed)).toBe(digest);
    expect(input).toEqual(before);
    expect(
      Value.Check(ReferenceSourceLifecyclePlannerInputSchema, {
        ...input,
        acquisitions: [only],
      })
    ).toBe(false);
    expect(() =>
      planReferenceSourceLifecycle({
        ...input,
        publish: true,
      } as ReferenceSourceLifecyclePlannerInput)
    ).toThrow(/closed schema/);
  });

  it("is acquisition-order invariant and never borrows a sibling path's rights", () => {
    const digitalAsset = asset();
    const repoRights = rights({ id: "rights.repo", asset: digitalAsset });
    const localRights = rights({
      id: "rights.local",
      asset: digitalAsset,
      kind: "local_extraction",
    });
    const removed = acquisition({
      id: "acquisition.removed",
      asset: digitalAsset,
      rights: repoRights,
    });
    const sibling = acquisition({
      id: "acquisition.sibling",
      asset: digitalAsset,
      rights: localRights,
    });
    const removedDerivation = derivation({
      id: "derivation.removed",
      acquisitions: [removed],
    });
    const siblingDerivation = derivation({
      id: "derivation.sibling",
      acquisitions: [sibling],
    });
    const repoDecision = accessDecision({
      id: "access.repo",
      rights: [repoRights],
      acquisitions: [removed],
      derivations: [removedDerivation],
    });
    const localDecision = accessDecision({
      id: "access.local",
      rights: [localRights],
      acquisitions: [sibling],
      derivations: [siblingDerivation],
      operation: "local_extraction",
      destination: { kind: "local_runtime" },
      purpose: "Extract for private local study",
    });
    const use = lifecycleUse({
      id: "use.repository",
      subjectRef: SUBJECT_REF,
      path: closurePath([removed], [removedDerivation]),
      decision: repoDecision,
    });
    const derivativePolicy = storagePolicy({
      id: "storage.arrangement",
      subjectRef: SUBJECT_REF,
      subjectKind: "extraction",
      paths: [
        closurePath([removed], [removedDerivation]),
        closurePath([sibling], [siblingDerivation]),
      ],
    });
    const common: ReferenceSourceStagingRecord[] = [
      digitalAsset,
      repoRights,
      localRights,
      removedDerivation,
      siblingDerivation,
      repoDecision,
      localDecision,
      derivativePolicy,
      use,
    ];

    const removedFirst = planReferenceSourceLifecycle(
      plannerInput(
        [removed, sibling, ...common, assetPolicy(digitalAsset, [removed, sibling])],
        deleteAction(removed)
      )
    );
    const siblingFirst = planReferenceSourceLifecycle(
      plannerInput(
        [sibling, removed, ...common, assetPolicy(digitalAsset, [removed, sibling])],
        deleteAction(removed)
      )
    );

    expect(removedFirst.status).toBe("computed");
    expect(siblingFirst.status).toBe("computed");
    if (removedFirst.status !== "computed" || siblingFirst.status !== "computed") return;
    expect(removedFirst.consequences).toEqual(siblingFirst.consequences);
    expect(removedFirst.permissions).toEqual(siblingFirst.permissions);
    expect(removedFirst.permissions).toMatchObject([
      { useId: "use.repository", state: "restricted", authorization: "none" },
    ]);
    expect(
      removedFirst.consequences.find((item) => item.subjectKind === "asset_bytes")
    ).toMatchObject({ state: "accessible" });

    const deleteSibling = planReferenceSourceLifecycle(
      plannerInput(
        [removed, sibling, ...common, assetPolicy(digitalAsset, [removed, sibling])],
        deleteAction(sibling)
      )
    );
    expect(deleteSibling).toMatchObject({
      status: "computed",
      permissions: [{ useId: "use.repository", state: "accessible", authorization: "direct" }],
    });
  });

  it("uses only an observed reviewed substitution with the exact replacement role binding", () => {
    const digitalAsset = asset();
    const assertion = rights({
      id: "rights.owner-private-substitution",
      asset: digitalAsset,
      kind: "owner_private_access",
    });
    const removed = acquisition({
      id: "acquisition.substitution.removed",
      asset: digitalAsset,
      rights: assertion,
    });
    const replacement = acquisition({
      id: "acquisition.substitution.replacement",
      asset: digitalAsset,
      rights: assertion,
    });
    const removedDerivation = derivation({
      id: "derivation.substitution.removed",
      acquisitions: [removed],
    });
    const replacementDerivation = derivation({
      id: "derivation.substitution.replacement",
      acquisitions: [replacement],
    });
    const purpose = "Use an exact Owner-reviewed local replacement path";
    const removedDecision = accessDecision({
      id: "access.substitution.removed",
      rights: [assertion],
      acquisitions: [removed],
      derivations: [removedDerivation],
      operation: "owner_private_study",
      destination: { kind: "local_runtime" },
      purpose,
      assetRole: "owner_reference",
    });
    const replacementDecision = accessDecision({
      id: "access.substitution.replacement",
      rights: [assertion],
      acquisitions: [replacement],
      derivations: [replacementDerivation],
      operation: "owner_private_study",
      destination: { kind: "local_runtime" },
      purpose,
      assetRole: "owner_reference",
    });
    const removedBinding = withReferenceRecordDigest({
      recordKind: "owner_reference_binding",
      id: "binding.substitution.removed",
      digitalAssetRef: recordRef(digitalAsset),
      acquisitionRefs: [recordRef(removed)],
      accessDecisionRefs: [recordRef(removedDecision)],
      retentionPolicyRef: ref("retention.substitution.removed"),
      ownerLibraryRef: ref("owner-library.substitution"),
      createdAt: NOW,
    }) as ReferenceSourceStagingRecord;
    const replacementBinding = withReferenceRecordDigest({
      recordKind: "owner_reference_binding",
      id: "binding.substitution.replacement",
      digitalAssetRef: recordRef(digitalAsset),
      acquisitionRefs: [recordRef(replacement)],
      accessDecisionRefs: [recordRef(replacementDecision)],
      retentionPolicyRef: ref("retention.substitution.replacement"),
      ownerLibraryRef: ref("owner-library.substitution"),
      createdAt: NOW,
    }) as ReferenceSourceStagingRecord;
    const substitution = withReferenceRecordDigest({
      recordKind: "provenance_substitution",
      id: "substitution.reviewed-role-path",
      from: {
        acquisitionRef: recordRef(removed),
        derivationRef: recordRef(removedDerivation),
      },
      to: {
        acquisitionRef: recordRef(replacement),
        derivationRef: recordRef(replacementDerivation),
      },
      scope: {
        operation: "owner_private_study",
        sourceAndDerivativeRefs: [
          recordRef(removed),
          recordRef(removedDerivation),
          recordRef(replacement),
          recordRef(replacementDerivation),
          SUBJECT_REF,
        ],
        destination: { kind: "local_runtime" },
        purpose,
        policyRef: POLICY_REF,
      },
      accessDecisionRef: recordRef(replacementDecision),
      roleBindingRef: recordRef(replacementBinding),
      authority: {
        kind: "owner",
        authorityRef: ref("reviewer.rights"),
        evidenceRefs: [recordRef(assertion)],
      },
      rationale: "The exact replacement path and its role binding were reviewed",
      decidedAt: NOW,
    }) as ReferenceSourceStagingRecord;
    const assetStorage = storagePolicy({
      id: "storage.substitution.asset",
      subjectRef: recordRef(digitalAsset),
      subjectKind: "asset_bytes",
      paths: [
        { ...closurePath([removed], []), roleBindingRefs: [recordRef(removedBinding)] },
        {
          ...closurePath([replacement], []),
          roleBindingRefs: [recordRef(replacementBinding)],
        },
      ],
    });
    const derivativeStorage = storagePolicy({
      id: "storage.substitution.derivative",
      subjectRef: SUBJECT_REF,
      subjectKind: "extraction",
      paths: [
        {
          ...closurePath([removed], [removedDerivation]),
          roleBindingRefs: [recordRef(removedBinding)],
        },
        {
          ...closurePath([replacement], [replacementDerivation]),
          roleBindingRefs: [recordRef(replacementBinding)],
        },
      ],
    });
    const use = lifecycleUse({
      id: "use.substitution.removed",
      subjectRef: SUBJECT_REF,
      path: closurePath([removed], [removedDerivation]),
      decision: removedDecision,
      operation: "owner_private_study",
      destination: { kind: "local_runtime" },
      purpose,
      assetRole: "owner_reference",
      roleBindingRef: recordRef(removedBinding),
    });
    const records = [
      digitalAsset,
      assertion,
      removed,
      replacement,
      removedDerivation,
      replacementDerivation,
      removedDecision,
      replacementDecision,
      removedBinding,
      replacementBinding,
      substitution,
      assetStorage,
      derivativeStorage,
      use,
    ];

    const reviewed = planReferenceSourceLifecycle(plannerInput(records, deleteAction(removed)));
    expect(reviewed).toMatchObject({
      status: "computed",
      permissions: [
        {
          useId: "use.substitution.removed",
          state: "accessible",
          authorization: "provenance_substitution",
          accessDecisionRef: recordRef(replacementDecision),
        },
      ],
    });

    const {
      digest: _substitutionDigest,
      roleBindingRef: _roleBindingRef,
      ...withoutBinding
    } = substitution as Extract<
      ReferenceSourceStagingRecord,
      { recordKind: "provenance_substitution" }
    >;
    const unboundSubstitution = withReferenceRecordDigest(
      withoutBinding
    ) as ReferenceSourceStagingRecord;
    const unbound = planReferenceSourceLifecycle(
      plannerInput(
        records.map((record) => (record.id === substitution.id ? unboundSubstitution : record)),
        deleteAction(removed)
      )
    );
    expect(unbound).toMatchObject({
      status: "computed",
      permissions: [{ state: "restricted", authorization: "none" }],
    });

    const legacyInput = plannerInput(records, deleteAction(removed));
    const legacyCore = {
      ...legacyInput.baseSnapshot,
      recordObservations: legacyInput.baseSnapshot.recordObservations?.map((observation) =>
        observation.recordRef.id === substitution.id
          ? { ...observation, orderingTrust: "legacy_unverifiable" as const }
          : observation
      ),
    };
    const { digest: _legacyDigest, ...legacySnapshotCore } = legacyCore;
    const legacy = planReferenceSourceLifecycle({
      ...legacyInput,
      baseSnapshot: {
        ...legacySnapshotCore,
        digest: referenceSourceDigest(legacySnapshotCore),
      },
    });
    expect(legacy).toMatchObject({
      status: "computed",
      permissions: [{ state: "restricted", authorization: "none" }],
    });

    const substitutionEdge = withReferenceRecordDigest({
      recordKind: "dependency_edge",
      id: "dependency.substitution-authority",
      dependencyRef: recordRef(assertion),
      dependentRef: recordRef(substitution),
      scope: "rights",
      reason: "The reviewed mapping depends on its exact authority evidence",
      createdAt: NOW,
    }) as ReferenceSourceStagingRecord;
    const invalidatedSubstitution = withReferenceRecordDigest({
      recordKind: "invalidation",
      id: "invalidation.reviewed-substitution",
      triggerRef: recordRef(assertion),
      invalidatedRef: recordRef(substitution),
      dependencyEdgeRefs: [recordRef(substitutionEdge)],
      dependencyPath: [recordRef(assertion), recordRef(substitution)],
      scope: "rights",
      reason: "The reviewed substitution authority was withdrawn",
      invalidatedAt: NOW,
    }) as ReferenceSourceStagingRecord;
    const invalidSubstitutionResult = planReferenceSourceLifecycle(
      plannerInput([...records, substitutionEdge, invalidatedSubstitution], deleteAction(removed))
    );
    expect(invalidSubstitutionResult).toMatchObject({
      status: "computed",
      permissions: [{ state: "restricted", authorization: "none" }],
    });

    const bindingEdge = withReferenceRecordDigest({
      recordKind: "dependency_edge",
      id: "dependency.substitution-role-binding",
      dependencyRef: recordRef(assertion),
      dependentRef: recordRef(replacementBinding),
      scope: "rights",
      reason: "The replacement role binding depends on current rights",
      createdAt: NOW,
    }) as ReferenceSourceStagingRecord;
    const invalidatedBinding = withReferenceRecordDigest({
      recordKind: "invalidation",
      id: "invalidation.substitution-role-binding",
      triggerRef: recordRef(assertion),
      invalidatedRef: recordRef(replacementBinding),
      dependencyEdgeRefs: [recordRef(bindingEdge)],
      dependencyPath: [recordRef(assertion), recordRef(replacementBinding)],
      scope: "rights",
      reason: "The exact replacement role binding was invalidated",
      invalidatedAt: NOW,
    }) as ReferenceSourceStagingRecord;
    const invalidBindingResult = planReferenceSourceLifecycle(
      plannerInput([...records, bindingEdge, invalidatedBinding], deleteAction(removed))
    );
    expect(invalidBindingResult.status).toBe("blocked");
    if (invalidBindingResult.status !== "blocked") return;
    expect(invalidBindingResult.issues.map(({ code }) => code)).toContain("invalid_role_binding");
  });

  it("blocks a multi-source derivative whose declared path omits one source", () => {
    const digitalAsset = asset();
    const assertion = rights({ id: "rights.multi", asset: digitalAsset });
    const first = acquisition({ id: "acquisition.a", asset: digitalAsset, rights: assertion });
    const second = acquisition({ id: "acquisition.b", asset: digitalAsset, rights: assertion });
    const combined = derivation({
      id: "derivation.combined",
      acquisitions: [first, second],
    });
    const decision = accessDecision({
      id: "access.combined",
      rights: [assertion],
      acquisitions: [second],
      derivations: [combined],
    });
    const incomplete = closurePath([second], [combined]);
    const result = planReferenceSourceLifecycle(
      plannerInput(
        [
          digitalAsset,
          assertion,
          first,
          second,
          combined,
          decision,
          assetPolicy(digitalAsset, [first, second]),
          storagePolicy({
            id: "storage.combined",
            subjectRef: SUBJECT_REF,
            subjectKind: "extraction",
            paths: [incomplete],
          }),
          lifecycleUse({
            id: "use.combined",
            subjectRef: SUBJECT_REF,
            path: incomplete,
            decision,
          }),
        ],
        deleteAction(first)
      )
    );

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(result.issues.some((issue) => issue.code === "invalid_provenance_endpoint")).toBe(true);
  });

  it("re-evaluates current rights instead of trusting an old allowed decision", () => {
    const digitalAsset = asset();
    const permitted = rights({ id: "rights.current", asset: digitalAsset });
    const restricted = rights({
      id: "rights.current",
      asset: digitalAsset,
      status: "restricted",
      version: 2,
      parent: permitted,
      assertedAt: MID,
    });
    const source = acquisition({
      id: "acquisition.source",
      asset: digitalAsset,
      rights: permitted,
    });
    const target = acquisition({
      id: "acquisition.target",
      asset: digitalAsset,
      rights: permitted,
    });
    const extracted = derivation({ id: "derivation.source", acquisitions: [source] });
    const decision = accessDecision({
      id: "access.stale-rights",
      rights: [permitted],
      acquisitions: [source],
      derivations: [extracted],
    });
    const result = planReferenceSourceLifecycle(
      plannerInput(
        [
          digitalAsset,
          permitted,
          restricted,
          source,
          target,
          extracted,
          decision,
          assetPolicy(digitalAsset, [source, target]),
          storagePolicy({
            id: "storage.source",
            subjectRef: SUBJECT_REF,
            subjectKind: "extraction",
            paths: [closurePath([source], [extracted])],
          }),
          lifecycleUse({
            id: "use.stale-rights",
            subjectRef: SUBJECT_REF,
            path: closurePath([source], [extracted]),
            decision,
          }),
        ],
        deleteAction(target)
      )
    );

    expect(result).toMatchObject({
      status: "computed",
      permissions: [{ state: "restricted", authorization: "none" }],
    });
  });

  it("restricts one operation without disabling independent local study", () => {
    const digitalAsset = asset();
    const repoRights = rights({ id: "rights.repo", asset: digitalAsset });
    const localRights = rights({
      id: "rights.local",
      asset: digitalAsset,
      kind: "local_extraction",
    });
    const source = acquisition({
      id: "acquisition.source",
      asset: digitalAsset,
      rights: repoRights,
    });
    const extracted = derivation({ id: "derivation.source", acquisitions: [source] });
    const repoDecision = accessDecision({
      id: "access.repo",
      rights: [repoRights],
      acquisitions: [source],
      derivations: [extracted],
    });
    const localDecision = accessDecision({
      id: "access.local",
      rights: [localRights],
      acquisitions: [source],
      derivations: [extracted],
      operation: "local_extraction",
      destination: { kind: "local_runtime" },
      purpose: "Extract for private local study",
    });
    const commonPath = closurePath([source], [extracted]);
    const input = plannerInput(
      [
        digitalAsset,
        repoRights,
        localRights,
        source,
        extracted,
        repoDecision,
        localDecision,
        assetPolicy(digitalAsset, [source]),
        storagePolicy({
          id: "storage.source",
          subjectRef: SUBJECT_REF,
          subjectKind: "extraction",
          paths: [commonPath],
        }),
        lifecycleUse({
          id: "use.local",
          subjectRef: SUBJECT_REF,
          path: commonPath,
          decision: localDecision,
          operation: "local_extraction",
          destination: { kind: "local_runtime" },
          purpose: "Extract for private local study",
        }),
        lifecycleUse({
          id: "use.repo",
          subjectRef: SUBJECT_REF,
          path: commonPath,
          decision: repoDecision,
        }),
      ],
      {
        kind: "restrict_access",
        targetAccessDecisionRef: recordRef(repoDecision),
        reason: "Repository permission was withdrawn",
      }
    );
    const result = planReferenceSourceLifecycle(input);

    expect(result.status).toBe("computed");
    if (result.status !== "computed") return;
    expect(result.permissions).toMatchObject([
      { useId: "use.local", state: "accessible", authorization: "direct" },
      { useId: "use.repo", state: "restricted", authorization: "none" },
    ]);
    expect(result.consequences.every((item) => item.state === "accessible")).toBe(true);
  });

  it("traverses exact derivative closure and preserves pins and disclosure tombstones", () => {
    const digitalAsset = asset();
    const assertion = rights({ id: "rights.export", asset: digitalAsset });
    const source = acquisition({
      id: "acquisition.source",
      asset: digitalAsset,
      rights: assertion,
    });
    const rootRef = ref("derived.root", "1");
    const reportRef = ref("derived.report", "2");
    const backupRef = ref("derived.backup", "3");
    const disclosureRef = ref("derived.disclosure", "4");
    const root = derivation({
      id: "derivation.root",
      acquisitions: [source],
      derivedRef: rootRef,
    });
    const report = derivation({
      id: "derivation.report",
      acquisitions: [source],
      sources: [root],
      derivedRef: reportRef,
      kind: "report",
    });
    const backup = derivation({
      id: "derivation.backup",
      acquisitions: [source],
      sources: [report],
      derivedRef: backupRef,
      kind: "other",
    });
    const disclosure = derivation({
      id: "derivation.disclosure",
      acquisitions: [source],
      sources: [report],
      derivedRef: disclosureRef,
      kind: "export",
    });
    const disclosureDecision = accessDecision({
      id: "access.disclosure",
      rights: [assertion],
      acquisitions: [source],
      derivations: [root, report, disclosure],
      subjectRef: disclosureRef,
      operation: "export",
      destination: { kind: "recipient", id: "recipient.archive" },
      purpose: "Send an authorized copy",
    });
    const policies: ReferenceLifecycleStorageSubject[] = [
      assetPolicy(digitalAsset, [source], {
        kind: "vellum_controlled",
        storeIds: ["reference-source-staging"],
        retention: "unretained",
        tombstonePolicy: "preserve",
      }),
      storagePolicy({
        id: "storage.root",
        subjectRef: rootRef,
        subjectKind: "extraction",
        paths: [closurePath([source], [root])],
      }),
      storagePolicy({
        id: "storage.report",
        subjectRef: reportRef,
        subjectKind: "report",
        paths: [closurePath([source], [root, report])],
        custody: {
          kind: "vellum_controlled",
          storeIds: ["reference-source-staging"],
          retention: "unretained",
          tombstonePolicy: "preserve",
        },
      }),
      storagePolicy({
        id: "storage.backup",
        subjectRef: backupRef,
        subjectKind: "backup",
        paths: [closurePath([source], [root, report, backup])],
        custody: {
          kind: "vellum_controlled",
          storeIds: ["reference-source-staging"],
          retention: "encrypted_local_pin",
          tombstonePolicy: "preserve",
        },
        readinessRequirement: "advisory",
      }),
      storagePolicy({
        id: "storage.disclosure",
        subjectRef: disclosureRef,
        subjectKind: "unmanaged_disclosure",
        paths: [closurePath([source], [root, report, disclosure])],
        custody: {
          kind: "unmanaged_recipient",
          recipientRef: ref("recipient.archive"),
          disclosureAccessDecisionRef: recordRef(disclosureDecision),
          disclosedAt: NOW,
          tombstonePolicy: "preserve",
        },
        readinessRequirement: "none",
      }),
    ];
    const result = planReferenceSourceLifecycle(
      plannerInput(
        [
          digitalAsset,
          assertion,
          source,
          root,
          report,
          backup,
          disclosure,
          disclosureDecision,
          ...policies,
        ],
        deleteAction(source)
      )
    );

    expect(result.status).toBe("computed");
    if (result.status !== "computed") return;
    const states = Object.fromEntries(
      result.consequences.map((item) => [item.subjectKind, item.state])
    );
    expect(states).toMatchObject({
      asset_bytes: "restricted",
      extraction: "purged",
      report: "tombstone",
      backup: "restricted",
      unmanaged_disclosure: "tombstone",
    });
    expect(
      result.consequences.find((item) => item.subjectKind === "unmanaged_disclosure")
    ).toMatchObject({ irreversibleDisclosure: true });
  });

  it("blocks a partial lifecycle inventory that omits an affected derivative", () => {
    const digitalAsset = asset();
    const assertion = rights({ id: "rights.asset", asset: digitalAsset });
    const source = acquisition({
      id: "acquisition.source",
      asset: digitalAsset,
      rights: assertion,
    });
    const root = derivation({
      id: "derivation.root",
      acquisitions: [source],
      derivedRef: ref("derived.root", "1"),
    });
    const child = derivation({
      id: "derivation.child",
      acquisitions: [source],
      sources: [root],
      derivedRef: ref("derived.child", "2"),
    });
    const result = planReferenceSourceLifecycle(
      plannerInput(
        [
          digitalAsset,
          assertion,
          source,
          root,
          child,
          assetPolicy(digitalAsset, [source]),
          storagePolicy({
            id: "storage.root",
            subjectRef: root.derivedRef,
            subjectKind: "extraction",
            paths: [closurePath([source], [root])],
          }),
        ],
        deleteAction(source)
      )
    );

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(
      result.issues.some(
        (issue) =>
          issue.code === "missing_derivative_storage_policy" && issue.subjectRef?.id === child.id
      )
    ).toBe(true);
  });

  it("blocks retroactive authorization through a later same-byte acquisition", () => {
    const digitalAsset = asset();
    const assertion = rights({ id: "rights.asset", asset: digitalAsset });
    const oldAcquisition = acquisition({
      id: "acquisition.old",
      asset: digitalAsset,
      rights: assertion,
      acquiredAt: EARLY,
    });
    const newAcquisition = acquisition({
      id: "acquisition.new",
      asset: digitalAsset,
      rights: assertion,
      acquiredAt: MID,
    });
    const oldDerivation = derivation({
      id: "derivation.old",
      acquisitions: [oldAcquisition],
      createdAt: "2026-07-15T09:00:00.000Z",
    });
    const newDerivation = derivation({
      id: "derivation.new",
      acquisitions: [newAcquisition],
      createdAt: "2026-07-15T11:00:00.000Z",
    });
    const decision = accessDecision({
      id: "access.new",
      rights: [assertion],
      acquisitions: [newAcquisition],
      derivations: [newDerivation],
    });
    const result = planReferenceSourceLifecycle(
      plannerInput(
        [
          digitalAsset,
          assertion,
          oldAcquisition,
          newAcquisition,
          oldDerivation,
          newDerivation,
          decision,
          assetPolicy(digitalAsset, [oldAcquisition, newAcquisition]),
          storagePolicy({
            id: "storage.arrangement",
            subjectRef: SUBJECT_REF,
            subjectKind: "extraction",
            paths: [
              closurePath([oldAcquisition], [oldDerivation]),
              closurePath([newAcquisition], [newDerivation]),
            ],
          }),
          lifecycleUse({
            id: "use.new",
            subjectRef: SUBJECT_REF,
            path: closurePath([newAcquisition], [newDerivation]),
            decision,
          }),
        ],
        deleteAction(oldAcquisition),
        {
          [newAcquisition.id]: 2,
          [newDerivation.id]: 2,
          [decision.id]: 2,
          "storage.asset.shared": 2,
          "storage.arrangement": 2,
          "use.new": 2,
        }
      )
    );

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(result.issues.some((issue) => issue.code === "retroactive_provenance")).toBe(true);
  });

  it("never uses migrated legacy observations to authorize lifecycle ordering", () => {
    const digitalAsset = asset();
    const assertion = rights({ id: "rights.legacy-order", asset: digitalAsset });
    const source = acquisition({
      id: "acquisition.legacy-order",
      asset: digitalAsset,
      rights: assertion,
    });
    const input = plannerInput(
      [digitalAsset, assertion, source, assetPolicy(digitalAsset, [source])],
      deleteAction(source)
    );
    const snapshotWithoutTrustedSourceOrder = {
      ...input.baseSnapshot,
      recordObservations: input.baseSnapshot.recordObservations?.map((observation) =>
        observation.recordRef.id === source.id
          ? { ...observation, orderingTrust: "legacy_unverifiable" as const }
          : observation
      ),
    };
    const { digest: _digest, ...snapshotCore } = snapshotWithoutTrustedSourceOrder;
    const result = planReferenceSourceLifecycle({
      ...input,
      baseSnapshot: {
        ...snapshotCore,
        digest: referenceSourceDigest(snapshotCore),
      },
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(result.issues.some((issue) => issue.code === "retroactive_provenance")).toBe(true);
  });

  it("does not let future decision or rights generations supersede the effective present", () => {
    const digitalAsset = asset();
    const currentRights = rights({ id: "rights.future-generation", asset: digitalAsset });
    const source = acquisition({
      id: "acquisition.future-generation.source",
      asset: digitalAsset,
      rights: currentRights,
    });
    const target = acquisition({
      id: "acquisition.future-generation.target",
      asset: digitalAsset,
      rights: currentRights,
    });
    const extracted = derivation({
      id: "derivation.future-generation",
      acquisitions: [source],
    });
    const currentDecision = accessDecision({
      id: "access.future-generation",
      rights: [currentRights],
      acquisitions: [source],
      derivations: [extracted],
    });
    const futureRights = rights({
      id: currentRights.id,
      asset: digitalAsset,
      version: 2,
      parent: currentRights,
      status: "restricted",
      assertedAt: "2026-07-16T00:00:00.000Z",
    });
    const { digest: _decisionDigest, ...decisionCore } = currentDecision;
    const futureDecision = withReferenceRecordDigest({
      ...decisionCore,
      version: 2,
      parentVersionRef: {
        ...recordRef(currentDecision),
        version: currentDecision.version,
      },
      outcome: "deny",
      rightsAssertionRefs: [recordRef(futureRights)],
      rationale: "This future generation is not effective yet",
      decidedAt: "2026-07-16T00:00:00.000Z",
    }) as ReferenceAccessDecision;
    const result = planReferenceSourceLifecycle(
      plannerInput(
        [
          digitalAsset,
          currentRights,
          futureRights,
          source,
          target,
          extracted,
          currentDecision,
          futureDecision,
          assetPolicy(digitalAsset, [source, target]),
          storagePolicy({
            id: "storage.future-generation",
            subjectRef: SUBJECT_REF,
            subjectKind: "extraction",
            paths: [closurePath([source], [extracted])],
          }),
          lifecycleUse({
            id: "use.future-generation",
            subjectRef: SUBJECT_REF,
            path: closurePath([source], [extracted]),
            decision: currentDecision,
          }),
        ],
        deleteAction(target)
      )
    );

    expect(result).toMatchObject({
      status: "computed",
      permissions: [{ state: "accessible", authorization: "direct" }],
    });
  });

  it("treats validUntil equal to effectiveAt as expired", () => {
    const digitalAsset = asset();
    const assertion = rights({ id: "rights.asset", asset: digitalAsset });
    const source = acquisition({
      id: "acquisition.source",
      asset: digitalAsset,
      rights: assertion,
    });
    const target = acquisition({
      id: "acquisition.target",
      asset: digitalAsset,
      rights: assertion,
    });
    const extracted = derivation({ id: "derivation.source", acquisitions: [source] });
    const decision = accessDecision({
      id: "access.expiring",
      rights: [assertion],
      acquisitions: [source],
      derivations: [extracted],
      validUntil: NOW,
    });
    const result = planReferenceSourceLifecycle(
      plannerInput(
        [
          digitalAsset,
          assertion,
          source,
          target,
          extracted,
          decision,
          assetPolicy(digitalAsset, [source, target]),
          storagePolicy({
            id: "storage.source",
            subjectRef: SUBJECT_REF,
            subjectKind: "extraction",
            paths: [closurePath([source], [extracted])],
          }),
          lifecycleUse({
            id: "use.expiring",
            subjectRef: SUBJECT_REF,
            path: closurePath([source], [extracted]),
            decision,
          }),
        ],
        deleteAction(target)
      )
    );

    expect(result).toMatchObject({
      status: "computed",
      permissions: [{ state: "restricted", authorization: "none" }],
    });
  });
});
