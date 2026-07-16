import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";

const KEYCHAIN_TIMEOUT_MS = 10_000;
assertAuthorityPathRuntime("authority.governance.provider-credential-boundary", "production");
const MACOS_SECURITY_EXECUTABLE = "/usr/bin/security";

function macOsSecurityEnvironment(): NodeJS.ProcessEnv {
  assertAuthorityPathRuntime("authority.governance.provider-credential-boundary", "production");
  return {
    LANG: "C",
    LC_ALL: "C",
    PATH: "/usr/bin:/bin",
  };
}

export interface ProviderCredentialStore {
  readonly kind: "macos-keychain" | "restricted-file";
  read(): Promise<string | undefined>;
  write(value: string): Promise<void>;
  delete(): Promise<void>;
}

export class RestrictedFileCredentialStore implements ProviderCredentialStore {
  readonly kind = "restricted-file" as const;

  constructor(private readonly filePath: string) {}

  async read(): Promise<string | undefined> {
    assertAuthorityPathRuntime("authority.governance.provider-credential-boundary", "production");
    try {
      return await readFile(this.filePath, "utf8");
    } catch {
      return undefined;
    }
  }

  async write(value: string): Promise<void> {
    assertAuthorityPathRuntime("authority.governance.provider-credential-boundary", "production");
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, value, { mode: 0o600 });
      await rename(temporary, this.filePath);
      await chmod(this.filePath, 0o600);
    } catch {
      await rm(temporary, { force: true });
      throw new Error("Could not write the permission-restricted provider credential file");
    }
  }

  async delete(): Promise<void> {
    assertAuthorityPathRuntime("authority.governance.provider-credential-boundary", "production");
    await rm(this.filePath, { force: true });
  }
}

export class MacOsKeychainCredentialStore implements ProviderCredentialStore {
  readonly kind = "macos-keychain" as const;
  private readonly execute = promisify(execFile);

  constructor(
    private readonly service = "org.vellum.provider.openai-codex",
    private readonly account = "owner"
  ) {}

  async read(): Promise<string | undefined> {
    assertAuthorityPathRuntime("authority.governance.provider-credential-boundary", "production");
    try {
      const { stdout } = await this.execute(
        MACOS_SECURITY_EXECUTABLE,
        ["find-generic-password", "-a", this.account, "-s", this.service, "-w"],
        {
          env: macOsSecurityEnvironment(),
          timeout: KEYCHAIN_TIMEOUT_MS,
        }
      );
      const stored = stdout.trim();
      return stored ? decodeKeychainSecret(stored) : undefined;
    } catch {
      return undefined;
    }
  }

  async write(value: string): Promise<void> {
    assertAuthorityPathRuntime("authority.governance.provider-credential-boundary", "production");
    try {
      await securityWithSecretInput(this.account, this.service, value);
    } catch {
      throw new Error("Could not write provider credentials to the macOS Keychain");
    }
  }

  async delete(): Promise<void> {
    assertAuthorityPathRuntime("authority.governance.provider-credential-boundary", "production");
    try {
      await this.execute(
        MACOS_SECURITY_EXECUTABLE,
        ["delete-generic-password", "-a", this.account, "-s", this.service],
        {
          env: macOsSecurityEnvironment(),
          timeout: KEYCHAIN_TIMEOUT_MS,
        }
      );
    } catch {
      // Deleting an absent Keychain item is idempotent.
    }
  }
}

async function securityWithSecretInput(
  account: string,
  service: string,
  secret: string
): Promise<void> {
  assertAuthorityPathRuntime("authority.governance.provider-credential-boundary", "production");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(MACOS_SECURITY_EXECUTABLE, ["-i"], {
      env: macOsSecurityEnvironment(),
      stdio: ["pipe", "ignore", "ignore"],
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("macOS Keychain command timed out"));
    }, KEYCHAIN_TIMEOUT_MS);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      code === 0 ? resolve() : reject(new Error("macOS Keychain command failed"));
    });
    child.stdin.end(
      `add-generic-password -U -a ${securityToken(account)} -s ${securityToken(service)} -w ${encodeKeychainSecret(secret)}\n`
    );
  });
}

export function encodeKeychainSecret(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

export function decodeKeychainSecret(value: string): string {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return encodeKeychainSecret(decoded).replace(/=+$/, "") === value.replace(/=+$/, "")
      ? decoded
      : value;
  } catch {
    return value;
  }
}

function securityToken(value: string): string {
  if (!/^[A-Za-z0-9._@-]+$/.test(value)) {
    throw new Error("Keychain account and service must use safe identifier characters");
  }
  return value;
}
