import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReferenceRecordRef } from "../../lib/reference-source-domain.js";
import { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import {
  ReferenceSourceControlledAssetIngestionConflictError,
  ReferenceSourceControlledAssetIngestionIntegrityError,
  ReferenceSourceControlledAssetIngestionService,
} from "./reference-source-controlled-asset-service.js";
import { ReferenceSourceStagingService } from "./reference-source-staging-service.js";
import {
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingStore,
} from "./reference-source-staging-store.js";

const NOW = "2026-07-15T18:00:00.000Z";

describe("owner reference controlled-asset ingestion", () => {
  let rootDirectory: string;
  let staging: ReferenceSourceStagingService;
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
    service = new ReferenceSourceControlledAssetIngestionService({
      stagingService: staging,
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

  it("rolls back a newly-created byte binding when metadata validation fails before head movement", async () => {
    vi.spyOn(staging, "applyTransaction").mockImplementation(() => {
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
