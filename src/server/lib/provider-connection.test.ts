import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OAuthCredentials, OAuthProviderInterface } from "@mariozechner/pi-ai/oauth";
import { ProviderConnection } from "./provider-connection.js";

describe("ProviderConnection", () => {
  it("owns login credentials, exposes no token in status, refreshes, and logs out", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "vellum-provider-"));
    const authFile = path.join(directory, "provider-auth.json");
    let finishLogin!: (credentials: OAuthCredentials) => void;
    const provider: OAuthProviderInterface = {
      id: "openai-codex",
      name: "Fake ChatGPT",
      login: (callbacks) => {
        callbacks.onAuth({ url: "https://auth.example.test/start", instructions: "Sign in" });
        return new Promise((resolve) => {
          finishLogin = resolve;
        });
      },
      refreshToken: async () => ({ access: "refreshed", refresh: "next", expires: 20_000 }),
      getApiKey: (credentials) => credentials.access,
    };
    const connection = new ProviderConnection({ authFile, provider, now: () => 10_000 });

    await expect(connection.beginLogin()).resolves.toMatchObject({
      state: "connecting",
      authUrl: "https://auth.example.test/start",
    });
    expect(JSON.stringify(await connection.status())).not.toContain("access");
    finishLogin({ access: "secret-access", refresh: "secret-refresh", expires: 10_001 });
    await expect.poll(async () => (await connection.status()).state).toBe("connected");
    expect((await stat(authFile)).mode & 0o777).toBe(0o600);
    expect(await connection.resolveApiKey()).toBe("refreshed");
    expect(await readFile(authFile, "utf8")).toContain("refreshed");

    await connection.disconnect();
    await expect(connection.status()).resolves.toMatchObject({ state: "disconnected" });
    await expect(connection.resolveApiKey()).resolves.toBeUndefined();
  });

  it("supports a manual callback prompt without exposing credentials", async () => {
    const authFile = path.join(await mkdtemp(path.join(tmpdir(), "vellum-provider-")), "auth.json");
    const provider: OAuthProviderInterface = {
      id: "openai-codex",
      name: "Fake ChatGPT",
      login: async (callbacks) => {
        callbacks.onAuth({ url: "https://auth.example.test" });
        const code = await callbacks.onPrompt({ message: "Paste callback" });
        return { access: `access-${code}`, refresh: "refresh", expires: 50_000 };
      },
      refreshToken: async (credentials) => credentials,
      getApiKey: (credentials) => credentials.access,
    };
    const connection = new ProviderConnection({ authFile, provider, now: () => 1 });
    await connection.beginLogin();
    await expect
      .poll(async () => (await connection.status()).prompt?.message)
      .toBe("Paste callback");
    connection.submitPrompt("code");
    await expect.poll(async () => (await connection.status()).state).toBe("connected");
    expect(await connection.resolveApiKey()).toBe("access-code");
  });
});
