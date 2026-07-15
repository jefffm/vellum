import type { Model } from "@mariozechner/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setModelEgressAuthorizer, vellumStreamProxy } from "./vellum-stream-proxy.js";

const workspaceId = "workspace.1111111111111111";
const actionId = "model-action.2222222222222222";
const disclosureDigest = "a".repeat(64);
const envelopeDigest = "b".repeat(64);

describe("Vellum server-governed Model Action adapter", () => {
  afterEach(() => {
    setModelEgressAuthorizer();
    vi.unstubAllGlobals();
  });

  it("sends only the latest Owner intent, authorizes the disclosure, and renders the atomic result", async () => {
    stubWorkspace();
    const authorizer = vi.fn(async (disclosure) => {
      expect(disclosure).toMatchObject({
        ownerIntent: "Explain this cadence",
        ownerIntentDigest: "c".repeat(64),
        policyDigest: "d".repeat(64),
        systemPromptDigest: "e".repeat(64),
        serializedRequestDigest: "f".repeat(64),
      });
      return true;
    });
    setModelEgressAuthorizer(authorizer);
    const requests: Array<{ path: string; body: any }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const path = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ path, body });
        if (path.endsWith("/model-actions")) return success(pendingAction());
        if (path.endsWith("/authorization")) return success(authorizedAction());
        if (path.endsWith("/run")) {
          return success({
            action: {
              ...authorizedAction(),
              status: "completed",
              publicationReference: "model-publication.1",
            },
            publication: {
              id: "model-publication.1",
              result: { content: "A server-bound answer." },
            },
          });
        }
        throw new Error(`Unexpected path ${path}`);
      })
    );

    const events = await collect(
      vellumStreamProxy(
        maliciousClientModel(),
        {
          systemPrompt: "Client-controlled system prompt",
          messages: [
            { role: "user", content: "Earlier context", timestamp: 1 },
            { role: "user", content: "Explain this cadence", timestamp: 2 },
          ],
        },
        {
          proxyUrl: "https://attacker.invalid",
          authToken: "client-token",
          headers: { "x-escalate-tools": "true" },
        }
      )
    );

    expect(requests).toEqual([
      {
        path: `/api/workspaces/${workspaceId}/model-actions`,
        body: { kind: "interactive_guidance_v1", intent: "Explain this cadence" },
      },
      {
        path: `/api/workspaces/${workspaceId}/model-actions/${actionId}/authorization`,
        body: { decision: "authorize", disclosureDigest },
      },
      {
        path: `/api/workspaces/${workspaceId}/model-actions/${actionId}/run`,
        body: { envelopeDigest },
      },
    ]);
    expect(JSON.stringify(requests)).not.toContain("attacker.invalid");
    expect(JSON.stringify(requests)).not.toContain("Client-controlled system prompt");
    expect(JSON.stringify(requests)).not.toContain("x-escalate-tools");
    expect(authorizer).toHaveBeenCalledTimes(1);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text_delta", delta: "A server-bound answer." }),
        expect.objectContaining({ type: "done" }),
      ])
    );
  });

  it("records denial and never invokes the provider run endpoint", async () => {
    stubWorkspace();
    setModelEgressAuthorizer(async () => false);
    const paths: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const path = String(input);
        paths.push(path);
        if (path.endsWith("/model-actions")) return success(pendingAction());
        if (path.endsWith("/authorization")) {
          return success({ ...pendingAction(), status: "denied" });
        }
        throw new Error("Provider run must not be called after denial");
      })
    );

    const events = await collect(
      vellumStreamProxy(
        maliciousClientModel(),
        { messages: [{ role: "user", content: "Analyze", timestamp: 1 }] },
        { proxyUrl: "", authToken: "local" }
      )
    );
    expect(paths).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text_delta",
          delta: expect.stringContaining("Nothing was sent"),
        }),
      ])
    );
  });

  it("parses structured failures with their correlation reference", async () => {
    stubWorkspace();
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
      vellumStreamProxy(
        maliciousClientModel(),
        { messages: [{ role: "user", content: "Analyze", timestamp: 1 }] },
        { proxyUrl: "", authToken: "local" }
      )
    );
    const error = events.find((event) => event.type === "error");
    expect(error?.type === "error" ? error.error.errorMessage : undefined).toBe(
      "Request body is too large (reference request-413)"
    );
  });
});

async function collect(stream: ReturnType<typeof vellumStreamProxy>) {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
}

function stubWorkspace(): void {
  vi.stubGlobal("window", {
    location: { href: `http://127.0.0.1:5173/?workspace=${workspaceId}` },
    localStorage: { getItem: vi.fn(() => null) },
  });
}

function success<T>(data: T): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function pendingAction() {
  return {
    id: actionId,
    status: "awaiting_authorization",
    attempts: [
      {
        disclosureDigest,
        disclosure: {
          id: "egress-disclosure.3333333333333333",
          actionId,
          attemptId: "model-attempt.4444444444444444",
          provider: "openai-codex",
          model: "gpt-5.3-codex",
          purpose: "interactive_musicological_guidance",
          policyDigest: "d".repeat(64),
          systemPromptDigest: "e".repeat(64),
          serializedRequestDigest: "f".repeat(64),
          ownerIntent: "Explain this cadence",
          ownerIntentDigest: "c".repeat(64),
          dataClasses: ["owner_intent"],
          sourceReferences: [],
          toolCapabilities: [],
          policyDecision: "allow",
          policyReason: "Only the bounded Owner intent is proposed for egress.",
          requiresOwnerAuthorization: true,
          createdAt: "2026-07-15T12:00:00.000Z",
        },
      },
    ],
  };
}

function authorizedAction() {
  return {
    ...pendingAction(),
    status: "authorized",
    attempts: [{ ...pendingAction().attempts[0], envelopeDigest }],
  };
}

function maliciousClientModel(): Model<string> {
  return {
    id: "attacker-model",
    name: "Attacker",
    provider: "attacker-provider",
    api: "openai-completions",
    baseUrl: "https://attacker.invalid",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1000,
    maxTokens: 100,
  };
}
