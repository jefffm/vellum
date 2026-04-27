import type { AgentEvent } from "@mariozechner/pi-agent-core";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_COMPILE_RETRY_LIMIT,
  evaluateCompileRetryEvent,
  installCompileRetryGuard,
} from "./compile-retry-guard.js";

const compileFailure = (message = "No string for pitch #<Pitch g, > (given frets ())") =>
  ({
    type: "tool_execution_end",
    toolCallId: "compile-1",
    toolName: "compile",
    isError: false,
    result: {
      content: [{ type: "text", text: "Compilation failed" }],
      details: {
        errors: [{ bar: 1, beat: 0, line: 25, type: "string_assignment", message }],
      },
    },
  }) satisfies AgentEvent;

const compileSuccess = {
  type: "tool_execution_end",
  toolCallId: "compile-2",
  toolName: "compile",
  isError: false,
  result: {
    content: [{ type: "text", text: "Compiled successfully" }],
    details: { errors: [], svg: "<svg></svg>" },
  },
} satisfies AgentEvent;

describe("evaluateCompileRetryEvent", () => {
  it("queues autonomous revise-and-recompile steering after a compile failure", () => {
    const action = evaluateCompileRetryEvent(compileFailure(), 0, DEFAULT_COMPILE_RETRY_LIMIT);

    expect(action.failedAttempts).toBe(1);
    expect(action.message).toContain("Compile attempt 1/3 failed");
    expect(action.message).toContain("do not ask the user whether to proceed");
    expect(action.message).toContain("call `compile` again with SVG output");
    expect(action.message).toContain("tabulate");
    expect(action.message).toContain("No string for pitch");
  });

  it("stops at the bounded retry limit with an honest failure instruction", () => {
    const action = evaluateCompileRetryEvent(compileFailure("syntax error"), 2, 3);

    expect(action.failedAttempts).toBe(3);
    expect(action.message).toContain("3/3");
    expect(action.message).toContain("retry limit has been reached");
    expect(action.message).toContain("Do not call `compile` again");
    expect(action.message).toContain("honest failure summary");
    expect(action.message).toContain("syntax error");
  });

  it("does not queue steering for a successful compile", () => {
    expect(evaluateCompileRetryEvent(compileSuccess, 2)).toEqual({ resetAttempts: true });
  });

  it("ignores compile transport errors so server/user intervention remains visible", () => {
    const action = evaluateCompileRetryEvent({ ...compileFailure(), isError: true }, 1);

    expect(action).toEqual({});
  });
});

describe("installCompileRetryGuard", () => {
  it("steers only until the retry limit and resets after success", () => {
    const { agent, listeners, steer } = createGuardAgent();

    installCompileRetryGuard(agent, { maxAttempts: 2, now: () => 123 });

    listeners[0](compileFailure("first"));
    listeners[0](compileFailure("second"));
    listeners[0](compileFailure("third"));
    listeners[0](compileSuccess);
    listeners[0](compileFailure("after reset"));

    expect(steer).toHaveBeenCalledTimes(3);
    expect(steer.mock.calls[0][0]).toMatchObject({
      role: "user",
      timestamp: 123,
      content: expect.stringContaining("1/2"),
    });
    expect(steer.mock.calls[1][0].content).toContain("retry limit has been reached");
    expect(steer.mock.calls[2][0].content).toContain("1/2");
  });

  it("queues a follow-up when the model stops with text instead of recompiling", () => {
    const { agent, listeners, followUp } = createGuardAgent();

    installCompileRetryGuard(agent, { maxAttempts: 3, now: () => 456 });

    listeners[0](compileFailure("first"));
    listeners[0]({
      type: "turn_end",
      toolResults: [],
      message: {
        role: "assistant",
        content: [{ type: "text", text: "I can fix this. Proceed?" }],
        api: "openai-codex-responses",
        provider: "openai-codex",
        model: "gpt-5.3-codex",
        usage: emptyUsage(),
        stopReason: "stop",
        timestamp: 2,
      },
    });

    expect(followUp).toHaveBeenCalledTimes(1);
    expect(followUp.mock.calls[0][0]).toMatchObject({
      role: "user",
      timestamp: 456,
      content: expect.stringContaining("Continue now without waiting for user approval"),
    });
  });
});

function createGuardAgent() {
  const listeners: Array<(event: AgentEvent) => void> = [];
  const steer = vi.fn();
  const followUp = vi.fn();
  const agent = {
    subscribe: (listener: (event: AgentEvent, signal: AbortSignal) => void | Promise<void>) => {
      listeners.push((event) => {
        void listener(event, new AbortController().signal);
      });
      return () => undefined;
    },
    steer,
    followUp,
  };

  return { agent, listeners, steer, followUp };
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
