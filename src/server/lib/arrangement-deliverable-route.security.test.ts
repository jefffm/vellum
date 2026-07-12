import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { GENERATED_ARTIFACT_POLICY_VERSION } from "../../lib/generated-artifact-security.js";
import type { Deliverable } from "../../lib/music-domain.js";
import type { WorkspaceStore } from "./workspace-store.js";
import { createArrangementRestoreRoute } from "./arrangement-deliverable-route.js";

describe("saved arrangement artifact security", () => {
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
  });

  it("re-sanitizes a legacy persisted SVG before returning it to the workbench", async () => {
    const hostileSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)"><script>alert(2)</script><a xlink:href="textedit:///private/tmp/source.ly"><g data-arrangement-event-id="event.1" data-measure-id="measure.1"><text>Playable note</text></g></a></svg>`;
    const { store, workspaceId, arrangementId } = fakeProjectionStore(hostileSvg);
    const server = await listen(store);
    servers.push(server);

    const response = await fetch(
      `${serverUrl(server)}/api/workspaces/${workspaceId}/arrangements/${arrangementId}/restore`
    );
    const body = (await response.json()) as {
      ok: boolean;
      data: { compiled: { svg: string; artifactPolicyVersion: string } };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.compiled.artifactPolicyVersion).toBe(GENERATED_ARTIFACT_POLICY_VERSION);
    expect(body.data.compiled.svg).toContain("Playable note");
    expect(body.data.compiled.svg).toContain('data-arrangement-event-id="event.1"');
    expect(body.data.compiled.svg).not.toMatch(/<script|<a\b|onload|href=|textedit:/i);
  });

  it("fails closed and requests regeneration for an invalid legacy preview", async () => {
    const { store, workspaceId, arrangementId } = fakeProjectionStore("<svg><g></svg>");
    const server = await listen(store);
    servers.push(server);

    const response = await fetch(
      `${serverUrl(server)}/api/workspaces/${workspaceId}/arrangements/${arrangementId}/restore`
    );
    const body = (await response.json()) as { error: string; code?: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe("conflict");
    expect(body.error).toContain("must be regenerated");
  });
});

function fakeProjectionStore(svg: string): {
  store: WorkspaceStore;
  workspaceId: string;
  arrangementId: string;
} {
  const workspaceId = "workspace.1234567890abcdef";
  const arrangementId = "arrangement.1234567890abcdef";
  const deliverables = [
    deliverable("lilypond", "text/x-lilypond"),
    deliverable("browser_preview", "image/svg+xml"),
    deliverable("audio_preview", "application/json"),
  ];
  const content = new Map<string, Buffer>([
    [deliverables[0]!.id, Buffer.from("{ c'4 }")],
    [deliverables[1]!.id, Buffer.from(svg)],
    [
      deliverables[2]!.id,
      Buffer.from(
        JSON.stringify({
          durationSeconds: 0,
          parts: [],
          events: [],
          performedForm: { measureOccurrences: [], repeatPolicy: "notated" },
        })
      ),
    ],
  ]);
  const byId = new Map(deliverables.map((item) => [item.id, item]));
  return {
    workspaceId,
    arrangementId,
    store: {
      get: () => ({ deliverableIds: deliverables.map((item) => item.id) }),
      getDeliverable: (_workspaceId: string, id: string) => byId.get(id)!,
      readDeliverableContent: (_workspaceId: string, id: string) => content.get(id)!,
    } as unknown as WorkspaceStore,
  };
}

function deliverable(kind: Deliverable["kind"], mimeType: string): Deliverable {
  return {
    id: `deliverable.${kind.replaceAll("_", "")}1234567890abcdef`,
    arrangementScoreId: "arrangement.1234567890abcdef",
    arrangementScoreVersion: 1,
    notationLayout: "tab-and-staff",
    kind,
    mimeType,
    sha256: "a".repeat(64),
    byteLength: 1,
    storedPath: `records/${kind}`,
    createdAt: "2026-07-11T00:00:00.000Z",
  };
}

async function listen(store: WorkspaceStore): Promise<Server> {
  const app = express();
  app.get(
    "/api/workspaces/:workspaceId/arrangements/:arrangementId/restore",
    createArrangementRestoreRoute(store)
  );
  app.use(
    (
      error: { status?: number; code?: string; message?: string },
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction
    ) => {
      response.status(error.status ?? 500).json({
        error: error.message ?? "Internal server error",
        code: error.code,
      });
    }
  );
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function serverUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server not listening");
  return `http://127.0.0.1:${address.port}`;
}
