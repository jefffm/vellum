import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeModelActionEgress, prepareModelActionEgress } from "./model-action-boundary.js";

const mocks = vi.hoisted(() => ({
  getModel: vi.fn(() => ({
    id: "gpt-5.3-codex",
    provider: "openai-codex",
    api: "openai-codex-responses",
  })),
  resolveApiKey: vi.fn(async () => "test-api-key"),
  streamSimple: vi.fn(),
}));

vi.mock("@mariozechner/pi-ai", () => ({
  getModel: mocks.getModel,
  streamSimple: mocks.streamSimple,
}));
vi.mock("./provider-runtime.js", () => ({
  resolveApiKeyForProvider: mocks.resolveApiKey,
}));

import { executeServerModelAction } from "./model-action-provider.js";

describe("server Model Action provider stream", () => {
  afterEach(() => vi.clearAllMocks());

  it("accepts one complete text-only stream and forwards cancellation", async () => {
    const { envelope, envelopeDigest } = authorizedEnvelope();
    const message = assistantMessage("Bounded guidance", "stop");
    mocks.streamSimple.mockReturnValue(
      events([
        { type: "start", partial: message },
        { type: "text_start", contentIndex: 0, partial: message },
        { type: "text_delta", contentIndex: 0, delta: "Bounded guidance", partial: message },
        { type: "text_end", contentIndex: 0, content: "Bounded guidance", partial: message },
        { type: "done", reason: "stop", message },
      ])
    );
    const controller = new AbortController();

    await expect(
      executeServerModelAction(envelope, envelopeDigest, controller.signal)
    ).resolves.toMatchObject({
      envelopeDigest,
      provider: "openai-codex",
      model: "gpt-5.3-codex",
      content: "Bounded guidance",
    });
    expect(mocks.streamSimple).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ apiKey: "test-api-key", signal: controller.signal })
    );
  });

  it("rejects every provider tool-call event", async () => {
    const { envelope, envelopeDigest } = authorizedEnvelope();
    const message = assistantMessage("", "toolUse");
    mocks.streamSimple.mockReturnValue(
      events([
        { type: "start", partial: message },
        { type: "toolcall_start", contentIndex: 0, partial: message },
      ])
    );

    await expect(executeServerModelAction(envelope, envelopeDigest)).rejects.toThrow(
      /unauthorized tool call/
    );
  });

  it("rejects truncated and non-stop provider streams", async () => {
    const { envelope, envelopeDigest } = authorizedEnvelope();
    const truncated = assistantMessage("Partial", "stop");
    mocks.streamSimple.mockReturnValueOnce(
      events([
        { type: "start", partial: truncated },
        { type: "text_start", contentIndex: 0, partial: truncated },
        { type: "text_delta", contentIndex: 0, delta: "Partial", partial: truncated },
      ])
    );
    await expect(executeServerModelAction(envelope, envelopeDigest)).rejects.toThrow(
      /without a valid terminal event/
    );

    const lengthLimited = assistantMessage("Partial", "length");
    mocks.streamSimple.mockReturnValueOnce(
      events([
        { type: "start", partial: lengthLimited },
        { type: "text_start", contentIndex: 0, partial: lengthLimited },
        { type: "text_delta", contentIndex: 0, delta: "Partial", partial: lengthLimited },
        { type: "text_end", contentIndex: 0, content: "Partial", partial: lengthLimited },
        { type: "done", reason: "length", message: lengthLimited },
      ])
    );
    await expect(executeServerModelAction(envelope, envelopeDigest)).rejects.toThrow(
      /allowed terminal state/
    );
  });
});

function authorizedEnvelope() {
  const identity = {
    actionId: "model-action.1111111111111111",
    attemptId: "model-attempt.2222222222222222",
    ownerIntent: "Explain this cadence",
    inputVersions: [],
    createId: () => "3333333333333333",
    now: () => new Date("2026-07-15T12:00:00.000Z"),
  };
  const prepared = prepareModelActionEgress(identity);
  const authorized = authorizeModelActionEgress({
    ...identity,
    ...prepared,
    decision: "authorize",
  });
  return { envelope: authorized.egressEnvelope!, envelopeDigest: authorized.envelopeDigest! };
}

function assistantMessage(text: string, stopReason: "stop" | "length" | "toolUse") {
  return {
    role: "assistant",
    content: text ? [{ type: "text", text }] : [],
    api: "openai-codex-responses",
    provider: "openai-codex",
    model: "gpt-5.3-codex",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason,
    timestamp: 0,
  } as any;
}

async function* events(values: any[]) {
  for (const value of values) yield value;
}
