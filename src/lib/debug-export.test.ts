import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";

import { buildDebugTrace, exportChatText, sanitizeForTrace } from "./debug-export.js";

describe("debug export", () => {
  it("exports a readable markdown chat transcript", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "Arrange this", timestamp: 1 },
      {
        role: "assistant",
        content: [
          { type: "text", text: "I'll compile it." },
          { type: "toolCall", id: "call-1", name: "compile", arguments: { source: "{ c'4 }" } },
        ],
        api: "openai-codex-responses",
        provider: "openai-codex",
        model: "gpt-5.3-codex",
        usage: emptyUsage(),
        stopReason: "toolUse",
        timestamp: 2,
      },
      {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "compile",
        content: [{ type: "text", text: "Compiled successfully." }],
        details: { errors: [], svg: "<svg>huge</svg>" },
        isError: false,
        timestamp: 3,
      },
    ];

    const text = exportChatText(messages);

    expect(text).toContain("## User");
    expect(text).toContain("Arrange this");
    expect(text).toContain("## Assistant (openai-codex/gpt-5.3-codex)");
    expect(text).toContain("```tool-call compile");
    expect(text).toContain("{ c'4 }");
    expect(text).toContain("## Tool: compile (success)");
    expect(text).not.toContain("<svg>huge</svg>");
  });

  it("redacts secrets and heavyweight artifacts in JSON traces", () => {
    const sanitized = sanitizeForTrace({
      apiKey: "sk-secret",
      access: "oauth-access",
      nested: { svg: "<svg>huge</svg>", source: "{ c'4 }" },
    });

    expect(sanitized).toEqual({
      apiKey: "[redacted 9 chars]",
      access: "[redacted 12 chars]",
      nested: { svg: "[redacted 15 chars]", source: "{ c'4 }" },
    });
  });

  it("builds a trace with sanitized events and messages", () => {
    const trace = buildDebugTrace(
      [
        {
          role: "toolResult",
          toolCallId: "compile-1",
          toolName: "compile",
          content: [{ type: "text", text: "ok" }],
          details: { svg: "<svg>huge</svg>", errors: [] },
          isError: false,
          timestamp: 1,
        },
      ],
      [
        {
          timestamp: "now",
          event: { type: "tool_execution_end", result: { details: { pdf: "abc" } } },
        },
      ],
      new Date("2026-04-27T00:00:00Z")
    );

    expect(trace.generatedAt).toBe("2026-04-27T00:00:00.000Z");
    expect(trace.eventCount).toBe(1);
    expect(JSON.stringify(trace)).not.toContain("<svg>huge</svg>");
    expect(JSON.stringify(trace)).not.toContain('"pdf":"abc"');
  });
});

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
