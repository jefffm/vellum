import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ApiResponse } from "../../lib/api-contract.js";
import { createApp } from "../index.js";
import { KnowledgePublicationStore } from "./knowledge-publication-store.js";
import { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import { ReferenceSourceStagingService } from "./reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "./reference-source-staging-store.js";

type ApiEnvelope<T> = ApiResponse<T>;

type TemplateSummary = {
  name: string;
  description: string;
};

describe("template API routes", () => {
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

  it("lists all templates", async () => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/templates`);
    const json = (await response.json()) as ApiEnvelope<TemplateSummary[]>;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json.ok).toBe(true);
    if (json.ok) {
      expect(json.data).toHaveLength(8);
      expect(json.data.map((template) => template.name).sort()).toEqual([
        "continuo",
        "french-tab",
        "grand-staff",
        "satb",
        "solo-tab",
        "tab-and-staff",
        "voice-and-piano",
        "voice-and-tab",
      ]);
      expect(json.data[0]).toEqual({ name: expect.any(String), description: expect.any(String) });
    }
  });

  it("returns raw LilyPond source as text", async () => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/templates/french-tab`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain('\\version "2.24.0"');
    expect(body).toContain("fret-letter-tablature-format");
  });

  it("returns 404 for unknown templates", async () => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/templates/nonexistent`);
    const json = (await response.json()) as ApiEnvelope<unknown>;

    expect(response.status).toBe(404);
    expect(json.ok).toBe(false);
  });

  it("rejects path traversal", async () => {
    const server = await listen();
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/templates/..%2fpasswd`);

    expect([400, 404]).toContain(response.status);
  });
});

async function listen(): Promise<Server> {
  const rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-template-http-owner-"));
  let server: Server;
  try {
    server = createServer(
      createApp({
        knowledgePublicationStore: new KnowledgePublicationStore({
          rootDirectory: path.join(rootDirectory, "knowledge-publication"),
        }),
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
        ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x54),
      })
    );
  } catch (error) {
    rmSync(rootDirectory, { recursive: true, force: true });
    throw error;
  }
  server.once("close", () => rmSync(rootDirectory, { recursive: true, force: true }));

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  return server;
}

function serverUrl(server: Server): string {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return `http://127.0.0.1:${address.port}`;
}
