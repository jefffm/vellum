import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

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
    try {
      return await readFile(this.filePath, "utf8");
    } catch {
      return undefined;
    }
  }

  async write(value: string): Promise<void> {
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
    try {
      const { stdout } = await this.execute("security", [
        "find-generic-password",
        "-a",
        this.account,
        "-s",
        this.service,
        "-w",
      ]);
      return stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  async write(value: string): Promise<void> {
    try {
      await securityWithSecretInput(
        ["add-generic-password", "-U", "-a", this.account, "-s", this.service, "-w"],
        value
      );
    } catch {
      throw new Error("Could not write provider credentials to the macOS Keychain");
    }
  }

  async delete(): Promise<void> {
    try {
      await this.execute("security", [
        "delete-generic-password",
        "-a",
        this.account,
        "-s",
        this.service,
      ]);
    } catch {
      // Deleting an absent Keychain item is idempotent.
    }
  }
}

async function securityWithSecretInput(args: string[], secret: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("security", args, { stdio: ["pipe", "ignore", "ignore"] });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error("macOS Keychain command failed"))
    );
    child.stdin.end(`${secret}\n`);
  });
}
