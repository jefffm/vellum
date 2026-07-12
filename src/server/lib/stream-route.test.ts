import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssistantMessage, Model } from "@mariozechner/pi-ai";
import type { ApiResponse } from "../../lib/api-contract.js";
import { vellumStreamProxy } from "../../lib/vellum-stream-proxy.js";
import { sendApiFailure } from "./api-boundary.js";
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
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("No API key configured");
    expect(body).toContain('"type":"error"');
    expect(body).not.toContain("secret-key");
  });

  it("returns an actionable error when openai-codex credentials are missing", async () => {
    const server = await listen(createStreamRoute({ resolveApiKey: () => undefined }));
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest({}, openAICodexModel())),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain(
      "ChatGPT is not connected. Use Vellum's Connect ChatGPT control, or configure an API key fallback."
    );
  });

  it("keeps the application proxy client actionable under the typed API contract", async () => {
    const server = await listen(createStreamRoute({ resolveApiKey: () => undefined }));
    servers.push(server);
    const stream = vellumStreamProxy(
      openAICodexModel(),
      { messages: [] },
      {
        proxyUrl: serverUrl(server),
        authToken: "local-runtime",
      }
    );
    const events = [];
    for await (const event of stream) events.push(event);
    const error = events.find((event) => event.type === "error");
    expect(error?.type === "error" ? error.error.errorMessage : undefined).toContain(
      "ChatGPT is not connected"
    );
  });

  it.each([
    [400, "invalid_request", "Request model is invalid"],
    [413, "request_too_large", "Request body is too large"],
  ] as const)(
    "decodes a typed %i pre-stream failure through the actual client",
    async (status, code, message) => {
      const server = await listen((_request, response) => {
        sendApiFailure(response, { status, code, message });
      });
      servers.push(server);
      const events = [];
      for await (const event of vellumStreamProxy(
        openAICodexModel(),
        { messages: [] },
        { proxyUrl: serverUrl(server), authToken: "local-runtime" }
      )) {
        events.push(event);
      }
      const error = events.find((event) => event.type === "error");
      expect(error?.type === "error" ? error.error.errorMessage : undefined).toMatch(
        new RegExp(`^${message} \\(reference [0-9a-f-]+\\)$`)
      );
    }
  );

  it("uses the typed API envelope before SSE starts for invalid requests", async () => {
    const server = await listen(createStreamRoute({ resolveApiKey: () => undefined }));
    servers.push(server);
    const response = await fetch(`${serverUrl(server)}/api/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const json = (await response.json()) as ApiResponse<unknown>;
    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    if (!json.ok) expect(json.error.code).toBe("invalid_request");
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

  it("redacts the resolved key and structured credentials from streaming failures", async () => {
    const streamSimpleImpl: StreamSimple = async function* () {
      throw new Error("Bearer secret-key refresh=refresh-secret");
    };
    const server = await listen(
      createStreamRoute({ streamSimpleImpl, resolveApiKey: () => "secret-key" })
    );
    servers.push(server);
    const response = await fetch(`${serverUrl(server)}/api/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest()),
    });
    const body = await response.text();
    expect(body).not.toMatch(/secret-key|refresh-secret/);
    expect(body).toContain("[redacted]");
  });

  it("resolves existing environment keys before the owned Provider Connection", async () => {
    vi.stubEnv("OPENAI_CODEX_API_KEY", "codex-env-secret");

    await expect(resolveApiKeyForProvider("openai-codex")).resolves.toBe("codex-env-secret");
  });

  it("accepts the standard OpenAI API key as a ChatGPT-provider fallback", () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-fallback-secret");
    expect(resolveApiKeyFromEnvironment("openai-codex")).toBe("openai-fallback-secret");
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
