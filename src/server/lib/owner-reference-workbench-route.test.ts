import express, { type NextFunction, type Request, type Response } from "express";
import { createServer, type Server } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiResponse } from "../../lib/api-contract.js";
import type {
  OwnerReferenceWorkbenchLocalOperationReviewRequest,
  OwnerReferenceWorkbenchLocalOperationReviewResult,
  OwnerReferenceWorkbenchLocalStudyRequest,
  OwnerReferenceWorkbenchSnapshot,
  OwnerReferenceWorkbenchUploadConfirmationRequest,
  OwnerReferenceWorkbenchUploadConfirmationResult,
} from "../../lib/owner-reference-workbench-contract.js";
import { referenceSourceDigest } from "../../lib/reference-source-domain.js";
import {
  createOwnerReferenceWorkbenchLocalOperationReviewRoute,
  createOwnerReferenceWorkbenchLocalStudyRoute,
  createOwnerReferenceWorkbenchReadRoute,
  createOwnerReferenceWorkbenchUploadConfirmationRoute,
} from "./owner-reference-workbench-route.js";
import { OwnerReferenceWorkbenchIntegrityError } from "./owner-reference-workbench-service.js";
import {
  OwnerReferenceLocalStudyConflictError,
  OwnerReferenceLocalStudyStaleError,
  type OwnerReferenceLocalStudySink,
} from "./owner-reference-local-study-service.js";
import { ApiRouteError } from "./create-route.js";

describe("Owner-reference Workbench read route", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          })
      )
    );
    vi.restoreAllMocks();
  });

  it("serves the strictly decoded snapshot on GET and has no POST route", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const snapshot = emptySnapshot();
    const read = vi.fn(() => snapshot);
    const server = await workbenchServer({ read });
    servers.push(server);

    const getResponse = await fetch(`${serverUrl(server)}/api/owner/reference-workbench`);
    const getBody = (await getResponse.json()) as ApiResponse<OwnerReferenceWorkbenchSnapshot>;
    expect(getResponse.status).toBe(200);
    expect(getBody).toEqual({ ok: true, data: snapshot });
    expect(read).toHaveBeenCalledOnce();

    const postResponse = await fetch(`${serverUrl(server)}/api/owner/reference-workbench`, {
      method: "POST",
    });
    expect(postResponse.status).toBe(404);
    expect(read).toHaveBeenCalledOnce();
  });

  it("rejects an unknown response field without returning its canary", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const canary = "/private/Owner Library/unknown-field.pdf";
    const read = () =>
      ({ ...emptySnapshot(), privatePath: canary }) as unknown as OwnerReferenceWorkbenchSnapshot;
    const server = await workbenchServer({ read });
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/owner/reference-workbench`);
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).not.toContain(canary);
    const body = JSON.parse(text) as ApiResponse<unknown>;
    expect(body).toMatchObject({
      ok: false,
      error: { code: "internal_error", message: "Internal server error", status: 500 },
    });
  });

  it("translates projection-integrity failures without leaking private details", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const canary = "private-reference-id.canary";
    const read = (): OwnerReferenceWorkbenchSnapshot => {
      throw new OwnerReferenceWorkbenchIntegrityError(`Broken ${canary}`);
    };
    const server = await workbenchServer({ read });
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/owner/reference-workbench`);
    const text = await response.text();
    expect(response.status).toBe(422);
    expect(text).not.toContain(canary);
    const body = JSON.parse(text) as ApiResponse<unknown>;
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "unprocessable_content",
        message: "The Owner-reference Workbench snapshot is internally inconsistent",
        status: 422,
      },
    });
  });

  it("strictly reviews one opaque Workbench card without returning raw identity or purpose", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const rawCanary = "acquisition.private.raw-canary";
    const purposeCanary = "locally inspect the private Serdoura scan";
    const snapshot = emptySnapshot();
    const cardRef = opaqueRef("card");
    const reviewLocalOperation = vi.fn(
      async (
        _request: OwnerReferenceWorkbenchLocalOperationReviewRequest
      ): Promise<OwnerReferenceWorkbenchLocalOperationReviewResult> => ({
        schemaVersion: 1,
        operation: "local_extraction",
        status: "review_required",
        reasonCode: "owner_private_local_review_required",
      })
    );
    const server = await workbenchServer({
      read: () => snapshot,
      reviewLocalOperation,
    });
    servers.push(server);

    const response = await fetch(
      `${serverUrl(server)}/api/owner/reference-workbench/local-operation-review`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          snapshotRef: snapshot.snapshotRef,
          cardRef,
          operation: "local_extraction",
          purpose: purposeCanary,
        }),
      }
    );
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).not.toContain(rawCanary);
    expect(text).not.toContain(purposeCanary);
    expect(JSON.parse(text)).toEqual({
      ok: true,
      data: {
        schemaVersion: 1,
        operation: "local_extraction",
        status: "review_required",
        reasonCode: "owner_private_local_review_required",
      },
    });
    expect(reviewLocalOperation).toHaveBeenCalledWith({
      schemaVersion: 1,
      snapshotRef: snapshot.snapshotRef,
      cardRef,
      operation: "local_extraction",
      purpose: purposeCanary,
    });

    const injected = await fetch(
      `${serverUrl(server)}/api/owner/reference-workbench/local-operation-review`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          snapshotRef: snapshot.snapshotRef,
          cardRef,
          operation: "local_extraction",
          purpose: purposeCanary,
          acquisitionRef: { id: rawCanary, digest: "f".repeat(64) },
        }),
      }
    );
    const injectedText = await injected.text();
    expect(injected.status).toBe(400);
    expect(injectedText).not.toContain(rawCanary);
    expect(reviewLocalOperation).toHaveBeenCalledOnce();
  });

  it("confirms an upload retry key without echoing the key or accepting injected identity", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const acquisitionKey = `owner-upload.v2.${"A".repeat(43)}`;
    const result: OwnerReferenceWorkbenchUploadConfirmationResult = {
      schemaVersion: 1,
      status: "present",
      snapshotRef: opaqueRef("snapshot"),
      cardRef: opaqueRef("card"),
    };
    const confirmUpload = vi.fn(
      (_request: OwnerReferenceWorkbenchUploadConfirmationRequest) => result
    );
    const server = await workbenchServer({
      read: emptySnapshot,
      confirmUpload,
    });
    servers.push(server);

    const response = await fetch(
      `${serverUrl(server)}/api/owner/reference-workbench/upload-confirmation`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schemaVersion: 1, acquisitionKey }),
      }
    );
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).not.toContain(acquisitionKey);
    expect(JSON.parse(text)).toEqual({ ok: true, data: result });
    expect(confirmUpload).toHaveBeenCalledWith({ schemaVersion: 1, acquisitionKey });

    const injected = await fetch(
      `${serverUrl(server)}/api/owner/reference-workbench/upload-confirmation`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          acquisitionKey,
          acquisitionRef: { id: "raw.private", digest: "f".repeat(64) },
        }),
      }
    );
    expect(injected.status).toBe(400);
    expect(confirmUpload).toHaveBeenCalledOnce();
  });

  it("streams only authorized PDF bytes with private no-cache headers and no identity metadata", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const bytes = Buffer.from("%PDF-1.7\nowner-private route fixture\n%%EOF");
    const snapshotRef = opaqueRef("snapshot-local-study");
    const cardRef = opaqueRef("card-local-study");
    const operationKey = `owner-local-study.v1.${"A".repeat(22)}`;
    const rawCanary = "/private/Owner Library/private-source-name.pdf";
    const executeLocalStudy = vi.fn(
      async (
        request: OwnerReferenceWorkbenchLocalStudyRequest,
        sink: OwnerReferenceLocalStudySink
      ) => {
        expect(request.operationKey).toBe(operationKey);
        await sink({ bytes, mediaType: "application/pdf" });
        return {
          status: "executed" as const,
          replayed: false,
          rightsAssertionRef: { id: "rights.internal", digest: "a".repeat(64) },
          accessDecisionRef: { id: "decision.internal", digest: "b".repeat(64) },
        };
      }
    );
    const server = await workbenchServer({
      read: emptySnapshot,
      executeLocalStudy,
    });
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/owner/reference-workbench/local-study`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaVersion: 1,
        snapshotRef,
        cardRef,
        operation: "owner_private_study",
        purpose: "Read the exact source privately",
        authorization: "owner_attested_local_study",
        operationKey,
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(response.headers.get("etag")).toBeNull();
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    const serializedHeaders = JSON.stringify(Object.fromEntries(response.headers));
    expect(serializedHeaders).not.toContain(operationKey);
    expect(serializedHeaders).not.toContain(rawCanary);
    expect(serializedHeaders).not.toContain("rights.internal");
    expect(serializedHeaders).not.toContain("decision.internal");

    const injected = await fetch(`${serverUrl(server)}/api/owner/reference-workbench/local-study`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaVersion: 1,
        snapshotRef,
        cardRef,
        operation: "owner_private_study",
        purpose: "Read the exact source privately",
        authorization: "owner_attested_local_study",
        operationKey,
        acquisitionRef: { id: rawCanary, digest: "f".repeat(64) },
      }),
    });
    expect(injected.status).toBe(400);
    expect(await injected.text()).not.toContain(rawCanary);
    expect(executeLocalStudy).toHaveBeenCalledOnce();
  });

  it.each([
    {
      name: "operation-key scope conflict",
      error: new OwnerReferenceLocalStudyConflictError(),
      details: {
        reason: "operation_key_bound_to_different_scope",
        retrySafety: "reuse_exact_request",
      },
    },
    {
      name: "verified stale first request",
      error: new OwnerReferenceLocalStudyStaleError(),
      details: {
        reason: "workbench_snapshot_stale_before_commit",
        retrySafety: "refresh_and_rebind_same_operation_key",
      },
    },
  ])("returns a bounded machine-actionable 409 for $name", async ({ error, details }) => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const operationKey = `owner-local-study.v1.${"A".repeat(22)}`;
    const privateCanary = "/private/Owner Library/do-not-leak.pdf";
    const executeLocalStudy = vi.fn(async () => {
      throw error;
    });
    const server = await workbenchServer({ read: emptySnapshot, executeLocalStudy });
    servers.push(server);

    const response = await fetch(`${serverUrl(server)}/api/owner/reference-workbench/local-study`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaVersion: 1,
        snapshotRef: opaqueRef("snapshot-local-study-conflict"),
        cardRef: opaqueRef("card-local-study-conflict"),
        operation: "owner_private_study",
        purpose: `Read ${privateCanary} locally`,
        authorization: "owner_attested_local_study",
        operationKey,
      }),
    });
    const text = await response.text();
    const body = JSON.parse(text) as { error: Record<string, unknown> };

    expect(response.status).toBe(409);
    expect(body.error).toMatchObject({ code: "conflict", status: 409, details });
    expect(Object.keys(body.error.details as object).sort()).toEqual(["reason", "retrySafety"]);
    expect(text).not.toContain(operationKey);
    expect(text).not.toContain(privateCanary);
    expect(text).not.toMatch(/[a-f0-9]{64}/);
  });
});

function emptySnapshot(): OwnerReferenceWorkbenchSnapshot {
  const digest = referenceSourceDigest({ fixture: "owner-reference-workbench-route" });
  return {
    schemaVersion: 1,
    snapshotRef: { id: `owner-reference-snapshot.${digest.slice(0, 24)}`, digest },
    references: [],
  };
}

async function workbenchServer(service: {
  read: () => OwnerReferenceWorkbenchSnapshot;
  reviewLocalOperation?: (
    request: OwnerReferenceWorkbenchLocalOperationReviewRequest
  ) => Promise<OwnerReferenceWorkbenchLocalOperationReviewResult>;
  confirmUpload?: (
    request: OwnerReferenceWorkbenchUploadConfirmationRequest
  ) => OwnerReferenceWorkbenchUploadConfirmationResult;
  executeLocalStudy?: (
    request: OwnerReferenceWorkbenchLocalStudyRequest,
    sink: OwnerReferenceLocalStudySink
  ) => Promise<{
    status: "executed";
    replayed: boolean;
    rightsAssertionRef: { id: string; digest: string };
    accessDecisionRef: { id: string; digest: string };
  }>;
}): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.get("/api/owner/reference-workbench", createOwnerReferenceWorkbenchReadRoute(service));
  if (service.confirmUpload) {
    app.post(
      "/api/owner/reference-workbench/upload-confirmation",
      createOwnerReferenceWorkbenchUploadConfirmationRoute({
        confirmUpload: service.confirmUpload,
      })
    );
  }
  if (service.reviewLocalOperation) {
    app.post(
      "/api/owner/reference-workbench/local-operation-review",
      createOwnerReferenceWorkbenchLocalOperationReviewRoute({
        reviewLocalOperation: service.reviewLocalOperation,
      })
    );
  }
  if (service.executeLocalStudy) {
    app.post(
      "/api/owner/reference-workbench/local-study",
      createOwnerReferenceWorkbenchLocalStudyRoute({
        executeLocalStudy: service.executeLocalStudy,
      })
    );
  }
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const routeError =
      error instanceof ApiRouteError
        ? error
        : new ApiRouteError("Internal server error", 500, "internal_error");
    response.status(routeError.status).json({
      ok: false,
      error: {
        code: routeError.code,
        message: routeError.message,
        status: routeError.status,
        correlationId: "test-correlation",
        ...(routeError.details ? { details: routeError.details } : {}),
      },
    });
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function opaqueRef(kind: string) {
  const digest = referenceSourceDigest({ fixture: `owner-reference-workbench-${kind}` });
  return { id: `owner-reference-${kind}.${digest.slice(0, 24)}`, digest };
}

function serverUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP server address");
  return `http://127.0.0.1:${address.port}`;
}
