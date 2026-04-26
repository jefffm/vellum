import { Type } from "@sinclair/typebox";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServerTool } from "./create-server-tool.js";

const ParametersSchema = Type.Object({ value: Type.Number() });

type TestDetails = {
  value: number;
};

describe("createServerTool", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a tool that posts params and formats direct JSON responses", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ value: 42 }));
    vi.stubGlobal("fetch", fetchMock);
    const tool = createServerTool({
      name: "test-ok",
      description: "Test tool",
      parameters: ParametersSchema,
      endpoint: "/api/test",
      formatContent: (response: TestDetails) => `Result: ${response.value}`,
    });

    const result = await tool.execute("call-1", { value: 7 });

    expect(tool.name).toBe("test-ok");
    expect(tool.label).toBe("test-ok");
    expect(result.content[0]).toEqual({ type: "text", text: "Result: 42" });
    expect(result.details).toEqual({ value: 42 });
    expect(fetchMock).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 7 }),
      signal: undefined,
    });
  });

  it("unwraps { ok, data } API envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ok: true, data: { value: 10 } }))
    );
    const tool = createServerTool({
      name: "test-envelope",
      description: "Test envelope",
      parameters: ParametersSchema,
      endpoint: "/api/test",
      formatContent: (response: TestDetails) => `Result: ${response.value}`,
      formatDetails: (response) => ({ value: response.value * 2 }),
    });

    const result = await tool.execute("call-1", { value: 1 });

    expect(result.content[0]).toEqual({ type: "text", text: "Result: 20" });
    expect(result.details).toEqual({ value: 20 });
  });

  it("returns structured error content for HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: "compile failed" }, { status: 500, statusText: "Server Error" })
      )
    );
    const tool = createServerTool({
      name: "test-error",
      description: "Test error",
      parameters: ParametersSchema,
      endpoint: "/api/fail",
      formatContent: (response: TestDetails) => `Result: ${response.value}`,
    });

    const result = await tool.execute("call-1", { value: 1 });

    expect(result.content[0]).toEqual({ type: "text", text: "Error: compile failed" });
    expect(result.details).toBeUndefined();
  });

  it("returns structured error content for ok:false envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ok: false, error: "bad input" }))
    );
    const tool = createServerTool({
      name: "test-envelope-error",
      description: "Test envelope error",
      parameters: ParametersSchema,
      endpoint: "/api/fail",
      formatContent: (response: TestDetails) => `Result: ${response.value}`,
    });

    const result = await tool.execute("call-1", { value: 1 });

    expect(result.content[0]).toEqual({ type: "text", text: "Error: bad input" });
  });

  it("passes AbortSignal through to fetch and rethrows abort errors", async () => {
    const controller = new AbortController();
    const abortError = new DOMException("Aborted", "AbortError");
    const fetchMock = vi.fn(async (_endpoint: string, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      throw abortError;
    });
    vi.stubGlobal("fetch", fetchMock);
    const tool = createServerTool({
      name: "test-abort",
      description: "Test abort",
      parameters: ParametersSchema,
      endpoint: "/api/slow",
      formatContent: (response: TestDetails) => `Result: ${response.value}`,
    });

    await expect(tool.execute("call-1", { value: 1 }, controller.signal)).rejects.toBe(abortError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    statusText: init?.statusText,
    headers: { "Content-Type": "application/json" },
  });
}
