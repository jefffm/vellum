import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
  ReferenceSourceLifecyclePlanResultSchema,
  ReferenceSourceLifecyclePlannerInputSchema,
  planReferenceSourceLifecycle,
  type ReferenceLifecycleStorageSubject,
  type ReferenceLifecycleUse,
  type ReferenceSourceLifecyclePlannerInput,
} from "./reference-source-lifecycle.js";
import {
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAssetAcquisition,
  type ReferenceProvenanceSubstitution,
  type ReferenceRecordRef,
  type ReferenceSourceDerivation,
} from "./reference-source-domain.js";

const NOW = "2026-07-15T12:00:00.000Z";
const ASSET_REF = ref("asset.shared", "a");
const POLICY_REF = ref("policy.lifecycle", "b");
const SNAPSHOT_REF = ref("snapshot.base", "c");
const SUBJECT_REF = ref("derivative.arrangement", "d");

function ref(id: string, fill = "e"): ReferenceRecordRef {
  return { id, digest: fill.repeat(64) };
}

function recordRef(record: { id: string; digest: string }): ReferenceRecordRef {
  return { id: record.id, digest: record.digest };
}

function acquisition(id: string, assetRef = ASSET_REF): ReferenceAssetAcquisition {
  return withReferenceRecordDigest({
    recordKind: "asset_acquisition",
    id,
    digitalAssetRef: assetRef,
    representedExemplarRefs: [],
    origin: { sourceKind: "upload", ownerActionRef: ref(`owner-action.${id}`) },
    acquiredAt: NOW,
    rightsAssertionRefs: [ref(`rights.${id}`)],
    processingPolicyRef: POLICY_REF,
  }) as ReferenceAssetAcquisition;
}

function derivation(
  id: string,
  sourceAcquisitions: ReferenceAssetAcquisition[],
  derivedRef = SUBJECT_REF,
  sourceDerivations: ReferenceSourceDerivation[] = []
): ReferenceSourceDerivation {
  return withReferenceRecordDigest({
    recordKind: "source_derivation",
    id,
    derivationKind: "extraction",
    inputRefs: [ASSET_REF],
    sourceAcquisitionRefs: sourceAcquisitions.map(recordRef),
    sourceDerivationRefs: sourceDerivations.map(recordRef),
    derivedRef,
    componentRef: ref("component.extractor"),
    configurationDigest: "f".repeat(64),
    createdAt: NOW,
  }) as ReferenceSourceDerivation;
}

function accessDecision(options: {
  id: string;
  acquisitionRefs: ReferenceRecordRef[];
  derivationRefs?: ReferenceRecordRef[];
  subjectRef?: ReferenceRecordRef;
  operation?: ReferenceAccessDecision["operation"];
  destination?: ReferenceAccessDecision["destination"];
  outcome?: ReferenceAccessDecision["outcome"];
  purpose?: string;
}): ReferenceAccessDecision {
  return withReferenceRecordDigest({
    recordKind: "access_decision",
    id: options.id,
    version: 1,
    outcome: options.outcome ?? "allow",
    operation: options.operation ?? "repository_inclusion",
    sourceRefs: options.acquisitionRefs,
    derivativeRefs: [...(options.derivationRefs ?? []), options.subjectRef ?? SUBJECT_REF],
    destination: options.destination ?? { kind: "repository" },
    purpose: options.purpose ?? "Publish reviewed development fixture",
    policyRef: POLICY_REF,
    rightsAssertionRefs: [ref(`rights.${options.id}`)],
    authorityRefs: [ref("reviewer.rights")],
    rationale: "Exact path and scope were reviewed",
    decidedAt: NOW,
  }) as ReferenceAccessDecision;
}

function use(options: {
  id: string;
  acquisition: ReferenceAssetAcquisition;
  derivation?: ReferenceSourceDerivation;
  decision: ReferenceAccessDecision;
  operation?: ReferenceLifecycleUse["operation"];
  destination?: ReferenceLifecycleUse["destination"];
  subjectRef?: ReferenceRecordRef;
  purpose?: string;
  readinessRequirement?: ReferenceLifecycleUse["readinessRequirement"];
}): ReferenceLifecycleUse {
  return {
    id: options.id,
    subjectRef: options.subjectRef ?? SUBJECT_REF,
    provenancePaths: [
      {
        acquisitionRef: recordRef(options.acquisition),
        ...(options.derivation ? { derivationRef: recordRef(options.derivation) } : {}),
        accessDecisionRef: recordRef(options.decision),
      },
    ],
    operation: options.operation ?? "repository_inclusion",
    destination: options.destination ?? { kind: "repository" },
    purpose: options.purpose ?? "Publish reviewed development fixture",
    policyRef: POLICY_REF,
    baselineReplayability: "complete",
    readinessRequirement: options.readinessRequirement ?? "required",
  };
}

function storageSubject(
  options: Partial<ReferenceLifecycleStorageSubject> &
    Pick<ReferenceLifecycleStorageSubject, "subjectRef" | "subjectKind" | "provenancePaths">
): ReferenceLifecycleStorageSubject {
  return {
    control: "vellum_controlled",
    retention: "unretained",
    tombstonePolicy: "discard",
    replayRequirement: "required",
    readinessRequirement: "required",
    ...options,
  };
}

function plannerInput(options: {
  target: ReferenceAssetAcquisition;
  acquisitions: ReferenceAssetAcquisition[];
  derivations?: ReferenceSourceDerivation[];
  decisions?: ReferenceAccessDecision[];
  substitutions?: ReferenceProvenanceSubstitution[];
  storageSubjects?: ReferenceLifecycleStorageSubject[];
  uses?: ReferenceLifecycleUse[];
  kind?: "delete_acquisition" | "restrict_acquisition";
}): ReferenceSourceLifecyclePlannerInput {
  return {
    schemaVersion: 1,
    baseSnapshotRef: SNAPSHOT_REF,
    effectiveAt: NOW,
    action: {
      kind: options.kind ?? "delete_acquisition",
      targetAcquisitionRef: recordRef(options.target),
      reason: "Owner requested a rights-safe lifecycle dry run",
    },
    acquisitions: options.acquisitions,
    derivations: options.derivations ?? [],
    accessDecisions: options.decisions ?? [],
    substitutions: options.substitutions ?? [],
    storageSubjects: options.storageSubjects ?? [],
    uses: options.uses ?? [],
  };
}

function sharedAssetStorage(
  acquisitions: ReferenceAssetAcquisition[]
): ReferenceLifecycleStorageSubject {
  return storageSubject({
    subjectRef: ASSET_REF,
    subjectKind: "asset_bytes",
    provenancePaths: acquisitions.map((item) => ({
      acquisitionRefs: [recordRef(item)],
      derivationRefs: [],
    })),
    tombstonePolicy: "preserve",
  });
}

describe("reference-source lifecycle planner", () => {
  it("is closed-schema, dry-run only, deterministic, and does not mutate input", () => {
    const first = acquisition("acquisition.first");
    const input = plannerInput({
      target: first,
      acquisitions: [first],
      storageSubjects: [sharedAssetStorage([first])],
    });
    const before = structuredClone(input);
    const result = planReferenceSourceLifecycle(input);

    expect(result).toMatchObject({
      mode: "dry_run",
      status: "ready",
      atomicity: "all_or_nothing",
    });
    expect(Value.Check(ReferenceSourceLifecyclePlanResultSchema, result)).toBe(true);
    expect(input).toEqual(before);
    expect(
      Value.Check(ReferenceSourceLifecyclePlannerInputSchema, {
        ...input,
        publish: true,
      })
    ).toBe(false);
    expect(() =>
      planReferenceSourceLifecycle({
        ...input,
        publish: true,
      } as ReferenceSourceLifecyclePlannerInput)
    ).toThrow(/closed schema/);
  });

  it("is invariant to same-byte acquisition order and never borrows sibling rights", () => {
    const restrictedAcquisition = acquisition("acquisition.restricted");
    const permittedAcquisition = acquisition("acquisition.permitted");
    const restrictedDerivation = derivation("derivation.restricted", [restrictedAcquisition]);
    const permittedDerivation = derivation("derivation.permitted", [permittedAcquisition]);
    const removedPathDecision = accessDecision({
      id: "access.removed-path",
      acquisitionRefs: [recordRef(restrictedAcquisition)],
      derivationRefs: [recordRef(restrictedDerivation)],
    });
    const siblingDecision = accessDecision({
      id: "access.sibling-path",
      acquisitionRefs: [recordRef(permittedAcquisition)],
      derivationRefs: [recordRef(permittedDerivation)],
      operation: "local_extraction",
      destination: { kind: "local_runtime" },
      purpose: "Extract for private local study",
    });
    const requirement = use({
      id: "use.repository",
      acquisition: restrictedAcquisition,
      derivation: restrictedDerivation,
      decision: removedPathDecision,
    });
    const subjects = [
      sharedAssetStorage([restrictedAcquisition, permittedAcquisition]),
      storageSubject({
        subjectRef: SUBJECT_REF,
        subjectKind: "extraction",
        provenancePaths: [
          {
            acquisitionRefs: [recordRef(restrictedAcquisition)],
            derivationRefs: [recordRef(restrictedDerivation)],
          },
          {
            acquisitionRefs: [recordRef(permittedAcquisition)],
            derivationRefs: [recordRef(permittedDerivation)],
          },
        ],
      }),
    ];
    const common = {
      target: restrictedAcquisition,
      derivations: [restrictedDerivation, permittedDerivation],
      decisions: [removedPathDecision, siblingDecision],
      storageSubjects: subjects,
      uses: [requirement],
    };

    const restrictedFirst = planReferenceSourceLifecycle(
      plannerInput({
        ...common,
        acquisitions: [restrictedAcquisition, permittedAcquisition],
      })
    );
    const permittedFirst = planReferenceSourceLifecycle(
      plannerInput({
        ...common,
        acquisitions: [permittedAcquisition, restrictedAcquisition],
      })
    );

    expect(restrictedFirst).toEqual(permittedFirst);
    expect(restrictedFirst).toMatchObject({
      status: "ready",
      targetDigitalAssetRef: ASSET_REF,
      permissions: [
        {
          useId: "use.repository",
          state: "restricted",
          authorization: "none",
          replayability: "unavailable",
          readinessImpact: "blocked",
        },
      ],
    });
    if (restrictedFirst.status === "ready") {
      expect(
        restrictedFirst.consequences.find((item) => item.subjectKind === "asset_bytes")
      ).toMatchObject({ state: "accessible" });
      expect(restrictedFirst.permissions[0].activeEndpoint).toBeUndefined();
      expect(restrictedFirst.permissions[0].accessDecisionRef).toBeUndefined();
    }

    const deleteOtherAcquisition = planReferenceSourceLifecycle(
      plannerInput({
        ...common,
        target: permittedAcquisition,
        acquisitions: [restrictedAcquisition, permittedAcquisition],
      })
    );
    expect(deleteOtherAcquisition).toMatchObject({
      status: "ready",
      permissions: [
        {
          useId: "use.repository",
          state: "accessible",
          authorization: "direct",
        },
      ],
    });
  });

  it("uses only an exact reviewed substitution and keeps operations and destinations separate", () => {
    const oldAcquisition = acquisition("acquisition.old");
    const newAcquisition = acquisition("acquisition.new");
    const oldDerivation = derivation("derivation.old", [oldAcquisition]);
    const newDerivation = derivation("derivation.new", [newAcquisition]);
    const oldDecision = accessDecision({
      id: "access.old",
      acquisitionRefs: [recordRef(oldAcquisition)],
      derivationRefs: [recordRef(oldDerivation)],
    });
    const substitutionDecision = accessDecision({
      id: "access.substitution",
      acquisitionRefs: [recordRef(oldAcquisition), recordRef(newAcquisition)],
      derivationRefs: [recordRef(oldDerivation), recordRef(newDerivation)],
    });
    const providerDecision = accessDecision({
      id: "access.provider-a",
      acquisitionRefs: [recordRef(newAcquisition)],
      derivationRefs: [recordRef(newDerivation)],
      operation: "provider_ocr",
      destination: { kind: "provider", id: "provider-a" },
      purpose: "OCR the selected notation region",
    });
    const substitution = withReferenceRecordDigest({
      recordKind: "provenance_substitution",
      id: "substitution.reviewed",
      from: {
        acquisitionRef: recordRef(oldAcquisition),
        derivationRef: recordRef(oldDerivation),
      },
      to: {
        acquisitionRef: recordRef(newAcquisition),
        derivationRef: recordRef(newDerivation),
      },
      scope: {
        operation: "repository_inclusion",
        sourceAndDerivativeRefs: [
          SUBJECT_REF,
          recordRef(oldAcquisition),
          recordRef(oldDerivation),
          recordRef(newAcquisition),
          recordRef(newDerivation),
        ],
        destination: { kind: "repository" },
        purpose: "Publish reviewed development fixture",
        policyRef: POLICY_REF,
      },
      accessDecisionRef: recordRef(substitutionDecision),
      authority: {
        kind: "rights_reviewer",
        authorityRef: ref("reviewer.rights"),
        evidenceRefs: [ref("review.substitution")],
      },
      rationale: "Reviewer approved this exact replacement provenance path",
      decidedAt: NOW,
    }) as ReferenceProvenanceSubstitution;

    const repositoryUse = use({
      id: "use.repository",
      acquisition: oldAcquisition,
      derivation: oldDerivation,
      decision: oldDecision,
    });
    const fixtureUse = use({
      id: "use.fixture",
      acquisition: oldAcquisition,
      derivation: oldDerivation,
      decision: oldDecision,
      operation: "fixture_inclusion",
    });
    const providerAUse = use({
      id: "use.provider-a",
      acquisition: newAcquisition,
      derivation: newDerivation,
      decision: providerDecision,
      operation: "provider_ocr",
      destination: { kind: "provider", id: "provider-a" },
      purpose: "OCR the selected notation region",
    });
    const providerBUse = use({
      id: "use.provider-b",
      acquisition: newAcquisition,
      derivation: newDerivation,
      decision: providerDecision,
      operation: "provider_ocr",
      destination: { kind: "provider", id: "provider-b" },
      purpose: "OCR the selected notation region",
    });

    const result = planReferenceSourceLifecycle(
      plannerInput({
        target: oldAcquisition,
        acquisitions: [newAcquisition, oldAcquisition],
        derivations: [newDerivation, oldDerivation],
        decisions: [providerDecision, substitutionDecision, oldDecision],
        substitutions: [substitution],
        storageSubjects: [
          sharedAssetStorage([oldAcquisition, newAcquisition]),
          storageSubject({
            subjectRef: SUBJECT_REF,
            subjectKind: "extraction",
            provenancePaths: [
              {
                acquisitionRefs: [recordRef(oldAcquisition)],
                derivationRefs: [recordRef(oldDerivation)],
              },
              {
                acquisitionRefs: [recordRef(newAcquisition)],
                derivationRefs: [recordRef(newDerivation)],
              },
            ],
          }),
        ],
        uses: [providerBUse, repositoryUse, fixtureUse, providerAUse],
      })
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.permissions).toMatchObject([
      { useId: "use.fixture", state: "restricted", authorization: "none" },
      { useId: "use.provider-a", state: "accessible", authorization: "direct" },
      { useId: "use.provider-b", state: "restricted", authorization: "none" },
      {
        useId: "use.repository",
        state: "accessible",
        authorization: "provenance_substitution",
        replayability: "partial",
        readinessImpact: "advisory",
      },
    ]);
    expect(result.consequences.find((item) => item.subjectRef.id === SUBJECT_REF.id)).toMatchObject(
      {
        state: "accessible",
      }
    );
  });

  it("traverses the full derivative closure and models purge, tombstone, pins, and disclosures", () => {
    const target = acquisition("acquisition.target");
    const survivor = acquisition("acquisition.survivor");
    const root = derivation("derivation.root", [target], ref("derivative.root", "1"));
    const child = derivation("derivation.child", [survivor], ref("derivative.child", "2"), [root]);
    const storageSubjects: ReferenceLifecycleStorageSubject[] = [
      sharedAssetStorage([target, survivor]),
      storageSubject({
        subjectRef: root.derivedRef,
        subjectKind: "extraction",
        provenancePaths: [
          { acquisitionRefs: [recordRef(target)], derivationRefs: [recordRef(root)] },
        ],
        tombstonePolicy: "discard",
      }),
      storageSubject({
        subjectRef: child.derivedRef,
        subjectKind: "report",
        provenancePaths: [
          {
            acquisitionRefs: [recordRef(survivor)],
            derivationRefs: [recordRef(child)],
          },
        ],
        tombstonePolicy: "preserve",
      }),
      storageSubject({
        subjectRef: ref("backup.child", "3"),
        subjectKind: "backup",
        provenancePaths: [{ acquisitionRefs: [], derivationRefs: [recordRef(child)] }],
        retention: "encrypted_local_pin",
        readinessRequirement: "advisory",
      }),
      storageSubject({
        subjectRef: ref("export.unmanaged", "4"),
        subjectKind: "unmanaged_disclosure",
        provenancePaths: [{ acquisitionRefs: [], derivationRefs: [recordRef(child)] }],
        control: "unmanaged_recipient",
        readinessRequirement: "none",
      }),
    ];

    const result = planReferenceSourceLifecycle(
      plannerInput({
        target,
        acquisitions: [target, survivor],
        derivations: [child, root],
        storageSubjects,
      })
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(
      Object.fromEntries(result.consequences.map((item) => [item.subjectKind, item.state]))
    ).toMatchObject({
      extraction: "purged",
      report: "tombstone",
      backup: "restricted",
      unmanaged_disclosure: "tombstone",
    });
    expect(
      result.consequences.find((item) => item.subjectKind === "report")?.affectedByRefs
    ).toContainEqual(recordRef(child));
    expect(
      result.consequences.find((item) => item.subjectKind === "unmanaged_disclosure")
    ).toMatchObject({ irreversibleDisclosure: true, replayability: "unavailable" });
    expect(result.aggregate).toMatchObject({
      purged: 1,
      irreversibleDisclosures: 1,
      readinessBlocked: 2,
    });

    const incompleteGraph = planReferenceSourceLifecycle(
      plannerInput({
        target,
        acquisitions: [target, survivor],
        derivations: [child, root],
        storageSubjects: storageSubjects.filter(
          (subject) =>
            subject.subjectKind === "asset_bytes" || subject.subjectRef.id === root.derivedRef.id
        ),
      })
    );
    expect(incompleteGraph.status).toBe("blocked");
    if (incompleteGraph.status !== "blocked") return;
    expect(
      incompleteGraph.issues.find((issue) => issue.code === "missing_derivative_storage_policy")
    ).toMatchObject({ subjectRef: recordRef(child) });
  });

  it("fails closed without a policy for the last shared blob and distinguishes restrict from delete", () => {
    const only = acquisition("acquisition.only");
    const blocked = planReferenceSourceLifecycle(
      plannerInput({ target: only, acquisitions: [only] })
    );
    expect(blocked).toMatchObject({
      status: "blocked",
      issues: [{ code: "missing_asset_storage_policy", subjectRef: ASSET_REF }],
    });

    const restricted = planReferenceSourceLifecycle(
      plannerInput({
        target: only,
        acquisitions: [only],
        kind: "restrict_acquisition",
        storageSubjects: [
          storageSubject({
            subjectRef: ASSET_REF,
            subjectKind: "asset_bytes",
            provenancePaths: [{ acquisitionRefs: [recordRef(only)], derivationRefs: [] }],
            retention: "required_hold",
            tombstonePolicy: "preserve",
          }),
        ],
      })
    );
    expect(restricted.status).toBe("ready");
    if (restricted.status !== "ready") return;
    expect(
      restricted.consequences.find((item) => item.subjectKind === "asset_acquisition")
    ).toMatchObject({ state: "restricted" });
    expect(
      restricted.consequences.find((item) => item.subjectKind === "asset_bytes")
    ).toMatchObject({ state: "restricted", replayability: "partial" });
  });
});
