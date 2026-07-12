import type { ProxyAssistantMessageEvent, ProxyStreamOptions } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  parseStreamingJson,
  type AssistantMessage,
  type AssistantMessageEvent,
  type Context,
  type Model,
  type ToolCall,
} from "@mariozechner/pi-ai";
import { apiErrorFromResponse, isApiFailure } from "./api-contract.js";

/**
 * Vellum's typed-error-compatible equivalent of Pi's streamProxy.
 *
 * Pi 0.70 treats a non-2xx `error` value as a string. Vellum's shared API
 * contract deliberately makes it a structured object, so the stock client
 * would surface `Proxy error: [object Object]`. Keep the protocol adapter here
 * until the installed Pi client accepts structured failures.
 */
export function vellumStreamProxy(
  model: Model<string>,
  context: Context,
  options: ProxyStreamOptions
) {
  const stream = createAssistantMessageEventStream();

  void (async () => {
    const partial = initialMessage(model);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const abort = () => void reader?.cancel("Request aborted by user").catch(() => undefined);
    options.signal?.addEventListener("abort", abort);

    try {
      const response = await fetch(`${options.proxyUrl}/api/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, context, options: serializableOptions(options) }),
        signal: options.signal,
      });
      if (!response.ok) throw await typedProxyError(response);
      if (!response.body) throw new Error("Vellum stream response has no body");

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (options.signal?.aborted) throw new Error("Request aborted by user");
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          const event = applyProxyEvent(JSON.parse(data) as ProxyAssistantMessageEvent, partial);
          if (event) stream.push(event);
        }
      }
      if (options.signal?.aborted) throw new Error("Request aborted by user");
      stream.end();
    } catch (error) {
      const reason = options.signal?.aborted ? "aborted" : "error";
      partial.stopReason = reason;
      partial.errorMessage = error instanceof Error ? error.message : String(error);
      stream.push({ type: "error", reason, error: partial });
      stream.end();
    } finally {
      options.signal?.removeEventListener("abort", abort);
    }
  })();

  return stream;
}

async function typedProxyError(response: Response): Promise<Error> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return new Error(`Vellum API error: ${response.status} ${response.statusText}`.trim());
  }
  const error = apiErrorFromResponse(response.status, body);
  if (!isApiFailure(body)) return error;
  error.message = `${error.message} (reference ${error.correlationId})`;
  return error;
}

function serializableOptions(options: ProxyStreamOptions) {
  return {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    reasoning: options.reasoning,
    cacheRetention: options.cacheRetention,
    sessionId: options.sessionId,
    headers: options.headers,
    metadata: options.metadata,
    transport: options.transport,
    thinkingBudgets: options.thinkingBudgets,
    maxRetryDelayMs: options.maxRetryDelayMs,
  };
}

function initialMessage(model: Model<string>): AssistantMessage {
  return {
    role: "assistant",
    stopReason: "stop",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    timestamp: Date.now(),
  };
}

function applyProxyEvent(
  event: ProxyAssistantMessageEvent,
  partial: AssistantMessage
): AssistantMessageEvent | undefined {
  switch (event.type) {
    case "start":
      return { type: "start", partial };
    case "text_start":
      partial.content[event.contentIndex] = { type: "text", text: "" };
      return { type: "text_start", contentIndex: event.contentIndex, partial };
    case "text_delta": {
      const content = partial.content[event.contentIndex];
      if (content?.type !== "text") throw new Error("Received text_delta for non-text content");
      content.text += event.delta;
      return { type: "text_delta", contentIndex: event.contentIndex, delta: event.delta, partial };
    }
    case "text_end": {
      const content = partial.content[event.contentIndex];
      if (content?.type !== "text") throw new Error("Received text_end for non-text content");
      content.textSignature = event.contentSignature;
      return { type: "text_end", contentIndex: event.contentIndex, content: content.text, partial };
    }
    case "thinking_start":
      partial.content[event.contentIndex] = { type: "thinking", thinking: "" };
      return { type: "thinking_start", contentIndex: event.contentIndex, partial };
    case "thinking_delta": {
      const content = partial.content[event.contentIndex];
      if (content?.type !== "thinking")
        throw new Error("Received thinking_delta for non-thinking content");
      content.thinking += event.delta;
      return {
        type: "thinking_delta",
        contentIndex: event.contentIndex,
        delta: event.delta,
        partial,
      };
    }
    case "thinking_end": {
      const content = partial.content[event.contentIndex];
      if (content?.type !== "thinking")
        throw new Error("Received thinking_end for non-thinking content");
      content.thinkingSignature = event.contentSignature;
      return {
        type: "thinking_end",
        contentIndex: event.contentIndex,
        content: content.thinking,
        partial,
      };
    }
    case "toolcall_start":
      partial.content[event.contentIndex] = {
        type: "toolCall",
        id: event.id,
        name: event.toolName,
        arguments: {},
        partialJson: "",
      } as ToolCall & { partialJson: string };
      return { type: "toolcall_start", contentIndex: event.contentIndex, partial };
    case "toolcall_delta": {
      const content = partial.content[event.contentIndex] as
        | (ToolCall & { partialJson?: string })
        | undefined;
      if (content?.type !== "toolCall")
        throw new Error("Received toolcall_delta for non-toolCall content");
      content.partialJson = `${content.partialJson ?? ""}${event.delta}`;
      content.arguments = parseStreamingJson(content.partialJson) || {};
      partial.content[event.contentIndex] = { ...content };
      return {
        type: "toolcall_delta",
        contentIndex: event.contentIndex,
        delta: event.delta,
        partial,
      };
    }
    case "toolcall_end": {
      const content = partial.content[event.contentIndex] as
        | (ToolCall & { partialJson?: string })
        | undefined;
      if (content?.type !== "toolCall") return undefined;
      delete content.partialJson;
      return { type: "toolcall_end", contentIndex: event.contentIndex, toolCall: content, partial };
    }
    case "done":
      partial.stopReason = event.reason;
      partial.usage = event.usage;
      return { type: "done", reason: event.reason, message: partial };
    case "error":
      partial.stopReason = event.reason;
      partial.errorMessage = event.errorMessage;
      partial.usage = event.usage;
      return { type: "error", reason: event.reason, error: partial };
  }
}
