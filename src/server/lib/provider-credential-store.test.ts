import { mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCredentialStore } from "./provider-connection.js";
import { RestrictedFileCredentialStore } from "./provider-credential-store.js";

describe("provider credential stores", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("atomically writes a permission-restricted fallback without residual temporary files", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "vellum-credential-store-"));
    const filePath = path.join(directory, "provider.json");
    const store = new RestrictedFileCredentialStore(filePath);
    await store.write("first-secret");
    await store.write("second-secret");

    expect(await store.read()).toBe("second-secret");
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    expect(await readdir(directory)).toEqual(["provider.json"]);
    expect(await readFile(filePath, "utf8")).not.toContain("first-secret");
    await store.delete();
    await expect(store.read()).resolves.toBeUndefined();
  });

  it("allows an explicit restricted-file fallback", () => {
    vi.stubEnv("VELLUM_PROVIDER_CREDENTIAL_STORE", "file");
    expect(defaultCredentialStore().kind).toBe("restricted-file");
  });
});
