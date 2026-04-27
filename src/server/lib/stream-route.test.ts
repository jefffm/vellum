import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssistantMessage, Model } from "@mariozechner/pi-ai";
import {
  createStreamRoute,
  resolveApiKeyForProvider,
  resolveApiKeyFromEnvironment,
  type StreamSimple,
} from "./stream-route.js";

describe("createStreamRoute", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          })
      )
    );
    vi.unstubAllEnvs();
  });

  it("returns a structured error when no API key is configured", async () => {
    const server = await listen(createStreamRoute({ resolveApiKey: () => undefined }));
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest()),
    });
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(json.error).toContain("No API key configured");
    expect(JSON.stringify(json)).not.toContain("secret-key");
  });

  it("returns an actionable error when openai-codex credentials are missing", async () => {
    const server = await listen(createStreamRoute({ resolveApiKey: () => undefined }));
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest({}, openAICodexModel())),
    });
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(json.error).toBe(
      "No API key or pi OAuth credentials configured for openai-codex. Run pi, /login, and choose ChatGPT Plus/Pro (Codex)."
    );
  });

  it("awaits async API key resolvers and injects the server-side API key", async () => {
    const streamSimpleImpl = vi.fn<StreamSimple>(async function* (_model, _context, options) {
      expect(options?.apiKey).toBe("secret-key");
      yield { type: "start", partial: assistantMessage() };
      yield { type: "text_start", contentIndex: 0, partial: assistantMessage() };
      yield { type: "text_delta", contentIndex: 0, delta: "hel", partial: assistantMessage("hel") };
      yield {
        type: "text_delta",
        contentIndex: 0,
        delta: "lo",
        partial: assistantMessage("hello"),
      };
      yield {
        type: "text_end",
        contentIndex: 0,
        content: "hello",
        partial: assistantMessage("hello"),
      };
      yield { type: "done", reason: "stop", message: assistantMessage("hello") };
    });
    const server = await listen(
      createStreamRoute({ streamSimpleImpl, resolveApiKey: async () => "secret-key" })
    );
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest({ apiKey: "browser-key" })),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain('"type":"text_delta"');
    expect(body).toContain('"delta":"hel"');
    expect(body).toContain('"type":"done"');
    expect(body).not.toContain("secret-key");
    expect(body).not.toContain("browser-key");
    expect(streamSimpleImpl).toHaveBeenCalledOnce();
  });

  it("loads provider API keys from environment", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-secret");

    expect(resolveApiKeyFromEnvironment("anthropic")).toBe("anthropic-secret");
  });

  it("resolves existing environment keys for openai-codex before pi auth", async () => {
    vi.stubEnv("OPENAI_CODEX_API_KEY", "codex-env-secret");
    vi.stubEnv("VELLUM_PI_AUTH_FILE", "/path/that/does/not/exist.json");

    await expect(resolveApiKeyForProvider("openai-codex")).resolves.toBe("codex-env-secret");
  });
});

function validRequest(
  options: Record<string, unknown> = {},
  requestModel: Model<string> = model()
) {
  return {
    model: requestModel,
    context: { messages: [] },
    options,
  };
}

function model(): Model<string> {
  return {
    id: "claude-test",
    name: "Claude Test",
    provider: "anthropic",
    api: "anthropic-messages",
    baseUrl: "https://api.anthropic.com",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1000,
    maxTokens: 100,
  };
}

function openAICodexModel(): Model<string> {
  return {
    id: "gpt-5.1-codex-mini",
    name: "GPT-5.1 Codex Mini",
    provider: "openai-codex",
    api: "openai-codex-responses",
    baseUrl: "https://chatgpt.com/backend-api",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1000,
    maxTokens: 100,
  };
}

function assistantMessage(text = ""): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "anthropic-messages",
    provider: "anthropic",
    model: "claude-test",
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: 0,
  };
}

async function listen(handler: express.RequestHandler): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.post("/api/stream", handler);
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  return server;
}

function serverUrl(server: Server): string {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return `http://127.0.0.1:${address.port}`;
}
