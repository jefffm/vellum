import { afterEach, describe, expect, it, vi } from "vitest";
import type { Model } from "@mariozechner/pi-ai";
import { vellumStreamProxy } from "./vellum-stream-proxy.js";

describe("Vellum stream proxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses structured non-2xx failures with their correlation reference", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: "request_too_large",
                message: "Request body is too large",
                status: 413,
                correlationId: "request-413",
              },
            }),
            { status: 413, headers: { "Content-Type": "application/json" } }
          )
      )
    );
    const events = await collect(
      vellumStreamProxy(model(), { messages: [] }, { proxyUrl: "", authToken: "local" })
    );
    const error = events.find((event) => event.type === "error");
    expect(error?.type === "error" ? error.error.errorMessage : undefined).toBe(
      "Request body is too large (reference request-413)"
    );
  });

  it("reconstructs text from Vellum SSE events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            [
              'data: {"type":"start"}',
              'data: {"type":"text_start","contentIndex":0}',
              'data: {"type":"text_delta","contentIndex":0,"delta":"hello"}',
              'data: {"type":"text_end","contentIndex":0}',
              `data: ${JSON.stringify({ type: "done", reason: "stop", usage: usage() })}`,
              "",
            ].join("\n\n"),
            { status: 200, headers: { "Content-Type": "text/event-stream" } }
          )
      )
    );
    const events = await collect(
      vellumStreamProxy(model(), { messages: [] }, { proxyUrl: "", authToken: "local" })
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text_delta", delta: "hello" }),
        expect.objectContaining({
          type: "done",
          message: expect.objectContaining({ stopReason: "stop" }),
        }),
      ])
    );
  });
});

async function collect(stream: ReturnType<typeof vellumStreamProxy>) {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
}

function model(): Model<string> {
  return {
    id: "test",
    name: "Test",
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

function usage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}
