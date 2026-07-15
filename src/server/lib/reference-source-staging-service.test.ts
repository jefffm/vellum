import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceRecordRef,
  type ReferenceSourceRecordObservation,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingSnapshot,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingStore,
} from "./reference-source-staging-store.js";
import {
  ReferenceSourceStagingMigrationRequiredError,
  ReferenceSourceStagingService,
} from "./reference-source-staging-service.js";

const ASSERTED_AT = "2026-07-15T12:00:00.000Z";
const SERVER_TIME = "2026-07-15T13:00:00.000Z";
const MALICIOUS_CLIENT_TIME = "1999-01-01T00:00:00.000Z";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("ReferenceSourceStagingService integrity", () => {
  it("accepts exact local structure while preserving explicit opaque external refs", () => {
    const { service } = harness();
    const graph = baseGraph();
    const created = service.applyTransaction(transaction("base", graph.records));
    const accepted = service.applyTransaction(
      transaction("substitution", [graph.substitution], headRef(created))
    );

    expect(accepted.view).toEqual({ kind: "current" });
    expect(accepted.snapshot?.records).toContainEqual(graph.substitution);
    expect(
      accepted.snapshot?.records.filter(({ recordKind }) => recordKind === "digital_asset")
    ).toHaveLength(2);
    expect(
      accepted.snapshot?.records.filter(({ recordKind }) => recordKind === "asset_acquisition")
    ).toHaveLength(2);

    const historical = service.readSnapshot(created.snapshot!.id);
    expect(historical.head).toEqual(accepted.head);
    expect(historical.view).toEqual({
      kind: "historical",
      viewedSnapshotRef: ref(created.snapshot!),
    });
  });

  it("rejects wrong-kind local edges, opaque-authority collisions, and duplicate content identity", () => {
    const { service } = harness();
    const graph = baseGraph();
    const base = service.applyTransaction(transaction("base", graph.records));

    const wrongKindAcquisition = record({
      ...withoutDigest(graph.acquisitionA),
      id: "acquisition.wrong-kind",
      digitalAssetRef: ref(graph.work),
    });
    expect(() =>
      service.applyTransaction(transaction("wrong-kind", [wrongKindAcquisition], headRef(base)))
    ).toThrow(/digital_asset/);

    const claimantCollision = record({
      recordKind: "identity_assertion",
      id: "identity.claimant-collision",
      version: 1,
      subjectRef: ref(graph.work),
      subjectKind: "work",
      property: "creator",
      assertedValue: { kind: "entity_ref", value: externalRef("person.external") },
      claimant: { kind: "importer", claimantRef: ref(graph.asset) },
      evidenceRefs: [],
      confidence: { kind: "unknown" },
      completeness: "incomplete",
      composition: "atomic",
      componentAssertionRefs: [],
      assertionState: "candidate",
      predecessorAssertionRefs: [],
      successorRelationship: "initial",
      conflictAssertionRefs: [],
      assertedAt: ASSERTED_AT,
    });
    expect(() =>
      service.applyTransaction(
        transaction("claimant-collision", [claimantCollision], headRef(base))
      )
    ).toThrow(/opaque external reference/);

    const duplicateAsset = record({
      recordKind: "digital_asset",
      id: "asset.duplicate-content-identity",
      sha256: graph.asset.sha256,
      mediaType: graph.asset.mediaType,
      byteLength: graph.asset.byteLength,
    });
    expect(() =>
      service.applyTransaction(transaction("duplicate", [duplicateAsset], headRef(base)))
    ).toThrow(/already have exact identity/);
    expect(service.readCurrent()).toEqual(base);
  });

  it("requires evidence-bearing identity confidence and blocks automatic perfect classification", () => {
    const { service } = harness();
    const graph = baseGraph();
    let current = service.applyTransaction(transaction("base", graph.records));

    const ungroundedAssessment = classificationAssertion(graph, {
      id: "identity.ungrounded",
      claimantKind: "reviewer",
      value: 0.8,
      evidenceRefs: [],
    });
    expect(() =>
      service.applyTransaction(transaction("ungrounded", [ungroundedAssessment], headRef(current)))
    ).toThrow(/requires explicit confidence evidence/);

    const autoPerfect = classificationAssertion(graph, {
      id: "identity.auto-perfect",
      claimantKind: "importer",
      value: 1,
      evidenceRefs: [externalRef("evidence.catalog")],
    });
    expect(() =>
      service.applyTransaction(transaction("auto-perfect", [autoPerfect], headRef(current)))
    ).toThrow(/automatic perfect confidence/);

    const reviewedPerfect = classificationAssertion(graph, {
      id: "identity.reviewed-perfect",
      claimantKind: "reviewer",
      value: 1,
      evidenceRefs: [externalRef("evidence.manual-review")],
    });
    current = service.applyTransaction(
      transaction("reviewed-perfect", [reviewedPerfect], headRef(current))
    );
    expect(current.snapshot?.records).toContainEqual(reviewedPerfect);

    const emptyComposite = record({
      ...withoutDigest(
        classificationAssertion(graph, {
          id: "identity.empty-composite",
          claimantKind: "reviewer",
          value: 0.7,
          evidenceRefs: [externalRef("evidence.manual-review")],
        })
      ),
      composition: "composite",
      componentAssertionRefs: [],
    });
    expect(() =>
      service.applyTransaction(transaction("empty-composite", [emptyComposite], headRef(current)))
    ).toThrow(/composition semantics/);
  });

  it("enforces rights evidence and prevents unrelated permission laundering", () => {
    const { service } = harness();
    const graph = baseGraph();
    let current = service.applyTransaction(transaction("base", graph.records));

    const unevidencedRights = record({
      ...withoutDigest(graph.rightsA),
      id: "rights.unevidenced",
      evidenceRefs: [],
    });
    expect(() =>
      service.applyTransaction(
        transaction("unevidenced-rights", [unevidencedRights], headRef(current))
      )
    ).toThrow(/requires evidence/);

    const unknownRights = record({
      ...withoutDigest(graph.rightsA),
      id: "rights.unknown",
      status: "unknown",
      evidenceRefs: [],
    });
    current = service.applyTransaction(
      transaction("unknown-rights", [unknownRights], headRef(current))
    );
    expect(current.snapshot?.records).toContainEqual(unknownRights);

    const launderedAllow = record({
      recordKind: "access_decision",
      id: "access.unrelated-rights",
      version: 1,
      outcome: "allow",
      operation: "repository_inclusion",
      sourceRefs: [ref(graph.acquisitionB)],
      derivativeRefs: [],
      destination: { kind: "repository", id: "fixture-repository" },
      purpose: "Attempt to borrow another acquisition's permission",
      policyRef: externalRef("policy.repository"),
      rightsAssertionRefs: [ref(graph.rightsA)],
      authorityRefs: [externalRef("reviewer.rights")],
      rationale: "Must fail because the rights subject is unrelated",
      decidedAt: ASSERTED_AT,
    });
    expect(() =>
      service.applyTransaction(transaction("laundered-allow", [launderedAllow], headRef(current)))
    ).toThrow(/lacks a current affirmative Rights Assertion/);

    const invertedRights = record({
      ...withoutDigest(graph.rightsA),
      id: "rights.inverted",
      validFrom: "2026-08-01T00:00:00.000Z",
      validUntil: "2026-07-01T00:00:00.000Z",
    });
    expect(() =>
      service.applyTransaction(transaction("inverted-rights", [invertedRights], headRef(current)))
    ).toThrow(/inverted validity interval/);
  });

  it("binds provenance substitution to one asset, derived artifact, scope, and authority", () => {
    const { service } = harness();
    const graph = baseGraph();
    let current = service.applyTransaction(transaction("base", graph.records));
    current = service.applyTransaction(
      transaction("valid-substitution", [graph.substitution], headRef(current))
    );

    const policyAuthority = record({
      ...withoutDigest(graph.substitution),
      id: "substitution.policy-authority",
      authority: {
        kind: "policy",
        authorityRef: graph.substitution.scope.policyRef,
        evidenceRefs: [ref(graph.rightsB)],
      },
    });
    expect(() =>
      service.applyTransaction(transaction("policy-authority", [policyAuthority], headRef(current)))
    ).toThrow(/not authorized by its exact Access Decision/);

    const unscopedRoleBinding = record({
      ...withoutDigest(graph.substitution),
      id: "substitution.unscoped-role-binding",
      roleBindingRef: externalRef("binding.unrelated"),
    });
    expect(() =>
      service.applyTransaction(
        transaction("unscoped-role-binding", [unscopedRoleBinding], headRef(current))
      )
    ).toThrow(/cannot cite a role binding without an Asset Role/);

    const sameAcquisitionDerivation = derivation(
      "derivation.same-acquisition-relabel",
      graph.asset,
      graph.acquisitionA,
      graph.outputAsset
    );
    const sameAcquisitionAccess = record({
      ...withoutDigest(graph.substitutionAccess),
      id: "access.same-acquisition-relabel",
      sourceRefs: [ref(graph.acquisitionA), ref(graph.asset)],
      derivativeRefs: [ref(sameAcquisitionDerivation), ref(graph.outputAsset)],
      rightsAssertionRefs: [ref(graph.rightsA)],
    });
    const sameAcquisitionSubstitution = record({
      ...withoutDigest(graph.substitution),
      id: "substitution.same-acquisition-relabel",
      to: {
        acquisitionRef: ref(graph.acquisitionA),
        derivationRef: ref(sameAcquisitionDerivation),
      },
      scope: {
        ...graph.substitution.scope,
        sourceAndDerivativeRefs: [
          graph.substitution.from.acquisitionRef,
          graph.substitution.from.derivationRef,
          ref(sameAcquisitionDerivation),
          ref(graph.outputAsset),
        ],
      },
      accessDecisionRef: ref(sameAcquisitionAccess),
    });
    expect(() =>
      service.applyTransaction(
        transaction(
          "same-acquisition-relabel",
          [sameAcquisitionDerivation, sameAcquisitionAccess, sameAcquisitionSubstitution],
          headRef(current)
        )
      )
    ).toThrow(/must replace the acquisition/);

    const omittedEndpoint = record({
      ...withoutDigest(graph.substitution),
      id: "substitution.omitted-endpoint",
      scope: {
        ...graph.substitution.scope,
        sourceAndDerivativeRefs: graph.substitution.scope.sourceAndDerivativeRefs.slice(1),
      },
    });
    expect(() =>
      service.applyTransaction(transaction("omitted-endpoint", [omittedEndpoint], headRef(current)))
    ).toThrow(/not authorized by its exact Access Decision/);

    const otherAsset = record({
      recordKind: "digital_asset",
      id: "asset.other-source",
      sha256: "c".repeat(64),
      mediaType: "application/pdf",
      byteLength: 99,
    });
    const otherAcquisition = record({
      ...withoutDigest(graph.acquisitionB),
      id: "acquisition.other-source",
      digitalAssetRef: ref(otherAsset),
    });
    const otherDerivation = record({
      ...withoutDigest(graph.derivationB),
      id: "derivation.other-source",
      inputRefs: [ref(otherAsset)],
      sourceAcquisitionRefs: [ref(otherAcquisition)],
    });
    const crossAsset = record({
      ...withoutDigest(graph.substitution),
      id: "substitution.cross-asset",
      to: {
        acquisitionRef: ref(otherAcquisition),
        derivationRef: ref(otherDerivation),
      },
      scope: {
        ...graph.substitution.scope,
        sourceAndDerivativeRefs: [
          graph.substitution.from.acquisitionRef,
          graph.substitution.from.derivationRef,
          ref(otherAcquisition),
          ref(otherDerivation),
        ],
      },
    });
    expect(() =>
      service.applyTransaction(
        transaction(
          "cross-asset",
          [otherAsset, otherAcquisition, otherDerivation, crossAsset],
          headRef(current)
        )
      )
    ).toThrow(/crosses Digital Asset identity/);
  });

  it("derives typed transitive invalidations from server time and leaves unrelated records alone", () => {
    const { service } = harness();
    const graph = baseGraph();
    const base = service.applyTransaction(transaction("base", graph.records));
    const correction = correctedIdentity(graph);
    const corrected = service.applyTransaction(
      transaction("correction", [correction], headRef(base), MALICIOUS_CLIENT_TIME)
    );

    const invalidations = corrected.snapshot!.records.filter(
      (record) => record.recordKind === "invalidation"
    );
    expect(invalidations).toHaveLength(2);
    expect(invalidations.every(({ scope }) => scope === "identity")).toBe(true);
    expect(invalidations.every(({ invalidatedAt }) => invalidatedAt === SERVER_TIME)).toBe(true);
    expect(invalidations.map(({ invalidatedRef }) => invalidatedRef.id).sort()).toEqual([
      graph.exemplar.id,
      graph.manifestation.id,
    ]);
    expect(
      invalidations.find(({ invalidatedRef }) => invalidatedRef.id === graph.exemplar.id)
    ).toMatchObject({
      dependencyEdgeRefs: [ref(graph.identityEdge), ref(graph.transitiveEdge)],
      dependencyPath: [ref(graph.identity), ref(graph.manifestation), ref(graph.exemplar)],
      triggerRef: ref(graph.identity),
      replacementRef: ref(correction),
    });
    expect(invalidations.some(({ invalidatedRef }) => invalidatedRef.id === graph.asset.id)).toBe(
      false
    );

    const wrongStartScope = dependency(
      "dependency.wrong-start-scope",
      graph.identity,
      graph.asset,
      "rights"
    );
    expect(() =>
      service.applyTransaction(
        transaction("wrong-start-scope", [wrongStartScope], headRef(corrected))
      )
    ).toThrow(/must start with identity scope/);

    const cycleA = dependency("dependency.cycle-a", graph.work, graph.manifestation, "content");
    const cycleB = dependency("dependency.cycle-b", graph.manifestation, graph.work, "content");
    expect(() =>
      service.applyTransaction(
        transaction("dependency-cycle", [cycleA, cycleB], headRef(corrected))
      )
    ).toThrow(/dependency graph contains a cycle/);
  });

  it("runtime-decodes transactions and rejects client-authored invalidation overlays", () => {
    const { service } = harness();
    const graph = baseGraph();
    const base = service.applyTransaction(transaction("base", graph.records));
    const forgedInvalidation = record({
      recordKind: "invalidation",
      id: "invalidation.client",
      triggerRef: ref(graph.identity),
      invalidatedRef: ref(graph.manifestation),
      dependencyEdgeRefs: [ref(graph.identityEdge)],
      dependencyPath: [ref(graph.identity), ref(graph.manifestation)],
      scope: "identity",
      reason: "client-authored derived state",
      invalidatedAt: ASSERTED_AT,
    });
    const forged = transaction("forged", [forgedInvalidation], headRef(base));
    expect(() => service.applyTransaction(forged)).toThrow(ReferenceSourceStagingIntegrityError);

    const extraProperty = {
      ...transaction("extra", [correctedIdentity(graph)], headRef(base)),
      publicationState: "canonical",
    } as unknown as ReferenceSourceStagingTransaction;
    expect(() => service.applyTransaction(extraProperty)).toThrow(/schema validation/);
    expect(service.readCurrent()).toEqual(base);
  });

  it("requires an explicit migration instead of backfilling a nonempty pre-observation snapshot", () => {
    const { service } = legacyHarness(baseGraph().records);
    const graph = baseGraph();
    const before = service.readCurrent();

    const error = captureError(() =>
      service.applyTransaction(
        transaction("legacy-observation-gap", [correctedIdentity(graph)], headRef(before))
      )
    );

    expect(error).toBeInstanceOf(ReferenceSourceStagingMigrationRequiredError);
    expect(error).toMatchObject({
      code: "reference_source_staging_migration_required",
      migration: "record_observations",
      snapshotRef: ref(before.snapshot!),
      snapshotRevision: 1,
    });
    expect((error as Error).message).toMatch(/explicit record-observation migration/);
    expect(service.readCurrent()).toEqual(before);
  });

  it("does not silently backfill a partially observed legacy history", () => {
    const graph = baseGraph();
    const partialObservations: ReferenceSourceRecordObservation[] = [
      {
        recordRef: ref(graph.records[0]!),
        firstObservedRevision: 1,
        observedAt: SERVER_TIME,
      },
    ];
    const { service } = legacyHarness(graph.records, partialObservations);
    const before = service.readCurrent();

    expect(
      captureError(() =>
        service.applyTransaction(
          transaction("partial-observation-gap", [correctedIdentity(graph)], headRef(before))
        )
      )
    ).toBeInstanceOf(ReferenceSourceStagingMigrationRequiredError);
    expect(service.readCurrent()).toEqual(before);
  });

  it("explicitly migrates legacy history without inventing trusted order, then permits appends", () => {
    const graph = baseGraph();
    const partialObservations: ReferenceSourceRecordObservation[] = [
      {
        recordRef: ref(graph.records[0]!),
        firstObservedRevision: 1,
        observedAt: SERVER_TIME,
      },
    ];
    const { service } = legacyHarness(graph.records, partialObservations);
    const before = service.readCurrent();

    const migrated = service.migrateLegacyObservationHistory(headRef(before));

    expect(migrated.snapshot).toMatchObject({
      revision: 2,
      parentSnapshotRef: ref(before.snapshot!),
    });
    expect(migrated.snapshot?.records).toEqual(before.snapshot?.records);
    expect(migrated.snapshot?.recordObservations).toHaveLength(graph.records.length);
    expect(
      migrated.snapshot?.recordObservations?.every(
        (observation) => observation.orderingTrust === "legacy_unverifiable"
      )
    ).toBe(true);
    expect(migrated.snapshot?.recordObservations?.[0]).toMatchObject(partialObservations[0]!);

    const advanced = service.applyTransaction(
      transaction("post-migration", [correctedIdentity(graph)], headRef(migrated))
    );
    const observations = advanced.snapshot?.recordObservations ?? [];
    const legacyRefs = new Set(graph.records.map((record) => `${record.id}\u0000${record.digest}`));
    expect(advanced.snapshot?.revision).toBe(3);
    expect(
      observations
        .filter(({ recordRef }) => legacyRefs.has(`${recordRef.id}\u0000${recordRef.digest}`))
        .every(({ orderingTrust }) => orderingTrust === "legacy_unverifiable")
    ).toBe(true);
    expect(
      observations
        .filter(({ recordRef }) => !legacyRefs.has(`${recordRef.id}\u0000${recordRef.digest}`))
        .every(({ orderingTrust }) => orderingTrust === "server_observed")
    ).toBe(true);
  });

  it("refuses a legacy observation migration that would retroactively invalidate retention roots", () => {
    const records = legacyRetentionOrderingGraph();
    const { service } = legacyHarness(records);
    const before = service.readCurrent();

    expect(() => service.migrateLegacyObservationHistory(headRef(before))).toThrow(
      /exact role-binding retention roots/
    );
    expect(service.readCurrent()).toEqual(before);
  });

  it("can advance an empty legacy snapshot without inventing prior record order", () => {
    const graph = baseGraph();
    const { service } = legacyHarness([]);
    const before = service.readCurrent();

    const advanced = service.applyTransaction(
      transaction("empty-legacy", graph.records, headRef(before))
    );

    expect(advanced.snapshot?.revision).toBe(2);
    expect(advanced.snapshot?.recordObservations).toHaveLength(graph.records.length);
    expect(
      advanced.snapshot?.recordObservations?.every(
        (observation) =>
          observation.firstObservedRevision === 2 && observation.orderingTrust === "server_observed"
      )
    ).toBe(true);
  });
});

function legacyHarness(
  records: ReferenceSourceStagingRecord[],
  recordObservations?: ReferenceSourceRecordObservation[]
): { service: ReferenceSourceStagingService } {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-reference-source-legacy-service-"));
  roots.push(root);
  const store = new ReferenceSourceStagingStore({ rootDirectory: root });
  const snapshotCore: Omit<ReferenceSourceStagingSnapshot, "digest"> = {
    schemaVersion: 1,
    id: "reference-source-snapshot.legacy",
    revision: 1,
    publicationState: "staging_only",
    createdAt: SERVER_TIME,
    ...(recordObservations ? { recordObservations } : {}),
    records,
  };
  store.commit({ ...snapshotCore, digest: referenceSourceDigest(snapshotCore) });
  let sequence = 0;
  return {
    service: new ReferenceSourceStagingService({
      store,
      now: () => new Date(SERVER_TIME),
      createId: () => `legacy-generated-${++sequence}`,
    }),
  };
}

function captureError(operation: () => unknown): unknown {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to throw");
}

function harness(): { service: ReferenceSourceStagingService } {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-reference-source-service-"));
  roots.push(root);
  let sequence = 0;
  return {
    service: new ReferenceSourceStagingService({
      store: new ReferenceSourceStagingStore({ rootDirectory: root }),
      now: () => new Date(SERVER_TIME),
      createId: () => `generated-${++sequence}`,
    }),
  };
}

function baseGraph() {
  const work = record({
    recordKind: "work",
    id: "work.fixture",
    version: 1,
    preferredTitle: "Rights-approved fixture work",
    creatorIdentityRefs: [],
    identityAssertionRefs: [],
    identityState: "candidate",
  });
  const identity = record({
    recordKind: "identity_assertion",
    id: "identity.title",
    version: 1,
    subjectRef: ref(work),
    subjectKind: "work",
    property: "preferred_title",
    assertedValue: { kind: "text", value: "Rights-approved fixture work" },
    claimant: { kind: "importer", claimantRef: externalRef("importer.fixture") },
    evidenceRefs: [],
    confidence: { kind: "unknown" },
    completeness: "incomplete",
    composition: "atomic",
    componentAssertionRefs: [],
    assertionState: "candidate",
    predecessorAssertionRefs: [],
    successorRelationship: "initial",
    conflictAssertionRefs: [],
    assertedAt: ASSERTED_AT,
  });
  const manifestation = record({
    recordKind: "source_manifestation",
    id: "manifestation.fixture",
    version: 1,
    manifestationKind: "edition",
    workRelations: [{ workRef: ref(work), role: "edition_of" }],
    parentRelations: [],
    languages: ["en"],
    editorIdentityRefs: [],
    translatorIdentityRefs: [],
    declaredChanges: [],
    identityAssertionRefs: [],
    identityState: "candidate",
  });
  const exemplar = record({
    recordKind: "exemplar",
    id: "exemplar.fixture",
    version: 1,
    manifestationRefs: [ref(manifestation)],
    completeness: "complete",
    exemplarNotes: [],
    identityAssertionRefs: [],
    identityState: "candidate",
  });
  const asset = record({
    recordKind: "digital_asset",
    id: "asset.source",
    sha256: "a".repeat(64),
    mediaType: "application/pdf",
    byteLength: 1024,
  });
  const outputAsset = record({
    recordKind: "digital_asset",
    id: "asset.fixture-output",
    sha256: "b".repeat(64),
    mediaType: "application/json",
    byteLength: 256,
  });
  const acquisitionA = acquisition("acquisition.a", asset, "action.a");
  const acquisitionB = acquisition("acquisition.b", asset, "action.b");
  const rightsA = permittedRights("rights.a", acquisitionA);
  const rightsB = permittedRights("rights.b", acquisitionB);
  const derivationA = derivation("derivation.a", asset, acquisitionA, outputAsset);
  const derivationB = derivation("derivation.b", asset, acquisitionB, outputAsset);
  const substitutionAccess = record({
    recordKind: "access_decision",
    id: "access.substitution",
    version: 1,
    outcome: "allow",
    operation: "repository_inclusion",
    sourceRefs: [ref(acquisitionB), ref(asset)],
    derivativeRefs: [ref(derivationB), ref(outputAsset)],
    destination: { kind: "repository", id: "fixture-repository" },
    purpose: "Substitute one exact acquisition path for another",
    policyRef: externalRef("policy.repository"),
    rightsAssertionRefs: [ref(rightsB)],
    authorityRefs: [externalRef("reviewer.rights")],
    rationale: "The replacement path and exact output are authorized",
    decidedAt: ASSERTED_AT,
  });
  const identityEdge = dependency(
    "dependency.identity-manifestation",
    identity,
    manifestation,
    "identity"
  );
  const transitiveEdge = dependency(
    "dependency.manifestation-exemplar",
    manifestation,
    exemplar,
    "content"
  );
  const substitution = record({
    recordKind: "provenance_substitution",
    id: "substitution.a-to-b",
    from: { acquisitionRef: ref(acquisitionA), derivationRef: ref(derivationA) },
    to: { acquisitionRef: ref(acquisitionB), derivationRef: ref(derivationB) },
    scope: {
      operation: substitutionAccess.operation,
      sourceAndDerivativeRefs: [
        ref(acquisitionA),
        ref(derivationA),
        ref(acquisitionB),
        ref(derivationB),
        ref(outputAsset),
      ],
      destination: substitutionAccess.destination,
      purpose: substitutionAccess.purpose,
      policyRef: substitutionAccess.policyRef,
    },
    accessDecisionRef: ref(substitutionAccess),
    authority: {
      kind: "rights_reviewer",
      authorityRef: externalRef("reviewer.rights"),
      evidenceRefs: [ref(rightsB)],
    },
    rationale: "The exact permitted path replaces the prior path",
    decidedAt: ASSERTED_AT,
  }) as Extract<ReferenceSourceStagingRecord, { recordKind: "provenance_substitution" }>;

  return {
    records: [
      work,
      identity,
      manifestation,
      exemplar,
      asset,
      outputAsset,
      acquisitionA,
      acquisitionB,
      rightsA,
      rightsB,
      derivationA,
      derivationB,
      substitutionAccess,
      identityEdge,
      transitiveEdge,
    ],
    work,
    identity,
    manifestation,
    exemplar,
    asset,
    outputAsset,
    acquisitionA,
    acquisitionB,
    rightsA,
    rightsB,
    derivationA,
    derivationB,
    substitutionAccess,
    identityEdge,
    transitiveEdge,
    substitution,
  };
}

function legacyRetentionOrderingGraph(): ReferenceSourceStagingRecord[] {
  const asset = record({
    recordKind: "digital_asset",
    id: "asset.legacy-retention-order",
    sha256: "d".repeat(64),
    mediaType: "application/pdf",
    byteLength: 16,
  });
  const acquisitionRecord = record({
    recordKind: "asset_acquisition",
    id: "acquisition.legacy-retention-order",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: {
      sourceKind: "upload",
      ownerActionRef: externalRef("owner-action.legacy-retention-order"),
    },
    acquiredAt: ASSERTED_AT,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.legacy-retention-order"),
  });
  const rights = record({
    recordKind: "rights_assertion",
    id: "rights.legacy-retention-order",
    version: 1,
    subjectRef: ref(acquisitionRecord),
    subjectKind: "asset_acquisition",
    rightsKind: "owner_private_access",
    status: "permitted",
    claimant: { kind: "owner", claimantRef: externalRef("owner.local") },
    evidenceRefs: [externalRef("evidence.legacy-retention-order")],
    assertedAt: ASSERTED_AT,
  });
  const access = record({
    recordKind: "access_decision",
    id: "access.legacy-retention-order",
    version: 1,
    outcome: "allow",
    operation: "owner_private_study",
    sourceRefs: [ref(acquisitionRecord), ref(asset)],
    derivativeRefs: [],
    destination: { kind: "local_runtime" },
    purpose: "Use the exact legacy upload in an arrangement workspace",
    assetRole: "arrangement_source",
    policyRef: externalRef("access-policy.legacy-retention-order"),
    rightsAssertionRefs: [ref(rights)],
    authorityRefs: [externalRef("owner.local")],
    rationale: "The Owner authorized this exact local private-study path",
    decidedAt: ASSERTED_AT,
  });
  const binding = record({
    recordKind: "arrangement_source_binding",
    id: "binding.legacy-retention-order",
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(acquisitionRecord)],
    accessDecisionRefs: [ref(access)],
    retentionPolicyRef: externalRef("retention-policy.legacy-retention-order"),
    workspaceRef: externalRef("workspace.legacy-retention-order"),
    createdAt: SERVER_TIME,
  });
  const storage = record({
    recordKind: "lifecycle_storage_policy",
    id: "storage.legacy-retention-order",
    version: 1,
    subjectRef: ref(asset),
    subjectKind: "asset_bytes",
    provenancePaths: [
      {
        acquisitionRefs: [ref(acquisitionRecord)],
        derivationRefs: [],
        roleBindingRefs: [],
      },
    ],
    policyRef: externalRef("lifecycle-policy.legacy-retention-order"),
    custody: {
      kind: "vellum_controlled",
      storeIds: ["reference-source-staging"],
      retention: "unretained",
      tombstonePolicy: "preserve",
    },
    replayRequirement: "required",
    readinessRequirement: "required",
    createdAt: ASSERTED_AT,
  });
  return [asset, acquisitionRecord, rights, access, storage, binding];
}

function classificationAssertion(
  graph: ReturnType<typeof baseGraph>,
  options: {
    id: string;
    claimantKind: "importer" | "reviewer";
    value: number;
    evidenceRefs: ReferenceRecordRef[];
  }
): ReferenceSourceStagingRecord {
  return record({
    recordKind: "identity_assertion",
    id: options.id,
    version: 1,
    subjectRef: ref(graph.work),
    subjectKind: "work",
    property: "documentary_classification",
    assertedValue: {
      kind: "classification",
      vocabulary: "fixture-documentary-kind",
      term: "method",
    },
    claimant: {
      kind: options.claimantKind,
      claimantRef: externalRef(`${options.claimantKind}.fixture`),
    },
    evidenceRefs: options.evidenceRefs,
    confidence: {
      kind: "assessed",
      value: options.value,
      basis: "Explicit fixture assessment",
      evidenceRefs: options.evidenceRefs,
    },
    completeness: "complete",
    composition: "atomic",
    componentAssertionRefs: [],
    assertionState: "reviewed",
    predecessorAssertionRefs: [],
    successorRelationship: "initial",
    conflictAssertionRefs: [],
    assertedAt: ASSERTED_AT,
  });
}

function acquisition(
  id: string,
  asset: ReferenceSourceStagingRecord,
  ownerActionId: string
): ReferenceSourceStagingRecord {
  return record({
    recordKind: "asset_acquisition",
    id,
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: { sourceKind: "upload", ownerActionRef: externalRef(ownerActionId) },
    acquiredAt: ASSERTED_AT,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("policy.local-processing"),
  });
}

function permittedRights(
  id: string,
  acquisitionRecord: ReferenceSourceStagingRecord
): ReferenceSourceStagingRecord {
  return record({
    recordKind: "rights_assertion",
    id,
    version: 1,
    subjectRef: ref(acquisitionRecord),
    subjectKind: "asset_acquisition",
    rightsKind: "export_redistribution",
    status: "permitted",
    claimant: { kind: "reviewer", claimantRef: externalRef("reviewer.rights") },
    evidenceRefs: [externalRef(`evidence.${id}`)],
    assertedAt: ASSERTED_AT,
  });
}

function derivation(
  id: string,
  asset: ReferenceSourceStagingRecord,
  acquisitionRecord: ReferenceSourceStagingRecord,
  outputAsset: ReferenceSourceStagingRecord
): ReferenceSourceStagingRecord {
  return record({
    recordKind: "source_derivation",
    id,
    derivationKind: "fixture",
    inputRefs: [ref(asset)],
    sourceAcquisitionRefs: [ref(acquisitionRecord)],
    sourceDerivationRefs: [],
    derivedRef: ref(outputAsset),
    componentRef: externalRef("component.fixture-builder"),
    configurationDigest: "f".repeat(64),
    createdAt: ASSERTED_AT,
  });
}

function correctedIdentity(graph: ReturnType<typeof baseGraph>): ReferenceSourceStagingRecord {
  return record({
    ...withoutDigest(graph.identity),
    version: 2,
    parentVersionRef: {
      id: graph.identity.id,
      version: 1,
      digest: graph.identity.digest,
    },
    assertedValue: { kind: "text", value: "Corrected fixture title" },
    confidence: {
      kind: "assessed",
      value: 0.9,
      basis: "Compared against the exact staged Work",
      evidenceRefs: [ref(graph.work)],
    },
    completeness: "complete",
    assertionState: "reviewed",
    predecessorAssertionRefs: [ref(graph.identity)],
    successorRelationship: "correction",
    assertedAt: SERVER_TIME,
  });
}

function dependency(
  id: string,
  dependencyRecord: ReferenceSourceStagingRecord,
  dependentRecord: ReferenceSourceStagingRecord,
  scope: "identity" | "rights" | "access" | "provenance" | "content" | "publication"
): ReferenceSourceStagingRecord {
  return record({
    recordKind: "dependency_edge",
    id,
    dependencyRef: ref(dependencyRecord),
    dependentRef: ref(dependentRecord),
    scope,
    reason: `${dependentRecord.id} depends on ${dependencyRecord.id}`,
    createdAt: ASSERTED_AT,
  });
}

function transaction(
  id: string,
  records: ReferenceSourceStagingRecord[],
  expectedHeadRef?: ReferenceRecordRef,
  submittedAt = ASSERTED_AT
): ReferenceSourceStagingTransaction {
  return {
    schemaVersion: 1,
    id: `transaction.${id}`,
    ...(expectedHeadRef ? { expectedHeadRef } : {}),
    operations: records.map((entry) => ({ type: "append_record", record: entry })),
    submittedAt,
  } as ReferenceSourceStagingTransaction;
}

function record<T extends Record<string, unknown>>(value: T): T & ReferenceSourceStagingRecord {
  return withReferenceRecordDigest(value) as unknown as T & ReferenceSourceStagingRecord;
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: withReferenceRecordDigest({ id }).digest };
}

function headRef(value: {
  head: { snapshotId: string; digest: string } | null;
}): ReferenceRecordRef {
  if (!value.head) throw new Error("Expected a staging head");
  return { id: value.head.snapshotId, digest: value.head.digest };
}

function withoutDigest<T extends { digest: string }>(value: T): Omit<T, "digest"> {
  const { digest: _digest, ...core } = value;
  return core;
}
