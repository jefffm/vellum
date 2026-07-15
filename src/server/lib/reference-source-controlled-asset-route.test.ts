import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import express, { type ErrorRequestHandler } from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ApiResponse } from "../../lib/api-contract.js";
import { ApiRouteError } from "./create-route.js";
import { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import { createReferenceSourceControlledAssetUploadRoute } from "./reference-source-controlled-asset-route.js";
import { ReferenceSourceControlledAssetIngestionService } from "./reference-source-controlled-asset-service.js";
import { ReferenceSourceStagingService } from "./reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "./reference-source-staging-store.js";

const NOW = "2026-07-15T18:00:00.000Z";

describe("owner reference controlled-asset HTTP upload", () => {
  let rootDirectory: string;
  let server: Server;
  let staging: ReferenceSourceStagingService;
  let controlledStore: ReferenceSourceControlledArtifactStore;

  beforeEach(async () => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-reference-upload-route-"));
    let sequence = 0;
    staging = new ReferenceSourceStagingService({
      store: new ReferenceSourceStagingStore({
        rootDirectory: path.join(rootDirectory, "staging"),
      }),
      now: () => new Date(NOW),
      createId: () => `route-upload-${++sequence}`,
    });
    controlledStore = new ReferenceSourceControlledArtifactStore({
      rootDirectory: path.join(rootDirectory, "controlled"),
    });
    const service = new ReferenceSourceControlledAssetIngestionService({
      stagingService: staging,
      controlledStore,
      now: () => new Date(NOW),
    });
    const app = express();
    app.post(
      "/api/owner/reference-source-staging/assets",
      createReferenceSourceControlledAssetUploadRoute(service, { maxBytes: 1024 })
    );
    app.use(((error, _request, response, _next) => {
      const routeError = error instanceof ApiRouteError ? error : new ApiRouteError("error", 500);
      response.status(routeError.status).json({
        ok: false,
        error: {
          code: routeError.code,
          message: routeError.message,
          status: routeError.status,
          correlationId: "test",
          ...(routeError.details ? { details: routeError.details } : {}),
        },
      });
    }) satisfies ErrorRequestHandler);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("streams real bytes into the controlled store and staging graph", async () => {
    const response = await upload(pdf("route fixture"), {
      "X-Reference-Acquisition-Key": "route-fixture",
    });
    const body = (await response.json()) as ApiResponse<{
      replayed: boolean;
      digitalAsset: { id: string; digest: string; sha256: string };
      acquisition: { digitalAssetRef: { id: string; digest: string } };
      head: { snapshotId: string; digest: string; revision: number };
    }>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.replayed).toBe(false);
    expect(body.data.acquisition.digitalAssetRef).toEqual({
      id: body.data.digitalAsset.id,
      digest: body.data.digitalAsset.digest,
    });
    expect(controlledStore.observe()).toMatchObject({
      status: "complete",
      artifactBindings: [
        {
          artifactRef: {
            id: body.data.digitalAsset.id,
            digest: body.data.digitalAsset.digest,
          },
          blobSha256: body.data.digitalAsset.sha256,
        },
      ],
    });
    expect(staging.readCurrent().snapshot?.records.map(({ recordKind }) => recordKind)).toEqual([
      "digital_asset",
      "asset_acquisition",
    ]);

    const replay = await upload(pdf("route fixture"), {
      "X-Reference-Acquisition-Key": "route-fixture",
    });
    await expect(replay.json()).resolves.toMatchObject({
      ok: true,
      data: { replayed: true, head: body.data.head },
    });
  });

  it("rejects malformed metadata, spoofed media, stale heads, and oversized bodies without stray bytes", async () => {
    const missingKey = await upload(pdf("missing"));
    expect(missingKey.status).toBe(400);

    const spoofed = await upload(pdf("spoofed"), {
      "Content-Type": "image/png",
      "X-Reference-Acquisition-Key": "spoofed",
    });
    expect(spoofed.status).toBe(422);

    const halfHead = await upload(pdf("half head"), {
      "X-Reference-Acquisition-Key": "half-head",
      "X-Reference-Expected-Head-Id": "snapshot.only-id",
    });
    expect(halfHead.status).toBe(400);

    const stale = await upload(pdf("stale"), {
      "X-Reference-Acquisition-Key": "stale",
      "X-Reference-Expected-Head-Id": "snapshot.stale",
      "X-Reference-Expected-Head-Digest": "0".repeat(64),
    });
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "conflict", details: { currentHead: null } },
    });

    const oversized = await upload(
      Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(2048), Buffer.from("\n%%EOF")]),
      { "X-Reference-Acquisition-Key": "oversized" }
    );
    expect(oversized.status).toBe(413);
    expect(staging.readCurrent().head).toBeNull();
    expect(controlledStore.observe()).toMatchObject({ status: "complete", artifactBindings: [] });
  });

  function upload(bytes: Buffer, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${serverUrl()}/api/owner/reference-source-staging/assets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        ...headers,
      },
      body: new Uint8Array(bytes),
    });
  }

  function serverUrl(): string {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    return `http://127.0.0.1:${address.port}`;
  }
});

function pdf(content: string): Buffer {
  return Buffer.from(`%PDF-1.7\n${content}\n%%EOF\n`);
}
