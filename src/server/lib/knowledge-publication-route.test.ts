// @vitest-environment jsdom

import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiResponse } from "../../lib/api-contract.js";
import {
  renderKnowledgePublicationWorkbench,
  type KnowledgePublicationWorkbenchState,
} from "../../knowledge-publication-workbench.js";
import { createApp } from "../index.js";
import {
  KnowledgePublicationStore,
  type KnowledgePublicationTransaction,
} from "./knowledge-publication-store.js";
import { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import { ReferenceSourceStagingService } from "./reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "./reference-source-staging-store.js";

describe("knowledge publication HTTP boundary", () => {
  type HttpPublicationResult = NonNullable<KnowledgePublicationWorkbenchState["current"]> & {
    outcome: "committed" | "already_committed";
  };
  let rootDirectory: string;
  let server: Server | undefined;
  let store: KnowledgePublicationStore;

  beforeEach(async () => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-publication-http-"));
    store = new KnowledgePublicationStore({ rootDirectory });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    server = createServer(
      createApp({
        knowledgePublicationStore: store,
        knowledgePublicationWriter: store,
        referenceSourceStagingService: new ReferenceSourceStagingService({
          store: new ReferenceSourceStagingStore({
            rootDirectory: path.join(rootDirectory, "reference-source-staging"),
          }),
        }),
        referenceSourceControlledArtifactStore: new ReferenceSourceControlledArtifactStore({
          rootDirectory: path.join(rootDirectory, "controlled-artifacts"),
        }),
        ownerReferenceMigrationOwnerRootDirectory: path.join(rootDirectory, "owner"),
        ownerReferenceMigrationPrivateRootDirectory: path.join(rootDirectory, "migration-private"),
        ownerReferenceWorkbenchPrivateRootDirectory: path.join(rootDirectory, "workbench-private"),
        ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x4b),
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
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("publishes through an injected test-writer seam and reloads the exact HTTP generation", async () => {
    const published = await success<HttpPublicationResult>(
      await request("/api/owner/knowledge-publication/generations", {
        method: "POST",
        body: transaction("transaction.http", null),
      })
    );

    const current = await success<{
      current: ReturnType<KnowledgePublicationStore["readCurrent"]>;
      orphans: ReturnType<KnowledgePublicationStore["listOrphans"]>;
    }>(await request("/api/owner/knowledge-publication"));
    expect(current).toEqual({
      current: {
        head: published.head,
        generation: published.generation,
        records: published.records,
      },
      orphans: [],
    });
    expect(JSON.stringify(current)).not.toContain("PRIVATE-PAYLOAD-CANARY");
    const workbench = document.createElement("div");
    const rendered = renderKnowledgePublicationWorkbench(workbench, current);
    expect(rendered.current?.generation.id).toBe(published.generation.id);
    expect(workbench.textContent).toContain(published.generation.id);

    expect(
      await success(
        await request(`/api/owner/knowledge-publication/generations/${published.generation.id}`)
      )
    ).toEqual(current.current);
  });

  it("returns a closed stale-head conflict and exposes a reclaimable orphan", async () => {
    const first = await success<HttpPublicationResult>(
      await request("/api/owner/knowledge-publication/generations", {
        method: "POST",
        body: transaction("transaction.first", null),
      })
    );
    const expectedHead = {
      id: first.generation.id,
      digest: first.generation.digest,
      revision: first.generation.revision,
    };
    const second = await success<HttpPublicationResult>(
      await request("/api/owner/knowledge-publication/generations", {
        method: "POST",
        body: transaction("transaction.second", expectedHead),
      })
    );

    const stale = await request("/api/owner/knowledge-publication/generations", {
      method: "POST",
      body: transaction("transaction.stale", expectedHead),
    });
    expect(stale.status).toBe(409);
    const failure = (await stale.json()) as ApiResponse<unknown>;
    expect(failure.ok).toBe(false);
    if (failure.ok) return;
    expect(failure.error).toMatchObject({
      code: "conflict",
      details: {
        currentHead: second.head,
        orphanGenerationId: expect.stringMatching(/^publication-generation\./),
      },
    });

    const orphans = await success<ReturnType<KnowledgePublicationStore["listOrphans"]>>(
      await request("/api/owner/knowledge-publication/orphans")
    );
    expect(orphans).toHaveLength(1);
    const workbench = await success<KnowledgePublicationWorkbenchState>(
      await request("/api/owner/knowledge-publication")
    );
    expect(workbench.orphans[0]).toMatchObject({
      generationId: orphans[0]!.generationId,
      displayRef: {
        id: expect.stringMatching(/^owner-reference-publication-orphan\.[a-f0-9]{24}$/),
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    const reloaded = await success<KnowledgePublicationWorkbenchState>(
      await request("/api/owner/knowledge-publication")
    );
    expect(reloaded.orphans[0]!.displayRef).toEqual(workbench.orphans[0]!.displayRef);
    expect(
      await success(
        await request(`/api/owner/knowledge-publication/orphans/${orphans[0]!.generationId}`, {
          method: "DELETE",
        })
      )
    ).toEqual({ reclaimed: true });
    expect(store.readCurrent()?.head).toEqual(second.head);
  });

  it("rejects unknown fields and unreachable generation reads", async () => {
    const invalid = await request("/api/owner/knowledge-publication/generations", {
      method: "POST",
      body: { ...transaction("transaction.invalid", null), clientDigest: "0".repeat(64) },
    });
    expect(invalid.status).toBe(400);

    const missing = await request(
      "/api/owner/knowledge-publication/generations/publication-generation.missing"
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });

  function request(
    pathname: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<Response> {
    const address = server!.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP listener");
    return fetch(`http://127.0.0.1:${address.port}${pathname}`, {
      method: options.method ?? "GET",
      headers: options.body === undefined ? {} : { "Content-Type": "application/json" },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  }
});

async function success<T>(response: Response): Promise<T> {
  expect(response.status).toBe(200);
  const envelope = (await response.json()) as ApiResponse<T>;
  expect(envelope.ok).toBe(true);
  if (!envelope.ok) throw new Error(envelope.error.message);
  return envelope.data;
}

function transaction(
  transactionId: string,
  expectedHead: KnowledgePublicationTransaction["expectedHead"]
): KnowledgePublicationTransaction {
  return {
    schemaVersion: 1,
    transactionId,
    expectedHead,
    writerKind: "upload",
    writes: [
      {
        recordKind: "knowledge_pack_draft",
        id: `draft.${transactionId}`,
        successorRefs: [],
        content: { title: transactionId, private: "PRIVATE-PAYLOAD-CANARY" },
      },
    ],
  };
}
