import { readFileSync } from "node:fs";
import { ProviderConnection } from "./provider-connection.js";

export const providerConnection = new ProviderConnection();

export async function resolveApiKeyForProvider(provider: string): Promise<string | undefined> {
  const apiKey = resolveApiKeyFromEnvironment(provider);
  if (apiKey) return apiKey;
  if (provider === "openai-codex") return providerConnection.resolveApiKey();
  return undefined;
}

export function resolveApiKeyFromEnvironment(provider: string): string | undefined {
  const normalized = provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const direct =
    process.env.VELLUM_LLM_API_KEY ??
    process.env[`${normalized}_API_KEY`] ??
    process.env[provider === "anthropic" ? "ANTHROPIC_API_KEY" : ""] ??
    process.env[provider === "openai" || provider === "openai-codex" ? "OPENAI_API_KEY" : ""];
  if (direct) return direct;

  const filePath =
    process.env.VELLUM_LLM_API_KEY_FILE ??
    process.env[`${normalized}_API_KEY_FILE`] ??
    process.env.API_KEY_FILE;
  if (!filePath) return undefined;
  try {
    return readFileSync(filePath, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}
