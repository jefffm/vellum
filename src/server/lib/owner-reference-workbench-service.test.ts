import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it, vi } from "vitest";

import { OwnerReferenceWorkbenchSnapshotSchema } from "../../lib/owner-reference-workbench-contract.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingSnapshot,
} from "../../lib/reference-source-domain.js";
import type { OwnerReferenceMigrationCompatibilityView } from "./owner-reference-migration-service.js";
import { OWNER_REFERENCE_UPLOAD_PROCESSING_POLICY_REF } from "./reference-source-controlled-asset-service.js";
import type { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import type {
  ReferenceSourceOperationEffects,
  ReferenceSourceOperationRequest,
} from "./reference-source-operation-gateway.js";
import {
  OwnerReferenceLocalStudyUnavailableError,
  type OwnerReferenceLocalStudyExecutionInput,
  type OwnerReferenceLocalStudySink,
} from "./owner-reference-local-study-service.js";
import {
  OwnerReferenceWorkbenchIntegrityError,
  OwnerReferenceWorkbenchOpaqueProjector,
  OwnerReferenceWorkbenchService,
  loadOrCreateOwnerReferenceWorkbenchOpaqueProjector,
} from "./owner-reference-workbench-service.js";
import type { ReferenceSourceStagingDiagnostics } from "./reference-source-staging-service.js";

const NOW = "2026-07-16T12:00:00.000Z";
const PRIVATE_PATH_CANARY = "/private/Owner Library/secret-scan.pdf";
const PRIVATE_TITLE_CANARY = "Private Serdoura scan title";
const LEGACY_ID = "legacy-owner-reference.private-serdoura-scan";
const UPLOAD_KEY = `owner-upload.v2.${"A".repeat(43)}`;
const OPAQUE_KEY = Buffer.alloc(32, 0x42);

describe("OwnerReferenceWorkbenchService", () => {
  it("joins migrated and uploaded records into a stable redacted closed-schema snapshot", () => {
    const fixture = mixedFixture();
    const readCurrent = vi.fn(() => fixture.staging);
    const readCompatibility = vi.fn(() => fixture.migration);
    const observe = vi.fn(() => fixture.controlledArtifacts);
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent },
      migration: { readCompatibility },
      controlledArtifacts: { observe },
      opaqueProjector: projector(),
    });

    const first = service.read();
    const second = service.read();
    const reloaded = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    }).read();

    expect(first).toEqual(second);
    expect(first).toEqual(reloaded);
    expect(readCurrent).toHaveBeenCalledTimes(4);
    expect(readCompatibility).toHaveBeenCalledTimes(4);
    expect(observe).toHaveBeenCalledTimes(4);
    expect(first.references).toHaveLength(2);

    const migrated = first.references.find(({ origin }) => origin === "migrated");
    const uploaded = first.references.find(({ origin }) => origin === "upload");
    expect(migrated).toMatchObject({
      origin: "migrated",
      mediaType: "application/pdf",
      byteLength: 123_456,
      identity: { state: "unresolved" },
      rights: { state: "unasserted", assertionCount: 0 },
      migration: {
        state: "quarantined",
        legacySourceState: "verified",
        quarantineReason: "incomplete_identity",
      },
      roleBindings: {
        state: "unbound",
        ownerReferenceCount: 0,
        arrangementSourceCount: 0,
        evaluationSourceCount: 0,
      },
    });
    expect(uploaded).toMatchObject({
      origin: "upload",
      mediaType: "image/tiff",
      byteLength: 654_321,
      identity: { state: "unresolved" },
      rights: { state: "unasserted", assertionCount: 0 },
      migration: null,
      roleBindings: {
        state: "bound",
        ownerReferenceCount: 1,
        arrangementSourceCount: 0,
        evaluationSourceCount: 0,
      },
    });
    expect(uploaded?.access.map(({ operation, status }) => [operation, status])).toEqual([
      ["local_study", "review_required"],
      ["local_extraction", "review_required"],
      ["provider_egress", "deny"],
      ["fixture_inclusion", "deny"],
      ["repository_inclusion", "deny"],
      ["export", "deny"],
      ["redistribution", "deny"],
      ["report", "deny"],
      ["log", "deny"],
    ]);

    const serialized = JSON.stringify(first);
    for (const canary of [
      PRIVATE_PATH_CANARY,
      PRIVATE_TITLE_CANARY,
      LEGACY_ID,
      fixture.rawDigests.migrated,
      fixture.rawDigests.uploaded,
      fixture.rawIds.migratedAsset,
      fixture.rawIds.uploadedAsset,
      fixture.rawIds.migratedAcquisition,
      fixture.rawIds.uploadedAcquisition,
    ]) {
      expect(serialized).not.toContain(canary);
    }
    expect(serialized).not.toContain('"sha256"');
    expect(() =>
      Value.Decode(OwnerReferenceWorkbenchSnapshotSchema, {
        ...first,
        privatePath: PRIVATE_PATH_CANARY,
      })
    ).toThrow();
  });

  it("uses a persistent keyed projector rather than an unkeyed digest", () => {
    const fixture = mixedFixture();
    const first = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    }).read();
    const second = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    }).read();
    const otherKey = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(Buffer.alloc(32, 0x24)),
    }).read();
    const rawAcquisition = fixture.staging.snapshot!.records.find(
      ({ id }) => id === fixture.rawIds.migratedAcquisition
    )!;
    const unkeyedDigest = referenceSourceDigest({
      domain: "vellum.owner-reference-workbench.opaque-ref.v1",
      kind: "acquisition",
      value: rawAcquisition,
    });

    expect(second).toEqual(first);
    expect(otherKey.snapshotRef).not.toEqual(first.snapshotRef);
    expect(first.references.map(({ acquisitionRef }) => acquisitionRef.digest)).not.toContain(
      unkeyedDigest
    );
  });

  it("keeps the source snapshot stable across unrelated publication heads", () => {
    const fixture = mixedFixture();
    let migration = fixture.migration;
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    });

    const first = service.read();
    migration = {
      ...migration,
      head: {
        generationId: "generation.unrelated-reviewed-knowledge-release",
        digest: "c".repeat(64),
        revision: 2,
      },
    };
    const afterUnrelatedHead = service.read();

    expect(afterUnrelatedHead).toEqual(first);

    migration = {
      ...migration,
      ownerReferences: migration.ownerReferences.map((reference) => {
        const { quarantineReason: _quarantineReason, ...current } = reference;
        return { ...current, state: "mapped" as const };
      }),
    };
    const afterCompatibilityChange = service.read();

    expect(afterCompatibilityChange.snapshotRef).not.toEqual(first.snapshotRef);
    expect(
      afterCompatibilityChange.references.find(({ origin }) => origin === "migrated")?.migration
        ?.state
    ).toBe("mapped");
  });

  it("confirms a retry key only through its healthy opaque Workbench card", () => {
    const fixture = mixedFixture();
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    });
    const snapshot = service.read();
    const uploaded = snapshot.references.find(({ origin }) => origin === "upload")!;

    expect(service.confirmUpload({ schemaVersion: 1, acquisitionKey: UPLOAD_KEY })).toEqual({
      schemaVersion: 1,
      status: "present",
      snapshotRef: snapshot.snapshotRef,
      cardRef: uploaded.cardRef,
    });
    const absent = service.confirmUpload({
      schemaVersion: 1,
      acquisitionKey: `owner-upload.v2.${"B".repeat(43)}`,
    });
    expect(absent).toMatchObject({ status: "absent", snapshotRef: snapshot.snapshotRef });
    expect(JSON.stringify([absent, uploaded.cardRef])).not.toContain(UPLOAD_KEY);
    expect(JSON.stringify([absent, uploaded.cardRef])).not.toContain(
      fixture.rawIds.uploadedAcquisition
    );
  });

  it("publishes one complete key across a concurrent creator race and restart", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-workbench-key-"));
    try {
      const value = { privateIdentity: LEGACY_ID, digest: "a".repeat(64) };
      let concurrent: OwnerReferenceWorkbenchOpaqueProjector | undefined;
      const firstProjector = loadOrCreateOwnerReferenceWorkbenchOpaqueProjector(root, {
        beforePublish: () => {
          concurrent = loadOrCreateOwnerReferenceWorkbenchOpaqueProjector(root);
        },
      });
      const first = firstProjector.project("fixture", value);
      expect(concurrent?.project("fixture", value)).toEqual(first);
      const reloaded = loadOrCreateOwnerReferenceWorkbenchOpaqueProjector(root).project(
        "fixture",
        value
      );
      expect(reloaded).toEqual(first);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: "missing",
      mutate: (binding: ControlledArtifactObservation["artifactBindings"][number]) => null,
    },
    {
      name: "mismatched",
      mutate: (binding: ControlledArtifactObservation["artifactBindings"][number]) => ({
        ...binding,
        blobSha256: "0".repeat(64),
      }),
    },
    {
      name: "tampered",
      mutate: (binding: ControlledArtifactObservation["artifactBindings"][number]) => ({
        ...binding,
        artifactRef: { ...binding.artifactRef, digest: "0".repeat(64) },
      }),
    },
  ])("fails closed when a migrated controlled binding is $name", ({ mutate }) => {
    const fixture = mixedFixture();
    const bindings = fixture.controlledArtifacts.artifactBindings.flatMap((binding) => {
      if (binding.artifactRef.id !== fixture.rawIds.migratedAsset) return [binding];
      const changed = mutate(binding);
      return changed ? [changed] : [];
    });
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: {
        observe: () => ({ ...fixture.controlledArtifacts, artifactBindings: bindings }),
      },
      opaqueProjector: projector(),
    });

    expect(() => service.read()).toThrow(/migrated Owner reference has no exact healthy/);
  });

  it("retries a cross-store interleaving and emits only one stable generation", () => {
    const fixture = mixedFixture();
    const nextSnapshot = withReferenceRecordDigest({
      ...fixture.staging.snapshot!,
      id: "reference-source-staging.workbench-fixture-next",
      revision: fixture.staging.snapshot!.revision + 1,
      parentSnapshotRef: ref(fixture.staging.snapshot!),
      digest: undefined,
    }) as ReferenceSourceStagingSnapshot;
    const nextStaging: ReferenceSourceStagingDiagnostics = {
      ...fixture.staging,
      head: {
        snapshotId: nextSnapshot.id,
        digest: nextSnapshot.digest,
        revision: nextSnapshot.revision,
      },
      snapshot: nextSnapshot,
    };
    const readCurrent = vi
      .fn<() => ReferenceSourceStagingDiagnostics>()
      .mockReturnValueOnce(fixture.staging)
      .mockReturnValue(nextStaging);
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    });

    expect(service.read().references).toHaveLength(2);
    expect(readCurrent).toHaveBeenCalledTimes(4);
  });

  it("retries a stable graph-before-journal gap instead of omitting the migrated card", () => {
    const fixture = mixedFixture();
    const graphBeforeJournal: OwnerReferenceMigrationCompatibilityView = {
      ...fixture.migration,
      ownerReferences: [],
    };
    const readCompatibility = vi
      .fn<() => OwnerReferenceMigrationCompatibilityView>()
      .mockReturnValueOnce(graphBeforeJournal)
      .mockReturnValueOnce(graphBeforeJournal)
      .mockReturnValue(fixture.migration);
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    });

    expect(
      service
        .read()
        .references.map(({ origin }) => origin)
        .sort()
    ).toEqual(["migrated", "upload"]);
    expect(readCompatibility).toHaveBeenCalledTimes(4);
  });

  it("retries a transient controlled-binding publication gap", () => {
    const fixture = mixedFixture();
    const incomplete: ControlledArtifactObservation = {
      ...fixture.controlledArtifacts,
      artifactBindings: fixture.controlledArtifacts.artifactBindings.filter(
        ({ artifactRef }) => artifactRef.id !== fixture.rawIds.migratedAsset
      ),
    };
    const observe = vi
      .fn<() => ControlledArtifactObservation>()
      .mockReturnValueOnce(incomplete)
      .mockReturnValueOnce(incomplete)
      .mockReturnValue(fixture.controlledArtifacts);
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe },
      opaqueProjector: projector(),
    });

    expect(service.read().references).toHaveLength(2);
    expect(observe).toHaveBeenCalledTimes(4);
  });

  it("resolves a current opaque card through the sealed local-operation gateway", async () => {
    const fixture = mixedFixture();
    const execute = vi.fn(
      async (
        _request: ReferenceSourceOperationRequest,
        _effects: ReferenceSourceOperationEffects
      ) => ({
        schemaVersion: 1 as const,
        acquisitionId: fixture.rawIds.uploadedAcquisition,
        snapshotId: fixture.staging.snapshot!.id,
        operation: "local_extraction" as const,
        status: "review_required" as const,
        reasonCode: "owner_private_local_review_required" as const,
      })
    );
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
      operationGateway: { execute },
    });
    const snapshot = service.read();
    const uploaded = snapshot.references.find(({ origin }) => origin === "upload")!;

    const result = await service.reviewLocalOperation({
      schemaVersion: 1,
      snapshotRef: snapshot.snapshotRef,
      cardRef: uploaded.cardRef,
      operation: "local_extraction",
      purpose: "Prepare a local-only candidate extraction for Owner review",
    });

    expect(result).toEqual({
      schemaVersion: 1,
      operation: "local_extraction",
      status: "review_required",
      reasonCode: "owner_private_local_review_required",
    });
    expect(JSON.stringify(result)).not.toContain(fixture.rawIds.uploadedAcquisition);
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]![0]).toMatchObject({
      acquisitionRef: { id: fixture.rawIds.uploadedAcquisition },
      destination: { kind: "local_runtime" },
    });
  });

  it("counts current applicable Rights Assertions appended after immutable acquisition", () => {
    const fixture = mixedFixture();
    const uploadedAcquisition = fixture.staging.snapshot!.records.find(
      (record): record is ReferenceAssetAcquisition =>
        record.id === fixture.rawIds.uploadedAcquisition &&
        record.recordKind === "asset_acquisition"
    )!;
    const rights = withReferenceRecordDigest({
      recordKind: "rights_assertion" as const,
      id: "rights-assertion.owner-private-study.workbench-count",
      version: 1,
      subjectRef: ref(uploadedAcquisition),
      subjectKind: "asset_acquisition" as const,
      rightsKind: "owner_private_access" as const,
      status: "permitted" as const,
      claimant: { kind: "owner" as const, claimantRef: externalRef("authority.owner-attested") },
      evidenceRefs: [externalRef("evidence.owner-attested-local-study")],
      assertedAt: NOW,
    }) as ReferenceRightsAssertion;
    const staging = stagingWithRecords(fixture.staging, [
      ...fixture.staging.snapshot!.records,
      rights,
    ]);
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    });

    expect(
      service.read().references.find(({ origin }) => origin === "upload")?.rights
    ).toMatchObject({ state: "recorded", assertionCount: 1 });
    expect(uploadedAcquisition.rightsAssertionRefs).toEqual([]);
  });

  it("resolves local study only through the current exact opaque snapshot and card", async () => {
    const fixture = mixedFixture();
    const sink = vi.fn();
    const execute = vi.fn(
      async (
        _input: OwnerReferenceLocalStudyExecutionInput,
        _sink: OwnerReferenceLocalStudySink
      ) => ({
        status: "executed" as const,
        replayed: false,
        rightsAssertionRef: externalRef("rights.local-study.internal"),
        accessDecisionRef: externalRef("decision.local-study.internal"),
      })
    );
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
      localStudyService: { execute },
    });
    const snapshot = service.read();
    const card = snapshot.references.find(({ origin }) => origin === "upload")!;
    const request = {
      schemaVersion: 1 as const,
      snapshotRef: snapshot.snapshotRef,
      cardRef: card.cardRef,
      operation: "owner_private_study" as const,
      purpose: "Read the selected source privately on this local runtime",
      authorization: "owner_attested_local_study" as const,
      operationKey: `owner-local-study.v1.${"A".repeat(22)}`,
    };

    await service.executeLocalStudy(request, sink);
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]![0]).toMatchObject({
      request,
      currentWorkbenchSnapshotRef: snapshot.snapshotRef,
      currentStagingSnapshotRef: {
        id: fixture.staging.snapshot!.id,
        digest: fixture.staging.snapshot!.digest,
      },
      acquisition: { id: fixture.rawIds.uploadedAcquisition },
      digitalAsset: { id: fixture.rawIds.uploadedAsset },
    });
    await expect(
      service.executeLocalStudy(
        { ...request, cardRef: projector().project("card", "not-current") },
        sink
      )
    ).rejects.toBeInstanceOf(OwnerReferenceLocalStudyUnavailableError);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("fails closed for a digest-valid role binding without an exact allow Access Decision", () => {
    const fixture = mixedFixture();
    const records = fixture.staging.snapshot!.records.map((record) =>
      record.recordKind === "owner_reference_binding"
        ? (withReferenceRecordDigest({
            ...record,
            accessDecisionRefs: [externalRef("access-decision.unresolved")],
            digest: undefined,
          }) as ReferenceSourceStagingRecord)
        : record
    );
    const staging = stagingWithRecords(fixture.staging, records);
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    });

    expect(() => service.read()).toThrow(/staging snapshot is not canonically valid/);
  });

  it.each([
    {
      name: "deny decision",
      mutate: (decision: ReferenceAccessDecision) => ({ ...decision, outcome: "deny" as const }),
    },
    {
      name: "wrong acquisition scope",
      mutate: (decision: ReferenceAccessDecision) => ({
        ...decision,
        sourceRefs: decision.sourceRefs.filter(({ id }) => !id.startsWith("acquisition.")),
      }),
    },
  ])("fails closed for a role binding backed by a $name", ({ mutate }) => {
    const fixture = mixedFixture();
    const priorDecision = fixture.staging.snapshot!.records.find(
      (record): record is ReferenceAccessDecision => record.recordKind === "access_decision"
    )!;
    const decision = withReferenceRecordDigest({
      ...mutate(priorDecision),
      digest: undefined,
    }) as ReferenceAccessDecision;
    const records = fixture.staging.snapshot!.records.map((record) => {
      if (record.id === priorDecision.id) return decision;
      if (record.recordKind !== "owner_reference_binding") return record;
      return withReferenceRecordDigest({
        ...record,
        accessDecisionRefs: [ref(decision)],
        digest: undefined,
      }) as ReferenceSourceStagingRecord;
    });
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => stagingWithRecords(fixture.staging, records) },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    });

    expect(() => service.read()).toThrow(/staging snapshot is not canonically valid/);
  });

  it("fails closed when a migration compatibility identity has no exact acquisition", () => {
    const fixture = mixedFixture();
    const migratedAcquisitionId = fixture.rawIds.migratedAcquisition;
    const staging = stagingWithRecords(
      fixture.staging,
      fixture.staging.snapshot!.records.filter((record) => record.id !== migratedAcquisitionId)
    );
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    });

    expect(() => service.read()).toThrow(OwnerReferenceWorkbenchIntegrityError);
    expect(() => service.read()).toThrow(/do not name the same exact acquisitions/);
  });

  it.each(["mapped", "rolled_back"] as const)(
    "keeps a migrated card visible when compatibility state is %s",
    (state) => {
      const fixture = mixedFixture();
      const migratedReference = fixture.migration.ownerReferences[0]!;
      fixture.migration.ownerReferences[0] = {
        legacyId: migratedReference.legacyId,
        state,
        legacySourceState: migratedReference.legacySourceState,
        mappingId: migratedReference.mappingId,
      };
      const service = new OwnerReferenceWorkbenchService({
        staging: { readCurrent: () => fixture.staging },
        migration: { readCompatibility: () => fixture.migration },
        controlledArtifacts: { observe: () => fixture.controlledArtifacts },
        opaqueProjector: projector(),
      });

      expect(
        service.read().references.find(({ origin }) => origin === "migrated")?.migration
      ).toMatchObject({ state });
    }
  );

  it("omits a generic staged upload that lacks the exact controlled-upload policy", () => {
    const fixture = mixedFixture({
      uploadProcessingPolicyRef: externalRef("processing-policy.forged-generic-upload"),
    });
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => fixture.controlledArtifacts },
      opaqueProjector: projector(),
    });

    expect(service.read().references.map(({ origin }) => origin)).toEqual(["migrated"]);
  });

  it("fails closed when upload metadata claims the controlled policy without stored bytes", () => {
    const fixture = mixedFixture();
    const controlledArtifacts: ControlledArtifactObservation = {
      ...fixture.controlledArtifacts,
      artifactBindings: fixture.controlledArtifacts.artifactBindings.filter(
        ({ artifactRef }) => artifactRef.id !== fixture.rawIds.uploadedAsset
      ),
    };
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => controlledArtifacts },
      opaqueProjector: projector(),
    });

    expect(() => service.read()).toThrow(OwnerReferenceWorkbenchIntegrityError);
    expect(() => service.read()).toThrow(/no exact healthy controlled-artifact binding/);
  });

  it("fails closed when controlled-store inventory health cannot be established", () => {
    const fixture = mixedFixture();
    const controlledArtifacts: ControlledArtifactObservation = {
      ...fixture.controlledArtifacts,
      status: "failed",
      failureCode: "read_error",
      artifactBindings: [],
    };
    const service = new OwnerReferenceWorkbenchService({
      staging: { readCurrent: () => fixture.staging },
      migration: { readCompatibility: () => fixture.migration },
      controlledArtifacts: { observe: () => controlledArtifacts },
      opaqueProjector: projector(),
    });

    expect(() => service.read()).toThrow(OwnerReferenceWorkbenchIntegrityError);
    expect(() => service.read()).toThrow(/inventory is not complete/);
  });
});

type ControlledArtifactObservation = ReturnType<ReferenceSourceControlledArtifactStore["observe"]>;

function mixedFixture(options: { uploadProcessingPolicyRef?: ReferenceRecordRef } = {}): {
  staging: ReferenceSourceStagingDiagnostics;
  migration: OwnerReferenceMigrationCompatibilityView;
  controlledArtifacts: ControlledArtifactObservation;
  rawDigests: { migrated: string; uploaded: string };
  rawIds: {
    migratedAsset: string;
    uploadedAsset: string;
    migratedAcquisition: string;
    uploadedAcquisition: string;
  };
} {
  const migratedSha = "a".repeat(64);
  const uploadedSha = "b".repeat(64);
  const suffix = sha256(LEGACY_ID).slice(0, 32);
  const migratedAsset = digitalAsset(
    `digital-asset.sha256.${migratedSha}`,
    migratedSha,
    "application/pdf",
    123_456
  );
  const uploadedAsset = digitalAsset(
    `digital-asset.sha256.${uploadedSha}`,
    uploadedSha,
    "image/tiff",
    654_321
  );
  const migratedAcquisition = acquisition({
    id: `acquisition.legacy-owner-reference.${suffix}`,
    asset: migratedAsset,
    origin: {
      sourceKind: "legacy_owner_reference",
      legacyRecordRef: externalRef("legacy-owner-reference-record.private"),
    },
  });
  const uploadedAcquisition = acquisition({
    id: `acquisition.owner-upload.${sha256(UPLOAD_KEY).slice(0, 32)}`,
    asset: uploadedAsset,
    origin: {
      sourceKind: "upload",
      ownerActionRef: externalRef("owner-action.upload-1"),
    },
    processingPolicyRef:
      options.uploadProcessingPolicyRef ?? OWNER_REFERENCE_UPLOAD_PROCESSING_POLICY_REF,
  });
  const ownerStudyDecision = withReferenceRecordDigest({
    recordKind: "access_decision",
    id: "access-decision.owner-reference-local",
    version: 1,
    outcome: "allow",
    operation: "owner_private_study",
    sourceRefs: [ref(uploadedAcquisition), ref(uploadedAsset)],
    derivativeRefs: [],
    destination: { kind: "local_runtime" },
    purpose: "Owner-attested private local study",
    assetRole: "owner_reference",
    policyRef: externalRef("policy.owner-reference-private-defaults.v1"),
    rightsAssertionRefs: [],
    authorityRefs: [externalRef("authority.owner-local-attestation")],
    rationale: "The Owner explicitly authorized local study without broader authority.",
    decidedAt: NOW,
  }) as ReferenceAccessDecision;
  const ownerBinding = withReferenceRecordDigest({
    recordKind: "owner_reference_binding",
    id: "owner-reference-binding.upload-1",
    digitalAssetRef: ref(uploadedAsset),
    acquisitionRefs: [ref(uploadedAcquisition)],
    accessDecisionRefs: [ref(ownerStudyDecision)],
    retentionPolicyRef: externalRef("retention-policy.owner-private"),
    createdAt: NOW,
    ownerLibraryRef: externalRef("owner-library.local"),
  }) as ReferenceSourceStagingRecord;
  const records = [
    migratedAsset,
    uploadedAsset,
    migratedAcquisition,
    uploadedAcquisition,
    ownerStudyDecision,
    ownerBinding,
  ] as ReferenceSourceStagingRecord[];
  const snapshot = withReferenceRecordDigest({
    schemaVersion: 1,
    id: "reference-source-staging.workbench-fixture",
    revision: 1,
    publicationState: "staging_only",
    createdAt: NOW,
    records,
  }) as ReferenceSourceStagingSnapshot;
  const staging: ReferenceSourceStagingDiagnostics = {
    publicationState: "staging_only",
    head: { snapshotId: snapshot.id, digest: snapshot.digest, revision: snapshot.revision },
    snapshot,
    view: { kind: "current" },
    legacyProjection: {
      ownerReferences: [
        {
          id: LEGACY_ID,
          title: PRIVATE_TITLE_CANARY,
          citation: PRIVATE_PATH_CANARY,
          mimeType: "application/pdf",
          sha256: migratedSha,
          byteLength: 123_456,
          createdAt: NOW,
          readOnly: true,
          identityConfidence: { kind: "unknown" },
        },
      ],
    },
    capabilities: { stagingTransactions: true, canonicalPublication: false },
  };
  const migration = {
    schemaVersion: 1,
    publicationState: "migration_only",
    head: null,
    legacySourceState: "verified",
    ownerReferences: [
      {
        legacyId: LEGACY_ID,
        state: "quarantined",
        legacySourceState: "verified",
        quarantineReason: "incomplete_identity",
        mappingId: `owner-reference-migration-mapping.${suffix}`,
      },
    ],
    capabilities: {},
  } as unknown as OwnerReferenceMigrationCompatibilityView;

  return {
    staging,
    migration,
    controlledArtifacts: {
      storeGeneration: 1,
      storeStateDigest: referenceSourceDigest({
        fixture: "owner-reference-workbench-controlled-artifacts",
      }),
      status: "complete",
      artifactBindings: [
        {
          artifactRef: ref(migratedAsset),
          blobSha256: migratedAsset.sha256,
          byteLength: migratedAsset.byteLength,
        },
        {
          artifactRef: ref(uploadedAsset),
          blobSha256: uploadedAsset.sha256,
          byteLength: uploadedAsset.byteLength,
        },
      ],
    },
    rawDigests: { migrated: migratedSha, uploaded: uploadedSha },
    rawIds: {
      migratedAsset: migratedAsset.id,
      uploadedAsset: uploadedAsset.id,
      migratedAcquisition: migratedAcquisition.id,
      uploadedAcquisition: uploadedAcquisition.id,
    },
  };
}

function digitalAsset(
  id: string,
  sha256Digest: string,
  mediaType: string,
  byteLength: number
): ReferenceDigitalAsset {
  return withReferenceRecordDigest({
    recordKind: "digital_asset",
    id,
    sha256: sha256Digest,
    mediaType,
    byteLength,
  }) as ReferenceDigitalAsset;
}

function acquisition(options: {
  id: string;
  asset: ReferenceDigitalAsset;
  origin: ReferenceAssetAcquisition["origin"];
  processingPolicyRef?: ReferenceRecordRef;
}): ReferenceAssetAcquisition {
  return withReferenceRecordDigest({
    recordKind: "asset_acquisition",
    id: options.id,
    digitalAssetRef: ref(options.asset),
    representedExemplarRefs: [],
    origin: options.origin,
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef:
      options.processingPolicyRef ?? externalRef("processing-policy.owner-private"),
  }) as ReferenceAssetAcquisition;
}

function stagingWithRecords(
  staging: ReferenceSourceStagingDiagnostics,
  records: ReferenceSourceStagingRecord[]
): ReferenceSourceStagingDiagnostics {
  const snapshot = withReferenceRecordDigest({
    ...staging.snapshot!,
    records,
    digest: undefined,
  }) as ReferenceSourceStagingSnapshot;
  return {
    ...staging,
    head: {
      snapshotId: snapshot.id,
      digest: snapshot.digest,
      revision: snapshot.revision,
    },
    snapshot,
  };
}

function ref(record: { id: string; digest: string }): ReferenceRecordRef {
  return { id: record.id, digest: record.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function projector(key: Uint8Array = OPAQUE_KEY): OwnerReferenceWorkbenchOpaqueProjector {
  return new OwnerReferenceWorkbenchOpaqueProjector(key);
}
