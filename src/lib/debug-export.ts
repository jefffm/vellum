import type { Agent, AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";

const REDACTED_KEYS =
  /^(api[-_]?key|authorization|token|access|refresh|secret|password|svg|pdf|midi)$/i;
const LARGE_STRING_LIMIT = 100_000;
const MAX_EVENTS = 1_000;

export type DebugTraceEvent = {
  timestamp: string;
  event: unknown;
};

export type DebugTrace = {
  generatedAt: string;
  app: "vellum";
  location?: string;
  userAgent?: string;
  eventCount: number;
  events: DebugTraceEvent[];
  messages: unknown[];
};

export type VellumDebugApi = {
  getTrace: () => DebugTrace;
  exportDebugTrace: () => string;
  exportChatText: () => string;
  downloadDebugTrace: () => void;
  downloadChatText: () => void;
  clearTrace: () => void;
};

declare global {
  interface Window {
    vellumDebug?: VellumDebugApi;
  }
}

export function installDebugExport(agent: Agent): VellumDebugApi {
  const events: DebugTraceEvent[] = [];

  agent.subscribe((event) => {
    events.push({ timestamp: new Date().toISOString(), event: sanitizeForTrace(event) });
    if (events.length > MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS);
    }
  });

  const api: VellumDebugApi = {
    getTrace: () => buildDebugTrace(agent.state.messages, events),
    exportDebugTrace: () => JSON.stringify(buildDebugTrace(agent.state.messages, events), null, 2),
    exportChatText: () => exportChatText(agent.state.messages),
    downloadDebugTrace: () => downloadText("vellum-debug-trace", "json", api.exportDebugTrace()),
    downloadChatText: () => downloadText("vellum-chat", "md", api.exportChatText()),
    clearTrace: () => {
      events.splice(0, events.length);
    },
  };

  if (typeof window !== "undefined") {
    window.vellumDebug = api;
    installDebugExportToolbar(api);
  }

  return api;
}

export function buildDebugTrace(
  messages: AgentMessage[],
  events: DebugTraceEvent[],
  now = new Date()
): DebugTrace {
  return {
    generatedAt: now.toISOString(),
    app: "vellum",
    location: typeof window === "undefined" ? undefined : window.location.href,
    userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
    eventCount: events.length,
    events: sanitizeForTrace(events) as DebugTraceEvent[],
    messages: sanitizeForTrace(messages) as unknown[],
  };
}

export function exportChatText(messages: AgentMessage[]): string {
  const chunks = messages.map(formatMessageAsMarkdown).filter((chunk) => chunk.trim().length > 0);
  return chunks.join("\n\n---\n\n");
}

export function sanitizeForTrace(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, traceReplacer));
}

function traceReplacer(key: string, value: unknown): unknown {
  if (REDACTED_KEYS.test(key)) {
    return redactValue(value);
  }

  if (typeof value === "string" && value.length > LARGE_STRING_LIMIT) {
    return `[truncated string: ${value.length} characters]${value.slice(0, LARGE_STRING_LIMIT)}`;
  }

  return value;
}

function redactValue(value: unknown): string {
  if (typeof value === "string") {
    return `[redacted ${value.length} chars]`;
  }

  if (value === undefined || value === null) {
    return "[redacted]";
  }

  return `[redacted ${Array.isArray(value) ? "array" : typeof value}]`;
}

function formatMessageAsMarkdown(message: AgentMessage): string {
  if (!isRecord(message) || typeof message.role !== "string") {
    return `## Message\n\n${JSON.stringify(sanitizeForTrace(message), null, 2)}`;
  }

  const record = message as Record<string, unknown>;
  const timestamp =
    typeof record.timestamp === "number" ? new Date(record.timestamp).toISOString() : "";
  const suffix = timestamp ? ` — ${timestamp}` : "";

  switch (record.role) {
    case "user":
      return `## User${suffix}\n\n${formatContent(record.content)}`;
    case "assistant": {
      const model =
        typeof record.provider === "string" && typeof record.model === "string"
          ? ` (${record.provider}/${record.model})`
          : "";
      return `## Assistant${model}${suffix}\n\n${formatContent(record.content)}`;
    }
    case "toolResult": {
      const title = typeof record.toolName === "string" ? record.toolName : "tool";
      const status = record.isError ? "error" : "success";
      return `## Tool: ${title} (${status})${suffix}\n\n${formatContent(record.content)}`;
    }
    default:
      return `## ${record.role}${suffix}\n\n${JSON.stringify(sanitizeForTrace(record), null, 2)}`;
  }
}

function formatContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return JSON.stringify(sanitizeForTrace(content), null, 2);
  }

  return content
    .map((part) => {
      if (!isRecord(part) || typeof part.type !== "string") {
        return JSON.stringify(sanitizeForTrace(part), null, 2);
      }

      switch (part.type) {
        case "text":
          return typeof part.text === "string" ? part.text : "";
        case "thinking":
          return typeof part.thinking === "string"
            ? `<thinking>\n${part.thinking}\n</thinking>`
            : "";
        case "toolCall":
          return [
            `\`\`\`tool-call ${typeof part.name === "string" ? part.name : "unknown"}`,
            JSON.stringify(sanitizeForTrace(part.arguments), null, 2),
            "```",
          ].join("\n");
        case "image":
          return `[image: ${typeof part.mimeType === "string" ? part.mimeType : "unknown type"}]`;
        default:
          return JSON.stringify(sanitizeForTrace(part), null, 2);
      }
    })
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
}

function installDebugExportToolbar(api: VellumDebugApi): void {
  if (typeof document === "undefined" || document.querySelector("#vellum-debug-export")) {
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.id = "vellum-debug-export";
  toolbar.setAttribute("aria-label", "Export chat and debug trace");

  const chatButton = document.createElement("button");
  chatButton.type = "button";
  chatButton.textContent = "Export chat";
  chatButton.title = "Download the current chat transcript as Markdown";
  chatButton.addEventListener("click", () => api.downloadChatText());

  const traceButton = document.createElement("button");
  traceButton.type = "button";
  traceButton.textContent = "Export trace";
  traceButton.title = "Download a redacted JSON debug trace with messages, events, and tool calls";
  traceButton.addEventListener("click", () => api.downloadDebugTrace());

  toolbar.append(chatButton, traceButton);
  document.body.append(toolbar);
}

function downloadText(baseName: string, extension: string, text: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([text], {
    type: extension === "json" ? "application/json" : "text/markdown",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${baseName}-${timestamp}.${extension}`;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
