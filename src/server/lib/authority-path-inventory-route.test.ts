import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiResponse } from "../../lib/api-contract.js";
import { getAuthorityPathInventoryView } from "../../lib/authority-path-inventory.js";
import { createApp } from "../index.js";
import { KnowledgePublicationStore } from "./knowledge-publication-store.js";
import { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import { ReferenceSourceStagingService } from "./reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "./reference-source-staging-store.js";

describe("Authority Path Inventory HTTP boundary", () => {
  let testRoot: string;
  let publicationStore: KnowledgePublicationStore;
  let server: Server | undefined;

  beforeEach(async () => {
    testRoot = mkdtempSync(path.join(tmpdir(), "vellum-authority-path-http-"));
    publicationStore = new KnowledgePublicationStore({
      rootDirectory: path.join(testRoot, "publication"),
    });
    vi.spyOn(publicationStore, "publish");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    server = createServer(
      createApp({
        knowledgePublicationStore: publicationStore,
        referenceSourceControlledArtifactStore: new ReferenceSourceControlledArtifactStore({
          rootDirectory: path.join(testRoot, "controlled-artifacts"),
        }),
        referenceSourceStagingService: new ReferenceSourceStagingService({
          store: new ReferenceSourceStagingStore({
            rootDirectory: path.join(testRoot, "staging"),
          }),
        }),
        ownerReferenceMigrationOwnerRootDirectory: path.join(testRoot, "owner"),
        ownerReferenceMigrationPrivateRootDirectory: path.join(testRoot, "migration-private"),
        ownerReferenceWorkbenchPrivateRootDirectory: path.join(testRoot, "workbench-private"),
        ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x41),
      })
    );
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve()))
      );
    }
    vi.restoreAllMocks();
    rmSync(testRoot, { recursive: true, force: true });
  });

  it("serves the exact immutable inventory view without publishing a generation", async () => {
    const response = await request("GET", "/api/owner/authority-path-inventory");
    expect(response.status).toBe(200);
    const envelope = (await response.json()) as ApiResponse<unknown>;
    expect(envelope.ok).toBe(true);
    if (!envelope.ok) return;
    expect(envelope.data).toEqual(structuredClone(await getAuthorityPathInventoryView()));
    expect(publicationStore.publish).not.toHaveBeenCalled();
    expect(publicationStore.readHead()).toBeNull();
  });

  it("exposes no mutation, resolution, or activation route", async () => {
    const absentRoutes: Array<{ method: string; pathname: string; body?: unknown }> = [
      { method: "POST", pathname: "/api/owner/authority-path-inventory", body: {} },
      { method: "PATCH", pathname: "/api/owner/authority-path-inventory", body: {} },
      { method: "GET", pathname: "/api/owner/authority-path-inventory/resolve" },
      { method: "POST", pathname: "/api/owner/authority-path-inventory/resolve", body: {} },
      { method: "GET", pathname: "/api/owner/authority-path-inventory/activate" },
      { method: "POST", pathname: "/api/owner/authority-path-inventory/activate", body: {} },
    ];

    for (const route of absentRoutes) {
      const response = await request(route.method, route.pathname, route.body);
      expect(response.status, `${route.method} ${route.pathname}`).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: { code: "not_found" },
      });
    }

    expect(publicationStore.publish).not.toHaveBeenCalled();
    expect(publicationStore.readHead()).toBeNull();
  });

  it("rejects a hostile browser origin without exposing or publishing the snapshot", async () => {
    const response = await request("GET", "/api/owner/authority-path-inventory", undefined, {
      Origin: "https://attacker.example",
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "forbidden_origin" },
    });
    expect(publicationStore.publish).not.toHaveBeenCalled();
    expect(publicationStore.readHead()).toBeNull();
  });

  function request(
    method: string,
    pathname: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {}
  ): Promise<Response> {
    const address = server!.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP listener");
    return fetch(`http://127.0.0.1:${address.port}${pathname}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...extraHeaders,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
});
