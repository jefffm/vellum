import { chmod, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { OAuthCredentials } from "@mariozechner/pi-ai/oauth";

const OPENAI_CODEX_PROVIDER = "openai-codex";
const REFRESH_WINDOW_MS = 60_000;

type AuthFile = Record<string, unknown>;

type PiOAuthEntry = {
  type?: string;
  access: string;
  refresh: string;
  expires: number;
  [key: string]: unknown;
};

export type PiAuthOptions = {
  authFile?: string;
  now?: () => number;
  refreshWindowMs?: number;
  refreshOpenAICodexToken?: (refreshToken: string) => Promise<OAuthCredentials>;
};

export function resolvePiAuthFile(options: Pick<PiAuthOptions, "authFile"> = {}): string {
  if (options.authFile) {
    return options.authFile;
  }

  if (process.env.VELLUM_PI_AUTH_FILE) {
    return process.env.VELLUM_PI_AUTH_FILE;
  }

  if (process.env.PI_CODING_AGENT_DIR) {
    return join(process.env.PI_CODING_AGENT_DIR, "auth.json");
  }

  return join(homedir(), ".pi", "agent", "auth.json");
}

export async function resolveOpenAICodexApiKeyFromPiAuth(
  options: PiAuthOptions = {}
): Promise<string | undefined> {
  const authFile = resolvePiAuthFile(options);
  const auth = await readAuthFile(authFile);

  if (!auth) {
    return undefined;
  }

  const entry = parseOAuthEntry(auth[OPENAI_CODEX_PROVIDER]);

  if (!entry) {
    return undefined;
  }

  const now = options.now?.() ?? Date.now();
  const refreshWindowMs = options.refreshWindowMs ?? REFRESH_WINDOW_MS;

  if (entry.expires > now + refreshWindowMs) {
    return entry.access;
  }

  const refreshToken = options.refreshOpenAICodexToken ?? loadOpenAICodexRefreshToken;
  const refreshed = await refreshToken(entry.refresh);
  const refreshedEntry = parseOAuthEntry({ ...entry, ...refreshed, type: "oauth" });

  if (!refreshedEntry) {
    return undefined;
  }

  auth[OPENAI_CODEX_PROVIDER] = { ...entry, ...refreshed, type: "oauth" };
  await writeAuthFile(authFile, auth);

  return refreshedEntry.access;
}

async function readAuthFile(authFile: string): Promise<AuthFile | undefined> {
  try {
    const raw = await readFile(authFile, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed)) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

async function writeAuthFile(authFile: string, auth: AuthFile): Promise<void> {
  await writeFile(authFile, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
  await chmod(authFile, 0o600);
}

function parseOAuthEntry(value: unknown): PiOAuthEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if ("type" in value && value.type !== undefined && value.type !== "oauth") {
    return undefined;
  }

  if (
    typeof value.access !== "string" ||
    value.access.length === 0 ||
    typeof value.refresh !== "string" ||
    value.refresh.length === 0 ||
    typeof value.expires !== "number" ||
    !Number.isFinite(value.expires)
  ) {
    return undefined;
  }

  return value as PiOAuthEntry;
}

async function loadOpenAICodexRefreshToken(refreshToken: string): Promise<OAuthCredentials> {
  const { refreshOpenAICodexToken } = await import("@mariozechner/pi-ai/oauth");
  return refreshOpenAICodexToken(refreshToken);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
