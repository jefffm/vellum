import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { assertAuthorityPathRuntime } from "../../src/lib/authority-path-runtime.js";
import type { ApiResponse } from "../../src/lib/api-contract.js";
import type { OwnerReferenceWorkbenchSnapshot } from "../../src/lib/owner-reference-workbench-contract.js";
import type {
  ReferenceAccessDestination,
  ReferenceAccessDecision,
  ReferenceAccessOperation,
  ReferenceAssetAcquisition,
  ReferenceDigitalAsset,
  ReferenceSourceStagingInputRecord,
  ReferenceRecordRef,
  ReferenceSourceStagingTransaction,
  OwnerReferenceBinding,
} from "../../src/lib/reference-source-domain.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
} from "../../src/lib/reference-source-domain.js";
import { createApp } from "../../src/server/index.js";
import { KnowledgePublicationStore } from "../../src/server/lib/knowledge-publication-store.js";
import { OwnerStore } from "../../src/server/lib/owner-store.js";
import { ReferenceSourceControlledArtifactStore } from "../../src/server/lib/reference-source-controlled-artifact-store.js";
import { OWNER_REFERENCE_UPLOAD_PROCESSING_POLICY_REF } from "../../src/server/lib/reference-source-controlled-asset-service.js";
import type {
  OwnerReferenceMigrationCommitView,
  OwnerReferenceMigrationCompatibilityView,
  OwnerReferenceMigrationInterruptedRollbackView,
  OwnerReferenceMigrationRollbackView,
} from "../../src/server/lib/owner-reference-migration-service.js";
import type { ReferenceSourceOperationResult } from "../../src/server/lib/reference-source-operation-gateway.js";
import type { ReferenceSourceProtectedOperationSinks } from "../../src/server/lib/reference-source-protected-operation-adapter.js";
import { ReferenceSourceStagingService } from "../../src/server/lib/reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "../../src/server/lib/reference-source-staging-store.js";

const NOW = "2026-07-16T12:00:00.000Z";
const LEGACY_TITLE = "PRIVATE LEGACY TITLE CANARY — T10";
const LEGACY_PATH = "/private/Owner Library/T10 secret legacy scan.pdf";
const LEGACY_BYTES = Buffer.from("%PDF-1.7\nPRIVATE LEGACY CONTENT CANARY — T10\n%%EOF\n");
const UPLOAD_FILENAME = "PRIVATE-T10-NEW-UPLOAD-FILENAME.pdf";
const UPLOAD_BYTES = Buffer.from("%PDF-1.7\nPRIVATE NEW UPLOAD CONTENT CANARY — T10\n%%EOF\n");
const UPLOAD_KEY = "t10-owner-private-upload-retry";

const WORKBENCH_ACCESS_MATRIX = [
  ["local_study", "review_required"],
  ["local_extraction", "review_required"],
  ["provider_egress", "deny"],
  ["fixture_inclusion", "deny"],
  ["repository_inclusion", "deny"],
  ["export", "deny"],
  ["redistribution", "deny"],
  ["report", "deny"],
  ["log", "deny"],
] as const;

const GATEWAY_ACCESS_MATRIX: readonly {
  operation: ReferenceAccessOperation;
  destination: ReferenceAccessDestination;
  status: "deny" | "review_required";
}[] = [
  {
    operation: "owner_private_study",
    destination: { kind: "local_runtime" },
    status: "review_required",
  },
  {
    operation: "local_extraction",
    destination: { kind: "local_runtime" },
    status: "review_required",
  },
  {
    operation: "provider_model_processing",
    destination: { kind: "provider", id: "provider.fake-t10" },
    status: "deny",
  },
  {
    operation: "fixture_inclusion",
    destination: { kind: "repository", id: "repository.fixture-t10" },
    status: "deny",
  },
  {
    operation: "repository_inclusion",
    destination: { kind: "repository", id: "repository.source-t10" },
    status: "deny",
  },
  {
    operation: "pack_citation",
    destination: { kind: "repository", id: "repository.knowledge-t10" },
    status: "deny",
  },
  { operation: "export", destination: { kind: "export", id: "export.t10" }, status: "deny" },
  {
    operation: "redistribution",
    destination: { kind: "recipient", id: "recipient.t10" },
    status: "deny",
  },
  { operation: "report", destination: { kind: "local_runtime" }, status: "deny" },
  { operation: "log", destination: { kind: "local_runtime" }, status: "deny" },
];

const roots: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("T10 migrated-private defaults and production Workbench", () => {
  it("keeps protected Owner-Reference effects behind one production-owned adapter", () => {
    const productionSource = readFileSync(path.join(process.cwd(), "src/server/index.ts"), "utf8");

    expect(productionSource).toContain("new ReferenceSourceProtectedOperationAdapter");
    expect(productionSource).toContain(
      "getReferenceSourceControlledArtifactStore().readDigitalAssetBytes(digitalAssetRef)"
    );
    expect(productionSource).toContain("createFailClosedReferenceSourceProtectedOperationSinks()");
    expect(productionSource).toContain('"/owner/reference-source-operations/execute"');
    expect(productionSource).toContain('"/owner/reference-source-operations/compiler-input"');
  });

  it("keeps migrated and uploaded Owner references stable, private, and fail-closed across restart", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const root = mkdtempSync(path.join(tmpdir(), "vellum-t10-private-workbench-"));
    roots.push(root);
    const paths = persistentPaths(root);
    const ownerStore = new OwnerStore({
      rootDirectory: paths.owner,
      now: () => new Date(NOW),
    });
    const legacyReference = ownerStore.addReference({
      title: LEGACY_TITLE,
      citation: LEGACY_PATH,
      mimeType: "application/pdf",
      contentBase64: LEGACY_BYTES.toString("base64"),
    });
    expect(legacyReference).toMatchObject({
      authorityState: "raw_staged",
      activationAllowed: false,
    });

    const firstRuntime = createRuntime(paths, "first");
    const compilerRun = vi.fn(async () => ({
      stdout: "",
      stderr: "source.ly:1:1: error: T10 compiler-runner sentinel",
      exitCode: 1,
      files: new Map<string, Buffer>(),
      durationMs: 1,
    }));
    const protectedSinks = protectedSinkSpies();
    const firstServer = await listen(
      createApp({
        compilerRunner: { run: compilerRun },
        ownerReferenceMigrationOwnerRootDirectory: paths.owner,
        ownerReferenceMigrationPrivateRootDirectory: paths.migrationPrivate,
        ownerReferenceWorkbenchPrivateRootDirectory: paths.workbenchPrivate,
        ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x10),
        knowledgePublicationStore: firstRuntime.publication,
        referenceSourceStagingService: firstRuntime.staging,
        referenceSourceControlledArtifactStore: firstRuntime.controlled,
        referenceSourceProtectedOperationSinks: protectedSinks,
      })
    );
    servers.push(firstServer);
    const firstBase = address(firstServer);

    const dryRun = await jsonRequest<MigrationPlan>(
      `${firstBase}/api/owner/reference-migrations/owner-references/dry-run`,
      { method: "POST", body: JSON.stringify({ expectedHead: null }) }
    );
    expect(dryRun.response.status).toBe(200);
    const migrationPlan = requireOk(dryRun.json);
    expect(migrationPlan).toMatchObject({
      expectedHead: null,
      mappings: [{ legacyId: legacyReference.id }],
      quarantines: [
        {
          legacyId: legacyReference.id,
          reason: "incomplete_identity",
          action: "review_source_identity",
        },
      ],
    });

    const commit = await jsonRequest<MigrationCommit>(
      `${firstBase}/api/owner/reference-migrations/owner-references/commit`,
      {
        method: "POST",
        body: JSON.stringify({
          expectedHead: null,
          planDigest: migrationPlan.planDigest,
        }),
      }
    );
    expect(commit.response.status).toBe(200);
    expect(requireOk(commit.json)).toMatchObject({
      outcome: "committed",
      journalState: "committed",
    });

    const migratedHead = firstRuntime.staging.readCurrent().head;
    expect(migratedHead).not.toBeNull();
    const upload = await rawUpload(
      firstBase,
      UPLOAD_BYTES,
      UPLOAD_KEY,
      migratedHead ? { id: migratedHead.snapshotId, digest: migratedHead.digest } : undefined
    );
    expect(upload.response.status).toBe(200);
    const uploadResult = requireOk(upload.json);
    expect(uploadResult).toMatchObject({ publicationState: "staging_only", replayed: false });

    const unboundWorkbench = await readWorkbench(firstBase);
    assertPrivateWorkbench(unboundWorkbench);
    bindAsOwnerReference(firstRuntime.staging, uploadResult.digitalAsset, uploadResult.acquisition);

    const firstWorkbench = await readWorkbench(firstBase);
    const reloadWorkbench = await readWorkbench(firstBase);
    expect(reloadWorkbench).toEqual(firstWorkbench);
    assertRoleBindingPreservesPrivateDefaults(unboundWorkbench, firstWorkbench);

    const stagedBeforeRestart = firstRuntime.staging.readCurrent();
    const stagedRecordsBeforeRestart = stagedBeforeRestart.snapshot?.records ?? [];
    const acquisitions = stagedRecordsBeforeRestart.filter(
      (record): record is ReferenceAssetAcquisition => record.recordKind === "asset_acquisition"
    );
    expect(acquisitions).toHaveLength(2);
    expect(
      stagedRecordsBeforeRestart.filter(({ recordKind }) => recordKind === "digital_asset")
    ).toHaveLength(2);

    await assertPrivateOperationBoundary(firstBase, acquisitions);
    await assertProtectedSinkBoundary(firstBase, firstRuntime, acquisitions, protectedSinks);

    const legacyPromotion = await jsonRequest<unknown>(
      `${firstBase}/api/owner/knowledge-promotions`,
      {
        method: "POST",
        body: JSON.stringify({
          candidateId: "knowledge-candidate.private-t10-bypass",
          packId: "pack.private-t10-bypass",
          packName: "PRIVATE T10 LEGACY ACTIVATION CANARY",
          authority: "documented_practice",
        }),
      }
    );
    expect(legacyPromotion.response.status).toBe(410);
    expect(legacyPromotion.json).toMatchObject({
      ok: false,
      error: {
        code: "conflict",
        status: 410,
        details: {
          reason: "legacy_knowledge_quarantined",
          authorityPathId: "authority.cache.owner-legacy-knowledge",
        },
      },
    });
    expect(JSON.stringify(legacyPromotion.json)).not.toContain(
      "PRIVATE T10 LEGACY ACTIVATION CANARY"
    );
    expect(() =>
      assertAuthorityPathRuntime("authority.cache.owner-legacy-knowledge", "production")
    ).toThrow(/production|cannot execute|not classified/i);
    expect(ownerStore.listReferences()).toEqual([legacyReference]);
    expect(compilerRun).not.toHaveBeenCalled();

    const ordinaryCompile = await jsonRequest<unknown>(`${firstBase}/api/compile`, {
      method: "POST",
      body: JSON.stringify({
        source: "{ c'4 }",
      }),
    });
    expect(ordinaryCompile.response.status).toBe(200);
    expect(requireOk(ordinaryCompile.json)).toMatchObject({
      errors: [{ type: "lilypond", message: "T10 compiler-runner sentinel" }],
    });
    expect(compilerRun).toHaveBeenCalledTimes(1);

    await closeServer(firstServer);
    servers.splice(servers.indexOf(firstServer), 1);

    const restartedRuntime = createRuntime(paths, "restart");
    const restartedServer = await listen(
      createApp({
        ownerReferenceMigrationOwnerRootDirectory: paths.owner,
        ownerReferenceMigrationPrivateRootDirectory: paths.migrationPrivate,
        ownerReferenceWorkbenchPrivateRootDirectory: paths.workbenchPrivate,
        ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x10),
        knowledgePublicationStore: restartedRuntime.publication,
        referenceSourceStagingService: restartedRuntime.staging,
        referenceSourceControlledArtifactStore: restartedRuntime.controlled,
      })
    );
    servers.push(restartedServer);
    const restartedBase = address(restartedServer);

    const restartedWorkbench = await readWorkbench(restartedBase);
    expect(restartedWorkbench).toEqual(firstWorkbench);

    const retry = await rawUpload(
      restartedBase,
      UPLOAD_BYTES,
      UPLOAD_KEY,
      uploadResult.head
        ? { id: uploadResult.head.snapshotId, digest: uploadResult.head.digest }
        : undefined
    );
    expect(retry.response.status).toBe(200);
    expect(requireOk(retry.json)).toMatchObject({
      replayed: true,
      acquisition: {
        id: uploadResult.acquisition.id,
        digest: uploadResult.acquisition.digest,
      },
      head: stagedBeforeRestart.head,
    });
    const afterRetryWorkbench = await readWorkbench(restartedBase);
    expect(afterRetryWorkbench).toEqual(firstWorkbench);
    const restartedRecords = restartedRuntime.staging.readCurrent().snapshot?.records ?? [];
    expect(restartedRecords).toHaveLength(stagedRecordsBeforeRestart.length);
    expect(new Set(restartedRecords.map(({ id }) => id)).size).toBe(restartedRecords.length);
    expect(
      restartedRecords.filter(({ recordKind }) => recordKind === "asset_acquisition")
    ).toHaveLength(2);
    expect(
      restartedRecords.filter(({ recordKind }) => recordKind === "digital_asset")
    ).toHaveLength(2);

    const legacyWriter = await jsonRequest<unknown>(`${restartedBase}/api/owner/references`, {
      method: "POST",
      body: JSON.stringify({
        title: "PRIVATE BYPASS TITLE CANARY — T10",
        citation: "/private/bypass/path.pdf",
        mimeType: "application/pdf",
        contentBase64: LEGACY_BYTES.toString("base64"),
      }),
    });
    expect(legacyWriter.response.status).toBe(410);
    expect(legacyWriter.json).toMatchObject({
      ok: false,
      error: {
        code: "conflict",
        status: 410,
        details: {
          reason: "legacy_owner_reference_writer_quarantined",
          replacement: "/api/owner/reference-source-staging/assets",
        },
      },
    });
    expect(new OwnerStore({ rootDirectory: paths.owner }).listReferences()).toHaveLength(1);

    const workbenchText = JSON.stringify({
      unbound: unboundWorkbench,
      first: firstWorkbench,
      restarted: restartedWorkbench,
      afterRetry: afterRetryWorkbench,
    });
    const privateCanaries = [
      LEGACY_TITLE,
      LEGACY_PATH,
      LEGACY_BYTES.toString("utf8"),
      UPLOAD_FILENAME,
      UPLOAD_BYTES.toString("utf8"),
      legacyReference.id,
      legacyReference.sha256,
      sha256(UPLOAD_BYTES),
      uploadResult.digitalAsset.id,
      uploadResult.digitalAsset.digest,
      uploadResult.digitalAsset.sha256,
      uploadResult.acquisition.id,
      uploadResult.acquisition.digest,
    ];
    for (const canary of privateCanaries) expect(workbenchText).not.toContain(canary);
    expect(workbenchText).not.toContain('"sha256"');
    expect(workbenchText).not.toContain("storedPath");
    expect(workbenchText).not.toContain("filename");
  });

  it("fails closed during an interrupted commit, recovers through rollback-interrupted, and restarts exactly", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const root = mkdtempSync(path.join(tmpdir(), "vellum-t10-interrupted-private-workbench-"));
    roots.push(root);
    const paths = persistentPaths(root);
    const ownerStore = new OwnerStore({
      rootDirectory: paths.owner,
      now: () => new Date(NOW),
    });
    const legacyReference = ownerStore.addReference({
      title: LEGACY_TITLE,
      citation: LEGACY_PATH,
      mimeType: "application/pdf",
      contentBase64: LEGACY_BYTES.toString("base64"),
    });
    let injected = false;
    const interruptedRuntime = createRuntime(paths, "interrupted", {
      publicationFaultInjector: (fault) => {
        if (!injected && fault.point === "before_head_commit") {
          injected = true;
          throw new Error("injected T10 publication interruption");
        }
      },
    });
    const interruptedServer = await listen(
      createApp({
        ownerReferenceMigrationOwnerRootDirectory: paths.owner,
        ownerReferenceMigrationPrivateRootDirectory: paths.migrationPrivate,
        ownerReferenceWorkbenchPrivateRootDirectory: paths.workbenchPrivate,
        ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x10),
        knowledgePublicationStore: interruptedRuntime.publication,
        referenceSourceStagingService: interruptedRuntime.staging,
        referenceSourceControlledArtifactStore: interruptedRuntime.controlled,
      })
    );
    servers.push(interruptedServer);
    const interruptedBase = address(interruptedServer);

    const dryRun = await jsonRequest<MigrationPlan>(
      `${interruptedBase}/api/owner/reference-migrations/owner-references/dry-run`,
      { method: "POST", body: JSON.stringify({ expectedHead: null }) }
    );
    expect(dryRun.response.status).toBe(200);
    const plan = requireOk(dryRun.json);
    const interruptedCommit = await jsonRequest<OwnerReferenceMigrationCommitView>(
      `${interruptedBase}/api/owner/reference-migrations/owner-references/commit`,
      {
        method: "POST",
        body: JSON.stringify({ expectedHead: null, planDigest: plan.planDigest }),
      }
    );
    expect(injected).toBe(true);
    expect(interruptedCommit.response.status).toBe(500);
    expect(interruptedCommit.json).toMatchObject({
      ok: false,
      error: { code: "internal_error", message: "Internal server error", status: 500 },
    });

    const pendingCompatibility = await readCompatibility(interruptedBase);
    expect(pendingCompatibility).toEqual({
      schemaVersion: 1,
      publicationState: "migration_only",
      head: null,
      legacySourceState: "verified",
      ownerReferences: [
        {
          legacyId: legacyReference.id,
          state: "pending",
          legacySourceState: "verified",
        },
      ],
      capabilities: migrationCapabilities(),
    });
    const pendingWorkbenchFailure = await readFailClosedWorkbench(interruptedBase);

    await closeServer(interruptedServer);
    servers.splice(servers.indexOf(interruptedServer), 1);

    const recoveryRuntime = createRuntime(paths, "interrupted-recovery");
    const recoveryServer = await listen(
      createApp({
        ownerReferenceMigrationOwnerRootDirectory: paths.owner,
        ownerReferenceMigrationPrivateRootDirectory: paths.migrationPrivate,
        ownerReferenceWorkbenchPrivateRootDirectory: paths.workbenchPrivate,
        ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x10),
        knowledgePublicationStore: recoveryRuntime.publication,
        referenceSourceStagingService: recoveryRuntime.staging,
        referenceSourceControlledArtifactStore: recoveryRuntime.controlled,
      })
    );
    servers.push(recoveryServer);
    const recoveryBase = address(recoveryServer);
    expect(await readCompatibility(recoveryBase)).toEqual(pendingCompatibility);
    expect(withoutCorrelation(await readFailClosedWorkbench(recoveryBase))).toEqual(
      withoutCorrelation(pendingWorkbenchFailure)
    );

    const rollback = await jsonRequest<OwnerReferenceMigrationInterruptedRollbackView>(
      `${recoveryBase}/api/owner/reference-migrations/owner-references/rollback-interrupted`,
      {
        method: "POST",
        body: JSON.stringify({ planDigest: plan.planDigest, expectedHead: null }),
      }
    );
    expect(rollback.response.status).toBe(200);
    const rollbackResult = requireOk(rollback.json);
    expect(rollbackResult).toMatchObject({
      mode: "rollback",
      rollbackScope: "interrupted_commit",
      planDigest: plan.planDigest,
      outcome: "committed",
      journalState: "rolled_back",
    });

    const rolledBackCompatibility = await readCompatibility(recoveryBase);
    const mappingId = rolledBackCompatibility.ownerReferences[0]?.mappingId;
    expect(mappingId).toMatch(/^owner-reference-migration-mapping\.[a-f0-9]{32}$/);
    expect(rolledBackCompatibility).toEqual({
      schemaVersion: 1,
      publicationState: "migration_only",
      head: rollbackResult.head,
      legacySourceState: "verified",
      ownerReferences: [
        {
          legacyId: legacyReference.id,
          state: "rolled_back",
          legacySourceState: "verified",
          mappingId,
        },
      ],
      capabilities: migrationCapabilities(),
    });
    const rolledBackWorkbench = await readWorkbench(recoveryBase);
    assertSingleMigratedPrivateWorkbench(rolledBackWorkbench, "rolled_back");
    const acquisitions = migratedAcquisitions(recoveryRuntime.staging);
    expect(acquisitions).toHaveLength(1);
    await assertPrivateOperationBoundary(recoveryBase, acquisitions);
    assertNoPrivateCanaries(rolledBackWorkbench, legacyReference.sha256, [
      legacyReference.id,
      mappingId!,
      ...privateAcquisitionIdentities(acquisitions),
    ]);

    await closeServer(recoveryServer);
    servers.splice(servers.indexOf(recoveryServer), 1);

    const restartedRuntime = createRuntime(paths, "interrupted-restarted");
    const restartedServer = await listen(
      createApp({
        ownerReferenceMigrationOwnerRootDirectory: paths.owner,
        ownerReferenceMigrationPrivateRootDirectory: paths.migrationPrivate,
        ownerReferenceWorkbenchPrivateRootDirectory: paths.workbenchPrivate,
        ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x10),
        knowledgePublicationStore: restartedRuntime.publication,
        referenceSourceStagingService: restartedRuntime.staging,
        referenceSourceControlledArtifactStore: restartedRuntime.controlled,
      })
    );
    servers.push(restartedServer);
    const restartedBase = address(restartedServer);
    expect(await readCompatibility(restartedBase)).toEqual(rolledBackCompatibility);
    expect(await readWorkbench(restartedBase)).toEqual(rolledBackWorkbench);

    const replay = await jsonRequest<OwnerReferenceMigrationInterruptedRollbackView>(
      `${restartedBase}/api/owner/reference-migrations/owner-references/rollback-interrupted`,
      {
        method: "POST",
        body: JSON.stringify({
          planDigest: plan.planDigest,
          expectedHead: generationRef(rollbackResult.head),
        }),
      }
    );
    expect(replay.response.status).toBe(200);
    expect(requireOk(replay.json)).toMatchObject({
      outcome: "already_committed",
      journalState: "rolled_back",
      head: rollbackResult.head,
    });
    expect(await readWorkbench(restartedBase)).toEqual(rolledBackWorkbench);
    assertNoPrivateCanaries(
      {
        interruptedCommit: interruptedCommit.json,
        pendingCompatibility,
        pendingWorkbenchFailure,
        rollback: rollback.json,
        rolledBackCompatibility,
        rolledBackWorkbench,
        replay: replay.json,
        errorLog: errorLog.mock.calls,
      },
      legacyReference.sha256
    );
  });

  it("keeps completed-migration private defaults stable through rollback, replay, and restart", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const root = mkdtempSync(path.join(tmpdir(), "vellum-t10-completed-rollback-workbench-"));
    roots.push(root);
    const paths = persistentPaths(root);
    const ownerStore = new OwnerStore({
      rootDirectory: paths.owner,
      now: () => new Date(NOW),
    });
    const legacyReference = ownerStore.addReference({
      title: LEGACY_TITLE,
      citation: LEGACY_PATH,
      mimeType: "application/pdf",
      contentBase64: LEGACY_BYTES.toString("base64"),
    });
    const runtime = createRuntime(paths, "completed-rollback");
    const server = await listen(
      createApp({
        ownerReferenceMigrationOwnerRootDirectory: paths.owner,
        ownerReferenceMigrationPrivateRootDirectory: paths.migrationPrivate,
        ownerReferenceWorkbenchPrivateRootDirectory: paths.workbenchPrivate,
        ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x10),
        knowledgePublicationStore: runtime.publication,
        referenceSourceStagingService: runtime.staging,
        referenceSourceControlledArtifactStore: runtime.controlled,
      })
    );
    servers.push(server);
    const base = address(server);

    const dryRun = await jsonRequest<MigrationPlan>(
      `${base}/api/owner/reference-migrations/owner-references/dry-run`,
      { method: "POST", body: JSON.stringify({ expectedHead: null }) }
    );
    const plan = requireOk(dryRun.json);
    const commit = await jsonRequest<OwnerReferenceMigrationCommitView>(
      `${base}/api/owner/reference-migrations/owner-references/commit`,
      {
        method: "POST",
        body: JSON.stringify({ expectedHead: null, planDigest: plan.planDigest }),
      }
    );
    expect(commit.response.status).toBe(200);
    const commitResult = requireOk(commit.json);
    const commitHead = requireHead(commitResult.head);
    expect(commitResult).toMatchObject({ outcome: "committed", journalState: "committed" });

    const committedCompatibility = await readCompatibility(base);
    const mappingId = committedCompatibility.ownerReferences[0]?.mappingId;
    expect(mappingId).toMatch(/^owner-reference-migration-mapping\.[a-f0-9]{32}$/);
    expect(committedCompatibility).toEqual({
      schemaVersion: 1,
      publicationState: "migration_only",
      head: commitHead,
      legacySourceState: "verified",
      ownerReferences: [
        {
          legacyId: legacyReference.id,
          state: "quarantined",
          legacySourceState: "verified",
          mappingId,
          quarantineReason: "incomplete_identity",
        },
      ],
      capabilities: migrationCapabilities(),
    });
    const committedWorkbench = await readWorkbench(base);
    assertSingleMigratedPrivateWorkbench(committedWorkbench, "quarantined");

    const rollback = await jsonRequest<OwnerReferenceMigrationRollbackView>(
      `${base}/api/owner/reference-migrations/owner-references/rollback`,
      {
        method: "POST",
        body: JSON.stringify({
          batchId: commitResult.batchId,
          expectedHead: generationRef(commitHead),
        }),
      }
    );
    expect(rollback.response.status).toBe(200);
    const rollbackResult = requireOk(rollback.json);
    expect(rollbackResult).toMatchObject({
      mode: "rollback",
      batchId: commitResult.batchId,
      outcome: "committed",
      journalState: "rolled_back",
    });
    const rolledBackCompatibility = await readCompatibility(base);
    expect(rolledBackCompatibility).toEqual({
      schemaVersion: 1,
      publicationState: "migration_only",
      head: rollbackResult.head,
      legacySourceState: "verified",
      ownerReferences: [
        {
          legacyId: legacyReference.id,
          state: "rolled_back",
          legacySourceState: "verified",
          mappingId,
        },
      ],
      capabilities: migrationCapabilities(),
    });
    const rolledBackWorkbench = await readWorkbench(base);
    assertSingleMigratedPrivateWorkbench(rolledBackWorkbench, "rolled_back");
    assertStablePrivateCard(committedWorkbench, rolledBackWorkbench);
    const acquisitions = migratedAcquisitions(runtime.staging);
    expect(acquisitions).toHaveLength(1);
    await assertPrivateOperationBoundary(base, acquisitions);
    assertNoPrivateCanaries({ committedWorkbench, rolledBackWorkbench }, legacyReference.sha256, [
      legacyReference.id,
      mappingId!,
      ...privateAcquisitionIdentities(acquisitions),
    ]);

    await closeServer(server);
    servers.splice(servers.indexOf(server), 1);

    const restartedRuntime = createRuntime(paths, "completed-rollback-restart");
    const restartedServer = await listen(
      createApp({
        ownerReferenceMigrationOwnerRootDirectory: paths.owner,
        ownerReferenceMigrationPrivateRootDirectory: paths.migrationPrivate,
        ownerReferenceWorkbenchPrivateRootDirectory: paths.workbenchPrivate,
        ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x10),
        knowledgePublicationStore: restartedRuntime.publication,
        referenceSourceStagingService: restartedRuntime.staging,
        referenceSourceControlledArtifactStore: restartedRuntime.controlled,
      })
    );
    servers.push(restartedServer);
    const restartedBase = address(restartedServer);
    expect(await readCompatibility(restartedBase)).toEqual(rolledBackCompatibility);
    expect(await readWorkbench(restartedBase)).toEqual(rolledBackWorkbench);

    const replay = await jsonRequest<OwnerReferenceMigrationRollbackView>(
      `${restartedBase}/api/owner/reference-migrations/owner-references/rollback`,
      {
        method: "POST",
        body: JSON.stringify({
          batchId: commitResult.batchId,
          expectedHead: generationRef(commitHead),
        }),
      }
    );
    expect(replay.response.status).toBe(200);
    expect(requireOk(replay.json)).toMatchObject({
      outcome: "already_committed",
      journalState: "rolled_back",
      head: rollbackResult.head,
    });
    expect(await readWorkbench(restartedBase)).toEqual(rolledBackWorkbench);
    assertNoPrivateCanaries(
      {
        dryRun: dryRun.json,
        commit: commit.json,
        committedCompatibility,
        committedWorkbench,
        rollback: rollback.json,
        rolledBackCompatibility,
        rolledBackWorkbench,
        replay: replay.json,
      },
      legacyReference.sha256
    );
  });

  it("rejects forged controlled-upload provenance before it can become a Workbench card", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const root = mkdtempSync(path.join(tmpdir(), "vellum-t10-forged-upload-"));
    roots.push(root);
    const paths = persistentPaths(root);
    const runtime = createRuntime(paths, "forged-upload");
    const generic = forgedUploadRecords({
      key: "generic",
      processingPolicyRef: externalRef("processing-policy.forged-generic-upload"),
    });
    runtime.staging.applyTransaction(appendTransaction("generic", null, generic));

    const server = await listen(
      createApp({
        ownerReferenceMigrationOwnerRootDirectory: paths.owner,
        ownerReferenceMigrationPrivateRootDirectory: paths.migrationPrivate,
        ownerReferenceWorkbenchPrivateRootDirectory: paths.workbenchPrivate,
        ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x10),
        knowledgePublicationStore: runtime.publication,
        referenceSourceStagingService: runtime.staging,
        referenceSourceControlledArtifactStore: runtime.controlled,
      })
    );
    servers.push(server);
    const base = address(server);

    const omitted = await readWorkbench(base);
    expect(omitted.references).toEqual([]);

    const claimed = forgedUploadRecords({
      key: "claimed-controlled-policy",
      processingPolicyRef: OWNER_REFERENCE_UPLOAD_PROCESSING_POLICY_REF,
    });
    expect(() =>
      runtime.staging.applyTransaction(
        appendTransaction("claimed-controlled-policy", runtime.staging.readCurrent().head, claimed)
      )
    ).toThrow(
      /Controlled owner-upload provenance is server-minted and unavailable to generic staging transactions/
    );
    const unchanged = await readWorkbench(base);
    expect(unchanged).toEqual(omitted);
    const responseText = JSON.stringify(unchanged);
    expect(responseText).not.toContain(claimed.asset.id);
    expect(responseText).not.toContain(claimed.asset.sha256);
    expect(runtime.controlled.observe()).toMatchObject({
      status: "complete",
      artifactBindings: [],
    });
  });
});

function forgedUploadRecords(input: { key: string; processingPolicyRef: ReferenceRecordRef }): {
  asset: ReferenceDigitalAsset;
  acquisition: ReferenceAssetAcquisition;
} {
  const sha = sha256(`PRIVATE FORGED UPLOAD BYTES ${input.key}`);
  const asset = withReferenceRecordDigest({
    recordKind: "digital_asset" as const,
    id: `digital-asset.sha256.${sha}`,
    sha256: sha,
    mediaType: "application/pdf",
    byteLength: 97,
  }) as ReferenceDigitalAsset;
  const acquisition = withReferenceRecordDigest({
    recordKind: "asset_acquisition" as const,
    id: `acquisition.forged-upload.${input.key}`,
    digitalAssetRef: { id: asset.id, digest: asset.digest },
    representedExemplarRefs: [],
    origin: {
      sourceKind: "upload" as const,
      ownerActionRef: externalRef(`owner-action.forged-upload.${input.key}`),
    },
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef: input.processingPolicyRef,
  }) as ReferenceAssetAcquisition;
  return { asset, acquisition };
}

function appendTransaction(
  key: string,
  expectedHead: { snapshotId: string; digest: string; revision: number } | null,
  records: { asset: ReferenceDigitalAsset; acquisition: ReferenceAssetAcquisition }
): ReferenceSourceStagingTransaction {
  return {
    schemaVersion: 1,
    id: `transaction.forged-upload.${key}`,
    ...(expectedHead
      ? {
          expectedHeadRef: { id: expectedHead.snapshotId, digest: expectedHead.digest },
        }
      : {}),
    operations: [records.asset, records.acquisition].map((record) => ({
      type: "append_record" as const,
      record,
    })),
    submittedAt: NOW,
  };
}

function bindAsOwnerReference(
  staging: ReferenceSourceStagingService,
  asset: ReferenceDigitalAsset,
  acquisition: ReferenceAssetAcquisition
): void {
  const decision = withReferenceRecordDigest({
    recordKind: "access_decision" as const,
    id: "access.t10-owner-reference-binding",
    version: 1,
    outcome: "allow" as const,
    operation: "owner_private_study" as const,
    sourceRefs: [ref(acquisition)],
    derivativeRefs: [],
    destination: { kind: "local_runtime" as const },
    purpose: "Bind this exact upload to the local Owner Reference Library",
    assetRole: "owner_reference" as const,
    policyRef: externalRef("policy.t10-owner-reference-binding"),
    rightsAssertionRefs: [],
    authorityRefs: [externalRef("owner.t10-explicit-local-binding")],
    rationale: "The Owner explicitly binds only this acquisition for local reference-library use.",
    decidedAt: NOW,
  }) as ReferenceAccessDecision;
  const binding = withReferenceRecordDigest({
    recordKind: "owner_reference_binding" as const,
    id: "binding.t10-owner-reference",
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(acquisition)],
    accessDecisionRefs: [ref(decision)],
    retentionPolicyRef: externalRef("retention.t10-owner-reference"),
    ownerLibraryRef: externalRef("owner-library.t10-local"),
    createdAt: NOW,
  }) as OwnerReferenceBinding;
  const head = staging.readCurrent().head;
  if (!head) throw new Error("Expected a staging head before role binding");
  staging.applyTransaction({
    schemaVersion: 1,
    id: "transaction.t10-owner-reference-binding",
    expectedHeadRef: { id: head.snapshotId, digest: head.digest },
    operations: ([decision, binding] satisfies ReferenceSourceStagingInputRecord[]).map(
      (record) => ({ type: "append_record" as const, record })
    ),
    submittedAt: NOW,
  });
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}

function assertSingleMigratedPrivateWorkbench(
  snapshot: OwnerReferenceWorkbenchSnapshot,
  migrationState: "quarantined" | "rolled_back"
): void {
  expect(snapshot.references).toHaveLength(1);
  const migrated = snapshot.references[0]!;
  expect(migrated).toMatchObject({
    origin: "migrated",
    mediaType: "application/pdf",
    byteLength: LEGACY_BYTES.byteLength,
    migration: {
      state: migrationState,
      legacySourceState: "verified",
      ...(migrationState === "quarantined" ? { quarantineReason: "incomplete_identity" } : {}),
    },
    identity: { state: "unresolved" },
    rights: { state: "unasserted", assertionCount: 0 },
    roleBindings: {
      state: "unbound",
      ownerReferenceCount: 0,
      arrangementSourceCount: 0,
      evaluationSourceCount: 0,
    },
  });
  expect(migrated.access.map(({ operation, status }) => [operation, status])).toEqual(
    WORKBENCH_ACCESS_MATRIX
  );
  expect(migrated.identity.explanation).toMatch(/no Work|unresolved/i);
  expect(migrated.rights.explanation).toMatch(/no Rights Assertion|Access Decision/i);
  expect(migrated.roleBindings.explanation).toMatch(/no role|authority/i);
  expect(migrated.access.map(({ explanation }) => explanation).join(" ")).toMatch(
    /rights|Access Decision/i
  );
}

function assertStablePrivateCard(
  before: OwnerReferenceWorkbenchSnapshot,
  after: OwnerReferenceWorkbenchSnapshot
): void {
  const { migration: _beforeMigration, ...beforeStable } = before.references[0]!;
  const { migration: _afterMigration, ...afterStable } = after.references[0]!;
  expect(afterStable).toEqual(beforeStable);
}

function migratedAcquisitions(staging: ReferenceSourceStagingService): ReferenceAssetAcquisition[] {
  return (staging.readCurrent().snapshot?.records ?? []).filter(
    (record): record is ReferenceAssetAcquisition =>
      record.recordKind === "asset_acquisition" &&
      record.origin.sourceKind === "legacy_owner_reference"
  );
}

function privateAcquisitionIdentities(
  acquisitions: readonly ReferenceAssetAcquisition[]
): string[] {
  return acquisitions.flatMap((acquisition) => [
    acquisition.id,
    acquisition.digest,
    acquisition.digitalAssetRef.id,
    acquisition.digitalAssetRef.digest,
  ]);
}

function migrationCapabilities() {
  return {
    compatibilityReads: true as const,
    canonicalWriter: false as const,
    activation: false as const,
  };
}

function assertNoPrivateCanaries(
  value: unknown,
  legacySha256: string,
  additional: readonly string[] = []
): void {
  const text = JSON.stringify(value);
  for (const canary of [
    LEGACY_TITLE,
    LEGACY_PATH,
    LEGACY_BYTES.toString("utf8"),
    legacySha256,
    ...additional,
  ]) {
    expect(text).not.toContain(canary);
  }
  expect(text).not.toContain('"sha256"');
  expect(text).not.toContain("storedPath");
  expect(text).not.toContain("filename");
}

function assertPrivateWorkbench(snapshot: OwnerReferenceWorkbenchSnapshot): void {
  expect(snapshot.references).toHaveLength(2);
  expect(new Set(snapshot.references.map(({ id }) => id)).size).toBe(2);
  expect(new Set(snapshot.references.map(({ acquisitionRef }) => acquisitionRef.id)).size).toBe(2);
  expect(new Set(snapshot.references.map(({ assetRef }) => assetRef.id)).size).toBe(2);

  const migrated = snapshot.references.find(({ origin }) => origin === "migrated");
  const uploaded = snapshot.references.find(({ origin }) => origin === "upload");
  expect(migrated).toMatchObject({
    origin: "migrated",
    mediaType: "application/pdf",
    byteLength: LEGACY_BYTES.byteLength,
    migration: {
      state: "quarantined",
      legacySourceState: "verified",
      quarantineReason: "incomplete_identity",
    },
    identity: { state: "unresolved" },
    rights: { state: "unasserted", assertionCount: 0 },
    roleBindings: { state: "unbound" },
  });
  expect(uploaded).toMatchObject({
    origin: "upload",
    mediaType: "application/pdf",
    byteLength: UPLOAD_BYTES.byteLength,
    migration: null,
    identity: { state: "unresolved" },
    rights: { state: "unasserted", assertionCount: 0 },
    roleBindings: { state: "unbound" },
  });

  for (const reference of snapshot.references) {
    expect(reference.access.map(({ operation, status }) => [operation, status])).toEqual(
      WORKBENCH_ACCESS_MATRIX
    );
    expect(reference.identity.explanation).toMatch(/no Work|unresolved/i);
    expect(reference.rights.explanation).toMatch(/no Rights Assertion|Access Decision/i);
    expect(reference.roleBindings.explanation).toMatch(/no role|authority/i);
    expect(reference.access.map(({ explanation }) => explanation).join(" ")).toMatch(
      /rights|Access Decision/i
    );
  }
}

function assertRoleBindingPreservesPrivateDefaults(
  before: OwnerReferenceWorkbenchSnapshot,
  after: OwnerReferenceWorkbenchSnapshot
): void {
  expect(after.references).toHaveLength(before.references.length);
  for (const beforeCard of before.references) {
    const afterCard = after.references.find(({ id }) => id === beforeCard.id);
    expect(afterCard).toBeDefined();
    expect(afterCard).toMatchObject({
      id: beforeCard.id,
      acquisitionRef: beforeCard.acquisitionRef,
      assetRef: beforeCard.assetRef,
      identity: beforeCard.identity,
      rights: beforeCard.rights,
      access: beforeCard.access,
    });
  }
  const uploaded = after.references.find(({ origin }) => origin === "upload");
  expect(uploaded?.roleBindings).toMatchObject({
    state: "bound",
    ownerReferenceCount: 1,
    arrangementSourceCount: 0,
    evaluationSourceCount: 0,
  });
  expect(uploaded?.roleBindings.explanation).toMatch(/do not grant.*authority/i);
  const migrated = after.references.find(({ origin }) => origin === "migrated");
  expect(migrated?.roleBindings).toMatchObject({ state: "unbound", ownerReferenceCount: 0 });
}

async function assertPrivateOperationBoundary(
  base: string,
  acquisitions: readonly ReferenceAssetAcquisition[]
): Promise<void> {
  const results: ReferenceSourceOperationResult[] = [];

  for (const acquisition of acquisitions) {
    for (const entry of GATEWAY_ACCESS_MATRIX) {
      const response = await jsonRequest<ReferenceSourceOperationResult>(
        `${base}/api/owner/reference-source-operations/default-decision`,
        {
          method: "POST",
          body: JSON.stringify({
            schemaVersion: 1,
            acquisitionRef: { id: acquisition.id, digest: acquisition.digest },
            operation: entry.operation,
            destination: entry.destination,
            purpose: "T10 private-default production boundary probe",
          }),
        }
      );
      expect(response.response.status).toBe(200);
      const result = requireOk(response.json);
      expect(result).toMatchObject({
        schemaVersion: 1,
        acquisitionId: acquisition.id,
        operation: entry.operation,
        status: entry.status,
        reasonCode:
          entry.status === "review_required"
            ? "owner_private_local_review_required"
            : "owner_private_default_denied",
      });
      expect(Object.keys(result).sort()).toEqual(
        ["acquisitionId", "operation", "reasonCode", "schemaVersion", "snapshotId", "status"].sort()
      );
      results.push(result);
    }
  }

  expect(results).toHaveLength(acquisitions.length * GATEWAY_ACCESS_MATRIX.length);

  const injectedBypass = await jsonRequest<ReferenceSourceOperationResult>(
    `${base}/api/owner/reference-source-operations/default-decision`,
    {
      method: "POST",
      body: JSON.stringify({
        schemaVersion: 1,
        acquisitionRef: {
          id: acquisitions[0]!.id,
          digest: acquisitions[0]!.digest,
        },
        operation: "local_extraction",
        destination: { kind: "local_runtime" },
        purpose: "T10 cached-manifest and legacy-activation bypass probe",
        allowCapability: { forged: true },
        cachedManifest: { access: "allow" },
        directCompilerImport: true,
        legacyActivation: true,
      }),
    }
  );
  expect(injectedBypass.response.status).toBe(400);
  expect(injectedBypass.json).toMatchObject({
    ok: false,
    error: { code: "invalid_request", status: 400 },
  });

  const resultText = JSON.stringify(results);
  for (const canary of [
    LEGACY_TITLE,
    LEGACY_PATH,
    LEGACY_BYTES.toString("utf8"),
    UPLOAD_FILENAME,
    UPLOAD_BYTES.toString("utf8"),
    ...acquisitions.map(({ digest }) => digest),
  ]) {
    expect(resultText).not.toContain(canary);
  }
}

async function assertProtectedSinkBoundary(
  base: string,
  runtime: ReturnType<typeof createRuntime>,
  acquisitions: readonly ReferenceAssetAcquisition[],
  sinks: ReturnType<typeof protectedSinkSpies>
): Promise<void> {
  const readControlledBytes = vi.spyOn(runtime.controlled, "readDigitalAssetBytes");
  const initialReadCount = readControlledBytes.mock.calls.length;
  const results: ReferenceSourceOperationResult[] = [];

  for (const acquisition of acquisitions) {
    for (const entry of GATEWAY_ACCESS_MATRIX) {
      const response = await jsonRequest<ReferenceSourceOperationResult>(
        `${base}/api/owner/reference-source-operations/execute`,
        {
          method: "POST",
          body: JSON.stringify({
            schemaVersion: 1,
            acquisitionRef: ref(acquisition),
            operation: entry.operation,
            destination: entry.destination,
            purpose: LEGACY_TITLE,
          }),
        }
      );
      expect(response.response.status).toBe(200);
      results.push(requireOk(response.json));
    }
    const compiler = await jsonRequest<ReferenceSourceOperationResult>(
      `${base}/api/owner/reference-source-operations/compiler-input`,
      {
        method: "POST",
        body: JSON.stringify({
          schemaVersion: 1,
          acquisitionRef: ref(acquisition),
          purpose: "Reject a quarantined/private reference as direct compiler input",
        }),
      }
    );
    expect(compiler.response.status).toBe(200);
    results.push(requireOk(compiler.json));
  }

  expect(results).toHaveLength(acquisitions.length * (GATEWAY_ACCESS_MATRIX.length + 1));
  expect(
    results.filter(
      ({ operation, status }) => operation === "local_extraction" && status === "review_required"
    )
  ).toHaveLength(acquisitions.length * 2);
  expect(results.filter(({ operation }) => operation === "provider_model_processing")).toEqual(
    expect.arrayContaining(
      acquisitions.map(() =>
        expect.objectContaining({ status: "deny", reasonCode: "owner_private_default_denied" })
      )
    )
  );
  expect(readControlledBytes).toHaveBeenCalledTimes(initialReadCount);
  for (const sink of Object.values(sinks)) expect(sink).not.toHaveBeenCalled();

  for (const endpoint of ["execute", "compiler-input"]) {
    const injected = await jsonRequest<unknown>(
      `${base}/api/owner/reference-source-operations/${endpoint}`,
      {
        method: "POST",
        body: JSON.stringify({
          schemaVersion: 1,
          acquisitionRef: ref(acquisitions[0]!),
          ...(endpoint === "execute"
            ? {
                operation: "provider_model_processing",
                destination: { kind: "provider", id: "provider.fake-t10" },
              }
            : {}),
          purpose: LEGACY_TITLE,
          effects: { readControlledBytes: true, writeSink: true },
          allowCapability: { forged: true },
          sink: "provider",
        }),
      }
    );
    expect(injected.response.status).toBe(400);
    expect(injected.json).toMatchObject({
      ok: false,
      error: { code: "invalid_request", status: 400 },
    });
  }
  expect(readControlledBytes).toHaveBeenCalledTimes(initialReadCount);
  for (const sink of Object.values(sinks)) expect(sink).not.toHaveBeenCalled();

  const bounded = JSON.stringify(results);
  for (const canary of [
    LEGACY_TITLE,
    LEGACY_PATH,
    LEGACY_BYTES.toString("utf8"),
    UPLOAD_FILENAME,
    UPLOAD_BYTES.toString("utf8"),
    ...acquisitions.map(({ digest }) => digest),
  ]) {
    expect(bounded).not.toContain(canary);
  }
}

function protectedSinkSpies() {
  return {
    localReview: vi.fn(),
    compilerInput: vi.fn(),
    provider: vi.fn(),
    knowledgeAuthority: vi.fn(),
    fixtureRepository: vi.fn(),
    sourceRepository: vi.fn(),
    export: vi.fn(),
    redistribution: vi.fn(),
    report: vi.fn(),
    log: vi.fn(),
  } satisfies ReferenceSourceProtectedOperationSinks;
}

type PersistentPaths = ReturnType<typeof persistentPaths>;

function persistentPaths(root: string) {
  return {
    owner: path.join(root, "owner"),
    migrationPrivate: path.join(root, "migration-private"),
    workbenchPrivate: path.join(root, "workbench-private"),
    publication: path.join(root, "knowledge-publication"),
    staging: path.join(root, "reference-source-staging"),
    controlled: path.join(root, "controlled-artifacts"),
  };
}

function createRuntime(
  paths: PersistentPaths,
  runtime: string,
  options: {
    publicationFaultInjector?: ConstructorParameters<
      typeof KnowledgePublicationStore
    >[0]["faultInjector"];
  } = {}
) {
  let stagingId = 0;
  const stagingStore = new ReferenceSourceStagingStore({
    rootDirectory: paths.staging,
    now: () => new Date(NOW),
  });
  return {
    publication: new KnowledgePublicationStore({
      rootDirectory: paths.publication,
      now: () => new Date(NOW),
      faultInjector: options.publicationFaultInjector,
    }),
    stagingStore,
    staging: new ReferenceSourceStagingService({
      store: stagingStore,
      now: () => new Date(NOW),
      createId: () => `t10-${runtime}-${++stagingId}`,
    }),
    controlled: new ReferenceSourceControlledArtifactStore({
      rootDirectory: paths.controlled,
      now: () => new Date(NOW),
    }),
  };
}

type MigrationPlan = {
  expectedHead: null;
  planDigest: string;
  mappings: Array<{ legacyId: string }>;
  quarantines: Array<{ legacyId: string; reason: string; action: string }>;
};

type MigrationCommit = OwnerReferenceMigrationCommitView;

type UploadResult = {
  publicationState: "staging_only";
  replayed: boolean;
  digitalAsset: ReferenceDigitalAsset;
  acquisition: ReferenceAssetAcquisition;
  head: { snapshotId: string; digest: string; revision: number };
};

async function readWorkbench(base: string): Promise<OwnerReferenceWorkbenchSnapshot> {
  const result = await jsonRequest<OwnerReferenceWorkbenchSnapshot>(
    `${base}/api/owner/reference-source-workbench`
  );
  expect(result.response.status).toBe(200);
  return requireOk(result.json);
}

async function readFailClosedWorkbench(
  base: string
): Promise<ApiResponse<OwnerReferenceWorkbenchSnapshot>> {
  const result = await jsonRequest<OwnerReferenceWorkbenchSnapshot>(
    `${base}/api/owner/reference-source-workbench`
  );
  expect(result.response.status).toBe(422);
  expect(result.json).toMatchObject({
    ok: false,
    error: {
      code: "unprocessable_content",
      message: "The Owner-reference Workbench snapshot is internally inconsistent",
      status: 422,
    },
  });
  return result.json;
}

function withoutCorrelation<T>(response: ApiResponse<T>): unknown {
  if (response.ok) return response;
  const { correlationId: _correlationId, ...error } = response.error;
  return { ok: false, error };
}

async function readCompatibility(base: string): Promise<OwnerReferenceMigrationCompatibilityView> {
  const result = await jsonRequest<OwnerReferenceMigrationCompatibilityView>(
    `${base}/api/owner/reference-migrations/owner-references`
  );
  expect(result.response.status).toBe(200);
  return requireOk(result.json);
}

type MigrationHead = NonNullable<OwnerReferenceMigrationCommitView["head"]>;

function requireHead(head: OwnerReferenceMigrationCommitView["head"]): MigrationHead {
  if (!head) throw new Error("Expected a committed migration head");
  return head;
}

function generationRef(head: MigrationHead): { id: string; digest: string; revision: number } {
  return { id: head.generationId, digest: head.digest, revision: head.revision };
}

async function rawUpload(
  base: string,
  bytes: Uint8Array,
  acquisitionKey: string,
  expectedHead?: { id: string; digest: string }
) {
  const response = await fetch(`${base}/api/owner/reference-source-staging/assets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "X-Reference-Acquisition-Key": acquisitionKey,
      ...(expectedHead
        ? {
            "X-Reference-Expected-Head-Id": expectedHead.id,
            "X-Reference-Expected-Head-Digest": expectedHead.digest,
          }
        : {}),
    },
    body: bytes,
  });
  return { response, json: (await response.json()) as ApiResponse<UploadResult> };
}

function requireOk<T>(response: ApiResponse<T>): T {
  if (!response.ok) throw new Error(`Expected successful API response, got ${response.error.code}`);
  return response.data;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function listen(app: ReturnType<typeof createApp>): Promise<Server> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function address(server: Server): string {
  const value = server.address();
  if (!value || typeof value === "string") throw new Error("Expected TCP server address");
  return `http://127.0.0.1:${value.port}`;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

async function jsonRequest<T>(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  return { response, json: (await response.json()) as ApiResponse<T> };
}
