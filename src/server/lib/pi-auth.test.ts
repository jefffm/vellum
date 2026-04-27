import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveOpenAICodexApiKeyFromPiAuth,
  resolvePiAuthFile,
  type PiAuthOptions,
} from "./pi-auth.js";

type RefreshOpenAICodexToken = NonNullable<PiAuthOptions["refreshOpenAICodexToken"]>;

describe("pi auth helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("locates auth.json with VELLUM_PI_AUTH_FILE, PI_CODING_AGENT_DIR, or the pi default", () => {
    vi.stubEnv("VELLUM_PI_AUTH_FILE", "/tmp/vellum-auth.json");
    expect(resolvePiAuthFile()).toBe("/tmp/vellum-auth.json");

    vi.unstubAllEnvs();
    vi.stubEnv("PI_CODING_AGENT_DIR", "/tmp/pi-agent");
    expect(resolvePiAuthFile()).toBe(join("/tmp/pi-agent", "auth.json"));

    vi.unstubAllEnvs();
    expect(resolvePiAuthFile()).toContain(join(".pi", "agent", "auth.json"));
  });

  it("reads valid openai-codex OAuth credentials from a temp auth file", async () => {
    const authFile = await writeAuth({
      "openai-codex": oauthEntry({ access: "access-token", expires: Date.now() + 120_000 }),
    });

    await expect(resolveOpenAICodexApiKeyFromPiAuth({ authFile })).resolves.toBe("access-token");
  });

  it("accepts older OAuth entries without an explicit type field", async () => {
    const authFile = await writeAuth({
      "openai-codex": {
        access: "legacy-access-token",
        refresh: "legacy-refresh-token",
        expires: Date.now() + 120_000,
      },
    });

    await expect(resolveOpenAICodexApiKeyFromPiAuth({ authFile })).resolves.toBe(
      "legacy-access-token"
    );
  });

  it("refreshes expired openai-codex credentials and preserves other provider entries", async () => {
    const authFile = await writeAuth({
      "openai-codex": oauthEntry({ access: "old-access", refresh: "old-refresh", expires: 500 }),
      anthropic: { type: "apiKey", apiKey: "keep-me" },
    });
    const refreshOpenAICodexToken = vi.fn<RefreshOpenAICodexToken>(async () => ({
      access: "new-access",
      refresh: "new-refresh",
      expires: 2_000_000,
      accountId: "acct-new",
    }));

    await expect(
      resolveOpenAICodexApiKeyFromPiAuth({
        authFile,
        now: () => 1_000,
        refreshOpenAICodexToken,
      })
    ).resolves.toBe("new-access");

    expect(refreshOpenAICodexToken).toHaveBeenCalledWith("old-refresh");
    const persisted = JSON.parse(await readFile(authFile, "utf8")) as Record<string, unknown>;
    expect(persisted.anthropic).toEqual({ type: "apiKey", apiKey: "keep-me" });
    expect(persisted["openai-codex"]).toMatchObject({
      type: "oauth",
      access: "new-access",
      refresh: "new-refresh",
      expires: 2_000_000,
      accountId: "acct-new",
    });
    expect((await stat(authFile)).mode & 0o777).toBe(0o600);
  });

  it("does not refresh when the token expires more than 60 seconds in the future", async () => {
    const authFile = await writeAuth({
      "openai-codex": oauthEntry({ access: "current-access", expires: 61_001 }),
    });
    const refreshOpenAICodexToken = vi.fn<RefreshOpenAICodexToken>();

    await expect(
      resolveOpenAICodexApiKeyFromPiAuth({
        authFile,
        now: () => 1_000,
        refreshOpenAICodexToken,
      })
    ).resolves.toBe("current-access");

    expect(refreshOpenAICodexToken).not.toHaveBeenCalled();
  });

  it("returns undefined for missing or unusable pi auth files", async () => {
    const missingAuthFile = join(await mkdtemp(join(tmpdir(), "vellum-pi-auth-")), "missing.json");
    const missingProviderAuthFile = await writeAuth({ anthropic: oauthEntry() });
    const malformedJsonAuthFile = await writeRawAuth("not json");
    const malformedEntryAuthFile = await writeAuth({
      "openai-codex": {
        type: "oauth",
        access: "token",
        refresh: 123,
        expires: Date.now() + 120_000,
      },
    });

    await expect(resolveOpenAICodexApiKeyFromPiAuth({ authFile: missingAuthFile })).resolves.toBe(
      undefined
    );
    await expect(
      resolveOpenAICodexApiKeyFromPiAuth({ authFile: missingProviderAuthFile })
    ).resolves.toBe(undefined);
    await expect(
      resolveOpenAICodexApiKeyFromPiAuth({ authFile: malformedJsonAuthFile })
    ).resolves.toBe(undefined);
    await expect(
      resolveOpenAICodexApiKeyFromPiAuth({ authFile: malformedEntryAuthFile })
    ).resolves.toBe(undefined);
  });
});

async function writeAuth(auth: Record<string, unknown>): Promise<string> {
  return writeRawAuth(JSON.stringify(auth, null, 2));
}

async function writeRawAuth(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "vellum-pi-auth-"));
  const authFile = join(directory, "auth.json");
  await writeFile(authFile, contents, { mode: 0o600 });
  return authFile;
}

function oauthEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "oauth",
    access: "access-token",
    refresh: "refresh-token",
    expires: Date.now() + 120_000,
    accountId: "acct-old",
    ...overrides,
  };
}
