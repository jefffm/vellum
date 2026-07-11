import { homedir } from "node:os";
import path from "node:path";
import type {
  OAuthCredentials,
  OAuthPrompt,
  OAuthProviderInterface,
} from "@mariozechner/pi-ai/oauth";
import { redactSecretText } from "./secret-redaction.js";
import {
  MacOsKeychainCredentialStore,
  type ProviderCredentialStore,
  RestrictedFileCredentialStore,
} from "./provider-credential-store.js";

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
  credentialStore?: ProviderCredentialStore;
};

export class ProviderConnection {
  private readonly credentialStore: ProviderCredentialStore;
  private readonly now: () => number;
  private readonly injectedProvider?: OAuthProviderInterface;
  private statusValue: ProviderConnectionStatus = {
    provider: PROVIDER_ID,
    state: "disconnected",
  };
  private loginPromise?: Promise<void>;
  private promptResolver?: (value: string) => void;
  private loginAttempt = 0;
  private connectionGeneration = 0;
  private refreshPromise?: Promise<OAuthCredentials | undefined>;
  private expectedOAuthState?: string;
  private requiresStatefulCallback = false;

  constructor(options: ProviderConnectionOptions = {}) {
    this.credentialStore =
      options.credentialStore ??
      (options.authFile
        ? new RestrictedFileCredentialStore(options.authFile)
        : defaultCredentialStore());
    this.injectedProvider = options.provider;
    this.now = options.now ?? Date.now;
  }

  async status(): Promise<ProviderConnectionStatus> {
    if (
      this.statusValue.state === "connecting" ||
      this.statusValue.state === "refreshing" ||
      this.statusValue.error
    ) {
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
      const login = this.runLogin(attempt);
      this.loginPromise = login;
      void login.finally(() => {
        if (this.loginPromise === login) {
          this.loginPromise = undefined;
          this.promptResolver = undefined;
        }
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
    if (this.requiresStatefulCallback) {
      validateCallbackState(value, this.expectedOAuthState);
    }
    const resolve = this.promptResolver;
    this.promptResolver = undefined;
    this.statusValue = { ...this.statusValue, prompt: undefined, progress: "Completing login…" };
    resolve(value);
  }

  async disconnect(): Promise<void> {
    this.loginAttempt += 1;
    this.connectionGeneration += 1;
    this.promptResolver?.("cancelled#cancelled");
    this.promptResolver = undefined;
    this.loginPromise = undefined;
    this.expectedOAuthState = undefined;
    this.requiresStatefulCallback = false;
    await this.credentialStore.delete();
    this.statusValue = { provider: PROVIDER_ID, state: "disconnected" };
  }

  async reconnect(): Promise<ProviderConnectionStatus> {
    await this.disconnect();
    return await this.beginLogin();
  }

  async resolveApiKey(): Promise<string | undefined> {
    const stored = await this.read();
    if (!stored) return undefined;
    let credentials = stored.credentials;
    if (credentials.expires <= this.now() + REFRESH_WINDOW_MS) {
      credentials = (await this.refreshSingleFlight(credentials)) ?? credentials;
      if (this.statusValue.state === "expired" || this.statusValue.state === "disconnected") {
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
          this.expectedOAuthState = oauthState(url);
          this.statusValue = {
            provider: PROVIDER_ID,
            state: "connecting",
            authUrl: url,
            instructions: instructions ? redactSecretText(instructions) : undefined,
          };
        },
        onProgress: (progress) => {
          this.statusValue = { ...this.statusValue, progress: redactSecretText(progress) };
        },
        onPrompt: (prompt) =>
          new Promise<string>((resolve) => {
            this.requiresStatefulCallback = false;
            this.promptResolver = resolve;
            this.statusValue = {
              ...this.statusValue,
              prompt: { ...prompt, message: redactSecretText(prompt.message) },
            };
          }),
        onManualCodeInput: () =>
          new Promise<string>((resolve) => {
            this.requiresStatefulCallback = true;
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
      const stored = await this.credentialStore.read();
      if (!stored) return undefined;
      const parsed = JSON.parse(stored) as StoredConnection;
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
    await this.credentialStore.write(JSON.stringify({ provider: PROVIDER_ID, credentials }));
  }

  private async refreshSingleFlight(
    credentials: OAuthCredentials
  ): Promise<OAuthCredentials | undefined> {
    if (!this.refreshPromise) {
      const generation = this.connectionGeneration;
      this.statusValue = { provider: PROVIDER_ID, state: "refreshing" };
      this.refreshPromise = (async () => {
        try {
          const refreshed = await (await this.provider()).refreshToken(credentials);
          if (generation !== this.connectionGeneration) return undefined;
          await this.write(refreshed);
          this.statusValue = {
            provider: PROVIDER_ID,
            state: "connected",
            expiresAt: refreshed.expires,
          };
          return refreshed;
        } catch (error) {
          if (generation === this.connectionGeneration) {
            this.statusValue = {
              provider: PROVIDER_ID,
              state: "expired",
              expiresAt: credentials.expires,
              error: safeError(error, [credentials.access, credentials.refresh]),
            };
          }
          return undefined;
        } finally {
          this.refreshPromise = undefined;
        }
      })();
    }
    return await this.refreshPromise;
  }
}

export function providerAuthFile(): string {
  return (
    process.env.VELLUM_PROVIDER_AUTH_FILE ?? path.join(homedir(), ".vellum", "provider-auth.json")
  );
}

export function defaultCredentialStore(): ProviderCredentialStore {
  if (process.platform === "darwin" && process.env.VELLUM_PROVIDER_CREDENTIAL_STORE !== "file") {
    return new MacOsKeychainCredentialStore();
  }
  return new RestrictedFileCredentialStore(providerAuthFile());
}

export function safeError(error: unknown, knownSecrets: string[] = []): string {
  if (error instanceof Error) {
    return redactSecretText(error.message, knownSecrets).slice(0, 500);
  }
  return "Provider connection failed";
}

function oauthState(authUrl: string): string | undefined {
  try {
    return new URL(authUrl).searchParams.get("state") ?? undefined;
  } catch {
    return undefined;
  }
}

function validateCallbackState(value: string, expectedState: string | undefined): void {
  if (!expectedState)
    throw new Error("Provider callback cannot be validated because OAuth state is missing");
  let suppliedState: string | undefined;
  try {
    const url = new URL(value);
    suppliedState = url.searchParams.get("state") ?? undefined;
  } catch {
    suppliedState = value.includes("#") ? value.split("#", 2)[1] : undefined;
  }
  if (!suppliedState || suppliedState !== expectedState) {
    throw new Error("Provider callback state mismatch; login was not completed");
  }
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
