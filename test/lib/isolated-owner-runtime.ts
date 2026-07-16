import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import { createApp } from "../../src/server/index.js";
import { KnowledgePublicationStore } from "../../src/server/lib/knowledge-publication-store.js";
import { ReferenceSourceControlledArtifactStore } from "../../src/server/lib/reference-source-controlled-artifact-store.js";
import { ReferenceSourceStagingService } from "../../src/server/lib/reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "../../src/server/lib/reference-source-staging-store.js";

type CreateAppOptions = NonNullable<Parameters<typeof createApp>[0]>;

export type IsolatedOwnerRuntime = Readonly<{
  rootDirectory: string;
  options: CreateAppOptions;
  cleanup: () => void;
}>;

/**
 * Give every HTTP test its own complete local-first Owner trust boundary.
 *
 * Falling through to createApp's production defaults would let parallel test
 * workers read and claim the real ~/.vellum catalogs. Besides making the suite
 * flaky, that would make tests capable of observing or mutating Owner data.
 */
export function createIsolatedOwnerRuntime(overrides: CreateAppOptions = {}): IsolatedOwnerRuntime {
  const rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-http-test-owner-"));
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    rmSync(rootDirectory, { recursive: true, force: true });
  };

  try {
    const options: CreateAppOptions = {
      knowledgePublicationStore: new KnowledgePublicationStore({
        rootDirectory: path.join(rootDirectory, "knowledge-publication"),
      }),
      referenceSourceStagingService: new ReferenceSourceStagingService({
        store: new ReferenceSourceStagingStore({
          rootDirectory: path.join(rootDirectory, "reference-source-staging"),
        }),
      }),
      referenceSourceControlledArtifactStore: new ReferenceSourceControlledArtifactStore({
        rootDirectory: path.join(rootDirectory, "reference-source-controlled-artifacts"),
      }),
      ownerReferenceMigrationOwnerRootDirectory: path.join(rootDirectory, "owner"),
      ownerReferenceMigrationPrivateRootDirectory: path.join(rootDirectory, "migration-private"),
      ownerReferenceWorkbenchPrivateRootDirectory: path.join(rootDirectory, "workbench-private"),
      ownerReferenceWorkbenchOpaqueKey: randomBytes(32),
      ...overrides,
    };
    return { rootDirectory, options, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

/**
 * Construct an HTTP server whose direct createApp() call is bound to an
 * isolated Owner runtime. Cleanup follows the server lifecycle, including
 * callers that close it from an afterEach hook.
 */
export function createIsolatedOwnerHttpServer(overrides: CreateAppOptions = {}): Server {
  const runtime = createIsolatedOwnerRuntime(overrides);
  try {
    const server = createServer(createApp(runtime.options));
    server.once("close", runtime.cleanup);
    return server;
  } catch (error) {
    runtime.cleanup();
    throw error;
  }
}
