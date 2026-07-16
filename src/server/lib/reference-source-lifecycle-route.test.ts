// @vitest-environment jsdom

import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { Value } from "@sinclair/typebox/value";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiErrorCode, ApiResponse } from "../../lib/api-contract.js";
import { renderReferenceSourceLifecycleDryRun } from "../../reference-source-staging-diagnostics.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceRecordRef,
  type ReferenceSourceStagingRecord,
  type ReferenceSourceStagingSnapshot,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceLifecyclePlanResultSchema,
  type ReferenceSourceLifecyclePlanResult,
} from "../../lib/reference-source-lifecycle.js";
import { createApp } from "../index.js";
import { KnowledgePublicationStore } from "./knowledge-publication-store.js";
import { ReferenceSourceStagingStore } from "./reference-source-staging-store.js";
import { ReferenceSourceStagingService } from "./reference-source-staging-service.js";
import { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import type { ReferenceSourceControlledStoreInventoryAdapter } from "./reference-source-inventory-provider.js";
import {
  TEST_REFERENCE_AUTHORITY_TRUST,
  TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
  createTestReferenceSourceLifecycleEvidenceProvider,
} from "../test-support/reference-source-lifecycle-evidence.js";

const RECORDED_AT = "2026-07-15T12:00:00.000Z";
const ROUTE = "/api/owner/reference-source-staging/lifecycle";

describe("reference-source lifecycle HTTP boundary", () => {
  let rootDirectory: string;
  let servers: Server[];

  beforeEach(() => {
    rootDirectory = mkdtempSync(path.join(tmpdir(), "vellum-reference-lifecycle-http-"));
    servers = [];
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
    vi.restoreAllMocks();
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it("returns a sealed dry-run plan from the shared staging store without mutating it", async () => {
    const harness = createHarness(rootDirectory);
    const graph = lifecycleGraph();
    const committed = harness.staging.applyTransaction(transaction("base", graph.records));
    const controlledStore = new ReferenceSourceControlledArtifactStore({
      rootDirectory: path.join(rootDirectory, "controlled-artifacts"),
    });
    controlledStore.put({
      artifactRef: ref(graph.asset),
      sha256: graph.asset.sha256,
      byteLength: graph.asset.byteLength,
      bytes: graph.bytes,
    });
    const stateBefore = harness.store.readCurrentState();
    const diskBefore = snapshotDirectory(rootDirectory);
    const server = await startServer(harness.staging, servers, [controlledStore]);

    const plan = await expectSuccess<ReferenceSourceLifecyclePlanResult>(
      await request(serverUrl(server), `${ROUTE}/plan`, {
        method: "POST",
        body: {
          schemaVersion: 1,
          expectedHeadRef: headRef(committed),
          action: {
            kind: "delete_acquisition",
            targetAcquisitionRef: ref(graph.acquisition),
            reason: "Owner requested a rights-safe lifecycle dry run",
          },
        },
      })
    );

    expect(Value.Check(ReferenceSourceLifecyclePlanResultSchema, plan)).toBe(true);
    expect(plan).toMatchObject({
      mode: "dry_run",
      status: "ready",
      atomicity: "all_or_nothing",
      baseSnapshotRef: headRef(committed),
      action: {
        kind: "delete_acquisition",
        targetAcquisitionRef: ref(graph.acquisition),
      },
    });
    expectPlanSeal(plan);
    expect(harness.store.readCurrentState()).toEqual(stateBefore);
    expect(snapshotDirectory(rootDirectory)).toEqual(diskBefore);

    const container = document.createElement("div");
    const panel = renderReferenceSourceLifecycleDryRun(
      container,
      harness.staging.readCurrent(),
      async (submitted) => {
        expect(submitted).toEqual({
          schemaVersion: 1,
          expectedHeadRef: headRef(committed),
          action: plan.action,
        });
        return plan;
      }
    );
    expect(panel).not.toBeNull();
    panel!.querySelector<HTMLTextAreaElement>("textarea[name=lifecycleReason]")!.value =
      plan.action.reason;
    panel!
      .querySelector<HTMLFormElement>("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(panel!.textContent).toContain("Sealed dry-run plan · Ready"));
    expect(panel!.textContent).toContain("staging-controlled store only");
    expect(panel!.textContent).toContain(
      "Legacy Workspace and Owner Reference copies are unchanged"
    );
  });

  it("blocks production planning when staged metadata has no exact persisted bytes", async () => {
    const harness = createHarness(rootDirectory);
    const graph = lifecycleGraph();
    const committed = harness.staging.applyTransaction(transaction("base", graph.records));
    const emptyControlledStore = new ReferenceSourceControlledArtifactStore({
      rootDirectory: path.join(rootDirectory, "empty-controlled-artifacts"),
    });
    const server = await startServer(harness.staging, servers, [emptyControlledStore]);

    const plan = await expectSuccess<ReferenceSourceLifecyclePlanResult>(
      await request(serverUrl(server), `${ROUTE}/plan`, {
        method: "POST",
        body: {
          schemaVersion: 1,
          expectedHeadRef: headRef(committed),
          action: {
            kind: "delete_acquisition",
            targetAcquisitionRef: ref(graph.acquisition),
            reason: "Refuse to plan over metadata-only storage",
          },
        },
      })
    );

    expect(plan).toMatchObject({
      status: "blocked",
      issues: [expect.objectContaining({ code: "incomplete_controlled_store_inventory" })],
    });
    expectPlanSeal(plan);
  });

  it("returns closed 400 and 409 envelopes and exposes no lifecycle mutation route", async () => {
    const harness = createHarness(rootDirectory);
    const graph = lifecycleGraph();
    const committed = harness.staging.applyTransaction(transaction("base", graph.records));
    const server = await startServer(harness.staging, servers);
    const baseUrl = serverUrl(server);

    await expectFailure(
      await request(baseUrl, `${ROUTE}/plan`, {
        method: "POST",
        body: {
          schemaVersion: 1,
          expectedHeadRef: headRef(committed),
          action: {
            kind: "delete_acquisition",
            targetAcquisitionRef: ref(graph.acquisition),
            reason: "Attempt to smuggle a caller-selected graph",
          },
          baseSnapshot: committed.snapshot,
        },
      }),
      400,
      "invalid_request"
    );

    const advanced = harness.staging.applyTransaction(
      transaction(
        "advance",
        [
          record({
            recordKind: "digital_asset",
            id: "asset.lifecycle-http-advance",
            sha256: "b".repeat(64),
            mediaType: "application/octet-stream",
            byteLength: 1,
          }),
        ],
        headRef(committed)
      )
    );
    const conflict = await expectFailure(
      await request(baseUrl, `${ROUTE}/plan`, {
        method: "POST",
        body: {
          schemaVersion: 1,
          expectedHeadRef: headRef(committed),
          action: {
            kind: "delete_acquisition",
            targetAcquisitionRef: ref(graph.acquisition),
            reason: "Stale lifecycle request",
          },
        },
      }),
      409,
      "conflict",
      true
    );
    expect(conflict.error.details).toEqual({ currentHead: advanced.head });

    for (const operation of ["execute", "publish", "delete"]) {
      await expectFailure(
        await request(baseUrl, `${ROUTE}/${operation}`, { method: "POST", body: {} }),
        404,
        "not_found"
      );
    }
    expect(harness.store.readCurrentState()?.head).toEqual(advanced.head);
  });

  it("translates missing and integrity-invalid staging generations to closed 404 and 422 envelopes", async () => {
    const emptyHarness = createHarness(rootDirectory);
    const emptyServer = await startServer(emptyHarness.staging, servers);
    await expectFailure(
      await request(serverUrl(emptyServer), `${ROUTE}/plan`, {
        method: "POST",
        body: {
          schemaVersion: 1,
          expectedHeadRef: externalRef("snapshot.missing"),
          action: {
            kind: "delete_acquisition",
            targetAcquisitionRef: externalRef("acquisition.missing"),
            reason: "No staging generation exists",
          },
        },
      }),
      404,
      "not_found"
    );
    await stopServer(emptyServer, servers);

    const asset = record({
      recordKind: "digital_asset",
      id: "asset.corrupt-lifecycle-snapshot",
      sha256: "c".repeat(64),
      mediaType: "application/pdf",
      byteLength: 1,
    });
    const corruptPolicy = record({
      recordKind: "lifecycle_storage_policy",
      id: "storage.corrupt-lifecycle-snapshot",
      version: 1,
      subjectRef: externalRef("asset.not-in-snapshot"),
      subjectKind: "asset_bytes",
      provenancePaths: [
        { acquisitionRefs: [externalRef("acquisition.not-in-snapshot")], derivationRefs: [] },
      ],
      policyRef: externalRef("policy.lifecycle"),
      custody: {
        kind: "vellum_controlled",
        storeIds: ["reference-source-staging"],
        retention: "unretained",
        tombstonePolicy: "preserve",
      },
      replayRequirement: "required",
      readinessRequirement: "required",
      createdAt: RECORDED_AT,
    });
    const snapshot = stagingSnapshot("snapshot.corrupt-lifecycle", [asset, corruptPolicy]);
    const head = emptyHarness.store.commit(snapshot);
    const corruptServer = await startServer(emptyHarness.staging, servers);
    await expectFailure(
      await request(serverUrl(corruptServer), `${ROUTE}/plan`, {
        method: "POST",
        body: {
          schemaVersion: 1,
          expectedHeadRef: { id: head.snapshotId, digest: head.digest },
          action: {
            kind: "delete_acquisition",
            targetAcquisitionRef: externalRef("acquisition.not-in-snapshot"),
            reason: "Semantically corrupt staging generation",
          },
        },
      }),
      422,
      "unprocessable_content"
    );
  });
});

function createHarness(rootDirectory: string): {
  store: ReferenceSourceStagingStore;
  staging: ReferenceSourceStagingService;
} {
  const store = new ReferenceSourceStagingStore({ rootDirectory });
  let sequence = 0;
  return {
    store,
    staging: new ReferenceSourceStagingService({
      store,
      now: () => new Date(RECORDED_AT),
      createId: () => `lifecycle-http-${++sequence}`,
    }),
  };
}

function lifecycleGraph() {
  const bytes = Buffer.alloc(1024, 0x61);
  const asset = record({
    recordKind: "digital_asset",
    id: "asset.lifecycle-http-source",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    mediaType: "application/pdf",
    byteLength: 1024,
  });
  const acquisition = record({
    recordKind: "asset_acquisition",
    id: "acquisition.lifecycle-http-source",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: {
      sourceKind: "upload",
      ownerActionRef: externalRef("owner-action.lifecycle-http-upload"),
    },
    acquiredAt: RECORDED_AT,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.local-only"),
  });
  const rights = record({
    recordKind: "rights_assertion",
    id: "rights.lifecycle-http-source",
    version: 1,
    subjectRef: ref(acquisition),
    subjectKind: "asset_acquisition",
    rightsKind: "owner_private_access",
    status: "permitted",
    claimant: { kind: "owner", claimantRef: externalRef("owner.local") },
    evidenceRefs: [externalRef("evidence.owner-upload")],
    assertedAt: RECORDED_AT,
  });
  const access = record({
    recordKind: "access_decision",
    id: "access.lifecycle-http-source",
    version: 1,
    outcome: "allow",
    operation: "owner_private_study",
    sourceRefs: [ref(acquisition), ref(asset)],
    derivativeRefs: [],
    destination: { kind: "local_runtime" },
    purpose: "Bind source to arrangement workspace",
    assetRole: "arrangement_source",
    policyRef: externalRef("access-policy.owner-private-study"),
    rightsAssertionRefs: [ref(rights)],
    authorityRefs: [externalRef("owner.local")],
    rationale: "The exact Owner upload is authorized for local private study",
    decidedAt: RECORDED_AT,
  });
  const binding = record({
    recordKind: "arrangement_source_binding",
    id: "binding.lifecycle-http-source",
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(acquisition)],
    accessDecisionRefs: [ref(access)],
    retentionPolicyRef: externalRef("retention-policy.workspace"),
    workspaceRef: externalRef("workspace.lifecycle-http-fixture"),
    createdAt: RECORDED_AT,
  });
  const storage = record({
    recordKind: "lifecycle_storage_policy",
    id: "storage.lifecycle-http-source",
    version: 1,
    subjectRef: ref(asset),
    subjectKind: "asset_bytes",
    provenancePaths: [
      {
        acquisitionRefs: [ref(acquisition)],
        derivationRefs: [],
        roleBindingRefs: [ref(binding)],
      },
    ],
    policyRef: externalRef("lifecycle-policy.local-bytes"),
    custody: {
      kind: "vellum_controlled",
      storeIds: ["reference-source-staging"],
      retention: "unretained",
      tombstonePolicy: "preserve",
    },
    replayRequirement: "required",
    readinessRequirement: "required",
    createdAt: RECORDED_AT,
  });
  const use = record({
    recordKind: "lifecycle_use",
    id: "use.lifecycle-http-source",
    version: 1,
    subjectRef: ref(asset),
    provenancePaths: [
      {
        acquisitionRefs: [ref(acquisition)],
        derivationRefs: [],
        accessDecisionRef: ref(access),
        roleBindingRef: ref(binding),
      },
    ],
    operation: access.operation,
    destination: access.destination,
    purpose: access.purpose,
    assetRole: access.assetRole,
    policyRef: access.policyRef,
    baselineReplayability: "complete",
    readinessRequirement: "required",
    createdAt: RECORDED_AT,
  });

  return {
    records: [asset, acquisition, rights, access, binding, storage, use],
    asset,
    acquisition,
    bytes,
  };
}

function transaction(
  id: string,
  records: ReferenceSourceStagingRecord[],
  expectedHeadRef?: ReferenceRecordRef
): ReferenceSourceStagingTransaction {
  return {
    schemaVersion: 1,
    id: `transaction.${id}`,
    ...(expectedHeadRef ? { expectedHeadRef } : {}),
    operations: records.map((entry) => ({ type: "append_record", record: entry })),
    submittedAt: RECORDED_AT,
  } as ReferenceSourceStagingTransaction;
}

function stagingSnapshot(
  id: string,
  records: ReferenceSourceStagingRecord[]
): ReferenceSourceStagingSnapshot {
  const core = {
    schemaVersion: 1 as const,
    id,
    revision: 1,
    publicationState: "staging_only" as const,
    createdAt: RECORDED_AT,
    records,
  };
  return { ...core, digest: referenceSourceDigest(core) };
}

function record<T extends Record<string, unknown>>(value: T): T & ReferenceSourceStagingRecord {
  return withReferenceRecordDigest(value) as unknown as T & ReferenceSourceStagingRecord;
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: withReferenceRecordDigest({ id }).digest };
}

function headRef(value: {
  head: { snapshotId: string; digest: string } | null;
}): ReferenceRecordRef {
  if (!value.head) throw new Error("Expected a staging head");
  return { id: value.head.snapshotId, digest: value.head.digest };
}

function expectPlanSeal(plan: ReferenceSourceLifecyclePlanResult): void {
  const { id, digest, ...value } = plan;
  const seed = referenceSourceDigest(value);
  expect(id).toBe(`reference-lifecycle-plan.${seed.slice(0, 24)}`);
  expect(digest).toBe(referenceSourceDigest({ ...value, id }));
}

function snapshotDirectory(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory).sort()) {
      const absolute = path.join(directory, entry);
      const relative = path.relative(root, absolute);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else result[relative] = readFileSync(absolute).toString("base64");
    }
  };
  visit(root);
  return result;
}

async function startServer(
  staging: ReferenceSourceStagingService,
  servers: Server[],
  productionInventoryAdapters?: readonly ReferenceSourceControlledStoreInventoryAdapter[]
): Promise<Server> {
  const ownerRuntimeRoot = mkdtempSync(path.join(tmpdir(), "vellum-lifecycle-http-owner-"));
  const controlledStore = productionInventoryAdapters?.find(
    (adapter): adapter is ReferenceSourceControlledArtifactStore =>
      adapter instanceof ReferenceSourceControlledArtifactStore
  );
  const server = createServer(
    createApp({
      referenceSourceStagingService: staging,
      referenceSourceControlledArtifactStore:
        controlledStore ??
        new ReferenceSourceControlledArtifactStore({
          rootDirectory: path.join(ownerRuntimeRoot, "controlled-artifacts"),
        }),
      knowledgePublicationStore: new KnowledgePublicationStore({
        rootDirectory: path.join(ownerRuntimeRoot, "knowledge-publication"),
      }),
      ownerReferenceMigrationOwnerRootDirectory: path.join(ownerRuntimeRoot, "owner"),
      ownerReferenceMigrationPrivateRootDirectory: path.join(ownerRuntimeRoot, "migration-private"),
      ownerReferenceWorkbenchPrivateRootDirectory: path.join(ownerRuntimeRoot, "workbench-private"),
      ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x4c),
      ...(productionInventoryAdapters
        ? {
            referenceSourceControlledStoreInventoryAdapters: productionInventoryAdapters,
          }
        : {
            referenceSourceLifecycleEvidenceProvider:
              createTestReferenceSourceLifecycleEvidenceProvider(),
            referenceSourceAuthorityTrust: TEST_REFERENCE_AUTHORITY_TRUST,
            referenceSourceRetentionAuthorityTrust: TEST_REFERENCE_RETENTION_AUTHORITY_TRUST,
          }),
    })
  );
  server.once("close", () => rmSync(ownerRuntimeRoot, { recursive: true, force: true }));
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
  expect(result.body.error.message).not.toMatch(/stack|\/Users\/|reference-lifecycle-http-/i);
  return result.body;
}
