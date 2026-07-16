import { createServer, type Server } from "node:http";

import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiResponse } from "../../lib/api-contract.js";
import type {
  TypedKnowledgeReleaseOperationRequest,
  TypedKnowledgeReleaseProjection,
} from "../../lib/typed-knowledge-release-contract.js";
import { ApiRouteError } from "./create-route.js";
import { createTypedKnowledgeReleaseRoute } from "./typed-knowledge-release-route.js";

describe("typed knowledge release route", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          })
      )
    );
    vi.restoreAllMocks();
  });

  it("accepts only the closed preview operation and decodes the closed projection", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const executeTypedKnowledgeRelease = vi.fn(
      async (_request: TypedKnowledgeReleaseOperationRequest, signal?: AbortSignal) => {
        expect(signal?.aborted).toBe(false);
        return projection("candidate");
      }
    );
    const server = await listen(createTypedKnowledgeReleaseRoute({ executeTypedKnowledgeRelease }));
    servers.push(server);

    const response = await post(server, previewRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: projection("candidate") });
    expect(executeTypedKnowledgeRelease).toHaveBeenCalledOnce();

    const invalid = await post(server, { ...previewRequest(), authority: "self_asserted" });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      ok: false,
      error: { code: "invalid_request", status: 400 },
    });
    expect(executeTypedKnowledgeRelease).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "typed_knowledge_release_stale",
      409,
      "conflict",
      "Refresh the exact Page Atlas candidate before previewing or publishing",
    ],
    [
      "typed_knowledge_release_pack_citation_authority_required",
      403,
      "forbidden",
      "Separate pack-citation authority is required before publication",
    ],
    [
      "typed_knowledge_release_conflict",
      409,
      "conflict",
      "Refresh the exact publication head before retrying",
    ],
    [
      "typed_knowledge_release_cancelled",
      409,
      "cancelled",
      "The typed knowledge release operation was cancelled before publication",
    ],
    [
      "typed_knowledge_release_unavailable",
      503,
      "service_unavailable",
      "The typed knowledge release service is safely unavailable",
    ],
    [
      "typed_knowledge_release_integrity",
      503,
      "service_unavailable",
      "The typed knowledge release service is safely unavailable",
    ],
  ] as const)("normalizes %s without prose matching", async (reason, status, code, message) => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const privateDiagnostic = "/Owner/private/Mace.pdf SECRET";
    const server = await listen(
      createTypedKnowledgeReleaseRoute({
        executeTypedKnowledgeRelease: async () => {
          throw Object.assign(new Error(privateDiagnostic), { code: reason });
        },
      })
    );
    servers.push(server);

    const response = await post(server, previewRequest());
    const body = (await response.json()) as ApiResponse<unknown>;
    expect(response.status).toBe(status);
    expect(body).toMatchObject({
      ok: false,
      error: { code, message, status, details: { reason } },
    });
    expect(JSON.stringify(body)).not.toContain(privateDiagnostic);
    if (reason === "typed_knowledge_release_pack_citation_authority_required") {
      expect(body).not.toMatchObject({ error: { code: "forbidden_origin" } });
    }
  });

  it("fails closed when an operator returns an open or malformed projection", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const server = await listen(
      createTypedKnowledgeReleaseRoute({
        executeTypedKnowledgeRelease: async () => ({
          ...projection("candidate"),
          privateSourcePath: "/Owner/private/Mace.pdf",
        }),
      })
    );
    servers.push(server);

    const response = await post(server, previewRequest());
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      error: { code: "internal_error", message: "Internal server error", status: 500 },
    });
    expect(JSON.stringify(body)).not.toContain("/Owner/private/Mace.pdf");
  });

  it("does not pass internal ApiRouteError prose or details through the typed boundary", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const privateDiagnostic = "/Owner/private/Mace.pdf SECRET-AUTHORITY";
    const server = await listen(
      createTypedKnowledgeReleaseRoute({
        executeTypedKnowledgeRelease: async () => {
          throw new ApiRouteError(privateDiagnostic, 409, "conflict", {
            privateSourcePath: privateDiagnostic,
          });
        },
      })
    );
    servers.push(server);

    const response = await post(server, previewRequest());
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      error: { code: "internal_error", message: "Internal server error", status: 500 },
    });
    expect(JSON.stringify(body)).not.toContain(privateDiagnostic);
    expect(JSON.stringify(body)).not.toContain("privateSourcePath");
  });

  it("rejects a schema-valid projection outcome for the wrong operation", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const server = await listen(
      createTypedKnowledgeReleaseRoute({
        executeTypedKnowledgeRelease: async () => projection("published", "publish_committed"),
      })
    );
    servers.push(server);

    const response = await post(server, previewRequest());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "internal_error", message: "Internal server error", status: 500 },
    });
  });

  it("rejects a semantically incoherent projection at the discriminated schema boundary", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const server = await listen(
      createTypedKnowledgeReleaseRoute({
        executeTypedKnowledgeRelease: async () =>
          ({
            ...projection("candidate"),
            packCitationAuthority: "verified_for_publication",
          }) as unknown as TypedKnowledgeReleaseProjection,
      })
    );
    servers.push(server);

    const response = await post(server, previewRequest());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "internal_error", message: "Internal server error", status: 500 },
    });
  });

  it("aborts the narrow operator when the HTTP response is dropped", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const observed: AbortSignal[] = [];
    const server = await listen(
      createTypedKnowledgeReleaseRoute({
        executeTypedKnowledgeRelease: (_request, signal) =>
          new Promise<TypedKnowledgeReleaseProjection>((_resolve, reject) => {
            if (!signal) return reject(new Error("Missing abort signal"));
            observed.push(signal);
            signal.addEventListener("abort", () => reject(new Error("cancelled")), {
              once: true,
            });
          }),
      })
    );
    servers.push(server);
    const controller = new AbortController();
    const request = post(server, previewRequest(), controller.signal).catch(() => undefined);
    await expect.poll(() => observed.length).toBe(1);
    controller.abort();
    await request;
    await expect.poll(() => observed[0]?.aborted).toBe(true);
  });
});

async function listen(handler: express.RequestHandler): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.post("/api/owner/reference-source-workbench/typed-knowledge-release", handler);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function post(server: Server, body: unknown, signal?: AbortSignal): Promise<Response> {
  return fetch(
    `${serverUrl(server)}/api/owner/reference-source-workbench/typed-knowledge-release`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    }
  );
}

function previewRequest(): TypedKnowledgeReleaseOperationRequest {
  return { schemaVersion: 1, action: "preview", selection: selection() };
}

function projection(
  state: "candidate" | "published",
  publishedOutcome:
    | "preview_existing"
    | "publish_committed"
    | "publish_idempotent" = "preview_existing"
): TypedKnowledgeReleaseProjection {
  const draftRef = knowledgeRef("pack.mace.draft.v1", "1");
  const shared = {
    schemaVersion: 1,
    selection: selection(),
    candidate: {
      mappingCandidateRef: knowledgeRef("candidate.mace.mapping.v1", "3"),
      course13QuestionCandidateRef: knowledgeRef("candidate.mace.course13.v1", "4"),
      authorityLane: "historical_practice",
      activationAllowed: false,
    },
    draft: {
      draftRef,
      contentMerkleRoot: "5".repeat(64),
      closureMerkleRoot: "6".repeat(64),
    },
    release: {
      releaseRef: knowledgeRef("pack.mace.release.v1", "7"),
      sequence: 1,
      sourceDraftRef: draftRef,
      contentMerkleRoot: "5".repeat(64),
      merkleRoot: "6".repeat(64),
      predecessorReleaseRef: null,
      successorState: "initial",
    },
    ordinaryActivation: { state: "not_evaluated", defaultActivation: "deny" },
  } as const;
  if (state === "candidate") {
    return {
      ...shared,
      publicationState: "candidate",
      publicationOutcome: "preview_candidate",
      publicationHead: null,
      publicationCapability: { state: "configured", authorityCheck: "required_on_publish" },
      packCitationAuthority: "not_evaluated",
      testAttestation: { state: "not_issued" },
    };
  }
  return {
    ...shared,
    publicationState: "published",
    publicationOutcome: publishedOutcome,
    publicationHead: {
      id: "publication-generation.mace.v1",
      digest: "2".repeat(64),
      revision: 1,
    },
    publicationCapability: { state: "configured", authorityCheck: "required_on_publish" },
    packCitationAuthority: "verified_for_publication",
    testAttestation: {
      state: "issued_test_only",
      attestationRef: knowledgeRef("attestation.mace.test.v1", "8"),
      testPolicyRef: knowledgeRef("policy.test-only.v1", "9"),
      humanAuthority: false,
      historicalAuthority: false,
      activationAuthority: false,
    },
  };
}

function selection() {
  return {
    workbenchSnapshotRef: opaqueRef("snapshot", "a"),
    workbenchCardRef: opaqueRef("card", "b"),
    operationRef: opaqueRef("operation", "c"),
    expectedProjectionRef: opaqueRef("projection", "d"),
    candidateRef: opaqueRef("candidate", "e"),
  };
}

function opaqueRef(label: string, digestCharacter: string) {
  return { id: `owner-reference-${label}`, digest: digestCharacter.repeat(64) };
}

function knowledgeRef(id: string, digestCharacter: string) {
  return { id, digest: digestCharacter.repeat(64) };
}

function serverUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
  return `http://127.0.0.1:${address.port}`;
}
