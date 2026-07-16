import { createServer, type Server } from "node:http";

import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiResponse } from "../../lib/api-contract.js";
import { createOwnerReferencePageAtlasOperationRoute } from "./owner-reference-page-atlas-route.js";
import { OwnerReferencePageAtlasLineageLimitError } from "./owner-reference-page-atlas-service.js";

describe("Owner-reference Page Atlas route", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          })
      )
    );
    vi.restoreAllMocks();
  });

  it("reports a permanent cited-segment lineage limit without telling the Owner to retry", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const app = express();
    app.use(express.json());
    app.post(
      "/api/owner/reference-workbench/page-atlas",
      createOwnerReferencePageAtlasOperationRoute({
        executePageAtlas: vi.fn(async () => {
          throw new OwnerReferencePageAtlasLineageLimitError();
        }),
      })
    );
    const server = createServer(app);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const response = await fetch(`${serverUrl(server)}/api/owner/reference-workbench/page-atlas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaVersion: 1,
        action: "correct_mapping",
        workbenchSnapshotRef: opaqueRef("snapshot", "a"),
        workbenchCardRef: opaqueRef("card", "b"),
        operationRef: opaqueRef("operation", "c"),
        expectedProjectionRef: opaqueRef("projection", "d"),
        correction: {
          scanPageNumber: 1,
          printedLocator: "overflow",
          reason: "Attempt one correction beyond the bounded projection lineage.",
        },
      }),
    });
    const body = (await response.json()) as ApiResponse<unknown>;

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "conflict",
        message:
          "The Page Atlas correction history reached its bounded review limit. The existing lineage remains readable and unchanged; review it or begin a new Page Atlas operation.",
        status: 409,
      },
    });
  });
});

function opaqueRef(label: string, digestCharacter: string) {
  return {
    id: `owner-reference-${label}`,
    digest: digestCharacter.repeat(64),
  };
}

function serverUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
  return `http://127.0.0.1:${address.port}`;
}
