import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  withReferenceRecordDigest,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceControlledArtifactStore,
  ReferenceSourceControlledArtifactStoreConflictError,
} from "./reference-source-controlled-artifact-store.js";
import {
  ReferenceSourceControlledAssetIngestionConflictError,
  ReferenceSourceControlledAssetIngestionIntegrityError,
  ReferenceSourceControlledAssetIngestionRecoveryRequiredError,
  ReferenceSourceControlledAssetIngestionService,
} from "./reference-source-controlled-asset-service.js";
import {
  createReferenceSourceControlledUploadStagingWriter,
  ReferenceSourceStagingService,
  type ReferenceSourceControlledUploadStagingWriter,
} from "./reference-source-staging-service.js";
import {
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingConflictError,
  ReferenceSourceStagingStore,
} from "./reference-source-staging-store.js";

const NOW = "2026-07-15T18:00:00.000Z";

describe("owner reference controlled-asset ingestion", () => {
  let rootDirectory: string;
  let staging: ReferenceSourceStagingService;
  let stagingWriter: ReferenceSourceControlledUploadStagingWriter;
  let controlledStore: ReferenceSourceControlledArtifactStore;
  let service: ReferenceSourceControlledAssetIngestionService;

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-reference-ingestion-"));
    let sequence = 0;
    staging = new ReferenceSourceStagingService({
      store: new ReferenceSourceStagingStore({
        rootDirectory: path.join(rootDirectory, "staging"),
      }),
      now: () => new Date(NOW),
      createId: () => `ingestion-test-${++sequence}`,
    });
    controlledStore = new ReferenceSourceControlledArtifactStore({
      rootDirectory: path.join(rootDirectory, "controlled"),
    });
    const reservedWriter = createReferenceSourceControlledUploadStagingWriter(staging);
    stagingWriter = {
      readCurrent: reservedWriter.readCurrent,
      applyTransaction: reservedWriter.applyTransaction,
    };
    service = new ReferenceSourceControlledAssetIngestionService({
      stagingService: stagingWriter,
      controlledStore,
      now: () => new Date(NOW),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("server-mints byte identity and distinct retry-safe acquisition provenance", async () => {
    const bytes = pdf("same bytes");
    const first = await service.ingest({
      bytes,
      declaredMediaType: "application/pdf",
      acquisitionKey: "owner-upload-first",
    });
    const firstHead = first.head;
    const firstGeneration = controlledStore.observe().storeGeneration;

    expect(first).toMatchObject({
      schemaVersion: 1,
      publicationState: "staging_only",
      replayed: false,
      digitalAsset: {
        recordKind: "digital_asset",
        id: `digital-asset.sha256.${sha256(bytes)}`,
        sha256: sha256(bytes),
        byteLength: bytes.byteLength,
        mediaType: "application/pdf",
      },
      acquisition: {
        recordKind: "asset_acquisition",
        representedExemplarRefs: [],
        rightsAssertionRefs: [],
        origin: { sourceKind: "upload" },
      },
    });
    expect(first.acquisition.digitalAssetRef).toEqual(ref(first.digitalAsset));

    const replay = await service.ingest({
      bytes,
      declaredMediaType: "application/pdf; charset=binary",
      acquisitionKey: "owner-upload-first",
    });
    expect(replay.replayed).toBe(true);
    expect(replay.head).toEqual(firstHead);
    expect(replay.acquisition).toEqual(first.acquisition);
    expect(controlledStore.observe().storeGeneration).toBe(firstGeneration);

    const second = await service.ingest({
      bytes,
      declaredMediaType: "application/pdf",
      acquisitionKey: "owner-upload-second",
      expectedHeadRef: headRef(first),
    });
    expect(second.replayed).toBe(false);
    expect(second.digitalAsset).toEqual(first.digitalAsset);
    expect(second.acquisition.id).not.toBe(first.acquisition.id);
    expect(second.acquisition.digitalAssetRef).toEqual(first.acquisition.digitalAssetRef);
    expect(
      staging
        .readCurrent()
        .snapshot?.records.filter((record) => record.recordKind === "digital_asset")
    ).toHaveLength(1);
    expect(
      staging
        .readCurrent()
        .snapshot?.records.filter((record) => record.recordKind === "asset_acquisition")
    ).toHaveLength(2);
  });

  it("rejects key reuse for different bytes and rejects declared-media spoofing without writes", async () => {
    const first = await service.ingest({
      bytes: pdf("first"),
      declaredMediaType: "application/pdf",
      acquisitionKey: "stable-key",
    });
    const state = staging.store.readCurrentState();
    const generation = controlledStore.observe().storeGeneration;

    await expect(
      service.ingest({
        bytes: pdf("different"),
        declaredMediaType: "application/pdf",
        acquisitionKey: "stable-key",
        expectedHeadRef: headRef(first),
      })
    ).rejects.toBeInstanceOf(ReferenceSourceControlledAssetIngestionConflictError);
    await expect(
      service.ingest({
        bytes: pdf("pretending to be an image"),
        declaredMediaType: "image/png",
        acquisitionKey: "spoofed-media",
        expectedHeadRef: headRef(first),
      })
    ).rejects.toBeInstanceOf(ReferenceSourceControlledAssetIngestionIntegrityError);

    expect(staging.store.readCurrentState()).toEqual(state);
    expect(controlledStore.observe().storeGeneration).toBe(generation);
  });

  it("checks the exact staging head before writing bytes", async () => {
    const first = await service.ingest({
      bytes: pdf("base"),
      declaredMediaType: "application/pdf",
      acquisitionKey: "base",
    });
    const generation = controlledStore.observe().storeGeneration;

    await expect(
      service.ingest({
        bytes: pdf("stale"),
        declaredMediaType: "application/pdf",
        acquisitionKey: "stale",
        expectedHeadRef: { id: first.head.snapshotId, digest: "0".repeat(64) },
      })
    ).rejects.toMatchObject({ currentHead: first.head });
    expect(controlledStore.observe().storeGeneration).toBe(generation);
  });

  it("holds the catalog claim across metadata commit so a second service cannot abort the live intent", async () => {
    const contenderStore = new ReferenceSourceControlledArtifactStore({
      rootDirectory: path.join(rootDirectory, "controlled"),
    });
    const contenderWriter = createReferenceSourceControlledUploadStagingWriter(staging);
    const applyTransaction = stagingWriter.applyTransaction;
    let contenderAttempted = false;
    vi.spyOn(stagingWriter, "applyTransaction").mockImplementation((transaction) => {
      contenderAttempted = true;
      expect(
        () =>
          new ReferenceSourceControlledAssetIngestionService({
            stagingService: contenderWriter,
            controlledStore: contenderStore,
            now: () => new Date(NOW),
          })
      ).toThrow(ReferenceSourceControlledArtifactStoreConflictError);
      return applyTransaction(transaction);
    });

    const bytes = pdf("cross-process live intent");
    const committed = await service.ingest({
      bytes,
      declaredMediaType: "application/pdf",
      acquisitionKey: "cross-process-live-intent",
    });

    expect(contenderAttempted).toBe(true);
    expect(controlledStore.observe()).toMatchObject({
      status: "complete",
      artifactBindings: [
        {
          artifactRef: ref(committed.digitalAsset),
          blobSha256: committed.digitalAsset.sha256,
          byteLength: committed.digitalAsset.byteLength,
        },
      ],
    });
    expect(contenderStore.listPreparedDigitalAssetIngestions()).toEqual([]);
    expect(
      staging
        .readCurrent()
        .snapshot?.records.filter(
          (record) =>
            record.recordKind === "asset_acquisition" && record.id === committed.acquisition.id
        )
    ).toEqual([committed.acquisition]);

    const contenderService = new ReferenceSourceControlledAssetIngestionService({
      stagingService: contenderWriter,
      controlledStore: contenderStore,
      now: () => new Date(NOW),
    });
    await expect(
      contenderService.ingest({
        bytes,
        declaredMediaType: "application/pdf",
        acquisitionKey: "cross-process-live-intent",
      })
    ).resolves.toMatchObject({
      replayed: true,
      digitalAsset: committed.digitalAsset,
      acquisition: committed.acquisition,
      head: committed.head,
    });
    expect(contenderStore.observe()).toEqual(controlledStore.observe());
  });

  it("rolls back a newly-created byte binding when metadata validation fails before head movement", async () => {
    vi.spyOn(stagingWriter, "applyTransaction").mockImplementation(() => {
      throw new ReferenceSourceStagingIntegrityError("injected metadata rejection");
    });

    await expect(
      service.ingest({
        bytes: pdf("rollback"),
        declaredMediaType: "application/pdf",
        acquisitionKey: "rollback",
      })
    ).rejects.toThrow("injected metadata rejection");
    expect(controlledStore.observe()).toMatchObject({
      status: "complete",
      artifactBindings: [],
    });
    expect(staging.readCurrent().head).toBeNull();
  });

  it("removes prepared bytes when an unrelated writer moves the head before metadata commit", async () => {
    vi.spyOn(stagingWriter, "applyTransaction").mockImplementation(() => {
      staging.applyTransaction(
        appendTransaction("head-mover", unrelatedDigitalAsset("head-mover"))
      );
      throw new ReferenceSourceStagingConflictError(
        "injected stale-head rejection",
        staging.readCurrent().head
      );
    });

    await expect(
      service.ingest({
        bytes: pdf("head moved after prepare"),
        declaredMediaType: "application/pdf",
        acquisitionKey: "head-moved-after-prepare",
      })
    ).rejects.toThrow("injected stale-head rejection");

    expect(staging.readCurrent().head).not.toBeNull();
    expect(controlledStore.observe()).toMatchObject({
      status: "complete",
      artifactBindings: [],
    });
    expect(controlledStore.listPreparedDigitalAssetIngestions()).toEqual([]);
  });

  it("preserves prepared bytes when the winning metadata contains a legitimate acquisition", async () => {
    let winningAsset: ReferenceDigitalAsset | undefined;
    vi.spyOn(stagingWriter, "applyTransaction").mockImplementation((transaction) => {
      const asset = transaction.operations
        .map(({ record }) => record)
        .find((record): record is ReferenceDigitalAsset => record.recordKind === "digital_asset");
      if (!asset) throw new Error("test transaction omitted its Digital Asset");
      winningAsset = asset;
      const acquiredAt = NOW;
      const acquisition = withReferenceRecordDigest({
        recordKind: "asset_acquisition" as const,
        id: "acquisition.concurrent-private-scan",
        digitalAssetRef: ref(asset),
        representedExemplarRefs: [],
        origin: {
          sourceKind: "private_scan" as const,
          ownerActionRef: externalRef("owner-action.concurrent-private-scan"),
        },
        acquiredAt,
        rightsAssertionRefs: [],
        processingPolicyRef: externalRef("processing-policy.concurrent-private-scan"),
      });
      staging.applyTransaction({
        schemaVersion: 1,
        id: "transaction.concurrent-private-scan",
        operations: [asset, acquisition].map((record) => ({
          type: "append_record" as const,
          record,
        })),
        submittedAt: acquiredAt,
      });
      throw new ReferenceSourceStagingConflictError(
        "injected concurrent winner",
        staging.readCurrent().head
      );
    });

    await expect(
      service.ingest({
        bytes: pdf("concurrent legitimate acquisition"),
        declaredMediaType: "application/pdf",
        acquisitionKey: "losing-owner-upload",
      })
    ).rejects.toThrow("injected concurrent winner");

    expect(winningAsset).toBeDefined();
    expect(controlledStore.observe()).toMatchObject({
      status: "complete",
      artifactBindings: [
        {
          artifactRef: ref(winningAsset!),
          blobSha256: winningAsset!.sha256,
          byteLength: winningAsset!.byteLength,
        },
      ],
    });
    expect(controlledStore.listPreparedDigitalAssetIngestions()).toEqual([]);
  });

  it("recovers a crash after metadata commit without exposing complete orphan bytes", async () => {
    const commit = vi
      .spyOn(controlledStore, "commitDigitalAssetIngestion")
      .mockImplementationOnce(() => {
        throw new Error("injected crash before controlled binding commit");
      });
    const bytes = pdf("restart recovery");

    await expect(
      service.ingest({
        bytes,
        declaredMediaType: "application/pdf",
        acquisitionKey: "restart-recovery",
      })
    ).rejects.toBeInstanceOf(ReferenceSourceControlledAssetIngestionRecoveryRequiredError);
    expect(
      staging
        .readCurrent()
        .snapshot?.records.some(({ recordKind }) => recordKind === "asset_acquisition")
    ).toBe(true);
    expect(controlledStore.observe()).toMatchObject({
      status: "failed",
      failureCode: "enumeration_incomplete",
      artifactBindings: [],
    });
    commit.mockRestore();

    const restartedStore = new ReferenceSourceControlledArtifactStore({
      rootDirectory: path.join(rootDirectory, "controlled"),
    });
    expect(restartedStore.observe()).toMatchObject({ status: "failed", artifactBindings: [] });
    const restartedWriter = createReferenceSourceControlledUploadStagingWriter(staging);
    const restartedService = new ReferenceSourceControlledAssetIngestionService({
      stagingService: restartedWriter,
      controlledStore: restartedStore,
      now: () => new Date(NOW),
    });

    expect(restartedStore.observe()).toMatchObject({
      status: "complete",
      artifactBindings: [{ blobSha256: sha256(bytes), byteLength: bytes.byteLength }],
    });
    expect(restartedStore.listPreparedDigitalAssetIngestions()).toEqual([]);
    await expect(
      restartedService.ingest({
        bytes,
        declaredMediaType: "application/pdf",
        acquisitionKey: "restart-recovery",
      })
    ).resolves.toMatchObject({ replayed: true });
  });
});

function pdf(content: string): Buffer {
  return Buffer.from(`%PDF-1.7\n${content}\n%%EOF\n`);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function headRef(value: { head: { snapshotId: string; digest: string } }): ReferenceRecordRef {
  return { id: value.head.snapshotId, digest: value.head.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: withReferenceRecordDigest({ id }).digest };
}

function unrelatedDigitalAsset(key: string): ReferenceDigitalAsset {
  const bytes = Buffer.from(key);
  return withReferenceRecordDigest({
    recordKind: "digital_asset" as const,
    id: `digital-asset.unrelated.${key}`,
    sha256: sha256(bytes),
    mediaType: "application/octet-stream",
    byteLength: bytes.byteLength,
  }) as ReferenceDigitalAsset;
}

function appendTransaction(
  key: string,
  record: ReferenceDigitalAsset
): ReferenceSourceStagingTransaction {
  return {
    schemaVersion: 1,
    id: `transaction.${key}`,
    operations: [{ type: "append_record", record }],
    submittedAt: NOW,
  };
}
