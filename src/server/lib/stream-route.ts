import type { RequestHandler } from "express";
import { readFileSync } from "node:fs";
import type {
  AssistantMessageEvent,
  Context,
  Model,
  SimpleStreamOptions,
} from "@mariozechner/pi-ai";
import { streamSimple } from "@mariozechner/pi-ai";
import { resolveOpenAICodexApiKeyFromPiAuth } from "./pi-auth.js";

export type StreamSimple = (
  model: Model<string>,
  context: Context,
  options?: SimpleStreamOptions
) => AsyncIterable<AssistantMessageEvent>;

export type ApiKeyResolver = (provider: string) => Promise<string | undefined> | string | undefined;

export type StreamRouteOptions = {
  streamSimpleImpl?: StreamSimple;
  resolveApiKey?: ApiKeyResolver;
};

type StreamProxyRequest = {
  model: Model<string>;
  context: Context;
  options?: Omit<SimpleStreamOptions, "apiKey" | "signal">;
};

export function createStreamRoute(options: StreamRouteOptions = {}): RequestHandler {
  const streamSimpleImpl = options.streamSimpleImpl ?? (streamSimple as StreamSimple);
  const resolveApiKey = options.resolveApiKey ?? resolveApiKeyForProvider;

  return async (request, response) => {
    const parsed = parseStreamRequest(request.body);

    if (!parsed.ok) {
      response.status(400).json({ error: parsed.error });
      return;
    }

    let apiKey: string | undefined;

    try {
      apiKey = await resolveApiKey(parsed.request.model.provider);
    } catch (error) {
      response.status(500).json({ error: errorMessage(error) });
      return;
    }

    if (!apiKey) {
      response
        .status(500)
        .json({ error: missingCredentialsMessage(parsed.request.model.provider) });
      return;
    }

    const abortController = new AbortController();
    request.on("close", () => abortController.abort());

    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    try {
      const stream = streamSimpleImpl(parsed.request.model, parsed.request.context, {
        ...parsed.request.options,
        apiKey,
        signal: abortController.signal,
      });

      for await (const event of stream) {
        writeSse(response, toProxyEvent(event));
      }

      response.end();
    } catch (error) {
      if (!response.writableEnded) {
        writeSse(response, {
          type: "error",
          reason: abortController.signal.aborted ? "aborted" : "error",
          errorMessage: errorMessage(error),
          usage: emptyUsage(),
        });
        response.end();
      }
    }
  };
}

export async function resolveApiKeyForProvider(provider: string): Promise<string | undefined> {
  const apiKey = resolveApiKeyFromEnvironment(provider);

  if (apiKey) {
    return apiKey;
  }

  if (provider === "openai-codex") {
    return resolveOpenAICodexApiKeyFromPiAuth();
  }

  return undefined;
}

export function resolveApiKeyFromEnvironment(provider: string): string | undefined {
  const normalized = provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const direct =
    process.env.VELLUM_LLM_API_KEY ??
    process.env[`${normalized}_API_KEY`] ??
    process.env[provider === "anthropic" ? "ANTHROPIC_API_KEY" : ""] ??
    process.env[provider === "openai" ? "OPENAI_API_KEY" : ""];

  if (direct && direct.length > 0) {
    return direct;
  }

  const filePath =
    process.env.VELLUM_LLM_API_KEY_FILE ??
    process.env[`${normalized}_API_KEY_FILE`] ??
    process.env.API_KEY_FILE;

  if (!filePath) {
    return undefined;
  }

  try {
    const key = readFileSync(filePath, "utf8").trim();
    return key.length > 0 ? key : undefined;
  } catch {
    return undefined;
  }
}

function parseStreamRequest(
  body: unknown
): { ok: true; request: StreamProxyRequest } | { ok: false; error: string } {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be an object" };
  }

  if (!isRecord(body.model)) {
    return { ok: false, error: "Request body must include model" };
  }

  if (typeof body.model.provider !== "string" || body.model.provider.length === 0) {
    return { ok: false, error: "Request model.provider must be a non-empty string" };
  }

  if (typeof body.model.id !== "string" || body.model.id.length === 0) {
    return { ok: false, error: "Request model.id must be a non-empty string" };
  }

  if (!isRecord(body.context) || !Array.isArray(body.context.messages)) {
    return { ok: false, error: "Request body must include context.messages" };
  }

  return {
    ok: true,
    request: {
      model: body.model as unknown as Model<string>,
      context: body.context as unknown as Context,
      options: isRecord(body.options)
        ? (body.options as Omit<SimpleStreamOptions, "apiKey" | "signal">)
        : undefined,
    },
  };
}

function toProxyEvent(event: AssistantMessageEvent): Record<string, unknown> {
  switch (event.type) {
    case "start":
      return { type: "start" };
    case "text_start":
      return { type: "text_start", contentIndex: event.contentIndex };
    case "text_delta":
      return { type: "text_delta", contentIndex: event.contentIndex, delta: event.delta };
    case "text_end": {
      const content = event.partial.content[event.contentIndex];
      return {
        type: "text_end",
        contentIndex: event.contentIndex,
        contentSignature: content?.type === "text" ? content.textSignature : undefined,
      };
    }
    case "thinking_start":
      return { type: "thinking_start", contentIndex: event.contentIndex };
    case "thinking_delta":
      return { type: "thinking_delta", contentIndex: event.contentIndex, delta: event.delta };
    case "thinking_end": {
      const content = event.partial.content[event.contentIndex];
      return {
        type: "thinking_end",
        contentIndex: event.contentIndex,
        contentSignature: content?.type === "thinking" ? content.thinkingSignature : undefined,
      };
    }
    case "toolcall_start": {
      const content = event.partial.content[event.contentIndex];
      return {
        type: "toolcall_start",
        contentIndex: event.contentIndex,
        id: content?.type === "toolCall" ? content.id : "",
        toolName: content?.type === "toolCall" ? content.name : "",
      };
    }
    case "toolcall_delta":
      return { type: "toolcall_delta", contentIndex: event.contentIndex, delta: event.delta };
    case "toolcall_end":
      return { type: "toolcall_end", contentIndex: event.contentIndex };
    case "done":
      return { type: "done", reason: event.reason, usage: event.message.usage };
    case "error":
      return {
        type: "error",
        reason: event.reason,
        errorMessage: event.error.errorMessage,
        usage: event.error.usage,
      };
  }
}

function missingCredentialsMessage(provider: string): string {
  if (provider === "openai-codex") {
    return "No API key or pi OAuth credentials configured for openai-codex. Run pi, /login, and choose ChatGPT Plus/Pro (Codex).";
  }

  return `No API key configured for ${provider}`;
}

function writeSse(
  response: { write: (chunk: string) => void },
  data: Record<string, unknown>
): void {
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function emptyUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return "LLM stream failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
