import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  withReferenceRecordDigest,
  type ReferenceSourceStagingInputRecord,
} from "../../src/lib/reference-source-domain.js";
import { createApp } from "../../src/server/index.js";
import { KnowledgePublicationStore } from "../../src/server/lib/knowledge-publication-store.js";
import { OwnerStore } from "../../src/server/lib/owner-store.js";
import { ReferenceSourceControlledArtifactStore } from "../../src/server/lib/reference-source-controlled-artifact-store.js";
import { ReferenceSourceStagingService } from "../../src/server/lib/reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "../../src/server/lib/reference-source-staging-store.js";

const NOW = "2026-07-16T12:00:00.000Z";
const LEGACY_BYTES = Buffer.from("%PDF-1.4\nOWNER REFERENCE PRODUCTION WIRING\n%%EOF\n");

const roots: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("T09 production OwnerReference migration wiring", () => {
  it("publishes through the default route service into the shared stores and preserves unrelated state", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const root = mkdtempSync(path.join(tmpdir(), "vellum-t09-production-wiring-"));
    roots.push(root);
    const ownerRoot = path.join(root, "owner");
    const ownerStore = new OwnerStore({
      rootDirectory: ownerRoot,
      now: () => new Date(NOW),
    });
    const legacyReference = ownerStore.addReference({
      title: "Private production-wiring reference",
      citation: "Private shelfmark for production-wiring test",
      mimeType: "application/pdf",
      contentBase64: LEGACY_BYTES.toString("base64"),
    });
    const targetAssetId = `digital-asset.sha256.${legacyReference.sha256}`;
    const rawRecordSha256 = sha256(
      readFileSync(path.join(ownerRoot, "references", `${legacyReference.id}.json`))
    );
    const publicationStore = new KnowledgePublicationStore({
      rootDirectory: path.join(root, "knowledge-publication"),
      now: () => new Date(NOW),
    });
    const seededPublication = publicationStore.publish({
      schemaVersion: 1,
      transactionId: "transaction.t09-production-unrelated-seed",
      writerKind: "system",
      expectedHead: null,
      writes: [
        {
          recordKind: "knowledge_pack_draft",
          id: "draft.t09-production-unrelated-seed",
          successorRefs: [],
          content: { fixture: "must survive OwnerReference migration" },
        },
      ],
    });
    const expectedHead = generationRef(seededPublication);
    let stagingId = 0;
    const stagingService = new ReferenceSourceStagingService({
      store: new ReferenceSourceStagingStore({
        rootDirectory: path.join(root, "reference-source-staging"),
        now: () => new Date(NOW),
      }),
      now: () => new Date(NOW),
      createId: () => `t09-production-wiring-${++stagingId}`,
    });
    const unrelatedGraphRecord = graphAsset("unrelated-before-owner-reference-migration");
    const seededGraph = stagingService.applyTransaction({
      schemaVersion: 1,
      id: "transaction.t09-production-unrelated-graph-seed",
      operations: [{ type: "append_record", record: unrelatedGraphRecord }],
      submittedAt: NOW,
    });
    const controlledStore = new ReferenceSourceControlledArtifactStore({
      rootDirectory: path.join(root, "controlled-artifacts"),
      now: () => new Date(NOW),
    });
    const server = await listen(
      createApp({
        ownerReferenceMigrationOwnerRootDirectory: ownerRoot,
        ownerReferenceMigrationPrivateRootDirectory: path.join(root, "migration-private"),
        knowledgePublicationStore: publicationStore,
        referenceSourceStagingService: stagingService,
        referenceSourceControlledArtifactStore: controlledStore,
      })
    );
    servers.push(server);
    const base = address(server);

    const dryRun = await jsonRequest(
      `${base}/api/owner/reference-migrations/owner-references/dry-run`,
      {
        method: "POST",
        body: JSON.stringify({ expectedHead }),
      }
    );
    expect(dryRun.response.status).toBe(200);
    expect(dryRun.json.data).toMatchObject({
      expectedHead,
      expectedGraphHead: seededGraph.head,
      mappings: [{ legacyId: legacyReference.id }],
    });
    expect(dryRun.json.data).not.toHaveProperty("legacyInventoryDigest");
    expect(dryRun.json.data.mappings[0]).not.toHaveProperty("targetAssetId");
    expect(dryRun.json.data.mappings[0]).not.toHaveProperty("targetAcquisitionId");

    const commit = await jsonRequest(
      `${base}/api/owner/reference-migrations/owner-references/commit`,
      {
        method: "POST",
        body: JSON.stringify({
          expectedHead,
          planDigest: dryRun.json.data.planDigest,
        }),
      }
    );
    expect(commit.response.status).toBe(200);
    expect(commit.json.data).toMatchObject({ outcome: "committed", journalState: "committed" });

    const currentPublication = publicationStore.readCurrent();
    expect(currentPublication?.head).toEqual(commit.json.data.head);
    expect(currentPublication?.head.revision).toBeGreaterThan(seededPublication.head.revision);
    expect(currentPublication?.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recordKind: "knowledge_pack_draft",
          id: "draft.t09-production-unrelated-seed",
        }),
        expect.objectContaining({ recordKind: "owner_reference_migration_mapping" }),
        expect.objectContaining({ recordKind: "owner_reference_migration_journal" }),
      ])
    );

    const currentGraph = stagingService.readCurrent();
    expect(currentGraph.head?.revision).toBe(seededGraph.head!.revision + 1);
    expect(currentGraph.snapshot?.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: unrelatedGraphRecord.id,
          digest: unrelatedGraphRecord.digest,
        }),
        expect.objectContaining({ id: targetAssetId }),
      ])
    );
    expect(controlledStore.observe().artifactBindings).toEqual([
      expect.objectContaining({
        artifactRef: expect.objectContaining({ id: targetAssetId }),
      }),
    ]);

    const compatibilityRoute = await jsonRequest(
      `${base}/api/owner/reference-migrations/owner-references`
    );
    expect(compatibilityRoute.response.status).toBe(200);
    expect(compatibilityRoute.json.data).toMatchObject({
      legacySourceState: "verified",
      ownerReferences: [
        {
          legacyId: legacyReference.id,
          state: "quarantined",
          legacySourceState: "verified",
          quarantineReason: "incomplete_identity",
        },
      ],
    });

    const publicationRoute = await jsonRequest(`${base}/api/owner/knowledge-publication`);
    expect(publicationRoute.response.status).toBe(200);
    expect(publicationRoute.json.data.current.head).toEqual(commit.json.data.head);
    expect(publicationRoute.json.data.current.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "draft.t09-production-unrelated-seed" }),
        expect.objectContaining({ recordKind: "owner_reference_migration_journal" }),
      ])
    );
    const graphRoute = await jsonRequest(`${base}/api/owner/reference-source-staging`);
    expect(graphRoute.response.status).toBe(200);
    expect(graphRoute.json.data.head).toEqual(currentGraph.head);
    expect(
      publicationRoute.json.data.current.records.every(
        (record: Record<string, unknown>) => !("content" in record)
      )
    ).toBe(true);
    const publicText = JSON.stringify({
      dryRun: dryRun.json,
      commit: commit.json,
      compatibility: compatibilityRoute.json,
      publicationRoute,
    });
    for (const privateFingerprint of [
      "Private production-wiring reference",
      "Private shelfmark for production-wiring test",
      LEGACY_BYTES.toString("utf8"),
      legacyReference.sha256,
      rawRecordSha256,
    ]) {
      expect(publicText).not.toContain(privateFingerprint);
    }
  });
});

function graphAsset(label: string): ReferenceSourceStagingInputRecord {
  const bytes = Buffer.from(label);
  const digest = sha256(bytes);
  return withReferenceRecordDigest({
    recordKind: "digital_asset" as const,
    id: `digital-asset.sha256.${digest}`,
    sha256: digest,
    mediaType: "application/octet-stream",
    byteLength: bytes.byteLength,
  }) as ReferenceSourceStagingInputRecord;
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function generationRef(result: ReturnType<KnowledgePublicationStore["publish"]>) {
  return {
    id: result.generation.id,
    digest: result.generation.digest,
    revision: result.generation.revision,
  };
}

async function listen(app: ReturnType<typeof createApp>): Promise<Server> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function address(server: Server): string {
  const value = server.address();
  if (!value || typeof value === "string") throw new Error("Expected TCP server address");
  return `http://127.0.0.1:${value.port}`;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

async function jsonRequest(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  return { response, json: (await response.json()) as any };
}
