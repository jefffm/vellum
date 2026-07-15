import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveApiKeyFromEnvironment } from "./provider-runtime.js";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("server-owned provider credential resolution", () => {
  it("resolves the fixed provider credential without accepting a browser-supplied destination", () => {
    process.env.OPENAI_API_KEY = "server-openai-key";
    expect(resolveApiKeyFromEnvironment("openai-codex")).toBe("server-openai-key");
    expect(resolveApiKeyFromEnvironment("attacker-provider")).toBeUndefined();
  });

  it("supports a restricted credential file configured by the server process", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "vellum-provider-runtime-"));
    const credentialPath = path.join(directory, "credential");
    writeFileSync(credentialPath, "server-file-key\n", { mode: 0o600 });
    process.env.VELLUM_LLM_API_KEY_FILE = credentialPath;
    expect(resolveApiKeyFromEnvironment("openai-codex")).toBe("server-file-key");
  });
});
