import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiResponse } from "../../lib/api-contract.js";
import { createApp } from "../index.js";
import { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import { ReferenceSourceStagingService } from "./reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "./reference-source-staging-store.js";

const NOW = "2026-07-15T18:00:00.000Z";

describe("controlled asset production wiring", () => {
  let rootDirectory: string;
  let server: Server;

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-reference-upload-integration-"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
    vi.restoreAllMocks();
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("shares one exact controlled store between raw ingestion and lifecycle inventory", async () => {
    let sequence = 0;
    const staging = new ReferenceSourceStagingService({
      store: new ReferenceSourceStagingStore({
        rootDirectory: path.join(rootDirectory, "staging"),
      }),
      now: () => new Date(NOW),
      createId: () => `integration-upload-${++sequence}`,
    });
    const controlledStore = new ReferenceSourceControlledArtifactStore({
      rootDirectory: path.join(rootDirectory, "controlled"),
    });
    const put = vi.spyOn(controlledStore, "putDigitalAsset");
    const observe = vi.spyOn(controlledStore, "observe");
    server = createServer(
      createApp({
        referenceSourceStagingService: staging,
        referenceSourceControlledArtifactStore: controlledStore,
      })
    );
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const uploadResponse = await fetch(
      `${serverUrl(server)}/api/owner/reference-source-staging/assets`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "X-Reference-Acquisition-Key": "shared-production-store",
        },
        body: new Uint8Array(Buffer.from("%PDF-1.7\nshared production store\n%%EOF\n")),
      }
    );
    const upload = (await uploadResponse.json()) as ApiResponse<{
      head: { snapshotId: string; digest: string };
      acquisition: { id: string; digest: string };
    }>;
    expect(uploadResponse.status).toBe(200);
    expect(upload.ok).toBe(true);
    if (!upload.ok) return;
    expect(put).toHaveBeenCalledTimes(1);

    observe.mockClear();
    const planResponse = await fetch(
      `${serverUrl(server)}/api/owner/reference-source-staging/lifecycle/plan`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          expectedHeadRef: {
            id: upload.data.head.snapshotId,
            digest: upload.data.head.digest,
          },
          action: {
            kind: "delete_acquisition",
            targetAcquisitionRef: {
              id: upload.data.acquisition.id,
              digest: upload.data.acquisition.digest,
            },
            reason: "Exercise production inventory over the uploaded bytes",
          },
        }),
      }
    );
    expect(planResponse.status).toBe(200);
    expect(observe).toHaveBeenCalledTimes(1);
  });
});

function serverUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP server address");
  return `http://127.0.0.1:${address.port}`;
}
