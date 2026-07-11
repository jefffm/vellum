import express from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createModelActionCancelRoute,
  createModelActionCreateRoute,
  createModelActionGetRoute,
  createModelActionInterruptRoute,
  createModelActionListRoute,
  createModelActionProgressRoute,
  createModelActionRetryRoute,
} from "./model-action-route.js";
import { ModelActionService } from "./model-action-service.js";
import { WorkspaceStore } from "./workspace-store.js";

describe("Model Action routes", () => {
  let rootDirectory: string;
  let server: Server;
  let workspaceId: string;

  beforeEach(async () => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-model-action-route-"));
    const store = new WorkspaceStore({ rootDirectory });
    vi.spyOn(store, "resolveCurrentInputVersions").mockImplementation((_workspaceId, values) =>
      values.map((value) => ({ ...value }))
    );
    workspaceId = store.create({ title: "Provider fixture" }).id;
    const service = new ModelActionService({ store });
    const options = { store, service };
    const app = express();
    app.use(express.json());
    app.get("/api/workspaces/:workspaceId/model-actions", createModelActionListRoute(options));
    app.post("/api/workspaces/:workspaceId/model-actions", createModelActionCreateRoute(options));
    app.get(
      "/api/workspaces/:workspaceId/model-actions/:modelActionId",
      createModelActionGetRoute(options)
    );
    app.patch(
      "/api/workspaces/:workspaceId/model-actions/:modelActionId",
      createModelActionProgressRoute(options)
    );
    app.post(
      "/api/workspaces/:workspaceId/model-actions/:modelActionId/interrupt",
      createModelActionInterruptRoute(options)
    );
    app.post(
      "/api/workspaces/:workspaceId/model-actions/:modelActionId/retry",
      createModelActionRetryRoute(options)
    );
    app.post(
      "/api/workspaces/:workspaceId/model-actions/:modelActionId/cancel",
      createModelActionCancelRoute(options)
    );
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("exposes durable interruption, retry, inspection, and cancellation", async () => {
    const created = await request("", "POST", {
      kind: "analysis",
      intent: "Analyze the source",
      inputVersions: [{ recordType: "score", recordId: "score.1111111111111111", version: 1 }],
      lastConfirmedBoundary: "Score v1",
      idempotencyKey: "provider-fixture-action",
    });
    expect(created.status).toBe(200);
    const actionId = created.body.data.id as string;

    await request(`/${actionId}`, "PATCH", {
      partialProgressSummary: "One passage analyzed",
      diagnosticPartialOutput: "access=secret-token",
    });
    const interrupted = await request(`/${actionId}/interrupt`, "POST", {
      reason: "authorization=secret-token expired",
    });
    expect(interrupted.body.data.status).toBe("interrupted");
    expect(JSON.stringify(interrupted.body)).not.toContain("secret-token");

    const retried = await request(`/${actionId}/retry`, "POST", {
      mode: "current_version",
    });
    expect(retried.body.data.attempts).toHaveLength(2);
    expect(retried.body.data.attempts[1].mode).toBe("current_version");

    const cancelled = await request(`/${actionId}/cancel`, "POST", {});
    expect(cancelled.body.data.status).toBe("cancelled");
    const fetched = await request(`/${actionId}`, "GET");
    expect(fetched.body.data.status).toBe("cancelled");
    const listed = await request("", "GET");
    expect(listed.body.data).toHaveLength(1);
  });

  async function request(suffix: string, method: string, body?: object) {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/workspaces/${workspaceId}/model-actions${suffix}`,
      {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      }
    );
    return { status: response.status, body: (await response.json()) as any };
  }
});
