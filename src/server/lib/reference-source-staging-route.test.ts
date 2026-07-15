import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiErrorCode, ApiResponse } from "../../lib/api-contract.js";
import {
  withReferenceRecordDigest,
  type ReferenceRecordRef,
  type ReferenceSourceStagingInputRecord,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import { createApp } from "../index.js";
import {
  ReferenceSourceStagingService,
  type ReferenceSourceStagingDiagnostics,
} from "./reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "./reference-source-staging-store.js";

const NOW = "2026-07-15T12:00:00.000Z";
const LATER = "2026-07-15T12:05:00.000Z";
const ROUTE = "/api/owner/reference-source-staging";

describe("reference-source staging HTTP boundary", () => {
  let rootDirectory: string;
  let servers: Server[];

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-reference-staging-http-"));
    servers = [];
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
    vi.restoreAllMocks();
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("commits, reads history, and reloads the persisted staging generation over real HTTP", async () => {
    const graph = buildCompactGraph();
    const firstServer = await startServer(rootDirectory, servers);
    const firstBaseUrl = serverUrl(firstServer);

    const first = await expectSuccess<ReferenceSourceStagingDiagnostics>(
      await request(firstBaseUrl, `${ROUTE}/transactions`, {
        method: "POST",
        body: transaction("first", graph.records, undefined, NOW),
      })
    );
    expect(first.publicationState).toBe("staging_only");
    expect(first.capabilities).toEqual({
      stagingTransactions: true,
      canonicalPublication: false,
    });
    expect(first.snapshot?.records).toEqual(graph.records);
    expectCoherentCurrent(first);

    const currentAfterFirst = await expectSuccess<ReferenceSourceStagingDiagnostics>(
      await request(firstBaseUrl, ROUTE)
    );
    expect(currentAfterFirst).toEqual(first);

    const secondRecord = record({
      recordKind: "evaluation_source_binding_commitment",
      id: "evaluation-binding-commitment.second-generation",
      evaluationContext: {
        kind: "vault_commitment",
        algorithm: "hmac-sha256",
        keyId: "development-vault-key",
        commitment: "f".repeat(64),
      },
      createdAt: LATER,
    });
    const second = await expectSuccess<ReferenceSourceStagingDiagnostics>(
      await request(firstBaseUrl, `${ROUTE}/transactions`, {
        method: "POST",
        body: transaction("second", [secondRecord], headRef(first), LATER),
      })
    );
    expect(second.snapshot?.revision).toBe(2);
    expect(second.snapshot?.records).toEqual([...graph.records, secondRecord]);
    expectCoherentCurrent(second);

    const historical = await expectSuccess<ReferenceSourceStagingDiagnostics>(
      await request(firstBaseUrl, `${ROUTE}/snapshots/${first.snapshot!.id}`)
    );
    expect(historical.snapshot).toEqual(first.snapshot);
    expect(historical.head).toEqual(second.head);
    expect(historical.view).toEqual({
      kind: "historical",
      viewedSnapshotRef: {
        id: first.snapshot!.id,
        digest: first.snapshot!.digest,
      },
    });

    await stopServer(firstServer, servers);
    const restartedServer = await startServer(rootDirectory, servers);
    const reloaded = await expectSuccess<ReferenceSourceStagingDiagnostics>(
      await request(serverUrl(restartedServer), ROUTE)
    );
    expect(reloaded).toEqual(second);
    expectCoherentCurrent(reloaded);
  });

  it("fails closed for malformed, conflicting, invalid, and forbidden HTTP operations", async () => {
    const graph = buildCompactGraph();
    const server = await startServer(rootDirectory, servers);
    const baseUrl = serverUrl(server);
    const first = await expectSuccess<ReferenceSourceStagingDiagnostics>(
      await request(baseUrl, `${ROUTE}/transactions`, {
        method: "POST",
        body: transaction("seed", graph.records, undefined, NOW),
      })
    );

    const malformed = {
      ...transaction(
        "malformed",
        [
          record({
            recordKind: "digital_asset",
            id: "asset.bad",
            sha256: "b".repeat(64),
            mediaType: "application/pdf",
            byteLength: 1,
          }),
        ],
        headRef(first),
        LATER
      ),
      ambientCapability: "canonical_publish",
    };
    await expectFailure(
      await request(baseUrl, `${ROUTE}/transactions`, { method: "POST", body: malformed }),
      400,
      "invalid_request"
    );

    const secondRecord = record({
      recordKind: "digital_asset",
      id: "asset.second-generation",
      sha256: "c".repeat(64),
      mediaType: "application/pdf",
      byteLength: 2,
    });
    const second = await expectSuccess<ReferenceSourceStagingDiagnostics>(
      await request(baseUrl, `${ROUTE}/transactions`, {
        method: "POST",
        body: transaction("advance-head", [secondRecord], headRef(first), LATER),
      })
    );

    const staleRecord = record({
      recordKind: "digital_asset",
      id: "asset.stale-writer",
      sha256: "d".repeat(64),
      mediaType: "application/pdf",
      byteLength: 3,
    });
    const conflict = await expectFailure(
      await request(baseUrl, `${ROUTE}/transactions`, {
        method: "POST",
        body: transaction("stale", [staleRecord], headRef(first), LATER),
      }),
      409,
      "conflict",
      true
    );
    expect(conflict.error.details).toEqual({ currentHead: second.head });

    const danglingManifestation = record({
      recordKind: "source_manifestation",
      id: "manifestation.dangling-work",
      version: 1,
      manifestationKind: "edition",
      workRelations: [{ workRef: externalRef("work.missing"), role: "edition_of" }],
      parentRelations: [],
      languages: ["en"],
      editorIdentityRefs: [],
      translatorIdentityRefs: [],
      declaredChanges: [],
      identityAssertionRefs: [],
      identityState: "candidate",
    });
    await expectFailure(
      await request(baseUrl, `${ROUTE}/transactions`, {
        method: "POST",
        body: transaction("dangling", [danglingManifestation], headRef(second), LATER),
      }),
      422,
      "unprocessable_content"
    );

    for (const operation of ["publish", "migrate", "canonicalize", "activate"]) {
      await expectFailure(
        await request(baseUrl, `${ROUTE}/${operation}`, { method: "POST", body: {} }),
        404,
        "not_found"
      );
    }

    const unchanged = await expectSuccess<ReferenceSourceStagingDiagnostics>(
      await request(baseUrl, ROUTE)
    );
    expect(unchanged).toEqual(second);
  });
});

function buildCompactGraph() {
  const work = record({
    recordKind: "work",
    id: "work.http-fixture",
    version: 1,
    preferredTitle: "HTTP integration fixture",
    creatorIdentityRefs: [],
    identityAssertionRefs: [],
    identityState: "candidate",
  });
  const manifestation = record({
    recordKind: "source_manifestation",
    id: "manifestation.http-fixture-edition",
    version: 1,
    manifestationKind: "edition",
    workRelations: [{ workRef: ref(work), role: "edition_of" }],
    parentRelations: [],
    publicationStatement: "Rights-approved synthetic development fixture",
    languages: ["en"],
    editorIdentityRefs: [],
    translatorIdentityRefs: [],
    declaredChanges: [],
    identityAssertionRefs: [],
    identityState: "candidate",
  });
  const exemplar = record({
    recordKind: "exemplar",
    id: "exemplar.http-fixture-copy",
    version: 1,
    manifestationRefs: [ref(manifestation)],
    holdingInstitution: "Vellum test fixtures",
    shelfmark: "HTTP-DEV-1",
    completeness: "complete",
    exemplarNotes: ["Synthetic fixture"],
    identityAssertionRefs: [],
    identityState: "candidate",
  });
  const asset = record({
    recordKind: "digital_asset",
    id: "asset.http-fixture-pdf",
    sha256: "a".repeat(64),
    mediaType: "application/pdf",
    byteLength: 128,
  });
  const acquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.http-fixture-upload",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [ref(exemplar)],
    origin: {
      sourceKind: "upload",
      ownerActionRef: externalRef("owner-action.http-fixture-upload"),
    },
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.local-reference"),
  });
  const rights = record({
    recordKind: "rights_assertion",
    id: "rights.http-fixture-private-study",
    version: 1,
    subjectRef: ref(acquisition),
    subjectKind: "asset_acquisition",
    rightsKind: "owner_private_access",
    status: "permitted",
    claimant: { kind: "owner", claimantRef: externalRef("owner.local") },
    evidenceRefs: [externalRef("evidence.owner-upload-attestation")],
    assertedAt: NOW,
  });
  const access = record({
    recordKind: "access_decision",
    id: "access.http-fixture-owner-reference",
    version: 1,
    outcome: "allow",
    operation: "owner_private_study",
    sourceRefs: [ref(acquisition)],
    derivativeRefs: [],
    destination: { kind: "local_runtime" },
    purpose: "Bind source to Owner Reference Library",
    assetRole: "owner_reference",
    policyRef: externalRef("access-policy.owner-reference"),
    rightsAssertionRefs: [ref(rights)],
    authorityRefs: [externalRef("owner.local")],
    rationale: "The exact uploaded acquisition is approved for local reference use",
    decidedAt: NOW,
  });
  const binding = record({
    recordKind: "owner_reference_binding",
    id: "binding.http-fixture-owner-reference",
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(acquisition)],
    accessDecisionRefs: [ref(access)],
    retentionPolicyRef: externalRef("retention-policy.owner-library"),
    ownerLibraryRef: externalRef("owner-library.local"),
    createdAt: NOW,
  });

  return {
    records: [work, manifestation, exemplar, asset, acquisition, rights, access, binding],
  };
}

function record(value: Record<string, unknown>): ReferenceSourceStagingInputRecord {
  return withReferenceRecordDigest(value) as unknown as ReferenceSourceStagingInputRecord;
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: withReferenceRecordDigest({ id }).digest };
}

function transaction(
  id: string,
  records: ReferenceSourceStagingInputRecord[],
  expectedHeadRef?: ReferenceRecordRef,
  submittedAt = NOW
): ReferenceSourceStagingTransaction {
  return {
    schemaVersion: 1,
    id: `transaction.${id}`,
    ...(expectedHeadRef ? { expectedHeadRef } : {}),
    operations: records.map((recordValue) => ({ type: "append_record", record: recordValue })),
    submittedAt,
  };
}

function headRef(diagnostics: ReferenceSourceStagingDiagnostics): ReferenceRecordRef {
  if (!diagnostics.head) throw new Error("Expected a staging head");
  return { id: diagnostics.head.snapshotId, digest: diagnostics.head.digest };
}

function expectCoherentCurrent(diagnostics: ReferenceSourceStagingDiagnostics): void {
  if (!diagnostics.head || !diagnostics.snapshot) {
    throw new Error("Expected a current staging generation");
  }
  expect(diagnostics.head).toEqual({
    snapshotId: diagnostics.snapshot.id,
    digest: diagnostics.snapshot.digest,
    revision: diagnostics.snapshot.revision,
  });
  expect(diagnostics.view).toEqual({ kind: "current" });
}

async function startServer(rootDirectory: string, servers: Server[]): Promise<Server> {
  const service = new ReferenceSourceStagingService({
    store: new ReferenceSourceStagingStore({ rootDirectory }),
    now: () => new Date(NOW),
  });
  const server = createServer(createApp({ referenceSourceStagingService: service }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return server;
}

async function stopServer(server: Server, servers: Server[]): Promise<void> {
  servers.splice(servers.indexOf(server), 1);
  await closeServer(server);
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function serverUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP server address");
  return `http://127.0.0.1:${address.port}`;
}

async function request(
  baseUrl: string,
  route: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<{ response: Response; body: ApiResponse<unknown> }> {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method ?? "GET",
    ...(options.body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options.body),
        }),
  });
  return { response, body: (await response.json()) as ApiResponse<unknown> };
}

async function expectSuccess<T>(result: {
  response: Response;
  body: ApiResponse<unknown>;
}): Promise<T> {
  expect(result.response.status).toBe(200);
  expect(Object.keys(result.body).sort()).toEqual(["data", "ok"]);
  expect(result.body.ok).toBe(true);
  if (!result.body.ok) throw new Error(`Expected success, received ${result.body.error.code}`);
  return result.body.data as T;
}

async function expectFailure(
  result: { response: Response; body: ApiResponse<unknown> },
  status: number,
  code: ApiErrorCode,
  expectDetails = false
) {
  expect(result.response.status).toBe(status);
  expect(Object.keys(result.body).sort()).toEqual(["error", "ok"]);
  expect(result.body.ok).toBe(false);
  if (result.body.ok) throw new Error("Expected an API failure");
  expect(Object.keys(result.body.error).sort()).toEqual(
    ["code", "correlationId", ...(expectDetails ? ["details"] : []), "message", "status"].sort()
  );
  expect(result.body.error).toMatchObject({ code, status });
  expect(result.body.error.correlationId).toBe(
    result.response.headers.get("x-vellum-correlation-id")
  );
  expect(result.body.error.message).not.toMatch(/stack|\/Users\/|reference-source-staging-http-/i);
  return result.body;
}
