import { Value } from "@sinclair/typebox/value";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EvaluationSourceBindingSchema,
  ReferenceEvaluationSourceBindingCommitmentSchema,
  ReferenceSourceStagingRecordSchema,
  ReferenceSourceStagingTransactionSchema,
  canonicalReferenceJson,
  verifyReferenceRecordDigest,
  withReferenceRecordDigest,
  type ReferenceRecordRef,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingSnapshot,
  type ReferenceSourceStagingTransaction,
} from "../../src/lib/reference-source-domain.js";
import { createApp } from "../../src/server/index.js";
import { OwnerStore } from "../../src/server/lib/owner-store.js";
import {
  ReferenceSourceStagingConflictError,
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingStore,
} from "../../src/server/lib/reference-source-staging-store.js";
import { ReferenceSourceStagingService } from "../../src/server/lib/reference-source-staging-service.js";
import { WorkspaceStore } from "../../src/server/lib/workspace-store.js";

const NOW = "2026-07-15T12:00:00.000Z";
const LATER = "2026-07-15T12:05:00.000Z";
const SOURCE_SHA = "a".repeat(64);
const FIXTURE_SHA = "b".repeat(64);
const VAULT_PATH_CANARY = "/owner-vault/holdout-do-not-disclose.pdf";
const RETRIEVAL_CANARY = "https://private.invalid/signed/source?secret=do-not-disclose";
const BYTES_CANARY = "PRIVATE-SOURCE-BYTES-DO-NOT-DISCLOSE";

type FixtureGraph = ReturnType<typeof buildFixtureGraph>;

describe("T05 versioned source identity and rights graph", () => {
  let temporaryRoot: string;
  let stagingRoot: string;
  let ownerRoot: string;
  let workspaceRoot: string;
  let servers: Server[];
  let idSequence: number;

  beforeEach(() => {
    temporaryRoot = mkdtempSync(path.join(tmpdir(), "vellum-t05-source-graph-"));
    stagingRoot = path.join(temporaryRoot, "staging");
    ownerRoot = path.join(temporaryRoot, "owner");
    workspaceRoot = path.join(temporaryRoot, "workspaces");
    servers = [];
    idSequence = 0;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(servers.splice(0).map(closeServer));
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  it("round-trips a staging-only identity, rights, access, and role graph without touching canonical stores", () => {
    const ownerStore = new OwnerStore({
      rootDirectory: ownerRoot,
      now: () => new Date(NOW),
      createId: () => "owner-id",
    });
    const legacy = ownerStore.addReference({
      title: "Private facsimile",
      citation: "Owner shelf, uncatalogued copy",
      mimeType: "application/pdf",
      contentBase64: Buffer.from(BYTES_CANARY).toString("base64"),
    });
    const workspaceStore = new WorkspaceStore({
      rootDirectory: workspaceRoot,
      now: () => new Date(NOW),
      createId: () => "0123456789abcdef",
    });
    workspaceStore.create({ title: "Canonical store isolation witness" });
    const canonicalBefore = {
      owner: directorySnapshot(ownerRoot),
      workspaces: directorySnapshot(workspaceRoot),
    };

    const service = createService(() => [
      {
        ...legacy,
        storedPath: VAULT_PATH_CANARY,
        retrievalUri: RETRIEVAL_CANARY,
        contentBase64: Buffer.from(BYTES_CANARY).toString("base64"),
        bytes: BYTES_CANARY,
      },
    ]);
    const graph = buildFixtureGraph();
    expect(
      graph.records.every((record) => Value.Check(ReferenceSourceStagingRecordSchema, record))
    ).toBe(true);
    const created = service.applyTransaction(transaction("create-realistic-graph", graph.records));

    expect(created.publicationState).toBe("staging_only");
    expectCoherentDiagnostics(created);
    expect(created.snapshot?.records).toEqual(graph.records);
    expect(created.snapshot?.records.every(verifyReferenceRecordDigest)).toBe(true);
    expect(created.capabilities).toEqual({
      stagingTransactions: true,
      canonicalPublication: false,
    });

    const acquisitions = created.snapshot!.records.filter(
      (record) => record.recordKind === "asset_acquisition"
    );
    expect(acquisitions).toHaveLength(2);
    expect(acquisitions.map(({ id }) => id)).toEqual([
      "acquisition.restricted",
      "acquisition.permitted",
    ]);
    expect(acquisitions[0]!.digitalAssetRef).toEqual(acquisitions[1]!.digitalAssetRef);
    expect(acquisitions[0]!.digest).not.toBe(acquisitions[1]!.digest);

    const rightsBySubject = new Map(
      created
        .snapshot!.records.filter((record) => record.recordKind === "rights_assertion")
        .map((record) => [record.subjectRef.id, record.status])
    );
    expect(rightsBySubject).toEqual(
      new Map([
        ["acquisition.restricted", "restricted"],
        ["acquisition.permitted", "permitted"],
      ])
    );
    expect(created.snapshot!.records.find(({ id }) => id === "access.restricted")).toMatchObject({
      outcome: "deny",
      sourceRefs: [ref(graph.restrictedAcquisition)],
    });
    expect(
      created.snapshot!.records.find(({ id }) => id === "access.arrangement-source")
    ).toMatchObject({ outcome: "allow", sourceRefs: [ref(graph.permittedAcquisition)] });
    expect(
      created.snapshot!.records.find(({ id }) => id === graph.titleAssertion.id)
    ).toMatchObject({ confidence: { kind: "unknown" }, completeness: "incomplete" });
    expect(
      created.snapshot!.records.filter((record) =>
        [
          "arrangement_source_binding",
          "owner_reference_binding",
          "evaluation_source_binding",
        ].includes(record.recordKind)
      )
    ).toHaveLength(3);

    const publicJson = JSON.stringify(created);
    expect(publicJson).not.toContain(VAULT_PATH_CANARY);
    expect(publicJson).not.toContain(RETRIEVAL_CANARY);
    expect(publicJson).not.toContain(BYTES_CANARY);
    expect(publicJson).not.toMatch(/storedPath|retrievalUri|contentBase64|evaluationVaultRef/);
    expect(created.legacyProjection.ownerReferences).toEqual([
      expect.objectContaining({
        id: legacy.id,
        readOnly: true,
        identityConfidence: { kind: "unknown" },
      }),
    ]);
    expect(created.snapshot!.records.some(({ id }) => id === legacy.id)).toBe(false);

    const reloaded = createService(() => [legacy]).readCurrent();
    expect(reloaded.snapshot).toEqual(created.snapshot);
    expect(reloaded.head).toEqual(created.head);
    expect(canonicalReferenceJson(reloaded.snapshot)).toBe(
      canonicalReferenceJson(created.snapshot)
    );
    expect(directorySnapshot(ownerRoot)).toEqual(canonicalBefore.owner);
    expect(directorySnapshot(workspaceRoot)).toEqual(canonicalBefore.workspaces);
  });

  it("permits only an authorized substitution between exact acquisition and derivation paths", () => {
    const service = createService();
    const graph = buildFixtureGraph();
    const base = service.applyTransaction(transaction("base", graph.records));
    const expectedHeadRef = headRef(base);

    const accepted = service.applyTransaction(
      transaction("exact-substitution", [graph.substitution], expectedHeadRef)
    );
    expect(accepted.snapshot?.records).toContainEqual(graph.substitution);

    const headAfterAccepted = headRef(accepted);
    const wrongKind = record({
      ...withoutDigest(graph.substitution),
      id: "substitution.wrong-kind",
      from: {
        ...graph.substitution.from,
        acquisitionRef: ref(graph.work),
      },
    });
    expect(() =>
      service.applyTransaction(transaction("wrong-kind", [wrongKind], headAfterAccepted))
    ).toThrow(/asset_acquisition/);

    const dangling = record({
      ...withoutDigest(graph.substitution),
      id: "substitution.dangling",
      to: {
        ...graph.substitution.to,
        derivationRef: externalRef("derivation.does-not-exist"),
      },
    });
    expect(() =>
      service.applyTransaction(transaction("dangling", [dangling], headAfterAccepted))
    ).toThrow(/does not resolve to an exact staged record/);

    const incompleteAccess = record({
      ...withoutDigest(graph.substitutionAccess),
      id: "access.substitution-incomplete",
      derivativeRefs: [ref(graph.permittedDerivation)],
    });
    const underAuthorized = record({
      ...withoutDigest(graph.substitution),
      id: "substitution.under-authorized",
      accessDecisionRef: ref(incompleteAccess),
    });
    expect(() =>
      service.applyTransaction(
        transaction("under-authorized", [incompleteAccess, underAuthorized], headAfterAccepted)
      )
    ).toThrow(/not authorized by its exact Access Decision/);
  });

  it("derives exact multi-hop invalidations and preserves unrelated records", () => {
    const service = createService();
    const graph = buildFixtureGraph();
    const base = service.applyTransaction(transaction("base", graph.records));
    const correction = correctedIdentity(graph);
    const corrected = service.applyTransaction(
      transaction("correct-title", [correction], headRef(base), LATER)
    );
    expectCoherentDiagnostics(corrected);

    const invalidations = corrected.snapshot!.records.filter(
      (record) => record.recordKind === "invalidation"
    );
    expect(invalidations).toHaveLength(3);
    expect(invalidations.map(({ invalidatedRef }) => invalidatedRef.id).sort()).toEqual(
      [graph.exemplar.id, graph.manifestation.id, graph.ownerBinding.id].sort()
    );
    expect(
      invalidations.find(({ invalidatedRef }) => invalidatedRef.id === graph.ownerBinding.id)
    ).toMatchObject({
      triggerRef: ref(graph.titleAssertion),
      replacementRef: ref(correction),
      dependencyEdgeRefs: [
        ref(graph.identityToManifestation),
        ref(graph.manifestationToExemplar),
        ref(graph.exemplarToOwnerBinding),
      ],
      dependencyPath: [
        ref(graph.titleAssertion),
        ref(graph.manifestation),
        ref(graph.exemplar),
        ref(graph.ownerBinding),
      ],
      scope: "identity",
    });
    expect(invalidations.some(({ invalidatedRef }) => invalidatedRef.id === graph.asset.id)).toBe(
      false
    );
    expect(corrected.snapshot!.records).toContainEqual(graph.asset);

    const firstSnapshot = createService().readSnapshot(base.snapshot!.id);
    expect(firstSnapshot.snapshot).toEqual(base.snapshot);
    expect(firstSnapshot.head).toEqual(corrected.head);
    expect(firstSnapshot.view).toEqual({
      kind: "historical",
      viewedSnapshotRef: ref(base.snapshot!),
    });
  });

  it("deduplicates DigitalAsset identity while preserving distinct acquisitions", () => {
    const service = createService();
    const graph = buildFixtureGraph();
    const base = service.applyTransaction(transaction("base", graph.records));
    const duplicateAssetIdentity = record({
      recordKind: "digital_asset",
      id: "asset.same-bytes-second-identity",
      sha256: graph.asset.sha256,
      mediaType: graph.asset.mediaType,
      byteLength: graph.asset.byteLength,
    });

    expect(() =>
      service.applyTransaction(
        transaction("duplicate-byte-identity", [duplicateAssetIdentity], headRef(base))
      )
    ).toThrow(/Digital Asset|sha256|content-addressed/i);
    expect(
      base.snapshot!.records.filter((record) => record.recordKind === "asset_acquisition")
    ).toHaveLength(2);
  });

  it("rejects client-authored invalidations and prevents mixed-generation diagnostics", () => {
    const service = createService();
    const graph = buildFixtureGraph();
    const base = service.applyTransaction(transaction("base", graph.records));
    const forgedInvalidation = record({
      recordKind: "invalidation",
      id: "invalidation.client-forged",
      triggerRef: ref(graph.titleAssertion),
      invalidatedRef: ref(graph.manifestation),
      dependencyEdgeRefs: [ref(graph.identityToManifestation)],
      dependencyPath: [ref(graph.titleAssertion), ref(graph.manifestation)],
      scope: "identity",
      reason: "client attempts to manufacture derived state",
      invalidatedAt: LATER,
    });
    const forgedTransaction = transaction(
      "forged-invalidation",
      [forgedInvalidation],
      headRef(base)
    );

    expect(Value.Check(ReferenceSourceStagingTransactionSchema, forgedTransaction)).toBe(false);
    expect(() => service.applyTransaction(forgedTransaction)).toThrow(
      ReferenceSourceStagingIntegrityError
    );

    const racingRoot = path.join(temporaryRoot, "racing-staging");
    const racingStore = new ReferenceSourceStagingStore({ rootDirectory: racingRoot });
    const first = emptySnapshot("snapshot.first", 1);
    const second = emptySnapshot("snapshot.second", 2, ref(first));
    racingStore.commit(first);
    const originalReadHead = racingStore.readHead.bind(racingStore);
    let readCount = 0;
    let advanced = false;
    vi.spyOn(racingStore, "readHead").mockImplementation(() => {
      readCount += 1;
      if (!advanced && readCount === 2) {
        new ReferenceSourceStagingStore({ rootDirectory: racingRoot }).commit(second, ref(first));
        advanced = true;
      }
      return originalReadHead();
    });

    const coherent = new ReferenceSourceStagingService({ store: racingStore }).readCurrent();
    expect(advanced).toBe(true);
    expectCoherentDiagnostics(coherent);
  });

  it("enforces compare-and-swap and exposes no canonical publish, migration, or activation path", async () => {
    const service = createService();
    const graph = buildFixtureGraph();
    const first = service.applyTransaction(transaction("first", graph.records));
    const correction = correctedIdentity(graph);
    const second = service.applyTransaction(
      transaction("second", [correction], headRef(first), LATER)
    );
    const beforeConflict = service.readCurrent();

    expect(() =>
      service.applyTransaction(
        transaction(
          "stale-writer",
          [
            record({
              recordKind: "digital_asset",
              id: "asset.stale-writer",
              sha256: "c".repeat(64),
              mediaType: "application/pdf",
              byteLength: 7,
            }),
          ],
          headRef(first),
          LATER
        )
      )
    ).toThrow(ReferenceSourceStagingConflictError);
    expect(service.readCurrent()).toEqual(beforeConflict);
    expect(service.readCurrent()).toEqual(second);

    expect(
      Object.getOwnPropertyNames(ReferenceSourceStagingService.prototype).filter(
        (name) =>
          /publish|canonical|activat/i.test(name) ||
          (/migrat/i.test(name) && name !== "migrateLegacyObservationHistory")
      )
    ).toEqual([]);
    expect(
      [
        ...Object.getOwnPropertyNames(OwnerStore.prototype),
        ...Object.getOwnPropertyNames(WorkspaceStore.prototype),
      ].filter((name) => /referenceSourceStaging|stagedReference/i.test(name))
    ).toEqual([]);

    const server = createServer(createApp({ referenceSourceStagingService: service }));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    servers.push(server);
    const baseUrl = serverUrl(server);
    for (const operation of ["publish", "migrate", "canonicalize", "activate"]) {
      const response = await fetch(`${baseUrl}/api/owner/reference-source-staging/${operation}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect(response.status, operation).toBe(404);
    }

    const legacyWriter = await fetch(`${baseUrl}/api/owner/reference-source-staging`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(legacyWriter.status).toBe(404);
  });

  it("keeps hidden evaluation material out of the disclosed fixture binding", () => {
    const graph = buildFixtureGraph();
    const vaultCommitment = record({
      recordKind: "evaluation_source_binding_commitment",
      id: "evaluation.vault-commitment",
      evaluationContext: {
        kind: "vault_commitment",
        algorithm: "hmac-sha256",
        keyId: "owner-vault-key-1",
        commitment: "e".repeat(64),
      },
      createdAt: NOW,
    });
    expect(Value.Check(EvaluationSourceBindingSchema, graph.evaluationBinding)).toBe(true);
    expect(Value.Check(ReferenceEvaluationSourceBindingCommitmentSchema, vaultCommitment)).toBe(
      true
    );
    expect(JSON.stringify(vaultCommitment)).not.toMatch(
      /digitalAssetRef|acquisitionRefs|accessDecisionRefs|evaluationVaultRef/
    );
    const service = createService();
    const base = service.applyTransaction(transaction("evaluation-base", graph.records));
    const mismatchedFixtureBinding = record({
      ...withoutDigest(graph.evaluationBinding),
      id: "binding.mismatched-evaluation-fixture",
      accessDecisionRefs: [ref(graph.permittedAccess)],
      evaluationContext: {
        kind: "disclosed_development_fixture",
        evaluationFixtureRef: ref(graph.restrictedDerivation),
      },
    });
    expect(Value.Check(EvaluationSourceBindingSchema, mismatchedFixtureBinding)).toBe(true);
    expect(() =>
      service.applyTransaction(
        transaction("mismatched-evaluation-fixture", [mismatchedFixtureBinding], headRef(base))
      )
    ).toThrow(/evaluation|fixture|acquisition|access/i);

    const committed = service.applyTransaction(
      transaction("opaque-vault-commitment", [vaultCommitment], headRef(base))
    );
    expect(committed.snapshot?.records).toContainEqual(vaultCommitment);
    expect(
      Value.Check(
        EvaluationSourceBindingSchema,
        record({
          ...withoutDigest(graph.evaluationBinding),
          evaluationVaultRef: {
            id: "vault.private-source",
            digest: "f".repeat(64),
          },
        })
      )
    ).toBe(false);
    expect(
      Value.Check(
        EvaluationSourceBindingSchema,
        record({
          recordKind: "evaluation_source_binding",
          id: "evaluation.hidden-with-leaking-role-refs",
          digitalAssetRef: ref(graph.asset),
          acquisitionRefs: [ref(graph.restrictedAcquisition)],
          accessDecisionRefs: [ref(graph.restrictedAccess)],
          retentionPolicyRef: externalRef("retention.vault"),
          evaluationContext: {
            kind: "vault_commitment",
            algorithm: "hmac-sha256",
            keyId: "vault-key-1",
            commitment: "f".repeat(64),
          },
          createdAt: NOW,
        })
      )
    ).toBe(false);
  });

  function createService(
    listLegacyOwnerReferences: () => ReturnType<OwnerStore["listReferences"]> = () => []
  ): ReferenceSourceStagingService {
    return new ReferenceSourceStagingService({
      store: new ReferenceSourceStagingStore({ rootDirectory: stagingRoot }),
      listLegacyOwnerReferences,
      now: () => new Date(NOW),
      createId: () => `generated-${++idSequence}`,
    });
  }
});

function buildFixtureGraph() {
  const work = record({
    recordKind: "work",
    id: "work.method",
    version: 1,
    preferredTitle: "A development-fixture method",
    creatorIdentityRefs: [],
    identityAssertionRefs: [],
    identityState: "incomplete",
  });
  const titleAssertion = record({
    recordKind: "identity_assertion",
    id: "identity.work-title",
    version: 1,
    subjectRef: ref(work),
    subjectKind: "work",
    property: "preferred_title",
    assertedValue: { kind: "text", value: "A development-fixture method" },
    claimant: { kind: "importer", claimantRef: externalRef("importer.local") },
    evidenceRefs: [],
    confidence: { kind: "unknown" },
    completeness: "incomplete",
    composition: "atomic",
    componentAssertionRefs: [],
    assertionState: "candidate",
    predecessorAssertionRefs: [],
    successorRelationship: "initial",
    conflictAssertionRefs: [],
    assertedAt: NOW,
  });
  const manifestation = record({
    recordKind: "source_manifestation",
    id: "manifestation.method-edition",
    version: 1,
    manifestationKind: "edition",
    workRelations: [{ workRef: ref(work), role: "edition_of" }],
    parentRelations: [],
    publicationStatement: "Development fixture, not a historical claim",
    languages: ["en"],
    editorIdentityRefs: [],
    translatorIdentityRefs: [],
    declaredChanges: ["Fixture excerpt"],
    identityAssertionRefs: [],
    identityState: "candidate",
  });
  const exemplar = record({
    recordKind: "exemplar",
    id: "exemplar.method-copy",
    version: 1,
    manifestationRefs: [ref(manifestation)],
    holdingInstitution: "Vellum test fixtures",
    shelfmark: "DEV-ONLY-1",
    completeness: "incomplete",
    exemplarNotes: ["Rights-approved synthetic development fixture"],
    identityAssertionRefs: [],
    identityState: "candidate",
  });
  const asset = record({
    recordKind: "digital_asset",
    id: "asset.source-pdf",
    sha256: SOURCE_SHA,
    mediaType: "application/pdf",
    byteLength: 1024,
  });
  const fixtureAsset = record({
    recordKind: "digital_asset",
    id: "asset.disclosed-evaluation-fixture",
    sha256: FIXTURE_SHA,
    mediaType: "application/json",
    byteLength: 256,
  });
  const restrictedAcquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.restricted",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [ref(exemplar)],
    origin: {
      sourceKind: "stable_url",
      providerRef: externalRef("provider.restricted-catalog"),
      providerObjectId: "object-1",
      redactedRetrievalUri: "urn:vellum:redacted-retrieval:restricted-object-1",
    },
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing.local-only"),
  });
  const permittedAcquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.permitted",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [ref(exemplar)],
    origin: {
      sourceKind: "upload",
      ownerActionRef: externalRef("owner-action.fixture-upload"),
    },
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing.development-fixture"),
  });
  const restrictedRights = record({
    recordKind: "rights_assertion",
    id: "rights.restricted-acquisition",
    version: 1,
    subjectRef: ref(restrictedAcquisition),
    subjectKind: "asset_acquisition",
    rightsKind: "scan_provider_terms",
    status: "restricted",
    claimant: { kind: "catalog", claimantRef: externalRef("catalog.restricted") },
    evidenceRefs: [externalRef("evidence.restricted-provider-terms")],
    assertedAt: NOW,
  });
  const permittedRights = record({
    recordKind: "rights_assertion",
    id: "rights.permitted-acquisition",
    version: 1,
    subjectRef: ref(permittedAcquisition),
    subjectKind: "asset_acquisition",
    rightsKind: "export_redistribution",
    status: "permitted",
    claimant: { kind: "reviewer", claimantRef: externalRef("reviewer.fixture-rights") },
    evidenceRefs: [externalRef("evidence.fixture-inclusion-review")],
    assertedAt: NOW,
  });
  const restrictedDerivation = record({
    recordKind: "source_derivation",
    id: "derivation.fixture-restricted",
    derivationKind: "fixture",
    inputRefs: [ref(asset)],
    sourceAcquisitionRefs: [ref(restrictedAcquisition)],
    sourceDerivationRefs: [],
    derivedRef: ref(fixtureAsset),
    componentRef: externalRef("component.fixture-builder"),
    configurationDigest: externalRef("configuration.fixture-v1").digest,
    createdAt: NOW,
  });
  const permittedDerivation = record({
    recordKind: "source_derivation",
    id: "derivation.fixture-permitted",
    derivationKind: "fixture",
    inputRefs: [ref(asset)],
    sourceAcquisitionRefs: [ref(permittedAcquisition)],
    sourceDerivationRefs: [],
    derivedRef: ref(fixtureAsset),
    componentRef: externalRef("component.fixture-builder"),
    configurationDigest: externalRef("configuration.fixture-v1").digest,
    createdAt: NOW,
  });
  const restrictedAccess = record({
    recordKind: "access_decision",
    id: "access.restricted",
    version: 1,
    outcome: "deny",
    operation: "repository_inclusion",
    sourceRefs: [ref(restrictedAcquisition)],
    derivativeRefs: [ref(restrictedDerivation), ref(fixtureAsset)],
    destination: { kind: "repository", id: "vellum-development-fixtures" },
    purpose: "Development fixture inclusion",
    policyRef: externalRef("policy.fixture-rights"),
    rightsAssertionRefs: [ref(restrictedRights)],
    authorityRefs: [externalRef("reviewer.fixture-rights")],
    rationale: "This acquisition path is not authorized for repository inclusion",
    decidedAt: NOW,
  });
  const permittedAccess = record({
    recordKind: "access_decision",
    id: "access.arrangement-source",
    version: 1,
    outcome: "allow",
    operation: "owner_private_study",
    sourceRefs: [ref(permittedAcquisition)],
    derivativeRefs: [],
    destination: { kind: "local_runtime" },
    purpose: "Bind source to arrangement workspace",
    assetRole: "arrangement_source",
    policyRef: externalRef("policy.local-study"),
    rightsAssertionRefs: [ref(permittedRights)],
    authorityRefs: [externalRef("owner.local")],
    rationale: "The rights-reviewed fixture permits local development use",
    decidedAt: NOW,
  });
  const ownerAccess = record({
    ...withoutDigest(permittedAccess),
    id: "access.owner-reference",
    purpose: "Bind source to Owner Reference Library",
    assetRole: "owner_reference",
    policyRef: externalRef("policy.owner-reference"),
    rationale: "The Owner explicitly retains this acquisition in the reference library",
  });
  const substitutionAccess = record({
    recordKind: "access_decision",
    id: "access.provenance-substitution",
    version: 1,
    outcome: "allow",
    operation: "repository_inclusion",
    sourceRefs: [ref(permittedAcquisition), ref(asset)],
    derivativeRefs: [ref(permittedDerivation), ref(fixtureAsset)],
    destination: { kind: "repository", id: "vellum-development-fixtures" },
    purpose: "Replace the restricted fixture provenance with the reviewed path",
    policyRef: externalRef("policy.fixture-rights"),
    rightsAssertionRefs: [ref(permittedRights)],
    authorityRefs: [externalRef("reviewer.fixture-rights")],
    rationale: "The decision authorizes only the exact replacement path",
    decidedAt: NOW,
  });
  const evaluationAccess = record({
    recordKind: "access_decision",
    id: "access.disclosed-evaluation-fixture",
    version: 1,
    outcome: "allow",
    operation: "repository_inclusion",
    sourceRefs: [ref(permittedAcquisition), ref(asset)],
    derivativeRefs: [ref(permittedDerivation), ref(fixtureAsset)],
    destination: { kind: "repository", id: "vellum-development-fixtures" },
    purpose: "Bind disclosed development fixture to evaluation",
    assetRole: "evaluation_source",
    policyRef: externalRef("policy.fixture-rights"),
    rightsAssertionRefs: [ref(permittedRights)],
    authorityRefs: [externalRef("reviewer.fixture-rights")],
    rationale: "This exact disclosed fixture path is approved for repository evaluation",
    decidedAt: NOW,
  });
  const segment = record({
    recordKind: "source_segment_version",
    id: "segment.fixture-page",
    version: 1,
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(permittedAcquisition)],
    provenancePathRefs: [ref(permittedDerivation)],
    pageAtlasRef: externalRef("page-atlas.fixture-v1"),
    canvasId: "canvas-1",
    printedLocator: "p. 1",
    scanLocator: "scan-page-1",
    coordinateSystem: "fixture-pixels-v1",
    regionTransforms: [{ kind: "identity", matrix: [1, 0, 0, 1, 0, 0] }],
    regions: [{ id: "region-1", x: 0, y: 0, width: 100, height: 100, unit: "pixel" }],
    modality: "mixed",
    sourceImageRef: externalRef("image.fixture-page-1"),
    cropDigest: "d".repeat(64),
  });
  const arrangementBinding = record({
    recordKind: "arrangement_source_binding",
    id: "binding.arrangement",
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(permittedAcquisition)],
    accessDecisionRefs: [ref(permittedAccess)],
    retentionPolicyRef: externalRef("retention.workspace"),
    workspaceRef: externalRef("workspace.development"),
    createdAt: NOW,
  });
  const ownerBinding = record({
    recordKind: "owner_reference_binding",
    id: "binding.owner-reference",
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(permittedAcquisition)],
    accessDecisionRefs: [ref(ownerAccess)],
    retentionPolicyRef: externalRef("retention.owner-library"),
    ownerLibraryRef: externalRef("owner-library.local"),
    createdAt: NOW,
  });
  const evaluationBinding = record({
    recordKind: "evaluation_source_binding",
    id: "binding.disclosed-evaluation-fixture",
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(permittedAcquisition)],
    accessDecisionRefs: [ref(evaluationAccess)],
    retentionPolicyRef: externalRef("retention.development-fixture"),
    evaluationContext: {
      kind: "disclosed_development_fixture",
      evaluationFixtureRef: ref(permittedDerivation),
    },
    createdAt: NOW,
  });
  const identityToManifestation = dependency(
    "dependency.identity-manifestation",
    titleAssertion,
    manifestation,
    "identity"
  );
  const manifestationToExemplar = dependency(
    "dependency.manifestation-exemplar",
    manifestation,
    exemplar,
    "identity"
  );
  const exemplarToOwnerBinding = dependency(
    "dependency.exemplar-owner-binding",
    exemplar,
    ownerBinding,
    "identity"
  );
  const substitution = record({
    recordKind: "provenance_substitution",
    id: "substitution.restricted-to-permitted",
    from: {
      acquisitionRef: ref(restrictedAcquisition),
      derivationRef: ref(restrictedDerivation),
    },
    to: {
      acquisitionRef: ref(permittedAcquisition),
      derivationRef: ref(permittedDerivation),
    },
    scope: {
      operation: substitutionAccess.operation,
      sourceAndDerivativeRefs: [
        ref(restrictedAcquisition),
        ref(restrictedDerivation),
        ref(permittedAcquisition),
        ref(permittedDerivation),
        ref(fixtureAsset),
      ],
      destination: substitutionAccess.destination,
      purpose: substitutionAccess.purpose,
      policyRef: substitutionAccess.policyRef,
    },
    accessDecisionRef: ref(substitutionAccess),
    authority: {
      kind: "rights_reviewer",
      authorityRef: externalRef("reviewer.fixture-rights"),
      evidenceRefs: [ref(permittedRights)],
    },
    rationale: "Only the exact reviewed acquisition and derivation replace the restricted path",
    decidedAt: NOW,
  });

  return {
    records: [
      work,
      titleAssertion,
      manifestation,
      exemplar,
      asset,
      fixtureAsset,
      restrictedAcquisition,
      permittedAcquisition,
      restrictedRights,
      permittedRights,
      restrictedDerivation,
      permittedDerivation,
      restrictedAccess,
      permittedAccess,
      ownerAccess,
      substitutionAccess,
      evaluationAccess,
      segment,
      arrangementBinding,
      ownerBinding,
      evaluationBinding,
      identityToManifestation,
      manifestationToExemplar,
      exemplarToOwnerBinding,
    ],
    work,
    titleAssertion,
    manifestation,
    exemplar,
    asset,
    restrictedAcquisition,
    permittedAcquisition,
    restrictedRights,
    permittedRights,
    restrictedDerivation,
    permittedDerivation,
    restrictedAccess,
    permittedAccess,
    ownerAccess,
    substitutionAccess,
    evaluationAccess,
    arrangementBinding,
    ownerBinding,
    evaluationBinding,
    identityToManifestation,
    manifestationToExemplar,
    exemplarToOwnerBinding,
    substitution,
  };
}

function correctedIdentity(graph: FixtureGraph): ReferenceSourceStagingRecord {
  return record({
    ...withoutDigest(graph.titleAssertion),
    version: 2,
    parentVersionRef: {
      id: graph.titleAssertion.id,
      version: 1,
      digest: graph.titleAssertion.digest,
    },
    assertedValue: { kind: "text", value: "The corrected development-fixture title" },
    confidence: {
      kind: "assessed",
      value: 0.82,
      basis: "Compared with the disclosed fixture catalog record",
      evidenceRefs: [ref(graph.work)],
    },
    completeness: "complete",
    composition: "atomic",
    assertionState: "reviewed",
    predecessorAssertionRefs: [ref(graph.titleAssertion)],
    successorRelationship: "correction",
    assertedAt: LATER,
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
    createdAt: NOW,
  });
}

function transaction(
  id: string,
  records: ReferenceSourceStagingRecord[],
  expectedHeadRef?: ReferenceRecordRef,
  submittedAt = NOW
): ReferenceSourceStagingTransaction {
  return {
    schemaVersion: 1,
    id: `transaction.${id}`,
    ...(expectedHeadRef ? { expectedHeadRef } : {}),
    operations: records.map((record) => ({ type: "append_record", record })),
    submittedAt,
  } as ReferenceSourceStagingTransaction;
}

function record(value: Record<string, unknown>): ReferenceSourceStagingRecord {
  return withReferenceRecordDigest(value) as unknown as ReferenceSourceStagingRecord;
}

function ref(recordValue: { id: string; digest: string }): ReferenceRecordRef {
  return { id: recordValue.id, digest: recordValue.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: withReferenceRecordDigest({ id }).digest };
}

function withoutDigest<T extends { digest: string }>(value: T): Omit<T, "digest"> {
  const { digest: _digest, ...core } = value;
  return core;
}

function headRef(diagnostics: {
  head: { snapshotId: string; digest: string } | null;
}): ReferenceRecordRef {
  if (!diagnostics.head) throw new Error("Expected a staging head");
  return { id: diagnostics.head.snapshotId, digest: diagnostics.head.digest };
}

function expectCoherentDiagnostics(diagnostics: {
  head: { snapshotId: string; digest: string; revision: number } | null;
  snapshot: ReferenceSourceStagingSnapshot | null;
}): void {
  if (!diagnostics.head || !diagnostics.snapshot) {
    throw new Error("Expected a coherent staging generation");
  }
  expect(diagnostics.head).toEqual({
    snapshotId: diagnostics.snapshot.id,
    digest: diagnostics.snapshot.digest,
    revision: diagnostics.snapshot.revision,
  });
}

function emptySnapshot(
  id: string,
  revision: number,
  parentSnapshotRef?: ReferenceRecordRef
): ReferenceSourceStagingSnapshot {
  const core = {
    schemaVersion: 1 as const,
    id,
    revision,
    ...(parentSnapshotRef ? { parentSnapshotRef } : {}),
    publicationState: "staging_only" as const,
    createdAt: NOW,
    records: [],
  };
  return { ...core, digest: withReferenceRecordDigest(core).digest };
}

function directorySnapshot(root: string): Record<string, string> {
  const snapshot: Record<string, string> = {};
  const visit = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const relative = path.relative(root, absolute);
      if (statSync(absolute).isDirectory()) {
        visit(absolute);
      } else {
        snapshot[relative] = readFileSync(absolute).toString("base64");
      }
    }
  };
  visit(root);
  return snapshot;
}

function serverUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP server address");
  return `http://127.0.0.1:${address.port}`;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
