import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type {
  OAuthCredentials,
  OAuthPrompt,
  OAuthProviderInterface,
} from "@mariozechner/pi-ai/oauth";

const PROVIDER_ID = "openai-codex";
const REFRESH_WINDOW_MS = 60_000;

export type ProviderConnectionStatus = {
  provider: typeof PROVIDER_ID;
  state: "disconnected" | "connecting" | "connected" | "refreshing" | "expired";
  authUrl?: string;
  instructions?: string;
  progress?: string;
  prompt?: OAuthPrompt;
  expiresAt?: number;
  error?: string;
};

type StoredConnection = {
  provider: typeof PROVIDER_ID;
  credentials: OAuthCredentials;
};

type ProviderConnectionOptions = {
  authFile?: string;
  provider?: OAuthProviderInterface;
  now?: () => number;
};

export class ProviderConnection {
  private readonly authFile: string;
  private readonly now: () => number;
  private readonly injectedProvider?: OAuthProviderInterface;
  private statusValue: ProviderConnectionStatus = {
    provider: PROVIDER_ID,
    state: "disconnected",
  };
  private loginPromise?: Promise<void>;
  private promptResolver?: (value: string) => void;
  private loginAttempt = 0;

  constructor(options: ProviderConnectionOptions = {}) {
    this.authFile = options.authFile ?? providerAuthFile();
    this.injectedProvider = options.provider;
    this.now = options.now ?? Date.now;
  }

  async status(): Promise<ProviderConnectionStatus> {
    if (this.statusValue.state === "connecting" || this.statusValue.state === "refreshing") {
      return { ...this.statusValue };
    }
    const stored = await this.read();
    if (!stored) return { provider: PROVIDER_ID, state: "disconnected" };
    return {
      provider: PROVIDER_ID,
      state: stored.credentials.expires > this.now() ? "connected" : "expired",
      expiresAt: stored.credentials.expires,
    };
  }

  async beginLogin(): Promise<ProviderConnectionStatus> {
    if (!this.loginPromise) {
      this.statusValue = { provider: PROVIDER_ID, state: "connecting", progress: "Starting…" };
      const attempt = ++this.loginAttempt;
      this.loginPromise = this.runLogin(attempt).finally(() => {
        this.loginPromise = undefined;
        this.promptResolver = undefined;
      });
    }
    await waitFor(
      () =>
        Boolean(
          this.statusValue.authUrl ||
          this.statusValue.error ||
          this.statusValue.state === "connected"
        ),
      5_000
    );
    return { ...this.statusValue };
  }

  submitPrompt(value: string): void {
    if (!this.promptResolver) throw new Error("Provider login is not waiting for input");
    const resolve = this.promptResolver;
    this.promptResolver = undefined;
    this.statusValue = { ...this.statusValue, prompt: undefined, progress: "Completing login…" };
    resolve(value);
  }

  async disconnect(): Promise<void> {
    this.loginAttempt += 1;
    await rm(this.authFile, { force: true });
    this.statusValue = { provider: PROVIDER_ID, state: "disconnected" };
  }

  async resolveApiKey(): Promise<string | undefined> {
    const stored = await this.read();
    if (!stored) return undefined;
    let credentials = stored.credentials;
    if (credentials.expires <= this.now() + REFRESH_WINDOW_MS) {
      this.statusValue = { provider: PROVIDER_ID, state: "refreshing" };
      try {
        credentials = await (await this.provider()).refreshToken(credentials);
        await this.write(credentials);
      } catch (error) {
        this.statusValue = {
          provider: PROVIDER_ID,
          state: "expired",
          expiresAt: credentials.expires,
          error: safeError(error),
        };
        return undefined;
      }
    }
    this.statusValue = {
      provider: PROVIDER_ID,
      state: "connected",
      expiresAt: credentials.expires,
    };
    return (await this.provider()).getApiKey(credentials);
  }

  private async runLogin(attempt: number): Promise<void> {
    try {
      const credentials = await (
        await this.provider()
      ).login({
        onAuth: ({ url, instructions }) => {
          this.statusValue = {
            provider: PROVIDER_ID,
            state: "connecting",
            authUrl: url,
            instructions,
          };
        },
        onProgress: (progress) => {
          this.statusValue = { ...this.statusValue, progress };
        },
        onPrompt: (prompt) =>
          new Promise<string>((resolve) => {
            this.promptResolver = resolve;
            this.statusValue = { ...this.statusValue, prompt };
          }),
        onManualCodeInput: () =>
          new Promise<string>((resolve) => {
            this.promptResolver = resolve;
            this.statusValue = {
              ...this.statusValue,
              prompt: { message: "Paste the final redirect URL" },
            };
          }),
      });
      if (attempt !== this.loginAttempt) return;
      await this.write(credentials);
      this.statusValue = {
        provider: PROVIDER_ID,
        state: "connected",
        expiresAt: credentials.expires,
      };
    } catch (error) {
      this.statusValue = {
        provider: PROVIDER_ID,
        state: "disconnected",
        error: safeError(error),
      };
    }
  }

  private async provider(): Promise<OAuthProviderInterface> {
    if (this.injectedProvider) return this.injectedProvider;
    const { openaiCodexOAuthProvider } = await import("@mariozechner/pi-ai/oauth");
    return openaiCodexOAuthProvider;
  }

  private async read(): Promise<StoredConnection | undefined> {
    try {
      const parsed = JSON.parse(await readFile(this.authFile, "utf8")) as StoredConnection;
      if (
        parsed.provider !== PROVIDER_ID ||
        typeof parsed.credentials?.access !== "string" ||
        typeof parsed.credentials?.refresh !== "string" ||
        typeof parsed.credentials?.expires !== "number"
      ) {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }

  private async write(credentials: OAuthCredentials): Promise<void> {
    await mkdir(path.dirname(this.authFile), { recursive: true, mode: 0o700 });
    const temporary = `${this.authFile}.${process.pid}.tmp`;
    await writeFile(
      temporary,
      `${JSON.stringify({ provider: PROVIDER_ID, credentials }, null, 2)}\n`,
      { mode: 0o600 }
    );
    await rename(temporary, this.authFile);
    await chmod(this.authFile, 0o600);
  }
}

export function providerAuthFile(): string {
  return (
    process.env.VELLUM_PROVIDER_AUTH_FILE ?? path.join(homedir(), ".vellum", "provider-auth.json")
  );
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
      .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
      .replace(/(access|refresh|token|authorization|api[-_ ]?key)\s*[:=]\s*\S+/gi, "$1=[redacted]")
      .slice(0, 500);
  }
  return "Provider connection failed";
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
