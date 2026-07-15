import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelActionInputVersion, ModelEgressEnvelope } from "../../lib/music-domain.js";
import type { ModelActionProviderResponse } from "./model-action-boundary.js";
import { ModelActionService } from "./model-action-service.js";
import { WorkspaceStore } from "./workspace-store.js";

describe("server-governed ModelActionService", () => {
  let store: WorkspaceStore;
  let service: ModelActionService;
  let workspaceId: string;
  let sequence: number;
  let provider: ReturnType<
    typeof vi.fn<
      (
        envelope: ModelEgressEnvelope,
        digest: string,
        signal?: AbortSignal
      ) => Promise<ModelActionProviderResponse>
    >
  >;

  beforeEach(async () => {
    sequence = 0;
    store = new WorkspaceStore({
      rootDirectory: await mkdtemp(path.join(tmpdir(), "vellum-actions-")),
      createId: () => "11111111-1111-4111-8111-111111111111",
      now: () => new Date("2026-07-11T12:00:00.000Z"),
    });
    workspaceId = store.create({ title: "Action fixture" }).id;
    vi.spyOn(store, "resolveModelActionInputVersions").mockImplementation((_workspaceId, values) =>
      values.map((value) => ({ ...value }))
    );
    vi.spyOn(store, "resolveCurrentInputVersions").mockImplementation((_workspaceId, values) =>
      values.map((value) => ({ ...value }))
    );
    provider = vi.fn(async (envelope, envelopeDigest) => ({
      envelopeDigest,
      provider: envelope.provider,
      model: envelope.model,
      providerResponseId: "provider-response.fake",
      content: "A bounded musicological answer.",
    }));
    service = new ModelActionService({
      store,
      executeProvider: provider,
      createId: () => `${(++sequence).toString(16).padStart(16, "0")}`,
      now: () => new Date(`2026-07-11T12:00:${String(sequence).padStart(2, "0")}.000Z`),
    });
  });

  it("mints a fixed destination disclosure and preserves an idempotent intent-only request", () => {
    const input = {
      kind: "interactive_guidance_v1" as const,
      intent: "Identify the contrapuntal entries",
      idempotencyKey: "same-request-boundary",
    };
    const first = service.create(workspaceId, input);
    const duplicate = service.create(workspaceId, input);

    expect(duplicate.id).toBe(first.id);
    expect(first).toMatchObject({ status: "awaiting_authorization", originalInputVersions: [] });
    expect(first.attempts[0]).toMatchObject({
      status: "awaiting_authorization",
      disclosure: {
        provider: "openai-codex",
        model: "gpt-5.3-codex",
        purpose: "interactive_musicological_guidance",
        dataClasses: ["owner_intent"],
        sourceReferences: [],
        toolCapabilities: [],
        policyDecision: "allow",
      },
    });
    expect(() => service.create(workspaceId, { ...input, intent: "A different request" })).toThrow(
      /reused for different inputs/
    );
  });

  it("defaults every canonical record or source-content request to denied egress", () => {
    const source: ModelActionInputVersion = {
      recordType: "source_artifact",
      recordId: "source.1111111111111111",
      version: 1,
    };
    const action = service.create(workspaceId, {
      kind: "interactive_guidance_v1",
      intent: "Read the source",
      inputVersions: [source],
    });
    const attempt = action.attempts[0]!;
    expect(attempt.disclosure).toMatchObject({
      dataClasses: ["owner_intent", "canonical_workspace_record", "source_content"],
      policyDecision: "deny",
    });

    const denied = service.authorize(
      workspaceId,
      action.id,
      "authorize",
      attempt.disclosureDigest!
    );
    expect(denied.status).toBe("denied");
    expect(denied.attempts[0]!.egressEnvelope).toBeUndefined();
    expect(provider).not.toHaveBeenCalled();
  });

  it("publishes one validated provider result and Result Commit as an atomic unit", async () => {
    const action = service.create(workspaceId, {
      kind: "interactive_guidance_v1",
      intent: "Explain this cadence",
    });
    const authorized = service.authorize(
      workspaceId,
      action.id,
      "authorize",
      action.attempts[0]!.disclosureDigest!
    );
    const result = await service.run(
      workspaceId,
      action.id,
      authorized.attempts[0]!.envelopeDigest!
    );

    expect(result.action).toMatchObject({
      status: "completed",
      publicationReference: result.publication.id,
    });
    expect(result.publication.result.content).toBe("A bounded musicological answer.");
    expect(result.publication.commit).toMatchObject({
      actionId: action.id,
      attemptId: action.attempts[0]!.id,
      toolResultDigests: [],
    });
    expect(store.getModelActionPublicationForAction(workspaceId, action.id)).toEqual(
      result.publication
    );
    await expect(
      service.run(workspaceId, action.id, authorized.attempts[0]!.envelopeDigest!)
    ).rejects.toThrow(/not currently authorized/);
  });

  it("rejects forged disclosure and envelope digests before the provider is called", async () => {
    const action = service.create(workspaceId, {
      kind: "interactive_guidance_v1",
      intent: "Analyze",
    });
    expect(() => service.authorize(workspaceId, action.id, "authorize", "0".repeat(64))).toThrow(
      /digest mismatch/
    );
    const authorized = service.authorize(
      workspaceId,
      action.id,
      "authorize",
      action.attempts[0]!.disclosureDigest!
    );
    await expect(service.run(workspaceId, action.id, "f".repeat(64))).rejects.toThrow(
      /not currently authorized/
    );
    expect(provider).not.toHaveBeenCalled();
    expect(authorized.status).toBe("authorized");
  });

  it("withdraws authorization without publishing even when a provider response is in flight", async () => {
    let release!: () => void;
    provider.mockImplementation(
      (envelope, envelopeDigest) =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              envelopeDigest,
              provider: envelope.provider,
              model: envelope.model,
              providerResponseId: "provider-response.late",
              content: "Too late",
            });
        })
    );
    const action = service.create(workspaceId, {
      kind: "interactive_guidance_v1",
      intent: "Analyze",
    });
    const authorized = service.authorize(
      workspaceId,
      action.id,
      "authorize",
      action.attempts[0]!.disclosureDigest!
    );
    const pending = service.run(workspaceId, action.id, authorized.attempts[0]!.envelopeDigest!);
    service.authorize(workspaceId, action.id, "withdraw", action.attempts[0]!.disclosureDigest!);
    release();

    await expect(pending).rejects.toThrow(/authorization changed/);
    const withdrawn = store.getModelAction(workspaceId, action.id);
    expect(withdrawn.status).toBe("interrupted");
    expect(withdrawn.attempts[0]!.lastConfirmedBoundary).toMatch(/dispatch began/i);
    expect(withdrawn.attempts[0]!.lastConfirmedBoundary).not.toMatch(/no provider data sent/i);
    expect(() => store.getModelActionPublicationForAction(workspaceId, action.id)).toThrow(
      /not published/
    );
  });

  it("allows exactly one authorized-to-running provider claim", async () => {
    let release!: () => void;
    provider.mockImplementation(
      (envelope, envelopeDigest) =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              envelopeDigest,
              provider: envelope.provider,
              model: envelope.model,
              providerResponseId: "provider-response.single-claim",
              content: "One response",
            });
        })
    );
    const action = service.create(workspaceId, {
      kind: "interactive_guidance_v1",
      intent: "Analyze",
    });
    const authorized = service.authorize(
      workspaceId,
      action.id,
      "authorize",
      action.attempts[0]!.disclosureDigest!
    );
    const envelopeDigest = authorized.attempts[0]!.envelopeDigest!;

    const first = service.run(workspaceId, action.id, envelopeDigest);
    await expect(service.run(workspaceId, action.id, envelopeDigest)).rejects.toThrow(
      /not currently authorized/
    );
    expect(provider).toHaveBeenCalledTimes(1);
    release();
    await expect(first).resolves.toMatchObject({ action: { status: "completed" } });
  });

  it("propagates request cancellation and leaves no published result", async () => {
    provider.mockImplementation(
      (_envelope, _envelopeDigest, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Model Action request aborted", "AbortError")),
            { once: true }
          );
        })
    );
    const action = service.create(workspaceId, {
      kind: "interactive_guidance_v1",
      intent: "Analyze",
    });
    const authorized = service.authorize(
      workspaceId,
      action.id,
      "authorize",
      action.attempts[0]!.disclosureDigest!
    );
    const controller = new AbortController();
    const pending = service.run(
      workspaceId,
      action.id,
      authorized.attempts[0]!.envelopeDigest!,
      controller.signal
    );

    controller.abort();

    await expect(pending).rejects.toThrow(/aborted/i);
    expect(store.getModelAction(workspaceId, action.id).status).toBe("interrupted");
    expect(() => store.getModelActionPublicationForAction(workspaceId, action.id)).toThrow(
      /not published/i
    );
  });

  it("interrupts safely on a mismatched or secret-bearing provider response", async () => {
    provider.mockImplementation(async (envelope) => ({
      envelopeDigest: "0".repeat(64),
      provider: envelope.provider,
      model: envelope.model,
      providerResponseId: "provider-response.bad",
      content: "api_key=sk-secret-token",
    }));
    const action = service.create(workspaceId, {
      kind: "interactive_guidance_v1",
      intent: "Analyze",
    });
    const authorized = service.authorize(
      workspaceId,
      action.id,
      "authorize",
      action.attempts[0]!.disclosureDigest!
    );
    await expect(
      service.run(workspaceId, action.id, authorized.attempts[0]!.envelopeDigest!)
    ).rejects.toThrow(/does not match/);
    const interrupted = store.getModelAction(workspaceId, action.id);
    expect(interrupted.status).toBe("interrupted");
    expect(JSON.stringify(interrupted)).not.toContain("sk-secret-token");
    expect(() => store.getModelActionPublicationForAction(workspaceId, action.id)).toThrow(
      /not published/
    );
  });

  it("retries with a fresh disclosure and never reuses the old envelope", () => {
    const action = service.create(workspaceId, {
      kind: "interactive_guidance_v1",
      intent: "Analyze",
    });
    const authorized = service.authorize(
      workspaceId,
      action.id,
      "authorize",
      action.attempts[0]!.disclosureDigest!
    );
    service.interrupt(workspaceId, action.id, "Provider disconnected");
    const retried = service.retry(workspaceId, action.id);
    expect(retried).toMatchObject({ status: "awaiting_authorization" });
    expect(retried.attempts).toHaveLength(2);
    expect(retried.attempts[1]!.disclosureDigest).not.toBe(
      authorized.attempts[0]!.disclosureDigest
    );
    expect(retried.attempts[1]).not.toHaveProperty("egressEnvelope");
  });
});
