import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import express, { type ErrorRequestHandler } from "express";
import { afterEach, describe, expect, it } from "vitest";
import type { Deliverable } from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";
import { createDeliverableContentRoute } from "./family-deliverable-route.js";
import type { WorkspaceStore } from "./workspace-store.js";

describe("deliverable content route", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map(
          (server) =>
            new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve()))
            )
        )
    );
  });

  it("serves a valid PDF inline with an isolated artifact policy", async () => {
    const content = Buffer.from("%PDF-1.7\nfixture");
    const deliverable = storedDeliverable("pdf", "application/pdf", content);
    const response = await fetchContent(deliverable, content);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename="${deliverable.id}.pdf"`
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(content);
  });

  it("forces even hostile SVG deliverables to download without changing their stored bytes", async () => {
    const content = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>globalThis.pwned=true</script></svg>'
    );
    const deliverable = storedDeliverable("browser_preview", "image/svg+xml", content);
    const response = await fetchContent(deliverable, content);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="${deliverable.id}.svg"`
    );
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(content);
  });

  it("rejects a deliverable whose kind and MIME type disagree", async () => {
    const content = Buffer.from("<html>hostile</html>");
    const deliverable = storedDeliverable("browser_preview", "text/html", content);
    const response = await fetchContent(deliverable, content);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Stored deliverable kind and MIME type are inconsistent",
    });
  });

  it("rejects content that has valid metadata but invalid magic bytes", async () => {
    const content = Buffer.from("<html>not a pdf</html>");
    const deliverable = storedDeliverable("pdf", "application/pdf", content);
    const response = await fetchContent(deliverable, content);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Stored deliverable content does not match its MIME type",
    });
  });

  async function fetchContent(deliverable: Deliverable, content: Buffer): Promise<Response> {
    const store = {
      getDeliverable: () => deliverable,
      readDeliverableContent: () => content,
    } as unknown as WorkspaceStore;
    const app = express();
    app.get(
      "/api/workspaces/:workspaceId/deliverables/:deliverableId/content",
      createDeliverableContentRoute(store)
    );
    app.use(((error, _request, response, _next) => {
      const status = error instanceof ApiRouteError ? error.status : 500;
      response.status(status).json({ error: error instanceof Error ? error.message : "error" });
    }) satisfies ErrorRequestHandler);
    const server = createServer(app);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    return await fetch(
      `http://127.0.0.1:${address.port}/api/workspaces/workspace.1234567890abcdef/deliverables/${deliverable.id}/content`
    );
  }
});

function storedDeliverable(
  kind: Deliverable["kind"],
  mimeType: string,
  content: Buffer
): Deliverable {
  return {
    id: "deliverable.1234567890abcdef",
    arrangementScoreId: "arrangement.1234567890abcdef",
    arrangementScoreVersion: 1,
    notationLayout: "standard-notation",
    kind,
    mimeType,
    sha256: createHash("sha256").update(content).digest("hex"),
    byteLength: content.byteLength,
    storedPath: `records/deliverable-artifacts/deliverable.1234567890abcdef/artifact`,
    createdAt: "2026-07-11T12:00:00.000Z",
  };
}
