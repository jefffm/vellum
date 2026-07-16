import { createServer, type Server } from "node:http";

import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiResponse } from "../../lib/api-contract.js";
import {
  withReferenceRecordDigest,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceSourceStagingSnapshot,
} from "../../lib/reference-source-domain.js";
import type { ReferenceSourceOperationResult } from "./reference-source-operation-gateway.js";
import { createReferenceSourceOperationDefaultDecisionRoute } from "./reference-source-operation-route.js";
import type { ReferenceSourceStagingState } from "./reference-source-staging-store.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
  vi.restoreAllMocks();
});

describe("reference-source operation default-decision HTTP boundary", () => {
  it("exercises the production gateway and returns a bounded private-default decision", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const state = stagingState();
    const server = await listen(state);
    servers.push(server);

    const response = await post(server, {
      schemaVersion: 1,
      acquisitionRef: ref(
        state.snapshot.records.find(
          (record): record is ReferenceAssetAcquisition => record.recordKind === "asset_acquisition"
        )!
      ),
      operation: "provider_model_processing",
      destination: { kind: "provider", id: "provider.untrusted" },
      purpose: "Test the owner-private default",
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as ApiResponse<ReferenceSourceOperationResult>;
    expect(body).toMatchObject({
      ok: true,
      data: {
        schemaVersion: 1,
        operation: "provider_model_processing",
        status: "deny",
        reasonCode: "owner_private_default_denied",
      },
    });
    expect(JSON.stringify(body)).not.toContain(state.snapshot.digest);
  });

  it("rejects client attempts to inject a capability, effects, or legacy bypass state", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const state = stagingState();
    const acquisition = state.snapshot.records.find(
      (record): record is ReferenceAssetAcquisition => record.recordKind === "asset_acquisition"
    )!;
    const server = await listen(state);
    servers.push(server);

    for (const injected of [
      { allowCapability: { forged: true } },
      { effects: { readControlledBytes: true, writeSink: true } },
      { cachedManifest: { access: "allow" } },
      { directCompilerImport: true },
      { legacyActivation: true },
    ]) {
      const response = await post(server, {
        schemaVersion: 1,
        acquisitionRef: ref(acquisition),
        operation: "local_extraction",
        destination: { kind: "local_runtime" },
        purpose: "Attempt a client-selected bypass",
        ...injected,
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: { code: "invalid_request", status: 400 },
      });
    }
  });
});

function stagingState(): ReferenceSourceStagingState {
  const asset = withReferenceRecordDigest({
    recordKind: "digital_asset" as const,
    id: "asset.operation-route",
    sha256: "a".repeat(64),
    mediaType: "application/pdf",
    byteLength: 17,
  }) as ReferenceDigitalAsset;
  const acquisition = withReferenceRecordDigest({
    recordKind: "asset_acquisition" as const,
    id: "acquisition.operation-route",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: {
      sourceKind: "upload" as const,
      ownerActionRef: externalRef("owner-action.operation-route"),
    },
    acquiredAt: "2026-07-16T12:00:00.000Z",
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.owner-private"),
  }) as ReferenceAssetAcquisition;
  const snapshot = withReferenceRecordDigest({
    schemaVersion: 1 as const,
    id: "snapshot.operation-route",
    revision: 1,
    publicationState: "staging_only" as const,
    createdAt: "2026-07-16T12:00:00.000Z",
    records: [asset, acquisition],
  }) as ReferenceSourceStagingSnapshot;
  return {
    head: { snapshotId: snapshot.id, digest: snapshot.digest, revision: snapshot.revision },
    snapshot,
  };
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return ref(withReferenceRecordDigest({ id }));
}

async function listen(state: ReferenceSourceStagingState): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.post(
    "/decision",
    createReferenceSourceOperationDefaultDecisionRoute({ readCurrentState: () => state })
  );
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function post(server: Server, body: unknown): Promise<Response> {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP server address");
  return fetch(`http://127.0.0.1:${address.port}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}
