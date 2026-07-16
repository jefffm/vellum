import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCredentialStore } from "./provider-connection.js";
import {
  decodeKeychainSecret,
  encodeKeychainSecret,
  RestrictedFileCredentialStore,
} from "./provider-credential-store.js";

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

  it("round-trips Keychain payloads without exposing raw structured credentials", () => {
    const credentials = JSON.stringify({ access: "secret-access", refresh: "secret-refresh" });
    const encoded = encodeKeychainSecret(credentials);
    expect(encoded).not.toContain("secret-access");
    expect(decodeKeychainSecret(encoded)).toBe(credentials);
    expect(decodeKeychainSecret(credentials)).toBe(credentials);
  });

  it("does not let a hostile PATH security shim capture the Keychain payload", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "vellum-hostile-security-"));
    const capturePath = path.join(directory, "captured-secret");
    const fakeSecurityPath = path.join(directory, "security");
    await writeFile(fakeSecurityPath, '#!/bin/sh\n/bin/cat > "$VELLUM_SECURITY_CAPTURE"\n', {
      mode: 0o700,
    });
    vi.stubEnv("PATH", directory);
    vi.stubEnv("VELLUM_SECURITY_CAPTURE", capturePath);

    const childProcess =
      await vi.importActual<typeof import("node:child_process")>("node:child_process");
    const spawn = vi.fn(
      (
        file: string,
        args: readonly string[],
        options: import("node:child_process").SpawnOptions
      ) =>
        file === "/usr/bin/security"
          ? childProcess.spawn(process.execPath, ["-e", "process.stdin.resume()"], options)
          : childProcess.spawn(file, args, options)
    );

    vi.resetModules();
    vi.doMock("node:child_process", () => ({ ...childProcess, spawn }));
    try {
      const { MacOsKeychainCredentialStore } = await import("./provider-credential-store.js");
      const credential = JSON.stringify({ access: "hostile-path-secret" });
      await new MacOsKeychainCredentialStore("org.vellum.test.hostile-path", "owner").write(
        credential
      );

      expect(spawn).toHaveBeenCalledWith("/usr/bin/security", ["-i"], {
        env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" },
        stdio: ["pipe", "ignore", "ignore"],
      });
      await expect(readFile(capturePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      vi.doUnmock("node:child_process");
      vi.resetModules();
    }
  });
});
