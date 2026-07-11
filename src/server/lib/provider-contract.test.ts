import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { OAuthProviderInterface } from "@mariozechner/pi-ai/oauth";
import { ModelActionService } from "./model-action-service.js";
import { ProviderConnection } from "./provider-connection.js";
import { WorkspaceStore } from "./workspace-store.js";

describe("Provider Contract Fixture", () => {
  it("never auto-resumes an interrupted action across logout and reconnect", async () => {
    const store = new WorkspaceStore({
      rootDirectory: await mkdtemp(path.join(tmpdir(), "vellum-provider-contract-")),
    });
    const workspaceId = store.create({ title: "Provider contract" }).id;
    vi.spyOn(store, "resolveCurrentInputVersions").mockImplementation((_workspaceId, values) =>
      values.map((value) => ({ ...value }))
    );
    const actions = new ModelActionService({ store });
    const action = actions.create(workspaceId, {
      kind: "arrangement_generation",
      intent: "Preserve the lead voice",
      inputVersions: [
        { recordType: "normalized_score", recordId: "score.1111111111111111", version: 1 },
      ],
      lastConfirmedBoundary: "Normalized Score v1",
    });
    actions.progress(workspaceId, action.id, {
      completedLocalToolResults: [{ toolName: "theory", resultReference: "result.local.1" }],
      partialProgressSummary: "Analysis completed; no arrangement committed",
    });
    actions.interrupt(workspaceId, action.id, "Provider authorization expired");

    let loginCount = 0;
    const provider: OAuthProviderInterface = {
      id: "openai-codex",
      name: "Fake ChatGPT",
      login: async (callbacks) => {
        loginCount += 1;
        callbacks.onAuth({ url: `https://auth.example.test?state=${loginCount}` });
        return {
          access: `access-${loginCount}`,
          refresh: `refresh-${loginCount}`,
          expires: 90_000,
        };
      },
      refreshToken: async (credentials) => credentials,
      getApiKey: (credentials) => credentials.access,
    };
    const connection = new ProviderConnection({
      authFile: path.join(
        await mkdtemp(path.join(tmpdir(), "vellum-provider-contract-auth-")),
        "auth.json"
      ),
      provider,
      now: () => 1,
    });
    await connection.beginLogin();
    await expect.poll(async () => (await connection.status()).state).toBe("connected");
    expect(store.getModelAction(workspaceId, action.id).status).toBe("interrupted");

    await connection.disconnect();
    await connection.reconnect();
    await expect.poll(async () => (await connection.status()).state).toBe("connected");
    expect(store.getModelAction(workspaceId, action.id).status).toBe("interrupted");
    expect(store.getModelAction(workspaceId, action.id).attempts).toHaveLength(1);

    const retried = actions.retry(workspaceId, action.id);
    expect(retried.status).toBe("running");
    expect(retried.attempts).toHaveLength(2);
    expect(actions.cancel(workspaceId, action.id).status).toBe("cancelled");
  });
});
