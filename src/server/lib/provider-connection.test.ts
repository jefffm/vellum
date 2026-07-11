import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OAuthCredentials, OAuthProviderInterface } from "@mariozechner/pi-ai/oauth";
import { ProviderConnection, safeError } from "./provider-connection.js";

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
    expect(await readdir(directory)).toEqual(["provider-auth.json"]);

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

  it("validates state before forwarding a manual callback and permits a corrected retry", async () => {
    const authFile = path.join(await mkdtemp(path.join(tmpdir(), "vellum-provider-")), "auth.json");
    let received = "";
    const provider: OAuthProviderInterface = {
      id: "openai-codex",
      name: "Fake ChatGPT",
      login: async (callbacks) => {
        callbacks.onAuth({ url: "https://auth.example.test?state=expected-state" });
        received = await callbacks.onManualCodeInput!();
        return { access: "access", refresh: "refresh", expires: 50_000 };
      },
      refreshToken: async (credentials) => credentials,
      getApiKey: (credentials) => credentials.access,
    };
    const connection = new ProviderConnection({ authFile, provider, now: () => 1 });
    await connection.beginLogin();

    expect(() =>
      connection.submitPrompt("http://localhost:1455/auth/callback?code=secret&state=attacker")
    ).toThrow(/state mismatch/);
    expect(received).toBe("");
    connection.submitPrompt("http://localhost:1455/auth/callback?code=secret&state=expected-state");
    await expect.poll(async () => (await connection.status()).state).toBe("connected");
    expect(received).toContain("expected-state");
  });

  it("refreshes once under concurrency", async () => {
    const authFile = path.join(await mkdtemp(path.join(tmpdir(), "vellum-provider-")), "auth.json");
    let finishLogin!: (credentials: OAuthCredentials) => void;
    let refreshes = 0;
    let finishRefresh!: (credentials: OAuthCredentials) => void;
    const provider: OAuthProviderInterface = {
      id: "openai-codex",
      name: "Fake ChatGPT",
      login: () => new Promise((resolve) => (finishLogin = resolve)),
      refreshToken: () => {
        refreshes += 1;
        return new Promise((resolve) => (finishRefresh = resolve));
      },
      getApiKey: (credentials) => credentials.access,
    };
    const connection = new ProviderConnection({ authFile, provider, now: () => 10_000 });
    void connection.beginLogin();
    await expect.poll(() => typeof finishLogin).toBe("function");
    finishLogin({ access: "old", refresh: "old-refresh", expires: 10_001 });
    await expect.poll(async () => (await connection.status()).state).toBe("connected");

    const first = connection.resolveApiKey();
    const second = connection.resolveApiKey();
    await expect.poll(() => refreshes).toBe(1);
    finishRefresh({ access: "new-access", refresh: "new-refresh", expires: 100_000 });
    await expect(Promise.all([first, second])).resolves.toEqual(["new-access", "new-access"]);
    expect(refreshes).toBe(1);
  });

  it("does not resurrect credentials when logout races an in-flight refresh", async () => {
    const authFile = path.join(await mkdtemp(path.join(tmpdir(), "vellum-provider-")), "auth.json");
    let finishLogin!: (credentials: OAuthCredentials) => void;
    let finishRefresh!: (credentials: OAuthCredentials) => void;
    const provider: OAuthProviderInterface = {
      id: "openai-codex",
      name: "Fake ChatGPT",
      login: () => new Promise((resolve) => (finishLogin = resolve)),
      refreshToken: () => new Promise((resolve) => (finishRefresh = resolve)),
      getApiKey: (credentials) => credentials.access,
    };
    const connection = new ProviderConnection({ authFile, provider, now: () => 10_000 });
    void connection.beginLogin();
    await expect.poll(() => typeof finishLogin).toBe("function");
    finishLogin({ access: "old", refresh: "old-refresh", expires: 10_001 });
    await expect.poll(async () => (await connection.status()).state).toBe("connected");
    const refresh = connection.resolveApiKey();
    await expect.poll(async () => (await connection.status()).state).toBe("refreshing");
    await connection.disconnect();
    finishRefresh({ access: "resurrected", refresh: "bad", expires: 100_000 });

    await expect(refresh).resolves.toBeUndefined();
    await expect(connection.status()).resolves.toMatchObject({ state: "disconnected" });
    await expect(readFile(authFile, "utf8")).rejects.toThrow();
  });

  it("redacts known and structured secret forms from provider failures", () => {
    const message = safeError(
      new Error(
        "Bearer bearer-secret api_key=sk-1234567890 https://x.test?code=oauth-code&state=csrf-state raw-secret"
      ),
      ["raw-secret"]
    );
    expect(message).not.toMatch(/bearer-secret|sk-1234567890|oauth-code|csrf-state|raw-secret/);
  });

  it("reports expiry without leaking failed refresh credentials and reconnects only explicitly", async () => {
    const authFile = path.join(await mkdtemp(path.join(tmpdir(), "vellum-provider-")), "auth.json");
    let logins = 0;
    const provider: OAuthProviderInterface = {
      id: "openai-codex",
      name: "Fake ChatGPT",
      login: async (callbacks) => {
        logins += 1;
        callbacks.onAuth({ url: `https://auth.example.test?state=state-${logins}` });
        return { access: "owned-access", refresh: "owned-refresh", expires: 10_001 };
      },
      refreshToken: async () => {
        throw new Error("refresh=owned-refresh Bearer owned-access");
      },
      getApiKey: (credentials) => credentials.access,
    };
    const connection = new ProviderConnection({ authFile, provider, now: () => 10_000 });
    await connection.beginLogin();
    await expect.poll(async () => (await connection.status()).state).toBe("connected");
    await expect(connection.resolveApiKey()).resolves.toBeUndefined();
    const expired = await connection.status();
    expect(expired).toMatchObject({ state: "expired" });
    expect(JSON.stringify(expired)).not.toMatch(/owned-access|owned-refresh/);
    expect(logins).toBe(1);

    await connection.reconnect();
    await expect.poll(async () => (await connection.status()).state).toBe("connected");
    expect(logins).toBe(2);
  });
});
