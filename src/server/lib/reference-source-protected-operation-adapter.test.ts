import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  withReferenceRecordDigest,
  type ReferenceAccessDestination,
  type ReferenceAccessOperation,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceSourceStagingSnapshot,
} from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceOperationGateway,
  ReferenceSourceOperationRequestError,
  type ReferenceSourceOperationRequest,
} from "./reference-source-operation-gateway.js";
import {
  createFailClosedReferenceSourceProtectedOperationSinks,
  ReferenceSourceProtectedOperationAdapter,
  ReferenceSourceProtectedOperationUnavailableError,
  type ReferenceSourceProtectedOperationSinkName,
  type ReferenceSourceProtectedOperationSinks,
} from "./reference-source-protected-operation-adapter.js";
import type { ReferenceSourceStagingState } from "./reference-source-staging-store.js";

const NOW = "2026-07-16T12:00:00.000Z";
const PRIVATE_CANARY = "PRIVATE-T10-PATH-TITLE-CONTENT-CANARY";
const CONTROLLED_BYTES = new TextEncoder().encode("%PDF-1.7\nPRIVATE-T10-CONTROLLED-BYTE-CANARY\n");

describe("protected reference-source operation adapter", () => {
  it("has an explicit fail-closed production entry for every named source-bearing workflow", async () => {
    const sinks = createFailClosedReferenceSourceProtectedOperationSinks();

    expect(Object.keys(sinks).sort()).toEqual(
      [
        "localReview",
        "compilerInput",
        "provider",
        "knowledgeAuthority",
        "fixtureRepository",
        "sourceRepository",
        "export",
        "redistribution",
        "report",
        "log",
      ].sort()
    );
    for (const sinkName of Object.keys(sinks) as ReferenceSourceProtectedOperationSinkName[]) {
      const sink = sinks[sinkName];
      await expect(
        Promise.resolve().then(() =>
          sink({
            bytes: new Uint8Array(CONTROLLED_BYTES),
            operation: "log",
            destination: { kind: "local_runtime" },
            purpose: PRIVATE_CANARY,
          })
        )
      ).rejects.toMatchObject({
        code: "reference_source_protected_operation_not_configured",
        sinkName,
      } satisfies Partial<ReferenceSourceProtectedOperationUnavailableError>);
    }
  });

  it.each<{
    label: string;
    operation: ReferenceAccessOperation;
    destination: ReferenceAccessDestination;
    expectedSink: keyof ReferenceSourceProtectedOperationSinks;
  }>([
    {
      label: "provider",
      operation: "provider_model_processing",
      destination: { kind: "provider", id: "provider.fake-t10" },
      expectedSink: "provider",
    },
    {
      label: "fixture repository",
      operation: "fixture_inclusion",
      destination: { kind: "repository", id: "repository.fixture-t10" },
      expectedSink: "fixtureRepository",
    },
    {
      label: "source repository",
      operation: "repository_inclusion",
      destination: { kind: "repository", id: "repository.source-t10" },
      expectedSink: "sourceRepository",
    },
    {
      label: "knowledge authority",
      operation: "pack_citation",
      destination: { kind: "repository", id: "repository.knowledge-t10" },
      expectedSink: "knowledgeAuthority",
    },
    {
      label: "export",
      operation: "export",
      destination: { kind: "export", id: "export.t10" },
      expectedSink: "export",
    },
    {
      label: "redistribution",
      operation: "redistribution",
      destination: { kind: "recipient", id: "recipient.t10" },
      expectedSink: "redistribution",
    },
    {
      label: "report",
      operation: "report",
      destination: { kind: "local_runtime" },
      expectedSink: "report",
    },
    {
      label: "log",
      operation: "log",
      destination: { kind: "local_runtime" },
      expectedSink: "log",
    },
  ])(
    "denies $label before controlled bytes or any named sink",
    async ({ operation, destination, expectedSink }) => {
      const { adapter, readControlledBytes, sinks } = harness();

      const result = await adapter.execute(request(operation, destination, PRIVATE_CANARY));

      expect(result).toMatchObject({
        schemaVersion: 1,
        operation,
        status: "deny",
        reasonCode: "owner_private_default_denied",
      });
      expect(JSON.stringify(result)).not.toContain(PRIVATE_CANARY);
      expect(JSON.stringify(result)).not.toContain(stagingState().snapshot.digest);
      expect(readControlledBytes).not.toHaveBeenCalled();
      expect(sinks[expectedSink]).not.toHaveBeenCalled();
      expect(allSinkCalls(sinks)).toBe(0);
    }
  );

  it("keeps local review and direct compiler-input proposals effect-free", async () => {
    const { adapter, readControlledBytes, sinks } = harness();
    const acquisitionRef = request(
      "owner_private_study",
      { kind: "local_runtime" },
      PRIVATE_CANARY
    ).acquisitionRef;

    const review = await adapter.execute(
      request("owner_private_study", { kind: "local_runtime" }, PRIVATE_CANARY)
    );
    const compiler = await adapter.executeCompilerInput({
      schemaVersion: 1,
      acquisitionRef,
      purpose: PRIVATE_CANARY,
    });

    for (const result of [review, compiler]) {
      expect(result).toMatchObject({
        status: "review_required",
        reasonCode: "owner_private_local_review_required",
      });
      expect(JSON.stringify(result)).not.toContain(PRIVATE_CANARY);
    }
    expect(compiler.operation).toBe("local_extraction");
    expect(readControlledBytes).not.toHaveBeenCalled();
    expect(sinks.localReview).not.toHaveBeenCalled();
    expect(sinks.compilerInput).not.toHaveBeenCalled();
    expect(allSinkCalls(sinks)).toBe(0);
  });

  it("rejects client-shaped bypass fields before capability resolution or effects", async () => {
    const resolveServerCapability = vi.fn(() => ({ forged: true }));
    const { adapter, readControlledBytes, sinks } = harness({ resolveServerCapability });
    const forged = {
      ...request("export", { kind: "export", id: "export.t10" }, PRIVATE_CANARY),
      allowCapability: { clientControlled: true },
      readControlledBytes: PRIVATE_CANARY,
      sink: "provider",
    } as unknown as ReferenceSourceOperationRequest;

    await expect(adapter.execute(forged)).rejects.toEqual(
      expect.any(ReferenceSourceOperationRequestError)
    );
    expect(resolveServerCapability).not.toHaveBeenCalled();
    expect(readControlledBytes).not.toHaveBeenCalled();
    expect(allSinkCalls(sinks)).toBe(0);
  });

  it("defaults closed when server capability lookup fails or has no gateway verifier", async () => {
    const failed = harness({
      resolveServerCapability: () => {
        throw new Error(PRIVATE_CANARY);
      },
    });
    const failedResult = await failed.adapter.execute(
      request("export", { kind: "export", id: "export.t10" }, PRIVATE_CANARY)
    );
    expect(failedResult).toMatchObject({
      status: "deny",
      reasonCode: "owner_private_default_denied",
    });
    expect(JSON.stringify(failedResult)).not.toContain(PRIVATE_CANARY);
    expect(failed.readControlledBytes).not.toHaveBeenCalled();
    expect(allSinkCalls(failed.sinks)).toBe(0);

    const unverifiable = harness({ resolveServerCapability: () => ({ serverReceipt: true }) });
    const unverifiableResult = await unverifiable.adapter.execute(
      request(
        "provider_model_processing",
        { kind: "provider", id: "provider.fake-t10" },
        PRIVATE_CANARY
      )
    );
    expect(unverifiableResult).toMatchObject({
      status: "deny",
      reasonCode: "owner_private_default_denied",
    });
    expect(unverifiable.readControlledBytes).not.toHaveBeenCalled();
    expect(allSinkCalls(unverifiable.sinks)).toBe(0);
  });

  it("never reuses a local-extraction capability as direct compiler-input authority", async () => {
    const token = Object.freeze({ receipt: "server-local-extraction-only" });
    const state = stagingState();
    const verifyAllowCapability = vi.fn(() => true);
    const resolveServerCapability = vi.fn(() => token);
    const readControlledBytes = vi.fn(() => new Uint8Array(CONTROLLED_BYTES));
    const sinks = sinkSpies();
    const adapter = new ReferenceSourceProtectedOperationAdapter({
      gateway: new ReferenceSourceOperationGateway({
        stagingStore: { readCurrentState: () => state },
        verifyAllowCapability,
      }),
      readControlledBytes,
      sinks,
      resolveServerCapability,
    });

    const result = await adapter.executeCompilerInput({
      schemaVersion: 1,
      acquisitionRef: request("local_extraction", { kind: "local_runtime" }, PRIVATE_CANARY)
        .acquisitionRef,
      purpose: PRIVATE_CANARY,
    });

    expect(result).toMatchObject({
      operation: "local_extraction",
      status: "review_required",
      reasonCode: "owner_private_local_review_required",
    });
    expect(resolveServerCapability).not.toHaveBeenCalled();
    expect(verifyAllowCapability).not.toHaveBeenCalled();
    expect(readControlledBytes).not.toHaveBeenCalled();
    expect(allSinkCalls(sinks)).toBe(0);
  });

  it("routes an explicitly server-authenticated exact scope to only its named sink", async () => {
    const token = Object.freeze({ receipt: "server-only-exact-scope" });
    const verifyAllowCapability = vi.fn(({ capability }) => capability === token);
    const state = stagingState();
    const gateway = new ReferenceSourceOperationGateway({
      stagingStore: { readCurrentState: () => state },
      verifyAllowCapability,
    });
    const readControlledBytes = vi.fn(() => new Uint8Array(CONTROLLED_BYTES));
    const sinks = sinkSpies();
    const adapter = new ReferenceSourceProtectedOperationAdapter({
      gateway,
      readControlledBytes,
      sinks,
      resolveServerCapability: () => token,
    });

    const result = await adapter.execute(
      request(
        "provider_model_processing",
        { kind: "provider", id: "provider.authorized" },
        "exact server-authorized purpose"
      )
    );

    expect(result).toMatchObject({ status: "allow", reasonCode: "verified_allow_capability" });
    expect(verifyAllowCapability).toHaveBeenCalledTimes(1);
    expect(readControlledBytes).toHaveBeenCalledTimes(1);
    expect(sinks.provider).toHaveBeenCalledTimes(1);
    expect(allSinkCalls(sinks)).toBe(1);
  });
});

function harness(options: { resolveServerCapability?: () => unknown } = {}) {
  const state = stagingState();
  const gateway = new ReferenceSourceOperationGateway({
    stagingStore: { readCurrentState: () => state },
  });
  const readControlledBytes = vi.fn(() => {
    throw new Error(PRIVATE_CANARY);
  });
  const sinks = sinkSpies();
  const adapter = new ReferenceSourceProtectedOperationAdapter({
    gateway,
    readControlledBytes,
    sinks,
    ...(options.resolveServerCapability
      ? { resolveServerCapability: options.resolveServerCapability }
      : {}),
  });
  return { adapter, readControlledBytes, sinks };
}

function sinkSpies() {
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

function allSinkCalls(sinks: ReturnType<typeof sinkSpies>): number {
  return Object.values(sinks).reduce((total, sink) => total + sink.mock.calls.length, 0);
}

function request(
  operation: ReferenceAccessOperation,
  destination: ReferenceAccessDestination,
  purpose: string
): ReferenceSourceOperationRequest {
  const acquisition = stagingState().snapshot.records.find(
    (record): record is ReferenceAssetAcquisition => record.recordKind === "asset_acquisition"
  );
  if (!acquisition) throw new Error("Expected an acquisition fixture");
  return {
    schemaVersion: 1,
    acquisitionRef: ref(acquisition),
    operation,
    destination,
    purpose,
  };
}

function stagingState(): ReferenceSourceStagingState {
  const asset = withReferenceRecordDigest({
    recordKind: "digital_asset" as const,
    id: "asset.private-t10-canary",
    sha256: createHash("sha256").update(CONTROLLED_BYTES).digest("hex"),
    mediaType: "application/pdf",
    byteLength: CONTROLLED_BYTES.byteLength,
  }) as ReferenceDigitalAsset;
  const acquisition = withReferenceRecordDigest({
    recordKind: "asset_acquisition" as const,
    id: "acquisition.owner-private.opaque-t10",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: {
      sourceKind: "upload" as const,
      ownerActionRef: externalRef("owner-action.opaque-t10"),
    },
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.owner-private"),
  }) as ReferenceAssetAcquisition;
  const snapshot = withReferenceRecordDigest({
    schemaVersion: 1 as const,
    id: "snapshot.owner-private.t10",
    revision: 1,
    publicationState: "staging_only" as const,
    createdAt: NOW,
    records: [asset, acquisition],
  }) as ReferenceSourceStagingSnapshot;
  return {
    head: {
      snapshotId: snapshot.id,
      digest: snapshot.digest,
      revision: snapshot.revision,
    },
    snapshot,
  };
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: withReferenceRecordDigest({ id }).digest };
}
